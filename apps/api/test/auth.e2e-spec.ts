import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma.service';
import { createApp, mockValorantApi, resetDb, signUp } from './helpers';

describe('Auth y protección de escrituras (H2)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  const register = (body: object) => http.post('/api/auth/register').send(body);

  beforeAll(async () => {
    mockValorantApi();
    app = await createApp();
    http = request(app.getHttpServer());
  });
  beforeEach(() => resetDb(app));
  afterAll(async () => {
    await app.close();
    jest.restoreAllMocks();
  });

  it('registro válido → 201 { id, email } normalizado + cookie HttpOnly; SameSite=Lax', async () => {
    const res = await register({ email: '  Ana@Example.COM ', password: '12345678' }).expect(201);
    expect(Object.keys(res.body).sort()).toEqual(['email', 'id']);
    expect(res.body.email).toBe('ana@example.com');
    const cookie = [res.headers['set-cookie']].flat()[0];
    expect(cookie).toMatch(/^vc_session=[^;]+/);
    expect(cookie).toMatch(/; HttpOnly/);
    expect(cookie).toMatch(/; SameSite=Lax/);
    expect(cookie).toMatch(/; Path=\//);
    expect(cookie).toMatch(/; Max-Age=604800/);
    expect(cookie).not.toMatch(/Secure/); // COOKIE_SECURE=false en local
  });

  it('guarda la contraseña como scrypt "salt:hash" en hex, nunca en claro', async () => {
    await register({ email: 'a@b.co', password: 'mi-clave-123' }).expect(201);
    const user = await app.get(PrismaService).user.findUniqueOrThrow({ where: { email: 'a@b.co' } });
    expect(user.passwordHash).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
    expect(user.passwordHash).not.toContain('mi-clave-123');
  });

  it('email duplicado (aunque cambien mayúsculas) → 409 con fields.email', async () => {
    await register({ email: 'dup@test.dev', password: '12345678' }).expect(201);
    const res = await register({ email: 'DUP@test.dev', password: '87654321' }).expect(409);
    expect(res.body).toEqual({ statusCode: 409, message: expect.any(String), fields: { email: expect.any(String) } });
  });

  it('email mal formado o contraseña corta/larga → 400 con fields', async () => {
    let res = await register({ email: 'no-es-email', password: '1234' }).expect(400);
    expect(res.body).toEqual({
      statusCode: 400,
      message: 'Datos no válidos',
      fields: { email: 'Introduce un email válido', password: 'La contraseña debe tener entre 8 y 72 caracteres' },
    });
    res = await register({ email: 'ok@test.dev', password: 'x'.repeat(73) }).expect(400);
    expect(res.body.fields).toEqual({ password: expect.any(String) });
    await register({ email: 'ok@test.dev', password: 'x'.repeat(72) }).expect(201);
    res = await register({ email: 'otro@test.dev', password: '12345678', admin: true }).expect(400);
    expect(res.body.fields).toEqual({ admin: 'Campo no permitido' });
  });

  it('login correcto → 200 + cookie; incorrecto → 401 con mensaje genérico', async () => {
    await register({ email: 'log@test.dev', password: '12345678' }).expect(201);
    const ok = await http.post('/api/auth/login').send({ email: 'LOG@test.dev', password: '12345678' }).expect(200);
    expect(ok.body).toEqual({ id: expect.any(String), email: 'log@test.dev' });
    expect([ok.headers['set-cookie']].flat()[0]).toMatch(/^vc_session=.+HttpOnly/);

    const wrong = await http.post('/api/auth/login').send({ email: 'log@test.dev', password: 'otra-clave' }).expect(401);
    const unknown = await http.post('/api/auth/login').send({ email: 'nadie@test.dev', password: '12345678' }).expect(401);
    expect(wrong.body).toEqual({ statusCode: 401, message: 'Email o contraseña incorrectos' });
    expect(unknown.body).toEqual(wrong.body);
    expect(wrong.headers['set-cookie']).toBeUndefined();
  });

  it('me: con cookie → 200; sin cookie, token falso o usuario borrado → 401', async () => {
    const { id, cookie } = await signUp(app);
    const me = await http.get('/api/auth/me').set('Cookie', cookie).expect(200);
    expect(me.body).toEqual({ id, email: expect.stringMatching(/@test\.dev$/) });

    const res = await http.get('/api/auth/me').expect(401);
    expect(res.body).toEqual({ statusCode: 401, message: expect.any(String) });
    await http.get('/api/auth/me').set('Cookie', 'vc_session=falso').expect(401);

    await app.get(PrismaService).user.delete({ where: { id } });
    await http.get('/api/auth/me').set('Cookie', cookie).expect(401);
  });

  it('logout → 204 y borra la cookie', async () => {
    const { cookie } = await signUp(app);
    const res = await http.post('/api/auth/logout').set('Cookie', cookie).expect(204);
    const cleared = [res.headers['set-cookie']].flat()[0];
    expect(cleared).toMatch(/^vc_session=;/);
    expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970/);
  });

  it('escritura con Origin ajeno → 403; Origin permitido o sin Origin → pasa', async () => {
    const body = { email: 'o@test.dev', password: '12345678' };
    const res = await http.post('/api/auth/register').set('Origin', 'http://evil.test').send(body).expect(403);
    expect(res.body).toEqual({ statusCode: 403, message: 'Origen no permitido' });
    const { cookie } = await signUp(app);
    await http.put(`/api/maps/x/votes/agent`).set('Cookie', cookie).set('Origin', 'http://evil.test').send({}).expect(403);
    await http.post('/api/auth/register').set('Origin', 'http://localhost:5173').send(body).expect(201);
  });

  it('escritura con cuerpo que no es JSON → 415', async () => {
    await http.post('/api/auth/login').set('Content-Type', 'text/plain').send('email=a&password=b').expect(415);
    const res = await http.post('/api/auth/login').type('form').send({ email: 'a@b.co', password: '12345678' }).expect(415);
    expect(res.body).toEqual({ statusCode: 415, message: expect.any(String) });
  });

  it('errores sin trazas y en español: JSON mal formado → 400, ruta desconocida → 404; sin x-powered-by', async () => {
    const bad = await http.post('/api/auth/login').set('Content-Type', 'application/json').send('{"email":').expect(400);
    expect(bad.body).toEqual({ statusCode: 400, message: 'Solicitud no válida' });
    const missing = await http.get('/api/no-existe').expect(404);
    expect(missing.body).toEqual({ statusCode: 404, message: 'Recurso no encontrado' });
    expect(missing.headers['x-powered-by']).toBeUndefined();
  });
});

describe('Arranque', () => {
  it('se niega a arrancar sin APP_ORIGIN', async () => {
    const origin = process.env.APP_ORIGIN;
    delete process.env.APP_ORIGIN;
    try {
      await expect(createApp()).rejects.toThrow('APP_ORIGIN');
    } finally {
      process.env.APP_ORIGIN = origin;
    }
  });

  it('se niega a arrancar sin JWT_SECRET', async () => {
    const secret = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    try {
      await expect(createApp()).rejects.toThrow('JWT_SECRET');
    } finally {
      process.env.JWT_SECRET = secret;
    }
  });
});
