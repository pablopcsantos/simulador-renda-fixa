import tkinter as tk
from tkinter import ttk, messagebox, filedialog
import matplotlib.pyplot as plt
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
import matplotlib.patches as mpatches
import csv
import requests
import threading
import time
import matplotlib
import os
import multiprocessing

matplotlib.use('TkAgg')

class ScrollableFrame(tk.Frame):
    def __init__(self, container, *args, **kwargs):
        super().__init__(container, bg="#1a1b26", *args, **kwargs)
        self.canvas = tk.Canvas(self, bg="#1a1b26", highlightthickness=0)
        scrollbar = ttk.Scrollbar(self, orient="vertical", command=self.canvas.yview)
        self.scrollable_frame = tk.Frame(self.canvas, bg="#1a1b26")

        self.scrollable_frame.bind(
            "<Configure>",
            lambda e: self.canvas.configure(
                scrollregion=self.canvas.bbox("all")
            )
        )

        self.canvas_window = self.canvas.create_window((0, 0), window=self.scrollable_frame, anchor="nw")
        self.canvas.configure(yscrollcommand=scrollbar.set)
        self.canvas.bind('<Configure>', self._configure_canvas)

        self.canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")
        
    def _configure_canvas(self, event):
        self.canvas.itemconfig(self.canvas_window, width=event.width)

class SimuladorRendaFixa:
    def __init__(self, root):
        self.root = root
        self.root.title("Simulador de Renda Fixa")
        self.root.geometry("1150x850")
        self.root.configure(bg="#1a1b26")
        
        # Garante o fechamento completo do processo
        self.root.protocol("WM_DELETE_WINDOW", self.fechar_app)
        
        try:
            self.root.state('zoomed')
        except:
            self.root.attributes('-zoomed', True)
        
        self.tamanho_fonte = 15
        self.entradas = [] 
        self.tipo_grafico = 'barras'
        self.ultimos_resultados = None
        
        self.style = ttk.Style()
        if 'clam' in self.style.theme_names():
            self.style.theme_use('clam')
            
        self.atualizar_fonte()
        self.dados_simulacao = None
        self.criar_menu()
        
        self.main_paned = ttk.PanedWindow(self.root, orient=tk.HORIZONTAL)
        self.main_paned.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

        self.frame_esq_container = ttk.Frame(self.main_paned)
        self.main_paned.add(self.frame_esq_container, weight=1)
        
        self.canvas_inputs = tk.Canvas(self.frame_esq_container, bg="#1a1b26", highlightthickness=0)
        self.scrollbar = ttk.Scrollbar(self.frame_esq_container, orient="vertical", command=self.canvas_inputs.yview)
        
        self.frame_inputs = tk.Frame(self.canvas_inputs, bg="#1a1b26", padx=10, pady=10)
        
        self.frame_inputs.bind("<Configure>", lambda e: self.canvas_inputs.configure(scrollregion=self.canvas_inputs.bbox("all")))
        self.canvas_window = self.canvas_inputs.create_window((0, 0), window=self.frame_inputs, anchor="nw")
        self.canvas_inputs.bind("<Configure>", lambda e: self.canvas_inputs.itemconfig(self.canvas_window, width=e.width))
        self.canvas_inputs.configure(yscrollcommand=self.scrollbar.set)
        self.canvas_inputs.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        self.scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        self.frame_direita = ttk.Frame(self.main_paned)
        self.main_paned.add(self.frame_direita, weight=3)
        
        self.frame_topo_direita = tk.Frame(self.frame_direita, bg="#1a1b26")
        self.frame_topo_direita.pack(fill=tk.BOTH, expand=True)
        
        self.frame_botoes_grafico = tk.Frame(self.frame_topo_direita, bg="#1a1b26")
        self.frame_botoes_grafico.pack(fill=tk.X, pady=(0, 5))
        
        self.btn_barras = self.criar_botao_moderno(self.frame_botoes_grafico, "Gráfico de Barras", lambda: self.mudar_grafico('barras'), bg="#c75c10", hover_bg="#e67e22")
        self.btn_barras.pack(side=tk.LEFT, padx=(0, 5))
        
        self.btn_linhas = self.criar_botao_moderno(self.frame_botoes_grafico, "Gráfico de Linhas", lambda: self.mudar_grafico('linhas'), bg="#3d4453", hover_bg="#4a5263")
        self.btn_linhas.pack(side=tk.LEFT)
        
        self.frame_grafico = tk.Frame(self.frame_topo_direita, bg="#1a1b26")
        self.frame_grafico.pack(fill=tk.BOTH, expand=True)
        
        self.frame_resultados = tk.Frame(self.frame_direita, bg="#1a1b26")
        self.frame_resultados.pack(fill=tk.BOTH, expand=True, pady=(15, 0))

        self.criar_campos_entrada()
        self.criar_area_resultados()
        
        self.fig, self.ax = plt.subplots(figsize=(7, 4))
        self.fig.patch.set_facecolor('#1a1b26')
        self.ax.set_facecolor('#1a1b26')
        self.ax.tick_params(colors='white')
        self.ax.xaxis.label.set_color('white')
        self.ax.title.set_color('white')
        for spine in self.ax.spines.values():
            spine.set_edgecolor('#3d4453')
            
        self.canvas = FigureCanvasTkAgg(self.fig, master=self.frame_grafico)
        self.canvas.get_tk_widget().pack(fill=tk.BOTH, expand=True)
        
        # Bind global do mousewheel para controlar rolagem APENAS nos resultados
        self.root.bind_all("<MouseWheel>", self._on_mousewheel_global)
        self.root.bind_all("<Button-4>", self._on_mousewheel_global)
        self.root.bind_all("<Button-5>", self._on_mousewheel_global)
        
        threading.Thread(target=self.buscar_taxas_atuais, daemon=True).start()

    def _on_mousewheel_global(self, event):
        try:
            widget = self.root.winfo_containing(event.x_root, event.y_root)
            if not widget or isinstance(widget, tk.Text):
                return
                
            delta = 0
            if event.num == 4 or getattr(event, 'delta', 0) > 0:
                delta = -1
            elif event.num == 5 or getattr(event, 'delta', 0) < 0:
                delta = 1
                
            if delta != 0:
                # O usuário pediu explicitamente para que APENAS os resultados dos ativos se movimentem,
                # e não as taxas de entrada (área da esquerda). Se o widget estiver no frame da direita
                # (resultados/gráficos), rolamos a lista de cartelas.
                if str(widget).startswith(str(self.frame_direita)):
                    self.scroll_frame.canvas.yview_scroll(delta, "units")
        except Exception:
            pass

    def fechar_app(self):
        try:
            plt.close('all')
            self.root.quit()
            self.root.destroy()
        except:
            pass
        finally:
            os._exit(0)

    def mudar_grafico(self, tipo):
        self.tipo_grafico = tipo
        if tipo == 'barras':
            self.btn_barras.configure(bg="#c75c10")
            self.btn_linhas.configure(bg="#3d4453")
        else:
            self.btn_barras.configure(bg="#3d4453")
            self.btn_linhas.configure(bg="#c75c10")
            
        if self.ultimos_resultados:
            self.atualizar_visualizacao(self.ultimos_resultados, animar=False)

    def atualizar_fonte(self):
        fonte_base = ('Arial', self.tamanho_fonte)
        self.style.configure(".", font=fonte_base, background="#1a1b26", foreground="white")
        self.style.configure("TLabel", background="#1a1b26", foreground="white", font=fonte_base)
        self.style.configure("TFrame", background="#1a1b26")
        self.style.configure("TEntry", fieldbackground="#222733", foreground="white", insertcolor="white", borderwidth=1, font=fonte_base)
        self.style.configure("TCombobox", fieldbackground="#222733", foreground="white", selectbackground="#3d4453", font=fonte_base)
        self.style.map("TCombobox", fieldbackground=[('readonly', '#222733')], foreground=[('readonly', 'white')])
        
        if hasattr(self, 'entradas'):
            for widget in self.entradas:
                widget.configure(font=fonte_base)

    def criar_botao_moderno(self, parent, text, command, bg="#c75c10", hover_bg="#e67e22", fg="white", font_weight="bold"):
        btn = tk.Button(parent, text=text, command=command, bg=bg, fg=fg, 
                        font=("Arial", self.tamanho_fonte, font_weight), bd=0, relief="flat", cursor="hand2", padx=10, pady=8)
        
        def on_enter(e):
            if btn['state'] != tk.DISABLED:
                btn.default_bg = btn['background']
                btn['background'] = hover_bg
        def on_leave(e):
            if btn['state'] != tk.DISABLED:
                if hasattr(btn, 'default_bg'):
                    btn['background'] = btn.default_bg
                
        btn.bind("<Enter>", on_enter)
        btn.bind("<Leave>", on_leave)
        return btn

    def criar_menu(self):
        menubar = tk.Menu(self.root)
        self.root.config(menu=menubar)
        
        self.arquivo_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="Arquivo", menu=self.arquivo_menu)
        self.arquivo_menu.add_command(label="Importar CSV", command=self.importar_csv)
        self.arquivo_menu.add_command(label="Exportar Resultados (CSV)", command=self.exportar_csv, state=tk.DISABLED)
        
        config_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="Configurações", menu=config_menu)
        config_menu.add_command(label="Aumentar Tamanho da Letra", command=lambda: self.mudar_fonte(1))
        config_menu.add_command(label="Diminuir Tamanho da Letra", command=lambda: self.mudar_fonte(-1))

        info_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="Mais informações", menu=info_menu)
        info_menu.add_command(label="Como calcular juros da Poupança", command=self.abrir_info_poupanca)
        info_menu.add_command(label="Como calcular o Imposto de Renda", command=self.abrir_info_imposto)

    def mudar_fonte(self, delta):
        self.tamanho_fonte = max(8, min(24, self.tamanho_fonte + delta))
        self.atualizar_fonte()

    def _escurecer_cor(self, hex_color, fator=0.7):
        hex_color = hex_color.lstrip('#')
        if len(hex_color) == 6:
            r, g, b = tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
            return f'#{int(r * fator):02x}{int(g * fator):02x}{int(b * fator):02x}'
        return f'#{hex_color}'

    def converter_para_float(self, valor_str):
        valor_str = str(valor_str).replace('R$', '').replace('%', '').strip()
        if '.' in valor_str and ',' in valor_str:
            valor_str = valor_str.replace('.', '').replace(',', '.')
        elif ',' in valor_str:
            valor_str = valor_str.replace(',', '.')
        return float(valor_str)

    def abrir_info_poupanca(self):
        win = tk.Toplevel(self.root)
        win.title("Informações - Poupança")
        win.geometry("750x650")
        win.configure(bg="#1a1b26")
        
        text_area = tk.Text(win, wrap="word", bg="#1a1b26", fg="white", font=("Arial", 11), bd=0, padx=20, pady=20)
        scrollbar = ttk.Scrollbar(win, orient="vertical", command=text_area.yview)
        text_area.configure(yscrollcommand=scrollbar.set)
        
        text_area.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        content = """Como calcular juros da Poupança

De acordo com a legislação atual, a remuneração dos depósitos de poupança é composta de duas parcelas:

1. Remuneração básica: dada pela Taxa Referencial (TR).
2. Remuneração adicional: correspondente a:
    • 0,5% ao mês, enquanto a meta da taxa Selic ao ano for superior a 8,5%;
    • ou 70% da meta da taxa Selic ao ano, mensalizada, vigente na data de início do período de rendimento, enquanto a meta da taxa Selic ao ano for igual ou inferior a 8,5%.

A remuneração dos depósitos de poupança é calculada sobre o menor saldo de cada período de rendimento.

Período de Rendimento

A data de aniversário da conta de depósito de poupança é o dia do mês de sua abertura. Para contas abertas nos dias 29, 30 e 31, considera-se como data de aniversário o dia 1º do mês seguinte.

Crédito dos Rendimentos

• Mensalmente, na data de aniversário da conta, para depósitos de pessoa física e entidades sem fins lucrativos.
• Trimestralmente, na data de aniversário no último mês do trimestre, para os demais depósitos.

Como obtemos o índice da Poupança

Este projeto obtém automaticamente o índice mais recente da poupança por meio de integração com dados oficiais fornecidos pelo Banco Central do Brasil.

Impostos na Poupança

A poupança é isenta de imposto de renda, ou seja, os rendimentos não sofrem desconto de IR. Para entender melhor como funcionam os impostos em outros investimentos de renda fixa, confira nosso guia sobre como calcular o imposto de renda.

Fontes Oficiais

• Remuneração dos Depósitos de Poupança – BCB
"""
        
        text_area.insert(tk.END, content)
        
        text_area.tag_configure("h1", font=("Arial", 16, "bold"), foreground="#c75c10", spacing3=10)
        text_area.tag_configure("h2", font=("Arial", 13, "bold"), foreground="#3498db", spacing1=15, spacing3=5)
        text_area.tag_configure("destaque_caixa", background="#3d4453", font=("Arial", 11, "italic"))

        headers_h1 = ["Como calcular juros da Poupança"]
        headers_h2 = ["Período de Rendimento", "Crédito dos Rendimentos", "Como obtemos o índice da Poupança", "Impostos na Poupança", "Fontes Oficiais"]
        
        for h in headers_h1:
            idx = text_area.search(h, "1.0", tk.END)
            if idx:
                text_area.tag_add("h1", idx, f"{idx}+{len(h)}c")
        
        for h in headers_h2:
            idx = text_area.search(h, "1.0", tk.END)
            if idx:
                text_area.tag_add("h2", idx, f"{idx}+{len(h)}c")
                
        idx_inicio = text_area.search("A data de aniversário", "1.0", tk.END)
        if idx_inicio:
            idx_fim = text_area.search("mês seguinte.", idx_inicio, tk.END)
            if idx_fim:
                text_area.tag_add("destaque_caixa", idx_inicio, f"{idx_fim}+13c")

        text_area.configure(state=tk.DISABLED)

    def abrir_info_imposto(self):
        win = tk.Toplevel(self.root)
        win.title("Informações - Imposto de Renda")
        win.geometry("750x650")
        win.configure(bg="#1a1b26")
        
        text_area = tk.Text(win, wrap="word", bg="#1a1b26", fg="white", font=("Arial", 11), bd=0, padx=20, pady=20)
        scrollbar = ttk.Scrollbar(win, orient="vertical", command=text_area.yview)
        text_area.configure(yscrollcommand=scrollbar.set)
        
        text_area.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        content = """Como calcular o Imposto de Renda sobre investimentos

Esta página explica de forma clara e prática como o Imposto de Renda (IR) incide sobre as principais aplicações financeiras no Brasil (CDB/RDB, LCI/LCA, fundos, e poupança). As regras e tabelas aqui citadas seguem a legislação e normas oficiais (Receita Federal, Planalto, Banco Central e CVM). Veja os links no final da página.

Tabela regressiva de IR para aplicações de renda fixa

Para a maioria das aplicações de renda fixa (CDB, RDB, titles privados e públicos, fundos de renda fixa quando não tributados na fonte), o IR é cobrado de forma regressiva conforme o prazo do investimento:

    • Até 180 dias: 22,5%
    • 181 a 360 dias: 20%
    • 361 a 720 dias: 17,5%
    • Acima de 720 dias: 15%

IOF (resgates em menos de 30 dias)

Se o resgate ocorrer em até 29 dias do aporte, incide IOF regressivo sobre os rendimentos. Esta alíquota recai até 0% no 30º dia (1 = 96%, dia 29 = 3%). O IOF é cobrado sobre os rendimentos e reduz o ganho antes da aplicação do IR.

Investimentos Isentos

    • LCI / LCA: Letras de crédito Imobiliário e do Agronegócio são, em geral, isentas de IR para pessoa física (ou seja, não há retenção de IR sobre os rendimentos), visando incentivar os setores.
    • Poupança: Rendimentos de cadernetas de poupança são isentos de IR para pessoa física conforme legislação vigente.

Como realizar o cálculo (passo a passo)

    1. Calcule o rendimento bruto (juros) do investimento no período.
    2. Se houver resgate em até 29 dias, aplique a taxa de IOF sobre o rendimento bruto e subtraia o IOF do rendimento.
    3. Determine a alíquota de IR conforme a tabela regressiva pelo número de dias da aplicação.
    4. Calcule o IR sobre o rendimento líquido após IOF (quando aplicável) e subtraia do rendimento líquido para obter o rendimento final.

Exemplos práticos

Exemplos com valores reais e cálculos passo a passo para você entender como o IR e IOF afetam seus ganhos.

Exemplo 1: CDB resgatado em 120 dias (sem IOF)
Dados: Aporte de R$ 10.000 em CDB. Resgate após 120 dias com rendimento bruto de R$ 600.
    1. Dias de aplicação: 120 dias -> alíquota de IR = 22,5% (conforme tabela regressiva).
    2. IOF: Resgate após 30 dias -> IOF = 0% (não há cobrança de IOF).
    3. Cálculo do IR: 22,5% * R$ 600 = R$ 135,00.
    4. Rendimento líquido: R$ 600 - R$ 135 = R$ 465,00.
    5. Saldo final: R$ 10.000 + R$ 465 = R$ 10.465,00.

Exemplo 2: CDB resgatado em 15 dias (com IOF)
Dados: Mesmo aporte de R$ 10.000 em CDB. Resgate em apenas 15 dias com rendimento bruto de R$ 75.
    1. IOF (dia 15): Conforme a tabela regressiva de IOF (ver 'Tabela de IOF Regressivo'), ~50% sobre o rendimento bruto.
    2. Cálculo do IOF: 50% * R$ 75 = R$ 37,50.
    3. Rendimento após IOF: R$ 75 - R$ 37,50 = R$ 37,50.
    4. Dias de aplicação: 15 dias -> alíquota de IR = 22,5%.
    5. Cálculo do IR: 22,5% * R$ 37,50 = R$ 8,44 (arredondado).
    6. Rendimento líquido: R$ 37,50 - R$ 8,44 = R$ 29,06.
    7. Saldo final: R$ 10.000 + R$ 29,06 = R$ 10.029,06.
    (O resgate antecipado (dia 15) resultou em um ganho líquido de apenas R$ 29,06 contra R$ 465,00 no exemplo anterior. Esta é a razão pela qual aplicações de longo prazo tendem a ser mais vantajosas: menores alíquotas de IR e sem IOF).

Exemplo 3: LCI/LCA com mesmo rendimento (isento de IR)
Dados: Mesmo aporte de R$ 10.000 em LCI. Resgate após 120 dias com rendimento bruto de R$ 600.
    1. Rendimento bruto: R$ 600.
    2. IR: 0% (LCI/LCA são isentas de IR para pessoa física).
    3. IOF: 0% (não incide IOF em LCI/LCA).
    4. Rendimento líquido: R$ 600 - 0 = R$ 600,00.
    5. Saldo final: R$ 10.000 + R$ 600 = R$ 10.600,00.
    Comparação: Com LCI, você fica com R$ 600 de rendimento. Com CDB em 120 dias, ficou com R$ 465. A diferença (R$ 135) é justamente o IR que seria cobrado no CDB. Sempre verifique as conditions contratuais e se a isenção se aplica ao seu caso.

Exemplo 4: Poupança (rendimento isento)
Dados: R$ 10.000 em caderneta de poupança. Após 120 dias, rendimento bruto de R$ 60 (conforme índice da poupança vigente).
    1. Rendimento bruto: R$ 60.
    2. IR: 0% (poupança isenta de IR para pessoa física).
    3. Rendimento líquido: R$ 60 - 0 = R$ 60,00.
    4. Saldo final: R$ 10.000 + R$ 60 = R$ 10.060,00.
    Nota: Embora isenta de IR, a poupança geralmente oferece rentabilidade menor que CDB ou LCI. A escolha depende do seu objetivo (liquidez, segurança ou rentabilidade).

Observações importantes

    - As regras tributárias podem mudar, use sempre fontes oficiais para confirmar alíquotas e procedimentos.
    - Alguns fundos de investimento têm regime de tributação diferente (por exemplo, fundos listados como o come-cotas ou tributação equivalente para fundos de longo prazo). Consulte a documentação do fundo e a CVM.
    - Para declarar no Imposto de Renda anual, verifique as orientações da Receita Federal sobre rendimentos e PP.

Fontes oficiais

    - Medida Provisória nº 1.184/2023: Tributação de aplicações financeiras e ativos virtuais (Planalto)
    - Lei nº 13.191/2005: Tabela progressiva mensal do IRPF (Planalto)
    - Lei nº 9.250/1995: IRPF e base de cálculo (Planalto)
    - Receita Federal do Brasil: Orientações sobre Imposto de Renda
    - Receita Federal: Tabelas de Imposto de Renda (IRPF)
    - Banco Central: Remuneração dos Depósitos de Poupança
    - Banco Central do Brasil: Índices oficiais (DI, SELIC, Poupança)
    - CVM: Comissão de Valores Mobiliários (orientações sobre fundos e tributação)
"""
        
        text_area.insert(tk.END, content)
        
        text_area.tag_configure("h1", font=("Arial", 16, "bold"), foreground="#c75c10", spacing3=10)
        text_area.tag_configure("h2", font=("Arial", 13, "bold"), foreground="#3498db", spacing1=15, spacing3=5)
        text_area.tag_configure("destaque_caixa", background="#e7c46a", foreground="#1a1b26", font=("Arial", 11, "bold"), spacing1=10, spacing3=10, justify="center")

        headers_h1 = ["Como calcular o Imposto de Renda sobre investimentos"]
        headers_h2 = ["Tabela regressiva de IR para aplicações de renda fixa", "IOF (resgates em menos de 30 dias)", "Investimentos Isentos", "Como realizar o cálculo (passo a passo)", "Exemplos práticos", "Observações importantes", "Fontes oficiais"]
        
        for h in headers_h1:
            idx = text_area.search(h, "1.0", tk.END)
            if idx:
                text_area.tag_add("h1", idx, f"{idx}+{len(h)}c")
        
        for h in headers_h2:
            idx = text_area.search(h, "1.0", tk.END)
            if idx:
                text_area.tag_add("h2", idx, f"{idx}+{len(h)}c")
                
        idx_inicio = text_area.search("Exemplos com valores reais", "1.0", tk.END)
        if idx_inicio:
            idx_fim = text_area.search("afetam seus ganhos.", idx_inicio, tk.END)
            if idx_fim:
                text_area.tag_add("destaque_caixa", idx_inicio, f"{idx_fim}+19c")

        text_area.configure(state=tk.DISABLED)

    def buscar_taxas_atuais(self):
        try:
            resp_selic = requests.get("https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1", timeout=5)
            selic = float(resp_selic.json()[0]['valor'])
            resp_ipca = requests.get("https://api.bcb.gov.br/dados/serie/bcdata.sgs.13522/dados/ultimos/1", timeout=5)
            ipca = float(resp_ipca.json()[0]['valor'])
            cdi = selic - 0.10
            
            # Previne erro se o aplicativo for fechado antes da resposta da API
            if self.root.winfo_exists():
                self.root.after(0, self.atualizar_campos_taxas, selic, cdi, ipca)
        except Exception as e:
            pass

    def atualizar_campos_taxas(self, selic, cdi, ipca):
        self.ent_selic.delete(0, tk.END)
        self.ent_selic.insert(0, f"{selic:.2f}".replace('.', ','))
        self.ent_cdi.delete(0, tk.END)
        self.ent_cdi.insert(0, f"{cdi:.2f}".replace('.', ','))
        self.ent_ipca.delete(0, tk.END)
        self.ent_ipca.insert(0, f"{ipca:.2f}".replace('.', ','))

    def info_popup(self, taxa):
        infos = {
            "Selic": "A Taxa Selic é a taxa básica de juros da economia.\n\nVocê pode checar se o valor está correto no site do Banco Central do Brasil (bcb.gov.br).",
            "CDI": "O CDI acompanha de perto a Selic.\n\nVocê pode checar se o valor está correto no site da B3 (b3.com.br).",
            "IPCA": "O IPCA é o índice oficial de inflação do Brasil.\n\nVocê pode checar se o valor acumulado dos últimos 12 meses está correto no site do IBGE (ibge.gov.br) ou do Banco Central.",
            "TR": "A Taxa Referencial (TR) é usada na correção da Poupança.\n\nVocê pode checar se o valor está correto no site do Banco Central do Brasil (bcb.gov.br)."
        }
        messagebox.showinfo(f"Onde consultar: {taxa}", infos.get(taxa, ""))

    def criar_campos_entrada(self):
        row_idx = 0
        fonte_atual = ("Arial", self.tamanho_fonte)
        
        tk.Label(self.frame_inputs, text="Parâmetros de Investimento", bg="#1a1b26", fg="#3498db", font=("Arial", 13, "bold")).grid(row=row_idx, column=0, columnspan=3, pady=(10, 15), sticky="w")
        row_idx += 1
        
        ttk.Label(self.frame_inputs, text="Aporte Inicial (R$):").grid(row=row_idx, column=0, sticky="w")
        self.ent_inicial = ttk.Entry(self.frame_inputs, width=15, font=fonte_atual)
        self.ent_inicial.insert(0, "1000,00")
        self.ent_inicial.grid(row=row_idx, column=1, pady=8, sticky="w")
        self.entradas.append(self.ent_inicial)
        row_idx += 1
        
        ttk.Label(self.frame_inputs, text="Aporte Mensal (R$):").grid(row=row_idx, column=0, sticky="w")
        self.ent_mensal = ttk.Entry(self.frame_inputs, width=15, font=fonte_atual)
        self.ent_mensal.insert(0, "0,00")
        self.ent_mensal.grid(row=row_idx, column=1, pady=8, sticky="w")
        self.entradas.append(self.ent_mensal)
        row_idx += 1
        
        ttk.Label(self.frame_inputs, text="Prazo:").grid(row=row_idx, column=0, sticky="w")
        frame_prazo = tk.Frame(self.frame_inputs, bg="#1a1b26")
        frame_prazo.grid(row=row_idx, column=1, sticky="w", pady=8)
        
        self.ent_prazo = ttk.Entry(frame_prazo, width=6, font=fonte_atual)
        self.ent_prazo.insert(0, "1")
        self.ent_prazo.pack(side=tk.LEFT, padx=(0, 5))
        self.entradas.append(self.ent_prazo)
        
        self.combo_prazo = ttk.Combobox(frame_prazo, values=["Meses", "Anos"], width=7, state="readonly", font=fonte_atual)
        self.combo_prazo.current(1)
        self.combo_prazo.pack(side=tk.LEFT)
        self.entradas.append(self.combo_prazo)
        row_idx += 1

        tk.Label(self.frame_inputs, text="Taxas Anuais (%)", bg="#1a1b26", fg="#3498db", font=("Arial", 13, "bold")).grid(row=row_idx, column=0, columnspan=3, pady=(25, 12), sticky="w")
        row_idx += 1
        
        def add_rate_field(label_text, default_val, info_key):
            nonlocal row_idx
            ttk.Label(self.frame_inputs, text=label_text).grid(row=row_idx, column=0, sticky="w")
            ent = ttk.Entry(self.frame_inputs, width=15, font=fonte_atual)
            ent.insert(0, default_val)
            ent.grid(row=row_idx, column=1, pady=8, sticky="w")
            self.entradas.append(ent)
            
            btn = self.criar_botao_moderno(self.frame_inputs, text="?", command=lambda k=info_key: self.info_popup(k), bg="#3d4453", hover_bg="#4a5263")
            btn.config(padx=8, pady=2)
            btn.grid(row=row_idx, column=2, padx=5)
            row_idx += 1
            return ent

        self.ent_selic = add_rate_field("Taxa Selic:", "10,50", "Selic")
        self.ent_cdi = add_rate_field("Taxa CDI:", "10,40", "CDI")
        self.ent_ipca = add_rate_field("IPCA (Inflação):", "4,50", "IPCA")
        self.ent_tr = add_rate_field("TR:", "1,50", "TR")

        tk.Label(self.frame_inputs, text="Rentabilidade Oferecida", bg="#1a1b26", fg="#3498db", font=("Arial", 13, "bold")).grid(row=row_idx, column=0, columnspan=3, pady=(25, 12), sticky="w")
        row_idx += 1

        ttk.Label(self.frame_inputs, text="CDB (% do CDI):").grid(row=row_idx, column=0, sticky="w")
        self.ent_cdb = ttk.Entry(self.frame_inputs, width=15, font=fonte_atual)
        self.ent_cdb.insert(0, "100,0")
        self.ent_cdb.grid(row=row_idx, column=1, pady=8, sticky="w")
        self.entradas.append(self.ent_cdb)
        row_idx += 1

        ttk.Label(self.frame_inputs, text="LCI/LCA (% do CDI):").grid(row=row_idx, column=0, sticky="w")
        self.ent_lci = ttk.Entry(self.frame_inputs, width=15, font=fonte_atual)
        self.ent_lci.insert(0, "100,0")
        self.ent_lci.grid(row=row_idx, column=1, pady=8, sticky="w")
        self.entradas.append(self.ent_lci)
        row_idx += 1

        ttk.Label(self.frame_inputs, text="Tesouro Pré (% a.a):").grid(row=row_idx, column=0, sticky="w")
        self.ent_pre = ttk.Entry(self.frame_inputs, width=15, font=fonte_atual)
        self.ent_pre.insert(0, "11,0")
        self.ent_pre.grid(row=row_idx, column=1, pady=8, sticky="w")
        self.entradas.append(self.ent_pre)
        row_idx += 1

        ttk.Label(self.frame_inputs, text="Tesouro IPCA+ (Fixo):").grid(row=row_idx, column=0, sticky="w")
        self.ent_ipca_mais = ttk.Entry(self.frame_inputs, width=15, font=fonte_atual)
        self.ent_ipca_mais.insert(0, "5,50")
        self.ent_ipca_mais.grid(row=row_idx, column=1, pady=8, sticky="w")
        self.entradas.append(self.ent_ipca_mais)
        row_idx += 1

        self.btn_simular = self.criar_botao_moderno(self.frame_inputs, text="Simular Rentabilidade", command=self.simular)
        self.btn_simular.grid(row=row_idx, column=0, columnspan=3, pady=(35, 20), sticky="ew")
        
    def criar_area_resultados(self):
        self.scroll_frame = ScrollableFrame(self.frame_resultados)
        self.scroll_frame.pack(fill=tk.BOTH, expand=True)

    def criar_card(self, parent, resultado):
        investido = resultado['investido']
        rendimento_liquido = resultado['liquido'] - investido
        rendimento_bruto = resultado['bruto'] - investido
        
        bg_card = "#222733"
        bg_header = "#c75c10"
        bg_box_liq = "#202a44"
        bg_box_rend = "#173627"
        text_rend = "#2ecc71"
        
        card = tk.Frame(parent, bg=bg_card, bd=0, highlightthickness=1, highlightbackground="#3d4453")
        card.pack(fill=tk.X, pady=8, padx=10)

        header = tk.Label(card, text=resultado["nome_simples"], bg=bg_header, fg="white", font=("Arial", self.tamanho_fonte, "bold"), anchor="w", padx=10, pady=6)
        header.pack(fill=tk.X)

        main_frame = tk.Frame(card, bg=bg_card)
        main_frame.pack(fill=tk.X, pady=10, padx=10)
        main_frame.columnconfigure(0, weight=1)
        main_frame.columnconfigure(1, weight=1)

        box1 = tk.Frame(main_frame, bg=bg_box_liq, padx=10, pady=10)
        box1.grid(row=0, column=0, sticky="ew", padx=(0, 5))
        tk.Label(box1, text="Valor Total Líquido", bg=bg_box_liq, fg="#a0aec0", font=("Arial", max(8, self.tamanho_fonte-2))).pack(anchor="w")
        tk.Label(box1, text=f"R$ {resultado['liquido']:,.2f}".replace(',','X').replace('.',',').replace('X','.'), bg=bg_box_liq, fg="white", font=("Arial", self.tamanho_fonte+2, "bold")).pack(anchor="w")

        box2 = tk.Frame(main_frame, bg=bg_box_rend, padx=10, pady=10)
        box2.grid(row=0, column=1, sticky="ew", padx=(5, 0))
        tk.Label(box2, text="Rendimento Líquido", bg=bg_box_rend, fg="#a0aec0", font=("Arial", max(8, self.tamanho_fonte-2))).pack(anchor="w")
        tk.Label(box2, text=f"R$ {rendimento_liquido:,.2f}".replace(',','X').replace('.',',').replace('X','.'), bg=bg_box_rend, fg=text_rend, font=("Arial", self.tamanho_fonte+2, "bold")).pack(anchor="w")

        details_frame = tk.Frame(card, bg=bg_card)
        details_frame.pack(fill=tk.X, pady=(0, 10), padx=10)
        details_frame.columnconfigure(1, weight=1)

        def format_moeda(valor):
            return f"R$ {valor:,.2f}".replace(',','X').replace('.',',').replace('X','.')

        tk.Label(details_frame, text="● Valor Investido", bg=bg_card, fg="#3498db", font=("Arial", max(8, self.tamanho_fonte-1))).grid(row=0, column=0, sticky="w", pady=2)
        tk.Label(details_frame, text=format_moeda(investido), bg=bg_card, fg="white", font=("Arial", max(8, self.tamanho_fonte-1), "bold")).grid(row=0, column=1, sticky="e")
        
        tk.Label(details_frame, text="● Rendimento Bruto", bg=bg_card, fg=text_rend, font=("Arial", max(8, self.tamanho_fonte-1))).grid(row=1, column=0, sticky="w", pady=2)
        tk.Label(details_frame, text=format_moeda(rendimento_bruto), bg=bg_card, fg=text_rend, font=("Arial", max(8, self.tamanho_fonte-1), "bold")).grid(row=1, column=1, sticky="e")

        if resultado['imposto'] > 0:
            tk.Label(details_frame, text=f"● Deduções (IR: {resultado['taxa_ir']})", bg=bg_card, fg="#e74c3c", font=("Arial", max(8, self.tamanho_fonte-1))).grid(row=2, column=0, sticky="w", pady=2)
            tk.Label(details_frame, text=f"- {format_moeda(resultado['imposto'])}", bg=bg_card, fg="#e74c3c", font=("Arial", max(8, self.tamanho_fonte-1), "bold")).grid(row=2, column=1, sticky="e")

    def calcular_evolucao(self, aporte_inicial, aporte_mensal, taxa_anual, meses, tributavel=True):
        taxa_mensal = (1 + taxa_anual / 100) ** (1 / 12) - 1
        aportes = [{'principal': aporte_inicial, 'valor_atual': aporte_inicial, 'idade': 0}]
        hist_liquido = [aporte_inicial]
        
        for m in range(1, meses + 1):
            for aporte in aportes:
                aporte['valor_atual'] *= (1 + taxa_mensal)
                aporte['idade'] += 1
            
            saldo_liquido_mes = 0
            for aporte in aportes:
                lucro = aporte['valor_atual'] - aporte['principal']
                if tributavel and lucro > 0:
                    idade_meses = aporte['idade']
                    if idade_meses <= 6:
                        aliquota = 0.225
                    elif idade_meses <= 12:
                        aliquota = 0.200
                    elif idade_meses <= 24:
                        aliquota = 0.175
                    else:
                        aliquota = 0.150
                    lucro_liquido = lucro * (1 - aliquota)
                    saldo_liquido_mes += (aporte['principal'] + lucro_liquido)
                else:
                    saldo_liquido_mes += aporte['valor_atual']
            hist_liquido.append(saldo_liquido_mes)
            
            if m < meses:
                aportes.append({'principal': aporte_mensal, 'valor_atual': aporte_mensal, 'idade': 0})
            
        valor_bruto_total = sum(a['valor_atual'] for a in aportes)
        valor_liquido_total = hist_liquido[-1]
        imposto_pago_total = valor_bruto_total - valor_liquido_total
        investido = aporte_inicial + (aporte_mensal * (meses - 1)) if meses > 0 else aporte_inicial
        
        taxa_ir_str = "15% a 22,5% (Regressiva)" if tributavel else "Isento"
        
        return {
            "bruto": valor_bruto_total,
            "liquido": valor_liquido_total,
            "imposto": imposto_pago_total,
            "taxa_ir": taxa_ir_str,
            "investido": investido,
            "historico": hist_liquido
        }

    def simular(self):
        try:
            inicial = self.converter_para_float(self.ent_inicial.get())
            mensal = self.converter_para_float(self.ent_mensal.get())
            
            valor_prazo = int(self.converter_para_float(self.ent_prazo.get()))
            if self.combo_prazo.get() == "Anos":
                meses = valor_prazo * 12
            else:
                meses = valor_prazo
            
            selic = self.converter_para_float(self.ent_selic.get())
            cdi = self.converter_para_float(self.ent_cdi.get())
            ipca = self.converter_para_float(self.ent_ipca.get())
            tr = self.converter_para_float(self.ent_tr.get())
            
            if selic > 8.5:
                taxa_poupanca_anual = (((1.005) ** 12) - 1) * 100 + tr
            else:
                taxa_poupanca_anual = (selic * 0.70) + tr
                
            taxa_tselic = selic
            taxa_cdb = cdi * (self.converter_para_float(self.ent_cdb.get()) / 100)
            taxa_lci = cdi * (self.converter_para_float(self.ent_lci.get()) / 100)
            taxa_pre = self.converter_para_float(self.ent_pre.get())
            taxa_ipca = ipca + self.converter_para_float(self.ent_ipca_mais.get())
            
            str_poup = f"{taxa_poupanca_anual:.2f}".replace('.', ',')
            str_cdb = self.ent_cdb.get().strip()
            str_lci = self.ent_lci.get().strip()
            str_selic = f"{selic:.2f}".replace('.', ',')
            str_pre = self.ent_pre.get().strip()
            str_ipca = self.ent_ipca_mais.get().strip()

            ativos = [
                (f"Poupança ({str_poup}% a.a.)", "Poupança", taxa_poupanca_anual, False),
                (f"CDB ({str_cdb}% do CDI)", "CDB", taxa_cdb, True),
                (f"LCI/LCA ({str_lci}% do CDI)", "LCI/LCA", taxa_lci, False),
                (f"Tesouro Selic ({str_selic}% a.a.)", "Tesouro Selic", taxa_tselic, True),
                (f"Tesouro Pré ({str_pre}% a.a.)", "Tesouro Pré", taxa_pre, True),
                (f"Tesouro IPCA+ (IPCA + {str_ipca}%)", "Tesouro IPCA+", taxa_ipca, True)
            ]
            
            resultados = []
            for nome_grafico, nome_simples, taxa, tributavel in ativos:
                res = self.calcular_evolucao(inicial, mensal, taxa, meses, tributavel)
                res["nome"] = nome_grafico
                res["nome_simples"] = nome_simples
                resultados.append(res)
            
            self.ultimos_resultados = resultados
            self.atualizar_visualizacao(resultados, animar=True)

        except ValueError:
            messagebox.showerror("Erro de Formato", "Insira números válidos.\n\nVocê pode utilizar vírgulas (ex: 8,50) ou pontos (ex: 8.50).")

    def atualizar_visualizacao(self, resultados, animar=False):
        resultados.sort(key=lambda x: x["liquido"])
        
        self.ax.clear()
        nomes = [r["nome"] for r in resultados]
        liquidos = [r["liquido"] for r in resultados]
        cores = ['#7f8c8d', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6', '#e74c3c']
        cores_usadas = (cores * ((len(resultados) // len(cores)) + 1))[:len(resultados)]
        
        if self.tipo_grafico == 'barras':
            self.ax.set_yticks(range(len(nomes)))
            self.ax.set_yticklabels(nomes)
            self.ax.set_ylim(-0.6, len(nomes) - 0.4)
            
            max_val = max(liquidos) if liquidos else 0
            offset = max_val * 0.1 if max_val > 0 else 1000

            patches_data = []
            text_labels = []

            for y, (nome, liq, cor) in enumerate(zip(nomes, liquidos, cores_usadas)):
                p_shadow = mpatches.FancyBboxPatch((-offset, y - 0.35), offset, 0.7, 
                                                   boxstyle=mpatches.BoxStyle("Round", pad=0.0, rounding_size=0.35), 
                                                   color=self._escurecer_cor(cor, 0.6), zorder=1)
                p_main = mpatches.FancyBboxPatch((-offset, y - 0.25), offset, 0.5, 
                                                 boxstyle=mpatches.BoxStyle("Round", pad=0.0, rounding_size=0.25), 
                                                 color=cor, zorder=2)
                p_light = mpatches.FancyBboxPatch((-offset, y + 0.05), offset, 0.15, 
                                                  boxstyle=mpatches.BoxStyle("Round", pad=0.0, rounding_size=0.1), 
                                                  color="white", alpha=0.25, zorder=3)
                
                self.ax.add_patch(p_shadow)
                self.ax.add_patch(p_main)
                self.ax.add_patch(p_light)
                patches_data.append((p_shadow, p_main, p_light))
                
                t = self.ax.text(0, y, '', va='center', ha='left', fontsize=10, fontweight='bold', color='white')
                text_labels.append(t)

            self.ax.set_title("Patrimônio Final Líquido Acumulado", color='white')
            self.ax.set_xlabel("Valor Disponível para Resgate (R$)", color='white')
            self.ax.tick_params(colors='white')
            
            self.ax.set_xlim(0, max_val * 1.30)
            self.ax.spines['top'].set_visible(False)
            self.ax.spines['right'].set_visible(False)
            for spine in self.ax.spines.values():
                spine.set_edgecolor('#3d4453')
                
            self.fig.tight_layout()
            
            if animar:
                passos = 15
                for i in range(1, passos + 1):
                    for (p_shadow, p_main, p_light), text, target in zip(patches_data, text_labels, liquidos):
                        current_width = target * (i / passos)
                        p_shadow.set_width(current_width + offset)
                        p_main.set_width(current_width + offset)
                        p_light.set_width(current_width + offset)
                        
                        text.set_x(current_width + (max_val * 0.02))
                        text.set_text(f' R$ {current_width:,.2f}'.replace(',', 'X').replace('.', ',').replace('X', '.'))
                    
                    self.canvas.draw()
                    self.root.update()
                    time.sleep(0.015) 
            else:
                for (p_shadow, p_main, p_light), text, target in zip(patches_data, text_labels, liquidos):
                    p_shadow.set_width(target + offset)
                    p_main.set_width(target + offset)
                    p_light.set_width(target + offset)
                    text.set_x(target + (max_val * 0.02))
                    text.set_text(f' R$ {target:,.2f}'.replace(',', 'X').replace('.', ',').replace('X', '.'))
                self.canvas.draw()
                
        elif self.tipo_grafico == 'linhas':
            meses_totais = len(resultados[0]['historico'])
            
            max_val_historico = max([max(r['historico']) for r in resultados]) if resultados else 1000
            
            self.ax.set_title("Evolução do Patrimônio Líquido no Tempo", color='white')
            self.ax.set_xlabel("Meses", color='white')
            self.ax.set_ylabel("Valor (R$)", color='white')
            self.ax.tick_params(colors='white')
            self.ax.set_xlim(0, max(1, meses_totais - 1))
            self.ax.set_ylim(0, max_val_historico * 1.05) 
            self.ax.grid(True, color='#3d4453', linestyle='--', alpha=0.6)
            
            self.ax.spines['top'].set_visible(False)
            self.ax.spines['right'].set_visible(False)
            for spine in self.ax.spines.values():
                spine.set_edgecolor('#3d4453')
            
            linhas_plotadas = []
            for r, cor in zip(resultados, cores_usadas):
                linha, = self.ax.plot([], [], label=r["nome"], color=cor, linewidth=2.5)
                linhas_plotadas.append((linha, r['historico']))
            
            legend = self.ax.legend(facecolor='#1a1b26', edgecolor='#3d4453', loc='upper left', fontsize=9)
            for text in legend.get_texts():
                text.set_color("white")
                
            self.fig.tight_layout()
            
            if animar:
                passos = 15
                for i in range(1, passos + 1):
                    idx = max(1, int((i / passos) * meses_totais))
                    for linha, historico in linhas_plotadas:
                        linha.set_data(range(idx), historico[:idx])
                    self.canvas.draw()
                    self.root.update()
                    time.sleep(0.015)
                
                for linha, historico in linhas_plotadas:
                    linha.set_data(range(meses_totais), historico)
                self.canvas.draw()
            else:
                for linha, historico in linhas_plotadas:
                    linha.set_data(range(meses_totais), historico)
                self.canvas.draw()
        
        for widget in self.scroll_frame.scrollable_frame.winfo_children():
            widget.destroy()
            
        self.dados_simulacao = []
        resultados_cards = sorted(resultados, key=lambda x: x["liquido"], reverse=True)
        
        for r in resultados_cards:
            self.criar_card(self.scroll_frame.scrollable_frame, r)
            
            fmt_inv = f"R$ {r['investido']:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')
            fmt_bruto = f"R$ {r['bruto']:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')
            fmt_liq = f"R$ {r['liquido']:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')
            fmt_imp = f"R$ {r['imposto']:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')
            
            self.dados_simulacao.append([r["nome"], fmt_inv, fmt_bruto, fmt_liq, fmt_imp, r["taxa_ir"]])
        
        self.arquivo_menu.entryconfig("Exportar Resultados (CSV)", state=tk.NORMAL)

    def exportar_csv(self):
        if not self.dados_simulacao: return
        caminho_arquivo = filedialog.asksaveasfilename(defaultextension=".csv", filetypes=[("CSV", "*.csv")])
        if not caminho_arquivo: return
        try:
            with open(caminho_arquivo, mode='w', newline='', encoding='utf-8-sig') as f:
                writer = csv.writer(f, delimiter=';')
                writer.writerow(['Ativo', 'Valor Investido', 'Valor Bruto', 'Valor Liquido', 'Imposto Pago', 'Taxa de IR'])
                for linha in self.dados_simulacao:
                    writer.writerow(linha)
            messagebox.showinfo("Sucesso", "Dados exportados!")
        except Exception as e:
            pass

    def importar_csv(self):
        caminho_arquivo = filedialog.askopenfilename(filetypes=[("CSV", "*.csv")])
        if not caminho_arquivo: return
        try:
            with open(caminho_arquivo, mode='r', encoding='utf-8-sig') as f:
                reader = csv.reader(f, delimiter=';')
                next(reader, None)
                resultados_importados = []
                for row in reader:
                    if len(row) == 6:
                        ativo, inv_str, bruto_str, liq_str, imp_str, taxa_ir = row
                        def limpar_moeda(val_str):
                            val = val_str.replace('R$', '').strip().replace('.', '').replace(',', '.')
                            return float(val)
                        resultados_importados.append({
                            "nome": ativo, "nome_simples": ativo.split(' (')[0], "investido": limpar_moeda(inv_str), "bruto": limpar_moeda(bruto_str),
                            "liquido": limpar_moeda(liq_str), "imposto": limpar_moeda(imp_str), "taxa_ir": taxa_ir,
                            "historico": [0, limpar_moeda(liq_str)] 
                        })
                if resultados_importados:
                    self.ultimos_resultados = resultados_importados
                    self.atualizar_visualizacao(resultados_importados)
                    messagebox.showinfo("Sucesso", "Dados importados!")
        except Exception as e:
            pass

    def fechar_app(self):
        try:
            plt.close('all')
            self.root.quit()
            self.root.destroy()
        except:
            pass
        finally:
            os._exit(0)

if __name__ == "__main__":
    multiprocessing.freeze_support()
    root = tk.Tk()
    app = SimuladorRendaFixa(root)
    root.mainloop()
