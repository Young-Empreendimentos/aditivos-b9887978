import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://vvtympzatclvjaqucebr.supabase.co",
  "REMOVIDO_CHAVE_ANON",
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: 'sienge-readonly-client',
    },
  },
);

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

/** Retorna todos os empreendimentos distintos via RPC SECURITY DEFINER
 *  (bypassa RLS da tabela sienge_contratos_de_vendas) */
export async function listEmpreendimentosSienge(): Promise<string[]> {
  const { data, error } = await supabase.rpc('get_empreendimentos');
  if (error) {
    console.error('[listEmpreendimentosSienge] Supabase RPC error:', error);
    throw new Error(error.message ?? 'Erro ao consultar empreendimentos no Supabase');
  }
  return (data ?? [])
    .map((row: { enterprise_name: string | null }) => row.enterprise_name?.trim() ?? '')
    .filter(Boolean)
    .sort((a: string, b: string) => a.localeCompare(b, 'pt-BR'));
}

export async function listEmpresas(): Promise<EmpresaSienge[]> {
  const { data, error } = await supabase.from("mv_empresas").select("company_id, company_name").order("company_name");
  if (error) throw error;
  return (data ?? []).map((row: { company_id: number; company_name: string }) => ({
    company_id: String(row.company_id),
    company_name: row.company_name,
  }));
}

export async function searchClientes(term: string, companyId?: string): Promise<ClienteSienge[]> {
  if (term.trim().length < 3) return [];
  let query = supabase
    .from("sienge_parcelas_receber")
    .select("client_id, client_name")
    .ilike("client_name", `%${term.trim()}%`)
    .or("current_balance.gt.0,current_balance_with_addition.gt.0")
    .limit(500);
  if (companyId) query = query.eq("company_id", companyId);
  const { data, error } = await query;
  if (error) throw error;
  const map = new Map<string, ClienteSienge>();
  for (const row of data ?? []) {
    if (!row.client_id || !row.client_name) continue;
    if (!map.has(String(row.client_id)))
      map.set(String(row.client_id), { client_id: String(row.client_id), client_name: row.client_name });
  }
  return Array.from(map.values()).sort((a, b) => a.client_name.localeCompare(b.client_name));
}

export async function listContratosByCliente(clientId: string, companyId?: string): Promise<ContratoSienge[]> {
  let query = supabase
    .from("sienge_parcelas_receber")
    .select(
      "bill_id, bill_document, client_id, client_name, company_id, company_name, business_area_name, cost_center_name, main_unit, issue_date, bill_private_area, raw_data",
    )
    .eq("client_id", clientId)
    .or("current_balance.gt.0,current_balance_with_addition.gt.0")
    .limit(5000);
  if (companyId) query = query.eq("company_id", companyId);
  const { data, error } = await query;
  if (error) throw error;
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
        client_id: String(row.client_id),
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
  let query = supabase
    .from("sienge_parcelas_receber")
    .select("*")
    .eq("bill_id", billId)
    .or("current_balance.gt.0,current_balance_with_addition.gt.0")
    .order("due_date", { ascending: true })
    .limit(5000);
  if (billDocument) query = query.eq("bill_document", billDocument);
  const { data, error } = await query;
  if (error) throw error;

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
  };
  unidade: {
    nome: string;
    num_lote: string;
    matricula: number | null;
    area: number | null;
    onus: string | null;
  };
  partes: ParteContrato[];
}

export async function getDadosContrato(billId: number | string): Promise<DadosContrato | null> {
  const { data, error } = await supabase.rpc("get_dados_contrato", {
    p_bill_id: typeof billId === "string" ? Number(billId) : billId,
  });
  if (!error && data) return data as DadosContrato;

  if (error) console.warn("[getDadosContrato] RPC sem retorno, usando fallback de parcelas:", error);

  const { data: rows, error: rowError } = await supabase
    .from("sienge_parcelas_receber")
    .select("*")
    .eq("bill_id", typeof billId === "string" ? Number(billId) : billId)
    .order("due_date", { ascending: true })
    .limit(5000);

  if (rowError) {
    console.error("Erro ao buscar dados do contrato:", rowError);
    return null;
  }

  const first = (rows ?? [])[0] as SiengeParcelaRow | undefined;
  if (!first) return null;

  const openRows = (rows ?? []).filter((r: SiengeParcelaRow) =>
    Number(r.current_balance_with_addition ?? r.current_balance ?? 0) > 0,
  );
  const totalAberto = openRows.reduce(
    (sum: number, r: SiengeParcelaRow) => sum + Number(r.current_balance_with_addition ?? r.current_balance ?? 0),
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
      valor_total: totalAberto || null,
    },
    unidade: {
      nome: unitName,
      num_lote: unitName.replace(/^\s*lote\s*/i, '').trim() || unitName,
      matricula: null,
      area: first.bill_private_area ?? first.raw_data?.bill?.privateArea ?? null,
      onus: null,
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
