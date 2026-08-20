import assert from 'node:assert/strict';
import test from 'node:test';

import { calcularEvolucao, simularInvestimentos } from '../src/lib/calculations.ts';
import { durationInMonths, formatDuration, MAX_SIMULATION_MONTHS } from '../src/lib/duration.ts';
import { createEmptyProductSelection } from '../src/lib/products.ts';
import type { ProductId, ProductSelection, SimulationInputs } from '../src/lib/types.ts';

function inputs(overrides: Partial<SimulationInputs> = {}): SimulationInputs {
  return {
    aporteInicial: '1000,00',
    aporteMensal: '100,00',
    prazo: '12',
    prazoUnidade: 'Meses',
    selic: '10,50',
    cdi: '10,40',
    ipca: '4,50',
    tr: '1,50',
    cdbPercentualCdi: '100,0',
    lciPercentualCdi: '100,0',
    tesouroPre: '11,0',
    tesouroIpcaFixo: '5,50',
    ...overrides
  };
}

function only(productId: ProductId): ProductSelection {
  return { ...createEmptyProductSelection(), [productId]: true };
}

test('converte e formata prazos sem truncar entradas fracionárias', () => {
  assert.equal(durationInMonths('2', 'Anos'), 24);
  assert.equal(durationInMonths('18', 'Meses'), 18);
  assert.throws(() => durationInMonths('1,5', 'Anos'), /número inteiro/i);
  assert.equal(formatDuration(1), '1 mês');
  assert.equal(formatDuration(26), '26 meses (2 anos e 2 meses)');
  assert.equal(MAX_SIMULATION_MONTHS, 1200);
});

test('simula somente os produtos selecionados', () => {
  const results = simularInvestimentos(inputs(), only('cdb'));

  assert.equal(results.length, 1);
  assert.equal(results[0].produtoId, 'cdb');
  assert.equal(results[0].historico.length, 13);
  assert.equal(results[0].investido, 2_100);
});

test('rejeita seleção vazia e prazos inválidos', () => {
  assert.throws(
    () => simularInvestimentos(inputs(), createEmptyProductSelection()),
    /selecione pelo menos um investimento/i
  );
  assert.throws(
    () => simularInvestimentos(inputs({ prazo: '1,5' }), only('cdb')),
    /número inteiro/i
  );
  assert.throws(
    () => simularInvestimentos(inputs({ prazo: '1201' }), only('cdb')),
    /1\.200 meses/i
  );
});

test('rejeita taxas que gerariam NaN e resultados que excedem o limite numérico', () => {
  assert.throws(
    () => simularInvestimentos(inputs({ tesouroPre: '-100' }), only('tesouroPrefixado')),
    /maiores que -100%/i
  );
  assert.throws(
    () => simularInvestimentos(
      inputs({ aporteInicial: '1e308', aporteMensal: '1e308', prazo: '12', tesouroPre: '100' }),
      only('tesouroPrefixado')
    ),
    /limite numérico/i
  );
});

test('não exige uma taxa de produto que está desativado', () => {
  const results = simularInvestimentos(
    inputs({ tesouroPre: 'valor inválido' }),
    only('cdb')
  );

  assert.equal(results.length, 1);
  assert.equal(results[0].produtoId, 'cdb');
});

test('preserva o timing legado dos aportes e a soma aproximada do Tesouro IPCA+', () => {
  const evolution = calcularEvolucao(1_000, 100, 0, 3, false);
  assert.equal(evolution.investido, 1_200);
  assert.deepEqual(evolution.historico, [1_000, 1_000, 1_100, 1_200]);

  const ipcaResult = simularInvestimentos(inputs({ prazo: '1' }), only('tesouroIpca'))[0];
  const legacyApproximation = calcularEvolucao(1_000, 100, 10, 1, true);
  assert.equal(ipcaResult.caracteristica, 'IPCA + 5,50%');
  assert.equal(ipcaResult.bruto, legacyApproximation.bruto);
});
