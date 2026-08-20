<script lang="ts">
  import { formatCurrency, formatNumber } from '../lib/formatting';
  import type { InvestmentResult, IpcaBenchmarkResult } from '../lib/types';

  export let benchmark: IpcaBenchmarkResult;
  export let melhorResultado: InvestmentResult;

  $: ganhoReal = melhorResultado.liquido - benchmark.valorFinal;
  $: ganhoRealPercentual = benchmark.valorFinal === 0 ? null : (ganhoReal / benchmark.valorFinal) * 100;

  function signedCurrency(value: number): string {
    if (value === 0) return formatCurrency(0);
    return `${value > 0 ? '+' : '−'} ${formatCurrency(Math.abs(value))}`;
  }

  function signedPercent(value: number): string {
    if (value === 0) return '0,00%';
    return `${value > 0 ? '+' : '−'}${formatNumber(Math.abs(value), 2)}%`;
  }
</script>

<aside class="benchmark-card" aria-labelledby="benchmark-card-title">
  <div class="benchmark-card-copy">
    <span class="reference-pill">REFERÊNCIA</span>
    <div>
      <h2 id="benchmark-card-title">Correção pelo IPCA</h2>
      <p>{benchmark.descricao} Cada aporte é corrigido somente pelo período em que esteve presente.</p>
    </div>
  </div>

  <dl>
    <div>
      <dt>Valor corrigido pelo IPCA</dt>
      <dd>{formatCurrency(benchmark.valorFinal)}</dd>
    </div>
    <div>
      <dt>Ganho real aproximado do melhor resultado</dt>
      <dd class:negative={ganhoReal < 0}>{signedCurrency(ganhoReal)}</dd>
      <small>{ganhoRealPercentual === null ? '—' : signedPercent(ganhoRealPercentual)} sobre a referência</small>
    </div>
  </dl>
</aside>
