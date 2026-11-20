import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { setupApp } from '../src/setup';

// uuids reales de Valorant API.
export const ASCENT = '7eaecc1b-4337-bbf6-6ab9-04b8f06b3319';
export const BIND = '2c9d57ec-4431-9c5e-2939-8f9ef6dd5cba';
export const THE_RANGE = 'ee613ee9-28b7-4beb-9666-08db13bb2244'; // no competitivo
export const SAGE = '569fdd95-4d10-43ab-ca70-79becc718b46';
export const SOVA = '320b2a48-4d9b-a075-30f1-1f93a9b638fa';
export const OMEN = '8e253930-4c05-31dd-1b6c-968525494517';
export const ODIN = '63e6c2b6-4a8e-869c-3d4c-e38355226584';
export const VANDAL = '9c82e19d-4575-0200-1a81-3eacf00cf872';
export const CLASSIC = '29a0cfab-485b-f5d5-779a-b59f85e204a8';
export const MELEE = '2f59173c-4bed-b6c3-2191-dea9b58be9c7';

const media = (kind: string, id: string, file: string) => `https://media.valorant-api.com/${kind}/${id}/${file}.png`;

const rawMap = (uuid: string, displayName: string, tacticalDescription: string | null) => ({
  uuid,
  displayName,
  narrativeDescription: null,
  tacticalDescription,
  coordinates: tacticalDescription ? '45°26\'BF\'N,12°20\'Q\'E' : null,
  displayIcon: media('maps', uuid, 'displayicon'),
  listViewIcon: media('maps', uuid, 'listviewicon'),
  listViewIconTall: media('maps', uuid, 'listviewicontall'),
  splash: media('maps', uuid, 'splash'),
  callouts: [{ regionName: 'Mid', superRegionName: 'MID', location: { x: 0, y: 0 } }],
});

const rawAgent = (uuid: string, displayName: string, role: string) => ({
  uuid,
  displayName,
  description: 'Descripción larga',
  displayIcon: media('agents', uuid, 'displayicon'),
  fullPortrait: media('agents', uuid, 'fullportrait'),
  isPlayableCharacter: true,
  role: { uuid: 'x', displayName: role, description: 'rol' },
  abilities: [{ slot: 'Ability1', displayName: 'Habilidad' }],
});

const rawWeapon = (uuid: string, displayName: string, shop: { cost: number; category: string; categoryText: string } | null) => ({
  uuid,
  displayName,
  category: 'EEquippableCategory::X',
  displayIcon: media('weapons', uuid, 'displayicon'),
  weaponStats: { fireRate: 10 },
  shopData: shop && { ...shop, gridPosition: null },
  skins: [{ uuid: 'skin-1', displayName: 'Skin Prime', chromas: [], levels: [] }],
});

// Respuestas "crudas" como las de Valorant API, con campos sobrantes y skins,
// para probar también el filtrado y el recorte.
export const RAW = {
  maps: [rawMap(BIND, 'Bind', 'Sites A/B'), rawMap(THE_RANGE, 'Campo de tiro', null), rawMap(ASCENT, 'Ascent', 'Sites A/B')],
  agents: [rawAgent(SOVA, 'Sova', 'Iniciador'), rawAgent(SAGE, 'Sage', 'Centinela'), rawAgent(OMEN, 'Omen', 'Controlador')],
  weapons: [
    rawWeapon(ODIN, 'Odin', { cost: 3200, category: 'Heavy Weapons', categoryText: 'Armas pesadas' }),
    rawWeapon(VANDAL, 'Vandal', { cost: 2900, category: 'Rifles', categoryText: 'Rifles de asalto' }),
    rawWeapon(MELEE, 'Cuerpo a cuerpo', null),
    rawWeapon(CLASSIC, 'Classic', { cost: 0, category: 'Pistols', categoryText: 'Armas de mano' }),
  ],
};

// Sustituye la red: fetch devuelve los datos fijos (o falla si se indica). Nunca sale a internet.
export function mockValorantApi(mode: 'ok' | 'fail' = 'ok') {
  return jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    if (mode === 'fail') throw new Error('red caída (simulada)');
    const url = new URL(String(input));
    if (url.host !== 'valorant-api.com') throw new Error(`Petición inesperada a ${url}`);
    const key = url.pathname.split('/').pop() as keyof typeof RAW;
    return new Response(JSON.stringify({ status: 200, data: RAW[key] }), {
      headers: { 'content-type': 'application/json' },
    });
  });
}

export async function createApp() {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  setupApp(app);
  await app.init();
  return app;
}

export async function resetDb(app: INestApplication) {
  await app.get(PrismaService).$executeRaw`TRUNCATE "Vote", "User" CASCADE`;
}

let counter = 0;
// Registra un usuario nuevo y devuelve su cookie de sesión.
export async function signUp(app: INestApplication) {
  const res = await request(app.getHttpServer())
    .post('/api/auth/register')
    .send({ email: `user${++counter}@test.dev`, password: 'contraseña-segura' })
    .expect(201);
  const cookie = [res.headers['set-cookie']].flat()[0].split(';')[0];
  return { id: res.body.id as string, cookie };
}
