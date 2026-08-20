<script lang="ts">
  import DurationControl from './DurationControl.svelte';
  import ProductSelector from './ProductSelector.svelte';
  import type {
    FormSectionId,
    FormSectionState,
    ProductId,
    ProductSelection,
    SimulationInputs
  } from '../lib/types';

  export let inputs: SimulationInputs;
  export let produtosAtivos: ProductSelection;
  export let produtosDisponiveis: ProductSelection;
  export let secoesAbertas: FormSectionState;
  export let loadingRates = false;
  export let onSimulate: () => void;
  export let onRefreshRates: () => void;
  export let onInfo: (kind: 'poupanca' | 'imposto') => void;
  export let onToggleProduct: (productId: ProductId) => void;
  export let onSectionToggle: (sectionId: FormSectionId, open: boolean) => void;

  const numericMode = 'decimal';
  function handleSectionToggle(sectionId: FormSectionId, event: Event): void {
    const open = (event.currentTarget as HTMLDetailsElement).open;
    if (secoesAbertas[sectionId] !== open) onSectionToggle(sectionId, open);
  }
</script>

<aside class="panel form-panel">
  <div class="section-heading">
    <div>
      <span class="eyebrow">ENTRADAS</span>
      <h2>Parâmetros</h2>
    </div>
  </div>

  <details
    class="form-section collapsible-section"
    open={secoesAbertas.investimento}
    ontoggle={(event) => handleSectionToggle('investimento', event)}
  >
    <summary><span>Investimento</span><i aria-hidden="true"></i></summary>
    <div class="collapsible-content">
      <label for="aporte-inicial">
        <span>Aporte inicial</span>
        <div class="input-prefix"><b>R$</b><input id="aporte-inicial" bind:value={inputs.aporteInicial} inputmode={numericMode} /></div>
      </label>

      <label for="aporte-mensal">
        <span>Aporte mensal</span>
        <div class="input-prefix"><b>R$</b><input id="aporte-mensal" bind:value={inputs.aporteMensal} inputmode={numericMode} /></div>
      </label>

      <DurationControl {inputs} />
    </div>
  </details>

  <details
    class="form-section collapsible-section"
    open={secoesAbertas.mercado}
    ontoggle={(event) => handleSectionToggle('mercado', event)}
  >
    <summary><span>Premissas de mercado</span><i aria-hidden="true"></i></summary>
    <div class="collapsible-content">
      <div class="section-title-row">
        <p>Taxas anuais</p>
        <button class="mini-button" type="button" onclick={onRefreshRates} disabled={loadingRates}>
          {loadingRates ? 'Atualizando…' : 'Atualizar BCB'}
        </button>
      </div>

      <label for="taxa-selic"><span>Taxa Selic (%)</span><input id="taxa-selic" bind:value={inputs.selic} inputmode={numericMode} /></label>
      <label for="taxa-cdi"><span>Taxa CDI (%)</span><input id="taxa-cdi" bind:value={inputs.cdi} inputmode={numericMode} /></label>
      <label for="taxa-ipca"><span>IPCA (%)</span><input id="taxa-ipca" bind:value={inputs.ipca} inputmode={numericMode} /></label>
      <p class="field-note">CDI é estimado como Selic − 0,10 p.p. ao consultar o BCB e permanece editável, conforme a versão original.</p>
    </div>
  </details>

  <details
    class="form-section collapsible-section"
    open={secoesAbertas.produtos}
    ontoggle={(event) => handleSectionToggle('produtos', event)}
  >
    <summary><span>Produtos comparados</span><i aria-hidden="true"></i></summary>
    <div class="collapsible-content products-content">
      <ProductSelector {inputs} {produtosAtivos} {produtosDisponiveis} {onToggleProduct} {onInfo} />
    </div>
  </details>

  <details
    class="form-section collapsible-section"
    open={secoesAbertas.avancadas}
    ontoggle={(event) => handleSectionToggle('avancadas', event)}
  >
    <summary><span>Configurações avançadas</span><i aria-hidden="true"></i></summary>
    <div class="collapsible-content">
      <label for="taxa-tr">
        <span>TR (%) <small>manual</small></span>
        <input id="taxa-tr" bind:value={inputs.tr} inputmode={numericMode} />
      </label>
      <p class="field-note">A TR não é consultada automaticamente. Confirme o valor antes de simular.</p>
    </div>
  </details>

  <details
    class="form-section collapsible-section"
    open={secoesAbertas.tributacao}
    ontoggle={(event) => handleSectionToggle('tributacao', event)}
  >
    <summary><span>Tributação</span><i aria-hidden="true"></i></summary>
    <div class="collapsible-content">
      <p class="field-note taxation-note">O modelo atual aplica IR regressivo aos produtos tributáveis e mantém Poupança e LCI/LCA isentas. IOF não é calculado.</p>
      <button class="secondary-button" type="button" onclick={() => onInfo('imposto')}>Como o simulador trata o IR?</button>
    </div>
  </details>

  <button class="primary-button" type="button" onclick={onSimulate}>Simular rentabilidade</button>
</aside>
