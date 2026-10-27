import { brl, brlPlain, quando } from '../lib/format';
import type { Route } from '../types';

const W = 1000;
const H = 168;

interface Props {
  route: Route;
  delayMs: number;
}

/**
 * A faixa de preço: histórico, a linha do seu alvo e o menor já visto.
 * A área tingida abaixo do alvo é a faixa em que você quer comprar — o gráfico
 * mostra a decisão, não só o histórico.
 */
export default function PriceTrack({ route, delayMs }: Props) {
  if (!route.history.length) {
    return (
      <div
        className="mx-4 flex items-center justify-center rounded-sm border border-dashed
                   border-rule font-mono text-[11.5px] tracking-[.1em] text-faint uppercase sm:mx-6"
        style={{ height: H }}
      >
        aguardando a primeira leitura
      </div>
    );
  }

  const prices = route.history.map((p) => p.price);
  const limit = route.price_limit;

  /* A escala segue o histórico, não o alvo. Um alvo muito abaixo do preço atual
     esmagaria a curva contra o topo e deixaria o gráfico vazio. */
  let lo = Math.min(...prices);
  let hi = Math.max(...prices);
  if (lo === hi) {
    const folga = lo * 0.04 || 1;
    lo -= folga;
    hi += folga;
  }
  const pad = (hi - lo) * 0.18;
  lo -= pad;
  hi += pad;

  const alcance = hi - lo;
  if (limit != null && limit > lo - alcance * 0.5) {
    lo = Math.min(lo, limit - alcance * 0.1);
  } else if (limit != null) {
    // Reserva a base para a faixa do alvo, senão a curva encosta no rótulo.
    lo -= alcance * 0.22;
  }

  const x = (i: number) => (prices.length === 1 ? W / 2 : (i / (prices.length - 1)) * W);
  const y = (p: number) => H - ((p - lo) / (hi - lo)) * H;
  const pct = (p: number) => (y(p) / H) * 100;

  const current = prices[prices.length - 1];
  const noAlvo = limit != null && current <= limit;
  const stroke = noAlvo ? 'var(--color-mint)' : 'var(--color-ink)';

  const points = prices.map((p, i) => `${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(' ');

  const alvoDentro = limit != null && y(limit) > 2 && y(limit) < H;
  const topoZona = limit == null ? 0 : alvoDentro ? y(limit) : H - 5;

  const mostraPiso =
    route.lowest != null &&
    route.history.length > 2 &&
    route.lowest !== current &&
    (limit == null || Math.abs(y(route.lowest) - y(limit)) > 18);

  return (
    <div className="relative mx-4 sm:mx-6" style={{ height: H }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="block h-full w-full overflow-visible"
        role="img"
        aria-label={`Histórico de preço de ${route.origin} para ${route.destination}`}
      >
        {limit != null && (
          <>
            <rect
              x="0"
              y={topoZona}
              width={W}
              height={H - topoZona}
              fill="var(--color-mint)"
              opacity={alvoDentro ? 0.08 : 0.16}
            />
            <line
              x1="0"
              y1={topoZona}
              x2={W}
              y2={topoZona}
              stroke="var(--color-mint)"
              strokeWidth={1}
              strokeDasharray="5 5"
              opacity={0.75}
              vectorEffect="non-scaling-stroke"
            />
          </>
        )}

        {/* A animação roda na montagem do componente. Como a lista é chaveada
            por id, recarregar o preço não remonta nada e a curva fica quieta. */}
        <polyline
          className="track-line--fresh"
          style={{ animationDelay: `${delayMs}ms` }}
          points={points}
          fill="none"
          stroke={stroke}
          strokeWidth={1.75}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />

        <circle
          cx={x(prices.length - 1)}
          cy={y(current)}
          r={3.5}
          fill={stroke}
          vectorEffect="non-scaling-stroke"
        />

        {prices.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p)} r={9} fill="transparent">
            <title>{`${quando(route.history[i].at)} — ${brl(p)}`}</title>
          </circle>
        ))}
      </svg>

      {limit != null &&
        (alvoDentro ? (
          <Nota top={`${pct(limit).toFixed(1)}%`} tone="mint">
            alvo {brlPlain(limit)}
          </Nota>
        ) : (
          <Nota bottom tone="mint">
            alvo {brlPlain(limit)} · faltam {brlPlain(current - limit)}
          </Nota>
        ))}

      {mostraPiso && (
        <Nota top={`${pct(route.lowest!).toFixed(1)}%`} tone="muted">
          menor {brlPlain(route.lowest)}
        </Nota>
      )}
    </div>
  );
}

function Nota({
  children,
  top,
  bottom,
  tone,
}: {
  children: React.ReactNode;
  top?: string;
  bottom?: boolean;
  tone: 'mint' | 'muted';
}) {
  return (
    <span
      className={`pointer-events-none absolute right-0 bg-panel pl-2 font-mono text-[10px]
                  tracking-[.1em] uppercase ${tone === 'mint' ? 'text-mint' : 'text-muted'}`}
      style={bottom ? { bottom: 3 } : { top, transform: 'translateY(-50%)' }}
    >
      {children}
    </span>
  );
}
