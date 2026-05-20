const SIENGE_FUNCTION_URL = "https://vvtympzatclvjaqucebr.supabase.co/functions/v1/sienge-query";
const SIENGE_ANON_KEY =
  "REMOVIDO_CHAVE_ANON"; // mesma que você já usa

async function callSienge(action: string, params: Record<string, unknown> = {}) {
  const res = await fetch(SIENGE_FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SIENGE_ANON_KEY}`,
    },
    body: JSON.stringify({ action, params }),
  });
  if (!res.ok) throw new Error(`Erro na função: ${res.statusText}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json.data;
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
  main_unit: string | null;
  document_identification_id: string | null;
  document_identification_name: string | null;
  issue_date: string | null;
  parcelasCount: number;
}

export interface SiengeParcelaRow {
  client_id: number | string | null;
  client_name: string | null;
  bill_id: number | string | null;
  bill_document: string | null;
  main_unit: string | null;
  installment_number: number | null;
  payment_term_description: string | null;
  due_date: string | null;
  original_amount: number | null;
  corrected_balance_amount: number | null;
  current_balance: number | null;
  current_balance_with_addition: number | null;
  discount_amount: number | null;
  payment_status: string | null;
  installment_situation: string | null;
  company_name: string | null;
  business_area_name: string | null;
  indexer_name: string | null;
  last_payment_date: string | null;
  total_paid_net: number | null;
}

export async function listEmpresas(): Promise<EmpresaSienge[]> {
  return callSienge("list_empresas");
}

export async function searchClientes(term: string, companyId?: string): Promise<ClienteSienge[]> {
  if (term.trim().length < 3) return [];
  return callSienge("search_clientes", { term: term.trim(), company_id: companyId });
}

export async function listContratosByCliente(clientId: string, companyId?: string): Promise<ContratoSienge[]> {
  return callSienge("list_contratos", { client_id: clientId, company_id: companyId });
}

export async function listParcelasByContrato(billId: string, billDocument: string): Promise<SiengeParcelaRow[]> {
  return callSienge("list_parcelas", { bill_id: billId, bill_document: billDocument });
}
