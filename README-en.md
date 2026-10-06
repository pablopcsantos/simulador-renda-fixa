# Fixed-Income Simulator

*Leia isto em outros idiomas: [Português](README.md)*

---

Migration of the desktop application originally written in Python/Tkinter to a single codebase capable of generating:

- a static online version for GitHub Pages;
- a Windows desktop version through Tauri;
- builds executed entirely by GitHub Actions, without requiring compilers to be installed on the author's computer.

## Migrated features

- initial and monthly contributions;
- investment period in months or years, with slider, shortcuts, and a 100-year limit;
- editable Selic, CDI, IPCA, and TR rates;
- automatic retrieval of Selic and IPCA data from SGS/BCB;
- CDB, LCI/LCA, Tesouro Selic, Tesouro Prefixado, Tesouro IPCA+, and savings accounts;
- selection of products to compare and interface preferences persisted in the browser;
- regressive income tax according to the algorithm of the original Python version;
- ranking, highlighting of the best result, and detailed cards;
- comparative chart and interactive monthly evolution;
- optional IPCA-based purchasing-power preservation reference;
- CSV import and export;
- reports in text, PNG, and PDF formats, as well as clipboard copying;
- information about savings accounts and taxation;
- font-size adjustment;
- responsive interface and dark theme.

## Important note about the financial model

The initial migration deliberately preserves the logic of the Python version to make result comparison easier. The original algorithm does not deduct IOF, although the old interface contains explanatory text about IOF. CDI is also approximated as Selic minus 0.10 percentage point. For Tesouro IPCA+, the annual rate used remains the simple sum of IPCA and the fixed component instead of the exact compounding of the two factors. Review these assumptions before treating the simulator as a definitive financial model.

## Development

```bash
npm install
npm run dev
```

## Verification

```bash
npm test
npm run check
npm run build
```

The tests cover the IPCA benchmark, calculation limits and results, product selection, investment periods, CSV import/export, local preferences, and report generation. The web publishing and Windows compilation workflows run the test suite before generating artifacts.

## Web build

```bash
npm run build
```

The result is generated in `dist/`.

## Tauri build

In an environment with the Tauri prerequisites installed:

```bash
npm run tauri build
```

In the recommended workflow for this project, the Windows version is compiled through GitHub Actions rather than on the local computer.

## 👤 Authorship and development

The **Fixed-Income Simulator** is a cross-platform financial simulation application independently developed by **Pablo Phillipe Cândido dos Santos** for educational comparison of fixed-income products under configurable scenarios. The same Svelte and TypeScript codebase generates both a static web version and a Windows desktop version through Tauri, combining simulations, graphical comparisons, CSV import/export, and report generation.

Generative artificial intelligence tools were used as auxiliary resources during development, while the author remained responsible for the project's conception, implementation, integration, and verification.

Lattes CV: [http://lattes.cnpq.br/9500873674712528](http://lattes.cnpq.br/9500873674712528)

