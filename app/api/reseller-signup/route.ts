import { env } from "cloudflare:workers";

const noStore = { "Cache-Control": "no-store" };
const reply = (data: object, status: number) => Response.json(data, { status, headers: noStore });
type SignupInput = { displayName?: unknown; username?: unknown; password?: unknown; whatsapp?: unknown; turnstileToken?: unknown };

export async function POST(request: Request) {
  if (!env.DB || !env.ZAPPY_API_KEY || !env.TURNSTILE_SITE_KEY || !env.TURNSTILE_SECRET_KEY) {
    return reply({ error: "Cadastro temporariamente indisponível." }, 503);
  }
  if (request.headers.get("Origin") !== new URL(request.url).origin) return reply({ error: "Solicitação inválida." }, 403);
  if (!request.headers.get("Content-Type")?.startsWith("application/json")) return reply({ error: "Dados inválidos." }, 400);
  if (Number(request.headers.get("Content-Length") ?? 0) > 5000) return reply({ error: "Dados inválidos." }, 413);
  let input: SignupInput;
  try { input = await request.json(); } catch { return reply({ error: "Dados inválidos." }, 400); }
  const displayName = typeof input.displayName === "string" ? input.displayName.trim().replace(/\s+/g, " ") : "";
  const username = typeof input.username === "string" ? input.username.trim().toLowerCase() : "";
  const password = typeof input.password === "string" ? input.password : "";
  const whatsapp = typeof input.whatsapp === "string" ? input.whatsapp.replace(/\D/g, "") : "";
  if (displayName.length < 3 || displayName.length > 90) return reply({ error: "Informe o nome comercial (3 a 90 caracteres)." }, 400);
  if (!/^[a-z0-9_]{4,32}$/.test(username)) return reply({ error: "O usuário deve ter de 4 a 32 letras, números ou _." }, 400);
  if (password.length < 6 || password.length > 100) return reply({ error: "A senha deve ter de 6 a 100 caracteres." }, 400);
  if (!/^\d{10,15}$/.test(whatsapp)) return reply({ error: "Informe seu WhatsApp com DDD para combinar a recarga de créditos." }, 400);
  const ip = request.headers.get("CF-Connecting-IP");
  if (!ip) return reply({ error: "Não foi possível verificar a solicitação. Tente novamente." }, 403);
  const token = typeof input.turnstileToken === "string" ? input.turnstileToken : "";
  if (!token || token.length > 2048) return reply({ error: "Conclua a verificação de segurança." }, 400);
  try {
    const verification = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: env.TURNSTILE_SECRET_KEY, response: token, remoteip: ip }),
      signal: AbortSignal.timeout(8000),
    });
    const result = await verification.json() as { success?: boolean; hostname?: string; action?: string };
    if (!verification.ok || !result.success || result.hostname !== new URL(request.url).hostname || result.action !== "reseller") {
      return reply({ error: "A verificação expirou ou falhou. Tente novamente." }, 403);
    }
  } catch { return reply({ error: "Verificação indisponível no momento. Tente mais tarde." }, 503); }

  const db = env.DB;
  const hashBytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip + env.ZAPPY_API_KEY));
  const ipHash = Array.from(new Uint8Array(hashBytes), n => n.toString(16).padStart(2, "0")).join("");
  const now = Date.now();
  const id = crypto.randomUUID();
  try {
    await db.prepare("CREATE TABLE IF NOT EXISTS reseller_signup_attempts (id TEXT PRIMARY KEY, ip_hash TEXT NOT NULL, username TEXT NOT NULL, status TEXT NOT NULL, created_at INTEGER NOT NULL)").run();
    await db.prepare("CREATE TABLE IF NOT EXISTS reseller_contacts (reseller_id TEXT PRIMARY KEY, username TEXT NOT NULL, display_name TEXT NOT NULL, whatsapp TEXT NOT NULL, created_at INTEGER NOT NULL)").run();
    const recent = await db.prepare("SELECT COUNT(*) AS total FROM reseller_signup_attempts WHERE ip_hash = ? AND created_at > ?").bind(ipHash, now - 86400000).first<{ total: number }>();
    if ((recent?.total ?? 0) >= 3) return reply({ error: "Limite de cadastros por dia atingido. Tente novamente amanhã." }, 429);
    const pending = await db.prepare("SELECT id FROM reseller_signup_attempts WHERE username = ? AND status IN ('CREATING', 'CREATED') AND created_at > ? LIMIT 1").bind(username, now - 86400000).first<{ id: string }>();
    if (pending) return reply({ code: "signup_unconfirmed", error: "Já existe um cadastro recente com esse usuário. Confira se ele já consegue entrar antes de tentar de novo." }, 409);
    await db.prepare("INSERT INTO reseller_signup_attempts (id, ip_hash, username, status, created_at) VALUES (?, ?, ?, 'CREATING', ?)").bind(id, ipHash, username, now).run();
  } catch {
    return reply({ error: "Cadastro temporariamente indisponível. Tente mais tarde." }, 503);
  }

  try {
    const response = await fetch("https://onzappy.com/api/v1/reseller/resellers", {
      method: "POST",
      headers: { Authorization: "Bearer " + env.ZAPPY_API_KEY, "Content-Type": "application/json", "Idempotency-Key": id },
      body: JSON.stringify({ username, password, displayName, whatsapp }),
      signal: AbortSignal.timeout(12000),
    });
    const body = await response.json() as { success?: boolean; data?: { resellerId?: string; username?: string }; error?: { code?: string } };
    if (!response.ok || !body.success || !body.data?.resellerId) {
      await db.prepare("UPDATE reseller_signup_attempts SET status = 'FAILED' WHERE id = ?").bind(id).run().catch(() => {});
      const taken = response.status === 409 || ["username_taken", "username_exists", "reseller_exists", "conflict"].includes(body.error?.code ?? "");
      if (taken) return reply({ code: "username_taken", error: "Esse usuário já está em uso. Escolha outro." }, 409);
      if (response.status === 429) return reply({ error: "Muitos cadastros no momento. Tente mais tarde." }, 429);
      return reply({ error: "A Zappy não conseguiu criar a conta agora. Tente mais tarde." }, 502);
    }
    await db.prepare("INSERT OR REPLACE INTO reseller_contacts (reseller_id, username, display_name, whatsapp, created_at) VALUES (?, ?, ?, ?, ?)").bind(body.data.resellerId, body.data.username ?? username, displayName, whatsapp, now).run().catch(error => console.error("reseller_contact_save_failed", id, error));
    await db.prepare("UPDATE reseller_signup_attempts SET status = 'CREATED' WHERE id = ?").bind(id).run().catch(() => {});
    return reply({ success: true, username: body.data.username ?? username }, 201);
  } catch {
    // A Zappy pode ter criado a conta mesmo se a conexão caiu; bloqueie uma repetição imediata.
    return reply({ code: "signup_unconfirmed", error: "A resposta da Zappy não foi confirmada. Aguarde e tente entrar no painel com o usuário e a senha escolhidos antes de repetir o cadastro." }, 502);
  }
}
