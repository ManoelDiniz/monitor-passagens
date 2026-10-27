import { fetchJson, Offer, PriceProvider, ProviderError, SearchQuery } from './types';

/**
 * Kiwi.com — API GraphQL publica que o proprio site usa.
 *
 * Nao exige cadastro nem chave. Em compensacao e um endpoint interno: se a Kiwi
 * mudar o schema, este arquivo para de funcionar e precisa ser ajustado. Todo o
 * acoplamento com a Kiwi esta contido aqui — o resto do sistema nao muda.
 *
 * Para diagnosticar uma quebra, rode a introspeccao:
 *   POST https://api.skypicker.com/umbrella/v2/graphql?featureName=probe
 *   { "query": "{ __type(name: \"ItineraryReturn\") { fields { name } } }" }
 */

const ENDPOINT = 'https://api.skypicker.com/umbrella/v2/graphql';
const PARTNER = 'skypicker';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const SEGMENT_FIELDS = `
  sectorSegments {
    segment {
      source { localTime station { code } }
      destination { localTime station { code } }
      carrier { code name }
    }
  }
`;

const RETURN_QUERY = `
query Monitor($search: SearchReturnInput, $filter: ItinerariesFilterInput, $options: ItinerariesOptionsInput) {
  returnItineraries(search: $search, filter: $filter, options: $options) {
    __typename
    ... on AppError { code message }
    ... on Itineraries {
      itineraries {
        ... on ItineraryReturn {
          id
          cabinClasses
          price { amount currency { code } }
          bagsInfo { includedCheckedBags includedHandBags }
          outbound { ${SEGMENT_FIELDS} }
          inbound { ${SEGMENT_FIELDS} }
          bookingOptions { edges { node { bookingUrl } } }
        }
      }
    }
  }
}`;

const ONEWAY_QUERY = `
query Monitor($search: SearchOnewayInput, $filter: ItinerariesFilterInput, $options: ItinerariesOptionsInput) {
  onewayItineraries(search: $search, filter: $filter, options: $options) {
    __typename
    ... on AppError { code message }
    ... on Itineraries {
      itineraries {
        ... on ItineraryOneWay {
          id
          cabinClasses
          price { amount currency { code } }
          bagsInfo { includedCheckedBags includedHandBags }
          sector { ${SEGMENT_FIELDS} }
          bookingOptions { edges { node { bookingUrl } } }
        }
      }
    }
  }
}`;

/** A Kiwi aceita intervalo aqui; um unico dia e so o intervalo degenerado. */
const dayRange = (start: string, end = start) => ({
  start: `${start}T00:00:00`,
  end: `${end}T23:59:59`,
});

/**
 * Quantos itinerarios pedir. Numa janela, 30 nao basta: a lista vem ordenada
 * por preco e os 30 primeiros podem sair todos do mesmo dia, escondendo o
 * melhor preco dos outros dias — que e justamente o que a janela existe para
 * achar.
 */
const LIMITE_DIA = 30;
const LIMITE_JANELA = 100;

const station = (iata: string) => ({ ids: [`Station:airport:${iata.toUpperCase()}`] });

interface Segment {
  source?: { localTime?: string; station?: { code?: string } };
  destination?: { localTime?: string; station?: { code?: string } };
  carrier?: { code?: string; name?: string };
}

const segmentsOf = (sector: any): Segment[] =>
  (sector?.sectorSegments ?? []).map((s: any) => s.segment).filter(Boolean);

/** Companhias distintas do trecho: "LATAM" ou "GOL + Azul" quando ha conexao entre cias. */
function carriersOf(segments: Segment[]): string | null {
  const names = [...new Set(segments.map((s) => s.carrier?.name || s.carrier?.code).filter(Boolean))];
  return names.length ? names.join(' + ') : null;
}

function bookingLink(itinerary: any): string | null {
  const url = itinerary?.bookingOptions?.edges?.[0]?.node?.bookingUrl;
  if (!url) return null;
  return url.startsWith('http') ? url : `https://www.kiwi.com${url}`;
}

export const kiwi: PriceProvider = {
  name: 'kiwi',

  // Nao precisa de credencial nenhuma.
  isConfigured() {
    return true;
  },

  /**
   * So ida: a busca aceita um intervalo em `outboundDepartureDate` e devolve a
   * janela inteira numa chamada.
   *
   * Ida-e-volta fica de fora de proposito. Daria para mandar intervalo tambem na
   * volta, mas ai a Kiwi combinaria qualquer ida com qualquer volta e voltariam
   * pares com duracao diferente da que a rota pediu — dez noites viram trinta.
   * Nesses casos o orquestrador consulta par a par, que e mais caro e correto.
   */
  supportsWindow(query: SearchQuery): boolean {
    return !query.returnDate;
  },

  async search(query: SearchQuery): Promise<Offer[]> {
    const roundTrip = Boolean(query.returnDate);
    const fimDaJanela = query.departDateEnd ?? query.departDate;
    const janela = !roundTrip && fimDaJanela > query.departDate;

    const itinerary: Record<string, unknown> = {
      source: station(query.origin),
      destination: station(query.destination),
      outboundDepartureDate: dayRange(query.departDate, janela ? fimDaJanela : query.departDate),
    };
    if (roundTrip) itinerary.inboundDepartureDate = dayRange(query.returnDate!);

    const variables = {
      search: {
        itinerary,
        passengers: { adults: query.adults, children: 0, infants: 0 },
        cabinClass: { cabinClass: 'ECONOMY', applyMixedClasses: false },
      },
      filter: {
        limit: janela ? LIMITE_JANELA : LIMITE_DIA,
        // Filtra no servidor tambem, para nao trazer resultado que seria descartado depois.
        ...(query.maxStops !== undefined ? { maxStopsCount: query.maxStops } : {}),
      },
      options: { partner: PARTNER, currency: 'brl', storeSearch: false },
    };

    const feature = roundTrip ? 'SearchReturnItinerariesQuery' : 'SearchOnewayItinerariesQuery';

    let body: any;
    try {
      body = await fetchJson(`${ENDPOINT}?featureName=${feature}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': UA,
          Origin: 'https://www.kiwi.com',
          Referer: 'https://www.kiwi.com/',
        },
        body: JSON.stringify({ query: roundTrip ? RETURN_QUERY : ONEWAY_QUERY, variables }),
        timeoutMs: 45_000,
      });
    } catch (err) {
      throw new ProviderError((err as Error).message, 'kiwi');
    }

    if (body?.errors?.length) {
      // Erro de schema quase sempre significa que a Kiwi mudou a API.
      throw new ProviderError(
        `GraphQL recusou a consulta (a API da Kiwi pode ter mudado): ${body.errors[0]?.message}`,
        'kiwi',
      );
    }

    const result = roundTrip ? body?.data?.returnItineraries : body?.data?.onewayItineraries;

    if (result?.__typename === 'AppError') {
      throw new ProviderError(`${result.code}: ${result.message}`, 'kiwi');
    }

    const itineraries: any[] = result?.itineraries ?? [];

    return itineraries
      .filter((it) => it?.price?.amount)
      .map<Offer>((it) => {
        const outSegments = segmentsOf(roundTrip ? it.outbound : it.sector);
        const inSegments = roundTrip ? segmentsOf(it.inbound) : [];
        const checked = it.bagsInfo?.includedCheckedBags;

        return {
          // O preco ja vem total para todos os passageiros.
          price: Number(it.price.amount),
          currency: (it.price.currency?.code || 'BRL').toUpperCase(),
          airline: carriersOf(outSegments),
          cabin: it.cabinClasses?.[0] ?? 'ECONOMY',
          checkedBags: typeof checked === 'number' ? checked : null,
          stopsOut: outSegments.length ? outSegments.length - 1 : null,
          stopsRet: inSegments.length ? inSegments.length - 1 : null,
          departAt: outSegments[0]?.source?.localTime ?? null,
          returnAt: inSegments[0]?.source?.localTime ?? null,
          link: bookingLink(it),
          raw: it,
        };
      });
  },
};
