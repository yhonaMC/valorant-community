import { Controller, Get, Injectable, Logger, Module, OnApplicationBootstrap } from '@nestjs/common';
import { ApiError } from '../setup';

// Formas del contrato (§3.5, apps/web/src/api/types.ts).
export type MapInfo = { id: string; name: string; sites: string; coordinates: string; image: string; thumb: string };
export type Agent = { id: string; name: string; role: string; icon: string; portrait: string };
export type Weapon = { id: string; name: string; category: string; icon: string };
export type Catalog = { maps: MapInfo[]; agents: Agent[]; weapons: Weapon[] };

const BASE = 'https://valorant-api.com/v1/';
const TTL_MS = 60 * 60 * 1000;
// Orden del menú de compra del juego (shopData.category, sin traducir) y su etiqueta.
// No se usa shopData.categoryText: en es-ES, Warden dice «Rifles» y el resto de su
// categoría «Rifles de asalto», y el selector lo agruparía aparte.
const WEAPON_CATEGORIES: Record<string, string> = {
  Pistols: 'Armas de mano',
  SMGs: 'Subfusiles',
  Shotguns: 'Escopetas',
  Rifles: 'Rifles',
  'Sniper Rifles': 'Francotirador',
  'Heavy Weapons': 'Armas pesadas',
};
const WEAPON_CATEGORY_ORDER = Object.keys(WEAPON_CATEGORIES);

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'es');

// Respuesta externa sin tipar: solo se leen los campos que se recortan abajo.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchData(path: string): Promise<any[]> {
  const url = new URL(path, BASE);
  url.searchParams.set('language', 'es-ES');
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`Valorant API respondió ${res.status} en ${url.pathname}`);
  const body: any = await res.json(); // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!Array.isArray(body?.data)) throw new Error(`Respuesta inesperada de Valorant API en ${url.pathname}`);
  return body.data;
}

@Injectable()
export class CatalogService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CatalogService.name);
  private cache: Catalog | null = null;
  private loadedAt = 0;
  private inFlight: Promise<Catalog> | null = null;

  // Precarga sin bloquear el arranque.
  onApplicationBootstrap() {
    this.refresh().catch((e) => this.logger.warn(`No se pudo precargar el catálogo: ${e}`));
  }

  // Con caché: se sirve al momento y, si caducó, se renueva en segundo plano
  // (si la renovación falla, se sigue sirviendo la caché). Sin caché: se espera la descarga o 503.
  async get(): Promise<Catalog> {
    if (this.cache) {
      if (Date.now() - this.loadedAt >= TTL_MS) {
        this.refresh().catch((e) => this.logger.warn(`No se pudo renovar el catálogo: ${e}`));
      }
      return this.cache;
    }
    try {
      return await this.refresh();
    } catch (e) {
      this.logger.warn(`Catálogo no disponible: ${e}`);
      throw new ApiError(503, 'El servicio de datos de VALORANT no responde. Inténtalo de nuevo en unos minutos.');
    }
  }

  // Una sola descarga en curso a la vez.
  private refresh(): Promise<Catalog> {
    this.inFlight ??= this.download()
      .then((catalog) => {
        this.cache = catalog;
        this.loadedAt = Date.now();
        return catalog;
      })
      .finally(() => (this.inFlight = null));
    return this.inFlight;
  }

  async download(): Promise<Catalog> {
    const [maps, agents, weapons] = await Promise.all([
      fetchData('maps'),
      fetchData('agents?isPlayableCharacter=true'),
      fetchData('weapons'), // ~3,6 MB por las skins: se recorta aquí y nunca se reenvía
    ]);
    return {
      // Solo los mapas competitivos tienen tacticalDescription.
      maps: maps
        .filter((m) => m.tacticalDescription != null)
        .map((m) => ({
          id: m.uuid,
          name: m.displayName,
          sites: m.tacticalDescription,
          coordinates: m.coordinates,
          image: m.splash,
          thumb: m.listViewIcon,
        }))
        .sort(byName),
      agents: agents
        .filter((a) => a.isPlayableCharacter)
        .map((a) => ({
          id: a.uuid,
          name: a.displayName,
          role: a.role?.displayName,
          icon: a.displayIcon,
          portrait: a.fullPortrait,
        }))
        .sort(byName),
      // Sin shopData = cuerpo a cuerpo.
      weapons: weapons
        .filter((w) => w.shopData != null)
        .sort((a, b) => {
          const rank = (w: typeof a) => {
            const i = WEAPON_CATEGORY_ORDER.indexOf(w.shopData.category);
            return i === -1 ? WEAPON_CATEGORY_ORDER.length : i;
          };
          return rank(a) - rank(b) || a.shopData.cost - b.shopData.cost || a.displayName.localeCompare(b.displayName);
        })
        .map((w) => ({
          id: w.uuid,
          name: w.displayName,
          category: WEAPON_CATEGORIES[w.shopData.category] ?? w.shopData.categoryText,
          icon: w.displayIcon,
        })),
    };
  }
}

@Controller('catalog')
class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  get() {
    return this.catalog.get();
  }
}

@Module({ controllers: [CatalogController], providers: [CatalogService], exports: [CatalogService] })
export class CatalogModule {}
