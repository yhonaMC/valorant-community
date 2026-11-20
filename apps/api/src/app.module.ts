import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.service';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma.service';
import { VotesModule } from './votes/votes.module';

@Module({
  imports: [PrismaModule, AuthModule, CatalogModule, VotesModule],
  controllers: [HealthController],
})
export class AppModule {}
