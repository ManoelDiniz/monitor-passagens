import { cidadeDe } from '../lib/airports';
import { brl, diaCurto } from '../lib/format';
import type { Route } from '../types';
import Sparkline from './Sparkline';

/** Como o preço se comporta agora — a mesma leitura que o alerta usa. */
function estado(route: Route): { texto: string; classe: string } {
  if (!route.active) return { texto: 'pausada', classe: 'text-faint' };
  if (route.lastCheck?.status === 'error') return { texto: 'falhou', classe: 'text-rose' };
  if (route.current == null) return { texto: 'aguardando', classe: 'text-faint' };
  if (route.price_limit != null && route.current <= route.price_limit) {
    return { texto: 'no alvo', classe: 'text-mint' };
  }
  if (route.lowest != null && route.current <= route.lowest) {
    return { texto: 'menor já visto', classe: 'text-mint' };
  }
  return { texto: 'acompanhando', classe: 'text-muted' };
}

function Variacao({ route }: { route: Route }) {
  if (route.variationPct == null) return <span className="text-faint">—</span>;

  const pct = route.variationPct;
  if (Math.abs(pct) < 0.5) return <span className="text-muted">estável</span>;

  const caiu = pct < 0;
  return (
    <span className={caiu ? 'text-mint' : 'text-rose'}>
      {caiu ? '▼' : '▲'} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

const TH = 'px-3 py-2 text-left font-normal';

/**
 * O quadro de partidas: uma linha por rota, lida de relance como o painel de
 * um aeroporto. É a tela que responde "e aí, algum preço bom hoje?".
 */
export default function FlightBoard({ routes }: { routes: Route[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[500px] border-collapse font-mono text-[12.5px]">
        <thead>
          <tr className="border-b border-rule text-[10px] tracking-[.13em] text-faint uppercase">
            <th className={TH}>Trecho</th>
            <th className={TH}>Ida</th>
            <th className={`${TH} text-right`}>Preço</th>
            <th className={`${TH} text-right`}>Desde a última</th>
            {/* A curva é o primeiro luxo a cair na tela estreita: o estado importa mais. */}
            <th className={`${TH} hidden lg:table-cell`}>Curva</th>
            <th className={`${TH} text-right`}>Estado</th>
          </tr>
        </thead>
        <tbody>
          {routes.map((route) => {
            const st = estado(route);
            const noAlvo = st.texto === 'no alvo';

            return (
              <tr
                key={route.id}
                className={`border-b border-rule/60 last:border-0 ${route.active ? '' : 'opacity-50'}`}
              >
                <td className="px-3 py-2.5">
                  <span className="display-tight text-[17px] tracking-[.06em] text-ink">
                    {route.origin}
                  </span>
                  <span className="px-1.5 text-faint">→</span>
                  <span className="display-tight text-[17px] tracking-[.06em] text-ink">
                    {route.destination}
                  </span>
                  <span className="block text-[11px] text-faint">
                    {cidadeDe(route.origin)} → {cidadeDe(route.destination)}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-muted">{diaCurto(route.depart_date)}</td>
                <td
                  className={`tabular px-3 py-2.5 text-right ${noAlvo ? 'text-mint' : 'text-ink'}`}
                >
                  {brl(route.current)}
                </td>
                <td className="tabular px-3 py-2.5 text-right">
                  <Variacao route={route} />
                </td>
                <td className="hidden px-3 py-2.5 lg:table-cell">
                  <Sparkline history={route.history} tone={noAlvo ? 'mint' : 'ink'} />
                </td>
                <td
                  className={`px-3 py-2.5 text-right text-[10.5px] tracking-[.11em] uppercase ${st.classe}`}
                >
                  {st.texto}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
