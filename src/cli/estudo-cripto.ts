/**
 * O historico de quedas e recuperacoes de cada cripto do radar, e como a
 * grade (comprar na queda em partes, vender na alta) teria se saido contra o
 * CDI — incluindo a ideia de operar todo dia.
 *
 *   npm run estudo-cripto            # todas as moedas do radar
 *   npm run estudo-cripto -- BTC ETH
 */
import { config } from '../config';
import { closeDatabase, initDatabase } from '../db/data-source';
import { criptoService, validarGrade } from '../services/cripto.service';

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
const pct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1).replace('.', ',')}%`;

async function main() {
  const pedidas = process.argv.slice(2).map((m) => m.toUpperCase());
  const moedas = pedidas.length ? pedidas : config.cripto.moedas;

  await initDatabase();
  await criptoService.sincronizar();

  const c = config.cripto.custos;
  console.log(`\nTaxa por perna ${c.spreadPct}% · capital R$ 100 · recuperacao conta em ${config.cripto.horizonteDias} dias\n`);

  for (const moeda of moedas) {
    try {
      const e = await criptoService.estudo(moeda);
      console.log(`=== ${moeda}  (${e.inicio} a ${e.fim})`);
      console.log('  quedas em 7 dias            vezes   recuperou    em alta: recuperou');
      for (const q of e.quedas) {
        const taxa = q.ocorrencias ? Math.round((q.recuperou / q.ocorrencias) * 100) : 0;
        const taxaAlta = q.ocorrenciasEmAlta ? Math.round((q.recuperouEmAlta / q.ocorrenciasEmAlta) * 100) : 0;
        console.log(
          `  de ${String(q.quedaPct).padStart(2)}% ou mais          ${String(q.ocorrencias).padStart(5)}   ${String(taxa).padStart(3)}%` +
            `          ${String(q.recuperouEmAlta).padStart(3)}/${String(q.ocorrenciasEmAlta).padEnd(3)} ${taxaAlta}%`,
        );
      }
      const linha = (nome: string, r: typeof e.configurada) =>
        r &&
        console.log(
          `  ${nome.padEnd(26)} ${brl(r.final).padStart(12)} ${pct(r.retornoPct).padStart(9)}  CDI ${brl(r.cdiFinal)}  ` +
            `pior queda ${pct(-r.piorQuedaPct)}  ${r.compras} compras`,
        );
      linha('grade configurada', e.configurada);
      linha('todo dia (1% / 1%)', e.diario);
      const m = e.melhores[0];
      if (m) {
        const p = m.parametros;
        linha(`melhor: queda ${p.quedaPct}% alvo ${p.alvoPct}% ${p.partes}p${p.filtroTendencia ? ' +tend' : ''}`, m.resultado);
      }
      if (e.configurada) {
        console.log(`  segurar do inicio ao fim   ${brl(e.configurada.segurarFinal).padStart(12)}`);
        const meses = e.configurada.meses.map((x) => x.retornoPct);
        if (meses.length) {
          const positivos = meses.filter((v) => v > 0).length;
          console.log(
            `  meses: ${positivos}/${meses.length} positivos · melhor ${pct(Math.max(...meses))} · pior ${pct(Math.min(...meses))}` +
              ` · meses com +50%: ${meses.filter((v) => v >= 50).length}`,
          );
        }
      }
      console.log('');
    } catch (err) {
      console.log(`=== ${moeda}: ${(err as Error).message}\n`);
    }
  }

  const corte = '2024-07-01';
  const v = await validarGrade(moedas, corte);
  console.log(`=== Teste fora da amostra: escolha com dados ate ${corte}, resultado depois dele`);
  if (v.escolhida) {
    const p = v.escolhida;
    console.log(
      `  escolhida entre ${v.combinacoesTestadas}: queda ${p.quedaPct}% · alvo ${p.alvoPct}% · ${p.partes} parte(s)` +
        (p.filtroTendencia ? ' · so em tendencia de alta' : ''),
    );
    let ganhou = 0;
    for (const t of v.teste) {
      if (t.final > t.cdiFinal) ganhou++;
      console.log(
        `  ${t.moeda.padEnd(5)} ${brl(t.final).padStart(10)}  CDI ${brl(t.cdiFinal)}  ` +
          `segurar ${brl(t.segurarFinal).padStart(10)}  pior queda ${pct(-t.piorQuedaPct)}`,
      );
    }
    console.log(`  ganhou do CDI em ${ganhou} de ${v.teste.length} moedas`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => void closeDatabase());
