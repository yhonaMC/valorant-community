import {
  ArgumentsHost,
  CanActivate,
  Catch,
  ExceptionFilter,
  ExecutionContext,
  HttpException,
  INestApplication,
  Logger,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import type { Request, Response } from 'express';

// Error con mensaje propio (en español) y, opcionalmente, errores por campo.
// El filtro global solo respeta el mensaje de estos; para el resto usa un texto genérico.
export class ApiError extends HttpException {
  constructor(status: number, message: string, readonly fields?: Record<string, string>) {
    super(message, status);
  }
}

const DEFAULT_MESSAGES: Record<number, string> = {
  400: 'Solicitud no válida',
  401: 'Debes iniciar sesión',
  403: 'Acceso denegado',
  404: 'Recurso no encontrado',
  413: 'La petición es demasiado grande',
  415: 'El contenido debe ser application/json',
  422: 'Datos no procesables',
  503: 'Servicio no disponible',
};

// Todo error sale como { statusCode, message, fields? }, sin trazas.
@Catch()
class ErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger('Error');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    // Errores de body-parser (JSON mal formado, cuerpo enorme) traen `status`.
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : Number((exception as { status?: number })?.status) || 500;
    if (status >= 500 && !(exception instanceof HttpException)) this.logger.error(exception);
    const body: { statusCode: number; message: string; fields?: Record<string, string> } = {
      statusCode: status,
      message:
        exception instanceof ApiError
          ? exception.message
          : (DEFAULT_MESSAGES[status] ?? (status >= 500 ? 'Error interno del servidor' : 'Error')),
    };
    if (exception instanceof ApiError && exception.fields) body.fields = exception.fields;
    res.status(status).json(body);
  }
}

// Protección de escrituras (§3.4): Origin permitido y solo JSON.
class WriteGuard implements CanActivate {
  private readonly origins = (process.env.APP_ORIGIN ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return true;
    const origin = req.headers.origin;
    if (origin && !this.origins.includes(origin)) {
      throw new ApiError(403, 'Origen no permitido');
    }
    const hasBody = Number(req.headers['content-length'] ?? 0) > 0 || !!req.headers['transfer-encoding'];
    if (hasBody && !req.is('application/json')) {
      throw new ApiError(415, 'El contenido debe ser application/json');
    }
    return true;
  }
}

function validationError(errors: ValidationError[]) {
  const fields: Record<string, string> = {};
  for (const e of errors) {
    const constraints = e.constraints ?? {};
    fields[e.property] = constraints.whitelistValidation
      ? 'Campo no permitido'
      : (Object.values(constraints)[0] ?? 'Valor no válido');
  }
  return new ApiError(400, 'Datos no válidos', fields);
}

// Configuración compartida por main.ts y las pruebas e2e,
// para que las pruebas ejerciten exactamente la misma aplicación.
export function setupApp(app: INestApplication) {
  // Sin orígenes permitidos, toda escritura daría 403 sin pista de por qué: mejor no arrancar.
  if (!process.env.APP_ORIGIN?.trim()) throw new Error('Falta la variable de entorno APP_ORIGIN');
  (app as NestExpressApplication).disable('x-powered-by');
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.useGlobalFilters(new ErrorFilter());
  app.useGlobalGuards(new WriteGuard());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: validationError,
    }),
  );
  app.enableShutdownHooks();
}
