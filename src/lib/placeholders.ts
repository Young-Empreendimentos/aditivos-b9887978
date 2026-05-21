import { format, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { DadosContratoForm, ParteForm } from '@/types/dadosContrato';

function fmtCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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
  if (opts.dataRenegociacao) {
    const dataFmt = format(opts.dataRenegociacao, "d 'de' MMMM 'de' yyyy", { locale: ptBR });
    const cidadeUf = [form.cidade_empreendimento, form.estado_empreendimento].filter(Boolean).join('/');
    cidadeData = cidadeUf ? `${cidadeUf}, ${dataFmt}` : dataFmt;
  }

  return {
    // Imóvel
    EMPREENDIMENTO: form.empreendimento,
    LOTE: form.num_lote,
    AREA: form.area,
    MATRICULA: form.matricula,
    ONUS: form.onus,
    CIDADE_EMPREENDIMENTO: form.cidade_empreendimento,
    UF_EMPREENDIMENTO: form.estado_empreendimento,
    CIDADE_DATA: cidadeData,
    // Contrato
    NUMERO_CONTRATO: form.numero_contrato,
    DATA_CONTRATO: fmtDateBR(form.data_contrato),
    VALOR_TOTAL: fmtValor(form.valor_total),
    // Comprador
    NOME_COMPRADOR: c.nome,
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
  };
}
