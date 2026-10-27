import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { config } from '../src/config';
import { ProviderHealth } from '../src/providers/health';
import { retryAfterMs } from '../src/providers/types';

const LIMITE = config.providers.breakerFailures;

describe('saude das fontes', () => {
  it('fonte nunca consultada nao conta como falha', () => {
    const saude = new ProviderHealth();
    const [fonte] = saude.snapshot(['kiwi']);

    assert.equal(fonte.state, 'ok');
    assert.equal(fonte.attempts, 0);
    assert.equal(fonte.failures, 0);
    assert.equal(saude.isPaused('kiwi'), false);
  });

  it('uma falha deixa a fonte instavel, sem suspender', () => {
    const saude = new ProviderHealth();
    saude.registerFailure('kiwi', 'HTTP 500');

    const [fonte] = saude.snapshot(['kiwi']);
    assert.equal(fonte.state, 'instavel');
    assert.equal(fonte.lastError, 'HTTP 500');
    assert.equal(saude.isPaused('kiwi'), false);
  });

  it('suspende depois do limite de falhas seguidas', () => {
    const saude = new ProviderHealth();
    for (let i = 0; i < LIMITE; i++) saude.registerFailure('kiwi', 'HTTP 429');

    const [fonte] = saude.snapshot(['kiwi']);
    assert.equal(fonte.state, 'fora');
    assert.equal(saude.isPaused('kiwi'), true);
    assert.ok(fonte.pausedUntil !== null);
  });

  it('sucesso zera a contagem e tira do castigo', () => {
    const saude = new ProviderHealth();
    for (let i = 0; i < LIMITE; i++) saude.registerFailure('kiwi', 'HTTP 429');
    saude.registerSuccess('kiwi');

    const [fonte] = saude.snapshot(['kiwi']);
    assert.equal(fonte.state, 'ok');
    assert.equal(fonte.consecutiveFailures, 0);
    assert.equal(fonte.pausedUntil, null);
    assert.equal(saude.isPaused('kiwi'), false);
  });

  it('falha alternada com sucesso nunca suspende', () => {
    const saude = new ProviderHealth();
    for (let i = 0; i < LIMITE * 2; i++) {
      saude.registerFailure('kiwi', 'timeout');
      saude.registerSuccess('kiwi');
    }

    assert.equal(saude.isPaused('kiwi'), false);
    const [fonte] = saude.snapshot(['kiwi']);
    assert.equal(fonte.failures, LIMITE * 2);
    assert.equal(fonte.attempts, LIMITE * 4);
  });

  it('cada fonte tem seu proprio castigo', () => {
    const saude = new ProviderHealth();
    for (let i = 0; i < LIMITE; i++) saude.registerFailure('kiwi', 'HTTP 403');

    assert.equal(saude.isPaused('kiwi'), true);
    assert.equal(saude.isPaused('maxmilhas'), false);
  });
});

describe('retry-after', () => {
  it('entende segundos', () => {
    assert.equal(retryAfterMs('5'), 5_000);
  });

  it('entende data HTTP', () => {
    const daqui30s = new Date(Date.now() + 30_000).toUTCString();
    const ms = retryAfterMs(daqui30s);

    assert.ok(ms !== null && ms > 25_000 && ms <= 31_000, `esperava ~30s, veio ${ms}`);
  });

  it('nao espera mais que um minuto', () => {
    assert.equal(retryAfterMs('3600'), 60_000);
  });

  it('data no passado nao vira espera negativa', () => {
    assert.equal(retryAfterMs(new Date(Date.now() - 60_000).toUTCString()), 0);
  });

  it('ignora cabecalho ausente ou sem sentido', () => {
    assert.equal(retryAfterMs(null), null);
    assert.equal(retryAfterMs('logo mais'), null);
  });
});
