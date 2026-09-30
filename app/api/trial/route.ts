import { env } from "cloudflare:workers";

export async function POST(request: Request) {
  if (!env.DB || !env.ZAPPY_API_KEY) return Response.json({ error: "Teste indisponível no momento." }, { status: 503 });
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "Solicitação inválida." }, { status: 403 });
  let input: { name?: unknown; username?: unknown; turnstileToken?: unknown };
  try { input = await request.json(); } catch { return Response.json({ error: "Dados inválidos." }, { status: 400 }); }
  const name = String(input.name ?? "").trim().replace(/\s+/g, " ").slice(0, 90);
  if (name.length < 3) return Response.json({ error: "Informe seu nome para criar o teste." }, { status: 400 });
  const username = String(input.username ?? "").trim().toLowerCase();
  if (!/^[a-z0-9_]{4,20}$/.test(username)) {
    return Response.json({ error: "O usuário deve ter de 4 a 20 letras, números ou _ (sem espaços e acentos)." }, { status: 400 });
  }

  const ip = request.headers.get("CF-Connecting-IP") ?? request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim();
  if (env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET_KEY) {
    const token = typeof input.turnstileToken === "string" ? input.turnstileToken : "";
    if (!token || token.length > 2048) return Response.json({ error: "Confirme a verificação de segurança e tente novamente." }, { status: 400 });
    try {
      const verification = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: env.TURNSTILE_SECRET_KEY, response: token, remoteip: ip }),
        signal: AbortSignal.timeout(8000),
      });
      const result = await verification.json() as { success?: boolean; hostname?: string; action?: string };
      if (!verification.ok || !result.success || result.hostname !== new URL(request.url).hostname || result.action !== "trial") {
        return Response.json({ error: "A verificação de segurança expirou ou falhou. Tente novamente." }, { status: 403 });
      }
    } catch {
      return Response.json({ error: "Não conseguimos verificar a segurança agora. Tente novamente em instantes." }, { status: 503 });
    }
  }
  const db = env.DB;
  const ipHash = ip ? await hash(ip + env.ZAPPY_API_KEY) : "unknown";
  const pending = await db.prepare("SELECT id FROM trial_requests WHERE username = ? AND status = 'CREATING' AND created_at > ? LIMIT 1")
    .bind(username, Date.now() - 2 * 60 * 1000).first<{ id: string }>();
  if (pending) return Response.json({
    code: "trial_unconfirmed",
    error: "Já existe uma tentativa recente com esse usuário. Aguarde dois minutos e confira se o acesso foi criado antes de enviar outro pedido.",
  }, { status: 409, headers: { "Cache-Control": "no-store" } });
  const id = crypto.randomUUID();
  const random = Array.from(crypto.getRandomValues(new Uint8Array(8)), byte => byte.toString(36).padStart(2, "0")).join("");
  const password = "Zp@" + random;
  await db.prepare("INSERT INTO trial_requests (id, ip_hash, username, status, created_at) VALUES (?, ?, ?, 'CREATING', ?)")
    .bind(id, ipHash, username, Date.now()).run();
  try {
    const response = await fetch("https://onzappy.com/api/v1/reseller/users/trial", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + env.ZAPPY_API_KEY,
        "Content-Type": "application/json",
        "Idempotency-Key": id,
      },
      body: JSON.stringify({ username, password, name }),
      signal: AbortSignal.timeout(12000),
    });
    const body = await response.json() as {
      success?: boolean;
      error?: { code?: string };
      data?: { id?: string; username?: string; password?: string; trialExpiresAt?: string; links?: { login?: string; android?: string } };
    };
    if (!response.ok || !body.success || !body.data?.id) {
      const failure = response.status === 409 || ["username_taken", "username_exists", "user_exists", "conflict"].includes(body.error?.code ?? "")
        ? "username_taken"
        : body.error?.code === "trial_limit_reached" || response.status === 429 ? "trial_limit" : "zappy_error";
      await db.prepare("UPDATE trial_requests SET status = 'FAILED', failure_code = ? WHERE id = ?").bind(failure, id).run();
      if (response.status === 409 || ["username_taken", "username_exists", "user_exists", "conflict"].includes(body.error?.code ?? "")) {
        return Response.json({ code: "username_taken", error: "Esse usuário já está em uso. Escolha outro nome." }, { status: 409 });
      }
      const unavailable = body.error?.code === "trial_limit_reached" || response.status === 429;
      return Response.json({ error: unavailable ? "Os testes de hoje acabaram. Volte amanhã." : "Não foi possível criar o teste. Tente novamente." }, { status: unavailable ? 429 : 502 });
    }
    // A falha do registro local não transforma um teste confirmado pela Zappy em falha.
    await db.prepare("UPDATE trial_requests SET status = 'CREATED', failure_code = NULL WHERE id = ?").bind(id).run()
      .catch(error => console.error("trial_created_db_update_failed", id, error));
    return Response.json({
      username: body.data.username ?? username,
      password: body.data.password ?? password,
      expiresAt: body.data.trialExpiresAt,
      login: body.data.links?.login ?? "https://onzappy.com/login",
      android: body.data.links?.android ?? "https://onzappy.com/download",
    }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch {
    // Uma falha de rede ou uma resposta ilegível pode acontecer após a criação remota.
    await db.prepare("UPDATE trial_requests SET failure_code = 'unconfirmed' WHERE id = ?").bind(id).run().catch(() => {});
    return Response.json({ code: "trial_unconfirmed", error: "A Zappy não confirmou a resposta. Aguarde dois minutos e confira se o usuário já consegue entrar antes de tentar novamente." }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}

async function hash(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, "0")).join("");
}
