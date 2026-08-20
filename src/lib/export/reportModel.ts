import { formatCurrency, formatNumber, parseBrNumber } from '../formatting.ts';
import { getProductColor } from '../products.ts';
import {
  accumulatedNetReturn,
  isTaxableResult,
  netGain,
  sortResultsByNetValue
} from '../resultMetrics.ts';
import type { IpcaBenchmarkResult, ProductId, SimulationInputs, SimulationRun } from '../types';

export const REPORT_TITLE = 'SIMULAÇÃO DE RENDA FIXA';
export const REPORT_DISCLAIMER =
  'Simulação informativa. Não constitui recomendação de investimento.';

export interface ReportExportOptions {
  includeBenchmark?: boolean;
}

export interface ReportField {
  label: string;
  value: string;
}

export interface ReportResultItem {
  rank: number;
  productId: ProductId;
  name: string;
  characteristic: string;
  color: string;
  invested: number;
  gross: number;
  net: number;
  tax: number;
  taxRate: string;
  taxLabel: string;
  netGain: number;
  accumulatedNetReturn: number | null;
  differenceFromWinner: number;
  percentageDifferenceFromWinner: number | null;
  tiedWithWinner: boolean;
}

export interface ReportBenchmark {
  name: string;
  description: string;
  invested: number;
  finalValue: number;
  gainAgainstBenchmark: number;
}

export interface SimulationReportModel {
  title: typeof REPORT_TITLE;
  origin: SimulationRun['origin'];
  createdAt: string;
  timestampLabel: string;
  parameters: ReportField[];
  assumptions: ReportField[];
  rateStatus: string | null;
  sourceNotice: string | null;
  hasMonthlyHistory: boolean;
  bestResult: ReportResultItem;
  results: ReportResultItem[];
  benchmark: ReportBenchmark | null;
  disclaimer: typeof REPORT_DISCLAIMER;
}

function formatTimestamp(value: string, origin: SimulationRun['origin']): string {
  const date = new Date(value);
  const prefix = origin === 'legacy-csv' ? 'CSV importado em' : 'Simulação realizada em';

  if (Number.isNaN(date.getTime())) return `${prefix}: data não informada`;

  const formatted = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(date);

  return `${prefix}: ${formatted}`;
}

function formatInputCurrency(value: string): string {
  try {
    return formatCurrency(parseBrNumber(value));
  } catch {
    return value.trim() || 'Não informado';
  }
}

function formatInputRate(value: string): string {
  try {
    return `${formatNumber(parseBrNumber(value), 2)}%`;
  } catch {
    return value.trim() || 'Não informado';
  }
}

function buildParameters(inputs: SimulationInputs, prazoMeses: number | null): ReportField[] {
  const parameters: ReportField[] = [
    { label: 'Aporte inicial', value: formatInputCurrency(inputs.aporteInicial) },
    { label: 'Aporte mensal', value: formatInputCurrency(inputs.aporteMensal) }
  ];

  if (prazoMeses !== null) {
    parameters.push({
      label: 'Prazo',
      value: `${prazoMeses} ${prazoMeses === 1 ? 'mês' : 'meses'}`
    });
  }

  return parameters;
}

function buildAssumptions(inputs: SimulationInputs): ReportField[] {
  return [
    { label: 'Selic', value: formatInputRate(inputs.selic) },
    { label: 'CDI', value: formatInputRate(inputs.cdi) },
    { label: 'IPCA', value: formatInputRate(inputs.ipca) },
    { label: 'TR', value: formatInputRate(inputs.tr) }
  ];
}

function validateFinancialResult(result: SimulationRun['resultados'][number]): void {
  const values = [result.investido, result.bruto, result.liquido, result.imposto];
  if (values.some((value) => !Number.isFinite(value))) {
    throw new Error(`O resultado de ${result.nomeSimples} contém valores financeiros inválidos.`);
  }
}

function buildResults(run: SimulationRun): ReportResultItem[] {
  if (run.resultados.length === 0) {
    throw new Error('Não há resultados para exportar.');
  }

  const ordered = sortResultsByNetValue(run.resultados);
  ordered.forEach(validateFinancialResult);
  const winner = ordered[0];

  return ordered.map((result, index) => {
    const difference = result.liquido - winner.liquido;
    const percentageDifference =
      winner.liquido === 0 ? null : (difference / Math.abs(winner.liquido)) * 100;

    return {
      rank: index + 1,
      productId: result.produtoId,
      name: result.nomeSimples,
      characteristic: result.caracteristica,
      color: getProductColor(result.produtoId),
      invested: result.investido,
      gross: result.bruto,
      net: result.liquido,
      tax: result.imposto,
      taxRate: result.taxaIr,
      taxLabel: isTaxableResult(result) ? `IR: ${result.taxaIr}` : 'IR: Isento',
      netGain: netGain(result),
      accumulatedNetReturn: accumulatedNetReturn(result),
      differenceFromWinner: difference,
      percentageDifferenceFromWinner: percentageDifference,
      tiedWithWinner: index > 0 && Math.abs(difference) < 0.005
    };
  });
}

function buildBenchmark(
  benchmark: IpcaBenchmarkResult | null,
  bestResult: ReportResultItem,
  enabled: boolean
): ReportBenchmark | null {
  if (!enabled || !benchmark) return null;

  if (![benchmark.investido, benchmark.valorFinal].every(Number.isFinite)) {
    throw new Error('O benchmark do IPCA contém valores inválidos.');
  }

  return {
    name: benchmark.nome,
    description: benchmark.descricao,
    invested: benchmark.investido,
    finalValue: benchmark.valorFinal,
    gainAgainstBenchmark: bestResult.net - benchmark.valorFinal
  };
}

export function createReportModel(
  run: SimulationRun,
  options: ReportExportOptions = {}
): SimulationReportModel {
  const results = buildResults(run);
  const calculatedInputs = run.origin === 'calculated' ? run.inputs : null;
  const includeBenchmark = options.includeBenchmark ?? true;
  const benchmark = buildBenchmark(
    run.origin === 'calculated' ? run.benchmarkIpca : null,
    results[0],
    includeBenchmark
  );

  return {
    title: REPORT_TITLE,
    origin: run.origin,
    createdAt: run.createdAt,
    timestampLabel: formatTimestamp(run.createdAt, run.origin),
    parameters: calculatedInputs ? buildParameters(calculatedInputs, run.prazoMeses) : [],
    assumptions: calculatedInputs ? buildAssumptions(calculatedInputs) : [],
    rateStatus: calculatedInputs && run.rateStatus.trim() ? run.rateStatus.trim() : null,
    sourceNotice:
      run.origin === 'legacy-csv'
        ? 'Resultados importados de CSV legado. O arquivo não contém aporte inicial, aporte mensal, prazo, premissas de mercado ou histórico mensal.'
        : null,
    hasMonthlyHistory: run.hasMonthlyHistory,
    bestResult: results[0],
    results,
    benchmark,
    disclaimer: REPORT_DISCLAIMER
  };
}
