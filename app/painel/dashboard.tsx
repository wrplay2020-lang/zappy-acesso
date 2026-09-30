"use client";

import { useEffect, useRef, useState } from "react";

type Counts = { created: number; failed: number; pending: number };
type Trial = { id: string; username: string | null; status: string; failure_code: string | null; created_at: number };
type Stats = { today: Counts; lastDay: Counts; lastWeek: Counts; history: Trial[]; reasons: { failure_code: string | null; total: number }[] };
const labels: Record<string, string> = {
  CREATED: "Criado", FAILED: "Falhou", CREATING: "Sem confirmação",
  username_taken: "Usuário já existe", trial_limit: "Limite da Zappy", zappy_error: "Erro da Zappy", unconfirmed: "Resposta não confirmada",
};
const sessionKey = "zappy-dashboard-key";
const trialDurationMs = 24 * 60 * 60 * 1000;

function trialWindow(item: Trial) {
  if (item.status !== "CREATED") return "—";
  return Date.now() < item.created_at + trialDurationMs ? "Dentro do prazo do teste" : "Prazo do teste encerrado";
}

export function Dashboard() {
  const [key, setKey] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [catalog, setCatalog] = useState<{ latest: string | null; state: "loading" | "available" | "unavailable" }>({ latest: null, state: "loading" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [period, setPeriod] = useState("week");
  const [status, setStatus] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [restoring, setRestoring] = useState(true);
  const inFlight = useRef(false);

  async function load(event?: React.FormEvent, nextPeriod = period, nextStatus = status, credential = key, silent = false, nextSearch = search) {
    event?.preventDefault();
    if (inFlight.current || !credential) return;
    inFlight.current = true;
    if (!silent) setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/stats?period=${nextPeriod}&status=${nextStatus}&username=${encodeURIComponent(nextSearch)}`, { method: "POST", headers: { "X-Dashboard-Key": credential }, cache: "no-store" });
      const body = await response.json() as Stats & { error?: string };
      if (response.status === 401) {
        sessionStorage.removeItem(sessionKey);
        setKey(""); setStats(null);
      }
      if (!response.ok) throw new Error(body.error ?? "Não foi possível carregar os números.");
      setStats(body);
      sessionStorage.setItem(sessionKey, credential);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Tente novamente.");
    } finally { inFlight.current = false; setBusy(false); setRestoring(false); }
  }

  useEffect(() => {
    const saved = sessionStorage.getItem(sessionKey);
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      if (saved) { setKey(saved); void load(undefined, "week", "all", saved); }
      else setRestoring(false);
    });
    return () => { active = false; };
    // Restore only once when the tab opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!stats || !key) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) void load(undefined, period, status, key, true);
    }, 30000);
    return () => window.clearInterval(timer);
    // Refresh the current filters while the dashboard is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, period, status, search, Boolean(stats)]);

  useEffect(() => {
    if (!stats || !key) return;
    let active = true;
    async function checkCatalog() {
      try {
        const response = await fetch("/api/releases", { cache: "no-store" });
        const body = await response.json() as { items?: { publishedAt?: string }[] };
        if (!active) return;
        if (!response.ok || !Array.isArray(body.items) || !body.items.length) {
          setCatalog({ latest: null, state: "unavailable" });
          return;
        }
        const dates = body.items.map(item => Date.parse(item.publishedAt ?? "")).filter(Number.isFinite);
        setCatalog({ latest: dates.length ? new Date(Math.max(...dates)).toISOString() : null, state: "available" });
      } catch { if (active) setCatalog({ latest: null, state: "unavailable" }); }
    }
    void checkCatalog();
    const timer = window.setInterval(() => { if (!document.hidden) void checkCatalog(); }, 5 * 60 * 1000);
    return () => { active = false; window.clearInterval(timer); };
    // A consulta do catálogo não depende dos filtros do histórico.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(stats), key]);

  if (restoring) return <p className="dashboard-note">Carregando painel…</p>;
  if (!stats) return <form className="dashboard-login" onSubmit={load}>
    <label htmlFor="dashboard-key">Chave do painel</label>
    <input id="dashboard-key" type="password" autoComplete="off" value={key} onChange={event => setKey(event.target.value)} required />
    {error && <p role="alert" className="dashboard-error">{error}</p>}
    <button disabled={busy} type="submit">{busy ? "Carregando…" : "Entrar"}</button>
  </form>;

  const catalogIsOld = catalog.latest ? Date.now() - Date.parse(catalog.latest) > 2 * 86400000 : false;
  const pendingItems = !search && status === "all" ? stats.history.filter(item => item.status === "CREATING") : [];

  return <div className="dashboard-results">
    <div className="dashboard-actions"><button type="button" onClick={() => load()} disabled={busy}>{busy ? "Atualizando…" : "Atualizar"}</button><button type="button" onClick={() => { sessionStorage.removeItem(sessionKey); setKey(""); setStats(null); }}>Sair</button></div>
    <p className="dashboard-note">Atualização automática a cada 30 segundos enquanto esta aba estiver aberta.</p>
    {error && <p role="alert" className="dashboard-error">{error}</p>}
    <section className="dashboard-history" aria-labelledby="today-heading">
      <h2 id="today-heading">Resumo de hoje</h2>
      <p className="dashboard-note">Desde 00h, horário de Brasília. São solicitações feitas por este site.</p>
      <dl className="dashboard-today">
        <div><dt>Testes criados</dt><dd>{stats.today.created}</dd></div>
        <div><dt>Falharam</dt><dd>{stats.today.failed}</dd></div>
        <div><dt>Sem confirmação</dt><dd>{stats.today.pending}</dd></div>
      </dl>
    </section>
    <section className="dashboard-history" aria-labelledby="catalog-heading">
      <h2 id="catalog-heading">Catálogo da Zappy</h2>
      {catalog.state === "loading" ? <p className="dashboard-note">Consultando catálogo…</p>
        : catalog.state === "unavailable" ? <p role="status" className="dashboard-error">Não foi possível consultar o catálogo agora.</p>
        : catalog.latest ? <p className={catalogIsOld ? "dashboard-error" : "dashboard-note"} role={catalogIsOld ? "status" : undefined}>Última publicação recebida: <strong>{new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(catalog.latest))}</strong>. {catalogIsOld ? "Sem títulos publicados nos últimos dois dias nesta resposta da API." : "Há publicação recente na resposta da API."}</p>
        : <p className="dashboard-note">A API não informou a data de publicação dos títulos.</p>}
    </section>
    <div className="dashboard-periods">{([ ["Últimas 24 horas", stats.lastDay], ["Últimos 7 dias", stats.lastWeek] ] as const).map(([label, values]) => <section className="dashboard-period" key={label}>
      <h2>{label}</h2>
      <dl><div><dt>Criados</dt><dd>{values.created}</dd></div><div><dt>Falharam</dt><dd>{values.failed}</dd></div><div><dt>Sem confirmação</dt><dd>{values.pending}</dd></div></dl>
    </section>)}</div>
    {pendingItems.length > 0 && <section className="dashboard-history" aria-labelledby="pending-heading">
      <h2 id="pending-heading">Precisam de conferência ({pendingItems.length})</h2>
      <p className="dashboard-note">A resposta da Zappy não foi confirmada. Confira esses usuários no painel da Zappy antes de criar outro teste.</p>
      <ul>{pendingItems.map(item => <li key={item.id}><strong>{item.username ?? "Usuário não registrado"}</strong> · {new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(item.created_at)}</li>)}</ul>
    </section>}
    <section className="dashboard-history">
      <h2>Tentativas recentes</h2>
      <div className="dashboard-filters">
        <label>Período <select value={period} onChange={event => { setPeriod(event.target.value); void load(undefined, event.target.value, status); }}><option value="day">24 horas</option><option value="week">7 dias</option><option value="month">30 dias</option></select></label>
        <label>Resultado <select value={status} onChange={event => { setStatus(event.target.value); void load(undefined, period, event.target.value); }}><option value="all">Todos</option><option value="CREATED">Criados</option><option value="FAILED">Falharam</option><option value="CREATING">Sem confirmação</option></select></label>
      </div>
      <form className="dashboard-search" onSubmit={event => { event.preventDefault(); const term = searchInput.trim(); setSearch(term); void load(undefined, period, status, key, false, term); }}>
        <label htmlFor="dashboard-username">Buscar usuário em todo o histórico</label>
        <div><input id="dashboard-username" type="search" autoComplete="off" value={searchInput} onChange={event => setSearchInput(event.target.value)} placeholder="Digite o nome de usuário" maxLength={20}/><button type="submit" disabled={busy}>Buscar</button>{search && <button type="button" onClick={() => { setSearchInput(""); setSearch(""); void load(undefined, period, status, key, false, ""); }}>Limpar</button>}</div>
      </form>
      {stats.history.length ? <><div className="dashboard-table-wrap"><table><thead><tr><th>Quando</th><th>Usuário</th><th>Resultado</th><th>Prazo do teste</th><th>Motivo</th></tr></thead><tbody>{stats.history.map(item => <tr key={item.id}><td>{new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(item.created_at)}</td><td>{item.username ?? "Registro anterior"}</td><td>{labels[item.status] ?? item.status}</td><td>{trialWindow(item)}</td><td>{labels[item.failure_code ?? ""] ?? (item.status === "FAILED" ? "Não registrado" : "—")}</td></tr>)}</tbody></table></div><ul className="dashboard-mobile-list">{stats.history.map(item => <li key={item.id} className="dashboard-mobile-card">
        <div className="dashboard-mobile-top"><strong>{item.username ?? "Registro anterior"}</strong><span className={`dashboard-status dashboard-status-${item.status.toLowerCase()}`}>{labels[item.status] ?? item.status}</span></div>
        <dl><div><dt>Quando</dt><dd>{new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(item.created_at)}</dd></div><div><dt>Prazo do teste</dt><dd>{trialWindow(item)}</dd></div><div><dt>Motivo</dt><dd>{labels[item.failure_code ?? ""] ?? (item.status === "FAILED" ? "Não registrado" : "—")}</dd></div></dl>
      </li>)}</ul></> : <p>{search ? "Nenhuma tentativa encontrada para esse usuário." : "Nenhuma tentativa nesse filtro."}</p>}
      <p className="dashboard-note">{search ? "Busca em todo o histórico, até 50 resultados. O filtro de período continua nos totais." : "Mostrando até 50 tentativas do período selecionado."} Usuários e motivos passam a aparecer para novos registros após a atualização do banco.</p>
      <p className="dashboard-note">Prazo estimado de 24 horas após a criação. O site ainda não consulta a conta na Zappy; se o usuário assinou depois, esta coluna não informa se a assinatura está ativa.</p>
    </section>
    <section className="dashboard-history"><h2>Falhas por motivo</h2>{stats.reasons.length ? <ul>{stats.reasons.map((item, index) => <li key={`${item.failure_code}-${index}`}>{labels[item.failure_code ?? ""] ?? "Não registrado"}: <strong>{item.total}</strong></li>)}</ul> : <p>Nenhuma falha no período escolhido.</p>}</section>
    <p className="dashboard-note">Os números são de solicitações feitas por este site. Uma tentativa sem confirmação pode ter sido criada no Zappy após um atraso na resposta.</p>
  </div>;
}
