import type { ValueTransformer } from 'typeorm';

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * DATE do MySQL <-> "YYYY-MM-DD".
 *
 * Data de voo e dia de calendario, nao instante: passar por Date arrisca trocar
 * o dia conforme o fuso. O driver ja devolve string (dateStrings no DataSource);
 * o ramo de Date existe so como rede de seguranca e le em UTC, coerente com o
 * timezone "Z" da conexao.
 */
export const dateOnly: ValueTransformer = {
  to: (value: string | null) => value,
  from: (value: Date | string | null) => {
    if (value == null) return null;
    if (typeof value === 'string') return value.slice(0, 10);
    return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
  },
};

/**
 * DECIMAL volta como string no driver do MySQL, para nao perder precisao.
 * Preco aqui entra em conta e comparacao, entao vira numero na fronteira.
 */
export const decimalToNumber: ValueTransformer = {
  to: (value: number | null) => value,
  from: (value: string | number | null) => (value == null ? null : Number(value)),
};
