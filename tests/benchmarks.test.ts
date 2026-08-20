import assert from 'node:assert/strict';
import test from 'node:test';

import { annualToMonthlyRate, calcularBenchmarkIpca } from '../src/lib/benchmarks.ts';

const EPSILON = 1e-10;

function assertClose(actual: number, expected: number, tolerance = EPSILON): void {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `esperava ${expected}, mas recebeu ${actual}`
  );
}

test('converte taxa anual para a taxa mensal composta equivalente', () => {
  assert.equal(annualToMonthlyRate(0), 0);
  assertClose(annualToMonthlyRate(12), Math.pow(1.12, 1 / 12) - 1);
});

test('um mês remunera somente o aporte inicial e não adiciona aporte mensal no final', () => {
  const resultado = calcularBenchmarkIpca(1_000, 100, [12]);
  const esperado = 1_000 * Math.pow(1.12, 1 / 12);

  assert.equal(resultado.investido, 1_000);
  assert.equal(resultado.historico.length, 2);
  assert.equal(resultado.historico[0], 1_000);
  assertClose(resultado.historico[1], esperado);
  assertClose(resultado.valorFinal, esperado);
});

test('IPCA zero preserva os aportes sem rendimento e mantém o timing legado', () => {
  const resultado = calcularBenchmarkIpca(1_000, 100, [0, 0, 0]);

  assert.equal(resultado.investido, 1_200);
  assert.deepEqual(resultado.historico, [1_000, 1_000, 1_100, 1_200]);
  assert.equal(resultado.valorFinal, 1_200);
});

test('taxa constante corrige cada aporte de acordo com sua idade', () => {
  const resultado = calcularBenchmarkIpca(1_000, 100, [12, 12, 12]);
  const fator = Math.pow(1.12, 1 / 12);
  const esperado = 1_000 * fator ** 3 + 100 * fator ** 2 + 100 * fator;

  assert.equal(resultado.kind, 'benchmark');
  assert.equal(resultado.benchmarkId, 'ipca-preservation');
  assert.equal(resultado.nome, 'Correção pelo IPCA');
  assert.equal(resultado.investido, 1_200);
  assertClose(resultado.valorFinal, 1_231.5929863215908);
  assertClose(resultado.valorFinal, esperado);

  const totalInteiroDesdeOInicio = 1_200 * fator ** 3;
  assert.ok(Math.abs(resultado.valorFinal - totalInteiroDesdeOInicio) > 1);
});

test('taxas variáveis são aplicadas somente às coortes existentes em cada mês', () => {
  const taxasAnuais = [12, 0, 21] as const;
  const resultado = calcularBenchmarkIpca(1_000, 100, taxasAnuais);
  const fatores = taxasAnuais.map((taxa) => Math.pow(1 + taxa / 100, 1 / 12));

  const mes1 = 1_000 * fatores[0];
  const mes2 = mes1 * fatores[1] + 100 * fatores[1];
  const mes3 = mes2 * fatores[2] + 100 * fatores[2];

  assertClose(resultado.historico[1], mes1);
  assertClose(resultado.historico[2], mes2);
  assertClose(resultado.historico[3], mes3);
  assertClose(resultado.valorFinal, mes3);
});

test('não altera a série de taxas recebida', () => {
  const taxas = Object.freeze([4.5, 4.25, 4]);
  calcularBenchmarkIpca(500, 50, taxas);
  assert.deepEqual(taxas, [4.5, 4.25, 4]);
});

test('rejeita aportes e séries inválidas', () => {
  assert.throws(() => calcularBenchmarkIpca(-1, 100, [4]), /aporte inicial/i);
  assert.throws(() => calcularBenchmarkIpca(1_000, Number.NaN, [4]), /aporte mensal/i);
  assert.throws(() => calcularBenchmarkIpca(1_000, 100, []), /ao menos uma taxa/i);
  assert.throws(() => calcularBenchmarkIpca(1_000, 100, [Number.POSITIVE_INFINITY]), /mês 1/i);
  assert.throws(() => calcularBenchmarkIpca(1_000, 100, [-100]), /maior que -100%/i);
  assert.throws(() => annualToMonthlyRate(Number.NaN), /número finito/i);
});
