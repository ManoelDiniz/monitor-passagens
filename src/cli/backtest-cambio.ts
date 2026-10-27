/**
 * Testa a estrategia de cambio no historico, com os custos do ativo, e compara
 * com deixar o mesmo dinheiro no CDI.
 *
 *   npm run backtest-cambio                 # DOLA11, R$ 100
 *   npm run backtest-cambio -- USD 500
 */
import { closeDatabase, initDatabase } from '../db/data-source';
import { cambioService } from '../services/cambio.service';

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
const pct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2).replace('.', ',')}%`;

async function main() {
  const [ativo = 'DOLA11', capitalRaw = '100'] = process.argv.slice(2);
  const capital = Number(capitalRaw) > 0 ? Number(capitalRaw) : 100;

  await initDatabase();
  await cambioService.sincronizar();
  const r = await cambioService.backtest(ativo, capital);

  console.log(`\nBacktest ${ativo.toUpperCase()} — ${r.inicio} a ${r.fim}, capital ${brl(capital)}\n`);
  for (const op of r.operacoes) {
    console.log(
      `${op.dia}  ${op.tipo.padEnd(6)}  a ${op.taxa.toFixed(4)}  ${brl(op.brl).padStart(12)}  ${op.motivo}`,
    );
  }
  if (r.operacoes.length === 0) console.log('(nenhuma operacao no periodo)');

  console.log('');
  console.log(`estrategia      ${brl(r.final).padStart(12)}  ${pct(r.retornoPct)}`);
  console.log(`CDI             ${brl(r.cdiFinal).padStart(12)}  ${pct(r.cdiRetornoPct)}`);
  console.log(`comprar e segurar ${brl(r.segurarFinal).padStart(10)}  ${pct((r.segurarFinal / capital - 1) * 100)}`);
  console.log(`pior queda      ${pct(-r.piorQuedaPct).padStart(12)}`);
  console.log(
    r.final > r.cdiFinal
      ? '\n-> a estrategia ganhou do CDI neste periodo.'
      : '\n-> o CDI ganhou. Ajuste os parametros antes de arriscar dinheiro.',
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => void closeDatabase());
