// Runs a full scan from the command line (use in a server cron: 0 1 * * * npm run scan)
import { startScan, runScan } from '../src/lib/scan';
import { db, schema } from '../src/db';
import { eq } from 'drizzle-orm';
(async () => {
  const id = await startScan('AUTO');
  const t = Date.now();
  await runScan(id);
  const s = await db.query.scans.findFirst({ where: eq(schema.scans.id, id) });
  console.log(JSON.stringify({ id, status: s?.status, progress: s?.progress, universe: s?.universeCount, eligible: s?.eligibleCount, analyzed: s?.analyzedCount, errors: s?.errors?.length, seconds: Math.round((Date.now() - t) / 1000) }));
  process.exit(s?.status === 'DONE' ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
