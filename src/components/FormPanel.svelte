<script lang="ts">
  import type { SimulationInputs } from '../lib/types';

  export let inputs: SimulationInputs;
  export let loadingRates = false;
  export let onSimulate: () => void;
  export let onRefreshRates: () => void;
  export let onInfo: (kind: 'poupanca' | 'imposto') => void;

  const numericMode = 'decimal';
</script>

<aside class="panel form-panel">
  <div class="section-heading">
    <div>
      <span class="eyebrow">ENTRADAS</span>
      <h2>Parâmetros</h2>
    </div>
  </div>

  <section class="form-section">
    <h3>Investimento</h3>

    <label>
      <span>Aporte inicial</span>
      <div class="input-prefix"><b>R$</b><input bind:value={inputs.aporteInicial} inputmode={numericMode} /></div>
    </label>

    <label>
      <span>Aporte mensal</span>
      <div class="input-prefix"><b>R$</b><input bind:value={inputs.aporteMensal} inputmode={numericMode} /></div>
    </label>

    <label>
      <span>Prazo</span>
      <div class="inline-fields">
        <input bind:value={inputs.prazo} inputmode={numericMode} aria-label="Prazo" />
        <select bind:value={inputs.prazoUnidade} aria-label="Unidade do prazo">
          <option>Meses</option>
          <option>Anos</option>
        </select>
      </div>
    </label>
  </section>

  <section class="form-section">
    <div class="section-title-row">
      <h3>Taxas anuais</h3>
      <button class="mini-button" type="button" onclick={onRefreshRates} disabled={loadingRates}>
        {loadingRates ? 'Atualizando…' : 'Atualizar BCB'}
      </button>
    </div>

    <label><span>Taxa Selic (%)</span><input bind:value={inputs.selic} inputmode={numericMode} /></label>
    <label><span>Taxa CDI (%)</span><input bind:value={inputs.cdi} inputmode={numericMode} /></label>
    <label><span>IPCA (%)</span><input bind:value={inputs.ipca} inputmode={numericMode} /></label>
    <label>
      <span>TR (%) <small>manual</small></span>
      <input bind:value={inputs.tr} inputmode={numericMode} />
    </label>
    <p class="field-note">CDI é estimado como Selic − 0,10 p.p., conforme a versão original. A TR permanece editável manualmente.</p>
  </section>

  <section class="form-section">
    <h3>Rentabilidade oferecida</h3>
    <label><span>CDB (% do CDI)</span><input bind:value={inputs.cdbPercentualCdi} inputmode={numericMode} /></label>
    <label><span>LCI/LCA (% do CDI)</span><input bind:value={inputs.lciPercentualCdi} inputmode={numericMode} /></label>
    <label><span>Tesouro Pré (% a.a.)</span><input bind:value={inputs.tesouroPre} inputmode={numericMode} /></label>
    <label><span>Tesouro IPCA+ (fixo)</span><input bind:value={inputs.tesouroIpcaFixo} inputmode={numericMode} /></label>
  </section>

  <button class="primary-button" type="button" onclick={onSimulate}>Simular rentabilidade</button>

  <div class="info-buttons">
    <button type="button" onclick={() => onInfo('poupanca')}>Como funciona a poupança?</button>
    <button type="button" onclick={() => onInfo('imposto')}>Como o simulador trata o IR?</button>
  </div>
</aside>
