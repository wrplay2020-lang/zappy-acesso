"use client";

import { useState } from "react";

type Counts = { created: number; failed: number; pending: number };
type Trial = { id: string; username: string | null; status: string; failure_code: string | null; created_at: number };
type Stats = { lastDay: Counts; lastWeek: Counts; history: Trial[]; reasons: { failure_code: string | null; total: number }[] };
const labels: Record<string, string> = {
  CREATED: "Criado", FAILED: "Falhou", CREATING: "Sem confirmação",
  username_taken: "Usuário já existe", trial_limit: "Limite da Zappy", zappy_error: "Erro da Zappy", unconfirmed: "Resposta não confirmada",
};

export function Dashboard() {
  const [key, setKey] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [period, setPeriod] = useState("week");
  const [status, setStatus] = useState("all");

  async function load(event?: React.FormEvent, nextPeriod = period, nextStatus = status) {
    event?.preventDefault();
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/admin/stats?period=${nextPeriod}&status=${nextStatus}`, { method: "POST", headers: { "X-Dashboard-Key": key }, cache: "no-store" });
      const body = await response.json() as Stats & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Não foi possível carregar os números.");
      setStats(body);
    } catch (cause) {
      setStats(null);
      setError(cause instanceof Error ? cause.message : "Tente novamente.");
    } finally { setBusy(false); }
  }

  if (!stats) return <form className="dashboard-login" onSubmit={load}>
    <label htmlFor="dashboard-key">Chave do painel</label>
    <input id="dashboard-key" type="password" autoComplete="off" value={key} onChange={event => setKey(event.target.value)} required />
    {error && <p role="alert" className="dashboard-error">{error}</p>}
    <button disabled={busy} type="submit">{busy ? "Carregando…" : "Entrar"}</button>
  </form>;

  return <div className="dashboard-results">
    <div className="dashboard-actions"><button type="button" onClick={() => load()} disabled={busy}>{busy ? "Atualizando…" : "Atualizar"}</button><button type="button" onClick={() => { setKey(""); setStats(null); }}>Sair</button></div>
    {error && <p role="alert" className="dashboard-error">{error}</p>}
    <div className="dashboard-periods">{([ ["Últimas 24 horas", stats.lastDay], ["Últimos 7 dias", stats.lastWeek] ] as const).map(([label, values]) => <section className="dashboard-period" key={label}>
      <h2>{label}</h2>
      <dl><div><dt>Criados</dt><dd>{values.created}</dd></div><div><dt>Falharam</dt><dd>{values.failed}</dd></div><div><dt>Sem confirmação</dt><dd>{values.pending}</dd></div></dl>
    </section>)}</div>
    <section className="dashboard-history">
      <h2>Tentativas recentes</h2>
      <div className="dashboard-filters">
        <label>Período <select value={period} onChange={event => { setPeriod(event.target.value); void load(undefined, event.target.value, status); }}><option value="day">24 horas</option><option value="week">7 dias</option><option value="month">30 dias</option></select></label>
        <label>Resultado <select value={status} onChange={event => { setStatus(event.target.value); void load(undefined, period, event.target.value); }}><option value="all">Todos</option><option value="CREATED">Criados</option><option value="FAILED">Falharam</option><option value="CREATING">Sem confirmação</option></select></label>
      </div>
      {stats.history.length ? <div className="dashboard-table-wrap"><table><thead><tr><th>Quando</th><th>Usuário</th><th>Resultado</th><th>Motivo</th></tr></thead><tbody>{stats.history.map(item => <tr key={item.id}><td>{new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(item.created_at)}</td><td>{item.username ?? "Registro anterior"}</td><td>{labels[item.status] ?? item.status}</td><td>{labels[item.failure_code ?? ""] ?? (item.status === "FAILED" ? "Não registrado" : "—")}</td></tr>)}</tbody></table></div> : <p>Nenhuma tentativa nesse filtro.</p>}
      <p className="dashboard-note">Mostrando até 50 tentativas. Usuários e motivos passam a aparecer para novos registros após a atualização do banco.</p>
    </section>
    <section className="dashboard-history"><h2>Falhas por motivo</h2>{stats.reasons.length ? <ul>{stats.reasons.map((item, index) => <li key={`${item.failure_code}-${index}`}>{labels[item.failure_code ?? ""] ?? "Não registrado"}: <strong>{item.total}</strong></li>)}</ul> : <p>Nenhuma falha no período escolhido.</p>}</section>
    <p className="dashboard-note">Os números são de solicitações feitas por este site. Uma tentativa sem confirmação pode ter sido criada no Zappy após um atraso na resposta.</p>
  </div>;
}
