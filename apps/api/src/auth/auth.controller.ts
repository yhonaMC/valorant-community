import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';
import type { CookieOptions, Response } from 'express';
import { AuthService, AuthedRequest, SESSION_COOKIE, SESSION_MAX_AGE_MS, SessionGuard } from './auth.service';

const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

class RegisterDto {
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'Introduce un email válido' })
  email!: string;

  @IsString({ message: 'La contraseña debe tener entre 8 y 72 caracteres' })
  @Length(8, 72, { message: 'La contraseña debe tener entre 8 y 72 caracteres' })
  password!: string;
}

class LoginDto {
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'Introduce un email válido' })
  email!: string;

  @IsString({ message: 'Introduce tu contraseña' })
  @IsNotEmpty({ message: 'Introduce tu contraseña' })
  password!: string;
}

function cookieOptions(): CookieOptions {
  return { httpOnly: true, sameSite: 'lax', path: '/', secure: process.env.COOKIE_SECURE === 'true' };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  async register(@Body() body: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const user = await this.auth.register(body.email, body.password);
    this.setSession(res, user.id);
    return user;
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: LoginDto, @Res({ passthrough: true }) res: Response) {
    const user = await this.auth.login(body.email, body.password);
    this.setSession(res, user.id);
    return user;
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(SESSION_COOKIE, cookieOptions());
  }

  @Get('me')
  @UseGuards(SessionGuard)
  me(@Req() req: AuthedRequest) {
    return req.user;
  }

  private setSession(res: Response, userId: string) {
    res.cookie(SESSION_COOKIE, this.auth.signSession(userId), { ...cookieOptions(), maxAge: SESSION_MAX_AGE_MS });
  }
}
