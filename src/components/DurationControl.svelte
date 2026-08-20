<script lang="ts">
  import { durationInMonths, formatDuration, MAX_SIMULATION_MONTHS } from '../lib/duration';
  import { parseBrNumber } from '../lib/formatting';
  import type { SimulationInputs } from '../lib/types';

  export let inputs: SimulationInputs;

  const shortcuts = [
    { label: '6m', accessibleLabel: '6 meses', months: 6 },
    { label: '1a', accessibleLabel: '1 ano', months: 12 },
    { label: '2a', accessibleLabel: '2 anos', months: 24 },
    { label: '3a', accessibleLabel: '3 anos', months: 36 },
    { label: '5a', accessibleLabel: '5 anos', months: 60 },
    { label: '10a', accessibleLabel: '10 anos', months: 120 }
  ];

  $: prazoValido = isValidDuration(inputs.prazo);
  $: prazoMeses = prazoValido ? durationInMonths(inputs.prazo, inputs.prazoUnidade) : 1;
  $: sliderMaximum = Math.min(MAX_SIMULATION_MONTHS, Math.max(120, Math.ceil(prazoMeses / 12) * 12));

  function isValidDuration(value: string): boolean {
    try {
      const parsed = parseBrNumber(value);
      if (!Number.isSafeInteger(parsed) || parsed < 1) return false;
      const months = inputs.prazoUnidade === 'Anos' ? parsed * 12 : parsed;
      return Number.isSafeInteger(months) && months <= MAX_SIMULATION_MONTHS;
    } catch {
      return false;
    }
  }

  function setDuration(months: number, preferYears = false): void {
    const normalizedMonths = Math.max(1, Math.trunc(months));

    if (preferYears && normalizedMonths % 12 === 0) {
      inputs.prazo = String(normalizedMonths / 12);
      inputs.prazoUnidade = 'Anos';
      return;
    }

    inputs.prazo = String(normalizedMonths);
    inputs.prazoUnidade = 'Meses';
  }

  function handleSliderInput(event: Event): void {
    setDuration(Number((event.currentTarget as HTMLInputElement).value));
  }

  function handleCustomDurationInput(event: Event): void {
    const rawValue = (event.currentTarget as HTMLInputElement).value;
    // Mantém o texto digitado para que valores fracionários ou inválidos sejam
    // exibidos e rejeitados, em vez de serem silenciosamente truncados.
    inputs.prazo = rawValue;
  }
</script>

<div class="duration-control">
  <div class="duration-heading">
    <label for="prazo-slider">Prazo</label>
    <output for="prazo-slider">{formatDuration(prazoMeses)}</output>
  </div>
  <input
    id="prazo-slider"
    class="duration-slider"
    type="range"
    min="1"
    max={sliderMaximum}
    step="1"
    value={prazoMeses}
    aria-valuetext={formatDuration(prazoMeses)}
    oninput={handleSliderInput}
  />

  <div class="duration-shortcuts" role="group" aria-label="Atalhos de prazo">
    {#each shortcuts as shortcut}
      <button
        type="button"
        aria-label={shortcut.accessibleLabel}
        class:active={prazoMeses === shortcut.months}
        aria-pressed={prazoMeses === shortcut.months}
        onclick={() => setDuration(shortcut.months, shortcut.months >= 12)}
      >{shortcut.label}</button>
    {/each}
  </div>

  <label for="prazo-personalizado"><span>Prazo personalizado</span></label>
  <div class="inline-fields">
    <input
      id="prazo-personalizado"
      value={inputs.prazo}
      inputmode="numeric"
      pattern="[0-9]*"
      aria-label="Valor do prazo personalizado"
      aria-invalid={!prazoValido}
      aria-describedby={!prazoValido ? 'prazo-error' : undefined}
      oninput={handleCustomDurationInput}
    />
    <select bind:value={inputs.prazoUnidade} aria-label="Unidade do prazo personalizado">
      <option>Meses</option>
      <option>Anos</option>
    </select>
  </div>
  {#if !prazoValido}
    <p id="prazo-error" class="field-error" role="alert">Informe um prazo inteiro entre 1 mês e 1.200 meses (100 anos).</p>
  {/if}
</div>
