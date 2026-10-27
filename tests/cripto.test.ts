import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Custos } from '../src/domain/cambio';
import {
  acoesDoDia,
  backtestGrade,
  estatisticaQuedas,
  type Lote,
  type ParametrosGrade,
  precoDoLote,
  quedaDoTopo,
  resultadoDoLote,
} from '../src/domain/cripto';

const taxa: Custos = { iofCompraPct: 0, iofVendaPct: 0, spreadPct: 1.5, irGanhoPct: 0 };

const p: ParametrosGrade = {
  janelaQueda: 7,
  quedaPct: 20,
  alvoPct: 3,
  stopPct: 25,
  partes: 4,
  espacamentoPct: 20,
  tendenciaDias: 30,
  filtroTendencia: false,
};

/** Sobe e desce entre 80 e 120 a cada 20 dias: quedas de ~30% que sempre voltam. */
const serra = (n: number) => Array.from({ length: n }, (_, i) => 100 + 20 * Math.sin((2 * Math.PI * i) / 20));
const pontos = (s: number[]) =>
  s.map((valor, i) => ({ dia: new Date(Date.UTC(2022, 0, 1 + i)).toISOString().slice(0, 10), valor }));

const lote = (preco: number, custo = 25): Lote => ({
  dia: '2026-01-01',
  preco,
  quantidade: custo / (preco * 1.015),
  custo,
});

describe('quedaDoTopo', () => {
  it('mede a queda desde o maior preco da janela', () => {
    assert.equal(quedaDoTopo([100, 120, 90], 2, 3), 25);
    assert.equal(quedaDoTopo([100, 120, 90], 2, 1), 0);
  });
});

describe('lotes', () => {
  it('vender no preco do alvo da exatamente o alvo liquido', () => {
    const l = lote(50);
    assert.ok(Math.abs(resultadoDoLote(l, precoDoLote(l, 3, taxa), taxa) - 3) < 1e-9);
    assert.ok(Math.abs(resultadoDoLote(l, precoDoLote(l, -25, taxa), taxa) + 25) < 1e-9);
  });
});

describe('acoesDoDia', () => {
  it('sem queda suficiente nao compra', () => {
    assert.deepEqual(acoesDoDia([100, 101, 99, 95], 3, [], p, taxa), []);
  });

  it('queda grande compra a primeira parte', () => {
    const a = acoesDoDia([100, 100, 90, 79], 3, [], p, taxa);
    assert.equal(a.length, 1);
    assert.equal(a[0].tipo, 'comprar');
  });

  it('com parte aberta, so compra outra depois de cair o espacamento abaixo dela', () => {
    const aberto = [lote(80)];
    assert.equal(acoesDoDia([100, 80, 70], 2, aberto, p, taxa).filter((x) => x.tipo === 'comprar').length, 0);
    assert.equal(acoesDoDia([100, 80, 63], 2, aberto, p, taxa).filter((x) => x.tipo === 'comprar').length, 1);
  });

  it('parte no alvo vende; parte no stop sai', () => {
    assert.equal(acoesDoDia([80, 90], 1, [lote(80)], p, taxa)[0].tipo, 'vender');
    assert.equal(acoesDoDia([80, 55], 1, [lote(80)], p, taxa)[0].tipo, 'stop');
  });

  it('nunca passa do numero de partes', () => {
    const cheias = [lote(80), lote(64), lote(51), lote(41)];
    assert.equal(acoesDoDia([100, 80, 30], 2, cheias, { ...p, stopPct: 0 }, taxa).filter((x) => x.tipo === 'comprar').length, 0);
  });
});

describe('estatisticaQuedas', () => {
  it('numa serra que sempre volta, toda queda grande se recupera', () => {
    const e = estatisticaQuedas(serra(400), p, taxa, 14);
    assert.ok(e.ocorrencias > 5);
    assert.equal(e.recuperou, e.ocorrencias);
  });

  it('numa queda sem volta, nenhuma se recupera', () => {
    const e = estatisticaQuedas(Array.from({ length: 200 }, (_, i) => 100 * 0.95 ** i), p, taxa, 14);
    assert.ok(e.ocorrencias > 0);
    assert.equal(e.recuperou, 0);
  });
});

describe('backtestGrade', () => {
  it('na serra fecha ciclos com lucro e ganha de segurar', () => {
    const r = backtestGrade(pontos(serra(400)), new Map(), p, taxa, 100)!;
    assert.ok(r.vendasNoAlvo > 5);
    assert.ok(r.final > 100);
    assert.ok(r.final > r.segurarFinal);
  });

  it('dinheiro parado rende o CDI', () => {
    const plano = pontos(Array.from({ length: 100 }, () => 100));
    const cdi = new Map(plano.map((pt) => [pt.dia, 0.05]));
    const r = backtestGrade(plano, cdi, p, taxa, 100)!;
    assert.equal(r.compras, 0);
    assert.ok(Math.abs(r.final - r.cdiFinal) < 1e-9);
  });
});
