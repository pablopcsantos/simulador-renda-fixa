<script lang="ts">
  import { formatCurrency } from '../lib/formatting';
  import type { ChartMode, InvestmentResult } from '../lib/types';

  export let resultados: InvestmentResult[];
  export let mode: ChartMode;

  const palette = ['#f59e0b', '#38bdf8', '#34d399', '#a78bfa', '#fb7185', '#60a5fa'];

  $: ordered = [...resultados].sort((a, b) => a.liquido - b.liquido);
  $: maxLiquid = Math.max(...ordered.map((r) => r.liquido), 1);
  $: maxHistory = Math.max(...resultados.flatMap((r) => r.historico), 1);
  $: maxPoints = Math.max(...resultados.map((r) => r.historico.length), 2);

  function linePoints(history: number[]): string {
    const left = 82;
    const top = 24;
    const width = 888;
    const height = 264;
    const divisor = Math.max(history.length - 1, 1);

    return history
      .map((value, index) => {
        const x = left + (index / divisor) * width;
        const y = top + height - (value / maxHistory) * height;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }

  function formatAxisCurrency(value: number): string {
    const abs = Math.abs(value);

    if (abs >= 1_000_000_000) {
      return `R$ ${(value / 1_000_000_000)
        .toLocaleString('pt-BR', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2
        })} bi`;
    }

    if (abs >= 1_000_000) {
      return `R$ ${(value / 1_000_000)
        .toLocaleString('pt-BR', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2
        })} mi`;
    }

    if (abs >= 1_000) {
      return `R$ ${(value / 1_000)
        .toLocaleString('pt-BR', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 1
        })} mil`;
    }

    return `R$ ${value.toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    })}`;
  }

  function formatMonths(months: number): string {
    return `${months} ${months === 1 ? 'mês' : 'meses'}`;
  }
</script>

<section class="panel chart-panel">
  <div class="chart-title">
    <div>
      <span class="eyebrow">COMPARAÇÃO</span>
      <h2>{mode === 'barras' ? 'Patrimônio final líquido' : 'Evolução do patrimônio líquido'}</h2>
    </div>
  </div>

  {#if mode === 'barras'}
    <div class="bars" aria-label="Gráfico de barras dos resultados">
      {#each ordered as r, index}
        <div class="bar-row">
          <div class="bar-label">
            <span>{r.nome}</span>
            <b>{formatCurrency(r.liquido)}</b>
          </div>

          <div class="bar-track">
            <div
              class="bar-fill"
              style={`width:${Math.max((r.liquido / maxLiquid) * 100, 1)}%;background:${palette[index % palette.length]}`}
            ></div>
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <div class="line-chart-wrap">
      <svg
        class="line-chart"
        viewBox="0 0 1000 340"
        role="img"
        aria-label="Gráfico de linhas da evolução dos investimentos"
      >
        <!-- Eixos -->
        <line x1="82" y1="288" x2="970" y2="288" class="axis" />
        <line x1="82" y1="24" x2="82" y2="288" class="axis" />

        <!-- Linha auxiliar central -->
        <line x1="82" y1="156" x2="970" y2="156" class="grid" />

        <!-- Eixo Y -->
        <text
          x="70"
          y="30"
          text-anchor="end"
          class="axis-text axis-text-y"
        >
          {formatAxisCurrency(maxHistory)}
        </text>

        <text
          x="70"
          y="293"
          text-anchor="end"
          class="axis-text axis-text-y"
        >
          0
        </text>

        <!-- Eixo X -->
        <text
          x="82"
          y="316"
          text-anchor="start"
          class="axis-text axis-text-x"
        >
          0 mês
        </text>

        <text
          x="970"
          y="316"
          text-anchor="end"
          class="axis-text axis-text-x"
        >
          {formatMonths(maxPoints - 1)}
        </text>

        {#each resultados as r, index}
          <polyline
            points={linePoints(r.historico)}
            fill="none"
            stroke={palette[index % palette.length]}
            stroke-width="4"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        {/each}
      </svg>

      <div class="legend">
        {#each resultados as r, index}
          <span>
            <i style={`background:${palette[index % palette.length]}`}></i>
            {r.nomeSimples}
          </span>
        {/each}
      </div>
    </div>
  {/if}
</section>