const SIENGE_FUNCTION_URL = "https://vvtympzatclvjaqucebr.supabase.co/functions/v1/sienge-query";

async function callSienge(action: string, params: Record<string, unknown>) {
  const res = await fetch(SIENGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, params }),
  });
  if (!res.ok) throw new Error(`Erro na função: ${res.statusText}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json.data;
}

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

export async function searchClientes(term: string): Promise<ClienteSienge[]> {
  if (term.trim().length < 3) return [];
  return callSienge("search_clientes", { term: term.trim() });
}

export async function listContratosByCliente(clientId: string): Promise<ContratoSienge[]> {
  const data = await callSienge("list_contratos", { client_id: clientId });
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

export async function listParcelasByContrato(billId: string, billDocument: string): Promise<SiengeParcelaRow[]> {
  return callSienge("list_parcelas", { bill_id: billId, bill_document: billDocument });
}
