import { pool } from './index';
import { SETUP_SQL } from './setup-sql';

/** Creates the tables automatically the first time the app starts on an empty database. */
export async function ensureSchema() {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!url) { console.warn('[crypto5] DATABASE_URL is not set'); return; }
  try {
    const r = await pool.query("select to_regclass('public.scans') as t");
    if (r.rows[0]?.t) return;
    console.log('[crypto5] Empty database: creating tables…');
    await pool.query(SETUP_SQL);
    console.log('[crypto5] Tables created.');
  } catch (e) {
    console.error('[crypto5] Could not prepare the database:', e);
  }
}
