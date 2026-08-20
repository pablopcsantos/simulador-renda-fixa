<script lang="ts">
  import { PRODUCTS } from '../lib/products';
  import type { ProductId, ProductSelection, SimulationInputs } from '../lib/types';

  export let inputs: SimulationInputs;
  export let produtosAtivos: ProductSelection;
  export let produtosDisponiveis: ProductSelection;
  export let onToggleProduct: (productId: ProductId) => void;
  export let onInfo: (kind: 'poupanca' | 'imposto') => void;

  const numericMode = 'decimal';
  $: activeProductCount = PRODUCTS.filter((product) => produtosAtivos[product.id]).length;
  $: unavailableProductCount = PRODUCTS.filter((product) => !produtosDisponiveis[product.id]).length;
</script>

<p class="selection-status" aria-live="polite">
  {activeProductCount} de {PRODUCTS.length} produtos ativos. Pelo menos um deve permanecer selecionado.
  {#if unavailableProductCount > 0}
    Produtos ausentes do CSV ficam indisponíveis até uma nova simulação.
  {/if}
</p>

<div class="product-selector">
  {#each PRODUCTS as product}
    <article
      class="product-option"
      class:inactive={!produtosAtivos[product.id]}
      class:unavailable={!produtosDisponiveis[product.id]}
      style={`--product-color: ${product.cor}`}
    >
      <header>
        <div class="product-option-title">
          <i aria-hidden="true"></i>
          <strong>{product.nome}</strong>
        </div>
        <button
          class="switch-control"
          class:on={produtosAtivos[product.id]}
          type="button"
          role="switch"
          aria-checked={produtosAtivos[product.id]}
          aria-label={product.nome}
          title={!produtosDisponiveis[product.id]
            ? 'Produto não disponível no CSV importado'
            : produtosAtivos[product.id] && activeProductCount === 1
              ? 'Mantenha pelo menos um produto ativo'
              : ''}
          disabled={!produtosDisponiveis[product.id] || (produtosAtivos[product.id] && activeProductCount === 1)}
          onclick={() => onToggleProduct(product.id)}
        >
          <span class="switch-track" aria-hidden="true"><i></i></span>
          <b>{produtosAtivos[product.id] ? 'ON' : 'OFF'}</b>
        </button>
      </header>

      {#if !produtosDisponiveis[product.id]}
        <p>Não disponível no CSV importado.</p>
      {:else if product.id === 'poupanca'}
        <p>Regra baseada em Selic e TR.</p>
        <button class="product-info-link" type="button" onclick={() => onInfo('poupanca')}>Entenda a regra</button>
      {:else if product.id === 'cdb'}
        <label for="taxa-cdb"><span>Rentabilidade (% do CDI)</span><input id="taxa-cdb" bind:value={inputs.cdbPercentualCdi} inputmode={numericMode} /></label>
      {:else if product.id === 'lciLca'}
        <label for="taxa-lci"><span>Rentabilidade (% do CDI)</span><input id="taxa-lci" bind:value={inputs.lciPercentualCdi} inputmode={numericMode} /></label>
      {:else if product.id === 'tesouroSelic'}
        <p>Acompanha a Selic informada.</p>
      {:else if product.id === 'tesouroPrefixado'}
        <label for="taxa-prefixado"><span>Rentabilidade (% a.a.)</span><input id="taxa-prefixado" bind:value={inputs.tesouroPre} inputmode={numericMode} /></label>
      {:else}
        <label for="taxa-ipca-fixo"><span>Componente fixo (% a.a.)</span><input id="taxa-ipca-fixo" bind:value={inputs.tesouroIpcaFixo} inputmode={numericMode} /></label>
      {/if}
    </article>
  {/each}
</div>
