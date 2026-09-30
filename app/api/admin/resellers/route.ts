import { env } from "cloudflare:workers";

const base = "https://onzappy.com/api/v1/reseller";
const headers = { "Cache-Control": "no-store" };
type Input = { action?: unknown; page?: unknown; resellerId?: unknown; amount?: unknown; notes?: unknown; confirmation?: unknown };

async function authorized(request: Request) {
  if (!env.ADMIN_DASHBOARD_KEY || !env.ZAPPY_API_KEY) return "Painel ainda não configurado.";
  if (request.headers.get("Origin") !== new URL(request.url).origin) return "Solicitação inválida.";
  const supplied = request.headers.get("X-Dashboard-Key") ?? "";
  if (!supplied || supplied.length > 256) return "Chave incorreta.";
  const digest = async (value: string) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  const [a, b] = await Promise.all([digest(supplied), digest(env.ADMIN_DASHBOARD_KEY)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0 ? null : "Chave incorreta.";
}

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
  const failure = await authorized(request);
  if (failure) return Response.json({ error: failure }, { status: failure === "Painel ainda não configurado." ? 503 : failure === "Solicitação inválida." ? 403 : 401, headers });
  let input: Input;
  try { input = await request.json(); } catch { return Response.json({ error: "Dados inválidos." }, { status: 400, headers }); }
  if (!input || typeof input !== "object") return Response.json({ error: "Dados inválidos." }, { status: 400, headers });
  const action = input.action;
  try {
    if (action === "list") {
      const data = await zappy("/resellers") as { resellers?: unknown };
      if (!Array.isArray(data.resellers)) throw new Error("Resposta inesperada da Zappy.");
      const contacts = env.DB ? await env.DB.prepare("SELECT reseller_id, whatsapp FROM reseller_contacts").all<{ reseller_id: string; whatsapp: string }>()
        .then(result => new Map(result.results.map(item => [item.reseller_id, item.whatsapp])))
        .catch(() => new Map<string, string>()) : new Map<string, string>();
      const resellers = data.resellers.slice(0, 500).map((item: Record<string, unknown>) => ({
        id: String(item.id ?? ""), username: String(item.username ?? ""), displayName: String(item.displayName ?? ""),
        creditsBalance: Number(item.creditsBalance ?? 0), status: String(item.status ?? ""), depth: Number(item.depth ?? 0),
        canCreateSubresellers: Boolean(item.canCreateSubresellers),
        whatsapp: contacts.get(String(item.id ?? "")) ?? (typeof item.whatsapp === "string" && /^\d{10,15}$/.test(item.whatsapp) ? item.whatsapp : ""),
      }));
      return Response.json({ resellers }, { headers });
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
      if (!/^cl[a-zA-Z0-9_-]{5,80}$/.test(resellerId) || !Number.isSafeInteger(amount) || amount < 1 || amount > 100000 || notes.length > 150 || input.confirmation !== (action === "transfer" ? "TRANSFERIR" : "RECOLHER")) {
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
