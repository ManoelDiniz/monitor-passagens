import type {
  AlertEntry,
  Ativo,
  BacktestCambio,
  CarteiraCambio,
  CarteiraCripto,
  EstudoCripto,
  OperacaoCripto,
  RadarCripto,
  CheckResult,
  Offer,
  OperacaoCambio,
  PanoramaCambio,
  Route,
  Status,
} from '../types';

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch('/api' + path, {
    ...init,
    // Só declara JSON quando há corpo — senão o Fastify recusa o corpo vazio.
    headers: init.body ? { 'Content-Type': 'application/json' } : {},
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  return body as T;
}

/** O que o formulário manda: números como números, vazio como null. */
export interface RoutePayload {
  origin: string;
  destination: string;
  depart_date: string;
  return_date: string | null;
  depart_window_days: number;
  adults: number;
  price_limit: number | null;
  max_stops: number;
  require_checked_bag: number;
  notes: string | null;
}

/** Na edição só vai o que mudou; o servidor preserva o resto. */
export type RoutePatch = Partial<RoutePayload> & { active?: boolean };

/** Compra ou venda lançada à mão, com os valores que a plataforma mostrou. */
export interface OperacaoPayload {
  ativo: Ativo;
  tipo: 'compra' | 'venda';
  dia: string;
  valor_brl: number;
  /** Vazio: o servidor estima pelo preço pago ou pela cotação do dia; na venda, vende tudo. */
  quantidade: number | null;
  /** Preço por unidade que a plataforma mostrou, se você tiver. */
  preco_pago: number | null;
  plataforma: string | null;
  notas: string | null;
}

/** Compra pede valor; venda fecha uma parte (a indicada ou a de menor preço). */
export interface OperacaoCriptoPayload {
  moeda: string;
  tipo: 'compra' | 'venda';
  dia: string;
  valor_brl: number | null;
  quantidade: number | null;
  preco_pago: number | null;
  lote_id: number | null;
  plataforma: string | null;
  notas: string | null;
}

const json = (body: unknown) => JSON.stringify(body);

export const api = {
  status: () => request<Status>('/status'),
  routes: () => request<Route[]>('/routes'),
  offers: (id: number) => request<Offer[]>(`/routes/${id}/offers`),
  alerts: (limit = 50) => request<AlertEntry[]>(`/notifications?limit=${limit}`),

  create: (route: RoutePayload) =>
    request<Route>('/routes', { method: 'POST', body: json(route) }),

  update: (id: number, patch: RoutePatch) =>
    request<Route>(`/routes/${id}`, { method: 'PATCH', body: json(patch) }),

  remove: (id: number) => request<{ ok: true }>(`/routes/${id}`, { method: 'DELETE' }),

  check: (id: number) => request<CheckResult>(`/routes/${id}/check`, { method: 'POST' }),

  checkAll: () =>
    request<{ started: boolean; running: boolean }>('/check-all', { method: 'POST' }),

  cambio: () => request<PanoramaCambio>('/cambio'),
  cambioAtualizar: () => request<PanoramaCambio>('/cambio/atualizar', { method: 'POST' }),
  carteira: () => request<CarteiraCambio>('/cambio/carteira'),
  registrarOperacao: (op: OperacaoPayload) =>
    request<OperacaoCambio>('/cambio/operacoes', { method: 'POST', body: json(op) }),
  removerOperacao: (id: number) =>
    request<{ ok: true }>(`/cambio/operacoes/${id}`, { method: 'DELETE' }),
  backtest: (ativo: Ativo, capital = 100) =>
    request<BacktestCambio>(`/cambio/backtest?ativo=${ativo}&capital=${capital}`),

  cripto: () => request<RadarCripto>('/cripto'),
  criptoAtualizar: () => request<RadarCripto>('/cripto/atualizar', { method: 'POST' }),
  criptoCarteira: () => request<CarteiraCripto>('/cripto/carteira'),
  criptoRegistrar: (op: OperacaoCriptoPayload) =>
    request<OperacaoCripto>('/cripto/operacoes', { method: 'POST', body: json(op) }),
  criptoRemover: (id: number) => request<{ ok: true }>(`/cripto/operacoes/${id}`, { method: 'DELETE' }),
  criptoEstudo: (moeda: string) => request<EstudoCripto>(`/cripto/estudo?moeda=${moeda}`),
};
