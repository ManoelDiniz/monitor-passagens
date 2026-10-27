import { fetchJson, fetchText, Offer, PriceProvider, ProviderError, SearchQuery } from './types';

/**
 * MaxMilhas — API interna (BFF) do site, sem cadastro nem chave.
 *
 * O fluxo tem duas etapas, igual ao do proprio site:
 *   1. GET na pagina de busca  -> o servidor cria uma "searchIntention" (UUID)
 *      e informa quais companhias estao habilitadas para a rota;
 *   2. GET /search/air-offer/offers/{id}/{cia} no BFF, uma vez por companhia.
 *
 * Cobre GOL, LATAM e Azul com tarifa brasileira, incluindo tarifas que so
 * aparecem nos sites das companhias. Como e endpoint interno, pode mudar sem
 * aviso — todo o acoplamento esta neste arquivo.
 */

const SITE = 'https://www.maxmilhas.com.br';
const BFF = 'https://bff-mall.maxmilhas.com.br';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

/** /busca-passagens-aereas/OW/FOR/SSA/2026-10-08/1/0/0/EC */
function pageUrl(query: SearchQuery): string {
  const parts = [
    'busca-passagens-aereas',
    query.returnDate ? 'RT' : 'OW',
    query.origin.toUpperCase(),
    query.destination.toUpperCase(),
    query.departDate,
    ...(query.returnDate ? [query.returnDate] : []),
    String(query.adults),
    '0', // criancas
    '0', // bebes
    'EC',
  ];
  return `${SITE}/${parts.join('/')}`;
}

interface Intention {
  id: string;
  airlines: string[];
}

async function createIntention(url: string): Promise<Intention> {
  /* Esta e a porta de entrada da MaxMilhas: uma pagina HTML do site, nao uma
     API. E tambem a chamada mais sujeita a bloqueio, entao ela merece a mesma
     retentativa com espera crescente que o resto. */
  let html: string;
  try {
    html = await fetchText(url, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'pt-BR,pt;q=0.9', Accept: 'text/html' },
      timeoutMs: 30_000,
    });
  } catch (err) {
    throw new ProviderError(`pagina de busca falhou: ${(err as Error).message}`, 'maxmilhas');
  }
  const embedded = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html);
  if (!embedded) {
    throw new ProviderError('pagina sem __NEXT_DATA__ (o site da MaxMilhas mudou)', 'maxmilhas');
  }

  let intention: any;
  try {
    intention = JSON.parse(embedded[1])?.props?.pageProps?.searchIntention;
  } catch {
    throw new ProviderError('__NEXT_DATA__ nao e JSON valido', 'maxmilhas');
  }

  if (!intention?.id) {
    throw new ProviderError('o site nao criou a busca (rota ou data invalida?)', 'maxmilhas');
  }

  const airlines: string[] = (intention.airlines ?? [])
    .filter((a: any) => a?.status?.enable && a.label)
    .map((a: any) => a.label as string);

  if (airlines.length === 0) {
    throw new ProviderError('nenhuma companhia habilitada para esta rota', 'maxmilhas');
  }

  return { id: intention.id, airlines };
}

async function fetchAirline(id: string, airline: string, referer: string): Promise<any> {
  return fetchJson(`${BFF}/search/air-offer/offers/${id}/${airline}`, {
    headers: {
      'User-Agent': UA,
      Accept: 'application/json, text/plain, */*',
      'Accept-Language': 'pt-BR,pt;q=0.9',
      Origin: SITE,
      Referer: referer,
    },
    // O proprio site permite ate 120s por companhia.
    timeoutMs: 125_000,
  });
}

const CABIN: Record<string, string> = {
  EC: 'ECONOMY',
  PE: 'PREMIUM_ECONOMY',
  EX: 'BUSINESS',
  BU: 'BUSINESS',
};

/** O dicionario devolve o apelido em minusculas ("gol"); aqui vira nome de exibicao. */
const AIRLINE_NAMES: Record<string, string> = {
  gol: 'GOL',
  latam: 'LATAM',
  azul: 'Azul',
  tap: 'TAP',
  copa: 'Copa Airlines',
  G3: 'GOL',
  LA: 'LATAM',
  AD: 'Azul',
};

function airlineName(code: string, dictionaries: any): string {
  const entry = dictionaries?.airline?.[code];
  const raw = (typeof entry === 'string' ? entry : entry?.name) || code;
  return AIRLINE_NAMES[raw] ?? AIRLINE_NAMES[code] ?? raw.replace(/\b[a-z]/g, (c: string) => c.toUpperCase());
}

function toOffer(raw: any, dictionaries: any, link: string): Offer | null {
  const total = raw?.priceDetails?.totalPrices;
  const out = raw?.bounds?.[0];
  if (!total?.total || !out) return null;

  const back = raw.bounds[1];
  const code = out.carrier ?? out.validatedBy;

  return {
    // Total ja consolidado para todos os passageiros da busca.
    price: Number(total.total),
    currency: (total.currencyCode || 'BRL').toUpperCase(),
    airline: airlineName(code, dictionaries),
    cabin: CABIN[raw.cabin] ?? raw.cabin ?? 'ECONOMY',
    checkedBags: out.hasCheckedBags ? 1 : 0,
    stopsOut: typeof out.totalStops === 'number' ? out.totalStops : null,
    stopsRet: back && typeof back.totalStops === 'number' ? back.totalStops : null,
    departAt: out.departure?.dateTime ?? null,
    returnAt: back?.departure?.dateTime ?? null,
    link,
    raw,
  };
}

export const maxmilhas: PriceProvider = {
  name: 'maxmilhas',

  isConfigured() {
    return true;
  },

  async search(query: SearchQuery): Promise<Offer[]> {
    const url = pageUrl(query);
    const intention = await createIntention(url);

    const perAirline = await Promise.all(
      intention.airlines.map(async (airline) => {
        try {
          const body = await fetchAirline(intention.id, airline, url);
          const offers: any[] = body?.offers ?? [];
          return offers
            .map((o) => toOffer(o, body?.dictionaries, url))
            .filter((o): o is Offer => o !== null);
        } catch {
          // Uma companhia fora do ar nao invalida as outras.
          return [];
        }
      }),
    );

    const all = perAirline.flat();
    if (all.length === 0) {
      throw new ProviderError('nenhuma companhia retornou ofertas', 'maxmilhas');
    }
    return all;
  },
};
