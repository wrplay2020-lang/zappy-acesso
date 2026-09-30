import { env } from "cloudflare:workers";
import { ensureReviewTable } from "../review-store";
import { authorized } from "../session-store";

export async function POST(request: Request) {
  const configured = env.ADMIN_DASHBOARD_KEY;
  if (!configured || !env.DB) return Response.json({ error: "Painel ainda não configurado." }, { status: 503 });
  if (request.headers.get("Origin") !== new URL(request.url).origin) return Response.json({ error: "Solicitação inválida." }, { status: 403 });
  if (!(await authorized(request))) return Response.json({ error: "Sessão expirada. Entre novamente." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  await ensureReviewTable();
  const now = Date.now();
  const url = new URL(request.url);
  const period = url.searchParams.get("period") === "day" ? "day" : url.searchParams.get("period") === "month" ? "month" : "week";
  const status = ["CREATED", "FAILED", "CREATING", "REVIEWED"].includes(url.searchParams.get("status") ?? "") ? url.searchParams.get("status")! : "all";
  const start = now - (period === "day" ? 1 : period === "month" ? 30 : 7) * 86400000;
  const username = (url.searchParams.get("username") ?? "").trim().toLowerCase().slice(0, 20);
  const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(now));
  const todayStart = Date.parse(`${localDate}T00:00:00-03:00`);
  const effectiveStatus = "CASE WHEN tr.status = 'CREATING' AND rv.trial_id IS NOT NULL THEN 'REVIEWED' ELSE tr.status END";
  const countsQuery = "SELECT " + effectiveStatus + " AS status, COUNT(*) AS total FROM trial_requests tr LEFT JOIN trial_reviews rv ON rv.trial_id = tr.id WHERE tr.created_at >= ? GROUP BY 1";
  const filters = [username ? "instr(lower(tr.username), ?) > 0" : "tr.created_at >= ?"];
  const parameters: (string | number)[] = [username || start];
  if (status !== "all") { filters.push(effectiveStatus + " = ?"); parameters.push(status); }
  const historyQuery = "SELECT tr.id, tr.username, " + effectiveStatus + " AS status, tr.failure_code, tr.created_at, rv.reviewed_at FROM trial_requests tr LEFT JOIN trial_reviews rv ON rv.trial_id = tr.id WHERE " + filters.join(" AND ") + " ORDER BY tr.created_at DESC LIMIT 50";
  const [today, lastDay, lastWeek, history, reasons] = await Promise.all([
    env.DB.prepare(countsQuery).bind(todayStart).all<{ status: string; total: number }>(),
    env.DB.prepare(countsQuery).bind(now - 86400000).all<{ status: string; total: number }>(),
    env.DB.prepare(countsQuery).bind(now - 7 * 86400000).all<{ status: string; total: number }>(),
    env.DB.prepare(historyQuery).bind(...parameters)
      .all<{ id: string; username: string | null; status: string; failure_code: string | null; created_at: number; reviewed_at: number | null }>(),
    env.DB.prepare("SELECT failure_code, COUNT(*) AS total FROM trial_requests WHERE created_at >= ? AND status = 'FAILED' GROUP BY failure_code")
      .bind(start).all<{ failure_code: string | null; total: number }>(),
  ]);
  const counts = (rows: { status: string; total: number }[]) => ({
    created: rows.find(row => row.status === "CREATED")?.total ?? 0,
    failed: rows.find(row => row.status === "FAILED")?.total ?? 0,
    pending: rows.find(row => row.status === "CREATING")?.total ?? 0,
    reviewed: rows.find(row => row.status === "REVIEWED")?.total ?? 0,
  });
  return Response.json({ today: counts(today.results), lastDay: counts(lastDay.results), lastWeek: counts(lastWeek.results), history: history.results, reasons: reasons.results }, { headers: { "Cache-Control": "no-store" } });
}

