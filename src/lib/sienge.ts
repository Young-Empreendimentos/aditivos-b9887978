import { createClient } from "@supabase/supabase-js";

const SIENGE_URL = "https://vvtympzatclvjaqucebr.supabase.co";
const SIENGE_ANON_KEY =
  "REMOVIDO_CHAVE_ANON";

export const sienge = createClient(SIENGE_URL, SIENGE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export interface SiengeParcelaRow {
  client_id: number | string | null;
  client_name: string | null;
  bill_id: number | string | null;
  bill_document: string | null;
  main_unit: string | null;
  installment_number: number | null;
  due_date: string | null;
  original_amount: number | null;
  current_balance: number | null;
  current_balance_with_addition: number | null;
  discount_amount: number | null;
  payment_status: string | null;
  company_name: string | null;
  business_area_name: string | null;
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
  company_name: string | null;
  business_area_name: string | null;
  main_unit: string | null;
  parcelasCount: number;
}

/** Busca distinct clientes por substring no nome (case-insensitive). */
export async function searchClientes(term: string): Promise<ClienteSienge[]> {
  if (term.trim().length < 3) return [];
  const { data, error } = await sienge
    .from("sienge_parcelas_receber")
    .select("client_id, client_name")
    .ilike("client_name", `%${term.trim()}%`)
    .limit(500);
  if (error) throw error;
  const map = new Map<string, ClienteSienge>();
  for (const row of (data ?? []) as Pick<SiengeParcelaRow, "client_id" | "client_name">[]) {
    if (!row.client_id || !row.client_name) continue;
    const key = String(row.client_id);
    if (!map.has(key)) map.set(key, { client_id: key, client_name: row.client_name });
  }
  return Array.from(map.values()).sort((a, b) => a.client_name.localeCompare(b.client_name));
}

/** Lista contratos (bill_id + bill_document) de um cliente, com parcelas em aberto. */
export async function listContratosByCliente(clientId: string): Promise<ContratoSienge[]> {
  const { data, error } = await sienge
    .from("sienge_parcelas_receber")
    .select(
      "bill_id, bill_document, client_id, client_name, company_name, business_area_name, main_unit, payment_status",
    )
    .eq("client_id", clientId)
    .neq("payment_status", "paid")
    .limit(5000);
  if (error) throw error;
  const map = new Map<string, ContratoSienge>();
  for (const row of (data ?? []) as SiengeParcelaRow[]) {
    if (!row.bill_id) continue;
    const key = `${row.bill_id}__${row.bill_document ?? ""}`;
    const existing = map.get(key);
    if (existing) {
      existing.parcelasCount += 1;
    } else {
      map.set(key, {
        bill_id: String(row.bill_id),
        bill_document: row.bill_document ?? "",
        client_id: String(row.client_id ?? clientId),
        client_name: row.client_name ?? "",
        company_name: row.company_name,
        business_area_name: row.business_area_name,
        main_unit: row.main_unit,
        parcelasCount: 1,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    (a.bill_document || a.bill_id).localeCompare(b.bill_document || b.bill_id),
  );
}

/** Carrega todas as parcelas em aberto de um contrato específico. */
export async function listParcelasByContrato(billId: string, billDocument: string): Promise<SiengeParcelaRow[]> {
  let query = sienge
    .from("sienge_parcelas_receber")
    .select("*")
    .eq("bill_id", billId)
    .neq("payment_status", "paid")
    .order("due_date", { ascending: true })
    .limit(5000);
  if (billDocument) query = query.eq("bill_document", billDocument);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as SiengeParcelaRow[];
}
