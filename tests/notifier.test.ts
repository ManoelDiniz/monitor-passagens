import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { escaparHtml } from '../src/infra/notifier';

/**
 * O Telegram recebe a mensagem em HTML porque no Markdown dele o link termina
 * no primeiro parentese fechado — e deep link de provedor vem cheio deles.
 * Trocar o modo so resolve se o escape estiver certo.
 */
describe('escape para o Telegram', () => {
  it('escapa o que o parser de HTML interpreta', () => {
    assert.equal(escaparHtml('a & b'), 'a &amp; b');
    assert.equal(escaparHtml('<b>oi</b>'), '&lt;b&gt;oi&lt;/b&gt;');
    assert.equal(escaparHtml('diz "oi"'), 'diz &quot;oi&quot;');
  });

  it('escapa o & antes das outras entidades, sem duplicar', () => {
    // Se & fosse escapado por ultimo, "&lt;" viraria "&amp;lt;" na tela.
    assert.equal(escaparHtml('<a>'), '&lt;a&gt;');
    assert.equal(escaparHtml('&amp;'), '&amp;amp;');
  });

  it('preserva o que um link de provedor tem de estranho', () => {
    const link = 'https://www.kiwi.com/deep?token=ab_c)d&passengers=1(2)&lang=pt-BR';

    // Parentese e underscore atravessam intactos: em HTML eles nao delimitam nada.
    assert.equal(
      escaparHtml(link),
      'https://www.kiwi.com/deep?token=ab_c)d&amp;passengers=1(2)&amp;lang=pt-BR',
    );
  });

  it('nao mexe em texto comum de alerta', () => {
    const titulo = 'FOR → BSB por R$ 2.015';
    assert.equal(escaparHtml(titulo), titulo);
  });
});
