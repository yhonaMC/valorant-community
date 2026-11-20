import { Body, Controller, Get, Injectable, Module, Param, Put, Req, UseGuards } from '@nestjs/common';
import { Category as DbCategory } from '@prisma/client';
import { IsIn, IsString, IsUUID } from 'class-validator';
import type { Request } from 'express';
import { AuthModule } from '../auth/auth.module';
import { AuthService, AuthedRequest, SessionGuard } from '../auth/auth.service';
import { Catalog, CatalogModule, CatalogService } from '../catalog/catalog.service';
import { PrismaService } from '../prisma.service';
import { ApiError } from '../setup';

const CATEGORIES = ['agent', 'weapon'] as const;
type Category = (typeof CATEGORIES)[number];
const TO_DB: Record<Category, DbCategory> = { agent: 'AGENT', weapon: 'WEAPON' };

type CategoryResults = { total: number; counts: { optionId: string; count: number }[] };
type MapResults = {
  mapId: string;
  agent: CategoryResults;
  weapon: CategoryResults;
  myVotes: { agent: string | null; weapon: string | null } | null;
};

class VoteParams {
  @IsString()
  mapId!: string;

  @IsIn(CATEGORIES, { message: 'La categoría debe ser agent o weapon' })
  category!: Category;
}

class VoteBody {
  // 'loose': los uuid de Valorant API no cumplen los bits de versión/variante del RFC.
  @IsUUID('loose', { message: 'Opción no válida' })
  optionId!: string;
}

@Injectable()
class VotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
  ) {}

  async vote(userId: string, mapId: string, category: Category, optionId: string): Promise<MapResults> {
    const catalog = await this.catalog.get(); // 503 si nunca se cargó
    this.assertKnownMap(catalog, mapId);
    const options = category === 'agent' ? catalog.agents : catalog.weapons;
    if (!options.some((o) => o.id === optionId)) {
      throw new ApiError(422, 'La opción no existe en esta categoría', { optionId: 'La opción no existe en esta categoría' });
    }
    // Una sola sentencia atómica: la restricción única (userId, mapId, category)
    // garantiza un voto por usuario, mapa y categoría, también con peticiones concurrentes.
    await this.prisma.$executeRaw`
      INSERT INTO "Vote" ("id", "userId", "mapId", "category", "optionId", "updatedAt")
      VALUES (gen_random_uuid()::text, ${userId}, ${mapId}, ${TO_DB[category]}::"Category", ${optionId}, now())
      ON CONFLICT ("userId", "mapId", "category")
      DO UPDATE SET "optionId" = EXCLUDED."optionId", "updatedAt" = now()`;
    return this.results(mapId, userId);
  }

  async resultsFor(mapId: string, userId: string | null): Promise<MapResults> {
    // Los resultados dependen solo de nuestra BD: sin catálogo se devuelven igualmente.
    const catalog = await this.catalog.get().catch(() => null);
    if (catalog) this.assertKnownMap(catalog, mapId);
    return this.results(mapId, userId);
  }

  private assertKnownMap(catalog: Catalog, mapId: string) {
    if (!catalog.maps.some((m) => m.id === mapId)) throw new ApiError(404, 'Mapa no encontrado');
  }

  private async results(mapId: string, userId: string | null): Promise<MapResults> {
    const rows = await this.prisma.$queryRaw<{ category: DbCategory; optionId: string; count: number }[]>`
      SELECT "category", "optionId", COUNT(*)::int AS "count"
      FROM "Vote" WHERE "mapId" = ${mapId}
      GROUP BY "category", "optionId"
      ORDER BY "count" DESC, "optionId" ASC`;
    const pick = (c: DbCategory): CategoryResults => {
      const counts = rows.filter((r) => r.category === c).map(({ optionId, count }) => ({ optionId, count }));
      return { total: counts.reduce((sum, r) => sum + r.count, 0), counts };
    };
    let myVotes: MapResults['myVotes'] = null;
    if (userId) {
      const mine = await this.prisma.vote.findMany({ where: { userId, mapId } });
      const of = (c: DbCategory) => mine.find((v) => v.category === c)?.optionId ?? null;
      myVotes = { agent: of('AGENT'), weapon: of('WEAPON') };
    }
    return { mapId, agent: pick('AGENT'), weapon: pick('WEAPON'), myVotes };
  }
}

@Controller('maps/:mapId')
class VotesController {
  constructor(
    private readonly votes: VotesService,
    private readonly auth: AuthService,
  ) {}

  @Get('results')
  async results(@Param('mapId') mapId: string, @Req() req: Request) {
    const user = await this.auth.userFromRequest(req); // sesión opcional
    return this.votes.resultsFor(mapId, user?.id ?? null);
  }

  @Put('votes/:category')
  @UseGuards(SessionGuard)
  vote(@Param() params: VoteParams, @Body() body: VoteBody, @Req() req: AuthedRequest) {
    return this.votes.vote(req.user.id, params.mapId, params.category, body.optionId);
  }
}

@Module({
  imports: [AuthModule, CatalogModule],
  controllers: [VotesController],
  providers: [VotesService],
})
export class VotesModule {}
