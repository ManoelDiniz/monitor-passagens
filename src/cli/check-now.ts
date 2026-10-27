/**
 * Consulta todas as rotas ativas uma unica vez e encerra.
 * Util para testar a configuracao:  npm run check-now
 */
import { closeDatabase, initDatabase } from '../db/data-source';
import { activeProviders } from '../providers';
import { brl, monitorService } from '../services/monitor.service';

async function main() {
  await initDatabase();

  const providers = activeProviders();
  if (providers.length === 0) {
    console.error(
      'Nenhum provedor configurado. Copie .env.example para .env e preencha ' +
        'TRAVELPAYOUTS_TOKEN ou AMADEUS_CLIENT_ID/AMADEUS_CLIENT_SECRET.',
    );
    process.exit(1);
  }

  console.log(`Provedores: ${providers.map((p) => p.name).join(', ')}\n`);
  const results = await monitorService.checkAllRoutes();

  if (results.length === 0) {
    console.log('Nenhuma rota ativa cadastrada. Abra o painel e cadastre uma.');
    return;
  }

  console.log('\n--- Resumo ---');
  for (const r of results) {
    if (r.status === 'ok' && r.bestPrice !== undefined) {
      const before = r.previousBest !== null && r.previousBest !== undefined
        ? ` (anterior ${brl(r.previousBest)})`
        : '';
      console.log(`rota ${r.routeId}: ${brl(r.bestPrice)}${before} via ${r.provider}`);
    } else if (r.status === 'empty') {
      console.log(`rota ${r.routeId}: nenhuma oferta atendeu aos filtros`);
    } else {
      console.log(`rota ${r.routeId}: ERRO — ${r.error}`);
    }
  }
}

main().then(
  async () => {
    await closeDatabase();
    process.exit(0);
  },
  async (err) => {
    console.error(err);
    await closeDatabase();
    process.exit(1);
  },
);
