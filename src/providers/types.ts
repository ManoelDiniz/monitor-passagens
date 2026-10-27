import { config } from '../config';

export interface SearchQuery {
  origin: string;
  destination: string;
  departDate: string;        // YYYY-MM-DD — primeiro dia da janela
  /** Ultimo dia da janela, inclusive. Ausente ou igual a departDate = data unica. */
  departDateEnd?: string;
  /** Volta correspondente a departDate; null em somente ida. */
  returnDate: string | null;
  adults: number;
  /** Filtra no servidor do provedor quando ele suporta. Opcional. */
  maxStops?: number;
}

export interface Offer {
  price: number;
  currency: string;
  airline: string | null;
  cabin: string | null;
  /** null quando o provedor nao informa bagagem despachada */
  checkedBags: number | null;
  stopsOut: number | null;
  stopsRet: number | null;
  departAt: string | null;
  returnAt: string | null;
  link: string | null;
  raw: unknown;
  /** Preenchido pelo orquestrador: qual provedor trouxe esta oferta. */
  source?: string;
  /**
   * Data que foi consultada para achar esta oferta. Serve de rede quando o
   * provedor nao informa `departAt` e, sem isso, nao daria para saber a que dia
   * da janela o preco pertence.
   */
  queryDate?: string;
}

/**
 * Dia de ida da oferta: o que o provedor informou e, na falta dele, a data que
 * foi consultada para acha-la. null quando nem uma nem outra existe.
 */
export function offerDate(offer: Offer): string | null {
  return offer.departAt?.slice(0, 10) ?? offer.queryDate ?? null;
}

export interface PriceProvider {
  name: string;
  /** false quando faltam credenciais no .env */
  isConfigured(): boolean;
  /**
   * true quando o provedor resolve a janela inteira numa chamada so. Quem
   * responde false (ou nao implementa) e consultado dia a dia pelo orquestrador.
   * Recebe a consulta porque o suporte costuma depender dela — a Kiwi aceita
   * intervalo na ida, mas nao em ida-e-volta.
   */
  supportsWindow?(query: SearchQuery): boolean;
  search(query: SearchQuery): Promise<Offer[]>;
}

export class ProviderError extends Error {
  constructor(message: string, readonly provider: string) {
    super(message);
    this.name = 'ProviderError';
  }
}

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Quanto esperar antes da proxima tentativa.
 *
 * Cresce a cada tentativa (2s, 6s, 18s) porque repetir no mesmo ritmo em cima de
 * um servico que esta engasgado so aumenta a fila. O sorteio de ate 1s evita que
 * as fontes, disparadas juntas, retentem no mesmo instante.
 */
function atraso(tentativa: number): number {
  return 2_000 * 3 ** (tentativa - 1) + Math.floor(Math.random() * 1_000);
}

/**
 * "Retry-After" pode vir em segundos ou como data HTTP. Quando o servidor diz
 * quanto esperar, ele manda — e um limite de 60s evita ficar preso a um valor
 * absurdo enquanto as outras rotas esperam a vez.
 */
export function retryAfterMs(header: string | null): number | null {
  if (!header) return null;

  const segundos = Number(header);
  if (Number.isFinite(segundos)) return Math.min(segundos * 1_000, 60_000);

  const data = Date.parse(header);
  if (Number.isNaN(data)) return null;

  return Math.min(Math.max(data - Date.now(), 0), 60_000);
}

export type FetchOptions = RequestInit & { timeoutMs?: number; retries?: number };

/**
 * GET com timeout e retentativa em falha de rede, 5xx e 429.
 *
 * 429 e o unico 4xx que se retenta: os outros sao erro de quem chama, e repetir
 * so gasta a paciencia do provedor.
 *
 * Devolve a Response para servir tanto a quem espera JSON quanto a quem precisa
 * do HTML da pagina — nem toda porta de entrada de provedor e uma API.
 */
export async function fetchComRetentativa(url: string, init: FetchOptions = {}): Promise<Response> {
  const { timeoutMs = 20_000, retries = config.providers.retries, ...rest } = init;
  let lastError: unknown;

  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...rest, signal: controller.signal });

      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(`HTTP ${res.status} ${res.statusText}`);
        if (attempt < retries) {
          await espera(retryAfterMs(res.headers.get('retry-after')) ?? atraso(attempt));
        }
        continue;
      }

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} ${res.statusText} ${body.slice(0, 300)}`);
      }

      return res;
    } catch (err) {
      lastError = err;
      // AbortError e erro de rede sao retentaveis; 4xx acima ja foi lancado.
      if (err instanceof Error && err.message.startsWith('HTTP 4')) throw err;
      if (attempt < retries) await espera(atraso(attempt));
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function fetchJson(url: string, init: FetchOptions = {}): Promise<any> {
  const res = await fetchComRetentativa(url, init);
  return res.json();
}

/** Mesma protecao do fetchJson para quem recebe HTML. */
export async function fetchText(url: string, init: FetchOptions = {}): Promise<string> {
  const res = await fetchComRetentativa(url, init);
  return res.text();
}
