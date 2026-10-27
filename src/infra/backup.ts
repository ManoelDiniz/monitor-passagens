import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config';
import { log } from '../logger';

/**
 * Copia de seguranca do banco.
 *
 * O historico de precos e o ativo do projeto: ele nao se refaz. Uma serie de
 * meses so existe porque o monitor estava no ar naquelas horas — perder o banco
 * e perder o passado, nao um arquivo. Por isso o dump roda sozinho todo dia.
 *
 * Usa mysqldump em vez de copiar o diretorio de dados porque copia de arquivo
 * de InnoDB com o servidor no ar sai corrompida.
 */

export interface Backup {
  arquivo: string;
  criadoEm: string;
  bytes: number;
}

/** Instalacao padrao do MySQL no Windows, quando o binario nao esta no PATH. */
function candidatos(): string[] {
  const lista: string[] = [];
  if (config.backup.mysqldump) lista.push(config.backup.mysqldump);

  for (const base of ['C:\\Program Files\\MySQL', 'C:\\Program Files (x86)\\MySQL']) {
    if (!fs.existsSync(base)) continue;
    for (const dir of fs.readdirSync(base)) {
      lista.push(path.join(base, dir, 'bin', 'mysqldump.exe'));
    }
  }

  // Ultimo recurso: deixa o PATH resolver.
  lista.push('mysqldump');
  return lista;
}

function acharMysqldump(): string {
  for (const caminho of candidatos()) {
    if (caminho === 'mysqldump' || fs.existsSync(caminho)) return caminho;
  }
  throw new Error(
    'mysqldump nao encontrado. Instale o MySQL Server ou aponte MYSQLDUMP_PATH no .env',
  );
}

/** monitor-2026-08-05-1432.sql — ordena sozinho por nome. */
function nomeDoArquivo(quando: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const d = `${quando.getFullYear()}-${p(quando.getMonth() + 1)}-${p(quando.getDate())}`;
  const h = `${p(quando.getHours())}${p(quando.getMinutes())}`;
  return `${config.database.name}-${d}-${h}.sql`;
}

const ehDump = (nome: string) => nome.startsWith(`${config.database.name}-`) && nome.endsWith('.sql');

export class BackupService {
  /** Dumps existentes, do mais novo para o mais antigo. */
  listar(): Backup[] {
    if (!fs.existsSync(config.backup.dir)) return [];

    return fs
      .readdirSync(config.backup.dir)
      .filter(ehDump)
      .map((nome) => {
        const completo = path.join(config.backup.dir, nome);
        const stat = fs.statSync(completo);
        return { arquivo: completo, criadoEm: stat.mtime.toISOString(), bytes: stat.size };
      })
      .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  }

  ultimo(): Backup | null {
    return this.listar()[0] ?? null;
  }

  /**
   * Um dump truncado e pior que nenhum: parece que existe copia. mysqldump
   * fecha o arquivo com "Dump completed on ..." — sem essa linha, o processo
   * morreu no meio e o arquivo nao serve.
   */
  private conferir(arquivo: string): void {
    const stat = fs.statSync(arquivo);
    if (stat.size < 1024) throw new Error(`dump saiu vazio (${stat.size} bytes)`);

    const fim = Buffer.alloc(512);
    const fd = fs.openSync(arquivo, 'r');
    try {
      const lidos = fs.readSync(fd, fim, 0, 512, Math.max(0, stat.size - 512));
      if (!fim.subarray(0, lidos).toString('utf8').includes('Dump completed')) {
        throw new Error('dump incompleto: falta a marca final do mysqldump');
      }
    } finally {
      fs.closeSync(fd);
    }
  }

  /** Mantem os N mais recentes; o resto sai. */
  private rotacionar(): number {
    const sobrando = this.listar().slice(config.backup.keep);
    for (const b of sobrando) fs.rmSync(b.arquivo, { force: true });
    return sobrando.length;
  }

  async run(motivo: string): Promise<Backup> {
    fs.mkdirSync(config.backup.dir, { recursive: true });

    const binario = acharMysqldump();
    const destino = path.join(config.backup.dir, nomeDoArquivo(new Date()));
    const inicio = Date.now();

    await new Promise<void>((resolve, reject) => {
      const filho = spawn(
        binario,
        [
          `--host=${config.database.host}`,
          `--port=${config.database.port}`,
          `--user=${config.database.user}`,
          // Consistente sem travar as consultas do monitor durante o dump.
          '--single-transaction',
          '--no-tablespaces',
          '--databases',
          config.database.name,
          `--result-file=${destino}`,
        ],
        {
          // Pela variavel de ambiente: senha em linha de comando fica visivel
          // na lista de processos e gera aviso do proprio mysqldump.
          env: { ...process.env, MYSQL_PWD: config.database.password },
          windowsHide: true,
        },
      );

      let erro = '';
      filho.stderr.on('data', (d: Buffer) => (erro += d.toString()));
      filho.on('error', reject);
      filho.on('close', (codigo) => {
        if (codigo === 0) resolve();
        else reject(new Error(`mysqldump saiu com codigo ${codigo}: ${erro.trim() || 'sem detalhe'}`));
      });
    });

    this.conferir(destino);
    const removidos = this.rotacionar();

    const stat = fs.statSync(destino);
    const mb = (stat.size / 1024 / 1024).toFixed(1);
    log.info(
      `backup ${motivo}: ${path.basename(destino)} (${mb} MB em ${Date.now() - inicio}ms)` +
        (removidos ? `, ${removidos} antigo(s) removido(s)` : ''),
    );

    return { arquivo: destino, criadoEm: stat.mtime.toISOString(), bytes: stat.size };
  }
}

export const backupService = new BackupService();
