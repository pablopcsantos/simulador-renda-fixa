<script lang="ts">
  import { formatCurrency } from '../lib/formatting';
  import type { InvestmentResult } from '../lib/types';

  export let resultado: InvestmentResult;
  export let rank = 1;

  $: rendimentoLiquido = resultado.liquido - resultado.investido;
  $: rendimentoBruto = resultado.bruto - resultado.investido;
</script>

<article class="result-card">
  <header>
    <div>
      <span class="rank">#{rank}</span>
      <h3>{resultado.nomeSimples}</h3>
    </div>
    <span class:taxed={resultado.imposto > 0} class="tax-pill">{resultado.taxaIr}</span>
  </header>

  <div class="result-highlight">
    <div>
      <span>Valor total líquido</span>
      <strong>{formatCurrency(resultado.liquido)}</strong>
    </div>
    <div class="gain-box">
      <span>Rendimento líquido</span>
      <strong>{formatCurrency(rendimentoLiquido)}</strong>
    </div>
  </div>

  <dl>
    <div><dt>Valor investido</dt><dd>{formatCurrency(resultado.investido)}</dd></div>
    <div><dt>Rendimento bruto</dt><dd>{formatCurrency(rendimentoBruto)}</dd></div>
    {#if resultado.imposto > 0}
      <div class="deduction"><dt>Deduções (IR)</dt><dd>− {formatCurrency(resultado.imposto)}</dd></div>
    {/if}
  </dl>
</article>
