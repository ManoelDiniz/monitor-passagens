import { fetchText, Offer, PriceProvider, ProviderError, SearchQuery } from './types';

/**
 * Google Flights — endpoint RPC interno que a propria pagina do Google Voos usa.
 *
 * Nao exige cadastro nem chave. Os sites da LATAM, Azul e GOL barram robos
 * (Akamai, 403 na primeira chamada), mas o Google mostra as tarifas publicadas
 * por essas mesmas companhias — e costuma achar preco que Kiwi e MaxMilhas nao
 * trazem. Como e endpoint interno, o formato posicional abaixo pode mudar sem
 * aviso; todo o acoplamento com o Google esta neste arquivo.
 *
 * Em ida-e-volta o preco devolvido ja e o total do par, mas a lista traz so as
 * opcoes de ida — escolher a volta exigiria uma segunda chamada por oferta.
 * Por isso `returnAt` fica nulo aqui.
 */

const ENDPOINT =
  'https://www.google.com/_/FlightsFrontendUi/data/travel.frontend.flights.FlightsFrontendService/GetShoppingResults';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

const TRIP = { roundTrip: 1, oneWay: 2 };
const ECONOMY = 1;
const ORDEM_MELHORES = 1;

/** Qualquer numero de paradas; o Google usa 1 = direto, 2 = ate 1, 3 = ate 2. */
function stopsFilter(maxStops?: number): number {
  if (maxStops === undefined) return 0;
  return Math.min(maxStops, 2) + 1;
}

function segment(from: string, to: string, date: string, maxStops?: number): unknown[] {
  return [
    [[[from.toUpperCase(), 0]]],
    [[[to.toUpperCase(), 0]]],
    null,
    stopsFilter(maxStops),
    null,
    null,
    date,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    3,
  ];
}

/** O corpo e um JSON posicional, serializado duas vezes, dentro de um form. */
function requestBody(query: SearchQuery): string {
  const segments = [segment(query.origin, query.destination, query.departDate, query.maxStops)];
  if (query.returnDate) {
    segments.push(segment(query.destination, query.origin, query.returnDate, query.maxStops));
  }

  const filters = [
    [],
    [
      null,
      null,
      query.returnDate ? TRIP.roundTrip : TRIP.oneWay,
      null,
      [],
      ECONOMY,
      [query.adults, 0, 0, 0],
      null,
      null,
      null,
      null,
      null,
      null,
      segments,
      null,
      null,
      null,
      1,
    ],
    ORDEM_MELHORES,
    0,
    0,
    2,
  ];

  return `f.req=${encodeURIComponent(JSON.stringify([null, JSON.stringify(filters)]))}`;
}

/** Resposta comeca com ")]}'" para impedir execucao como script; o payload vem serializado dentro. */
function parseResponse(text: string): any[] {
  const outer = JSON.parse(text.replace(/^\)\]\}'/, ''));
  const inner = outer?.[0]?.[2];
  if (typeof inner !== 'string') {
    throw new ProviderError('resposta sem resultados (o Google pode ter mudado o formato)', 'google');
  }
  const data = JSON.parse(inner);
  // [2] = "melhores voos", [3] = "outros voos"; qualquer um pode faltar.
  return [2, 3].flatMap((i) => (Array.isArray(data?.[i]?.[0]) ? data[i][0] : []));
}

const pad = (n: unknown) => String(n ?? 0).padStart(2, '0');

/** Data vem como [2026, 11, 6] e hora como [5] ou [null, 40] — zeros sao omitidos. */
function localTime(date: unknown, time: unknown): string | null {
  if (!Array.isArray(date) || date.length < 3) return null;
  const [h, m] = Array.isArray(time) ? time : [];
  return `${date[0]}-${pad(date[1])}-${pad(date[2])}T${pad(h)}:${pad(m)}:00`;
}

function searchLink(query: SearchQuery): string {
  const q = query.returnDate
    ? `Flights from ${query.origin} to ${query.destination} on ${query.departDate} through ${query.returnDate}`
    : `Flights from ${query.origin} to ${query.destination} on ${query.departDate} oneway`;
  return `https://www.google.com/travel/flights?hl=pt-BR&curr=BRL&q=${encodeURIComponent(q)}`;
}

function toOffer(raw: any, link: string): Offer | null {
  const price = raw?.[1]?.[0]?.at?.(-1);
  const legs: any[] = raw?.[0]?.[2] ?? [];
  if (typeof price !== 'number' || price <= 0 || legs.length === 0) return null;

  const airlines: string[] = raw[0][1] ?? [];

  return {
    // Total da busca: ja considera todos os adultos e, em ida-e-volta, o par.
    price,
    currency: 'BRL',
    airline: airlines.length ? airlines.join(' + ') : (legs[0]?.[22]?.[3] ?? null),
    cabin: 'ECONOMY',
    checkedBags: null,
    stopsOut: legs.length - 1,
    stopsRet: null,
    departAt: localTime(legs[0]?.[20], legs[0]?.[8]),
    returnAt: null,
    link,
    raw: { flights: legs.map((l) => `${l?.[22]?.[0]}${l?.[22]?.[1]} ${l?.[3]}->${l?.[6]}`) },
  };
}

export const google: PriceProvider = {
  name: 'google',

  isConfigured() {
    return true;
  },

  async search(query: SearchQuery): Promise<Offer[]> {
    let text: string;
    try {
      text = await fetchText(`${ENDPOINT}?hl=pt-BR&gl=BR&curr=BRL`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'User-Agent': UA,
          'Accept-Language': 'pt-BR,pt;q=0.9',
          Origin: 'https://www.google.com',
          Referer: 'https://www.google.com/travel/flights',
        },
        body: requestBody(query),
        timeoutMs: 30_000,
      });
    } catch (err) {
      throw new ProviderError((err as Error).message, 'google');
    }

    let flights: any[];
    try {
      flights = parseResponse(text);
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      throw new ProviderError(`resposta ilegivel: ${(err as Error).message}`, 'google');
    }

    const link = searchLink(query);
    return flights.map((f) => toOffer(f, link)).filter((o): o is Offer => o !== null);
  },
};
