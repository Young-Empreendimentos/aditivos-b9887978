## Correções na geração do .docx

### Problema 1 — Posição dos títulos "Quadro 1" / "Quadro 2"

**Causa:** em `src/lib/documentGenerator.ts`, a regex `replacePlaceholder` substitui apenas o `<w:p>` que contém o placeholder `___QUADRO1_PLACEHOLDER___` por uma `<w:tbl>`. Como o template tem o título "Quadro 1" no mesmo parágrafo (ou imediatamente antes/depois) do placeholder, dependendo de como o Word quebrou em runs, o título acaba sendo engolido ou sobrando após a tabela.

**Correção:** ajustar a substituição para:
1. Garantir que o título sempre fique acima (não fazer match em parágrafos que contenham texto além do placeholder — apenas o parágrafo do placeholder é substituído).
2. Documentar no README/instruções: o placeholder `{{QUADRO_1}}` e `{{QUADRO_2}}` deve ficar **sozinho num parágrafo, abaixo do título "Quadro 1" / "Quadro 2"** no template. Assim:
   ```
   Quadro 1
   {{QUADRO_1}}

   Quadro 2
   {{QUADRO_2}}
   ```
3. Tornar a regex mais estrita, exigindo que o parágrafo contenha **só** o placeholder (ignorando whitespace/runs vazios) para não engolir textos vizinhos.

### Problema 2 — `VALOR_ANTIGO` e `VALOR_REFINANCIADO`

**Correção:** em `src/lib/documentGenerator.ts`, calcular dentro de `generateDocx`:
- `VALOR_ANTIGO` = soma de `saldoAtual` das parcelas do Quadro 1.
- `VALOR_REFINANCIADO` = soma de `valor` de `novasParcelas` (já é o `valorTotalRenegociado` que recebemos como parâmetro).

Adicionar os dois ao objeto passado em `doc.render(...)`, formatados via `formatCurrency`.

### Problema 3 — Bloco de assinaturas (duas colunas)

Já temos `NOME_COMPRADOR` e `NOME_CONJUGE` em `src/lib/placeholders.ts`. A regra "string vazia se não houver cônjuge" já está implementada via `mostrarConjuge`.

**Ação:** apenas documentar no README/instruções do template:
- O bloco de assinaturas no `.docx` deve ser uma **tabela 1×2 sem bordas**, cada célula com:
  - Linha 1: `DEVEDOR/FIDUCIANTE:`
  - Linha 2: `{{NOME_COMPRADOR}}` (esquerda) e `{{NOME_CONJUGE}}` (direita)
- Quando não houver cônjuge, `{{NOME_CONJUGE}}` é renderizado como string vazia (célula em branco, estrutura preservada).

Nenhuma mudança de código necessária aqui (só ajuste no template `.docx` cadastrado em Configurações).

### Problema 4 — `CIDADE_DATA` (cidade/estado + data da renegociação)

**Estado atual:** o form de Dados do Contrato (`DadosContratoForm`) não tem cidade/estado do empreendimento. Só temos cidade/estado dos endereços das partes.

**Correção:**
1. Adicionar dois campos ao `DadosContratoForm` em `src/types/dadosContrato.ts`:
   - `cidade_empreendimento: string`
   - `estado_empreendimento: string`
2. Em `StepDadosContrato.tsx`, na seção **Imóvel**, adicionar dois inputs editáveis (Cidade e UF). Pré-preencher via `getDadosContrato` quando a API retornar (campo `empreendimento.cidade` / `empreendimento.estado` se existir; caso contrário, deixar vazio para edição manual).
3. Passar `dataRenegociacao` (do estado de `GeradorAditivo.tsx`) para o `Step4` e em seguida para `generateDocx` como parâmetro novo.
4. Em `src/lib/placeholders.ts`, aceitar uma `dataRenegociacao?: Date` opcional e gerar o placeholder:
   ```
   CIDADE_DATA: `${cidade}/${estado}, ${dataFormatada}`
   ```
   formatando a data como `"21 de maio de 2026"` via `date-fns` (`format(date, "d 'de' MMMM 'de' yyyy", { locale: ptBR })`).

No template `.docx`, o usuário deve usar `{{CIDADE_DATA}}` no local onde hoje há cidade/estado/data na última página.

---

### Arquivos a editar

- `src/lib/documentGenerator.ts` — calcular `VALOR_ANTIGO` / `VALOR_REFINANCIADO`, repassar a `doc.render`; endurecer regex de substituição de placeholder.
- `src/lib/placeholders.ts` — aceitar `dataRenegociacao` opcional e emitir `CIDADE_DATA`.
- `src/types/dadosContrato.ts` — campos `cidade_empreendimento`, `estado_empreendimento`.
- `src/components/StepDadosContrato.tsx` — inputs novos na seção Imóvel + pré-preenchimento da API.
- `src/components/Step4.tsx` — receber `dataRenegociacao` via props e passar a `generateDocx` + `buildPlaceholders`.
- `src/pages/GeradorAditivo.tsx` — passar `dataRenegociacao` ao `Step4`.
- `README.md` — instrução sobre estrutura esperada do template (`{{QUADRO_1}}`, `{{QUADRO_2}}` sozinhos abaixo dos títulos, tabela 1×2 de assinaturas, novos placeholders `VALOR_ANTIGO`, `VALOR_REFINANCIADO`, `CIDADE_DATA`).

### Dúvida rápida (posso seguir sem resposta se preferir)

Para a cidade/estado do empreendimento: o backend Sienge expõe `empreendimento.cidade`/`empreendimento.estado` em `getDadosContrato`? Se não, vou adicionar como campo editável manual no Step Contrato (com fallback vazio). Posso seguir com essa abordagem.