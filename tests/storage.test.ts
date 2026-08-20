import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';

import { createEmptyProductSelection } from '../src/lib/products.ts';
import {
  createDefaultSectionState,
  createDefaultUiPreferences,
  loadUiPreferences,
  saveUiPreferences
} from '../src/lib/storage.ts';

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'localStorage');
});

test('salva e recupera preferências válidas', () => {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: new MemoryStorage()
  });

  const products = { ...createEmptyProductSelection(), cdb: true, lciLca: true };
  const sections = { ...createDefaultSectionState(), avancadas: true };
  saveUiPreferences({ produtosAtivos: products, secoesAbertas: sections });

  assert.deepEqual(loadUiPreferences(), {
    produtosAtivos: products,
    secoesAbertas: sections
  });
});

test('usa padrões quando o armazenamento está inválido ou indisponível', () => {
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  storage.setItem('simulador-renda-fixa:preferencias-ui', JSON.stringify({
    version: 1,
    produtosAtivos: createEmptyProductSelection(),
    secoesAbertas: { investimento: true }
  }));

  assert.deepEqual(loadUiPreferences(), createDefaultUiPreferences());

  Reflect.deleteProperty(globalThis, 'localStorage');
  assert.deepEqual(loadUiPreferences(), createDefaultUiPreferences());
  assert.doesNotThrow(() => saveUiPreferences(createDefaultUiPreferences()));
});
