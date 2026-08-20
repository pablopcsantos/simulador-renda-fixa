<script lang="ts">
  export let kind: 'poupanca' | 'imposto' | null = null;
  export let onClose: () => void;

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) onClose();
  }

  function manageDialogFocus(node: HTMLElement) {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

    (node.querySelector<HTMLElement>(focusableSelector) ?? node).focus();

    function handleKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusableElements = Array.from(node.querySelectorAll<HTMLElement>(focusableSelector))
        .filter((element) => !element.hasAttribute('disabled'));

      if (focusableElements.length === 0) {
        event.preventDefault();
        node.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    node.addEventListener('keydown', handleKeydown);

    return {
      destroy() {
        node.removeEventListener('keydown', handleKeydown);
        previouslyFocused?.focus();
      }
    };
  }
</script>

{#if kind}
  <div class="modal-backdrop" role="presentation" onclick={handleBackdropClick}>
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabindex="-1" use:manageDialogFocus>
      <header>
        <div>
          <span class="eyebrow">INFORMAÇÕES</span>
          <h2 id="modal-title">{kind === 'poupanca' ? 'Como o simulador calcula a poupança' : 'Tributação no modelo atual'}</h2>
        </div>
        <button class="close-button" type="button" onclick={onClose} aria-label="Fechar">×</button>
      </header>

      {#if kind === 'poupanca'}
        <div class="modal-content">
          <p>O aplicativo original modela a remuneração da poupança com a TR e uma parcela adicional condicionada à meta Selic.</p>
          <ul>
            <li>Com Selic acima de 8,5% a.a., usa 0,5% ao mês anualizado, somado à TR informada.</li>
            <li>Com Selic igual ou abaixo de 8,5% a.a., usa 70% da Selic, somado à TR informada.</li>
            <li>No simulador, a poupança é tratada como isenta de IR.</li>
          </ul>
          <p class="warning-box">A TR não é buscada automaticamente: confirme ou ajuste o campo antes da simulação.</p>
        </div>
      {:else}
        <div class="modal-content">
          <p>Esta migração preserva o algoritmo tributário da versão Python original.</p>
          <ul>
            <li>Até 6 meses: 22,5% sobre o lucro.</li>
            <li>7 a 12 meses: 20%.</li>
            <li>13 a 24 meses: 17,5%.</li>
            <li>Acima de 24 meses: 15%.</li>
          </ul>
          <p>Cada aporte mensal é tratado separadamente conforme sua idade no momento final da simulação.</p>
          <p class="warning-box"><strong>Importante:</strong> embora a versão original contenha texto explicativo sobre IOF, o algoritmo de cálculo não aplica IOF. Esta primeira migração mantém esse comportamento para que os resultados sejam comparáveis à versão original.</p>
        </div>
      {/if}

      <footer><button class="primary-button" type="button" onclick={onClose}>Fechar</button></footer>
    </div>
  </div>
{/if}
