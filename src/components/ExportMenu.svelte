<script lang="ts">
  import {
    createTextReport,
    downloadPdfReport,
    downloadSummaryPng,
    downloadTextReport
  } from '../lib/export';
  import type { SimulationRun } from '../lib/types';

  export let run: SimulationRun;
  export let includeBenchmark = false;

  let busyAction: 'copy' | 'text' | 'image' | 'pdf' | null = null;
  let statusMessage = '';
  let menuElement: HTMLDetailsElement | undefined;

  function options(): { includeBenchmark: boolean } {
    return { includeBenchmark };
  }

  function copyWithFallback(text: string): boolean {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    return copied;
  }

  async function copyText(): Promise<void> {
    busyAction = 'copy';
    statusMessage = '';

    try {
      const report = createTextReport(run, options());
      let copied = false;

      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(report);
          copied = true;
        } catch {
          // WebViews e contextos sem permissão podem expor a API e ainda assim recusá-la.
        }
      }

      if (!copied && !copyWithFallback(report)) {
        throw new Error('O navegador recusou o acesso à área de transferência.');
      }
      statusMessage = 'Resumo copiado para a área de transferência.';
      if (menuElement) menuElement.open = false;
    } catch (error) {
      statusMessage = error instanceof Error ? error.message : 'Não foi possível copiar o texto.';
    } finally {
      busyAction = null;
    }
  }

  function downloadText(): void {
    busyAction = 'text';
    statusMessage = '';
    try {
      downloadTextReport(run, options());
      statusMessage = 'Arquivo de texto gerado.';
      if (menuElement) menuElement.open = false;
    } catch (error) {
      statusMessage = error instanceof Error ? error.message : 'Não foi possível gerar o texto.';
    } finally {
      busyAction = null;
    }
  }

  async function downloadImage(): Promise<void> {
    busyAction = 'image';
    statusMessage = '';
    try {
      await downloadSummaryPng(run, options());
      statusMessage = 'Imagem PNG gerada em alta resolução.';
      if (menuElement) menuElement.open = false;
    } catch (error) {
      statusMessage = error instanceof Error ? error.message : 'Não foi possível gerar a imagem.';
    } finally {
      busyAction = null;
    }
  }

  async function downloadPdf(): Promise<void> {
    busyAction = 'pdf';
    statusMessage = '';
    try {
      await downloadPdfReport(run, options());
      statusMessage = 'PDF gerado com sucesso.';
      if (menuElement) menuElement.open = false;
    } catch (error) {
      statusMessage = error instanceof Error ? error.message : 'Não foi possível gerar o PDF.';
    } finally {
      busyAction = null;
    }
  }
</script>

<div class="export-menu-wrap">
  <details class="export-menu" bind:this={menuElement}>
    <summary aria-label="Abrir opções para exportar relatório">Exportar relatório <span aria-hidden="true">⌄</span></summary>
    <div class="export-menu-popover">
      <button type="button" disabled={busyAction !== null} onclick={copyText}>
        <strong>{busyAction === 'copy' ? 'Copiando…' : 'Copiar texto'}</strong>
        <span>Resumo legível para colar</span>
      </button>
      <button type="button" disabled={busyAction !== null} onclick={downloadText}>
        <strong>{busyAction === 'text' ? 'Gerando…' : 'Baixar texto'}</strong>
        <span>Arquivo .txt em UTF-8</span>
      </button>
      <button type="button" disabled={busyAction !== null} onclick={downloadImage}>
        <strong>{busyAction === 'image' ? 'Renderizando…' : 'Exportar imagem'}</strong>
        <span>Resumo PNG em alta resolução</span>
      </button>
      <button type="button" disabled={busyAction !== null} onclick={downloadPdf}>
        <strong>{busyAction === 'pdf' ? 'Montando PDF…' : 'Exportar PDF'}</strong>
        <span>Relatório completo e paginado</span>
      </button>
    </div>
  </details>
  <span class="export-status" role="status" aria-live="polite">{statusMessage}</span>
</div>
