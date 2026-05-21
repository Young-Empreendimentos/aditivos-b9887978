import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://vvtympzatclvjaqucebr.supabase.co",
  "REMOVIDO_CHAVE_ANON",
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
  main_unit: string | null;
  issue_date: string | null;
  parcelasCount: number;
}
export interface SiengeParcelaRow {
  installment_number: number | null;
  payment_term_description: string | null;
  due_date: string | null;
  original_amount: number | null;
  corrected_balance_amount: number | null;
  current_balance: number | null;
  current_balance_with_addition: number | null;
  discount_amount: number | null;
  bill_id: number | string | null;
  bill_document: string | null;
  client_name: string | null;
  company_name: string | null;
  business_area_name: string | null;
  main_unit: string | null;
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
    .gt("current_balance", 0)
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
      "bill_id, bill_document, client_id, client_name, company_id, company_name, business_area_name, main_unit, issue_date",
    )
    .eq("client_id", clientId)
    .gt("current_balance", 0)
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
        business_area_name: row.business_area_name,
        main_unit: row.main_unit,
        issue_date: row.issue_date,
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
    .gt("current_balance", 0)
    .order("due_date", { ascending: true })
    .limit(5000);
  if (billDocument) query = query.eq("bill_document", billDocument);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
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
  if (error) {
    console.error("Erro ao buscar dados do contrato:", error);
    return null;
  }
  return (data as DadosContrato) ?? null;
}
