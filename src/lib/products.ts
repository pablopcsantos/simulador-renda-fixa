import type { ProductId, ProductSelection } from './types';

export interface ProductDefinition {
  id: ProductId;
  nome: string;
  cor: string;
}

// Fonte única de verdade para identidade e cor dos produtos em toda a interface.
export const PRODUCTS: readonly ProductDefinition[] = [
  { id: 'poupanca', nome: 'Poupança', cor: '#f59e0b' },
  { id: 'cdb', nome: 'CDB', cor: '#38bdf8' },
  { id: 'lciLca', nome: 'LCI/LCA', cor: '#34d399' },
  { id: 'tesouroSelic', nome: 'Tesouro Selic', cor: '#a78bfa' },
  { id: 'tesouroPrefixado', nome: 'Tesouro Prefixado', cor: '#fb7185' },
  { id: 'tesouroIpca', nome: 'Tesouro IPCA+', cor: '#60a5fa' }
];

export const PRODUCT_COLORS: Readonly<Record<ProductId, string>> = Object.freeze(
  Object.fromEntries(PRODUCTS.map((product) => [product.id, product.cor])) as Record<ProductId, string>
);

export function createDefaultProductSelection(): ProductSelection {
  return {
    poupanca: true,
    cdb: true,
    lciLca: true,
    tesouroSelic: true,
    tesouroPrefixado: true,
    tesouroIpca: true
  };
}

export function createEmptyProductSelection(): ProductSelection {
  return {
    poupanca: false,
    cdb: false,
    lciLca: false,
    tesouroSelic: false,
    tesouroPrefixado: false,
    tesouroIpca: false
  };
}

export function getProductColor(productId: ProductId): string {
  return PRODUCT_COLORS[productId];
}

export function identifyProduct(nome: string): ProductId | null {
  const normalized = nome.trim().toLocaleLowerCase('pt-BR');

  if (normalized.startsWith('poupança') || normalized.startsWith('poupanca')) return 'poupanca';
  if (normalized.startsWith('cdb')) return 'cdb';
  if (normalized.startsWith('lci/lca') || normalized.startsWith('lci')) return 'lciLca';
  if (normalized.startsWith('tesouro selic')) return 'tesouroSelic';
  if (normalized.startsWith('tesouro pré') || normalized.startsWith('tesouro pre')) return 'tesouroPrefixado';
  if (normalized.startsWith('tesouro ipca+')) return 'tesouroIpca';

  return null;
}
