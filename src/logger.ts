import * as fs from 'fs';
import * as path from 'path';
import { config } from './config';

type Level = 'INFO' | 'WARN' | 'ERROR';

/**
 * O node:test marca os processos de teste. Sem isso, um teste que exercita a
 * suspensao de uma fonte grava "fonte kiwi suspensa apos 3 falhas: HTTP 403"
 * no log de verdade — e quem for investigar um problema amanha vai perseguir
 * uma queda que nunca existiu.
 */
const emTeste = process.env.NODE_TEST_CONTEXT !== undefined;

const stream = emTeste
  ? null
  : (fs.mkdirSync(path.dirname(config.paths.logs), { recursive: true }),
    fs.createWriteStream(config.paths.logs, { flags: 'a' }));

function write(level: Level, msg: string, extra?: unknown) {
  const stamp = new Date().toISOString();
  const detail = extra === undefined ? '' : ` ${safeStringify(extra)}`;
  const line = `${stamp} [${level}] ${msg}${detail}`;

  if (!stream) return;

  stream.write(line + '\n');
  if (level === 'ERROR') console.error(line);
  else console.log(line);
}

function safeStringify(value: unknown): string {
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export const log = {
  info: (msg: string, extra?: unknown) => write('INFO', msg, extra),
  warn: (msg: string, extra?: unknown) => write('WARN', msg, extra),
  error: (msg: string, extra?: unknown) => write('ERROR', msg, extra),
};
