import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  backtest,
  type Custos,
  empatePct,
  historicoDaZona,
  indicadores,
  type ParametrosSinal,
  precoParaResultado,
  quantidadeComprada,
  reaisRecebidos,
  sinal,
} from '../src/domain/cambio';

const conta: Custos = { iofCompraPct: 3.5, iofVendaPct: 0.38, spreadPct: 1, irGanhoPct: 0 };
const etf: Custos = { iofCompraPct: 0, iofVendaPct: 0, spreadPct: 0.2, irGanhoPct: 15 };
const semCusto: Custos = { iofCompraPct: 0, iofVendaPct: 0, spreadPct: 0, irGanhoPct: 0 };

const p: ParametrosSinal = {
  janelaCurta: 4,
  janelaLonga: 90,
  zonaCompra: 0.2,
  zonaVenda: 0.8,
  alvoLucroPct: 3,
  stopPct: 8,
};

/** Onda suave em torno de 5,20, com periodo de ~120 pregoes. */
const onda = (n: number, amp = 0.3) =>
  Array.from({ length: n }, (_, i) => 5.2 + amp * Math.sin((2 * Math.PI * i) / 120));

describe('custos', () => {
  it('ida e volta sem custo devolve o mesmo valor', () => {
    const q = quantidadeComprada(100, 5, semCusto);
    assert.equal(reaisRecebidos(q, 5, semCusto), 100);
  });

  it('conta global precisa subir uns 6% para empatar', () => {
    const e = empatePct(conta);
    assert.ok(e > 5.5 && e < 6.5, `empate ${e}`);
    const q = quantidadeComprada(100, 5, conta);
    assert.ok(Math.abs(reaisRecebidos(q, 5 * (1 + e / 100), conta) - 100) < 1e-9);
  });

  it('ETF empata com menos de 0,5%', () => {
    assert.ok(empatePct(etf) < 0.5);
  });

  it('IR so desconta o lucro, nunca o prejuizo', () => {
    const q = quantidadeComprada(100, 10, etf);
    const comLucro = reaisRecebidos(q, 11, etf, 100);
    const semIr = reaisRecebidos(q, 11, etf);
    assert.ok(Math.abs(semIr - comLucro - (semIr - 100) * 0.15) < 1e-9);
    assert.equal(reaisRecebidos(q, 9, etf, 100), reaisRecebidos(q, 9, etf));
  });
});

describe('indicadores', () => {
  it('nao responde sem historico suficiente', () => {
    assert.equal(indicadores(onda(50), p), null);
  });

  it('marca a posicao do preco dentro da faixa', () => {
    const serie = [...onda(120), 4.8];
    const ind = indicadores(serie, p)!;
    assert.equal(ind.posicaoFaixa, 0);
    assert.equal(ind.virouParaCima, false);
    assert.ok(ind.zScore < -1);
  });
});

describe('sinal', () => {
  const base = indicadores(onda(200), p)!;

  it('barato e ainda caindo manda esperar', () => {
    const s = sinal({ ...base, posicaoFaixa: 0.1, virouParaCima: false }, p, null, etf);
    assert.equal(s.tipo, 'aguardar_virada');
  });

  it('barato e virando manda comprar', () => {
    const s = sinal({ ...base, posicaoFaixa: 0.1, virouParaCima: true }, p, null, etf);
    assert.equal(s.tipo, 'compra');
  });

  it('com posicao aberta, alvo vende e stop sai', () => {
    assert.equal(sinal(base, p, { resultadoLiquidoPct: 3.5 }, etf).tipo, 'venda');
    assert.equal(sinal(base, p, { resultadoLiquidoPct: -9 }, etf).tipo, 'stop');
    assert.equal(sinal({ ...base, posicaoFaixa: 0.5 }, p, { resultadoLiquidoPct: 1 }, etf).tipo, 'segurar');
  });

  it('topo da faixa sem posicao e caro', () => {
    assert.equal(sinal({ ...base, posicaoFaixa: 0.9 }, p, null, etf).tipo, 'caro');
  });
});

describe('historico e backtest', () => {
  const pontos = onda(600).map((valor, i) => ({
    dia: new Date(Date.UTC(2020, 0, 1 + i)).toISOString().slice(0, 10),
    valor,
  }));

  it('numa onda regular, a zona de compra costuma pagar os custos do ETF', () => {
    const h = historicoDaZona(pontos.map((pt) => pt.valor), p, etf);
    assert.ok(h.ocorrencias > 0);
    assert.ok(h.acertos / h.ocorrencias > 0.5);
  });

  it('compra no vale, vende no alvo e nunca vende sem ter comprado', () => {
    const cdi = new Map(pontos.map((pt) => [pt.dia, 0.05]));
    const r = backtest(pontos, cdi, p, etf, 100)!;
    assert.ok(r.operacoes.length >= 2);
    assert.equal(r.operacoes[0].tipo, 'compra');
    r.operacoes.forEach((op, i) => assert.equal(op.tipo, i % 2 === 0 ? 'compra' : 'venda'));
    assert.ok(r.cdiFinal > 100);
  });
});

describe('preco de alvo e de stop', () => {
  it('vender no preco calculado devolve exatamente o resultado pedido', () => {
    for (const c of [etf, conta, semCusto]) {
      const q = quantidadeComprada(100, 10, c);
      for (const alvo of [3, -8, 0]) {
        const preco = precoParaResultado(q, 100, alvo, c);
        assert.ok(Math.abs(reaisRecebidos(q, preco, c, 100) - (100 + alvo)) < 1e-9, `${alvo}% custos ${JSON.stringify(c)}`);
      }
    }
  });
});
