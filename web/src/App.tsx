import AppShell, { NAV } from './components/AppShell';
import Toasts from './components/Toasts';
import { useHashRoute } from './lib/router';
import { MonitorProvider } from './lib/store';
import Alerts from './pages/Alerts';
import Cambio from './pages/Cambio';
import Cripto from './pages/Cripto';
import Dashboard from './pages/Dashboard';
import Routes from './pages/Routes';
import Settings from './pages/Settings';

/** Uma seção nova entra aqui e em NAV. O resto do shell não muda. */
const PAGES: Record<string, () => React.ReactElement> = {
  '/': Dashboard,
  '/rotas': Routes,
  '/alertas': Alerts,
  '/cambio': Cambio,
  '/cripto': Cripto,
  '/ajustes': Settings,
};

function Shell() {
  const path = useHashRoute();
  const page = NAV.find((item) => item.path === path) ?? NAV[0];
  const Page = PAGES[page.path] ?? Dashboard;

  return (
    <AppShell page={page}>
      <Page />
    </AppShell>
  );
}

export default function App() {
  return (
    <MonitorProvider>
      <Shell />
      <Toasts />
    </MonitorProvider>
  );
}
