import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

// DATABASE_URL, or POSTGRES_URL which Vercel's Neon integration sets automatically.
const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
const g = globalThis as unknown as { pool?: Pool };
export const pool = g.pool ?? new Pool({ connectionString, max: process.env.VERCEL ? 3 : 10 });
g.pool = pool;
export const db = drizzle(pool, { schema });
export { schema };
