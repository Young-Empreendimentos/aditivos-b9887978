

## Gerador de Aditivos Contratuais — Plano de Implementação

### Visão Geral
Aplicação single-page com fluxo linear em 4 etapas para gerar aditivos contratuais de reparcelamento imobiliário. Design denso, profissional, com paleta Slate/Zinc e tipografia tabular para dados financeiros.

---

### Etapa 1 — Ingestão de Dados
- **Upload do modelo** (.docx) com placeholders (`{{QUADRO_1}}`, `{{QUADRO_2}}`, `{{JUROS_ADOTADOS}}`, `{{CUSTOS_ADICIONAIS}}`, `{{VALOR_TOTAL_RENEGOCIADO}}`, etc.)
- **Upload do relatório** (.xlsx) — parser lê colunas: Data vencto, Par, Tipo Condição, Valor original, Saldo atual
- **Inputs numéricos:** Taxa de juros mensal (% a.m.) e Custos adicionais (R$)
- Drag-and-drop zones com validação de formato

### Etapa 2 — Triagem / Seleção de Parcelas (Quadro 1)
- Tabela densa com todas as parcelas do relatório, ordenadas por data de vencimento
- Primeira parcela (index 0) marcada como "Entrada" e excluída da seleção por padrão
- Renumeração automática: 2ª parcela = 01, 3ª = 02, etc.
- Colunas exibidas: Nº Parcela | Data Vencimento | Valor Original | Saldo Atual
- Checkboxes para selecionar parcelas a reparcelar + "Selecionar todas"
- **Sticky footer** com contadores em tempo real: parcelas selecionadas e valor total do saldo devedor (soma dos "Saldo atual" selecionados)

### Etapa 3 — Simulação (Quadro 2)
- Inputs: número de novas parcelas e data do primeiro vencimento (date picker)
- Cálculo automático com fórmula PMT: `PMT = PV × [i(1+i)^n] / [(1+i)^n - 1]`
  - PV = soma dos saldos atuais selecionados + custos adicionais
  - i = taxa mensal informada
  - n = número de parcelas
- Tabela do Quadro 2 gerada: Nº Parcela | Data Vencimento | Valor da Nova Parcela
- Numeração: 1ª parcela do novo plano = 01
- Vencimentos mensais a partir da data informada
- Exibição transparente: PV, taxa, total de juros, valor total renegociado

### Etapa 4 — Revisão e Geração
- Visualização lado a lado: Quadro 1 (parcelas selecionadas) vs Quadro 2 (novo plano)
- Resumo: juros adotados, custos adicionais, valor total renegociado
- Botão "Gerar Documento" — substitui placeholders no modelo .docx e disponibiliza download em .docx e .pdf
- Usa biblioteca `docx` (para .docx) e renderização client-side para PDF

---

### Design
- Paleta: fundo `#f8f8fa`, azul corporativo `hsl(221, 83%, 53%)` para CTAs, Slate/Zinc para texto
- Tipografia: Inter com `tabular-nums` para tabelas financeiras
- Cards com shadow stack sutil, tabelas sem bordas verticais, hover em linhas
- Stepper horizontal no topo indicando progresso (1→2→3→4)
- Inputs financeiros com prefixo R$ e sufixo % integrados

### Stack Técnica
- Parsing de .xlsx com `SheetJS (xlsx)` no client
- Geração de .docx com `docx` ou `docxtemplater`
- Geração de PDF com `html2pdf.js` ou `jsPDF`
- Tudo client-side, sem backend necessário

