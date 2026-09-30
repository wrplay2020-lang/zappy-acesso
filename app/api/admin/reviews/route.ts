import { env } from "cloudflare:workers";
import { ensureReviewTable } from "../review-store";

export async function POST(request: Request) {
  if (!env.ADMIN_DASHBOARD_KEY || !env.DB) return Response.json({ error: "Painel ainda não configurado." }, { status: 503 });
  if (request.headers.get("Origin") !== new URL(request.url).origin) return Response.json({ error: "Solicitação inválida." }, { status: 403 });
  const key = request.headers.get("X-Dashboard-Key") ?? "";
  if (!key || key.length > 256 || !(await matchesKey(key, env.ADMIN_DASHBOARD_KEY))) {
    return Response.json({ error: "Chave incorreta." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  let input: { id?: unknown; reviewed?: unknown };
  try { input = await request.json(); } catch { return Response.json({ error: "Dados inválidos." }, { status: 400 }); }
  if (typeof input.id !== "string" || !/^[0-9a-f-]{36}$/i.test(input.id) || typeof input.reviewed !== "boolean") {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }
  await ensureReviewTable();
  const trial = await env.DB.prepare("SELECT status FROM trial_requests WHERE id = ?").bind(input.id).first<{ status: string }>();
  if (!trial || trial.status !== "CREATING") return Response.json({ error: "Esta tentativa não está pendente de conferência." }, { status: 409 });
  if (!input.reviewed) {
    await env.DB.prepare("DELETE FROM trial_reviews WHERE trial_id = ?").bind(input.id).run();
    return Response.json({ reviewedAt: null }, { headers: { "Cache-Control": "no-store" } });
  }
  const reviewedAt = Date.now();
  await env.DB.prepare("INSERT INTO trial_reviews (trial_id, reviewed_at) VALUES (?, ?) ON CONFLICT(trial_id) DO NOTHING")
    .bind(input.id, reviewedAt).run();
  const saved = await env.DB.prepare("SELECT reviewed_at FROM trial_reviews WHERE trial_id = ?").bind(input.id).first<{ reviewed_at: number }>();
  return Response.json({ reviewedAt: saved?.reviewed_at ?? reviewedAt }, { headers: { "Cache-Control": "no-store" } });
}

async function matchesKey(a: string, b: string) {
  const digest = async (value: string) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  const [left, right] = await Promise.all([digest(a), digest(b)]);
  let different = 0;
  for (let i = 0; i < left.length; i++) different |= left[i] ^ right[i];
  return different === 0;
}
