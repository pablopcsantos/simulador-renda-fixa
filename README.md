# Simulador de Renda Fixa — Svelte + TypeScript + Tauri

Migração da aplicação desktop originalmente escrita em Python/Tkinter para uma base única capaz de gerar:

- uma versão online estática para GitHub Pages;
- uma versão desktop para Windows por meio do Tauri;
- builds inteiramente executados pelo GitHub Actions, sem exigir compiladores instalados no computador do autor.

## Funcionalidades migradas

- aporte inicial e mensal;
- prazo em meses ou anos, com slider, atalhos e limite de 100 anos;
- Selic, CDI, IPCA e TR editáveis;
- consulta automática de Selic e IPCA no SGS/BCB;
- CDB, LCI/LCA, Tesouro Selic, Tesouro Prefixado, Tesouro IPCA+ e Poupança;
- seleção dos produtos comparados e preferências de interface persistidas no navegador;
- IR regressivo conforme o algoritmo da versão Python original;
- ranking, destaque do melhor resultado e cartões detalhados;
- gráfico comparativo e evolução mensal interativa;
- referência opcional de preservação do poder de compra pelo IPCA;
- importação e exportação CSV;
- relatórios em texto, PNG e PDF, além de cópia para a área de transferência;
- informações sobre poupança e tributação;
- ajuste de tamanho de fonte;
- interface responsiva e tema escuro.

## Atenção sobre o modelo financeiro

A primeira migração preserva deliberadamente a lógica da versão Python para facilitar a comparação dos resultados. O algoritmo original não desconta IOF, embora a interface antiga contenha texto explicativo sobre IOF. O CDI também é aproximado como Selic menos 0,10 ponto percentual. No Tesouro IPCA+, a taxa anual usada continua sendo a soma simples de IPCA e componente fixo, em vez da composição exata entre os dois fatores. Revise essas premissas antes de tratar o simulador como modelo financeiro definitivo.

## Desenvolvimento

```bash
npm install
npm run dev
```

## Validação

```bash
npm test
npm run check
npm run build
```

Os testes cobrem o benchmark IPCA, os limites e resultados do cálculo, seleção de produtos, prazos, importação/exportação CSV, preferências locais e geração dos relatórios. Os workflows de publicação web e compilação Windows executam a suíte antes de gerar os artefatos.

## Build web

```bash
npm run build
```

O resultado fica em `dist/`.

## Build Tauri

Em um ambiente com os pré-requisitos do Tauri:

```bash
npm run tauri build
```

No fluxo recomendado deste projeto, o Windows é compilado no GitHub Actions, não no computador local.
