import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { PrismaService } from '../src/prisma.service';
import {
  ASCENT, BIND, CLASSIC, MELEE, ODIN, OMEN, SAGE, SOVA, THE_RANGE, VANDAL,
  createApp, mockValorantApi, resetDb, signUp,
} from './helpers';

describe('Catálogo y votos (H3)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let fetchSpy: ReturnType<typeof mockValorantApi>;

  const vote = (cookie: string, mapId: string, category: string, optionId: string) =>
    http.put(`/api/maps/${mapId}/votes/${category}`).set('Cookie', cookie).send({ optionId });
  const results = (mapId: string, cookie?: string) => {
    const req = http.get(`/api/maps/${mapId}/results`);
    return cookie ? req.set('Cookie', cookie) : req;
  };

  beforeAll(async () => {
    fetchSpy = mockValorantApi();
    app = await createApp();
    http = request(app.getHttpServer());
  });
  beforeEach(() => resetDb(app));
  afterAll(async () => {
    await app.close();
    jest.restoreAllMocks();
  });

  describe('GET /api/catalog', () => {
    it('filtra, recorta y ordena: sin skins ni campos sobrantes', async () => {
      const res = await http.get('/api/catalog').expect(200);
      const { maps, agents, weapons } = res.body;
      expect(Object.keys(res.body).sort()).toEqual(['agents', 'maps', 'weapons']);

      expect(maps.map((m: { name: string }) => m.name)).toEqual(['Ascent', 'Bind']); // sin «Campo de tiro»
      expect(maps[0]).toEqual({
        id: ASCENT,
        name: 'Ascent',
        sites: 'Sites A/B',
        coordinates: expect.any(String),
        image: `https://media.valorant-api.com/maps/${ASCENT}/splash.png`,
        thumb: `https://media.valorant-api.com/maps/${ASCENT}/listviewicon.png`,
      });

      expect(agents.map((a: { name: string }) => a.name)).toEqual(['Omen', 'Sage', 'Sova']);
      expect(agents[1]).toEqual({
        id: SAGE,
        name: 'Sage',
        role: 'Centinela',
        icon: `https://media.valorant-api.com/agents/${SAGE}/displayicon.png`,
        portrait: `https://media.valorant-api.com/agents/${SAGE}/fullportrait.png`,
      });

      // Sin cuerpo a cuerpo; por categoría (orden de la tienda) y coste.
      expect(weapons.map((w: { id: string }) => w.id)).toEqual([CLASSIC, VANDAL, ODIN]);
      expect(weapons[1]).toEqual({
        id: VANDAL,
        name: 'Vandal',
        category: 'Rifles', // etiqueta por categoría de tienda, no shopData.categoryText
        icon: `https://media.valorant-api.com/weapons/${VANDAL}/displayicon.png`,
      });

      expect(res.text).not.toMatch(/skin|chroma|callouts|abilities|weaponStats/i);
      expect(res.text).not.toContain(MELEE);
    });

    it('caché: peticiones simultáneas y posteriores no repiten la descarga', async () => {
      await Promise.all(Array.from({ length: 5 }, () => http.get('/api/catalog').expect(200)));
      // 3 colecciones descargadas una sola vez (precarga al arrancar).
      expect(fetchSpy).toHaveBeenCalledTimes(3);
      expect(fetchSpy.mock.calls.map(([u]) => String(u)).sort()).toEqual([
        'https://valorant-api.com/v1/agents?isPlayableCharacter=true&language=es-ES',
        'https://valorant-api.com/v1/maps?language=es-ES',
        'https://valorant-api.com/v1/weapons?language=es-ES',
      ]);
    });
  });

  describe('Criterio de aceptación (puntos 1–4)', () => {
    it('Sage dos veces → 1 voto; cambio a Omen → el voto se mueve; arma y otros mapas intactos', async () => {
      const me = await signUp(app);
      await vote(me.cookie, ASCENT, 'weapon', VANDAL).expect(200);
      await vote(me.cookie, BIND, 'agent', SOVA).expect(200);

      // 1. Voto duplicado
      await vote(me.cookie, ASCENT, 'agent', SAGE).expect(200);
      let res = await vote(me.cookie, ASCENT, 'agent', SAGE).expect(200);
      expect(res.body).toEqual({
        mapId: ASCENT,
        agent: { total: 1, counts: [{ optionId: SAGE, count: 1 }] },
        weapon: { total: 1, counts: [{ optionId: VANDAL, count: 1 }] },
        myVotes: { agent: SAGE, weapon: VANDAL },
      });

      // 3. Cambio de elección
      res = await vote(me.cookie, ASCENT, 'agent', OMEN).expect(200);
      expect(res.body.agent).toEqual({ total: 1, counts: [{ optionId: OMEN, count: 1 }] });
      expect(res.body.myVotes).toEqual({ agent: OMEN, weapon: VANDAL });

      // 4. Independencia: arma en Ascent y votos en Bind sin cambios
      expect(res.body.weapon).toEqual({ total: 1, counts: [{ optionId: VANDAL, count: 1 }] });
      const bind = await results(BIND, me.cookie).expect(200);
      expect(bind.body).toEqual({
        mapId: BIND,
        agent: { total: 1, counts: [{ optionId: SOVA, count: 1 }] },
        weapon: { total: 0, counts: [] },
        myVotes: { agent: SOVA, weapon: null },
      });
      expect(await app.get(PrismaService).vote.count()).toBe(3);
    });

    it('2. Concurrencia: 10 PUT idénticos a la vez → 1 fila, ningún 500', async () => {
      const me = await signUp(app);
      const all = await Promise.all(Array.from({ length: 10 }, () => vote(me.cookie, ASCENT, 'agent', SAGE)));
      expect(all.map((r) => r.status)).toEqual(Array(10).fill(200));
      expect(await app.get(PrismaService).vote.count({ where: { userId: me.id } })).toBe(1);
      const res = await results(ASCENT).expect(200);
      expect(res.body.agent).toEqual({ total: 1, counts: [{ optionId: SAGE, count: 1 }] });
    });

    it('Concurrencia con opciones distintas: Sage, Omen y Sova a la vez → 1 fila, gana una sola', async () => {
      const me = await signUp(app);
      const all = await Promise.all(
        [SAGE, OMEN, SOVA, SAGE, OMEN, SOVA].map((id) => vote(me.cookie, ASCENT, 'agent', id)),
      );
      expect(all.map((r) => r.status)).toEqual(Array(6).fill(200));
      expect(await app.get(PrismaService).vote.count({ where: { userId: me.id } })).toBe(1);
      const res = await results(ASCENT, me.cookie).expect(200);
      expect(res.body.agent.total).toBe(1);
      expect(res.body.agent.counts).toEqual([{ optionId: res.body.myVotes.agent, count: 1 }]);
    });
  });

  it('PUT de voto con cuerpo que no es JSON → 415, sin escribir', async () => {
    const me = await signUp(app);
    await http
      .put(`/api/maps/${ASCENT}/votes/agent`)
      .set('Cookie', me.cookie)
      .type('form')
      .send({ optionId: SAGE })
      .expect(415);
    expect(await app.get(PrismaService).vote.count()).toBe(0);
  });

  it('5. Agregación por mapa: tres usuarios, dos mapas; myVotes por usuario y null sin sesión', async () => {
    const [u1, u2, u3] = [await signUp(app), await signUp(app), await signUp(app)];
    await vote(u1.cookie, ASCENT, 'agent', SAGE).expect(200);
    await vote(u2.cookie, ASCENT, 'agent', SAGE).expect(200);
    await vote(u3.cookie, ASCENT, 'agent', OMEN).expect(200);
    await vote(u1.cookie, ASCENT, 'weapon', ODIN).expect(200);
    await vote(u3.cookie, BIND, 'agent', SOVA).expect(200);
    await vote(u2.cookie, BIND, 'weapon', VANDAL).expect(200);
    await vote(u3.cookie, BIND, 'weapon', VANDAL).expect(200);

    const ascent = await results(ASCENT).expect(200);
    expect(ascent.body).toEqual({
      mapId: ASCENT,
      agent: { total: 3, counts: [{ optionId: SAGE, count: 2 }, { optionId: OMEN, count: 1 }] },
      weapon: { total: 1, counts: [{ optionId: ODIN, count: 1 }] },
      myVotes: null,
    });
    const bind = await results(BIND).expect(200);
    expect(bind.body.agent).toEqual({ total: 1, counts: [{ optionId: SOVA, count: 1 }] });
    expect(bind.body.weapon).toEqual({ total: 2, counts: [{ optionId: VANDAL, count: 2 }] });

    expect((await results(ASCENT, u1.cookie)).body.myVotes).toEqual({ agent: SAGE, weapon: ODIN });
    expect((await results(ASCENT, u2.cookie)).body.myVotes).toEqual({ agent: SAGE, weapon: null });
    expect((await results(BIND, u3.cookie)).body.myVotes).toEqual({ agent: SOVA, weapon: VANDAL });
    expect((await results(BIND, 'vc_session=falso')).body.myVotes).toBeNull();
  });

  it('empates en el recuento se ordenan por optionId', async () => {
    const [u1, u2] = [await signUp(app), await signUp(app)];
    await vote(u1.cookie, ASCENT, 'agent', SOVA).expect(200); // 320b… < 569f…
    await vote(u2.cookie, ASCENT, 'agent', SAGE).expect(200);
    const res = await results(ASCENT).expect(200);
    expect(res.body.agent.counts.map((c: { optionId: string }) => c.optionId)).toEqual([SOVA, SAGE]);
  });

  it('6. Identificadores inválidos', async () => {
    const me = await signUp(app);
    const missingMap = '00000000-0000-0000-0000-000000000000';
    expect((await vote(me.cookie, missingMap, 'agent', SAGE).expect(404)).body).toEqual({
      statusCode: 404,
      message: 'Mapa no encontrado',
    });
    await vote(me.cookie, THE_RANGE, 'agent', SAGE).expect(404);
    await results(missingMap).expect(404);
    await results(THE_RANGE).expect(404);

    const wrongCat = await vote(me.cookie, ASCENT, 'agent', VANDAL).expect(422);
    expect(wrongCat.body).toEqual({ statusCode: 422, message: expect.any(String), fields: { optionId: expect.any(String) } });
    await vote(me.cookie, ASCENT, 'weapon', SAGE).expect(422);
    await vote(me.cookie, ASCENT, 'weapon', MELEE).expect(422); // cuerpo a cuerpo no es votable

    const notUuid = await vote(me.cookie, ASCENT, 'agent', 'sage').expect(400);
    expect(notUuid.body).toEqual({ statusCode: 400, message: 'Datos no válidos', fields: { optionId: 'Opción no válida' } });
    await http.put(`/api/maps/${ASCENT}/votes/agent`).set('Cookie', me.cookie).send({}).expect(400);
    const badCat = await vote(me.cookie, ASCENT, 'map', SAGE).expect(400);
    expect(badCat.body.fields).toEqual({ category: 'La categoría debe ser agent o weapon' });

    expect(await app.get(PrismaService).vote.count()).toBe(0);
  });

  it('7. Sin sesión: PUT → 401; GET results → 200', async () => {
    const res = await vote('', ASCENT, 'agent', SAGE).expect(401);
    expect(res.body).toEqual({ statusCode: 401, message: 'Debes iniciar sesión' });
    await vote('vc_session=falso', ASCENT, 'agent', SAGE).expect(401);
    const ok = await results(ASCENT).expect(200);
    expect(ok.body).toEqual({
      mapId: ASCENT,
      agent: { total: 0, counts: [] },
      weapon: { total: 0, counts: [] },
      myVotes: null,
    });
  });

  it('las escrituras SQL crudas acaban en la base de pruebas, no en la de la aplicación', async () => {
    const me = await signUp(app);
    await vote(me.cookie, ASCENT, 'agent', SAGE).expect(200);
    const prisma = app.get(PrismaService);
    const [{ db }] = await prisma.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`;
    expect(db).toMatch(/_test$/);
    expect(await prisma.vote.count({ where: { userId: me.id } })).toBe(1);

    const appDb = new PrismaClient({ datasourceUrl: process.env.APP_DATABASE_URL });
    try {
      const [{ db: appName }] = await appDb.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`;
      expect(appName).not.toBe(db);
      expect(await appDb.vote.count({ where: { userId: me.id } })).toBe(0);
      expect(await appDb.user.count({ where: { id: me.id } })).toBe(0);
    } finally {
      await appDb.$disconnect();
    }
  });
});

describe('8. Fallo de Valorant API', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;

  afterEach(async () => {
    await app.close();
    jest.restoreAllMocks();
  });

  it('catálogo nunca cargado → GET /catalog 503 y PUT 503; resultados siguen respondiendo', async () => {
    mockValorantApi('fail');
    app = await createApp();
    http = request(app.getHttpServer());
    await resetDb(app);
    const me = await signUp(app);

    const res = await http.get('/api/catalog').expect(503);
    expect(res.body).toEqual({ statusCode: 503, message: expect.stringMatching(/VALORANT/) });
    await http.put(`/api/maps/${ASCENT}/votes/agent`).set('Cookie', me.cookie).send({ optionId: SAGE }).expect(503);
    await http.get(`/api/maps/${ASCENT}/results`).expect(200);
  });

  it('con caché previa y fallo de la actualización → sigue sirviendo la caché (200)', async () => {
    const spy = mockValorantApi('ok');
    app = await createApp();
    http = request(app.getHttpServer());
    await resetDb(app);
    await http.get('/api/catalog').expect(200);

    // La API externa cae y la caché caduca (TTL de 1 h).
    spy.mockRejectedValue(new Error('red caída (simulada)'));
    const realNow = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(realNow + 2 * 60 * 60 * 1000);

    const callsBefore = spy.mock.calls.length;
    const res = await http.get('/api/catalog').expect(200);
    expect(res.body.maps).toHaveLength(2);
    await new Promise((r) => setTimeout(r, 50)); // deja terminar la renovación fallida en segundo plano
    expect(spy.mock.calls.length).toBeGreaterThan(callsBefore); // sí intentó renovar
    await http.get('/api/catalog').expect(200);
    const me = await signUp(app);
    await http.put(`/api/maps/${ASCENT}/votes/agent`).set('Cookie', me.cookie).send({ optionId: SAGE }).expect(200);
  });

  it('una respuesta con otro formato no sustituye la caché por un catálogo vacío', async () => {
    const spy = mockValorantApi('ok');
    app = await createApp();
    http = request(app.getHttpServer());
    await resetDb(app);
    await http.get('/api/catalog').expect(200);

    // La API externa responde 200 pero sin mapas competitivos (p. ej. un campo renombrado).
    spy.mockImplementation(async () => new Response(JSON.stringify({ status: 200, data: [] })));
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 2 * 60 * 60 * 1000);
    await http.get('/api/catalog').expect(200);
    await new Promise((r) => setTimeout(r, 50)); // deja terminar la renovación en segundo plano

    const res = await http.get('/api/catalog').expect(200);
    expect(res.body.maps).toHaveLength(2);
  });
});
