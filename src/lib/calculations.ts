import { parseBrNumber } from './formatting.ts';
import { durationInMonths, MAX_SIMULATION_MONTHS } from './duration.ts';
import { createDefaultProductSelection } from './products.ts';
import type { InvestmentResult, ProductId, ProductSelection, SimulationInputs } from './types';

interface Contribution {
  principal: number;
  valorAtual: number;
  idade: number;
}

export function calcularEvolucao(
  aporteInicial: number,
  aporteMensal: number,
  taxaAnual: number,
  meses: number,
  tributavel = true
): Omit<InvestmentResult, 'produtoId' | 'nome' | 'nomeSimples' | 'caracteristica'> {
  if (!Number.isFinite(aporteInicial) || !Number.isFinite(aporteMensal) || aporteInicial < 0 || aporteMensal < 0) {
    throw new Error('Os aportes devem ser números finitos e não negativos.');
  }
  if (!Number.isSafeInteger(meses) || meses < 1 || meses > MAX_SIMULATION_MONTHS) {
    throw new Error('O prazo deve ser um número inteiro entre 1 e 1.200 meses.');
  }
  if (!Number.isFinite(taxaAnual) || taxaAnual <= -100) {
    throw new Error('As taxas anuais devem ser números finitos maiores que -100%.');
  }

  const taxaMensal = Math.pow(1 + taxaAnual / 100, 1 / 12) - 1;
  if (!Number.isFinite(taxaMensal)) {
    throw new Error('Não foi possível converter a taxa anual informada para uma taxa mensal.');
  }

  const aportes: Contribution[] = [
    { principal: aporteInicial, valorAtual: aporteInicial, idade: 0 }
  ];
  const historicoLiquido = [aporteInicial];

  for (let mes = 1; mes <= meses; mes += 1) {
    for (const aporte of aportes) {
      aporte.valorAtual *= 1 + taxaMensal;
      aporte.idade += 1;

      if (!Number.isFinite(aporte.valorAtual)) {
        throw new Error('O cálculo excedeu o limite numérico suportado. Reduza aportes, taxas ou prazo.');
      }
    }

    let saldoLiquidoMes = 0;

    for (const aporte of aportes) {
      const lucro = aporte.valorAtual - aporte.principal;

      if (tributavel && lucro > 0) {
        const idadeMeses = aporte.idade;
        let aliquota: number;

        if (idadeMeses <= 6) aliquota = 0.225;
        else if (idadeMeses <= 12) aliquota = 0.2;
        else if (idadeMeses <= 24) aliquota = 0.175;
        else aliquota = 0.15;

        const lucroLiquido = lucro * (1 - aliquota);
        saldoLiquidoMes += aporte.principal + lucroLiquido;
      } else {
        saldoLiquidoMes += aporte.valorAtual;
      }

      if (!Number.isFinite(saldoLiquidoMes)) {
        throw new Error('O cálculo excedeu o limite numérico suportado. Reduza aportes, taxas ou prazo.');
      }
    }

    historicoLiquido.push(saldoLiquidoMes);

    // Preserva exatamente o comportamento do aplicativo Python original:
    // o aporte mensal é acrescentado ao final de cada mês, exceto no último.
    if (mes < meses) {
      aportes.push({ principal: aporteMensal, valorAtual: aporteMensal, idade: 0 });
    }
  }

  const valorBrutoTotal = aportes.reduce((total, aporte) => total + aporte.valorAtual, 0);
  const valorLiquidoTotal = historicoLiquido.at(-1) ?? aporteInicial;
  const impostoPagoTotal = valorBrutoTotal - valorLiquidoTotal;
  const investido = meses > 0 ? aporteInicial + aporteMensal * (meses - 1) : aporteInicial;

  if (![valorBrutoTotal, valorLiquidoTotal, impostoPagoTotal, investido].every(Number.isFinite)) {
    throw new Error('O cálculo excedeu o limite numérico suportado. Reduza aportes, taxas ou prazo.');
  }

  return {
    bruto: valorBrutoTotal,
    liquido: valorLiquidoTotal,
    imposto: impostoPagoTotal,
    taxaIr: tributavel ? '15% a 22,5% (Regressiva)' : 'Isento',
    investido,
    historico: historicoLiquido
  };
}

interface InvestmentDefinition {
  produtoId: ProductId;
  nome: string;
  nomeSimples: string;
  caracteristica: string;
  taxa: number;
  tributavel: boolean;
}

interface InvestmentBlueprint {
  produtoId: ProductId;
  create: () => Omit<InvestmentDefinition, 'produtoId'>;
}

export function simularInvestimentos(
  inputs: SimulationInputs,
  produtosAtivos: ProductSelection = createDefaultProductSelection()
): InvestmentResult[] {
  const inicial = parseBrNumber(inputs.aporteInicial);
  const mensal = parseBrNumber(inputs.aporteMensal);
  const meses = durationInMonths(inputs.prazo, inputs.prazoUnidade);

  if (inicial < 0 || mensal < 0) {
    throw new Error('Os aportes não podem ser negativos.');
  }
  if (meses < 1) {
    throw new Error('O prazo deve ser de pelo menos 1 mês ou 1 ano.');
  }
  if (!Number.isSafeInteger(meses) || meses > MAX_SIMULATION_MONTHS) {
    throw new Error('O prazo deve ser inteiro e não pode ultrapassar 1.200 meses (100 anos).');
  }
  if (!Object.values(produtosAtivos).some(Boolean)) {
    throw new Error('Selecione pelo menos um investimento para comparar.');
  }

  const blueprints: InvestmentBlueprint[] = [
    {
      produtoId: 'poupanca',
      create: () => {
        const selic = parseBrNumber(inputs.selic);
        const tr = parseBrNumber(inputs.tr);
        const taxa = selic > 8.5
          ? (Math.pow(1.005, 12) - 1) * 100 + tr
          : selic * 0.7 + tr;
        const caracteristica = `${taxa.toFixed(2).replace('.', ',')}% a.a.`;

        return {
          nome: `Poupança (${caracteristica})`,
          nomeSimples: 'Poupança',
          caracteristica,
          taxa,
          tributavel: false
        };
      }
    },
    {
      produtoId: 'cdb',
      create: () => {
        const taxa = parseBrNumber(inputs.cdi) * (parseBrNumber(inputs.cdbPercentualCdi) / 100);
        const caracteristica = `${inputs.cdbPercentualCdi.trim()}% do CDI`;
        return { nome: `CDB (${caracteristica})`, nomeSimples: 'CDB', caracteristica, taxa, tributavel: true };
      }
    },
    {
      produtoId: 'lciLca',
      create: () => {
        const taxa = parseBrNumber(inputs.cdi) * (parseBrNumber(inputs.lciPercentualCdi) / 100);
        const caracteristica = `${inputs.lciPercentualCdi.trim()}% do CDI`;
        return { nome: `LCI/LCA (${caracteristica})`, nomeSimples: 'LCI/LCA', caracteristica, taxa, tributavel: false };
      }
    },
    {
      produtoId: 'tesouroSelic',
      create: () => {
        const taxa = parseBrNumber(inputs.selic);
        const caracteristica = `${taxa.toFixed(2).replace('.', ',')}% a.a.`;
        return { nome: `Tesouro Selic (${caracteristica})`, nomeSimples: 'Tesouro Selic', caracteristica, taxa, tributavel: true };
      }
    },
    {
      produtoId: 'tesouroPrefixado',
      create: () => {
        const taxa = parseBrNumber(inputs.tesouroPre);
        const caracteristica = `${inputs.tesouroPre.trim()}% a.a.`;
        return { nome: `Tesouro Prefixado (${caracteristica})`, nomeSimples: 'Tesouro Prefixado', caracteristica, taxa, tributavel: true };
      }
    },
    {
      produtoId: 'tesouroIpca',
      create: () => {
        const taxa = parseBrNumber(inputs.ipca) + parseBrNumber(inputs.tesouroIpcaFixo);
        const caracteristica = `IPCA + ${inputs.tesouroIpcaFixo.trim()}%`;
        return { nome: `Tesouro IPCA+ (${caracteristica})`, nomeSimples: 'Tesouro IPCA+', caracteristica, taxa, tributavel: true };
      }
    }
  ];

  return blueprints
    .filter((blueprint) => produtosAtivos[blueprint.produtoId])
    .map((blueprint) => {
      const investimento: InvestmentDefinition = { produtoId: blueprint.produtoId, ...blueprint.create() };
      return {
        ...calcularEvolucao(inicial, mensal, investimento.taxa, meses, investimento.tributavel),
        produtoId: investimento.produtoId,
        nome: investimento.nome,
        nomeSimples: investimento.nomeSimples,
        caracteristica: investimento.caracteristica
      };
    });
}
