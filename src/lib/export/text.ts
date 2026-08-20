import { formatCurrency, formatNumber } from '../formatting.ts';
import type { SimulationRun } from '../types';
import { createDownloadFilename, downloadTextFile } from './download.ts';
import {
  createReportModel,
  type ReportExportOptions,
  type ReportField,
  type ReportResultItem,
  type SimulationReportModel
} from './reportModel.ts';

function formatSignedCurrency(value: number): string {
  if (Math.abs(value) < 0.005) return formatCurrency(0);
  return `${value > 0 ? '+' : '−'} ${formatCurrency(Math.abs(value))}`;
}

function formatSignedPercent(value: number | null): string {
  if (value === null) return '—';
  if (Math.abs(value) < 0.005) return '0,00%';
  return `${value > 0 ? '+' : '−'}${formatNumber(Math.abs(value), 2)}%`;
}

function appendFields(lines: string[], title: string, fields: ReportField[]): void {
  if (fields.length === 0) return;
  lines.push(title, ...fields.map((field) => `${field.label}: ${field.value}`), '');
}

function appendBestResult(lines: string[], result: ReportResultItem): void {
  lines.push(
    'MELHOR RESULTADO',
    result.name,
    result.characteristic,
    `Patrimônio líquido final: ${formatCurrency(result.net)}`,
    `Rendimento líquido: ${formatSignedCurrency(result.netGain)}`,
    `Percentual líquido acumulado: ${formatSignedPercent(result.accumulatedNetReturn)}`,
    `Total investido: ${formatCurrency(result.invested)}`,
    result.taxLabel,
    ''
  );
}

function appendRanking(lines: string[], model: SimulationReportModel): void {
  lines.push('RESULTADOS');

  for (const result of model.results) {
    lines.push(
      `${result.rank}. ${result.name}`,
      `   Característica: ${result.characteristic}`,
      `   Patrimônio líquido: ${formatCurrency(result.net)}`,
      `   Rendimento líquido: ${formatSignedCurrency(result.netGain)}`,
      `   Total investido: ${formatCurrency(result.invested)}`,
      `   ${result.taxLabel}`
    );

    if (result.rank === 1) {
      lines.push('   Comparação: melhor resultado');
    } else if (result.tiedWithWinner) {
      lines.push('   Comparação: mesmo resultado líquido do vencedor');
    } else {
      lines.push(
        `   Diferença para o vencedor: ${formatSignedCurrency(result.differenceFromWinner)} (${formatSignedPercent(result.percentageDifferenceFromWinner)})`
      );
    }

    lines.push('');
  }
}

export function renderTextReport(model: SimulationReportModel): string {
  const lines: string[] = [model.title, model.timestampLabel, ''];

  if (model.sourceNotice) lines.push('ORIGEM DOS DADOS', model.sourceNotice, '');

  appendFields(lines, 'PARÂMETROS', model.parameters);
  appendFields(lines, 'PREMISSAS DE MERCADO', model.assumptions);
  if (model.rateStatus) lines.push(`Status das taxas: ${model.rateStatus}`, '');

  appendBestResult(lines, model.bestResult);

  if (model.benchmark) {
    lines.push(
      'BENCHMARK',
      model.benchmark.name,
      model.benchmark.description,
      `Valor corrigido pelo IPCA: ${formatCurrency(model.benchmark.finalValue)}`,
      `Ganho real aproximado do vencedor: ${formatSignedCurrency(model.benchmark.gainAgainstBenchmark)}`,
      ''
    );
  }

  appendRanking(lines, model);

  if (!model.hasMonthlyHistory) {
    lines.push('Observação: esta origem não contém histórico mensal para o gráfico de evolução.', '');
  }

  lines.push('AVISO', model.disclaimer);
  return lines.join('\r\n');
}

export function createTextReport(
  run: SimulationRun,
  options: ReportExportOptions = {}
): string {
  return renderTextReport(createReportModel(run, options));
}

export function downloadTextReport(
  run: SimulationRun,
  options: ReportExportOptions = {},
  filename = createDownloadFilename('txt', run.createdAt)
): void {
  const report = createTextReport(run, options);
  downloadTextFile(`\uFEFF${report}`, filename);
}
