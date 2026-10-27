/**
 * Poda as ofertas antigas e devolve o espaco ao disco:  npm run compactar
 *
 * Consultas com mais de OFFERS_RETENTION_DAYS ficam apenas com a melhor oferta.
 * A serie de precos do painel e o menor preco de cada consulta — que e
 * justamente a linha preservada —, entao nenhum numero da tela muda.
 *
 *   npm run compactar -- --dias 7    poda mais fundo nesta execucao
 *   npm run compactar -- --simular   so mostra o que seria apagado
 */
import { config } from '../config';
import { closeDatabase, initDatabase } from '../db/data-source';
import { offerRepository } from '../repositories/offer.repository';

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

function argumento(nome: string): string | undefined {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  await initDatabase();

  const dias = Number(argumento('dias') ?? config.retention.offerDays);
  const simular = process.argv.includes('--simular');

  if (!Number.isFinite(dias) || dias <= 0) {
    console.error('Nada a fazer: a retencao esta desligada (OFFERS_RETENTION_DAYS=0).');
    return;
  }

  const antes = await offerRepository.tamanho();
  console.log(`Antes:  ${antes.linhas} ofertas em ${mb(antes.bytes)}`);
  console.log(`Regra:  consultas com mais de ${dias} dias ficam so com a melhor oferta\n`);

  if (simular) {
    const alvo = await offerRepository.contarPodaveis(dias);
    console.log(`Simulacao: ${alvo} oferta(s) seriam apagadas. Nada foi alterado.`);
    return;
  }

  const apagadas = await offerRepository.pruneOld(dias);
  console.log(`${apagadas} oferta(s) apagadas. Reconstruindo a tabela...`);

  await offerRepository.compactarTabela();

  const depois = await offerRepository.tamanho();
  const ganho = antes.bytes - depois.bytes;
  console.log(`\nDepois: ${depois.linhas} ofertas em ${mb(depois.bytes)}`);
  console.log(ganho > 0 ? `Liberado: ${mb(ganho)}` : 'Tamanho inalterado.');
}

main().then(
  async () => {
    await closeDatabase();
    process.exit(0);
  },
  async (err: unknown) => {
    console.error(err);
    await closeDatabase();
    process.exit(1);
  },
);
