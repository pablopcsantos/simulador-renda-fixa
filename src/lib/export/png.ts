import type { SimulationRun } from '../types';
import { createDownloadFilename, downloadBlob } from './download.ts';
import type { ReportExportOptions } from './reportModel';
import { createSummarySvgAsset, type SvgSummaryAsset } from './svg.ts';

const PNG_SCALE = 2;

function assertCanvasEnvironment(): void {
  if (
    typeof document === 'undefined' ||
    typeof Image === 'undefined' ||
    typeof FileReader === 'undefined'
  ) {
    throw new Error('A exportação de imagem só está disponível no aplicativo aberto no navegador.');
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Não foi possível preparar o SVG para conversão.'));
    };
    reader.onerror = () => reject(new Error('Não foi possível ler o resumo em SVG.'));
    reader.readAsDataURL(blob);
  });
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Não foi possível renderizar o resumo em SVG.'));
    image.src = source;
  });
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Não foi possível gerar o arquivo PNG.'));
    }, 'image/png');
  });
}

export async function svgSummaryToPngBlob(asset: SvgSummaryAsset): Promise<Blob> {
  assertCanvasEnvironment();

  const svgBlob = new Blob([asset.svg], { type: 'image/svg+xml;charset=utf-8' });
  const image = await loadImage(await blobToDataUrl(svgBlob));
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(asset.width * PNG_SCALE);
  canvas.height = Math.ceil(asset.height * PNG_SCALE);

  const context = canvas.getContext('2d');
  if (!context) throw new Error('O navegador não disponibilizou o contexto de imagem.');

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.scale(PNG_SCALE, PNG_SCALE);
  context.drawImage(image, 0, 0, asset.width, asset.height);

  return canvasToPngBlob(canvas);
}

export async function createSummaryPngBlob(
  run: SimulationRun,
  options: ReportExportOptions = {}
): Promise<Blob> {
  return svgSummaryToPngBlob(createSummarySvgAsset(run, options));
}

export async function downloadSummaryPng(
  run: SimulationRun,
  options: ReportExportOptions = {},
  filename = createDownloadFilename('png', run.createdAt)
): Promise<void> {
  downloadBlob(await createSummaryPngBlob(run, options), filename);
}
