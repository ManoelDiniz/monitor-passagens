/**
 * Compara o mesmo trecho em todos os provedores configurados, lado a lado.
 * Serve para conferir se uma fonte esta trazendo preco coerente.
 *
 *   npx tsx src/cli/comparar.ts FOR SSA 2026-10-08
 *   npx tsx src/cli/comparar.ts FOR GRU 2026-12-15 2026-12-22
 */
import { activeProviders } from '../providers';

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

async function main() {
  const [origin, destination, departDate, returnDate] = process.argv.slice(2);

  if (!origin || !destination || !departDate) {
    console.error('uso: npx tsx src/cli/comparar.ts ORIGEM DESTINO AAAA-MM-DD [AAAA-MM-DD]');
    process.exit(1);
  }

  const query = {
    origin: origin.toUpperCase(),
    destination: destination.toUpperCase(),
    departDate,
    returnDate: returnDate ?? null,
    adults: 1,
    maxStops: 2,
  };

  const trecho = returnDate
    ? `${query.origin}->${query.destination} ${departDate} / volta ${returnDate}`
    : `${query.origin}->${query.destination} ${departDate} (só ida)`;
  console.log(`${trecho}\n`);

  for (const provider of activeProviders()) {
    const started = Date.now();
    try {
      const offers = await provider.search(query);
      const elapsed = ((Date.now() - started) / 1000).toFixed(1);

      if (offers.length === 0) {
        console.log(`${provider.name.padEnd(14)} nenhuma oferta (${elapsed}s)\n`);
        continue;
      }

      const sorted = [...offers].sort((a, b) => a.price - b.price);
      const cheapest = sorted[0];
      console.log(
        `${provider.name.padEnd(14)} ${brl(cheapest.price).padStart(10)}` +
          `  ${offers.length} ofertas, ${elapsed}s`,
      );

      for (const o of sorted.slice(0, 3)) {
        const bag = o.checkedBags === null ? 'bagagem n/d' : `${o.checkedBags} bagagem`;
        const stops = o.stopsOut === 0 ? 'direto' : `${o.stopsOut} conexão(ões)`;
        console.log(
          `${''.padEnd(14)}   ${brl(o.price).padStart(9)}  ${(o.airline ?? '?').padEnd(18)}` +
            ` ${stops.padEnd(14)} ${bag}`,
        );
      }
      console.log();
    } catch (err) {
      console.log(`${provider.name.padEnd(14)} FALHOU — ${(err as Error).message}\n`);
    }
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
