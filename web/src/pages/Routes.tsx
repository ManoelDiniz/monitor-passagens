import { useState } from 'react';
import RouteCard from '../components/RouteCard';
import RouteForm from '../components/RouteForm';
import { Button, EmptyState, Modal, Skeleton } from '../components/ui';
import { useMonitor } from '../lib/store';

export default function Routes() {
  const { routes, loading, error } = useMonitor();
  const [criando, setCriando] = useState(false);

  if (error && !routes) {
    return (
      <EmptyState title="Sem contato com o servidor">
        {error}. Confira se o monitor está rodando e a página se reconecta sozinha.
      </EmptyState>
    );
  }

  if (loading || !routes) {
    return (
      <>
        <Skeleton className="mb-4 h-[300px] rounded-md" />
        <Skeleton className="h-[300px] rounded-md" />
      </>
    );
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-4">
        <span className="eyebrow">
          {routes.length} {routes.length === 1 ? 'rota cadastrada' : 'rotas cadastradas'}
        </span>
        <Button variant="solid" onClick={() => setCriando(true)}>
          nova rota
        </Button>
      </div>

      {routes.length === 0 ? (
        <EmptyState
          title="Nenhuma rota ainda"
          action={
            <Button variant="solid" onClick={() => setCriando(true)}>
              cadastrar a primeira
            </Button>
          }
        >
          Informe origem, destino e data. O monitor consulta o preço de hora em hora e avisa quando
          ele cair.
        </EmptyState>
      ) : (
        routes.map((route, i) => <RouteCard key={route.id} route={route} index={i} />)
      )}

      {criando && (
        <Modal title="Nova rota" onClose={() => setCriando(false)}>
          <RouteForm onDone={() => setCriando(false)} onCancel={() => setCriando(false)} />
        </Modal>
      )}
    </>
  );
}
