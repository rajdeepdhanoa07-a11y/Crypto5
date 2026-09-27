import { money, price } from '@/lib/format';
import type { Fx } from '@/lib/format';
import type { CoinRow } from '@/lib/data';
import { Change, CoinName, Risk } from './ui';

function comp(r: CoinRow, key: string) { const c = r.a.score.components.find((x) => x.key === key); return c ? `${c.points}/${c.max}` : 'N/A'; }
function unlockRisk(r: CoinRow) {
  const it = r.a.score.components.find((c) => c.key === 'tokenomics')?.items.find((i) => i.label.startsWith('Upcoming unlocks'));
  if (!it || it.na) {
    const ratio = r.a.metrics.fdvRatio.value as number | null;
    return ratio === null ? 'N/A' : ratio > 3 ? 'High overhang' : ratio > 1.5 ? 'Some overhang' : 'Low overhang';
  }
  return it.points >= 3 ? 'Low' : it.points >= 1.5 ? 'Medium' : 'High';
}

export function CompareTable({ rows, fx }: { rows: CoinRow[]; fx: Fx }) {
  return (
    <div className="overflow-x-auto">
      <table className="tbl">
        <thead><tr><th>Coin</th><th className="text-right">Price</th><th className="text-right">Market cap</th><th className="text-right">FDV</th><th className="text-right">Volume</th><th className="text-right">7D</th><th className="text-right">30D</th><th className="text-right">Score</th><th>Risk</th><th className="text-right">Liquidity</th><th>Unlock risk</th><th className="text-right">Dev activity</th><th className="text-right">On-chain</th><th>Catalyst</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td><CoinName id={r.coinId} name={r.name} symbol={r.symbol} image={r.image} /></td>
              <td className="num text-right">{price(r.priceUsd, fx)}</td>
              <td className="num text-right">{money(r.marketCap, fx)}</td>
              <td className="num text-right">{money(r.fdv, fx)}</td>
              <td className="num text-right">{money(r.volume24h, fx)}</td>
              <td className="text-right"><Change v={r.change7d} /></td>
              <td className="text-right"><Change v={r.change30d} /></td>
              <td className="num text-right font-bold text-amber">{r.score}</td>
              <td><Risk level={r.riskLevel} /></td>
              <td className="num text-right">{comp(r, 'liquidity')}</td>
              <td className="text-xs text-txt-soft">{unlockRisk(r)}</td>
              <td className="num text-right">{comp(r, 'development')}</td>
              <td className="num text-right">{comp(r, 'onchain')}</td>
              <td className="max-w-56 truncate text-xs text-txt-soft">{r.a.narrative.keyCatalyst ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-3 py-2 text-[11px] text-txt-mute">Ordered by research score, not by any predicted return.</p>
    </div>
  );
}
