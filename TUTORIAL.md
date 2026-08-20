# Tutorial — publicar e compilar sem instalar ferramentas de desenvolvimento no Windows

## 1. Criar o repositório

1. Entre no GitHub pelo navegador.
2. Clique em **New repository**.
3. Sugestão de nome: `simulador-renda-fixa`.
4. Escolha **Public** se quiser usar GitHub Pages no fluxo mais simples.
5. Crie o repositório.

## 2. Enviar os arquivos deste projeto

Você pode usar **Add file > Upload files** para enviar os arquivos, preservando as pastas. Uma alternativa mais confortável é abrir um Codespace e copiar os arquivos pelo editor.

## 3. Criar um Codespace

1. No repositório, clique em **Code**.
2. Abra a guia **Codespaces**.
3. Clique em **Create codespace on main**.
4. Aguarde o editor abrir no navegador.

Nada precisa ser instalado no seu Windows para editar o projeto.

## 4. Instalar as dependências dentro do Codespace

No terminal do Codespace:

```bash
npm install
```

Isso instala Svelte, TypeScript, Vite e a CLI do Tauri apenas dentro do ambiente de nuvem.

## 5. Testar a versão web

No terminal:

```bash
npm run dev
```

O Codespaces detectará a porta 5173. Abra a pré-visualização encaminhada pelo GitHub.

Antes de salvar uma alteração, execute também:

```bash
npm test
npm run check
npm run build
```

Esses comandos validam os cálculos e relatórios, verificam Svelte/TypeScript e geram a mesma versão web usada na publicação.

## 6. Salvar as alterações

No terminal:

```bash
git add .
git commit -m "Migra simulador para Svelte e Tauri"
git push
```

Também é possível fazer commit pela aba **Source Control** do editor.

## 7. Habilitar GitHub Pages

1. Abra o repositório normal no GitHub.
2. Entre em **Settings**.
3. No menu lateral, abra **Pages**.
4. Em **Build and deployment > Source**, selecione **GitHub Actions**.
5. O arquivo `.github/workflows/pages.yml` já contém o workflow de publicação.
6. Faça um novo push para `main` ou abra **Actions > Publicar versão online > Run workflow**.
7. Quando o workflow terminar, a URL será exibida no deployment do GitHub Pages.

O workflow só publica quando os testes, a verificação de código e o build terminam com sucesso.

## 8. Gerar a versão Windows sem compilar no seu computador

1. Abra a aba **Actions** do repositório.
2. Clique em **Compilar versão Windows**.
3. Clique em **Run workflow**.
4. Selecione `main` e confirme.
5. Quando terminar, abra a execução concluída.
6. Na seção **Artifacts**, baixe `SimuladorRendaFixa-Windows-x64`.
7. Descompacte o arquivo baixado.
8. Coloque `simulador-renda-fixa.exe` em uma pasta, por exemplo:

```text
C:\Aplicativos\Simulador de Renda Fixa\
```

A versão Windows usa o WebView2 do Windows. Como o executável criado pelo workflow não estará assinado digitalmente, o Windows SmartScreen pode apresentar um aviso ao executá-lo.

## 9. Usar os relatórios do simulador

Depois de executar uma simulação, o menu **Exportar relatório** oferece:

- cópia de um resumo para a área de transferência;
- arquivo de texto em UTF-8;
- imagem PNG em alta resolução;
- relatório PDF paginado.

O botão **Correção pelo IPCA** inclui ou remove a referência de poder de compra da tela e dos relatórios. A importação CSV continua compatível com o formato legado, mas esse formato não contém parâmetros, prazo nem histórico mensal.

## 10. Atualizações futuras

O fluxo diário fica simples:

1. abrir o Codespace no navegador;
2. editar/testar;
3. fazer commit e push;
4. GitHub Actions atualiza automaticamente o site;
5. quando desejar um novo `.exe`, executar manualmente o workflow **Compilar versão Windows**.

## 11. Arquivo Python original

A versão anterior foi preservada em `legacy/simulador_renda_fixa_vfinal4.py` para comparação e auditoria da migração.
