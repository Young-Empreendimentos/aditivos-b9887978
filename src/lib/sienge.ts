import { auth } from "@/lib/firebase";

// Todo acesso ao Sienge passa pela Edge Function `sienge-proxy` (porteiro no servidor):
// ela valida o login do Firebase (token do usuário) e lê o Sienge com a service role,
// que fica SÓ no servidor. Assim não há nenhuma chave do Supabase no navegador e o
// acesso `anon` continua fechado. Somente LEITURA.
const PROXY_URL = "https://vvtympzatclvjaqucebr.supabase.co/functions/v1/sienge-proxy";

async function proxy<T = unknown>(
  action: string,
  params: Record<string, unknown> = {},
): Promise<{ data: T | null; error: { message: string } | null }> {
  let token: string | undefined;
  try {
    token = await auth.currentUser?.getIdToken();
  } catch {
    token = undefined;
  }
  if (!token) return { data: null, error: { message: "Sessão expirada. Entre novamente." } };
  try {
    const res = await fetch(PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-firebase-token": token },
      body: JSON.stringify({ action, params }),
    });
    const json = (await res.json().catch(() => ({}))) as { data?: T; error?: string | null };
    if (!res.ok) {
      return { data: null, error: { message: json?.error ?? `Erro ${res.status}` } };
    }
    return { data: (json.data ?? null) as T | null, error: json.error ? { message: json.error } : null };
  } catch (e) {
    return { data: null, error: { message: e instanceof Error ? e.message : "Falha de rede" } };
  }
}

export interface EmpresaSienge {
  company_id: string;
  company_name: string;
}
export interface ClienteSienge {
  client_id: string;
  client_name: string;
}
export interface ContratoSienge {
  bill_id: string;
  bill_document: string;
  client_id: string;
  client_name: string;
  company_id: string;
  company_name: string;
  business_area_name: string | null;
  cost_center_name?: string | null;
  main_unit: string | null;
  issue_date: string | null;
  bill_private_area?: number | null;
  parcelasCount: number;
}
export interface SiengeParcelaRow {
  installment_number: number | string | null;
  payment_term_description: string | null;
  due_date: string | null;
  original_amount: number | null;
  corrected_balance_amount: number | null;
  current_balance: number | null;
  current_balance_with_addition: number | null;
  discount_amount: number | null;
  bill_id: number | string | null;
  bill_document: string | null;
  document_number?: string | null;
  bill_emission_date: string | null; // data de emissão do contrato (YYYY-MM-DD)
  client_name: string | null;
  company_name: string | null;
  business_area_name: string | null;
  cost_center_name?: string | null;
  main_unit: string | null;
  bill_private_area?: number | null;
  units?: Array<{ id?: number; name?: string }> | null;
  raw_data?: {
    bill?: {
      units?: Array<{ id: number; name: string }>;
      costCenter?: { id: number; name: string };
      customer?: { id?: number; name?: string; document?: string | null };
      privateArea?: number | null;
      emissionDate?: string | null;
      document?: string | null;
    };
  } | null;
}

/** Extrai o nome da unidade/lote a partir do raw_data do Sienge.
 *  Ex: "Lote 113", "Lote 07" */
export function extractUnitName(row: SiengeParcelaRow): string | null {
  const units = row.units ?? row.raw_data?.bill?.units;
  if (!units || units.length === 0) return null;
  return units[0].name ?? null;
}

function getEnterpriseName(row: Partial<SiengeParcelaRow>): string {
  return (
    row.business_area_name ??
    row.cost_center_name ??
    row.raw_data?.bill?.costCenter?.name ??
    ''
  ).trim();
}

function getBillDocument(row: Partial<SiengeParcelaRow>): string {
  return row.bill_document ?? row.document_number ?? row.raw_data?.bill?.document ?? '';
}

/** Retorna todos os empreendimentos distintos (RPC get_empreendimentos, via proxy). */
export async function listEmpreendimentosSienge(): Promise<string[]> {
  const { data, error } = await proxy<{ enterprise_name: string | null }[]>("empreendimentos");
  if (error) {
    console.error('[listEmpreendimentosSienge]', error);
    throw new Error(error.message ?? 'Erro ao consultar empreendimentos no Supabase');
  }
  return (data ?? [])
    .map((row) => row.enterprise_name?.trim() ?? '')
    .filter(Boolean)
    .sort((a: string, b: string) => a.localeCompare(b, 'pt-BR'));
}

export async function listEmpresas(): Promise<EmpresaSienge[]> {
  const { data, error } = await proxy<{ company_id: number; company_name: string }[]>("empresas");
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    company_id: String(row.company_id),
    company_name: row.company_name,
  }));
}

export async function searchClientes(term: string, companyId?: string): Promise<ClienteSienge[]> {
  if (term.trim().length < 3) return [];
  const { data, error } = await proxy<Array<{ client_id: string | number; client_name: string }>>(
    "searchClientes",
    { term: term.trim(), companyId },
  );
  if (error) throw new Error(error.message);
  const map = new Map<string, ClienteSienge>();
  for (const row of data ?? []) {
    if (!row.client_id || !row.client_name) continue;
    if (!map.has(String(row.client_id)))
      map.set(String(row.client_id), { client_id: String(row.client_id), client_name: row.client_name });
  }
  return Array.from(map.values()).sort((a, b) => a.client_name.localeCompare(b.client_name));
}

export async function listContratosByCliente(clientId: string, companyId?: string): Promise<ContratoSienge[]> {
  const { data, error } = await proxy<
    Array<SiengeParcelaRow & { client_id?: string | number; company_id?: string | number; issue_date?: string | null }>
  >("contratos", { clientId, companyId });
  if (error) throw new Error(error.message);
  const map = new Map<string, ContratoSienge>();
  for (const row of data ?? []) {
    if (!row.bill_id) continue;
    const key = `${row.bill_id}__${row.bill_document ?? ""}`;
    const existing = map.get(key);
    if (existing) {
      existing.parcelasCount += 1;
    } else {
      map.set(key, {
        bill_id: String(row.bill_id),
        bill_document: row.bill_document ?? "",
        client_id: String(row.client_id ?? ""),
        client_name: row.client_name ?? "",
        company_id: String(row.company_id ?? ""),
        company_name: row.company_name ?? "",
        business_area_name: row.business_area_name ?? getEnterpriseName(row),
        cost_center_name: row.cost_center_name,
        main_unit: row.main_unit,
        issue_date: row.issue_date,
        bill_private_area: row.bill_private_area ?? row.raw_data?.bill?.privateArea ?? null,
        parcelasCount: 1,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    (a.bill_document || a.bill_id).localeCompare(b.bill_document || b.bill_id),
  );
}

export async function listParcelasByContrato(billId: string, billDocument: string): Promise<SiengeParcelaRow[]> {
  const { data, error } = await proxy<SiengeParcelaRow[]>("parcelas", { billId, billDocument });
  if (error) throw new Error(error.message);

  // Normalização dos dados:
  // 1. due_date: "YYYY-MM-DD" é interpretado como UTC pelo JS (new Date("YYYY-MM-DD")),
  //    o que resulta em um dia antes no Brasil (UTC-3). Adicionamos "T12:00:00" para que
  //    o JS trate como horário local, independentemente da versão do componente que consome.
  // 2. current_balance: sobrescrevemos com current_balance_with_addition quando disponível,
  //    para garantir que o saldo já inclua juros, correção e acréscimos.
  return (data ?? []).map((row) => ({
    ...row,
    due_date:
      row.due_date && !row.due_date.includes('T')
        ? row.due_date + 'T12:00:00'
        : row.due_date,
    current_balance:
      row.current_balance_with_addition != null
        ? row.current_balance_with_addition
        : row.current_balance,
  }));
}

export interface ParteContrato {
  nome: string;
  cpf: string | null;
  email: string | null;
  sexo: string | null;
  nascimento: string | null;
  naturalidade: string | null;
  nacionalidade: string | null;
  profissao: string | null;
  estado_civil: string | null;
  rg: string | null;
  orgao_emissor: string | null;
  data_emissao_rg: string | null;
  telefone: string | null;
  telefone_comercial: string | null;
  endereco: {
    logradouro: string | null;
    numero: string | null;
    bairro: string | null;
    cidade: string | null;
    estado: string | null;
    cep: string | null;
  };
  is_conjuge: boolean;
  is_principal: boolean;
}

export interface DadosContrato {
  contrato: {
    id: number;
    numero: string;
    empresa: string;
    empreendimento: string;
    data_contrato: string | null;
    data_emissao: string | null;
    valor_total: number | null;
    cidade_empreendimento: string | null;
    estado_empreendimento: string | null;
  };
  unidade: {
    nome: string;
    num_lote: string;
    matricula: number | null;
    area: number | null;
  };
  partes: ParteContrato[];
}

export async function getDadosContrato(billId: number | string): Promise<DadosContrato | null> {
  const { data, error } = await proxy<DadosContrato>("dadosContratoRpc", { billId });
  if (!error && data) return data as DadosContrato;

  if (error) console.warn("[getDadosContrato] RPC sem retorno, usando fallback de parcelas:", error);

  const { data: rows, error: rowError } = await proxy<SiengeParcelaRow[]>("parcelasByBill", { billId });

  if (rowError) {
    console.error("Erro ao buscar dados do contrato:", rowError);
    return null;
  }

  const first = (rows ?? [])[0] as SiengeParcelaRow | undefined;
  if (!first) return null;

  // valor_total do contrato = soma dos valores ORIGINAIS de TODAS as parcelas (nominal do
  // contrato). ANTES usava o saldo em aberto, o que fazia o % pago travar em ~100% e pegar
  // a faixa de taxa de quitação ERRADA sempre que a RPC do contrato caía e entrava aqui.
  const valorTotalContrato = (rows ?? []).reduce(
    (sum: number, r: SiengeParcelaRow) => sum + Number(r.original_amount ?? 0),
    0,
  );
  const unitName = extractUnitName(first) ?? first.main_unit ?? '';
  const customer = first.raw_data?.bill?.customer;

  return {
    contrato: {
      id: Number(first.bill_id ?? billId),
      numero: getBillDocument(first),
      empresa: first.company_name ?? '',
      empreendimento: getEnterpriseName(first),
      data_contrato: first.bill_emission_date ?? first.raw_data?.bill?.emissionDate ?? null,
      data_emissao: first.bill_emission_date ?? first.raw_data?.bill?.emissionDate ?? null,
      valor_total: valorTotalContrato || null,
      cidade_empreendimento: '',
      estado_empreendimento: '',
    },
    unidade: {
      nome: unitName,
      num_lote: unitName.replace(/^\s*lote\s*/i, '').trim() || unitName,
      matricula: null,
      area: first.bill_private_area ?? first.raw_data?.bill?.privateArea ?? null,
    },
    partes: [
      {
        nome: first.client_name ?? customer?.name ?? '',
        cpf: customer?.document ?? null,
        email: null,
        sexo: null,
        nascimento: null,
        naturalidade: null,
        nacionalidade: null,
        profissao: null,
        estado_civil: null,
        rg: null,
        orgao_emissor: null,
        data_emissao_rg: null,
        telefone: null,
        telefone_comercial: null,
        endereco: { logradouro: null, numero: null, bairro: null, cidade: null, estado: null, cep: null },
        is_conjuge: false,
        is_principal: true,
      },
    ],
  };
}

/**
 * Busca o índice de correção monetária (ex: IGP-M, IPCA, INCC-DI)
 * a partir de paymentConditions do contrato de venda no Sienge.
 * Prioriza a condição "Parcelas Mensais"; se não existir, pega a primeira não-REAL.
 */
export async function getCorrecaoMonetaria(billId: number | string): Promise<string> {
  const { data, error } = await proxy<{ raw_data: unknown } | null>("correcaoMonetaria", { billId });

  if (error || !data?.raw_data) return "";

  const conditions = (data.raw_data as any)?.paymentConditions;
  if (!Array.isArray(conditions) || conditions.length === 0) return "";

  // Prioriza "Parcelas Mensais"
  const mensais = conditions.find(
    (c: any) => c.conditionTypeName === "Parcelas Mensais" && c.indexerName && c.indexerName !== "REAL",
  );
  if (mensais) return mensais.indexerName;

  // Fallback: primeira condição com indexador diferente de REAL
  const qualquer = conditions.find((c: any) => c.indexerName && c.indexerName !== "REAL");
  return qualquer?.indexerName ?? "";
}

/**
 * Valor total já pago pelo cliente no contrato (principal, SEM juros e multa).
 * Regra (na RPC get_valor_pago): só documentos "CT"; soma o `value` dos recebimentos,
 * EXCETO movimentos/estornos (Reparcelamento, Distrato, Cancelamento, Repactuação,
 * Outros, "Abatimento de Adiantamento"). Adiantamento aplicado ao contrato já entra
 * (aparece como "Substituição"). Roda no banco, via proxy — nada de JSON no app.
 */
export async function getValorPago(billId: number | string): Promise<number> {
  const { data, error } = await proxy<number>("valorPago", { billId });
  if (error) {
    console.warn("[getValorPago] erro na RPC:", error);
    return 0;
  }
  return Number(data ?? 0);
}

export interface ValorPagoDetalhe {
  valor_pago: number;
  /** Cancelamento que estava na ENTRADA (AT) — já incluído em valor_pago. */
  cancelamento_entrada: number;
  /** Cancelamento em outras parcelas (saldo/PM/reforço) — NÃO contado; serve de aviso. */
  cancelamento_outras: number;
  /** Bonificação (comissão paga ao corretor / desconto) — NÃO contado. */
  bonificacao: number;
}

/**
 * Valor pago com detalhamento das baixas do tipo "Cancelamento".
 * Em alguns contratos a entrada do cliente foi lançada como Cancelamento — isso
 * agora conta como pago (cancelamento_entrada). Quando há Cancelamento em outras
 * parcelas (cancelamento_outras > 0), o app avisa para conferência humana.
 */
export async function getValorPagoDetalhe(billId: number | string): Promise<ValorPagoDetalhe> {
  const { data, error } = await proxy<ValorPagoDetalhe>("valorPagoDetalhe", { billId });
  if (error || !data) {
    console.warn("[getValorPagoDetalhe] erro na RPC:", error);
    return { valor_pago: 0, cancelamento_entrada: 0, cancelamento_outras: 0, bonificacao: 0 };
  }
  return {
    valor_pago: Number(data.valor_pago ?? 0),
    cancelamento_entrada: Number(data.cancelamento_entrada ?? 0),
    cancelamento_outras: Number(data.cancelamento_outras ?? 0),
    bonificacao: Number(data.bonificacao ?? 0),
  };
}

/**
 * Celebração de venda (confete + som quando alguém marca venda no CRM).
 * Em vez de Realtime com chave anon, consulta a Edge Function (token do Firebase,
 * service role no servidor) por vendas novas desde `sinceId`. Sem chave no front.
 * Retorna o maior id atual (base) e as vendas com id maior que `sinceId`.
 */
export async function getCelebracoes(
  sinceId: number | null,
): Promise<{ latestId: number; novas: any[] } | null> {
  const { data, error } = await proxy<{ latestId: number; novas: any[] }>("celebracoes", { sinceId });
  // Falha (ex.: token do Firebase ainda carregando) → null. NÃO devolver latestId:0,
  // senão o poll seguinte pediria "novas desde 0" e traria TODO o histórico.
  if (error || !data) return null;
  return data;
}
