import { config } from '../config';
import { addDays, datesInclusive, nightsBetween } from '../domain/date-window';
import { log } from '../logger';
import { amadeus } from './amadeus';
import { google } from './google';
import { providerHealth } from './health';
import { kiwi } from './kiwi';
import { maxmilhas } from './maxmilhas';
import { travelpayouts } from './travelpayouts';
import { Offer, PriceProvider, ProviderError, SearchQuery } from './types';

export * from './types';

const registry: Record<string, PriceProvider> = {
  kiwi,
  maxmilhas,
  google,
  travelpayouts,
  amadeus,
};

/** Provedores configurados, na ordem definida em PROVIDER_ORDER. */
export function activeProviders(): PriceProvider[] {
  return config.providerOrder
    .map((name) => registry[name])
    .filter((p): p is PriceProvider => Boolean(p) && p.isConfigured());
}

/**
 * Tira da rodada quem esta de castigo — mas nunca deixa a lista vazia. Ficar
 * sem consultar ninguem e pior que tentar: enquanto todas estiverem suspensas,
 * a rodada serve de sondagem e uma delas pode voltar.
 */
function providersDaVez(): PriceProvider[] {
  const todos = activeProviders();
  const disponiveis = todos.filter((p) => !providerHealth.isPaused(p.name));

  if (disponiveis.length > 0) return disponiveis;
  if (todos.length > 0) log.warn('todas as fontes suspensas; consultando assim mesmo para sondar');
  return todos;
}

export interface SearchResult {
  provider: string;
  offers: Offer[];
}

/** Respiro entre os dias de uma janela: sao chamadas seguidas na mesma fonte. */
const PAUSA_ENTRE_DATAS_MS = 700;

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Quebra a janela em uma consulta por dia. A volta acompanha cada ida mantendo
 * as noites da consulta original — deslizar o par inteiro e o que preserva a
 * duracao da viagem.
 */
export function expandirJanela(query: SearchQuery): SearchQuery[] {
  const fim = query.departDateEnd ?? query.departDate;
  if (fim <= query.departDate) return [query];

  const noites = query.returnDate ? nightsBetween(query.departDate, query.returnDate) : null;

  return datesInclusive(query.departDate, fim).map((departDate) => ({
    ...query,
    departDate,
    departDateEnd: departDate,
    returnDate: noites === null ? null : addDays(departDate, noites),
  }));
}

/**
 * Uma fonte, uma janela. Quem sabe resolver o intervalo sozinho recebe a
 * consulta inteira; os demais sao percorridos dia a dia.
 *
 * Um dia que falha nao derruba a janela: nao ha voo em toda data, e uma fonte
 * que engasgou num dia costuma responder no seguinte. So vira erro quando
 * nenhuma das datas respondeu — ai a fonte esta fora mesmo, e o disjuntor
 * precisa saber disso.
 */
async function consultarComJanela(provider: PriceProvider, query: SearchQuery): Promise<Offer[]> {
  if (provider.supportsWindow?.(query)) return provider.search(query);

  const consultas = expandirJanela(query);
  if (consultas.length === 1) return provider.search(consultas[0]);

  const offers: Offer[] = [];
  const falhas: string[] = [];

  for (const [i, consulta] of consultas.entries()) {
    try {
      const encontradas = await provider.search(consulta);
      for (const offer of encontradas) offer.queryDate ??= consulta.departDate;
      offers.push(...encontradas);
    } catch (err) {
      falhas.push(`${consulta.departDate}: ${(err as Error).message}`);
    }
    if (i < consultas.length - 1) await espera(PAUSA_ENTRE_DATAS_MS);
  }

  if (falhas.length === consultas.length) {
    throw new ProviderError(
      `nenhuma data da janela respondeu -> ${falhas.slice(0, 2).join(' | ')}`,
      provider.name,
    );
  }

  if (falhas.length > 0) {
    log.warn(
      `${provider.name}: ${falhas.length}/${consultas.length} datas da janela falharam`,
      falhas[0],
    );
  }

  return offers;
}

/**
 * Consulta TODOS os provedores configurados e junta as ofertas, marcando a
 * origem de cada uma. E o modo certo quando se quer o melhor preco entre
 * varias fontes — nenhuma fonte sozinha ganha em todas as rotas.
 * So lanca se nenhum provedor responder.
 */
export async function searchAll(query: SearchQuery): Promise<SearchResult> {
  const providers = providersDaVez();

  if (providers.length === 0) {
    throw new Error(
      'Nenhum provedor configurado. Inclua "kiwi", "maxmilhas" ou "google" em PROVIDER_ORDER (nao precisam de chave).',
    );
  }

  const settled = await Promise.all(
    providers.map(async (provider) => {
      try {
        const offers = await consultarComJanela(provider, query);
        for (const offer of offers) offer.source = provider.name;
        /* Responder sem oferta nao e falha: pode nao haver voo no trecho. O que
           conta como falha e a fonte nao responder. */
        providerHealth.registerSuccess(provider.name);
        return { name: provider.name, offers, error: null as string | null };
      } catch (err) {
        const message = (err as Error).message;
        providerHealth.registerFailure(provider.name, message);
        log.warn(`provedor ${provider.name} falhou`, message);
        return { name: provider.name, offers: [] as Offer[], error: message };
      }
    }),
  );

  const winners = settled.filter((s) => s.offers.length > 0);

  if (winners.length === 0) {
    const detail = settled.map((s) => `${s.name}: ${s.error ?? 'sem ofertas'}`).join(' | ');
    throw new Error(`nenhum provedor retornou ofertas -> ${detail}`);
  }

  return {
    provider: winners.map((w) => w.name).join('+'),
    offers: winners.flatMap((w) => w.offers),
  };
}

/**
 * Tenta cada provedor configurado em ordem e devolve o primeiro que
 * responder sem erro. So lanca se todos falharem.
 */
export async function searchWithFallback(query: SearchQuery): Promise<SearchResult> {
  const providers = providersDaVez();

  if (providers.length === 0) {
    throw new Error(
      'Nenhum provedor configurado. Inclua "kiwi" em PROVIDER_ORDER (nao precisa de chave) ' +
        'ou preencha TRAVELPAYOUTS_TOKEN / AMADEUS_CLIENT_ID no arquivo .env',
    );
  }

  const failures: string[] = [];

  for (const provider of providers) {
    try {
      const offers = await consultarComJanela(provider, query);
      providerHealth.registerSuccess(provider.name);
      return { provider: provider.name, offers };
    } catch (err) {
      const message = (err as Error).message;
      providerHealth.registerFailure(provider.name, message);
      failures.push(`${provider.name}: ${message}`);
      log.warn(`provedor ${provider.name} falhou`, message);
    }
  }

  throw new Error(`todos os provedores falharam -> ${failures.join(' | ')}`);
}
