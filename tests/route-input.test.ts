import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ValidationError } from '../src/domain/errors';
import {
  MAX_WINDOW_DAYS,
  affectsSearch,
  parseRouteCreate,
  parseRouteUpdate,
  type RouteFields,
} from '../src/domain/route-input';

const rotaBase: RouteFields = {
  origin: 'FOR',
  destination: 'GRU',
  depart_date: '2026-10-08',
  return_date: '2026-10-15',
  depart_window_days: 0,
  adults: 1,
  price_limit: 900,
  max_stops: 2,
  require_checked_bag: 0,
  notes: null,
};

/** Roda o parser e devolve as mensagens de erro, falhando se ele aceitar. */
function problemasAoCriar(body: unknown): string[] {
  try {
    parseRouteCreate(body);
  } catch (err) {
    assert.ok(err instanceof ValidationError, 'deveria lancar ValidationError');
    return err.problems;
  }
  assert.fail('o parser aceitou uma entrada invalida');
}

describe('parseRouteCreate', () => {
  it('normaliza codigo IATA para maiusculo e sem espaco', () => {
    const rota = parseRouteCreate({ ...rotaBase, origin: ' for ', destination: 'gru' });
    assert.equal(rota.origin, 'FOR');
    assert.equal(rota.destination, 'GRU');
  });

  it('trata campos vazios como ausentes, nao como zero', () => {
    const rota = parseRouteCreate({ ...rotaBase, price_limit: '', return_date: '', notes: '' });
    assert.equal(rota.price_limit, null);
    assert.equal(rota.return_date, null);
    assert.equal(rota.notes, null);
  });

  it('aplica os padroes de passageiros e conexoes quando nao vem nada', () => {
    const rota = parseRouteCreate({
      origin: 'FOR',
      destination: 'GRU',
      depart_date: '2026-10-08',
    });
    assert.equal(rota.adults, 1);
    assert.equal(rota.max_stops, 2);
  });

  it('converte bagagem para 0 ou 1', () => {
    assert.equal(parseRouteCreate({ ...rotaBase, require_checked_bag: '1' }).require_checked_bag, 1);
    assert.equal(parseRouteCreate({ ...rotaBase, require_checked_bag: '' }).require_checked_bag, 0);
  });

  it('recusa IATA com tamanho errado', () => {
    assert.match(problemasAoCriar({ ...rotaBase, destination: 'XX' }).join(), /destino deve ser/);
  });

  it('recusa origem igual ao destino', () => {
    const problemas = problemasAoCriar({ ...rotaBase, destination: 'FOR' });
    assert.match(problemas.join(), /nao podem ser iguais/);
  });

  it('recusa volta antes da ida', () => {
    const problemas = problemasAoCriar({ ...rotaBase, return_date: '2026-10-01' });
    assert.match(problemas.join(), /volta nao pode ser antes/);
  });

  it('recusa data fora do formato ISO', () => {
    assert.match(problemasAoCriar({ ...rotaBase, depart_date: '08/10/2026' }).join(), /data de ida/);
  });

  it('assume data fixa quando a flexibilidade nao vem', () => {
    const rota = parseRouteCreate({ origin: 'FOR', destination: 'GRU', depart_date: '2026-10-08' });
    assert.equal(rota.depart_window_days, 0);
  });

  it('aceita flexibilidade dentro do teto', () => {
    assert.equal(parseRouteCreate({ ...rotaBase, depart_window_days: 3 }).depart_window_days, 3);
    assert.equal(
      parseRouteCreate({ ...rotaBase, depart_window_days: MAX_WINDOW_DAYS }).depart_window_days,
      MAX_WINDOW_DAYS,
    );
  });

  it('recusa flexibilidade acima do teto: cada dia e uma consulta a mais', () => {
    const problemas = problemasAoCriar({ ...rotaBase, depart_window_days: MAX_WINDOW_DAYS + 1 });
    assert.match(problemas.join(), /flexibilidade de datas/);
  });

  it('recusa flexibilidade negativa', () => {
    assert.match(
      problemasAoCriar({ ...rotaBase, depart_window_days: -1 }).join(),
      /flexibilidade de datas/,
    );
  });

  it('recusa limite de preco que nao e numero', () => {
    assert.match(problemasAoCriar({ ...rotaBase, price_limit: 'barato' }).join(), /limite de preco/);
  });

  it('junta todos os problemas numa mensagem so', () => {
    const problemas = problemasAoCriar({ origin: 'X', destination: 'Y', depart_date: 'ontem' });
    assert.equal(problemas.length, 3);
  });
});

describe('parseRouteUpdate', () => {
  it('devolve apenas os campos enviados', () => {
    const patch = parseRouteUpdate({ price_limit: 700 }, rotaBase);
    assert.deepEqual(patch, { price_limit: 700 });
  });

  it('recusa corpo sem nenhum campo', () => {
    assert.throws(() => parseRouteUpdate({}, rotaBase), ValidationError);
  });

  it('valida contra o estado gravado, nao so contra o que veio', () => {
    // A ida (08/10) esta no banco; so a volta foi enviada, e ela e anterior.
    assert.throws(
      () => parseRouteUpdate({ return_date: '2026-10-01' }, rotaBase),
      /volta nao pode ser antes/,
    );
  });

  it('aceita apagar a volta mandando vazio', () => {
    const patch = parseRouteUpdate({ return_date: '' }, rotaBase);
    assert.equal(patch.return_date, null);
  });

  it('nao confunde ausencia com nulo: campo omitido fica de fora', () => {
    const patch = parseRouteUpdate({ notes: 'teste' }, rotaBase);
    assert.equal('price_limit' in patch, false);
  });

  it('converte active para 0 ou 1', () => {
    assert.equal(parseRouteUpdate({ active: false }, rotaBase).active, 0);
    assert.equal(parseRouteUpdate({ active: true }, rotaBase).active, 1);
  });
});

describe('affectsSearch', () => {
  it('reconhece mudanca que altera a consulta', () => {
    assert.equal(affectsSearch({ depart_date: '2026-11-01' }), true);
    assert.equal(affectsSearch({ max_stops: 0 }), true);
    // Mudar a janela muda o conjunto de viagens comparadas: pede releitura.
    assert.equal(affectsSearch({ depart_window_days: 3 }), true);
  });

  it('ignora mudanca que nao altera a consulta', () => {
    assert.equal(affectsSearch({ price_limit: 500 }), false);
    assert.equal(affectsSearch({ active: 0 }), false);
    assert.equal(affectsSearch({ notes: 'oi' }), false);
  });
});
