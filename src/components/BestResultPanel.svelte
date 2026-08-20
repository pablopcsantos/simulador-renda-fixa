<script lang="ts">
  import { formatDuration } from '../lib/duration';
  import { formatCurrency, formatNumber } from '../lib/formatting';
  import { getProductColor } from '../lib/products';
  import { accumulatedNetReturn, isTaxableResult, netGain } from '../lib/resultMetrics';
  import type { InvestmentResult } from '../lib/types';

  export let resultado: InvestmentResult;
  export let prazoMeses: number | null;

  $: rendimentoLiquido = netGain(resultado);
  $: percentualLiquido = accumulatedNetReturn(resultado);
  $: productColor = getProductColor(resultado.produtoId);
  $: tributavel = isTaxableResult(resultado);

  function signedCurrency(value: number): string {
    if (value === 0) return formatCurrency(0);
    return `${value > 0 ? '+' : '−'} ${formatCurrency(Math.abs(value))}`;
  }

  function signedPercent(value: number): string {
    if (value === 0) return '0,00%';
    return `${value > 0 ? '+' : '−'}${formatNumber(Math.abs(value), 2)}%`;
  }
</script>

<section
  class="panel best-result"
  style={`--product-color: ${productColor}`}
  aria-labelledby="best-result-title"
>
  <header>
    <div>
      <span class="eyebrow">MELHOR RESULTADO DA SIMULAÇÃO</span>
      <div class="best-product-title">
        <i aria-hidden="true"></i>
        <div>
          <h2 id="best-result-title">{resultado.nomeSimples}</h2>
          <p>{resultado.caracteristica}</p>
        </div>
      </div>
    </div>
    <span class="winner-badge">1º lugar</span>
  </header>

  <div class="best-result-main">
    <div class="best-value">
      <strong>{formatCurrency(resultado.liquido)}</strong>
      <span>Patrimônio líquido final</span>
    </div>

    <div class="best-gains">
      <strong>{signedCurrency(rendimentoLiquido)}</strong>
      <span>de rendimento líquido</span>
      <strong>{percentualLiquido === null ? '—' : signedPercent(percentualLiquido)}</strong>
      <span>no período</span>
    </div>
  </div>

  <dl class="best-result-details">
    <div><dt>Total investido</dt><dd>{formatCurrency(resultado.investido)}</dd></div>
    <div><dt>Prazo</dt><dd>{prazoMeses === null ? 'Não informado no CSV' : formatDuration(prazoMeses)}</dd></div>
    <div><dt>Tributação</dt><dd>{tributavel ? `IR: ${resultado.taxaIr}` : 'IR: Isento'}</dd></div>
  </dl>
</section>
