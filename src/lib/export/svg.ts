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

export interface SvgSummaryAsset {
  svg: string;
  width: number;
  height: number;
}

const WIDTH = 1200;
const MARGIN = 72;
const CONTENT_WIDTH = WIDTH - MARGIN * 2;
const SECTION_GAP = 26;

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function truncate(value: string, maximumLength: number): string {
  if (value.length <= maximumLength) return value;
  return `${value.slice(0, Math.max(1, maximumLength - 1)).trimEnd()}…`;
}

function wrapText(value: string, maximumCharacters: number): string[] {
  const words = value.trim().split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }

    if (`${current} ${word}`.length <= maximumCharacters) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines.length > 0 ? lines : [''];
}

function textLines(
  lines: string[],
  x: number,
  y: number,
  lineHeight: number,
  className: string
): string {
  return `<text x="${x}" y="${y}" class="${className}">${lines
    .map(
      (line, index) =>
        `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`
    )
    .join('')}</text>`;
}

function signedCurrency(value: number): string {
  if (Math.abs(value) < 0.005) return formatCurrency(0);
  return `${value > 0 ? '+' : '−'} ${svgCurrency(Math.abs(value), 18)}`;
}

function signedPercent(value: number | null): string {
  if (value === null) return '—';
  if (Math.abs(value) < 0.005) return '0,00%';
  return `${value > 0 ? '+' : '−'}${formatNumber(Math.abs(value), 2)}%`;
}

function compactCurrency(value: number): string {
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000_000_000_000) {
    return `R$ ${value.toExponential(2).replace('.', ',')}`;
  }

  const units = [
    { threshold: 1_000_000_000_000, divisor: 1_000_000_000_000, suffix: 'tri' },
    { threshold: 1_000_000_000, divisor: 1_000_000_000, suffix: 'bi' },
    { threshold: 1_000_000, divisor: 1_000_000, suffix: 'mi' },
    { threshold: 1_000, divisor: 1_000, suffix: 'mil' }
  ];
  const unit = units.find((candidate) => absolute >= candidate.threshold);
  if (!unit) return formatCurrency(value);

  return `R$ ${formatNumber(value / unit.divisor, 2)} ${unit.suffix}`;
}

function svgCurrency(value: number, maximumCharacters = 22): string {
  const exact = formatCurrency(value);
  return exact.length <= maximumCharacters ? exact : compactCurrency(value);
}

function card(x: number, y: number, width: number, height: number, extraClass = ''): string {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="22" class="card ${extraClass}"/>`;
}

function renderFieldRow(fields: ReportField[], y: number): string {
  const columnWidth = (CONTENT_WIDTH - 60) / fields.length;
  return fields
    .map((field, index) => {
      const x = MARGIN + 30 + columnWidth * index;
      return [
        `<text x="${x}" y="${y}" class="label">${escapeXml(field.label)}</text>`,
        `<text x="${x}" y="${y + 29}" class="field-value">${escapeXml(truncate(field.value, 25))}</text>`
      ].join('');
    })
    .join('');
}

function renderParameters(model: SimulationReportModel, y: number): { markup: string; height: number } {
  if (model.parameters.length === 0 && model.assumptions.length === 0) {
    const height = 122;
    const notice = model.sourceNotice ?? 'Parâmetros e premissas não disponíveis.';
    return {
      height,
      markup: [
        card(MARGIN, y, CONTENT_WIDTH, height, 'notice-card'),
        `<text x="${MARGIN + 30}" y="${y + 38}" class="section-title">ORIGEM DOS DADOS</text>`,
        textLines(wrapText(notice, 104).slice(0, 2), MARGIN + 30, y + 72, 24, 'body-muted')
      ].join('')
    };
  }

  const height = 210;
  return {
    height,
    markup: [
      card(MARGIN, y, CONTENT_WIDTH, height),
      `<text x="${MARGIN + 30}" y="${y + 38}" class="section-title">PARÂMETROS</text>`,
      renderFieldRow(model.parameters, y + 68),
      `<line x1="${MARGIN + 30}" y1="${y + 116}" x2="${WIDTH - MARGIN - 30}" y2="${y + 116}" class="divider"/>`,
      `<text x="${MARGIN + 30}" y="${y + 146}" class="section-title">PREMISSAS DE MERCADO</text>`,
      renderFieldRow(model.assumptions, y + 169)
    ].join('')
  };
}

function renderBestResult(
  result: ReportResultItem,
  model: SimulationReportModel,
  y: number
): { markup: string; height: number } {
  const height = 242;
  const period = model.parameters.find((field) => field.label === 'Prazo')?.value ?? 'Não informado';

  const details: ReportField[] = [
    { label: 'Total investido', value: svgCurrency(result.invested, 20) },
    { label: 'Rendimento líquido', value: signedCurrency(result.netGain) },
    { label: 'Retorno no período', value: signedPercent(result.accumulatedNetReturn) },
    { label: 'Prazo', value: period },
    { label: 'Tributação', value: result.taxLabel }
  ];
  const detailWidth = (CONTENT_WIDTH - 60) / details.length;

  return {
    height,
    markup: [
      card(MARGIN, y, CONTENT_WIDTH, height, 'best-card'),
      `<rect x="${MARGIN}" y="${y}" width="8" height="${height}" rx="4" fill="${result.color}"/>`,
      `<text x="${MARGIN + 34}" y="${y + 40}" class="section-title">MELHOR RESULTADO DA SIMULAÇÃO</text>`,
      `<circle cx="${MARGIN + 42}" cy="${y + 88}" r="8" fill="${result.color}"/>`,
      `<text x="${MARGIN + 62}" y="${y + 96}" class="product-title">${escapeXml(truncate(result.name, 32))}</text>`,
      `<text x="${MARGIN + 62}" y="${y + 125}" class="body-muted">${escapeXml(truncate(result.characteristic, 48))}</text>`,
      `<text x="${WIDTH - MARGIN - 30}" y="${y + 88}" text-anchor="end" class="best-value">${escapeXml(svgCurrency(result.net, 24))}</text>`,
      `<text x="${WIDTH - MARGIN - 30}" y="${y + 116}" text-anchor="end" class="label">PATRIMÔNIO LÍQUIDO FINAL</text>`,
      `<line x1="${MARGIN + 30}" y1="${y + 151}" x2="${WIDTH - MARGIN - 30}" y2="${y + 151}" class="divider"/>`,
      ...details.flatMap((detail, index) => {
        const x = MARGIN + 30 + detailWidth * index;
        return [
          `<text x="${x}" y="${y + 181}" class="label">${escapeXml(detail.label)}</text>`,
          `<text x="${x}" y="${y + 212}" class="detail-value">${escapeXml(truncate(detail.value, 24))}</text>`
        ];
      })
    ].join('')
  };
}

function renderBarChart(model: SimulationReportModel, y: number): { markup: string; height: number } {
  const items = model.results.map((result) => ({
    name: result.name,
    value: result.net,
    color: result.color,
    reference: false
  }));

  if (model.benchmark) {
    items.push({
      name: `${model.benchmark.name} · referência`,
      value: model.benchmark.finalValue,
      color: '#cbd5e1',
      reference: true
    });
  }

  const rowHeight = 70;
  const height = 82 + items.length * rowHeight + 22;
  const maxValue = Math.max(...items.map((item) => Math.abs(item.value)), 1);
  const barWidth = CONTENT_WIDTH - 60;

  const rows = items.map((item, index) => {
    const rowY = y + 73 + index * rowHeight;
    const width = Math.max(0, Math.min(barWidth, (Math.abs(item.value) / maxValue) * barWidth));

    return [
      `<circle cx="${MARGIN + 36}" cy="${rowY}" r="6" fill="${item.color}" class="${item.reference ? 'reference-mark' : ''}"/>`,
      `<text x="${MARGIN + 53}" y="${rowY + 6}" class="bar-name">${escapeXml(truncate(item.name, 34))}</text>`,
      `<text x="${WIDTH - MARGIN - 30}" y="${rowY + 6}" text-anchor="end" class="bar-value">${escapeXml(svgCurrency(item.value, 18))}</text>`,
      `<rect x="${MARGIN + 30}" y="${rowY + 18}" width="${barWidth}" height="13" rx="6.5" class="bar-track"/>`,
      `<rect x="${MARGIN + 30}" y="${rowY + 18}" width="${width.toFixed(2)}" height="13" rx="6.5" fill="${item.color}" class="${item.reference ? 'reference-bar' : ''}"/>`
    ].join('');
  });

  return {
    height,
    markup: [
      card(MARGIN, y, CONTENT_WIDTH, height),
      `<text x="${MARGIN + 30}" y="${y + 42}" class="section-title">${model.benchmark ? 'PATRIMÔNIO FINAL E REFERÊNCIA' : 'PATRIMÔNIO FINAL LÍQUIDO'}</text>`,
      ...rows
    ].join('')
  };
}

function comparisonLabel(result: ReportResultItem): string {
  if (result.rank === 1) return 'Melhor resultado';
  if (result.tiedWithWinner) return 'Mesmo resultado líquido';
  return `${signedCurrency(result.differenceFromWinner)}  |  ${signedPercent(result.percentageDifferenceFromWinner)}`;
}

function renderRanking(results: ReportResultItem[], y: number): { markup: string; height: number } {
  const rowHeight = 68;
  const height = 78 + results.length * rowHeight + 18;
  const rows = results.map((result, index) => {
    const rowTop = y + 65 + index * rowHeight;
    const separator = index === results.length - 1
      ? ''
      : `<line x1="${MARGIN + 30}" y1="${rowTop + 56}" x2="${WIDTH - MARGIN - 30}" y2="${rowTop + 56}" class="divider"/>`;

    return [
      `<text x="${MARGIN + 34}" y="${rowTop + 23}" class="rank-number">${result.rank}</text>`,
      `<circle cx="${MARGIN + 76}" cy="${rowTop + 17}" r="6" fill="${result.color}"/>`,
      `<text x="${MARGIN + 94}" y="${rowTop + 15}" class="ranking-name">${escapeXml(truncate(result.name, 28))}</text>`,
      `<text x="${MARGIN + 94}" y="${rowTop + 39}" class="ranking-characteristic">${escapeXml(truncate(result.characteristic, 38))}</text>`,
      `<text x="${MARGIN + 700}" y="${rowTop + 21}" text-anchor="end" class="ranking-value">${escapeXml(svgCurrency(result.net, 18))}</text>`,
      `<text x="${WIDTH - MARGIN - 30}" y="${rowTop + 21}" text-anchor="end" class="ranking-comparison ${result.rank === 1 ? 'positive' : ''}">${escapeXml(comparisonLabel(result))}</text>`,
      separator
    ].join('');
  });

  return {
    height,
    markup: [
      card(MARGIN, y, CONTENT_WIDTH, height),
      `<text x="${MARGIN + 30}" y="${y + 42}" class="section-title">COMPARATIVO COMPLETO</text>`,
      ...rows
    ].join('')
  };
}

function renderBenchmark(model: SimulationReportModel, y: number): { markup: string; height: number } | null {
  if (!model.benchmark) return null;
  const height = 158;
  const description = wrapText(model.benchmark.description, 68).slice(0, 2);

  return {
    height,
    markup: [
      card(MARGIN, y, CONTENT_WIDTH, height, 'benchmark-card'),
      `<text x="${MARGIN + 30}" y="${y + 39}" class="section-title">BENCHMARK · ${escapeXml(model.benchmark.name.toUpperCase())}</text>`,
      textLines(description, MARGIN + 30, y + 75, 23, 'body-muted'),
      `<text x="${WIDTH - MARGIN - 30}" y="${y + 64}" text-anchor="end" class="benchmark-value">${escapeXml(svgCurrency(model.benchmark.finalValue, 24))}</text>`,
      `<text x="${WIDTH - MARGIN - 30}" y="${y + 91}" text-anchor="end" class="label">VALOR CORRIGIDO PELO IPCA</text>`,
      `<text x="${WIDTH - MARGIN - 30}" y="${y + 128}" text-anchor="end" class="detail-value">Ganho real aproximado: ${escapeXml(signedCurrency(model.benchmark.gainAgainstBenchmark))}</text>`
    ].join('')
  };
}

export function renderSummarySvg(model: SimulationReportModel): SvgSummaryAsset {
  const body: string[] = [];
  let y = 178;

  const parameters = renderParameters(model, y);
  body.push(parameters.markup);
  y += parameters.height + SECTION_GAP;

  const best = renderBestResult(model.bestResult, model, y);
  body.push(best.markup);
  y += best.height + SECTION_GAP;

  const chart = renderBarChart(model, y);
  body.push(chart.markup);
  y += chart.height + SECTION_GAP;

  const ranking = renderRanking(model.results, y);
  body.push(ranking.markup);
  y += ranking.height + SECTION_GAP;

  const benchmark = renderBenchmark(model, y);
  if (benchmark) {
    body.push(benchmark.markup);
    y += benchmark.height + SECTION_GAP;
  }

  const disclaimerLines = wrapText(model.disclaimer, 104).slice(0, 2);
  const footerHeight = 98;
  body.push(
    card(MARGIN, y, CONTENT_WIDTH, footerHeight, 'notice-card'),
    `<text x="${MARGIN + 30}" y="${y + 35}" class="section-title">AVISO</text>`,
    textLines(disclaimerLines, MARGIN + 30, y + 65, 23, 'body-muted')
  );
  y += footerHeight + 60;

  const height = Math.ceil(y);
  const sourceLine = model.sourceNotice ? 'Dados importados de CSV legado' : 'Resumo da simulação';
  const historyLine = model.hasMonthlyHistory ? '' : ' · sem histórico mensal';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}" role="img" aria-labelledby="report-title report-description">
  <title id="report-title">${escapeXml(model.title)}</title>
  <desc id="report-description">Resumo da simulação com melhor resultado, gráfico de barras e ranking.</desc>
  <style>
    text { font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .card { fill: #111827; stroke: #2a374b; stroke-width: 1.5; }
    .best-card { fill: #111b2d; }
    .benchmark-card { fill: #10231f; stroke: #235248; }
    .notice-card { fill: #0d1726; }
    .divider { stroke: #2a374b; stroke-width: 1; }
    .eyebrow { fill: #38bdf8; font-size: 16px; font-weight: 800; letter-spacing: 2.5px; }
    .title { fill: #f8fafc; font-size: 40px; font-weight: 850; }
    .subtitle { fill: #94a3b8; font-size: 17px; }
    .section-title { fill: #94a3b8; font-size: 15px; font-weight: 800; letter-spacing: 1.5px; }
    .label { fill: #94a3b8; font-size: 13px; font-weight: 700; letter-spacing: .4px; }
    .field-value, .detail-value { fill: #e2e8f0; font-size: 19px; font-weight: 700; }
    .body-muted { fill: #a9b7ca; font-size: 17px; }
    .product-title { fill: #f8fafc; font-size: 31px; font-weight: 850; }
    .best-value { fill: #f8fafc; font-size: 36px; font-weight: 850; }
    .bar-name { fill: #e2e8f0; font-size: 17px; font-weight: 700; }
    .bar-value { fill: #f8fafc; font-size: 17px; font-weight: 750; }
    .bar-track { fill: #253247; }
    .reference-mark { fill: #07101d; stroke: #cbd5e1; stroke-width: 2; }
    .reference-bar { opacity: .72; stroke: #f8fafc; stroke-width: 1; stroke-dasharray: 8 6; }
    .rank-number { fill: #94a3b8; font-size: 17px; font-weight: 800; }
    .ranking-name { fill: #f8fafc; font-size: 18px; font-weight: 800; }
    .ranking-characteristic { fill: #94a3b8; font-size: 14px; }
    .ranking-value { fill: #f8fafc; font-size: 18px; font-weight: 800; }
    .ranking-comparison { fill: #94a3b8; font-size: 14px; font-weight: 700; }
    .ranking-comparison.positive { fill: #34d399; }
    .benchmark-value { fill: #6ee7b7; font-size: 29px; font-weight: 850; }
  </style>
  <rect width="${WIDTH}" height="${height}" fill="#07101d"/>
  <circle cx="${MARGIN + 12}" cy="72" r="12" fill="#f59e0b"/>
  <text x="${MARGIN + 40}" y="61" class="eyebrow">RELATÓRIO</text>
  <text id="report-heading" x="${MARGIN + 40}" y="105" class="title">${escapeXml(model.title)}</text>
  <text x="${MARGIN + 40}" y="139" class="subtitle">${escapeXml(model.timestampLabel)}</text>
  <text x="${WIDTH - MARGIN}" y="139" text-anchor="end" class="subtitle">${escapeXml(`${sourceLine}${historyLine}`)}</text>
  ${body.join('')}
</svg>`;

  return { svg, width: WIDTH, height };
}

export function createSummarySvgAsset(
  run: SimulationRun,
  options: ReportExportOptions = {}
): SvgSummaryAsset {
  return renderSummarySvg(createReportModel(run, options));
}

export function createSummarySvg(
  run: SimulationRun,
  options: ReportExportOptions = {}
): string {
  return createSummarySvgAsset(run, options).svg;
}

export function downloadSummarySvg(
  run: SimulationRun,
  options: ReportExportOptions = {},
  filename = createDownloadFilename('svg', run.createdAt)
): void {
  downloadTextFile(createSummarySvg(run, options), filename, 'image/svg+xml;charset=utf-8');
}
