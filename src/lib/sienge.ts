const SIENGE_FUNCTION_URL = "https://vvtympzatclvjaqucebr.supabase.co/functions/v1/sienge-query";
const SIENGE_ANON_KEY =
  "REMOVIDO_CHAVE_ANON";

async function callSienge(action: string, params: Record<string, unknown>) {
  const res = await fetch(SIENGE_FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SIENGE_ANON_KEY}`,
      apikey: SIENGE_ANON_KEY,
    },
    body: JSON.stringify({ action, params }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Erro na função (${res.status}): ${text || res.statusText}`);
  }
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

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export async function searchClientes(term: string): Promise<ClienteSienge[]> {
  const trimmed = term.trim();
  if (trimmed.length < 3) return [];

  // Server-side ILIKE with multi-word strings causes statement timeouts.
  // Strategy: query with the longest single token (>= 3 chars), then filter
  // by all remaining tokens locally.
  const tokens = trimmed.split(/\s+/).filter((t) => t.length >= 3);
  const queryToken = tokens.length
    ? tokens.reduce((a, b) => (b.length > a.length ? b : a))
    : trimmed;

  const results: ClienteSienge[] = await callSienge("search_clientes", { term: queryToken });

  if (tokens.length <= 1) return results;

  const normalizedTokens = tokens.map(normalize);
  return results.filter((c) => {
    const name = normalize(c.client_name || "");
    return normalizedTokens.every((t) => name.includes(t));
  });
}


const CLOSED_STATUSES = new Set(["paid", "revoked", "canceled", "cancelled"]);

function isOpen(row: { payment_status?: string | null; current_balance?: number | null }): boolean {
  const status = (row.payment_status ?? "").toLowerCase();
  if (CLOSED_STATUSES.has(status)) return false;
  // Some rows have null status but zero balance - exclude when balance == 0
  const bal = Number(row.current_balance ?? 0);
  return !(status === "" && bal <= 0);
}

export async function listContratosByCliente(clientId: string): Promise<ContratoSienge[]> {
  const data = await callSienge("list_contratos", { client_id: clientId });
  const map = new Map<string, ContratoSienge>();
  for (const row of data ?? []) {
    if (!row.bill_id) continue;
    if (!isOpen(row)) continue;
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
  const rows: SiengeParcelaRow[] = await callSienge("list_parcelas", {
    bill_id: billId,
    bill_document: billDocument,
  });
  return (rows ?? []).filter(isOpen);
}

