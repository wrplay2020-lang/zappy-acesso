import { env } from "cloudflare:workers";
import { authorized } from "../session-store";

const base = "https://onzappy.com/api/v1/reseller";
const headers = { "Cache-Control": "no-store" };
type Input = { action?: unknown; page?: unknown; resellerId?: unknown; amount?: unknown; notes?: unknown; confirmation?: unknown; whatsapp?: unknown };

async function zappy(path: string, payload?: Record<string, unknown>, idempotencyKey?: string) {
  const response = await fetch(base + path, {
    method: payload ? "POST" : "GET",
    headers: {
      Authorization: "Bearer " + env.ZAPPY_API_KEY,
      ...(payload ? { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey ?? crypto.randomUUID() } : {}),
    },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
    redirect: "manual",
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? "A chave da API Zappy não permite esta operação." : "A Zappy não confirmou a operação. Confira no painel da Zappy antes de repetir.");
  const body = await response.json() as { success?: boolean; data?: unknown };
  if (!body.success || !body.data) throw new Error("A Zappy não confirmou a operação. Confira no painel da Zappy antes de repetir.");
  return body.data;
}

export async function POST(request: Request) {
  if (!env.ADMIN_DASHBOARD_KEY || !env.ZAPPY_API_KEY || !env.DB) return Response.json({ error: "Painel ainda não configurado." }, { status: 503, headers });
  if (request.headers.get("Origin") !== new URL(request.url).origin) return Response.json({ error: "Solicitação inválida." }, { status: 403, headers });
  if (!(await authorized(request))) return Response.json({ error: "Sessão expirada. Entre novamente." }, { status: 401, headers });
  let input: Input;
  try { input = await request.json(); } catch { return Response.json({ error: "Dados inválidos." }, { status: 400, headers }); }
  if (!input || typeof input !== "object") return Response.json({ error: "Dados inválidos." }, { status: 400, headers });
  const action = input.action;
  try {
    if (action === "list") {
      const data = await zappy("/resellers") as { resellers?: unknown };
      if (!Array.isArray(data.resellers)) throw new Error("Resposta inesperada da Zappy.");
      const contacts = env.DB ? await env.DB.prepare("SELECT c.reseller_id, c.username, c.whatsapp FROM reseller_contacts c LEFT JOIN reseller_signup_attempts a ON c.reseller_id = 'pending:' || a.id WHERE c.reseller_id NOT LIKE 'pending:%' OR a.status IN ('CREATING', 'CREATED')").all<{ reseller_id: string; username: string; whatsapp: string }>()
        .then(result => result.results)
        .catch(() => [] as { reseller_id: string; username: string; whatsapp: string }[]) : [];
      const byId = new Map(contacts.filter(item => !item.reseller_id.startsWith("pending:")).map(item => [item.reseller_id, item.whatsapp]));
      const pendingByUsername = new Map(contacts.filter(item => item.reseller_id.startsWith("pending:")).map(item => [item.username, item.whatsapp]));
      const resellers = data.resellers.slice(0, 500).map((item: Record<string, unknown>) => ({
        id: String(item.id ?? ""), username: String(item.username ?? ""), displayName: String(item.displayName ?? ""),
        creditsBalance: Number(item.creditsBalance ?? 0), status: String(item.status ?? ""), depth: Number(item.depth ?? 0),
        canCreateSubresellers: Boolean(item.canCreateSubresellers),
        whatsapp: byId.get(String(item.id ?? "")) ?? pendingByUsername.get(String(item.username ?? "")) ?? (typeof item.whatsapp === "string" && /^\d{10,15}$/.test(item.whatsapp) ? item.whatsapp : ""),
        contactPending: !byId.has(String(item.id ?? "")) && pendingByUsername.has(String(item.username ?? "")),
      }));
      const signupAttempts = await env.DB.prepare("SELECT username, status, created_at FROM reseller_signup_attempts ORDER BY created_at DESC LIMIT 25")
        .all<{ username: string; status: string; created_at: number }>()
        .then(result => result.results).catch(() => []);
      return Response.json({ resellers, signupAttempts }, { headers });
    }
    if (action === "saveContact") {
      const resellerId = String(input.resellerId ?? "").trim();
      const whatsapp = String(input.whatsapp ?? "").replace(/\D/g, "");
      if (!env.DB || !/^[a-zA-Z0-9_-]{6,100}$/.test(resellerId) || !/^\d{10,15}$/.test(whatsapp)) {
        return Response.json({ error: "Informe um WhatsApp com DDD válido." }, { status: 400, headers });
      }
      const list = await zappy("/resellers") as { resellers?: { id?: string; username?: string; displayName?: string }[] };
      const reseller = list.resellers?.find(item => item.id === resellerId);
      if (!reseller) return Response.json({ error: "Esta sub-revenda não consta na sua lista." }, { status: 400, headers });
      await env.DB.prepare("CREATE TABLE IF NOT EXISTS reseller_contacts (reseller_id TEXT PRIMARY KEY, username TEXT NOT NULL, display_name TEXT NOT NULL, whatsapp TEXT NOT NULL, created_at INTEGER NOT NULL)").run();
      await env.DB.prepare("INSERT INTO reseller_contacts (reseller_id, username, display_name, whatsapp, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(reseller_id) DO UPDATE SET whatsapp = excluded.whatsapp")
        .bind(resellerId, String(reseller.username ?? ""), String(reseller.displayName ?? ""), whatsapp, Date.now()).run();
      return Response.json({ success: true }, { headers });
    }
    if (action === "transactions") {
      const page = Number(input.page ?? 1);
      if (!Number.isInteger(page) || page < 1 || page > 10000) return Response.json({ error: "Página inválida." }, { status: 400, headers });
      const data = await zappy("/credits/transactions?page=" + page) as { transactions?: unknown; pagination?: unknown };
      if (!Array.isArray(data.transactions)) throw new Error("Resposta inesperada da Zappy.");
      return Response.json({ transactions: data.transactions, pagination: data.pagination }, { headers });
    }
    if (action === "transfer" || action === "recall") {
      const resellerId = String(input.resellerId ?? "").trim();
      const amount = Number(input.amount);
      const notes = String(input.notes ?? "").trim();
      if ((!resellerId || resellerId.length > 100) || !Number.isSafeInteger(amount) || amount < 1 || amount > 100000 || notes.length > 150 || input.confirmation !== (action === "transfer" ? "TRANSFERIR" : "RECOLHER")) {
        return Response.json({ error: "Confira a revenda, o valor e a confirmação." }, { status: 400, headers });
      }
      const list = await zappy("/resellers") as { resellers?: { id?: string }[] };
      if (!Array.isArray(list.resellers) || !list.resellers.some(item => item.id === resellerId)) return Response.json({ error: "Esta sub-revenda não consta na sua lista." }, { status: 400, headers });
      const path = action === "transfer" ? "/credits/transfer" : "/credits/recall";
      const payload = action === "transfer" ? { toResellerId: resellerId, amount, ...(notes ? { notes } : {}) } : { fromResellerId: resellerId, amount, ...(notes ? { notes } : {}) };
      const data = await zappy(path, payload);
      return Response.json({ transaction: data }, { headers });
    }
    return Response.json({ error: "Ação inválida." }, { status: 400, headers });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível consultar a Zappy." }, { status: 502, headers });
  }
}
