"use client";

import { useState } from "react";

type Counts = { created: number; failed: number; pending: number };
type Stats = { lastDay: Counts; lastWeek: Counts };

export function Dashboard() {
  const [key, setKey] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load(event?: React.FormEvent) {
    event?.preventDefault();
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/stats", { method: "POST", headers: { "X-Dashboard-Key": key }, cache: "no-store" });
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
    <p className="dashboard-note">Os números são de solicitações feitas por este site. Uma tentativa sem confirmação pode ter sido criada no Zappy após um atraso na resposta.</p>
  </div>;
}
