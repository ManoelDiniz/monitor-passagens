import AlertRow from '../components/AlertRow';
import { Card, EmptyState, Skeleton } from '../components/ui';
import { useMonitor } from '../lib/store';

export default function Alerts() {
  const { alerts, status, loading, error } = useMonitor();

  if (error && !alerts) {
    return (
      <EmptyState title="Sem contato com o servidor">
        {error}. Confira se o monitor está rodando e a página se reconecta sozinha.
      </EmptyState>
    );
  }

  if (loading || !alerts) return <Skeleton className="h-[280px] rounded-md" />;

  if (alerts.length === 0) {
    return (
      <EmptyState title="Nenhum alerta ainda">
        O monitor avisa quando um preço bate o limite que você definiu, cai{' '}
        {status?.dropAlertPct ?? 10}% ou mais de uma consulta para a outra, ou marca o menor valor já
        visto na rota.
      </EmptyState>
    );
  }

  return (
    <Card title={`${alerts.length} ${alerts.length === 1 ? 'alerta' : 'alertas'}`}>
      {alerts.map((alert) => (
        <AlertRow key={alert.id} alert={alert} detalhado />
      ))}
    </Card>
  );
}
