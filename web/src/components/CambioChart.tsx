import { diaCurto } from '../lib/format';
import type { PontoCambio } from '../types';

const W = 1000;
const H = 200;

const formatar = (v: number, casas: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });

/**
 * A série da moeda com a faixa da janela longa por cima. A base tingida de
 * verde é a zona de compra; o topo âmbar, a zona de venda — como no gráfico das
 * passagens, ele mostra a decisão, não só o histórico.
 */
export default function CambioChart({
  serie,
  janelaLonga,
  zonaCompra,
  zonaVenda,
  casas = 4,
  rotuloJanela = 'p',
}: {
  serie: PontoCambio[];
  janelaLonga: number;
  zonaCompra: number;
  zonaVenda: number;
  /** Casas decimais: 4 para câmbio, menos para um BTC de seis dígitos. */
  casas?: number;
  /** Sufixo da janela no rótulo: "p" (pregões) ou "d" (dias corridos). */
  rotuloJanela?: string;
}) {
  const taxa = (v: number) => formatar(v, casas);
  if (serie.length < 2) {
    return (
      <div
        className="flex items-center justify-center rounded-sm border border-dashed border-rule
                   font-mono text-[11.5px] tracking-[.1em] text-faint uppercase"
        style={{ height: H }}
      >
        baixando o histórico
      </div>
    );
  }

  const valores = serie.map((p) => p.valor);
  const janela = valores.slice(-janelaLonga);
  const min = Math.min(...janela);
  const max = Math.max(...janela);

  let lo = Math.min(...valores);
  let hi = Math.max(...valores);
  const folga = (hi - lo) * 0.12 || lo * 0.02;
  lo -= folga;
  hi += folga;

  const x = (i: number) => (i / (valores.length - 1)) * W;
  const y = (v: number) => H - ((v - lo) / (hi - lo)) * H;

  const inicioJanela = x(Math.max(0, valores.length - janela.length));
  const tetoCompra = min + (max - min) * zonaCompra;
  const pisoVenda = min + (max - min) * zonaVenda;
  const atual = valores[valores.length - 1];

  const linha = valores.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const pctY = (v: number) => `${(y(v) / H) * 100}%`;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block h-[200px] w-full">
        <rect
          x={inicioJanela}
          y={y(tetoCompra)}
          width={W - inicioJanela}
          height={y(min) - y(tetoCompra)}
          fill="var(--color-mint)"
          opacity={0.1}
        />
        <rect
          x={inicioJanela}
          y={y(max)}
          width={W - inicioJanela}
          height={y(pisoVenda) - y(max)}
          fill="var(--color-amber)"
          opacity={0.1}
        />
        {[min, max].map((v) => (
          <line
            key={v}
            x1={inicioJanela}
            x2={W}
            y1={y(v)}
            y2={y(v)}
            stroke="var(--color-rule-2)"
            strokeDasharray="4 5"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <polyline
          points={linha}
          fill="none"
          stroke="var(--color-ink)"
          strokeWidth={1.6}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <span
        className="absolute right-0 h-2 w-2 translate-x-1/2 -translate-y-1/2 rounded-full bg-mint"
        style={{ top: pctY(atual) }}
      />
      <span
        className="tabular absolute -translate-y-full pb-0.5 font-mono text-[10.5px] text-faint"
        style={{ top: pctY(max), left: `${(inicioJanela / W) * 100}%` }}
      >
        máx {janela.length}{rotuloJanela} {taxa(max)}
      </span>
      <span
        className="tabular absolute pt-0.5 font-mono text-[10.5px] text-faint"
        style={{ top: pctY(min), left: `${(inicioJanela / W) * 100}%` }}
      >
        mín {janela.length}{rotuloJanela} {taxa(min)}
      </span>

      <div className="mt-2 flex justify-between font-mono text-[10.5px] text-faint">
        <span>{diaCurto(serie[0].dia)}</span>
        <span className="text-mint">agora {taxa(atual)}</span>
        <span>{diaCurto(serie[serie.length - 1].dia)}</span>
      </div>
    </div>
  );
}
