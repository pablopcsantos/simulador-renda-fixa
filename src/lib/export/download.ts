const DEFAULT_REVOKE_DELAY_MS = 1_000;

function assertDownloadEnvironment(): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined') {
    throw new Error('O download só está disponível no aplicativo aberto no navegador.');
  }
}

export function createDownloadFilename(
  extension: 'txt' | 'svg' | 'png',
  createdAt?: string
): string {
  const date = createdAt ? new Date(createdAt) : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const timestamp = safeDate.toISOString().replace(/[:.]/g, '-');
  return `simulacao-renda-fixa-${timestamp}.${extension}`;
}

export function downloadBlob(blob: Blob, filename: string): void {
  assertDownloadEnvironment();

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.hidden = true;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), DEFAULT_REVOKE_DELAY_MS);
}

export function downloadTextFile(
  content: string,
  filename: string,
  mimeType = 'text/plain;charset=utf-8'
): void {
  downloadBlob(new Blob([content], { type: mimeType }), filename);
}
