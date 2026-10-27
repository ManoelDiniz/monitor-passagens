import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  addDays,
  datesInclusive,
  hojeISO,
  nightsBetween,
  windowDates,
} from '../src/domain/date-window';
import { expandirJanela } from '../src/providers';
import type { SearchQuery } from '../src/providers';

const HOJE = '2026-09-01';

describe('addDays', () => {
  it('soma e subtrai dias', () => {
    assert.equal(addDays('2026-09-12', 3), '2026-09-15');
    assert.equal(addDays('2026-09-12', -3), '2026-09-09');
  });

  it('atravessa virada de mes e de ano', () => {
    assert.equal(addDays('2026-09-30', 1), '2026-10-01');
    assert.equal(addDays('2026-12-31', 1), '2027-01-01');
    assert.equal(addDays('2027-01-01', -1), '2026-12-31');
  });

  it('acerta o 29 de fevereiro de ano bissexto', () => {
    assert.equal(addDays('2028-02-28', 1), '2028-02-29');
    assert.equal(addDays('2027-02-28', 1), '2027-03-01');
  });

  it('nao escorrega um dia na virada do horario de verao', () => {
    // Datas de voo sao dia de calendario: somar 1 tem que dar o dia seguinte
    // em qualquer fuso, inclusive nos dias em que o relogio local pula 1h.
    for (const data of ['2026-10-18', '2026-11-01', '2027-02-21', '2027-03-14']) {
      assert.equal(addDays(addDays(data, 1), -1), data);
    }
  });
});

describe('nightsBetween', () => {
  it('conta as noites entre ida e volta', () => {
    assert.equal(nightsBetween('2026-09-12', '2026-09-22'), 10);
    assert.equal(nightsBetween('2026-09-12', '2026-09-12'), 0);
  });

  it('sobrevive a virada de mes', () => {
    assert.equal(nightsBetween('2026-09-28', '2026-10-03'), 5);
  });
});

describe('datesInclusive', () => {
  it('inclui as duas pontas', () => {
    assert.deepEqual(datesInclusive('2026-09-10', '2026-09-13'), [
      '2026-09-10',
      '2026-09-11',
      '2026-09-12',
      '2026-09-13',
    ]);
  });

  it('devolve um dia so quando as pontas sao iguais', () => {
    assert.deepEqual(datesInclusive('2026-09-10', '2026-09-10'), ['2026-09-10']);
  });
});

describe('windowDates', () => {
  it('sem janela devolve so a ancora', () => {
    const janela = windowDates('2026-09-12', 0, { hoje: HOJE });
    assert.deepEqual(janela.dates, ['2026-09-12']);
    assert.equal(janela.passados, 0);
    assert.equal(janela.cortados, 0);
  });

  it('abre a janela para os dois lados, em ordem', () => {
    const janela = windowDates('2026-09-12', 2, { hoje: HOJE });
    assert.deepEqual(janela.dates, [
      '2026-09-10',
      '2026-09-11',
      '2026-09-12',
      '2026-09-13',
      '2026-09-14',
    ]);
  });

  it('descarta dia que ja passou e conta o descarte', () => {
    // Ancora amanha, janela de 3: os dias 29, 30 e 31 de agosto ja foram.
    const janela = windowDates('2026-09-02', 3, { hoje: HOJE });
    assert.deepEqual(janela.dates, [
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
      '2026-09-04',
      '2026-09-05',
    ]);
    assert.equal(janela.passados, 2);
  });

  it('mantem hoje na janela: ainda da para comprar', () => {
    const janela = windowDates(HOJE, 1, { hoje: HOJE });
    assert.equal(janela.dates.includes(HOJE), true);
  });

  it('janela inteira no passado cai de volta na ancora', () => {
    const janela = windowDates('2026-08-01', 3, { hoje: HOJE });
    assert.deepEqual(janela.dates, ['2026-08-01']);
    assert.equal(janela.passados, 7);
  });

  it('respeita o teto cortando as pontas, nao o meio', () => {
    const janela = windowDates('2026-09-12', 3, { hoje: HOJE, max: 3 });
    assert.deepEqual(janela.dates, ['2026-09-11', '2026-09-12', '2026-09-13']);
    assert.equal(janela.cortados, 4);
  });

  it('nunca devolve janela vazia', () => {
    assert.equal(windowDates('2026-09-12', 7, { hoje: HOJE, max: 0 }).dates.length, 1);
  });

  it('trata janela negativa como data fixa', () => {
    assert.deepEqual(windowDates('2026-09-12', -2, { hoje: HOJE }).dates, ['2026-09-12']);
  });
});

describe('hojeISO', () => {
  it('usa o fuso local, nao UTC', () => {
    // 23h em Sao Paulo ainda e dia 12; em UTC ja seria dia 13.
    const noite = new Date(2026, 8, 12, 23, 30);
    assert.equal(hojeISO(noite), '2026-09-12');
  });
});

const consultaBase: SearchQuery = {
  origin: 'FOR',
  destination: 'GRU',
  departDate: '2026-09-10',
  returnDate: null,
  adults: 1,
};

describe('expandirJanela', () => {
  it('sem janela devolve a consulta intacta', () => {
    assert.deepEqual(expandirJanela(consultaBase), [consultaBase]);
  });

  it('quebra a janela em uma consulta por dia', () => {
    const consultas = expandirJanela({ ...consultaBase, departDateEnd: '2026-09-12' });
    assert.deepEqual(
      consultas.map((c) => c.departDate),
      ['2026-09-10', '2026-09-11', '2026-09-12'],
    );
    // Cada consulta vira data unica, senao o provedor tentaria a janela de novo.
    assert.equal(
      consultas.every((c) => c.departDateEnd === c.departDate),
      true,
    );
  });

  it('desliza a volta mantendo as noites', () => {
    const consultas = expandirJanela({
      ...consultaBase,
      departDateEnd: '2026-09-12',
      returnDate: '2026-09-20', // 10 noites
    });
    assert.deepEqual(
      consultas.map((c) => c.returnDate),
      ['2026-09-20', '2026-09-21', '2026-09-22'],
    );
  });

  it('preserva os demais filtros em cada dia', () => {
    const consultas = expandirJanela({
      ...consultaBase,
      departDateEnd: '2026-09-11',
      adults: 3,
      maxStops: 0,
    });
    assert.equal(
      consultas.every((c) => c.adults === 3 && c.maxStops === 0),
      true,
    );
  });
});
