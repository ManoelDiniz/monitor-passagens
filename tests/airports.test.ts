import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AEROPORTOS,
  ESTADOS,
  aeroporto,
  buscarAeroportos,
  cidadeDe,
} from '../web/src/lib/airports';

describe('catalogo', () => {
  it('nao repete sigla', () => {
    const vistos = new Set<string>();
    const repetidos: string[] = [];

    for (const a of AEROPORTOS) {
      if (vistos.has(a.iata)) repetidos.push(a.iata);
      vistos.add(a.iata);
    }

    assert.deepEqual(repetidos, [], `sigla duplicada: ${repetidos.join(', ')}`);
  });

  it('so tem sigla IATA de tres letras maiusculas', () => {
    const fora = AEROPORTOS.filter((a) => !/^[A-Z]{3}$/.test(a.iata));
    assert.deepEqual(fora, []);
  });

  it('so usa UF conhecida', () => {
    const fora = AEROPORTOS.filter((a) => !(a.uf in ESTADOS));
    assert.deepEqual(fora, []);
  });

  it('cobre as 27 unidades da federacao', () => {
    assert.equal(Object.keys(ESTADOS).length, 27);

    const semAeroporto = Object.keys(ESTADOS).filter(
      (uf) => !AEROPORTOS.some((a) => a.uf === uf),
    );
    assert.deepEqual(semAeroporto, []);
  });

  it('traz as rotas que ja estao sendo monitoradas', () => {
    for (const iata of ['FOR', 'BEL', 'BSB', 'SSA', 'GRU']) {
      assert.ok(aeroporto(iata), `${iata} deveria estar no catalogo`);
    }
  });
});

describe('busca', () => {
  it('acha pela sigla, em qualquer caixa', () => {
    assert.equal(buscarAeroportos('for')[0].iata, 'FOR');
    assert.equal(buscarAeroportos('FOR')[0].iata, 'FOR');
  });

  it('acha pelo nome da cidade', () => {
    assert.equal(buscarAeroportos('fortaleza')[0].iata, 'FOR');
    assert.equal(buscarAeroportos('belem')[0].iata, 'BEL');
  });

  it('ignora acento', () => {
    assert.equal(buscarAeroportos('belem')[0].iata, buscarAeroportos('belém')[0].iata);
    assert.equal(buscarAeroportos('maceio')[0].iata, 'MCZ');
  });

  it('acha pelo estado, por nome ou por sigla', () => {
    const porNome = buscarAeroportos('ceara');
    const porSigla = buscarAeroportos('CE');

    assert.ok(porNome.every((a) => a.uf === 'CE'));
    assert.ok(porSigla.some((a) => a.iata === 'FOR'));
  });

  it('prefere o acerto direto ao parcial', () => {
    // "sal" comeca Salvador e aparece no meio de "Salgado Filho" (POA).
    const posicao = (iata: string) => buscarAeroportos('sal').findIndex((a) => a.iata === iata);
    assert.ok(posicao('SSA') < posicao('POA'));
  });

  it('desempata pelo aeroporto mais movimentado', () => {
    // Salvador e Salinopolis comecam igual; quem viaja quer Salvador.
    assert.equal(buscarAeroportos('sal')[0].iata, 'SSA');
    assert.equal(buscarAeroportos('porto a')[0].iata, 'POA');
    assert.equal(buscarAeroportos('sao paulo')[0].iata, 'GRU');
  });

  it('sugere os principais quando nao ha o que buscar', () => {
    const vazio = buscarAeroportos('');
    assert.ok(vazio.length > 0);
    assert.ok(vazio.some((a) => a.iata === 'GRU'));
  });

  it('devolve nada quando o termo nao existe', () => {
    assert.deepEqual(buscarAeroportos('xyzabc'), []);
  });

  it('respeita o limite pedido', () => {
    assert.ok(buscarAeroportos('a', 3).length <= 3);
  });
});

describe('cidadeDe', () => {
  it('descreve a sigla conhecida', () => {
    assert.equal(cidadeDe('FOR'), 'Fortaleza · CE');
  });

  it('devolve a propria sigla quando nao conhece', () => {
    assert.equal(cidadeDe('ZZZ'), 'ZZZ');
    assert.equal(cidadeDe(null), '');
  });
});
