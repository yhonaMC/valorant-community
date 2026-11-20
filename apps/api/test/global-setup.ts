import { PrismaClient } from '@prisma/client';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { useTestDatabase } from './test-db';

// Crea la base de pruebas si no existe y le aplica las migraciones.
export default async function globalSetup() {
  const { appUrl, testUrl, testDb } = useTestDatabase();
  const admin = new PrismaClient({ datasourceUrl: appUrl });
  try {
    const rows = await admin.$queryRaw<unknown[]>`SELECT 1 FROM pg_database WHERE datname = ${testDb}`;
    if (rows.length === 0) await admin.$executeRawUnsafe(`CREATE DATABASE "${testDb}"`);
  } finally {
    await admin.$disconnect();
  }
  const apiDir = join(__dirname, '..');
  execFileSync(process.execPath, [join(apiDir, 'node_modules/prisma/build/index.js'), 'migrate', 'deploy'], {
    cwd: apiDir,
    env: { ...process.env, DATABASE_URL: testUrl },
    stdio: 'inherit',
  });
}
