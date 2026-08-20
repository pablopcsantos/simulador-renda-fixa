export type PrazoUnidade = 'Meses' | 'Anos';
export type ChartMode = 'barras' | 'linhas';
export type ProductId =
  | 'poupanca'
  | 'cdb'
  | 'lciLca'
  | 'tesouroSelic'
  | 'tesouroPrefixado'
  | 'tesouroIpca';

export type ProductSelection = Record<ProductId, boolean>;

export type FormSectionId = 'investimento' | 'mercado' | 'produtos' | 'avancadas' | 'tributacao';
export type FormSectionState = Record<FormSectionId, boolean>;

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
  produtoId: ProductId;
  nome: string;
  nomeSimples: string;
  caracteristica: string;
  bruto: number;
  liquido: number;
  imposto: number;
  taxaIr: string;
  investido: number;
  historico: number[];
}

export interface IpcaBenchmarkResult {
  kind: 'benchmark';
  benchmarkId: 'ipca-preservation';
  nome: 'Correção pelo IPCA';
  descricao: string;
  investido: number;
  valorFinal: number;
  historico: number[];
}

export interface SimulationRun {
  origin: 'calculated' | 'legacy-csv';
  createdAt: string;
  inputs: SimulationInputs | null;
  produtosAtivos: ProductSelection;
  resultados: InvestmentResult[];
  prazoMeses: number | null;
  hasMonthlyHistory: boolean;
  benchmarkIpca: IpcaBenchmarkResult | null;
  rateStatus: string;
}

export interface RateSnapshot {
  selic: number;
  cdi: number;
  ipca: number;
  atualizadoEm: string;
}
