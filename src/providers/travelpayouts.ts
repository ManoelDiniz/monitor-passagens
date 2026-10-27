import { config } from '../config';
import { fetchJson, Offer, PriceProvider, ProviderError, SearchQuery } from './types';

/**
 * Travelpayouts / Aviasales Data API v3.
 * Retorna precos vistos em buscas recentes (cache), nao cotacao ao vivo.
 * Boa cobertura de rotas domesticas brasileiras.
 */
export const travelpayouts: PriceProvider = {
  name: 'travelpayouts',

  isConfigured() {
    return Boolean(config.travelpayouts.token);
  },

  async search(query: SearchQuery): Promise<Offer[]> {
    const params = new URLSearchParams({
      origin: query.origin,
      destination: query.destination,
      departure_at: query.departDate,
      currency: 'brl',
      limit: '30',
      sorting: 'price',
      one_way: query.returnDate ? 'false' : 'true',
      token: config.travelpayouts.token,
    });
    if (query.returnDate) params.set('return_at', query.returnDate);

    const url = `https://api.travelpayouts.com/aviasales/v3/prices_for_dates?${params}`;

    let body: any;
    try {
      body = await fetchJson(url);
    } catch (err) {
      throw new ProviderError((err as Error).message, 'travelpayouts');
    }

    if (body?.success === false) {
      throw new ProviderError(body?.error || 'resposta sem sucesso', 'travelpayouts');
    }

    const rows: any[] = Array.isArray(body?.data) ? body.data : [];

    return rows
      .filter((r) => typeof r?.price === 'number')
      .map<Offer>((r) => ({
        // A API cobra por 1 passageiro; multiplicamos para comparar com o limite da rota.
        price: r.price * query.adults,
        currency: (body?.currency || 'BRL').toUpperCase(),
        airline: r.airline ?? null,
        cabin: 'ECONOMY',
        checkedBags: null, // provedor nao informa
        stopsOut: typeof r.transfers === 'number' ? r.transfers : null,
        stopsRet: typeof r.return_transfers === 'number' ? r.return_transfers : null,
        departAt: r.departure_at ?? null,
        returnAt: r.return_at ?? null,
        link: r.link ? `https://www.aviasales.com${r.link}` : null,
        raw: r,
      }));
  },
};
