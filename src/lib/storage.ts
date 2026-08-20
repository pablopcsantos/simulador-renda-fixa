import { createDefaultProductSelection, PRODUCTS } from './products.ts';
import type { FormSectionId, FormSectionState, ProductSelection } from './types';

const UI_PREFERENCES_KEY = 'simulador-renda-fixa:preferencias-ui';
const UI_PREFERENCES_VERSION = 1;

export interface UiPreferences {
  produtosAtivos: ProductSelection;
  secoesAbertas: FormSectionState;
}

export function createDefaultSectionState(): FormSectionState {
  return {
    investimento: true,
    mercado: true,
    produtos: true,
    avancadas: false,
    tributacao: false
  };
}

export function createDefaultUiPreferences(): UiPreferences {
  return {
    produtosAtivos: createDefaultProductSelection(),
    secoesAbertas: createDefaultSectionState()
  };
}

function validProductSelection(value: unknown): value is ProductSelection {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return PRODUCTS.every((product) => typeof candidate[product.id] === 'boolean') &&
    PRODUCTS.some((product) => candidate[product.id] === true);
}

function validSectionState(value: unknown): value is FormSectionState {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  const sectionIds: FormSectionId[] = ['investimento', 'mercado', 'produtos', 'avancadas', 'tributacao'];
  return sectionIds.every((sectionId) => typeof candidate[sectionId] === 'boolean');
}

export function loadUiPreferences(): UiPreferences {
  const defaults = createDefaultUiPreferences();

  try {
    const raw = localStorage.getItem(UI_PREFERENCES_KEY);
    if (!raw) return defaults;

    const parsed = JSON.parse(raw) as {
      version?: unknown;
      produtosAtivos?: unknown;
      secoesAbertas?: unknown;
    };

    if (parsed.version !== UI_PREFERENCES_VERSION) return defaults;

    return {
      produtosAtivos: validProductSelection(parsed.produtosAtivos) ? parsed.produtosAtivos : defaults.produtosAtivos,
      secoesAbertas: validSectionState(parsed.secoesAbertas) ? parsed.secoesAbertas : defaults.secoesAbertas
    };
  } catch {
    return defaults;
  }
}

export function saveUiPreferences(preferences: UiPreferences): void {
  try {
    localStorage.setItem(
      UI_PREFERENCES_KEY,
      JSON.stringify({ version: UI_PREFERENCES_VERSION, ...preferences })
    );
  } catch {
    // Preferências são opcionais; a simulação funciona sem armazenamento local.
  }
}
