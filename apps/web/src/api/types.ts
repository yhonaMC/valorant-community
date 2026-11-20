// Contrato de la API (PLAN.md §3.5). Única fuente de tipos del frontend.
// Si cambia aquí, cambia también en apps/api y en PLAN.md.

export type User = { id: string; email: string };

export type MapInfo = {
  id: string;
  name: string;
  sites: string;
  coordinates: string;
  image: string;
  thumb: string;
};
export type Agent = { id: string; name: string; role: string; icon: string; portrait: string };
export type Weapon = { id: string; name: string; category: string; icon: string };

export type Catalog = { maps: MapInfo[]; agents: Agent[]; weapons: Weapon[] };

export type Category = 'agent' | 'weapon';

export type CategoryResults = {
  total: number;
  counts: { optionId: string; count: number }[]; // solo opciones con votos, orden descendente
};

export type MapResults = {
  mapId: string;
  agent: CategoryResults;
  weapon: CategoryResults;
  myVotes: { agent: string | null; weapon: string | null } | null; // null = sin sesión
};

export type ApiError = {
  statusCode: number;
  message: string;
  fields?: Record<string, string>;
};
