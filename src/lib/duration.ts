import { parseBrNumber } from './formatting.ts';
import type { PrazoUnidade } from './types';

export const MAX_SIMULATION_MONTHS = 1200;

export function durationInMonths(value: string | number, unit: PrazoUnidade): number {
  const duration = parseBrNumber(value);
  if (!Number.isSafeInteger(duration)) {
    throw new Error('O prazo deve ser informado como um número inteiro.');
  }
  return unit === 'Anos' ? duration * 12 : duration;
}

export function formatDuration(months: number): string {
  const safeMonths = Math.max(1, Math.trunc(months));
  if (safeMonths < 12) return `${safeMonths} ${safeMonths === 1 ? 'mês' : 'meses'}`;

  const years = Math.floor(safeMonths / 12);
  const remainingMonths = safeMonths % 12;
  const yearsLabel = `${years} ${years === 1 ? 'ano' : 'anos'}`;

  if (remainingMonths === 0) return `${safeMonths} meses (${yearsLabel})`;
  return `${safeMonths} meses (${yearsLabel} e ${remainingMonths} ${remainingMonths === 1 ? 'mês' : 'meses'})`;
}
