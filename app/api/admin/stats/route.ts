import { env } from "cloudflare:workers";

export async function POST(request: Request) {
  const configured = env.ADMIN_DASHBOARD_KEY;
  if (!configured || !env.DB) return Response.json({ error: "Painel ainda não configurado." }, { status: 503 });
  if (request.headers.get("Origin") !== new URL(request.url).origin) return Response.json({ error: "Solicitação inválida." }, { status: 403 });
  const submitted = request.headers.get("X-Dashboard-Key") ?? "";
  if (!submitted || submitted.length > 256 || !(await matchesKey(submitted, configured))) {
    return Response.json({ error: "Chave incorreta." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const now = Date.now();
  const [lastDay, lastWeek] = await Promise.all([
    env.DB.prepare("SELECT status, COUNT(*) AS total FROM trial_requests WHERE created_at >= ? GROUP BY status").bind(now - 86400000).all<{ status: string; total: number }>(),
    env.DB.prepare("SELECT status, COUNT(*) AS total FROM trial_requests WHERE created_at >= ? GROUP BY status").bind(now - 7 * 86400000).all<{ status: string; total: number }>(),
  ]);
  const counts = (rows: { status: string; total: number }[]) => ({
    created: rows.find(row => row.status === "CREATED")?.total ?? 0,
    failed: rows.find(row => row.status === "FAILED")?.total ?? 0,
    pending: rows.find(row => row.status === "CREATING")?.total ?? 0,
  });
  return Response.json({ lastDay: counts(lastDay.results), lastWeek: counts(lastWeek.results) }, { headers: { "Cache-Control": "no-store" } });
}

async function matchesKey(a: string, b: string) {
  const digest = async (value: string) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  const [left, right] = await Promise.all([digest(a), digest(b)]);
  let different = 0;
  for (let i = 0; i < left.length; i++) different |= left[i] ^ right[i];
  return different === 0;
}
