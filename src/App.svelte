<script lang="ts">
  import { onMount } from 'svelte';
  import ComparisonChart from './components/ComparisonChart.svelte';
  import FormPanel from './components/FormPanel.svelte';
  import InfoModal from './components/InfoModal.svelte';
  import ResultCard from './components/ResultCard.svelte';
  import { simularInvestimentos } from './lib/calculations';
  import { baixarCsv, importarResultadosCsv } from './lib/csv';
  import { formatNumber } from './lib/formatting';
  import { buscarTaxasAtuais, carregarTaxasEmCache } from './lib/rates';
  import type { ChartMode, InvestmentResult, SimulationInputs } from './lib/types';

  let inputs: SimulationInputs = {
    aporteInicial: '1000,00',
    aporteMensal: '0,00',
    prazo: '1',
    prazoUnidade: 'Anos',
    selic: '10,50',
    cdi: '10,40',
    ipca: '4,50',
    tr: '1,50',
    cdbPercentualCdi: '100,0',
    lciPercentualCdi: '100,0',
    tesouroPre: '11,0',
    tesouroIpcaFixo: '5,50'
  };

  let resultados: InvestmentResult[] = [];
  let chartMode: ChartMode = 'barras';
  let loadingRates = false;
  let rateStatus = 'Taxas ainda não atualizadas nesta sessão.';
  let errorMessage = '';
  let infoModal: 'poupanca' | 'imposto' | null = null;
  let fileInput: HTMLInputElement | undefined;

  function aplicarTaxas(selic: number, cdi: number, ipca: number): void {
    inputs = {
      ...inputs,
      selic: formatNumber(selic),
      cdi: formatNumber(cdi),
      ipca: formatNumber(ipca)
    };
  }

  async function atualizarTaxas(): Promise<void> {
    loadingRates = true;
    errorMessage = '';
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);

    try {
      const snapshot = await buscarTaxasAtuais(controller.signal);
      aplicarTaxas(snapshot.selic, snapshot.cdi, snapshot.ipca);
      rateStatus = `BCB consultado em ${new Date(snapshot.atualizadoEm).toLocaleString('pt-BR')}.`;
    } catch (error) {
      const cached = carregarTaxasEmCache();
      if (cached) {
        aplicarTaxas(cached.selic, cached.cdi, cached.ipca);
        rateStatus = `Sem atualização online; usando taxas salvas em ${new Date(cached.atualizadoEm).toLocaleString('pt-BR')}.`;
      } else {
        rateStatus = 'Não foi possível consultar o BCB. Revise manualmente as taxas antes de simular.';
      }
    } finally {
      window.clearTimeout(timeout);
      loadingRates = false;
    }
  }

  function simular(): void {
    errorMessage = '';
    try {
      resultados = simularInvestimentos(inputs);
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Não foi possível realizar a simulação.';
    }
  }

  function exportar(): void {
    if (resultados.length > 0) baixarCsv(resultados);
  }

  async function importarArquivo(event: Event): Promise<void> {
    errorMessage = '';
    const target = event.currentTarget as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    try {
      resultados = importarResultadosCsv(await file.text());
      rateStatus = 'Resultados carregados de CSV. O arquivo não contém o histórico mensal completo.';
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Falha ao importar CSV.';
    } finally {
      target.value = '';
    }
  }

  function changeFont(delta: number): void {
    const root = document.documentElement;
    const current = Number.parseFloat(getComputedStyle(root).fontSize) || 16;
    root.style.fontSize = `${Math.min(20, Math.max(13, current + delta))}px`;
  }

  onMount(() => {
    const cached = carregarTaxasEmCache();
    if (cached) {
      aplicarTaxas(cached.selic, cached.cdi, cached.ipca);
      rateStatus = `Taxas salvas carregadas (${new Date(cached.atualizadoEm).toLocaleString('pt-BR')}). Atualizando…`;
    }

    void atualizarTaxas();
    simular();
  });

  $: cards = [...resultados].sort((a, b) => b.liquido - a.liquido);
</script>

<svelte:head>
  <title>Simulador de Renda Fixa</title>
</svelte:head>

<div class="app-shell">
  <header class="topbar">
    <div class="brand">
      <div class="brand-mark">RF</div>
      <div>
        <span class="eyebrow">SIMULADOR EDUCACIONAL</span>
        <h1>Renda Fixa</h1>
      </div>
    </div>

    <div class="topbar-actions">
      <div class="rate-status"><span class:online={rateStatus.startsWith('BCB')}></span>{rateStatus}</div>
      <button class="icon-button" type="button" onclick={() => changeFont(-1)} title="Diminuir tamanho da letra">A−</button>
      <button class="icon-button" type="button" onclick={() => changeFont(1)} title="Aumentar tamanho da letra">A+</button>
    </div>
  </header>

  <main class="workspace">
    <FormPanel {inputs} {loadingRates} onSimulate={simular} onRefreshRates={atualizarTaxas} onInfo={(kind) => (infoModal = kind)} />

    <section class="content-column">
      <div class="content-toolbar">
        <div class="segmented" aria-label="Tipo do gráfico">
          <button class:active={chartMode === 'barras'} onclick={() => (chartMode = 'barras')}>Barras</button>
          <button class:active={chartMode === 'linhas'} onclick={() => (chartMode = 'linhas')}>Evolução</button>
        </div>

        <div class="file-actions">
          <input bind:this={fileInput} class="visually-hidden" type="file" accept=".csv,text/csv" onchange={importarArquivo} />
          <button type="button" onclick={() => fileInput?.click()}>Importar CSV</button>
          <button type="button" onclick={exportar} disabled={resultados.length === 0}>Exportar CSV</button>
        </div>
      </div>

      {#if errorMessage}
        <div class="error-banner" role="alert">{errorMessage}</div>
      {/if}

      {#if resultados.length > 0}
        <ComparisonChart {resultados} mode={chartMode} />

        <div class="notice">
          <strong>Modelo compatível com a versão original:</strong> não considera IOF e usa CDI ≈ Selic − 0,10 p.p. Use como ferramenta educacional e confirme regras/taxas antes de decisões financeiras.
        </div>

        <div class="results-heading">
          <div>
            <span class="eyebrow">RESULTADOS</span>
            <h2>Do maior para o menor valor líquido</h2>
          </div>
          <span>{resultados.length} alternativas</span>
        </div>

        <div class="results-grid">
          {#each cards as resultado, index}
            <ResultCard {resultado} rank={index + 1} />
          {/each}
        </div>
      {/if}
    </section>
  </main>

  <footer class="site-footer">
    <p>Simulador de Renda Fixa • versão web/desktop baseada no aplicativo Python original.</p>
    <p>Os resultados são estimativas educacionais e não constituem recomendação de investimento.</p>
  </footer>
</div>

<InfoModal kind={infoModal} onClose={() => (infoModal = null)} />
