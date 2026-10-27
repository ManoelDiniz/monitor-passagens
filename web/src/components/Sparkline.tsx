import type { HistoryPoint } from '../types';

const W = 88;
const H = 22;

/** A curva do preço reduzida ao tamanho de uma célula de tabela. */
export default function Sparkline({
  history,
  tone = 'ink',
}: {
  history: HistoryPoint[];
  tone?: 'ink' | 'mint' | 'rose';
}) {
  if (history.length < 2) {
    return <span className="font-mono text-[10.5px] text-faint">sem série</span>;
  }

  const prices = history.map((p) => p.price);
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  const span = hi - lo || 1;

  const x = (i: number) => (i / (prices.length - 1)) * W;
  const y = (p: number) => H - 2 - ((p - lo) / span) * (H - 4);

  const points = prices.map((p, i) => `${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(' ');
  const stroke = `var(--color-${tone})`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-[22px] w-[88px]" aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth={1.4}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={x(prices.length - 1)} cy={y(prices[prices.length - 1])} r={1.8} fill={stroke} />
    </svg>
  );
}
