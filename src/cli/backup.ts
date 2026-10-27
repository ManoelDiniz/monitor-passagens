/**
 * Gera uma copia do banco na hora e lista as que existem:  npm run backup
 *
 * Nao precisa do banco conectado pelo TypeORM — quem fala com o MySQL aqui e o
 * mysqldump, entao o comando funciona mesmo com o monitor parado.
 */
import * as path from 'path';
import { config } from '../config';
import { backupService } from '../infra/backup';

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

async function main() {
  const feito = await backupService.run('manual');
  console.log(`\nBackup gravado em ${feito.arquivo} (${mb(feito.bytes)})`);

  const todos = backupService.listar();
  console.log(`\nCopias guardadas (mantendo ${config.backup.keep}):`);
  for (const b of todos) {
    console.log(`  ${path.basename(b.arquivo).padEnd(34)} ${mb(b.bytes).padStart(9)}  ${b.criadoEm}`);
  }

  console.log(
    `\nPara restaurar:  mysql -u ${config.database.user} -p < "${feito.arquivo}"\n` +
      'O dump recria o banco inteiro, entao restaurar por cima descarta o que estiver la.',
  );
}

main().then(
  () => process.exit(0),
  (err: unknown) => {
    console.error(`\nBackup falhou: ${(err as Error).message}`);
    process.exit(1);
  },
);
