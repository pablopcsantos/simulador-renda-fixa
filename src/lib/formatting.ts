export function parseBrNumber(value: string | number): number {
  let text = String(value).replace('R$', '').replace('%', '').trim();

  if (text.includes('.') && text.includes(',')) {
    text = text.replaceAll('.', '').replace(',', '.');
  } else if (text.includes(',')) {
    text = text.replace(',', '.');
  }

  const parsed = Number(text);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Valor numérico inválido: ${value}`);
  }
  return parsed;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

export function formatNumber(value: number, digits = 2): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(value);
}

export function formatPercent(value: number, digits = 2): string {
  return `${formatNumber(value, digits)}%`;
}
