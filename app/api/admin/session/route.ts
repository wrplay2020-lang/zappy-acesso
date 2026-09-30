import { env } from "cloudflare:workers";
import { authorized, createSession, deleteSession, matchesKey } from "../session-store";

const headers = { "Cache-Control": "no-store" };
const sameOrigin = (request: Request) => request.headers.get("Origin") === new URL(request.url).origin;

export async function GET(request: Request) {
  try {
    return Response.json({ authenticated: await authorized(request) }, { headers });
  } catch {
    return Response.json({ authenticated: false }, { status: 503, headers });
  }
}

export async function POST(request: Request) {
  if (!env.ADMIN_DASHBOARD_KEY || !env.DB) return Response.json({ error: "Painel ainda não configurado." }, { status: 503, headers });
  if (!sameOrigin(request)) return Response.json({ error: "Solicitação inválida." }, { status: 403, headers });
  let input: { key?: unknown };
  try { input = await request.json(); } catch { return Response.json({ error: "Dados inválidos." }, { status: 400, headers }); }
  const key = typeof input?.key === "string" ? input.key : "";
  if (!key || key.length > 256 || !(await matchesKey(key, env.ADMIN_DASHBOARD_KEY))) {
    return Response.json({ error: "Chave incorreta." }, { status: 401, headers });
  }
  try {
    const cookie = await createSession();
    return Response.json({ authenticated: true }, { headers: { ...headers, "Set-Cookie": cookie } });
  } catch {
    return Response.json({ error: "Não foi possível abrir a sessão. Tente novamente." }, { status: 503, headers });
  }
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Solicitação inválida." }, { status: 403, headers });
  try {
    const cookie = await deleteSession(request);
    return Response.json({ authenticated: false }, { headers: { ...headers, "Set-Cookie": cookie } });
  } catch {
    return Response.json({ error: "Não foi possível encerrar a sessão." }, { status: 503, headers });
  }
}
