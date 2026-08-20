import assert from 'node:assert/strict';
import test from 'node:test';

import { simularInvestimentos } from '../src/lib/calculations.ts';
import { importarResultadosCsv, resultadosParaCsv } from '../src/lib/csv.ts';
import { createDefaultProductSelection, identifyProduct } from '../src/lib/products.ts';
import { accumulatedNetReturn, netGain, sortResultsByNetValue } from '../src/lib/resultMetrics.ts';
import type { SimulationInputs } from '../src/lib/types.ts';

const INPUTS: SimulationInputs = {
  aporteInicial: '1000,00',
  aporteMensal: '0,00',
  prazo: '1',
  prazoUnidade: 'Anos',
  selic: '10,50',
  cdi: '10,40',
  ipca: '4,50',
  tr: '1,50',
  cdbPercentualCdi: '100,0',
  lciPercentualCdi: '100,0',
  tesouroPre: '11,0',
  tesouroIpcaFixo: '5,50'
};

test('exporta e reimporta todos os produtos do CSV legado', () => {
  const original = simularInvestimentos(INPUTS, createDefaultProductSelection());
  const imported = importarResultadosCsv(resultadosParaCsv(original));

  assert.deepEqual(imported.map((result) => result.produtoId), original.map((result) => result.produtoId));
  assert.deepEqual(imported.map((result) => result.nome), original.map((result) => result.nome));
  for (let index = 0; index < imported.length; index += 1) {
    assert.ok(Math.abs(imported[index].liquido - original[index].liquido) < 0.01);
  }
});

test('rejeita cabeçalho reordenado e aspas não fechadas', () => {
  const reordered = [
    '"Ativo";"Valor Liquido";"Valor Bruto";"Valor Investido";"Imposto Pago";"Taxa de IR"',
    '"CDB (100% do CDI)";"R$ 1.100,00";"R$ 1.120,00";"R$ 1.000,00";"R$ 20,00";"Regressiva"'
  ].join('\n');
  assert.throws(() => importarResultadosCsv(reordered), /cabeçalho do CSV inválido/i);

  const unclosed = [
    '"Ativo";"Valor Investido";"Valor Bruto";"Valor Liquido";"Imposto Pago";"Taxa de IR"',
    '"CDB (100% do CDI)";"R$ 1.000,00";"R$ 1.120,00";"R$ 1.100,00";"R$ 20,00";"Regressiva'
  ].join('\n');
  assert.throws(() => importarResultadosCsv(unclosed), /aspas não fechadas/i);
});

test('rejeita produtos desconhecidos e duplicados', () => {
  const header = '"Ativo";"Valor Investido";"Valor Bruto";"Valor Liquido";"Imposto Pago";"Taxa de IR"';
  const unknown = `${header}\n"Cripto";"R$ 1,00";"R$ 1,00";"R$ 1,00";"R$ 0,00";"Isento"`;
  assert.throws(() => importarResultadosCsv(unknown), /produto não reconhecido/i);

  const row = '"CDB (100% do CDI)";"R$ 1,00";"R$ 1,00";"R$ 1,00";"R$ 0,00";"Regressiva"';
  assert.throws(() => importarResultadosCsv(`${header}\n${row}\n${row}`), /mais de uma vez/i);
});

test('identifica produtos legados e calcula métricas sem alterar a lista original', () => {
  assert.equal(identifyProduct('Tesouro Pré (11,0% a.a.)'), 'tesouroPrefixado');
  assert.equal(identifyProduct('Poupanca (regra antiga)'), 'poupanca');
  assert.equal(identifyProduct('Desconhecido'), null);

  const original = simularInvestimentos(INPUTS);
  const ordered = sortResultsByNetValue(original);
  assert.notEqual(ordered, original);
  assert.ok(ordered[0].liquido >= ordered.at(-1)!.liquido);
  assert.equal(netGain(ordered[0]), ordered[0].liquido - ordered[0].investido);
  assert.equal(accumulatedNetReturn({ ...ordered[0], investido: 0 }), null);
});
