import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  brl,
  conexoes,
  desde,
  dia,
  diaCurto,
  motivos,
  proxima,
  tamanho,
} from '../web/src/lib/format';

/** Cria um ISO deslocado no passado, para testar o tempo relativo. */
const atras = (minutos: number) => new Date(Date.now() - minutos * 60_000).toISOString();

describe('brl', () => {
  it('formata em real sem centavos', () => {
    // O pt-BR separa o simbolo com espaco nao quebravel, entao \s no lugar de " ".
    assert.match(brl(1234), /^R\$\s1\.234$/);
  });

  it('mostra travessao quando nao ha valor', () => {
    assert.equal(brl(null), '—');
    assert.equal(brl(undefined), '—');
  });

  it('nao confunde zero com ausencia', () => {
    assert.notEqual(brl(0), '—');
  });
});

describe('dia', () => {
  it('escreve a data por extenso curto sem depender do locale', () => {
    assert.equal(dia('2026-10-08'), '08 out 2026');
    assert.equal(diaCurto('2026-01-31'), '31 jan');
  });

  it('mostra travessao quando nao ha data', () => {
    assert.equal(dia(null), '—');
  });
});

describe('desde', () => {
  it('descreve o tempo decorrido em passos legiveis', () => {
    assert.equal(desde(atras(0)), 'agora');
    assert.equal(desde(atras(5)), 'há 5 min');
    assert.equal(desde(atras(120)), 'há 2 h');
    assert.equal(desde(atras(60 * 24)), 'ontem');
    assert.equal(desde(atras(60 * 24 * 3)), 'há 3 dias');
  });

  it('diz "nunca" quando nunca aconteceu', () => {
    assert.equal(desde(null), 'nunca');
  });
});

describe('conexoes', () => {
  it('distingue direto, singular e plural', () => {
    assert.equal(conexoes(0), 'voo direto');
    assert.equal(conexoes(1), '1 conexão');
    assert.equal(conexoes(2), '2 conexões');
  });

  it('avisa quando o provedor nao informou', () => {
    assert.equal(conexoes(null), 'conexões não informadas');
  });
});

describe('proxima', () => {
  it('acentua o texto que o agendador manda sem acento', () => {
    assert.equal(proxima('hoje as 12:00'), 'hoje às 12:00');
    assert.equal(proxima('amanha as 08:00'), 'amanhã às 08:00');
  });

  it('mostra travessao quando nao ha proxima rodada', () => {
    assert.equal(proxima(null), '—');
  });
});

describe('motivos', () => {
  it('traduz cada motivo gravado no alerta', () => {
    assert.deepEqual(motivos('menor_preco_historico,queda'), [
      'Menor preço já visto',
      'Queda de preço',
    ]);
  });

  it('nao quebra com motivo desconhecido', () => {
    assert.deepEqual(motivos('motivo_novo'), ['motivo novo']);
  });
});

describe('tamanho', () => {
  it('sobe de escala e usa virgula decimal', () => {
    assert.equal(tamanho(72_678_154), '69,3 MB');
    assert.equal(tamanho(2_500), '2,4 KB');
  });

  it('nao poe casa decimal em bytes crus', () => {
    assert.equal(tamanho(512), '512 B');
  });

  it('mostra travessao quando nao ha valor', () => {
    assert.equal(tamanho(null), '—');
  });
});
