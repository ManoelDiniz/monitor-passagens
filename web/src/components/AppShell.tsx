import { useState, type ReactNode } from 'react';
import { proxima } from '../lib/format';
import { navigate } from '../lib/router';
import { useMonitor } from '../lib/store';
import { Button } from './ui';

export interface NavItem {
  path: string;
  label: string;
  title: string;
  subtitle: string;
  icon: (props: { className?: string }) => ReactNode;
}

const Icon = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`h-[17px] w-[17px] shrink-0 ${className}`}
    aria-hidden="true"
  >
    {children}
  </svg>
);

/**
 * A navegação inteira sai daqui. Uma seção nova no futuro é um item a mais
 * nesta lista mais um caso no App — nada de mexer no shell.
 */
export const NAV: NavItem[] = [
  {
    path: '/',
    label: 'Painel',
    title: 'Painel',
    subtitle: 'O estado de todas as rotas numa tela só',
    icon: (p) => (
      <Icon {...p}>
        <path d="M3 13a9 9 0 0 1 18 0" />
        <path d="M12 13l4-3.5" />
        <path d="M3 13v4h18v-4" />
      </Icon>
    ),
  },
  {
    path: '/rotas',
    label: 'Rotas',
    title: 'Rotas',
    subtitle: 'Cadastre, ajuste e acompanhe cada trecho monitorado',
    icon: (p) => (
      <Icon {...p}>
        <path d="M4 18h16" />
        <path d="M5.5 14.5 3.8 8.2a.8.8 0 0 1 1.1-.9l1.7.8 2.2 1.6 3.4-4.9a1.2 1.2 0 0 1 2.1.3l2.4 6.6" />
      </Icon>
    ),
  },
  {
    path: '/alertas',
    label: 'Alertas',
    title: 'Alertas',
    subtitle: 'Tudo que o monitor achou digno de te avisar',
    icon: (p) => (
      <Icon {...p}>
        <path d="M18 8.5a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16s-2-1.5-2-6.5" />
        <path d="M10.5 19a2 2 0 0 0 3 0" />
      </Icon>
    ),
  },
  {
    path: '/cambio',
    label: 'Câmbio',
    title: 'Câmbio',
    subtitle: 'Dólar e euro: quando está barato, quanto custa e se está ganhando do CDI',
    icon: (p) => (
      <Icon {...p}>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M14.6 9.2c-.5-.9-1.5-1.4-2.6-1.4-1.5 0-2.6.8-2.6 2s1.1 1.7 2.6 2.1 2.6.9 2.6 2.1-1.1 2-2.6 2c-1.2 0-2.2-.5-2.7-1.5" />
        <path d="M12 6v1.8M12 16.2V18" />
      </Icon>
    ),
  },
  {
    path: '/cripto',
    label: 'Cripto',
    title: 'Cripto',
    subtitle: 'Radar de quedas: quando uma cripto cai forte e costuma voltar',
    icon: (p) => (
      <Icon {...p}>
        <path d="M4 17l5-5 4 3 7-8" />
        <path d="M15 7h5v5" />
      </Icon>
    ),
  },
  {
    path: '/ajustes',
    label: 'Ajustes',
    title: 'Ajustes',
    subtitle: 'Como o monitor está configurado neste computador',
    icon: (p) => (
      <Icon {...p}>
        <path d="M5 6h14M5 12h14M5 18h14" />
        <circle cx="9" cy="6" r="2" />
        <circle cx="15" cy="12" r="2" />
        <circle cx="8" cy="18" r="2" />
      </Icon>
    ),
  },
];

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-4 pt-5 pb-4">
      {/* Marca: um cartão de embarque com o recorte do picote. */}
      <svg viewBox="0 0 28 20" className="h-5 w-7 shrink-0" aria-hidden="true">
        <path
          d="M1 3.5A2.5 2.5 0 0 1 3.5 1h21A2.5 2.5 0 0 1 27 3.5V7a2 2 0 0 0 0 6v3.5a2.5 2.5 0 0 1-2.5 2.5h-21A2.5 2.5 0 0 1 1 16.5z"
          fill="none"
          stroke="var(--color-mint)"
          strokeWidth={1.3}
        />
        <path d="M8 5.5v9" stroke="var(--color-rule-2)" strokeWidth={1.3} strokeDasharray="2 2.4" />
      </svg>
      <span className="display-tight text-[15px] leading-none tracking-[.13em] text-ink uppercase">
        Monitor
      </span>
    </div>
  );
}

function NavLink({
  item,
  active,
  count,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  count?: number;
  onNavigate: () => void;
}) {
  return (
    <a
      href={`#${item.path}`}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={`relative flex items-center gap-2.5 py-2 pr-3 pl-4 font-mono text-[12px]
                  tracking-[.06em] transition-colors
                  ${active ? 'bg-panel text-ink' : 'text-muted hover:bg-panel/60 hover:text-ink'}`}
    >
      <span
        className={`absolute top-1.5 bottom-1.5 left-0 w-[2px] rounded-full transition-colors
                    ${active ? 'bg-mint' : 'bg-transparent'}`}
      />
      {item.icon({ className: active ? 'text-mint' : 'text-faint' })}
      <span className="flex-1">{item.label}</span>
      {count !== undefined && count > 0 && (
        <span className="tabular font-mono text-[11px] text-faint">{count}</span>
      )}
    </a>
  );
}

function Pulse() {
  const { status, running } = useMonitor();

  if (!status) {
    return <span className="font-mono text-[11px] text-faint">conectando…</span>;
  }

  return (
    <span className="flex items-center gap-2 font-mono text-[11px] text-muted">
      <span
        className={`h-1.5 w-1.5 rounded-full ${running ? 'animate-pulse bg-amber' : 'bg-mint'}`}
      />
      {running ? 'consultando as fontes' : `próxima ${proxima(status.nextRun)}`}
    </span>
  );
}

export default function AppShell({ page, children }: { page: NavItem; children: ReactNode }) {
  const { routes, alerts, running, checkAll } = useMonitor();
  const [menuOpen, setMenuOpen] = useState(false);

  const counts: Record<string, number | undefined> = {
    '/rotas': routes?.length,
    '/alertas': alerts?.length,
  };

  return (
    <div className="min-h-screen lg:pl-[230px]">
      {menuOpen && (
        <div
          className="fixed inset-0 z-30 bg-[#050A0B]/70 lg:hidden"
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[230px] flex-col border-r border-rule
                    bg-shell transition-transform duration-200 lg:translate-x-0
                    ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <Brand />

        <nav className="mt-1 flex flex-col">
          {NAV.map((item) => (
            <NavLink
              key={item.path}
              item={item}
              active={item.path === page.path}
              count={counts[item.path]}
              onNavigate={() => {
                navigate(item.path);
                // No celular o menu cobre a tela: fecha junto com a navegação.
                setMenuOpen(false);
              }}
            />
          ))}
        </nav>

        <div className="mt-auto border-t border-rule px-4 py-3.5">
          <Pulse />
        </div>
      </aside>

      <div className="sticky top-0 z-20 border-b border-rule bg-ground/92 backdrop-blur">
        <div className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => setMenuOpen(true)}
              className="cursor-pointer rounded-sm border border-rule-2 p-1.5 text-muted lg:hidden"
              aria-label="Abrir menu"
            >
              <Icon>
                <path d="M4 7h16M4 12h16M4 17h16" />
              </Icon>
            </button>

            <div className="min-w-0">
              <h1 className="display-tight truncate text-[19px] leading-none tracking-[.09em] uppercase sm:text-[22px]">
                {page.title}
              </h1>
              <p className="mt-1 hidden truncate text-[12.5px] text-muted sm:block">
                {page.subtitle}
              </p>
            </div>
          </div>

          <Button onClick={() => void checkAll()} disabled={running} className="shrink-0">
            {running ? 'consultando…' : 'consultar todas'}
          </Button>
        </div>
      </div>

      <main key={page.path} className="page-in px-4 py-5 sm:px-7 sm:py-7">
        {children}
      </main>
    </div>
  );
}
