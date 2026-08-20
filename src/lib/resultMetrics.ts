import type { InvestmentResult } from './types';

export function sortResultsByNetValue(results: InvestmentResult[]): InvestmentResult[] {
  return [...results].sort((a, b) => b.liquido - a.liquido);
}

export function netGain(result: InvestmentResult): number {
  return result.liquido - result.investido;
}

export function accumulatedNetReturn(result: InvestmentResult): number | null {
  if (result.investido === 0) return null;
  return (netGain(result) / result.investido) * 100;
}

export function isTaxableResult(result: InvestmentResult): boolean {
  return result.taxaIr !== 'Isento';
}
