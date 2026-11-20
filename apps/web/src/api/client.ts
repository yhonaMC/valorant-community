import type { ApiError } from './types';

// Error lanzado por api(): lleva la forma ApiError del contrato (§3.5).
export class ApiRequestError extends Error implements ApiError {
  statusCode: number;
  fields?: Record<string, string>;

  constructor({ statusCode, message, fields }: ApiError) {
    super(message);
    this.statusCode = statusCode;
    this.fields = fields;
  }
}

export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers:
        body === undefined
          ? { Accept: 'application/json' }
          : { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiRequestError({ statusCode: 0, message: 'No se pudo conectar con el servidor.' });
  }

  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiRequestError({
      statusCode: res.status,
      message: typeof data?.message === 'string' ? data.message : 'El servidor respondió con un error.',
      fields: data?.fields,
    });
  }
  return data as T;
}
