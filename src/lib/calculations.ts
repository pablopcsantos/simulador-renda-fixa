import { parseBrNumber } from './formatting';
import type { InvestmentResult, SimulationInputs } from './types';

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
): Omit<InvestmentResult, 'nome' | 'nomeSimples'> {
  const taxaMensal = Math.pow(1 + taxaAnual / 100, 1 / 12) - 1;
  const aportes: Contribution[] = [
    { principal: aporteInicial, valorAtual: aporteInicial, idade: 0 }
  ];
  const historicoLiquido = [aporteInicial];

  for (let mes = 1; mes <= meses; mes += 1) {
    for (const aporte of aportes) {
      aporte.valorAtual *= 1 + taxaMensal;
      aporte.idade += 1;
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

  return {
    bruto: valorBrutoTotal,
    liquido: valorLiquidoTotal,
    imposto: impostoPagoTotal,
    taxaIr: tributavel ? '15% a 22,5% (Regressiva)' : 'Isento',
    investido,
    historico: historicoLiquido
  };
}

export function simularInvestimentos(inputs: SimulationInputs): InvestmentResult[] {
  const inicial = parseBrNumber(inputs.aporteInicial);
  const mensal = parseBrNumber(inputs.aporteMensal);
  const valorPrazo = Math.trunc(parseBrNumber(inputs.prazo));

  if (inicial < 0 || mensal < 0) {
    throw new Error('Os aportes não podem ser negativos.');
  }
  if (valorPrazo < 1) {
    throw new Error('O prazo deve ser de pelo menos 1 mês ou 1 ano.');
  }

  const meses = inputs.prazoUnidade === 'Anos' ? valorPrazo * 12 : valorPrazo;
  const selic = parseBrNumber(inputs.selic);
  const cdi = parseBrNumber(inputs.cdi);
  const ipca = parseBrNumber(inputs.ipca);
  const tr = parseBrNumber(inputs.tr);

  const taxaPoupancaAnual =
    selic > 8.5
      ? (Math.pow(1.005, 12) - 1) * 100 + tr
      : selic * 0.7 + tr;

  const taxaTesouroSelic = selic;
  const taxaCdb = cdi * (parseBrNumber(inputs.cdbPercentualCdi) / 100);
  const taxaLci = cdi * (parseBrNumber(inputs.lciPercentualCdi) / 100);
  const taxaPre = parseBrNumber(inputs.tesouroPre);
  const taxaIpca = ipca + parseBrNumber(inputs.tesouroIpcaFixo);

  const ativos: Array<[string, string, number, boolean]> = [
    [`Poupança (${taxaPoupancaAnual.toFixed(2).replace('.', ',')}% a.a.)`, 'Poupança', taxaPoupancaAnual, false],
    [`CDB (${inputs.cdbPercentualCdi.trim()}% do CDI)`, 'CDB', taxaCdb, true],
    [`LCI/LCA (${inputs.lciPercentualCdi.trim()}% do CDI)`, 'LCI/LCA', taxaLci, false],
    [`Tesouro Selic (${selic.toFixed(2).replace('.', ',')}% a.a.)`, 'Tesouro Selic', taxaTesouroSelic, true],
    [`Tesouro Pré (${inputs.tesouroPre.trim()}% a.a.)`, 'Tesouro Pré', taxaPre, true],
    [`Tesouro IPCA+ (IPCA + ${inputs.tesouroIpcaFixo.trim()}%)`, 'Tesouro IPCA+', taxaIpca, true]
  ];

  return ativos.map(([nome, nomeSimples, taxa, tributavel]) => ({
    ...calcularEvolucao(inicial, mensal, taxa, meses, tributavel),
    nome,
    nomeSimples
  }));
}
