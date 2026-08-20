<script lang="ts">
  import { formatCurrency } from '../lib/formatting';
  import { getProductColor } from '../lib/products';
  import type { ChartMode, InvestmentResult, IpcaBenchmarkResult } from '../lib/types';

  export let resultados: InvestmentResult[];
  export let mode: ChartMode;
  export let benchmark: IpcaBenchmarkResult | null = null;
  export let showBenchmark = false;

  interface ChartSeries {
    id: string;
    name: string;
    color: string;
    history: number[];
    isBenchmark: boolean;
  }

  interface RenderedSeries extends ChartSeries {
    points: string;
  }

  // O SVG existente continua suficiente para seis séries e evita incluir uma
  // biblioteca de gráficos apenas para seleção mensal e tooltip.
  const VIEWBOX_WIDTH = 1000;
  const VIEWBOX_HEIGHT = 380;
  const PLOT_LEFT = 132;
  const PLOT_RIGHT = 976;
  const PLOT_TOP = 24;
  const PLOT_BOTTOM = 304;
  const PLOT_WIDTH = PLOT_RIGHT - PLOT_LEFT;
  const PLOT_HEIGHT = PLOT_BOTTOM - PLOT_TOP;
  const Y_INTERVALS = 4;
  const BENCHMARK_COLOR = '#e2e8f0';

  let selectedMonth = 0;
  let svgElement: SVGSVGElement | undefined;
  let investmentSeries: ChartSeries[] = [];
  let benchmarkSeries: ChartSeries | null = null;
  let displayedSeries: ChartSeries[] = [];
  let renderedSeries: RenderedSeries[] = [];
  let shownBenchmark: IpcaBenchmarkResult | null = null;
  let yMaximum = 1;
  let yTicks: number[] = [];
  let monthTicks: number[] = [];

  $: ordered = [...resultados].sort((a, b) => a.liquido - b.liquido);
  $: shownBenchmark = showBenchmark ? benchmark : null;
  $: barMaximum = niceMaximum(
    Math.max(
      0,
      ...resultados.map((result) => finiteOrZero(result.liquido)),
      finiteOrZero(shownBenchmark?.valorFinal)
    )
  );
  $: investmentSeries = resultados.map((result) => ({
    id: result.produtoId,
    name: result.nomeSimples,
    color: getProductColor(result.produtoId),
    history: result.historico,
    isBenchmark: false
  }));
  $: benchmarkSeries = shownBenchmark
    ? {
        id: shownBenchmark.benchmarkId,
        name: shownBenchmark.nome,
        color: BENCHMARK_COLOR,
        history: shownBenchmark.historico,
        isBenchmark: true
      }
    : null;
  $: displayedSeries = benchmarkSeries ? [...investmentSeries, benchmarkSeries] : investmentSeries;
  $: maxMonth = Math.max(0, ...displayedSeries.map((series) => Math.max(series.history.length - 1, 0)));
  $: if (selectedMonth > maxMonth) selectedMonth = maxMonth;
  $: yMaximum = niceMaximum(maximumHistoryValue(displayedSeries));
  $: yTicks = Array.from(
    { length: Y_INTERVALS + 1 },
    (_, index) => yMaximum * ((Y_INTERVALS - index) / Y_INTERVALS)
  );
  $: monthTicks = createMonthTicks(maxMonth);
  $: renderedSeries = displayedSeries.map((series) => ({
    ...series,
    points: linePoints(series.history, maxMonth, yMaximum)
  }));
  $: selectedX = xForMonth(selectedMonth, maxMonth);

  function finiteOrZero(value: number | null | undefined): number {
    return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
  }

  function maximumHistoryValue(series: ChartSeries[]): number {
    let maximum = 0;

    for (const item of series) {
      for (const value of item.history) {
        if (Number.isFinite(value)) maximum = Math.max(maximum, value);
      }
    }

    return maximum;
  }

  function niceMaximum(value: number): number {
    if (!Number.isFinite(value) || value <= 0) return 1;

    const magnitude = 10 ** Math.floor(Math.log10(value));
    const normalized = value / magnitude;
    const niceNormalized = normalized <= 1
      ? 1
      : normalized <= 2
        ? 2
        : normalized <= 2.5
          ? 2.5
          : normalized <= 5
            ? 5
            : 10;

    return niceNormalized * magnitude;
  }

  function barWidth(value: number): number {
    if (!Number.isFinite(value) || value <= 0) return 0;
    return Math.min(100, Math.max((value / barMaximum) * 100, 0.7));
  }

  function xForMonth(month: number, lastMonth: number): number {
    if (lastMonth <= 0) return PLOT_LEFT;
    return PLOT_LEFT + (Math.max(0, Math.min(month, lastMonth)) / lastMonth) * PLOT_WIDTH;
  }

  function yForValue(value: number, maximum: number): number {
    const safeValue = Number.isFinite(value) ? Math.max(0, value) : 0;
    return PLOT_BOTTOM - (safeValue / Math.max(maximum, 1)) * PLOT_HEIGHT;
  }

  function linePoints(history: number[], lastMonth: number, maximum: number): string {
    return history
      .map((value, month) => {
        if (!Number.isFinite(value)) return '';
        return `${xForMonth(month, lastMonth).toFixed(1)},${yForValue(value, maximum).toFixed(1)}`;
      })
      .filter(Boolean)
      .join(' ');
  }

  function createMonthTicks(lastMonth: number): number[] {
    if (lastMonth <= 0) return [0];

    return [...new Set([0, 0.25, 0.5, 0.75, 1].map((ratio) => Math.round(lastMonth * ratio)))];
  }

  function monthTickAnchor(month: number): 'start' | 'middle' | 'end' {
    if (month === 0) return 'start';
    if (month === maxMonth) return 'end';
    return 'middle';
  }

  function formatAxisCurrency(value: number): string {
    const absolute = Math.abs(value);
    const sign = value < 0 ? '−' : '';

    if (absolute >= 1_000_000_000_000_000) {
      return `R$ ${value.toExponential(1).replace('.', ',')}`;
    }

    let divisor = 1;
    let suffix = '';

    if (absolute >= 1_000_000_000_000) {
      divisor = 1_000_000_000_000;
      suffix = ' tri';
    } else if (absolute >= 1_000_000_000) {
      divisor = 1_000_000_000;
      suffix = ' bi';
    } else if (absolute >= 1_000_000) {
      divisor = 1_000_000;
      suffix = ' mi';
    } else if (absolute >= 1_000) {
      divisor = 1_000;
      suffix = ' mil';
    }

    const compactValue = absolute / divisor;
    const formatted = compactValue.toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: suffix ? 1 : 0
    });

    return `${sign}R$ ${formatted}${suffix}`;
  }

  function formatChartCurrency(value: number): string {
    const exact = formatCurrency(value);
    return exact.length <= 24 ? exact : formatAxisCurrency(value);
  }

  function formatMonths(months: number): string {
    return `${months} ${months === 1 ? 'mês' : 'meses'}`;
  }

  function valueAt(series: ChartSeries, month: number): number | null {
    const value = series.history[month];
    return Number.isFinite(value) ? value : null;
  }

  function selectMonthFromPointer(event: PointerEvent): void {
    if (!svgElement || maxMonth <= 0) return;

    const bounds = svgElement.getBoundingClientRect();
    if (bounds.width <= 0) return;

    const svgX = ((event.clientX - bounds.left) / bounds.width) * VIEWBOX_WIDTH;
    const ratio = (svgX - PLOT_LEFT) / PLOT_WIDTH;
    selectedMonth = Math.round(Math.max(0, Math.min(1, ratio)) * maxMonth);
  }

  function handlePointerMove(event: PointerEvent): void {
    if (event.pointerType === 'mouse' || event.buttons === 1) selectMonthFromPointer(event);
  }

  function handleRangeInput(event: Event): void {
    selectedMonth = Number((event.currentTarget as HTMLInputElement).value);
  }

</script>

<section class="panel chart-panel" aria-labelledby="comparison-chart-title">
  <header class="chart-title">
    <div>
      <span class="eyebrow">COMPARAÇÃO</span>
      <h2 id="comparison-chart-title">
        {mode === 'barras' ? 'Patrimônio final líquido' : 'Evolução do patrimônio líquido'}
      </h2>
    </div>
  </header>

  {#if mode === 'barras'}
    <div class="bars" role="list" aria-label="Patrimônio líquido final dos investimentos">
      {#each ordered as result (result.produtoId)}
        <div class="bar-row" role="listitem" style={`--series-color:${getProductColor(result.produtoId)}`}>
          <div class="bar-label">
            <span>{result.nome}</span>
            <b title={formatCurrency(result.liquido)}>{formatChartCurrency(result.liquido)}</b>
          </div>

          <div class="bar-track" aria-hidden="true">
            <div class="bar-fill" style={`width:${barWidth(result.liquido)}%`}></div>
          </div>
        </div>
      {/each}
    </div>

    {#if shownBenchmark}
      <aside class="benchmark-bar" aria-label="Referência de correção pelo IPCA">
        <div class="reference-heading">
          <span>REFERÊNCIA · NÃO É INVESTIMENTO</span>
          <p>{shownBenchmark.descricao}</p>
        </div>
        <div class="bar-row benchmark-row" style={`--series-color:${BENCHMARK_COLOR}`}>
          <div class="bar-label">
            <span>{shownBenchmark.nome}</span>
            <b title={formatCurrency(shownBenchmark.valorFinal)}>{formatChartCurrency(shownBenchmark.valorFinal)}</b>
          </div>
          <div class="bar-track" aria-hidden="true">
            <div class="bar-fill" style={`width:${barWidth(shownBenchmark.valorFinal)}%`}></div>
          </div>
        </div>
      </aside>
    {/if}
  {:else}
    <div class="chart-scroll">
      <svg
        bind:this={svgElement}
        class="line-chart"
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        role="img"
        aria-labelledby="line-chart-title line-chart-description"
      >
        <title id="line-chart-title">Evolução mensal do patrimônio líquido</title>
        <desc id="line-chart-description">
          Use o mouse, toque no gráfico ou o controle de mês abaixo para inspecionar os valores de cada série.
          A correção pelo IPCA, quando exibida, é apenas uma referência de poder de compra.
        </desc>

        {#each yTicks as tick}
          {@const tickY = yForValue(tick, yMaximum)}
          <line x1={PLOT_LEFT} y1={tickY} x2={PLOT_RIGHT} y2={tickY} class="grid-line" />
          <text x={PLOT_LEFT - 14} y={tickY} text-anchor="end" class="axis-label axis-label-y">
            {formatAxisCurrency(tick)}
          </text>
        {/each}

        <line x1={PLOT_LEFT} y1={PLOT_BOTTOM} x2={PLOT_RIGHT} y2={PLOT_BOTTOM} class="axis-line" />
        <line x1={PLOT_LEFT} y1={PLOT_TOP} x2={PLOT_LEFT} y2={PLOT_BOTTOM} class="axis-line" />

        {#each monthTicks as month}
          {@const tickX = xForMonth(month, maxMonth)}
          <line x1={tickX} y1={PLOT_BOTTOM} x2={tickX} y2={PLOT_BOTTOM + 6} class="axis-line" />
          <text
            x={tickX}
            y={PLOT_BOTTOM + 25}
            text-anchor={monthTickAnchor(month)}
            class="axis-label axis-label-x"
          >{formatMonths(month)}</text>
        {/each}

        {#each renderedSeries as series (series.id)}
          <polyline
            points={series.points}
            fill="none"
            stroke={series.color}
            stroke-width={series.isBenchmark ? 3 : 4}
            stroke-dasharray={series.isBenchmark ? '10 8' : undefined}
            stroke-linecap="round"
            stroke-linejoin="round"
            vector-effect="non-scaling-stroke"
            class:benchmark-line={series.isBenchmark}
          />
        {/each}

        <line
          x1={selectedX}
          y1={PLOT_TOP}
          x2={selectedX}
          y2={PLOT_BOTTOM}
          class="inspection-line"
          vector-effect="non-scaling-stroke"
        />

        {#each renderedSeries as series (series.id)}
          {@const selectedValue = valueAt(series, selectedMonth)}
          {#if selectedValue !== null}
            <circle
              cx={selectedX}
              cy={yForValue(selectedValue, yMaximum)}
              r={series.isBenchmark ? 6 : 5}
              fill={series.isBenchmark ? '#0f172a' : series.color}
              stroke={series.color}
              stroke-width="3"
              vector-effect="non-scaling-stroke"
            />
          {/if}
        {/each}

        <rect
          x={PLOT_LEFT}
          y={PLOT_TOP}
          width={PLOT_WIDTH}
          height={PLOT_HEIGHT}
          class="interaction-layer"
          aria-hidden="true"
          onpointerdown={selectMonthFromPointer}
          onpointermove={handlePointerMove}
        />
      </svg>
    </div>

    <div class="month-inspector">
      <div class="month-control-row">
        <label for="chart-month-range">Inspecionar mês</label>
        <output for="chart-month-range">Mês {selectedMonth}</output>
      </div>
      <input
        id="chart-month-range"
        class="month-range"
        type="range"
        min="0"
        max={maxMonth}
        step="1"
        value={selectedMonth}
        aria-valuetext={`Mês ${selectedMonth}`}
        aria-describedby="chart-inspection-values"
        oninput={handleRangeInput}
      />
    </div>

    <div
      id="chart-inspection-values"
      class="inspection-tooltip"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <strong class="tooltip-title">Mês {selectedMonth}</strong>
      <div class="tooltip-values">
        {#each displayedSeries as series (series.id)}
          {@const selectedValue = valueAt(series, selectedMonth)}
          <div class:benchmark-value={series.isBenchmark} class="tooltip-row">
            <i style={`--series-color:${series.color}`} aria-hidden="true"></i>
            <span>
              {series.name}
              {#if series.isBenchmark}<small>Referência</small>{/if}
            </span>
            <b title={selectedValue === null ? undefined : formatCurrency(selectedValue)}>
              {selectedValue === null ? 'Sem dado' : formatChartCurrency(selectedValue)}
            </b>
          </div>
        {/each}
      </div>
    </div>

    <div class="legend" aria-label="Legenda das séries">
      {#each displayedSeries as series (series.id)}
        <span class:benchmark-legend={series.isBenchmark}>
          <i style={`--series-color:${series.color}`} aria-hidden="true"></i>
          {series.name}
          {#if series.isBenchmark}<small>Referência</small>{/if}
        </span>
      {/each}
    </div>
  {/if}
</section>

<style>
  .chart-panel {
    min-width: 0;
    padding: 1rem 1rem 1.15rem;
    overflow: hidden;
  }

  .chart-title {
    margin-bottom: 1rem;
  }

  .chart-title h2 {
    overflow-wrap: anywhere;
  }

  .bars {
    display: grid;
    gap: 0.82rem;
  }

  .bar-label {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.38rem;
    font-size: 0.74rem;
  }

  .bar-label span {
    min-width: 0;
    color: #cbd5e1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .bar-label b {
    flex: 0 0 auto;
    color: #f8fafc;
    white-space: nowrap;
  }

  .bar-track {
    height: 0.72rem;
    overflow: hidden;
    border: 1px solid #243149;
    border-radius: 999px;
    background: #090f1b;
  }

  .bar-fill {
    height: 100%;
    border-radius: inherit;
    background: var(--series-color);
    box-shadow: inset 0 1px #ffffff33;
    transition: width 0.35s ease;
  }

  .benchmark-bar {
    margin-top: 1rem;
    padding-top: 0.9rem;
    border-top: 1px dashed #475569;
  }

  .reference-heading {
    margin-bottom: 0.65rem;
  }

  .reference-heading > span {
    color: #cbd5e1;
    font-size: 0.62rem;
    font-weight: 800;
    letter-spacing: 0.08em;
  }

  .reference-heading p {
    margin: 0.25rem 0 0;
    color: #94a3b8;
    font-size: 0.68rem;
    line-height: 1.45;
  }

  .benchmark-row .bar-track {
    border-style: dashed;
  }

  .benchmark-row .bar-fill {
    opacity: 0.72;
    background: repeating-linear-gradient(
      135deg,
      var(--series-color) 0,
      var(--series-color) 5px,
      transparent 5px,
      transparent 9px
    );
  }

  .chart-scroll {
    width: 100%;
    overflow-x: auto;
    overscroll-behavior-inline: contain;
    scrollbar-width: thin;
  }

  .line-chart {
    display: block;
    width: 100%;
    min-width: 44rem;
    height: auto;
  }

  .axis-line {
    stroke: #64748b;
    stroke-width: 1.5;
    vector-effect: non-scaling-stroke;
  }

  .grid-line {
    stroke: #334155;
    stroke-width: 1;
    stroke-dasharray: 5 7;
    vector-effect: non-scaling-stroke;
  }

  .axis-label {
    fill: #94a3b8;
    font-size: 14px;
    font-weight: 600;
  }

  .axis-label-y {
    dominant-baseline: middle;
  }

  .axis-label-x {
    dominant-baseline: hanging;
  }

  .benchmark-line {
    opacity: 0.9;
  }

  .inspection-line {
    stroke: #f8fafc;
    stroke-width: 1.5;
    stroke-dasharray: 4 5;
    opacity: 0.7;
    pointer-events: none;
  }

  .interaction-layer {
    fill: transparent;
    cursor: crosshair;
    touch-action: pan-x pan-y;
  }

  .month-inspector {
    margin-top: 0.5rem;
  }

  .month-control-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.25rem;
    color: #cbd5e1;
    font-size: 0.72rem;
    font-weight: 700;
  }

  .month-control-row label {
    margin: 0;
  }

  .month-control-row output {
    color: #f8fafc;
  }

  .month-range {
    width: 100%;
    height: 1.5rem;
    margin: 0;
    padding: 0;
    accent-color: #38bdf8;
    cursor: pointer;
  }

  .inspection-tooltip {
    margin-top: 0.65rem;
    padding: 0.75rem;
    border: 1px solid #334155;
    border-radius: 0.78rem;
    background: #090f1be8;
    box-shadow: 0 12px 30px #00000030;
  }

  .tooltip-title {
    display: block;
    margin-bottom: 0.55rem;
    color: #f8fafc;
    font-size: 0.78rem;
  }

  .tooltip-values {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.38rem 1rem;
  }

  .tooltip-row {
    display: grid;
    grid-template-columns: 0.62rem minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.45rem;
    min-width: 0;
    padding: 0.2rem 0;
  }

  .tooltip-row > i,
  .legend i {
    width: 0.58rem;
    height: 0.58rem;
    border-radius: 50%;
    background: var(--series-color);
  }

  .tooltip-row > span {
    min-width: 0;
    overflow: hidden;
    color: #cbd5e1;
    font-size: 0.69rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tooltip-row b {
    color: #f8fafc;
    font-size: 0.7rem;
    white-space: nowrap;
  }

  .tooltip-row small,
  .legend small {
    margin-left: 0.35rem;
    padding: 0.08rem 0.26rem;
    border: 1px solid #64748b;
    border-radius: 999px;
    color: #cbd5e1;
    font-size: 0.52rem;
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .benchmark-value {
    grid-column: 1 / -1;
    margin-top: 0.16rem;
    padding-top: 0.42rem;
    border-top: 1px dashed #475569;
  }

  .benchmark-value > i,
  .benchmark-legend > i {
    border: 1px solid #94a3b8;
    background: transparent;
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.55rem 1rem;
    padding-top: 0.7rem;
  }

  .legend > span {
    display: inline-flex;
    align-items: center;
    gap: 0.38rem;
    color: #94a3b8;
    font-size: 0.7rem;
  }

  .benchmark-legend {
    flex-basis: 100%;
    padding-top: 0.5rem;
    border-top: 1px dashed #334155;
  }

  @media (max-width: 680px) {
    .bar-label {
      align-items: flex-start;
      flex-direction: column;
      gap: 0.2rem;
    }

    .bar-label span {
      white-space: normal;
      overflow-wrap: anywhere;
    }

    .tooltip-values {
      grid-template-columns: 1fr;
    }

    .benchmark-value {
      grid-column: auto;
    }

    .tooltip-row {
      grid-template-columns: 0.62rem minmax(0, 1fr);
    }

    .tooltip-row b {
      grid-column: 2;
      white-space: normal;
      overflow-wrap: anywhere;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .bar-fill {
      transition: none;
    }
  }
</style>
