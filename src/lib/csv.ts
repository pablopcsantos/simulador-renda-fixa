import { formatCurrency, parseBrNumber } from './formatting';
import type { InvestmentResult } from './types';

const HEADERS = ['Ativo', 'Valor Investido', 'Valor Bruto', 'Valor Liquido', 'Imposto Pago', 'Taxa de IR'];

function csvCell(value: string): string {
  const escaped = value.replaceAll('"', '""');
  return `"${escaped}"`;
}

export function resultadosParaCsv(resultados: InvestmentResult[]): string {
  const rows = [HEADERS.map(csvCell).join(';')];

  for (const r of resultados) {
    rows.push(
      [
        r.nome,
        formatCurrency(r.investido),
        formatCurrency(r.bruto),
        formatCurrency(r.liquido),
        formatCurrency(r.imposto),
        r.taxaIr
      ]
        .map(csvCell)
        .join(';')
    );
  }

  return `\uFEFF${rows.join('\r\n')}`;
}

export function baixarCsv(resultados: InvestmentResult[]): void {
  const csv = resultadosParaCsv(resultados);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'simulacao-renda-fixa.csv';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function splitSemicolonCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ';' && !quoted) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
}

export function importarResultadosCsv(content: string): InvestmentResult[] {
  const text = content.replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) throw new Error('O CSV não contém resultados para importar.');

  const resultados: InvestmentResult[] = [];

  for (const line of lines.slice(1)) {
    const row = splitSemicolonCsvLine(line);
    if (row.length !== 6) continue;

    const [ativo, investido, bruto, liquido, imposto, taxaIr] = row;
    const valorLiquido = parseBrNumber(liquido);

    resultados.push({
      nome: ativo,
      nomeSimples: ativo.split(' (')[0],
      investido: parseBrNumber(investido),
      bruto: parseBrNumber(bruto),
      liquido: valorLiquido,
      imposto: parseBrNumber(imposto),
      taxaIr,
      // Igual à importação da versão Python: o CSV não contém o histórico mensal.
      historico: [0, valorLiquido]
    });
  }

  if (resultados.length === 0) {
    throw new Error('Nenhuma linha compatível foi encontrada no CSV.');
  }

  return resultados;
}
