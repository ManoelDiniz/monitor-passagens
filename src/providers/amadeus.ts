import { config } from '../config';
import { fetchJson, Offer, PriceProvider, ProviderError, SearchQuery } from './types';

let token: { value: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (token && Date.now() < token.expiresAt) return token.value;

  const res = await fetch(`${config.amadeus.baseUrl}/v1/security/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: config.amadeus.clientId,
      client_secret: config.amadeus.clientSecret,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new ProviderError(`falha na autenticacao: HTTP ${res.status} ${body.slice(0, 200)}`, 'amadeus');
  }

  const json: any = await res.json();
  token = {
    value: json.access_token,
    // 60s de folga para nao usar um token que expira em transito
    expiresAt: Date.now() + Math.max(0, (json.expires_in ?? 1800) - 60) * 1000,
  };
  return token.value;
}

/** Conta as bagagens despachadas incluidas no primeiro trecho da tarifa. */
function checkedBagsOf(offer: any): number | null {
  const fare = offer?.travelerPricings?.[0]?.fareDetailsBySegment?.[0];
  const bags = fare?.includedCheckedBags;
  if (!bags) return null;
  if (typeof bags.quantity === 'number') return bags.quantity;
  // Algumas tarifas informam peso em vez de quantidade.
  if (typeof bags.weight === 'number') return bags.weight > 0 ? 1 : 0;
  return null;
}

/**
 * Amadeus Self-Service — Flight Offers Search.
 * Precos de GDS: mais precisos, mas nao cobrem tarifas exclusivas
 * dos sites das companhias low-cost.
 */
export const amadeus: PriceProvider = {
  name: 'amadeus',

  isConfigured() {
    return Boolean(config.amadeus.clientId && config.amadeus.clientSecret);
  },

  async search(query: SearchQuery): Promise<Offer[]> {
    const params = new URLSearchParams({
      originLocationCode: query.origin,
      destinationLocationCode: query.destination,
      departureDate: query.departDate,
      adults: String(query.adults),
      currencyCode: 'BRL',
      max: '30',
    });
    if (query.returnDate) params.set('returnDate', query.returnDate);

    let body: any;
    try {
      const accessToken = await getToken();
      body = await fetchJson(`${config.amadeus.baseUrl}/v2/shopping/flight-offers?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      throw new ProviderError((err as Error).message, 'amadeus');
    }

    const rows: any[] = Array.isArray(body?.data) ? body.data : [];

    return rows
      .filter((r) => r?.price?.total)
      .map<Offer>((r) => {
        const out = r.itineraries?.[0];
        const ret = r.itineraries?.[1];
        return {
          price: Number(r.price.total),
          currency: r.price.currency || 'BRL',
          airline: r.validatingAirlineCodes?.[0] ?? null,
          cabin: r.travelerPricings?.[0]?.fareDetailsBySegment?.[0]?.cabin ?? null,
          checkedBags: checkedBagsOf(r),
          stopsOut: out?.segments ? out.segments.length - 1 : null,
          stopsRet: ret?.segments ? ret.segments.length - 1 : null,
          departAt: out?.segments?.[0]?.departure?.at ?? null,
          returnAt: ret?.segments?.[0]?.departure?.at ?? null,
          link: null, // Amadeus nao devolve deep link de compra
          raw: r,
        };
      });
  },
};
