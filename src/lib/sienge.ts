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

export async function listEmpresas(): Promise<EmpresaSienge[]> {
  const { data, error } = await supabase.from("sienge_parcelas_receber").select("company_id, company_name");
  if (error) throw error;
  const map = new Map<string, EmpresaSienge>();
  for (const row of data ?? []) {
    if (!row.company_id || !row.company_name) continue;
    if (!map.has(String(row.company_id)))
      map.set(String(row.company_id), { company_id: String(row.company_id), company_name: row.company_name });
  }
  return Array.from(map.values()).sort((a, b) => a.company_name.localeCompare(b.company_name));
}

export async function searchClientes(term: string, companyId?: string): Promise<ClienteSienge[]> {
  if (term.trim().length < 3) return [];
  let query = supabase
    .from("sienge_parcelas_receber")
    .select("client_id, client_name")
    .ilike("client_name", `%${term.trim()}%`)
    .neq("payment_status", "paid")
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
    .neq("payment_status", "paid")
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
    .neq("payment_status", "paid")
    .order("due_date", { ascending: true })
    .limit(5000);
  if (billDocument) query = query.eq("bill_document", billDocument);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}
