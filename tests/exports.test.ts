import assert from 'node:assert/strict';
import test from 'node:test';

import { calcularBenchmarkIpca } from '../src/lib/benchmarks.ts';
import { simularInvestimentos } from '../src/lib/calculations.ts';
import { createPdfReportBlob } from '../src/lib/export/pdf.ts';
import { createReportModel } from '../src/lib/export/reportModel.ts';
import { createSummarySvg } from '../src/lib/export/svg.ts';
import { createTextReport } from '../src/lib/export/text.ts';
import { createSummaryPngBlob } from '../src/lib/export/png.ts';
import { createDefaultProductSelection } from '../src/lib/products.ts';
import type { SimulationInputs, SimulationRun } from '../src/lib/types.ts';

const INPUTS: SimulationInputs = {
  aporteInicial: '1000,00',
  aporteMensal: '100,00',
  prazo: '3',
  prazoUnidade: 'Meses',
  selic: '10,50',
  cdi: '10,40',
  ipca: '4,50',
  tr: '1,50',
  cdbPercentualCdi: '100,0',
  lciPercentualCdi: '100,0',
  tesouroPre: '11,0',
  tesouroIpcaFixo: '5,50'
};

function run(): SimulationRun {
  const selection = createDefaultProductSelection();
  return {
    origin: 'calculated',
    createdAt: '2026-08-20T12:00:00.000Z',
    inputs: { ...INPUTS },
    produtosAtivos: selection,
    resultados: simularInvestimentos(INPUTS, selection),
    prazoMeses: 3,
    hasMonthlyHistory: true,
    benchmarkIpca: calcularBenchmarkIpca(1_000, 100, [4.5, 4.5, 4.5]),
    rateStatus: 'Taxas informadas para teste.'
  };
}

test('modelo e texto ordenam resultados e respeitam a opção do benchmark', () => {
  const simulation = run();
  const withBenchmark = createReportModel(simulation, { includeBenchmark: true });
  const withoutBenchmark = createReportModel(simulation, { includeBenchmark: false });

  assert.equal(withBenchmark.results.length, 6);
  assert.equal(withBenchmark.bestResult.rank, 1);
  assert.ok(withBenchmark.results[0].net >= withBenchmark.results.at(-1)!.net);
  assert.equal(withBenchmark.benchmark?.name, 'Correção pelo IPCA');
  assert.equal(withoutBenchmark.benchmark, null);

  const text = createTextReport(simulation, { includeBenchmark: true });
  assert.match(text, /SIMULAÇÃO DE RENDA FIXA/);
  assert.match(text, /MELHOR RESULTADO/);
  assert.match(text, /Correção pelo IPCA/);
  assert.match(text, /não constitui recomendação de investimento/i);
});

test('SVG escapa conteúdo textual e contém o resumo completo', () => {
  const simulation = run();
  simulation.resultados[0] = {
    ...simulation.resultados[0],
    caracteristica: '<script>alert("x")</script> & teste'
  };

  const svg = createSummarySvg(simulation, { includeBenchmark: true });
  assert.match(svg, /^<svg/);
  assert.match(svg, /COMPARATIVO COMPLETO/);
  assert.match(svg, /&lt;script&gt;/);
  assert.doesNotMatch(svg, /<script>alert/);
});

test('gera PDF válido sob demanda', async () => {
  const blob = await createPdfReportBlob(run(), { includeBenchmark: true });

  assert.equal(blob.type, 'application/pdf');
  assert.ok(blob.size > 1_000);
  const signature = new TextDecoder().decode((await blob.arrayBuffer()).slice(0, 5));
  assert.equal(signature, '%PDF-');
});

test('PNG informa claramente quando executado fora do navegador', async () => {
  await assert.rejects(
    () => createSummaryPngBlob(run()),
    /só está disponível no aplicativo aberto no navegador/i
  );
});
