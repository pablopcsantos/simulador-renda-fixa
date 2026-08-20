# Simulador de Renda Fixa — Svelte + TypeScript + Tauri

Migração da aplicação desktop originalmente escrita em Python/Tkinter para uma base única capaz de gerar:

- uma versão online estática para GitHub Pages;
- uma versão desktop para Windows por meio do Tauri;
- builds inteiramente executados pelo GitHub Actions, sem exigir compiladores instalados no computador do autor.

## Funcionalidades migradas

- aporte inicial e mensal;
- prazo em meses ou anos;
- Selic, CDI, IPCA e TR editáveis;
- consulta automática de Selic e IPCA no SGS/BCB;
- CDB, LCI/LCA, Tesouro Selic, Tesouro Prefixado, Tesouro IPCA+ e Poupança;
- IR regressivo conforme o algoritmo da versão Python original;
- gráfico comparativo e gráfico de evolução;
- cartões de resultados;
- importação e exportação CSV;
- informações sobre poupança e tributação;
- ajuste de tamanho de fonte;
- interface responsiva e tema escuro.

## Atenção sobre o modelo financeiro

A primeira migração preserva deliberadamente a lógica da versão Python para facilitar a comparação dos resultados. O algoritmo original não desconta IOF, embora a interface antiga contenha texto explicativo sobre IOF. O CDI também é aproximado como Selic menos 0,10 ponto percentual. Revise essas premissas antes de tratar o simulador como modelo financeiro definitivo.

## Desenvolvimento

```bash
npm install
npm run dev
```

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
