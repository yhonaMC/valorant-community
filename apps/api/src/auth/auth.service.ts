import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { Resolver } from 'node:dns/promises';
import { promisify } from 'node:util';
import type { Request } from 'express';
import { PrismaService } from '../prisma.service';
import { ApiError } from '../setup';

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

export const SESSION_COOKIE = 'vc_session';
export const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type SessionUser = { id: string; email: string };
export type AuthedRequest = Request & { user: SessionUser };

// "salt:hash" en hex, sal aleatoria de 16 bytes.
async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

async function verifyPassword(password: string, stored: string) {
  const [saltHex, hashHex] = stored.split(':');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scryptAsync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return timingSafeEqual(actual, expected);
}

// El dominio del email debe existir. Solo se rechaza con certeza: el dominio no existe (ni MX ni A,
// en todos los intentos) o declara que no recibe correo («MX nulo», RFC 7505). Ante cualquier duda
// (sin red, timeout, respuesta vacía) se acepta: rechazar a un usuario real es peor que aceptar un dominio falso.
// Los reintentos existen porque el DNS interno de Docker falla de forma intermitente en la primera
// consulta de un dominio (medido: ENOTFOUND/ENODATA para gmail.com u outlook.com, y bien 400 ms después).
// ponytail: no comprueba que exista el buzón; eso exige enviar un correo de verificación.
const resolver = new Resolver({ timeout: 3000, tries: 1 });
const DNS_ATTEMPTS = 3;
const DNS_RETRY_MS = 400;
const dnsCode = (e: unknown) => (e as NodeJS.ErrnoException).code;

async function domainAcceptsMail(email: string) {
  const domain = email.slice(email.lastIndexOf('@') + 1);
  for (let attempt = 1; ; attempt++) {
    const [mx, a] = await Promise.allSettled([resolver.resolveMx(domain), resolver.resolve4(domain)]);
    if (mx.status === 'fulfilled' && mx.value.length) {
      return mx.value.some((r) => r.exchange !== '' && r.exchange !== '.');
    }
    const missing = (r: PromiseSettledResult<unknown>) => r.status === 'rejected' && dnsCode(r.reason) === 'ENOTFOUND';
    if (!missing(mx) || !missing(a)) return true;
    if (attempt === DNS_ATTEMPTS) return false;
    await new Promise((r) => setTimeout(r, DNS_RETRY_MS));
  }
}

// Hash de relleno para que un email inexistente tarde lo mismo que uno existente.
const DUMMY_HASH = hashPassword('dummy-password');

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(email: string, password: string): Promise<SessionUser> {
    if (!(await domainAcceptsMail(email))) {
      const msg = 'Ese dominio de correo no existe o no recibe emails';
      throw new ApiError(400, 'Datos no válidos', { email: msg });
    }
    try {
      const user = await this.prisma.user.create({
        data: { email, passwordHash: await hashPassword(password) },
      });
      return { id: user.id, email: user.email };
    } catch (e) {
      // La restricción única decide, sin leer antes (no hay carrera).
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ApiError(409, 'Este email ya está registrado', { email: 'Este email ya está registrado' });
      }
      throw e;
    }
  }

  async login(email: string, password: string): Promise<SessionUser> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    const ok = await verifyPassword(password, user?.passwordHash ?? (await DUMMY_HASH));
    if (!user || !ok) throw new ApiError(401, 'Email o contraseña incorrectos');
    return { id: user.id, email: user.email };
  }

  signSession(userId: string) {
    return this.jwt.sign({ sub: userId });
  }

  // Sesión opcional: el usuario de la cookie, o null si no hay, es inválida o el usuario ya no existe.
  async userFromRequest(req: Request): Promise<SessionUser | null> {
    const token = req.cookies?.[SESSION_COOKIE];
    if (typeof token !== 'string') return null;
    let sub: unknown;
    try {
      sub = this.jwt.verify<{ sub: string }>(token).sub;
    } catch {
      return null;
    }
    if (typeof sub !== 'string') return null;
    return this.prisma.user.findUnique({ where: { id: sub }, select: { id: true, email: true } });
  }
}

// Exige sesión; deja el usuario en req.user.
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const user = await this.auth.userFromRequest(req);
    if (!user) throw new ApiError(401, 'Debes iniciar sesión');
    req.user = user;
    return true;
  }
}
