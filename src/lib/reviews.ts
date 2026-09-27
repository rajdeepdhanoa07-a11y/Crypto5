import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@/db';

export type Review = { scanId: number; date: string; coinId: string; symbol: string; name: string; image: string | null; rank: number; score: number; risk: string; reason: string | null; priceAt: number | null; mcapAt: number | null;
  r7: number | null; r30: number | null; r90: number | null; btc7: number | null; btc30: number | null; btc90: number | null; now: number | null };

/** Price after N days is the first snapshot 0–3 days after scan date + N. Missing = period not reached yet or coin not in later scans. */
export async function pickReviews(limit = 300): Promise<Review[]> {
  const res = await db.execute<Record<string, unknown>>(sql`
    with picks as (
      select s.id scan_id, s.scan_date, c.coin_id, c.symbol, c.name, c.image, c.rank, c.score, c.risk_level, c.reason, c.price_usd, c.market_cap
      from scan_coins c join scans s on s.id = c.scan_id where c.selected order by s.scan_date desc, c.rank limit ${limit}
    )
    select p.*,
      (select price_usd from price_snapshots x where x.coin_id=p.coin_id and x.snap_date between p.scan_date + 7 and p.scan_date + 10 order by snap_date limit 1) p7,
      (select price_usd from price_snapshots x where x.coin_id=p.coin_id and x.snap_date between p.scan_date + 30 and p.scan_date + 33 order by snap_date limit 1) p30,
      (select price_usd from price_snapshots x where x.coin_id=p.coin_id and x.snap_date between p.scan_date + 90 and p.scan_date + 93 order by snap_date limit 1) p90,
      (select price_usd from price_snapshots x where x.coin_id='bitcoin' and x.snap_date = p.scan_date limit 1) b0,
      (select price_usd from price_snapshots x where x.coin_id='bitcoin' and x.snap_date between p.scan_date + 7 and p.scan_date + 10 order by snap_date limit 1) b7,
      (select price_usd from price_snapshots x where x.coin_id='bitcoin' and x.snap_date between p.scan_date + 30 and p.scan_date + 33 order by snap_date limit 1) b30,
      (select price_usd from price_snapshots x where x.coin_id='bitcoin' and x.snap_date between p.scan_date + 90 and p.scan_date + 93 order by snap_date limit 1) b90,
      (select price_usd from universe u where u.coin_id=p.coin_id) now
    from picks p order by p.scan_date desc, p.rank`);
  const ch = (a: unknown, b: unknown) => (typeof a === 'number' && typeof b === 'number' && a > 0 ? ((b - a) / a) * 100 : null);
  return res.rows.map((r) => ({
    scanId: r.scan_id as number, date: String(r.scan_date).slice(0, 10), coinId: r.coin_id as string, symbol: r.symbol as string, name: r.name as string, image: r.image as string | null,
    rank: r.rank as number, score: r.score as number, risk: r.risk_level as string, reason: r.reason as string | null, priceAt: r.price_usd as number | null, mcapAt: r.market_cap as number | null,
    r7: ch(r.price_usd, r.p7), r30: ch(r.price_usd, r.p30), r90: ch(r.price_usd, r.p90), btc7: ch(r.b0, r.b7), btc30: ch(r.b0, r.b30), btc90: ch(r.b0, r.b90), now: r.now as number | null,
  }));
}
