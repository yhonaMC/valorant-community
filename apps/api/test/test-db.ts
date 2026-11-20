// Las pruebas usan una base separada (mismo servidor, nombre con sufijo _test)
// para no tocar nunca los datos de la aplicación.
// Se llama antes de crear ningún PrismaClient: guarda la URL de la aplicación
// en APP_DATABASE_URL y apunta DATABASE_URL a la base de pruebas.
export function useTestDatabase() {
  process.env.APP_DATABASE_URL ??= process.env.DATABASE_URL;
  if (!process.env.APP_DATABASE_URL) throw new Error('Falta DATABASE_URL (¿existe el .env de la raíz?)');
  const url = new URL(process.env.APP_DATABASE_URL);
  url.pathname = `${url.pathname.slice(1)}_test`;
  process.env.DATABASE_URL = url.toString();
  return { appUrl: process.env.APP_DATABASE_URL, testUrl: url.toString(), testDb: url.pathname.slice(1) };
}
