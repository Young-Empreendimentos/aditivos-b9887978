// Edge Function: sienge-proxy
// "Porteiro" do lado do servidor entre o app Recalcula e os dados do Sienge.
//
// Por quê: o app é front-end (Firebase Auth, sem login no Supabase). Após o
// fechamento do acesso `anon`, o Supabase só responde a usuário logado ou à
// service role. A service role NÃO pode ir para o navegador. Então este proxy:
//   1. valida o ID token do Firebase (só usuário Young logado);
//   2. usa a service role (injetada no servidor) para ler o Sienge;
//   3. devolve só os dados. A chave secreta nunca chega ao cliente.
// Somente LEITURA. verify_jwt=false: a autenticação é própria (x-firebase-token).

import { createClient } from "npm:@supabase/supabase-js@2";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@5";

const FIREBASE_PROJECT = "gerador-aditivos";
const ALLOWED_DOMAIN = "@youngempreendimentos.com.br";

const JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const sienge = admin.schema("sienge");

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-firebase-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

/** Valida o ID token do Firebase. Retorna o e-mail ou um erro. */
async function verificarFirebase(req: Request): Promise<{ email: string } | { erro: string }> {
  const token = req.headers.get("x-firebase-token");
  if (!token) return { erro: "Sem token de login" };
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${FIREBASE_PROJECT}`,
      audience: FIREBASE_PROJECT,
    });
    const email = String(payload.email ?? "").toLowerCase();
    if (!email.endsWith(ALLOWED_DOMAIN)) return { erro: "Domínio não autorizado" };
    return { email };
  } catch (_e) {
    return { erro: "Token inválido ou expirado" };
  }
}

const toNum = (v: unknown): number => (typeof v === "string" ? Number(v) : (v as number));

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  const auth = await verificarFirebase(req);
  if ("erro" in auth) return json({ error: auth.erro }, 401);

  let body: { action?: string; params?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }

  const action = body.action ?? "";
  const p = body.params ?? {};

  try {
    switch (action) {
      case "empreendimentos": {
        const { data, error } = await admin.rpc("get_empreendimentos");
        return json({ data, error: error?.message ?? null });
      }
      case "empresas": {
        const { data, error } = await sienge
          .from("mv_empresas")
          .select("company_id, company_name")
          .order("company_name");
        return json({ data, error: error?.message ?? null });
      }
      case "searchClientes": {
        const term = String(p.term ?? "").trim();
        if (term.length < 3) return json({ data: [], error: null });
        let q = sienge
          .from("sienge_parcelas_receber")
          .select("client_id, client_name")
          .ilike("client_name", `%${term}%`)
          .or("current_balance.gt.0,current_balance_with_addition.gt.0")
          .limit(500);
        if (p.companyId) q = q.eq("company_id", p.companyId as string);
        const { data, error } = await q;
        return json({ data, error: error?.message ?? null });
      }
      case "contratos": {
        let q = sienge
          .from("sienge_parcelas_receber")
          .select(
            "bill_id, bill_document, client_id, client_name, company_id, company_name, business_area_name, cost_center_name, main_unit, issue_date, bill_private_area, raw_data",
          )
          .eq("client_id", p.clientId as string)
          .ilike("bill_document", "CT.%")
          .or("current_balance.gt.0,current_balance_with_addition.gt.0")
          .limit(5000);
        if (p.companyId) q = q.eq("company_id", p.companyId as string);
        const { data, error } = await q;
        return json({ data, error: error?.message ?? null });
      }
      case "parcelas": {
        let q = sienge
          .from("sienge_parcelas_receber")
          .select("*")
          .eq("bill_id", p.billId as string)
          .or("current_balance.gt.0,current_balance_with_addition.gt.0")
          .order("due_date", { ascending: true })
          .limit(5000);
        if (p.billDocument) q = q.eq("bill_document", p.billDocument as string);
        const { data, error } = await q;
        return json({ data, error: error?.message ?? null });
      }
      case "parcelasByBill": {
        const { data, error } = await sienge
          .from("sienge_parcelas_receber")
          .select("*")
          .eq("bill_id", toNum(p.billId))
          .order("due_date", { ascending: true })
          .limit(5000);
        return json({ data, error: error?.message ?? null });
      }
      case "dadosContratoRpc": {
        const { data, error } = await admin.rpc("get_dados_contrato", { p_bill_id: toNum(p.billId) });
        return json({ data, error: error?.message ?? null });
      }
      case "correcaoMonetaria": {
        const { data, error } = await sienge
          .from("sienge_contratos_de_vendas")
          .select("raw_data")
          .eq("receivable_bill_id", toNum(p.billId))
          .limit(1)
          .maybeSingle();
        return json({ data, error: error?.message ?? null });
      }
      case "valorPago": {
        const { data, error } = await admin.rpc("get_valor_pago", { p_bill_id: toNum(p.billId) });
        return json({ data, error: error?.message ?? null });
      }
      case "celebracoes": {
        // Celebração de venda: lê public.vendas_celebracao com a service role (ignora RLS).
        const sinceId = typeof p.sinceId === "number" ? p.sinceId : null;
        const { data: maxRow } = await admin
          .from("vendas_celebracao").select("id").order("id", { ascending: false }).limit(1).maybeSingle();
        const latestId = (maxRow?.id as number) ?? 0;
        let novas: unknown[] = [];
        if (sinceId != null && latestId > sinceId) {
          const { data } = await admin
            .from("vendas_celebracao").select("*").gt("id", sinceId).order("id", { ascending: true }).limit(10);
          novas = data ?? [];
        }
        return json({ data: { latestId, novas }, error: null });
      }
      default:
        return json({ error: `Ação desconhecida: ${action}` }, 400);
    }
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erro interno" }, 500);
  }
});
