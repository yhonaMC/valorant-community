import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService, SessionGuard } from './auth.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => {
        // Sin secreto no hay sesiones seguras: la API se niega a arrancar.
        const secret = process.env.JWT_SECRET;
        if (!secret) throw new Error('Falta la variable de entorno JWT_SECRET');
        return { secret, signOptions: { expiresIn: '7d' } };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, SessionGuard],
  exports: [AuthService, SessionGuard],
})
export class AuthModule {}
