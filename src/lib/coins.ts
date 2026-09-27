import 'server-only';
import { desc, isNull } from 'drizzle-orm';
import { db, schema } from '@/db';

export async function coinOptions(limit = 2000) {
  const rows = await db.select({ id: schema.universe.coinId, name: schema.universe.name, symbol: schema.universe.symbol }).from(schema.universe).where(isNull(schema.universe.excludedType)).orderBy(desc(schema.universe.marketCap)).limit(limit);
  return rows.map((r) => ({ id: r.id, label: `${r.name} (${r.symbol.toUpperCase()})` }));
}
