import { formatCurrency, formatNumber } from '../formatting.ts';
import type { SimulationRun } from '../types';
import { downloadBlob } from './download.ts';
import {
  createReportModel,
  type ReportExportOptions,
  type SimulationReportModel
} from './reportModel.ts';

type PdfDocument = import('jspdf').jsPDF;

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 15;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function safeText(value: string): string {
  return value
    .replaceAll('−', '-')
    .replaceAll('—', '-')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .trim();
}

function pdfFilename(createdAt: string): string {
  const date = new Date(createdAt);
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  return `simulacao-renda-fixa-${safeDate.toISOString().replace(/[:.]/g, '-')}.pdf`;
}

function pdfCurrency(value: number): string {
  const exact = formatCurrency(value);
  if (exact.length <= 22) return exact;

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
  return unit ? `R$ ${formatNumber(value / unit.divisor, 2)} ${unit.suffix}` : exact;
}

class PdfLayout {
  y = MARGIN;
  readonly doc: PdfDocument;

  constructor(doc: PdfDocument) {
    this.doc = doc;
  }

  ensureSpace(height: number): void {
    if (this.y + height <= PAGE_HEIGHT - MARGIN) return;
    this.doc.addPage();
    this.y = MARGIN;
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(8);
    this.doc.setTextColor('#64748b');
    this.doc.text('Simulador de Renda Fixa - continuação', MARGIN, this.y);
    this.y += 8;
  }

  section(title: string): void {
    this.ensureSpace(12);
    this.y += 3;
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(10);
    this.doc.setTextColor('#0369a1');
    this.doc.text(safeText(title).toUpperCase(), MARGIN, this.y);
    this.y += 6;
  }

  line(label: string, value: string): void {
    this.ensureSpace(6);
    this.doc.setFontSize(9);
    this.doc.setTextColor('#475569');
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(`${safeText(label)}:`, MARGIN, this.y);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor('#0f172a');
    this.doc.text(safeText(value), MARGIN + 42, this.y, { maxWidth: CONTENT_WIDTH - 42 });
    this.y += 5;
  }

  paragraph(text: string, options: { color?: string; fontSize?: number; bold?: boolean } = {}): void {
    const fontSize = options.fontSize ?? 9;
    this.doc.setFont('helvetica', options.bold ? 'bold' : 'normal');
    this.doc.setFontSize(fontSize);
    this.doc.setTextColor(options.color ?? '#334155');
    const lines = this.doc.splitTextToSize(safeText(text), CONTENT_WIDTH) as string[];
    const lineHeight = fontSize * 0.42 + 1.4;
    this.ensureSpace(lines.length * lineHeight + 2);
    this.doc.text(lines, MARGIN, this.y);
    this.y += lines.length * lineHeight + 2;
  }
}

function renderHeader(layout: PdfLayout, model: SimulationReportModel): void {
  const { doc } = layout;
  doc.setFillColor('#0f172a');
  doc.roundedRect(MARGIN, MARGIN, CONTENT_WIDTH, 28, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor('#ffffff');
  doc.text(model.title, MARGIN + 7, MARGIN + 11);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor('#bae6fd');
  doc.text(safeText(model.timestampLabel), MARGIN + 7, MARGIN + 20);
  layout.y = MARGIN + 36;
}

function renderBestResult(layout: PdfLayout, model: SimulationReportModel): void {
  const { doc } = layout;
  const best = model.bestResult;
  layout.section('Melhor resultado da simulação');
  layout.ensureSpace(32);
  doc.setFillColor('#f8fafc');
  doc.setDrawColor(best.color);
  doc.setLineWidth(1.2);
  doc.roundedRect(MARGIN, layout.y, CONTENT_WIDTH, 26, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor('#0f172a');
  doc.text(safeText(best.name), MARGIN + 5, layout.y + 7);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor('#64748b');
  doc.text(safeText(best.characteristic), MARGIN + 5, layout.y + 13);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor('#047857');
  doc.text(pdfCurrency(best.net), PAGE_WIDTH - MARGIN - 5, layout.y + 9, { align: 'right' });
  doc.setFontSize(8);
  doc.setTextColor('#334155');
  doc.text(`Rendimento líquido: ${pdfCurrency(best.netGain)}`, PAGE_WIDTH - MARGIN - 5, layout.y + 16, { align: 'right' });
  doc.text(safeText(best.taxLabel), PAGE_WIDTH - MARGIN - 5, layout.y + 22, { align: 'right' });
  layout.y += 31;
}

function renderBarChart(layout: PdfLayout, model: SimulationReportModel): void {
  const { doc } = layout;
  const benchmarkValue = model.benchmark?.finalValue ?? 0;
  const maxValue = Math.max(1, benchmarkValue, ...model.results.map((result) => result.net));
  const items = model.results.map((result) => ({
    label: result.name,
    value: result.net,
    color: result.color,
    reference: false
  }));
  if (model.benchmark) {
    items.push({
      label: `${model.benchmark.name} (referência)`,
      value: model.benchmark.finalValue,
      color: '#94a3b8',
      reference: true
    });
  }

  layout.section('Gráfico comparativo');
  const barX = MARGIN + 58;
  const barWidth = CONTENT_WIDTH - 58;

  for (const item of items) {
    layout.ensureSpace(10);
    doc.setFont('helvetica', item.reference ? 'italic' : 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor('#334155');
    doc.text(safeText(item.label), MARGIN, layout.y + 3, { maxWidth: 54 });
    doc.setFillColor('#e2e8f0');
    doc.roundedRect(barX, layout.y, barWidth, 4, 1, 1, 'F');
    doc.setFillColor(item.color);
    doc.roundedRect(barX, layout.y, Math.max(0.8, (Math.max(0, item.value) / maxValue) * barWidth), 4, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor('#0f172a');
    doc.text(pdfCurrency(item.value), PAGE_WIDTH - MARGIN, layout.y + 8, { align: 'right' });
    layout.y += 11;
  }
}

function renderRankingAndDetails(layout: PdfLayout, model: SimulationReportModel): void {
  layout.section('Ranking e resultados');

  for (const result of model.results) {
    layout.ensureSpace(28);
    layout.doc.setDrawColor('#cbd5e1');
    layout.doc.setLineWidth(0.25);
    layout.doc.line(MARGIN, layout.y - 2, PAGE_WIDTH - MARGIN, layout.y - 2);
    layout.paragraph(`${result.rank}. ${result.name} — ${result.characteristic}`, {
      bold: true,
      color: result.color,
      fontSize: 10
    });
    layout.line('Patrimônio líquido', pdfCurrency(result.net));
    layout.line('Total investido', pdfCurrency(result.invested));
    layout.line('Rendimento bruto', pdfCurrency(result.gross - result.invested));
    layout.line('Rendimento líquido', pdfCurrency(result.netGain));
    layout.line('Tributação', result.taxLabel);
    if (result.rank > 1 && !result.tiedWithWinner) {
      const percentage = result.percentageDifferenceFromWinner === null
        ? '—'
        : `−${formatNumber(Math.abs(result.percentageDifferenceFromWinner), 2)}%`;
      layout.line('Diferença para o vencedor', `− ${pdfCurrency(Math.abs(result.differenceFromWinner))} (${percentage})`);
    }
    layout.y += 3;
  }
}

function renderMethodology(layout: PdfLayout, model: SimulationReportModel): void {
  layout.section('Metodologia resumida');
  if (model.origin === 'legacy-csv') {
    layout.paragraph('Os resultados desta exportação foram importados de um CSV legado e não foram recalculados. Premissas e histórico mensal não constavam no arquivo.');
  } else {
    layout.paragraph('O simulador converte taxas anuais para equivalentes mensais compostas. O aporte inicial entra no início; aportes mensais entram ao final de cada mês, exceto após o último mês. O IR regressivo é estimado separadamente pela idade de cada aporte nos produtos tributáveis. Por compatibilidade com o modelo legado, o Tesouro IPCA+ usa a soma simples de IPCA e componente fixo.');
  }
  if (model.benchmark) {
    layout.paragraph('A referência de correção pelo IPCA trata cada aporte como uma coorte: cada valor é corrigido apenas durante os meses em que esteve presente. Ela representa preservação aproximada do poder de compra e não é um investimento.');
  }
}

function renderReportPdf(doc: PdfDocument, model: SimulationReportModel): void {
  const layout = new PdfLayout(doc);
  renderHeader(layout, model);

  if (model.sourceNotice) {
    layout.paragraph(model.sourceNotice, { color: '#92400e', bold: true });
  }

  if (model.parameters.length > 0) {
    layout.section('Parâmetros');
    model.parameters.forEach((field) => layout.line(field.label, field.value));
  }
  if (model.assumptions.length > 0) {
    layout.section('Premissas de mercado');
    model.assumptions.forEach((field) => layout.line(field.label, field.value));
    if (model.rateStatus) layout.paragraph(model.rateStatus, { color: '#64748b', fontSize: 8 });
  }

  renderBestResult(layout, model);
  if (model.benchmark) {
    layout.section('Benchmark IPCA');
    layout.line('Valor corrigido pelo IPCA', pdfCurrency(model.benchmark.finalValue));
    layout.line('Ganho real aproximado do vencedor', pdfCurrency(model.benchmark.gainAgainstBenchmark));
    layout.paragraph(model.benchmark.description, { color: '#64748b', fontSize: 8 });
  }
  renderBarChart(layout, model);
  renderRankingAndDetails(layout, model);
  renderMethodology(layout, model);
  layout.section('Aviso');
  layout.paragraph(model.disclaimer, { color: '#9a3412', bold: true });

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor('#94a3b8');
    doc.text(`Página ${page} de ${pages}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 7, { align: 'right' });
  }
}

export async function createPdfReportBlob(
  run: SimulationRun,
  options: ReportExportOptions = {}
): Promise<Blob> {
  // jsPDF é a única dependência de exportação e fica fora do bundle inicial:
  // o navegador a carrega apenas quando o usuário solicita um PDF.
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  renderReportPdf(doc, createReportModel(run, options));
  return doc.output('blob');
}

export async function downloadPdfReport(
  run: SimulationRun,
  options: ReportExportOptions = {}
): Promise<void> {
  downloadBlob(await createPdfReportBlob(run, options), pdfFilename(run.createdAt));
}
