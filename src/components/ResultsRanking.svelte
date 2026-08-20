<script lang="ts">
  import { formatCurrency, formatNumber } from '../lib/formatting';
  import { getProductColor } from '../lib/products';
  import type { InvestmentResult } from '../lib/types';

  export let resultados: InvestmentResult[];

  $: vencedor = resultados[0];

  function differenceFromWinner(result: InvestmentResult): number {
    return result.liquido - vencedor.liquido;
  }

  function percentDifferenceFromWinner(result: InvestmentResult): number | null {
    if (vencedor.liquido === 0) return null;
    return (differenceFromWinner(result) / vencedor.liquido) * 100;
  }
</script>

<section class="panel ranking-panel" aria-labelledby="ranking-title">
  <header class="ranking-header">
    <div>
      <span class="eyebrow">RANKING</span>
      <h2 id="ranking-title">Comparativo completo</h2>
    </div>
    <span>Patrimônio líquido</span>
  </header>

  <ol class="ranking-list">
    {#each resultados as resultado, index}
      {@const difference = differenceFromWinner(resultado)}
      {@const percentDifference = percentDifferenceFromWinner(resultado)}
      {@const tied = index > 0 && Math.abs(difference) < 0.005}
      <li style={`--product-color: ${getProductColor(resultado.produtoId)}`}>
        <span class="ranking-position">{index + 1}</span>
        <i class="product-dot" aria-hidden="true"></i>
        <div class="ranking-product">
          <strong>{resultado.nomeSimples}</strong>
          <span>{resultado.caracteristica}</span>
        </div>
        <strong class="ranking-value">{formatCurrency(resultado.liquido)}</strong>
        <span class:best={index === 0} class="ranking-difference">
          {#if index === 0}
            Melhor resultado
          {:else if tied}
            Mesmo resultado líquido
          {:else}
            − {formatCurrency(Math.abs(difference))}
            <span aria-hidden="true"> | </span>
            <span>{percentDifference === null ? '—' : `−${formatNumber(Math.abs(percentDifference), 2)}%`}</span>
          {/if}
        </span>
      </li>
    {/each}
  </ol>
</section>
