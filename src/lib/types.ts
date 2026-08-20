export type PrazoUnidade = 'Meses' | 'Anos';
export type ChartMode = 'barras' | 'linhas';

export interface SimulationInputs {
  aporteInicial: string;
  aporteMensal: string;
  prazo: string;
  prazoUnidade: PrazoUnidade;
  selic: string;
  cdi: string;
  ipca: string;
  tr: string;
  cdbPercentualCdi: string;
  lciPercentualCdi: string;
  tesouroPre: string;
  tesouroIpcaFixo: string;
}

export interface InvestmentResult {
  nome: string;
  nomeSimples: string;
  bruto: number;
  liquido: number;
  imposto: number;
  taxaIr: string;
  investido: number;
  historico: number[];
}

export interface RateSnapshot {
  selic: number;
  cdi: number;
  ipca: number;
  atualizadoEm: string;
}
