import { format, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { DadosContratoForm, Averbacao, ParteForm } from '@/types/dadosContrato';

function fmtCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Converte um valor numérico BRL para extenso em português.
 * Ex: 77249.60 → "setenta e sete mil, duzentos e quarenta e nove reais com sessenta centavos"
 */
export function valorPorExtenso(n: number): string {
  if (!isFinite(n) || n < 0) return '';
  if (n === 0) return 'zero reais';

  const totalCentavos = Math.round(n * 100);
  const reais = Math.floor(totalCentavos / 100);
  const centavos = totalCentavos % 100;

  const UNIDADES = [
    '', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove',
    'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove',
  ];
  const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos',
    'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

  function centena(v: number): string {
    if (v === 0) return '';
    if (v === 100) return 'cem';
    const c = Math.floor(v / 100);
    const r = v % 100;
    const parts: string[] = [];
    if (c) parts.push(CENTENAS[c]);
    if (r) {
      if (r < 20) parts.push(UNIDADES[r]);
      else {
        const d = Math.floor(r / 10);
        const u = r % 10;
        parts.push(u ? `${DEZENAS[d]} e ${UNIDADES[u]}` : DEZENAS[d]);
      }
    }
    return parts.join(' e ');
  }

  function inteiro(v: number): string {
    if (v === 0) return 'zero';
    const mil = Math.floor(v / 1000);
    const resto = v % 1000;
    const parts: string[] = [];
    if (mil) parts.push(mil === 1 ? 'mil' : `${centena(mil)} mil`);
    if (resto) parts.push(centena(resto));
    if (mil && resto) return resto >= 100 ? parts.join(', ') : parts.join(' e ');
    return parts[0] ?? '';
  }

  const parts: string[] = [];
  if (reais > 0) parts.push(`${inteiro(reais)} ${reais === 1 ? 'real' : 'reais'}`);
  if (centavos > 0) parts.push(`${inteiro(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}`);
  return parts.length ? parts.join(' com ') : 'zero reais';
}

function buildAverbacoes(list: Averbacao[]): string {
  if (!list || list.length === 0) return '';
  const items = list.map(
    (a) => `averbado no dia ${fmtDateShort(a.data)} ${a.descricao}, conforme averbação ${a.codigo}`,
  );
  const joined = items.length === 1
    ? items[0]
    : `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
  return `, ${joined}`;
}

function fmtDateBR(iso: string): string {
  if (!iso) return '';
  try {
    const d = parse(iso.slice(0, 10), 'yyyy-MM-dd', new Date());
    if (isNaN(d.getTime())) return iso;
    return format(d, "d 'de' MMMM 'de' yyyy", { locale: ptBR });
  } catch {
    return iso;
  }
}

function fmtDateShort(iso: string): string {
  if (!iso) return '';
  try {
    const d = parse(iso.slice(0, 10), 'yyyy-MM-dd', new Date());
    if (isNaN(d.getTime())) return iso;
    return format(d, 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return iso;
  }
}

function enderecoStr(p: ParteForm): string {
  const e = p.endereco;
  const linha1 = [e.logradouro, e.numero].filter(Boolean).join(', ');
  const linha2 = [e.bairro, [e.cidade, e.estado].filter(Boolean).join('/')].filter(Boolean).join(' - ');
  const cep = e.cep ? `CEP ${e.cep}` : '';
  return [linha1, linha2, cep].filter(Boolean).join(', ');
}

function fmtValor(s: string): string {
  const n = Number(String(s).replace(',', '.'));
  if (!isFinite(n) || !s) return s ?? '';
  return fmtCurrency(n);
}

function genderWord(sexo: string, m: string, f: string) {
  return sexo === 'F' ? f : m;
}

/**
 * Compõe a qualificação completa de uma parte no estilo do contrato:
 * "NOME, brasileiro, maior, profissão, casado em comunhão parcial de bens no dia 30/12/2005,
 *  inscrito no CPF n° X e RG nº Y, expedida pelo SSP-RS em DD/MM/YYYY, residente e domiciliado
 *  na Rua X, nº N, bairro B, Cidade/UF, e-mail: a@b e telefone: 99 9999-9999"
 */
function qualificacaoStr(p: ParteForm, dataCasamentoIso?: string): string {
  if (!p.nome) return '';
  const sexo = p.sexo || 'M';
  const inscrito = genderWord(sexo, 'inscrito', 'inscrita');
  const residente = genderWord(sexo, 'residente e domiciliado', 'residente e domiciliada');

  const partes: string[] = [];
  partes.push(p.nome.toUpperCase());
  if (p.nacionalidade) partes.push(p.nacionalidade);
  partes.push('maior');
  if (p.profissao) partes.push(p.profissao);

  // estado civil + regime + data casamento
  const ec = p.estado_civil || '';
  if (ec) {
    const ecBase = ec === 'Casado(a)'
      ? genderWord(sexo, 'casado', 'casada')
      : ec === 'Solteiro(a)'
        ? genderWord(sexo, 'solteiro', 'solteira')
        : ec === 'Divorciado(a)'
          ? genderWord(sexo, 'divorciado', 'divorciada')
          : ec === 'Viúvo(a)'
            ? genderWord(sexo, 'viúvo', 'viúva')
            : ec; // União Estável etc.
    let ecTxt = ecBase;
    if ((ec === 'Casado(a)' || ec === 'União Estável') && p.regime_bens) {
      ecTxt += ` em ${p.regime_bens}`;
    }
    if ((ec === 'Casado(a)' || ec === 'União Estável') && dataCasamentoIso) {
      ecTxt += ` no dia ${fmtDateShort(dataCasamentoIso)}`;
    }
    partes.push(ecTxt);
  }

  // Documentos
  const docPieces: string[] = [];
  if (p.cpf) docPieces.push(`${inscrito} no CPF nº ${p.cpf}`);
  if (p.rg) {
    const tipo = p.tipo_documento || 'RG';
    let docStr = `${tipo} nº ${p.rg}`;
    if (p.orgao_emissor) docStr += `, expedida pelo ${p.orgao_emissor}`;
    if (p.data_emissao_rg) docStr += ` em ${fmtDateShort(p.data_emissao_rg)}`;
    docPieces.push(docStr);
  }
  if (docPieces.length) partes.push(docPieces.join(' e '));

  // Endereço
  const end = enderecoStr(p);
  if (end) partes.push(`${residente} na ${end}`);

  // Contato
  const contato: string[] = [];
  if (p.email) contato.push(`e-mail: ${p.email}`);
  if (p.telefone) contato.push(`telefone: ${p.telefone}`);
  if (contato.length) partes.push(contato.join(' e '));

  return partes.join(', ');
}

export function buildPlaceholders(
  form: DadosContratoForm,
  opts: { dataRenegociacao?: Date | null } = {}
): Record<string, string> {
  const c = form.comprador;
  const j = form.conjuge;
  const mostrarConjuge =
    form.temConjuge ||
    c.estado_civil === 'Casado(a)' ||
    c.estado_civil === 'União Estável';

  let cidadeData = '';
  let dataRenegociacaoExtenso = '';
  if (opts.dataRenegociacao) {
    const dataFmt = format(opts.dataRenegociacao, "d 'de' MMMM 'de' yyyy", { locale: ptBR });
    dataRenegociacaoExtenso = dataFmt;
    const cidadeUf = [form.cidade_empreendimento, form.estado_empreendimento].filter(Boolean).join('/');
    cidadeData = cidadeUf ? `${cidadeUf}, ${dataFmt}` : dataFmt;
  }

  const nomeDevedor = mostrarConjuge && j.nome ? `${c.nome} e ${j.nome}` : c.nome;
  const qualificacaoComprador = qualificacaoStr(c, form.data_casamento);
  const qualificacaoConjuge = mostrarConjuge ? qualificacaoStr(j, form.data_casamento) : '';
  const qualificacaoDevedor = mostrarConjuge && j.nome
    ? `${qualificacaoComprador}, e ${qualificacaoConjuge}`
    : qualificacaoComprador;

  return {
    // Imóvel
    EMPREENDIMENTO: form.empreendimento,
    LOTE: form.num_lote,
    AREA: form.area,
    MATRICULA: form.matricula,
    MATRICULA_ORIGEM: form.matricula_origem,
    CIDADE_EMPREENDIMENTO: form.cidade_empreendimento,
    UF_EMPREENDIMENTO: form.estado_empreendimento,
    CIDADE_DATA: cidadeData,
    // {{DATA}} no template = apenas a data por extenso
    // (a cidade/UF já vem impressa no modelo .docx antes do placeholder)
    DATA: dataRenegociacaoExtenso,
    DATA_RENEGOCIACAO: dataRenegociacaoExtenso,
    DATA_RENEGOCIACAO_EXTENSO: dataRenegociacaoExtenso,
    DATA_EXTENSO: dataRenegociacaoExtenso,
    DATA_ATUAL: dataRenegociacaoExtenso,
    // Contrato
    NUMERO_CONTRATO: form.numero_contrato,
    DATA_CONTRATO: fmtDateBR(form.data_contrato),
    VALOR_TOTAL: fmtValor(form.valor_total),
    // Comprador
    NOME_COMPRADOR: c.nome,
    NOME_CLIENTE: c.nome,
    CLIENTE: c.nome,
    COMPRADOR: c.nome,
    NOME_DEVEDOR: nomeDevedor,
    NOME_DEVEDORES: nomeDevedor,
    DEVEDOR: nomeDevedor,
    DEVEDORES: nomeDevedor,
    CPF_COMPRADOR: c.cpf,
    NACIONALIDADE: c.nacionalidade,
    ESTADO_CIVIL: c.estado_civil,
    PROFISSAO: c.profissao,
    RG: c.rg,
    ORGAO_EMISSOR: c.orgao_emissor,
    DATA_EMISSAO_RG: fmtDateShort(c.data_emissao_rg),
    EMAIL_COMPRADOR: c.email,
    TELEFONE_COMPRADOR: c.telefone,
    ENDERECO: enderecoStr(c),
    // Cônjuge (vazio se não houver)
    NOME_CONJUGE: mostrarConjuge ? j.nome : '',
    CPF_CONJUGE: mostrarConjuge ? j.cpf : '',
    NACIONALIDADE_CONJUGE: mostrarConjuge ? j.nacionalidade : '',
    PROFISSAO_CONJUGE: mostrarConjuge ? j.profissao : '',
    RG_CONJUGE: mostrarConjuge ? j.rg : '',
    ORGAO_EMISSOR_CONJUGE: mostrarConjuge ? j.orgao_emissor : '',
    DATA_EMISSAO_RG_CONJUGE: mostrarConjuge ? fmtDateShort(j.data_emissao_rg) : '',
    EMAIL_CONJUGE: mostrarConjuge ? j.email : '',
    TELEFONE_CONJUGE: mostrarConjuge ? j.telefone : '',
    ENDERECO_CONJUGE: mostrarConjuge ? enderecoStr(j) : '',
    DATA_CASAMENTO: mostrarConjuge ? fmtDateBR(form.data_casamento) : '',
    // Qualificações completas (parágrafo pronto para o template)
    // {{QUALIFICACAO}} é o alias direto usado nos modelos .docx
    QUALIFICACAO: qualificacaoDevedor,
    QUALIFICACAO_COMPRADOR: qualificacaoComprador,
    QUALIFICACAO_CONJUGE: qualificacaoConjuge,
    QUALIFICACAO_DEVEDOR: qualificacaoDevedor,
    QUALIFICACAO_DEVEDORES: qualificacaoDevedor,
    // Assinaturas: nomes isolados para bloco de assinatura de 2 colunas
    CLIENTE1: c.nome,
    CLIENTE2: mostrarConjuge ? j.nome : '',
    CLIENTE_1: c.nome,
    CLIENTE_2: mostrarConjuge ? j.nome : '',
    NOME_CLIENTE_1: c.nome,
    NOME_CLIENTE_2: mostrarConjuge ? j.nome : '',
    NOME_DEVEDOR_1: c.nome,
    NOME_DEVEDOR_2: mostrarConjuge ? j.nome : '',
    // Valor da dívida conforme matrícula (preenchimento manual pelo usuário)
    VALOR_ANTIGO: fmtValor(form.valor_antigo_matricula),
    VALOR_ANTIGO_EXTENSO: valorPorExtenso(
      Number(String(form.valor_antigo_matricula).replace(',', '.')) || 0,
    ),
    VALOR_TOTAL_EXTENSO: valorPorExtenso(
      Number(String(form.valor_total).replace(',', '.')) || 0,
    ),
    // Dados do Cartório (somente quando isRegistrado=true; string vazia quando não aplicável)
    DATA_REGISTRO: fmtDateShort(form.data_registro ?? ''),
    REG_COMPRA_VENDA: form.reg_compra_venda ?? '',
    REG_ALIENACAO: form.reg_alienacao ?? '',
    AVERBACOES: buildAverbacoes(form.averbacoes ?? []),
  };
}
