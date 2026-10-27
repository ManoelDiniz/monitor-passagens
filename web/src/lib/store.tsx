import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { AlertEntry, Route, Status } from '../types';
import { api } from './api';

export type ToastTone = 'ok' | 'bad' | 'info';

export interface Toast {
  id: number;
  text: string;
  tone: ToastTone;
}

interface MonitorValue {
  status: Status | null;
  routes: Route[] | null;
  alerts: AlertEntry[] | null;
  loading: boolean;
  error: string;
  running: boolean;
  /** Instante da última carga. Serve de "agora" para as contas de tempo na tela. */
  loadedAt: number;
  refresh: () => Promise<void>;
  checkAll: () => Promise<void>;
  toast: (text: string, tone?: ToastTone) => void;
  toasts: Toast[];
  dismiss: (id: number) => void;
}

const MonitorContext = createContext<MonitorValue | null>(null);

/** Ritmo normal: o preço muda de hora em hora, não precisa olhar mais que isso. */
const IDLE_POLL_MS = 60_000;
/** Enquanto uma rodada está no ar, acompanha de perto para reagir ao fim dela. */
const ACTIVE_POLL_MS = 4_000;
const TOAST_MS = 5_200;

export function MonitorProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [routes, setRoutes] = useState<Route[] | null>(null);
  const [alerts, setAlerts] = useState<AlertEntry[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadedAt, setLoadedAt] = useState(() => Date.now());
  const [toasts, setToasts] = useState<Toast[]>([]);

  const nextToastId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (text: string, tone: ToastTone = 'info') => {
      const id = nextToastId.current++;
      setToasts((current) => [...current, { id, text, tone }]);
      setTimeout(() => dismiss(id), TOAST_MS);
    },
    [dismiss],
  );

  const refresh = useCallback(async () => {
    try {
      const [nextStatus, nextRoutes, nextAlerts] = await Promise.all([
        api.status(),
        api.routes(),
        api.alerts(50),
      ]);
      setStatus(nextStatus);
      setRoutes(nextRoutes);
      setAlerts(nextAlerts);
      setLoadedAt(Date.now());
      setError('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // A regra existe para barrar setState síncrono dentro do efeito. Aqui a
    // escrita acontece depois do await, na volta da rede — que é exatamente
    // como se carrega dado na montagem.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const timer = setInterval(() => void refresh(), IDLE_POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  const running = status?.running ?? false;

  /* Acompanha a rodada em andamento pelo próprio servidor. Antes isto era um
     setTimeout de 12 s no escuro: chutava o tempo da consulta e errava sempre. */
  useEffect(() => {
    if (!running) return;

    const timer = setInterval(async () => {
      try {
        const nextStatus = await api.status();
        setStatus(nextStatus);
        if (!nextStatus.running) void refresh();
      } catch {
        /* o ciclo de 60 s cobre a falha */
      }
    }, ACTIVE_POLL_MS);

    return () => clearInterval(timer);
  }, [running, refresh]);

  const checkAll = useCallback(async () => {
    try {
      const result = await api.checkAll();
      if (result.running) setStatus((current) => (current ? { ...current, running: true } : current));
      toast(
        result.started
          ? 'Consulta iniciada. Os preços aparecem assim que chegarem.'
          : 'Já existe uma consulta em andamento.',
        'info',
      );
    } catch (err) {
      toast(`Não consegui iniciar a consulta: ${(err as Error).message}`, 'bad');
    }
  }, [toast]);

  return (
    <MonitorContext.Provider
      value={{
        status,
        routes,
        alerts,
        loading,
        error,
        running,
        loadedAt,
        refresh,
        checkAll,
        toast,
        toasts,
        dismiss,
      }}
    >
      {children}
    </MonitorContext.Provider>
  );
}

export function useMonitor(): MonitorValue {
  const value = useContext(MonitorContext);
  if (!value) throw new Error('useMonitor precisa estar dentro de <MonitorProvider>');
  return value;
}
