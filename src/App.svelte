<script lang="ts">
  import { onMount } from 'svelte';
  import BestResultPanel from './components/BestResultPanel.svelte';
  import ComparisonChart from './components/ComparisonChart.svelte';
  import ExportMenu from './components/ExportMenu.svelte';
  import FormPanel from './components/FormPanel.svelte';
  import InfoModal from './components/InfoModal.svelte';
  import IpcaBenchmarkCard from './components/IpcaBenchmarkCard.svelte';
  import ResultCard from './components/ResultCard.svelte';
  import ResultsRanking from './components/ResultsRanking.svelte';
  import { calcularBenchmarkIpca } from './lib/benchmarks';
  import { simularInvestimentos } from './lib/calculations';
  import { baixarCsv, importarResultadosCsv } from './lib/csv';
  import { durationInMonths } from './lib/duration';
  import { formatNumber, parseBrNumber } from './lib/formatting';
  import { createDefaultProductSelection, createEmptyProductSelection } from './lib/products';
  import { buscarTaxasAtuais, carregarTaxasEmCache } from './lib/rates';
  import { sortResultsByNetValue } from './lib/resultMetrics';
  import { createDefaultSectionState, loadUiPreferences, saveUiPreferences } from './lib/storage';
  import type {
    ChartMode,
    FormSectionId,
    InvestmentResult,
    ProductId,
    SimulationInputs,
    SimulationRun
  } from './lib/types';

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
  let currentRun: SimulationRun | null = null;
  let produtosAtivos = createDefaultProductSelection();
  let produtosPreferidos = createDefaultProductSelection();
  let produtosDisponiveis = createDefaultProductSelection();
  let secoesAbertas = createDefaultSectionState();
  let prazoUltimaSimulacao: number | null = null;
  let origemResultados: 'simulacao' | 'csv' = 'simulacao';
  let resultadosImportados: InvestmentResult[] = [];
  let resultNotice = '';
  let showBenchmarkIpca = false;
  let chartMode: ChartMode = 'barras';
  let loadingRates = false;
  let rateStatus = 'Taxas ainda não atualizadas nesta sessão.';
  let errorMessage = '';
  let infoModal: 'poupanca' | 'imposto' | null = null;
  let fileInput: HTMLInputElement | undefined;
  let latestRateRequest = 0;

  function aplicarTaxas(selic: number, cdi: number, ipca: number): void {
    inputs = {
      ...inputs,
      selic: formatNumber(selic),
      cdi: formatNumber(cdi),
      ipca: formatNumber(ipca)
    };
  }

  function createCalculatedRun(
    nextResults: InvestmentResult[],
    nextSelection: typeof produtosAtivos,
    durationMonths: number
  ): SimulationRun {
    const inputSnapshot = { ...inputs };
    let benchmarkIpca = null;

    try {
      const ipcaAnual = parseBrNumber(inputSnapshot.ipca);
      benchmarkIpca = calcularBenchmarkIpca(
        parseBrNumber(inputSnapshot.aporteInicial),
        parseBrNumber(inputSnapshot.aporteMensal),
        Array.from({ length: durationMonths }, () => ipcaAnual)
      );
    } catch {
      // O benchmark opcional não invalida uma simulação cujos produtos não dependam do IPCA.
    }

    return {
      origin: 'calculated',
      createdAt: new Date().toISOString(),
      inputs: inputSnapshot,
      produtosAtivos: { ...nextSelection },
      resultados: nextResults.map((resultado) => ({ ...resultado, historico: [...resultado.historico] })),
      prazoMeses: durationMonths,
      hasMonthlyHistory: true,
      benchmarkIpca,
      rateStatus
    };
  }

  function commitCalculatedRun(
    nextResults: InvestmentResult[],
    nextSelection: typeof produtosAtivos,
    durationMonths: number
  ): void {
    resultados = nextResults;
    prazoUltimaSimulacao = durationMonths;
    origemResultados = 'simulacao';
    resultadosImportados = [];
    produtosPreferidos = { ...nextSelection };
    produtosDisponiveis = createDefaultProductSelection();
    resultNotice = '';
    currentRun = createCalculatedRun(nextResults, nextSelection, durationMonths);
    if (!currentRun.benchmarkIpca) showBenchmarkIpca = false;
    persistUiPreferences();
  }

  async function atualizarTaxas(): Promise<void> {
    const requestId = ++latestRateRequest;
    const inputSnapshot = JSON.stringify(inputs);
    const productSnapshot = JSON.stringify(produtosAtivos);
    loadingRates = true;
    errorMessage = '';
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);

    try {
      const snapshot = await buscarTaxasAtuais(controller.signal);

      if (requestId !== latestRateRequest) return;
      if (inputSnapshot !== JSON.stringify(inputs) || productSnapshot !== JSON.stringify(produtosAtivos)) {
        rateStatus = 'Taxas recebidas, mas não aplicadas porque os parâmetros mudaram durante a consulta.';
        return;
      }

      aplicarTaxas(snapshot.selic, snapshot.cdi, snapshot.ipca);
      rateStatus = `BCB consultado em ${new Date(snapshot.atualizadoEm).toLocaleString('pt-BR')}.`;
      if (origemResultados === 'simulacao') simular();
    } catch (error) {
      if (requestId !== latestRateRequest) return;
      if (inputSnapshot !== JSON.stringify(inputs) || productSnapshot !== JSON.stringify(produtosAtivos)) {
        rateStatus = 'Atualização cancelada porque os parâmetros mudaram durante a consulta.';
        return;
      }

      const cached = carregarTaxasEmCache();
      if (cached) {
        aplicarTaxas(cached.selic, cached.cdi, cached.ipca);
        rateStatus = `Sem atualização online; usando taxas salvas em ${new Date(cached.atualizadoEm).toLocaleString('pt-BR')}.`;
        if (origemResultados === 'simulacao') simular();
      } else {
        rateStatus = 'Não foi possível consultar o BCB. Revise manualmente as taxas antes de simular.';
        if (origemResultados === 'simulacao') simular();
      }
    } finally {
      window.clearTimeout(timeout);
      if (requestId === latestRateRequest) loadingRates = false;
    }
  }

  function simular(): void {
    errorMessage = '';
    try {
      const nextResults = simularInvestimentos(inputs, produtosAtivos);
      const nextDuration = durationInMonths(inputs.prazo, inputs.prazoUnidade);
      commitCalculatedRun(nextResults, produtosAtivos, nextDuration);
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Não foi possível realizar a simulação.';
    }
  }

  function persistUiPreferences(): void {
    saveUiPreferences({ produtosAtivos: produtosPreferidos, secoesAbertas });
  }

  function toggleProduct(productId: ProductId): void {
    const activeCount = Object.values(produtosAtivos).filter(Boolean).length;
    if (produtosAtivos[productId] && activeCount === 1) return;

    const nextSelection = { ...produtosAtivos, [productId]: !produtosAtivos[productId] };
    errorMessage = '';

    if (origemResultados === 'csv') {
      produtosAtivos = nextSelection;
      resultados = resultadosImportados.filter((resultado) => produtosAtivos[resultado.produtoId]);
      if (currentRun) {
        currentRun = {
          ...currentRun,
          produtosAtivos: { ...produtosAtivos },
          resultados: resultados.map((resultado) => ({ ...resultado, historico: [...resultado.historico] }))
        };
      }
      return;
    }

    try {
      const nextResults = simularInvestimentos(inputs, nextSelection);
      const nextDuration = durationInMonths(inputs.prazo, inputs.prazoUnidade);
      produtosAtivos = nextSelection;
      commitCalculatedRun(nextResults, nextSelection, nextDuration);
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Não foi possível alterar os produtos comparados.';
    }
  }

  function toggleSection(sectionId: FormSectionId, open: boolean): void {
    secoesAbertas = { ...secoesAbertas, [sectionId]: open };
    persistUiPreferences();
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
      const importedResults = importarResultadosCsv(await file.text());
      const importedSelection = createEmptyProductSelection();
      for (const resultado of importedResults) {
        importedSelection[resultado.produtoId] = true;
      }

      produtosAtivos = importedSelection;
      produtosDisponiveis = { ...importedSelection };
      resultados = importedResults;
      resultadosImportados = importedResults;
      prazoUltimaSimulacao = null;
      origemResultados = 'csv';
      chartMode = 'barras';
      showBenchmarkIpca = false;
      resultNotice = 'Resultados carregados de CSV. O arquivo não contém parâmetros, prazo nem histórico mensal; por isso, a evolução fica indisponível até uma nova simulação.';
      currentRun = {
        origin: 'legacy-csv',
        createdAt: new Date().toISOString(),
        inputs: null,
        produtosAtivos: { ...importedSelection },
        resultados: importedResults.map((resultado) => ({ ...resultado, historico: [...resultado.historico] })),
        prazoMeses: null,
        hasMonthlyHistory: false,
        benchmarkIpca: null,
        rateStatus: 'Taxas e fonte não informadas no CSV legado.'
      };
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
    const preferences = loadUiPreferences();
    produtosAtivos = preferences.produtosAtivos;
    produtosPreferidos = { ...preferences.produtosAtivos };
    secoesAbertas = preferences.secoesAbertas;

    const cached = carregarTaxasEmCache();
    if (cached) {
      aplicarTaxas(cached.selic, cached.cdi, cached.ipca);
      rateStatus = `Taxas salvas carregadas (${new Date(cached.atualizadoEm).toLocaleString('pt-BR')}). Atualizando…`;
    }

    void atualizarTaxas();
    simular();
  });

  $: cards = sortResultsByNetValue(resultados);
  $: melhorResultado = cards[0] ?? null;
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
    <FormPanel
      {inputs}
      {produtosAtivos}
      {produtosDisponiveis}
      {secoesAbertas}
      {loadingRates}
      onSimulate={simular}
      onRefreshRates={atualizarTaxas}
      onInfo={(kind) => (infoModal = kind)}
      onToggleProduct={toggleProduct}
      onSectionToggle={toggleSection}
    />

    <section class="content-column">
      <div class="content-toolbar">
        <div class="view-controls">
          <div class="segmented" role="group" aria-label="Tipo do gráfico">
            <button type="button" class:active={chartMode === 'barras'} aria-pressed={chartMode === 'barras'} onclick={() => (chartMode = 'barras')}>Barras</button>
            <button
              type="button"
              class:active={chartMode === 'linhas'}
              aria-pressed={chartMode === 'linhas'}
              disabled={origemResultados === 'csv'}
              title={origemResultados === 'csv' ? 'O CSV não contém histórico mensal' : ''}
              onclick={() => (chartMode = 'linhas')}
            >Evolução</button>
          </div>

          <button
            class="benchmark-toggle"
            class:on={showBenchmarkIpca}
            type="button"
            role="switch"
            aria-checked={showBenchmarkIpca}
            disabled={!currentRun?.benchmarkIpca}
            title={!currentRun?.benchmarkIpca ? 'Informe um IPCA válido e execute uma simulação' : ''}
            onclick={() => (showBenchmarkIpca = !showBenchmarkIpca)}
          >
            <i aria-hidden="true"></i>
            Correção pelo IPCA
          </button>
        </div>

        <div class="file-actions">
          <input bind:this={fileInput} class="visually-hidden" type="file" accept=".csv,text/csv" tabindex="-1" aria-hidden="true" onchange={importarArquivo} />
          <button type="button" onclick={() => fileInput?.click()}>Importar CSV</button>
          <button type="button" onclick={exportar} disabled={resultados.length === 0}>Exportar CSV</button>
          {#if currentRun}
            <ExportMenu run={currentRun} includeBenchmark={showBenchmarkIpca} />
          {/if}
        </div>
      </div>

      {#if errorMessage}
        <div class="error-banner" role="alert">{errorMessage}</div>
      {/if}

      {#if resultNotice}
        <div class="import-banner" role="status">{resultNotice}</div>
      {/if}

      {#if resultados.length > 0}
        {#if melhorResultado}
          <BestResultPanel resultado={melhorResultado} prazoMeses={prazoUltimaSimulacao} />
        {/if}

        {#if showBenchmarkIpca && currentRun?.benchmarkIpca && melhorResultado}
          <IpcaBenchmarkCard benchmark={currentRun.benchmarkIpca} {melhorResultado} />
        {/if}

        <ComparisonChart
          {resultados}
          mode={chartMode}
          benchmark={currentRun?.benchmarkIpca ?? null}
          showBenchmark={showBenchmarkIpca}
        />

        <div class="notice">
          <strong>Modelo compatível com a versão original:</strong> não considera IOF, usa CDI ≈ Selic − 0,10 p.p. e aproxima Tesouro IPCA+ pela soma de IPCA e taxa fixa. Use como ferramenta educacional e confirme regras/taxas antes de decisões financeiras.
        </div>

        <ResultsRanking resultados={cards} />

        <div class="results-heading">
          <div>
            <span class="eyebrow">DETALHAMENTO</span>
            <h2>Resultados por investimento</h2>
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
