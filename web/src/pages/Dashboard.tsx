import AlertRow from '../components/AlertRow';
import FlightBoard from '../components/FlightBoard';
import { Button, Card, EmptyState, Skeleton, StatTile } from '../components/ui';
import { brl, desde } from '../lib/format';
import { navigate } from '../lib/router';
import { useMonitor } from '../lib/store';
import type { AlertEntry, Route } from '../types';

const SETE_DIAS_MS = 7 * 24 * 3_600_000;

function menorPrecoAtivo(routes: Route[]): { valor: number; rota: Route } | null {
  const comPreco = routes.filter((r) => r.active && r.current != null);
  if (comPreco.length === 0) return null;

  const melhor = comPreco.reduce((a, b) => (b.current! < a.current! ? b : a));
  return { valor: melhor.current!, rota: melhor };
}

function Indicadores({
  routes,
  alerts,
  agora,
}: {
  routes: Route[];
  alerts: AlertEntry[];
  /** Vem do store, marcado na carga: contar tempo durante a pintura é impuro. */
  agora: number;
}) {
  const ativas = routes.filter((r) => r.active);
  const noAlvo = routes.filter(
    (r) => r.active && r.price_limit != null && r.current != null && r.current <= r.price_limit,
  );
  const menor = menorPrecoAtivo(routes);
  const recentes = alerts.filter((a) => agora - new Date(a.sent_at).getTime() < SETE_DIAS_MS);

  return (
    <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
      <StatTile
        label="Rotas ativas"
        value={String(ativas.length)}
        note={
          routes.length === ativas.length
            ? 'todas em acompanhamento'
            : `${routes.length - ativas.length} pausada(s)`
        }
      />
      <StatTile
        label="No alvo agora"
        value={String(noAlvo.length)}
        tone={noAlvo.length > 0 ? 'mint' : 'ink'}
        note={
          noAlvo.length > 0
            ? noAlvo.map((r) => `${r.origin}→${r.destination}`).join(', ')
            : 'nenhum preço bateu o limite'
        }
      />
      <StatTile
        label="Menor preço agora"
        value={menor ? brl(menor.valor) : '—'}
        note={menor ? `${menor.rota.origin} → ${menor.rota.destination}` : 'sem leitura ainda'}
      />
      <StatTile
        label="Alertas em 7 dias"
        value={String(recentes.length)}
        note={alerts.length > 0 ? `último ${desde(alerts[0].sent_at)}` : 'nenhum até agora'}
      />
    </div>
  );
}

function Carregando() {
  return (
    <>
      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[92px] rounded-md" />
        ))}
      </div>
      <Skeleton className="h-[220px] rounded-md" />
    </>
  );
}

export default function Dashboard() {
  const { routes, alerts, loading, error, loadedAt } = useMonitor();

  if (error && !routes) {
    return (
      <EmptyState title="Sem contato com o servidor">
        {error}. Confira se o monitor está rodando e a página se reconecta sozinha.
      </EmptyState>
    );
  }

  if (loading || !routes || !alerts) return <Carregando />;

  if (routes.length === 0) {
    return (
      <EmptyState
        title="Nenhuma rota ainda"
        action={<Button variant="solid" onClick={() => navigate('/rotas')}>cadastrar rota</Button>}
      >
        Cadastre o primeiro trecho e o monitor passa a consultar o preço de hora em hora, avisando
        quando ele cair.
      </EmptyState>
    );
  }

  const recentes = alerts.slice(0, 4);

  return (
    <>
      <Indicadores routes={routes} alerts={alerts} agora={loadedAt} />

      <Card
        title="Quadro de rotas"
        bodyClass=""
        className="mb-5"
        action={
          <Button variant="quiet" size="sm" onClick={() => navigate('/rotas')}>
            ver rotas →
          </Button>
        }
      >
        <FlightBoard routes={routes} />
      </Card>

      <Card
        title="Alertas recentes"
        action={
          alerts.length > 0 && (
            <Button variant="quiet" size="sm" onClick={() => navigate('/alertas')}>
              ver todos →
            </Button>
          )
        }
      >
        {recentes.length === 0 ? (
          <p className="text-muted">
            Nenhum alerta ainda. Eles aparecem quando um preço bate seu limite, cai forte ou marca o
            menor valor já visto.
          </p>
        ) : (
          recentes.map((alert) => <AlertRow key={alert.id} alert={alert} />)
        )}
      </Card>
    </>
  );
}
