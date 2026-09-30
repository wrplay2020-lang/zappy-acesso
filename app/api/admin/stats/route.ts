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
  const url = new URL(request.url);
  const period = url.searchParams.get("period") === "day" ? "day" : url.searchParams.get("period") === "month" ? "month" : "week";
  const status = ["CREATED", "FAILED", "CREATING"].includes(url.searchParams.get("status") ?? "") ? url.searchParams.get("status")! : "all";
  const start = now - (period === "day" ? 1 : period === "month" ? 30 : 7) * 86400000;
  const username = (url.searchParams.get("username") ?? "").trim().toLowerCase().slice(0, 20);
  const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(now));
  const todayStart = Date.parse(`${localDate}T00:00:00-03:00`);
  const [today, lastDay, lastWeek, history, reasons] = await Promise.all([
    env.DB.prepare("SELECT status, COUNT(*) AS total FROM trial_requests WHERE created_at >= ? GROUP BY status").bind(todayStart).all<{ status: string; total: number }>(),
    env.DB.prepare("SELECT status, COUNT(*) AS total FROM trial_requests WHERE created_at >= ? GROUP BY status").bind(now - 86400000).all<{ status: string; total: number }>(),
    env.DB.prepare("SELECT status, COUNT(*) AS total FROM trial_requests WHERE created_at >= ? GROUP BY status").bind(now - 7 * 86400000).all<{ status: string; total: number }>(),
    (username
      ? (status === "all"
        ? env.DB.prepare("SELECT id, username, status, failure_code, created_at FROM trial_requests WHERE instr(lower(username), ?) > 0 ORDER BY created_at DESC LIMIT 50").bind(username)
        : env.DB.prepare("SELECT id, username, status, failure_code, created_at FROM trial_requests WHERE instr(lower(username), ?) > 0 AND status = ? ORDER BY created_at DESC LIMIT 50").bind(username, status))
      : (status === "all"
        ? env.DB.prepare("SELECT id, username, status, failure_code, created_at FROM trial_requests WHERE created_at >= ? ORDER BY created_at DESC LIMIT 50").bind(start)
        : env.DB.prepare("SELECT id, username, status, failure_code, created_at FROM trial_requests WHERE created_at >= ? AND status = ? ORDER BY created_at DESC LIMIT 50").bind(start, status)))
      .all<{ id: string; username: string | null; status: string; failure_code: string | null; created_at: number }>(),
    env.DB.prepare("SELECT failure_code, COUNT(*) AS total FROM trial_requests WHERE created_at >= ? AND status = 'FAILED' GROUP BY failure_code")
      .bind(start).all<{ failure_code: string | null; total: number }>(),
  ]);
  const counts = (rows: { status: string; total: number }[]) => ({
    created: rows.find(row => row.status === "CREATED")?.total ?? 0,
    failed: rows.find(row => row.status === "FAILED")?.total ?? 0,
    pending: rows.find(row => row.status === "CREATING")?.total ?? 0,
  });
  return Response.json({ today: counts(today.results), lastDay: counts(lastDay.results), lastWeek: counts(lastWeek.results), history: history.results, reasons: reasons.results }, { headers: { "Cache-Control": "no-store" } });
}

async function matchesKey(a: string, b: string) {
  const digest = async (value: string) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  const [left, right] = await Promise.all([digest(a), digest(b)]);
  let different = 0;
  for (let i = 0; i < left.length; i++) different |= left[i] ^ right[i];
  return different === 0;
}
