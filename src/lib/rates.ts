import type { RateSnapshot } from './types';

const CACHE_KEY = 'simulador-renda-fixa:taxas';

async function buscarUltimoValorSgs(codigo: number, signal?: AbortSignal): Promise<number> {
  const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${codigo}/dados/ultimos/1?formato=json`;
  const response = await fetch(url, { signal });

  if (!response.ok) {
    throw new Error(`Banco Central respondeu com HTTP ${response.status}.`);
  }

  const data = (await response.json()) as Array<{ data: string; valor: string }>;
  const valor = Number(data?.[0]?.valor?.replace(',', '.'));

  if (!Number.isFinite(valor)) {
    throw new Error(`Resposta inesperada do SGS para a série ${codigo}.`);
  }

  return valor;
}

export async function buscarTaxasAtuais(signal?: AbortSignal): Promise<RateSnapshot> {
  const [selic, ipca] = await Promise.all([
    buscarUltimoValorSgs(432, signal),
    buscarUltimoValorSgs(13522, signal)
  ]);

  // Preserva a aproximação usada no programa original.
  const cdi = selic - 0.1;

  const snapshot: RateSnapshot = {
    selic,
    cdi,
    ipca,
    atualizadoEm: new Date().toISOString()
  };

  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(snapshot));
  } catch {
    // A aplicação continua funcionando mesmo se o armazenamento estiver indisponível.
  }

  return snapshot;
}

export function carregarTaxasEmCache(): RateSnapshot | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as RateSnapshot;
    if (
      !Number.isFinite(parsed.selic) ||
      !Number.isFinite(parsed.cdi) ||
      !Number.isFinite(parsed.ipca) ||
      !parsed.atualizadoEm
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
