import type { IpcaBenchmarkResult } from './types';

const BENCHMARK_DESCRIPTION = 'Referência aproximada de preservação do poder de compra.';

interface BenchmarkCohort {
  valorAtual: number;
}

function assertNonNegativeFinite(value: number, fieldName: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${fieldName} deve ser um número finito e não negativo.`);
  }
}

function assertAnnualRate(annualPct: number, month?: number): void {
  const fieldName = month === undefined ? 'A taxa anual' : `A taxa anual de IPCA do mês ${month}`;

  if (!Number.isFinite(annualPct)) {
    throw new Error(`${fieldName} deve ser um número finito.`);
  }
  if (annualPct <= -100) {
    throw new Error(`${fieldName} deve ser maior que -100%.`);
  }
}

export function annualToMonthlyRate(annualPct: number): number {
  assertAnnualRate(annualPct);
  return Math.pow(1 + annualPct / 100, 1 / 12) - 1;
}

export function calcularBenchmarkIpca(
  aporteInicial: number,
  aporteMensal: number,
  taxasIpcaAnuaisPorMes: readonly number[]
): IpcaBenchmarkResult {
  assertNonNegativeFinite(aporteInicial, 'O aporte inicial');
  assertNonNegativeFinite(aporteMensal, 'O aporte mensal');

  if (taxasIpcaAnuaisPorMes.length < 1) {
    throw new Error('Informe ao menos uma taxa mensal de IPCA para calcular o benchmark.');
  }

  taxasIpcaAnuaisPorMes.forEach((taxaAnual, index) => assertAnnualRate(taxaAnual, index + 1));

  const coortes: BenchmarkCohort[] = [{ valorAtual: aporteInicial }];
  const historico = [aporteInicial];

  for (let mes = 0; mes < taxasIpcaAnuaisPorMes.length; mes += 1) {
    const taxaMensal = annualToMonthlyRate(taxasIpcaAnuaisPorMes[mes]);

    for (const coorte of coortes) {
      coorte.valorAtual *= 1 + taxaMensal;
      if (!Number.isFinite(coorte.valorAtual)) {
        throw new Error('O valor do benchmark excedeu o limite numérico suportado.');
      }
    }

    const valorNoMes = coortes.reduce((total, coorte) => total + coorte.valorAtual, 0);
    if (!Number.isFinite(valorNoMes)) {
      throw new Error('O valor do benchmark excedeu o limite numérico suportado.');
    }
    historico.push(valorNoMes);

    // Preserva o timing legado: o aporte entra no fim do mês e não existe
    // aporte adicional depois do último ponto da simulação.
    if (mes < taxasIpcaAnuaisPorMes.length - 1) {
      coortes.push({ valorAtual: aporteMensal });
    }
  }

  const meses = taxasIpcaAnuaisPorMes.length;

  return {
    kind: 'benchmark',
    benchmarkId: 'ipca-preservation',
    nome: 'Correção pelo IPCA',
    descricao: BENCHMARK_DESCRIPTION,
    investido: aporteInicial + aporteMensal * (meses - 1),
    valorFinal: historico.at(-1) ?? aporteInicial,
    historico
  };
}
