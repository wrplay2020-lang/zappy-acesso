"use client";

import { useEffect, useState } from "react";

type Reseller = { id: string; username: string; displayName: string; creditsBalance: number; status: string; depth: number; canCreateSubresellers: boolean; whatsapp: string; contactPending: boolean };
type SignupAttempt = { username: string; status: string; created_at: number };
type Transaction = { id: string; type: string; amount: number; balanceBefore: number; balanceAfter: number; createdAt: string };
type Page = { page: number; limit: number; total: number };
const date = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(parsed);
};

export function RevendasDashboard() {
  const [key, setKey] = useState("");
  const [ready, setReady] = useState(false);
  const [resellers, setResellers] = useState<Reseller[] | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [signupAttempts, setSignupAttempts] = useState<SignupAttempt[]>([]);
  const [pagination, setPagination] = useState<Page>({ page: 1, limit: 25, total: 0 });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [kind, setKind] = useState<"transfer" | "recall">("transfer");
  const [contactId, setContactId] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  async function request(action: string, fields: Record<string, unknown> = {}, _credential = "") {
    const response = await fetch("/api/admin/resellers", {
      method: "POST", headers: { "Content-Type": "application/json", },
      body: JSON.stringify({ action, ...fields }), cache: "no-store",
    });
    const body = await response.json() as Record<string, unknown> & { error?: string };
    if (!response.ok) {
      if (response.status === 401) setResellers(null);
      throw new Error(body.error ?? "Falha ao consultar a Zappy.");
    }
    return body;
  }

  async function load(_credential = "", page = 1) {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const [accounts, history] = await Promise.all([request("list"), request("transactions", { page })]);
      setResellers(accounts.resellers as Reseller[]);
      setSignupAttempts((accounts.signupAttempts as SignupAttempt[]) ?? []);
      setTransactions(history.transactions as Transaction[]);
      setPagination(history.pagination as Page);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível consultar a Zappy.");
    } finally { setBusy(false); setReady(true); }
  }

  useEffect(() => {
    let active = true;
    void fetch("/api/admin/session", { cache: "no-store" }).then(response => response.json()).then(body => {
      if (active && (body as { authenticated?: boolean }).authenticated) void load();
      else if (active) setReady(true);
    }).catch(() => { if (active) setReady(true); });
    return () => { active = false; };
    // Check the server-side session once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }), cache: "no-store" });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Não foi possível entrar.");
      setKey("");
      setBusy(false);
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível entrar."); }
    finally { setBusy(false); }
  }

  async function logout() {
    try {
      const response = await fetch("/api/admin/session", { method: "DELETE", cache: "no-store" });
      if (!response.ok) throw new Error("Não foi possível sair. Tente novamente.");
      setKey(""); setResellers(null); setTransactions([]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível sair."); }
  }

  async function move(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    const reseller = resellers?.find(item => item.id === selected);
    const verb = kind === "transfer" ? "TRANSFERIR" : "RECOLHER";
    if (!reseller || !window.confirm(`${verb} ${amount} crédito(s) ${kind === "transfer" ? "para" : "de"} ${reseller.displayName} (${reseller.username})? Esta operação altera o saldo.`)) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await request(kind, { resellerId: selected, amount: Number(amount), notes, confirmation: verb });
      setMessage("A Zappy confirmou a movimentação. Consulte o histórico abaixo.");
      setAmount(""); setNotes("");
      const [accounts, history] = await Promise.all([request("list"), request("transactions", { page: 1 })]);
      setResellers(accounts.resellers as Reseller[]);
      setSignupAttempts((accounts.signupAttempts as SignupAttempt[]) ?? []);
      setTransactions(history.transactions as Transaction[]);
      setPagination(history.pagination as Page);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "A Zappy não confirmou. Confira no painel antes de repetir."); }
    finally { setBusy(false); }
  }

  async function saveContact(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !contactId) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await request("saveContact", { resellerId: contactId, whatsapp: contactNumber });
      const accounts = await request("list");
      setResellers(accounts.resellers as Reseller[]);
      setSignupAttempts((accounts.signupAttempts as SignupAttempt[]) ?? []);
      setContactId(""); setContactNumber("");
      setMessage("WhatsApp salvo para contato com a revenda.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar o WhatsApp.");
    } finally { setBusy(false); }
  }

  if (!ready) return <p className="dashboard-note">Carregando…</p>;
  if (!resellers) return <form className="dashboard-login" onSubmit={login}>
    <label htmlFor="reseller-key">Chave do painel</label>
    <input id="reseller-key" type="password" autoComplete="off" value={key} onChange={event => setKey(event.target.value)} required />
    {error && <p role="alert" className="dashboard-error">{error}</p>}
    <button type="submit" disabled={busy}>{busy ? "Carregando…" : "Entrar"}</button>
  </form>;

  const filteredResellers = resellers.filter(item =>
    (statusFilter === "all" || item.status === statusFilter) &&
    (item.displayName + " " + item.username).toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR"))
  );
  const availableStatuses = [...new Set(resellers.map(item => item.status))].sort();

  return <div className="dashboard-results">
    <div className="dashboard-actions"><button type="button" disabled={busy} onClick={() => void load(key, pagination.page)}>Atualizar</button><button type="button" onClick={() => void logout()}>Sair</button></div>
    {error && <p role="alert" className="dashboard-error">{error}</p>}
    {message && <p role="status" className="reseller-admin-success">{message}</p>}
    <section className="dashboard-history">
      <h2>Suas sub-revendas ({resellers.length})</h2>
      <p className="dashboard-note">Saldos informados pela API da Zappy. Contas novas começam com 0 créditos.</p>
      {resellers.length > 0 && <div className="reseller-admin-search"><label htmlFor="reseller-search">Buscar revenda</label><input id="reseller-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Nome ou usuário" autoComplete="off" /><label htmlFor="reseller-status">Situação</label><select id="reseller-status" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="all">Todas</option>{availableStatuses.map(value => <option key={value} value={value}>{value === "ACTIVE" ? "Ativas" : value}</option>)}</select><small>{filteredResellers.length} de {resellers.length} revenda(s)</small></div>}
      {filteredResellers.length ? <ul className="reseller-admin-list">{filteredResellers.map(item => <li key={item.id}>
        <div>
          <strong>{item.displayName}</strong>
          <span>@{item.username} · {item.status} · nível {item.depth}</span>
          <b>{item.creditsBalance} crédito(s)</b>
          <div className="reseller-admin-contact">
            {item.whatsapp ? <>
              <small>WhatsApp: {item.whatsapp}{item.contactPending && <span className="reseller-contact-pending"> · vínculo pendente de confirmação</span>}</small>
              <a className="reseller-admin-whatsapp" href={"https://wa.me/" + (item.whatsapp.length <= 11 ? "55" + item.whatsapp : item.whatsapp)} target="_blank" rel="noopener noreferrer" aria-label={"Conversar com " + item.displayName + " no WhatsApp"}>Conversar ↗</a>
            </> : <small>WhatsApp não informado</small>}
            <button type="button" onClick={() => { setContactId(item.id); setContactNumber(item.whatsapp ?? ""); }}> {item.whatsapp ? "Editar número" : "Adicionar número"}</button>
          </div>
          {contactId === item.id && <form className="reseller-admin-contact-form" onSubmit={saveContact}>
            <label htmlFor={"contact-" + item.id}>WhatsApp com DDD</label>
            <input id={"contact-" + item.id} type="tel" inputMode="tel" value={contactNumber} onChange={event => setContactNumber(event.target.value)} placeholder="11999999999" required />
            <button type="submit" disabled={busy}>{busy ? "Salvando..." : "Salvar WhatsApp"}</button>
          </form>}
        </div>
      </li>)}</ul> : <p>{resellers.length ? "Nenhuma revenda corresponde à busca." : "Nenhuma sub-revenda encontrada."}</p>}
    </section>
    <section className="dashboard-history">
      <h2>Cadastro de novos revendedores</h2>
      <p>A pessoa cria a conta pelo site. Os cadastros novos com WhatsApp aparecem na lista acima. Ela começa com 0 créditos até você carregar.</p>
      <a className="reseller-admin-entry" href="/revenda">Ver página pública de revenda →</a>
    </section>
    <section className="dashboard-history">
      <h2>Cadastros recentes</h2>
      <p className="dashboard-note">Tentativas feitas pela página de revenda. “Sem confirmação” exige conferir o usuário na Zappy antes de repetir.</p>
      {signupAttempts.length ? <ul className="reseller-admin-transactions-list">{signupAttempts.map((item, index) => <li key={item.username + item.created_at + index}>
        <div className="reseller-admin-transaction-head"><strong>@{item.username}</strong><span>{date(new Date(item.created_at).toISOString())}</span></div>
        <div className="reseller-admin-transaction-details"><span>{({ CREATED: "Conta criada", FAILED: "Cadastro falhou", CREATING: "Sem confirmação" } as Record<string, string>)[item.status] ?? item.status}</span></div>
      </li>)}</ul> : <p>Nenhum cadastro registrado neste site.</p>}
    </section>
    <section className="dashboard-history">
      <h2>Movimentar créditos</h2>
      <form className="reseller-admin-form" onSubmit={move}>
        <label>Operação<select value={kind} onChange={event => setKind(event.target.value as "transfer" | "recall")}><option value="transfer">Transferir créditos</option><option value="recall">Recolher créditos</option></select></label>
        <label>Sub-revenda<select value={selected} onChange={event => setSelected(event.target.value)} required><option value="">Selecione</option>{resellers.map(item => <option key={item.id} value={item.id}>{item.displayName} (@{item.username}) · {item.creditsBalance} créditos</option>)}</select></label>
        <label>Quantidade<input value={amount} onChange={event => setAmount(event.target.value)} type="number" min={1} max={100000} step={1} required /></label>
        <label>Observação (opcional)<input value={notes} onChange={event => setNotes(event.target.value)} maxLength={150} /></label>
        <button type="submit" disabled={busy || !resellers.length}>{kind === "transfer" ? "Transferir créditos" : "Recolher créditos"}</button>
      </form>
      <p className="dashboard-note">Confirme a sub-revenda e a quantidade antes de enviar. Se a resposta falhar, confira a movimentação na Zappy antes de repetir.</p>
    </section>
    <section className="dashboard-history">
      <h2>Movimentações</h2>
      {transactions.length ? <ul className="reseller-admin-transactions-list">{transactions.map(item => <li key={item.id}>
        <div className="reseller-admin-transaction-head"><strong>{({ USER_RENEWAL: "Renovação", USER_ACTIVATION: "Ativação", RESELLER_TRANSFER: "Transferência", RESELLER_RECALL: "Recolhimento" } as Record<string, string>)[item.type] ?? item.type.replaceAll("_", " ")}</strong><span>{date(item.createdAt)}</span></div>
        <div className="reseller-admin-transaction-details"><span>Quantidade: <b>{item.amount}</b></span><span>Saldo: {item.balanceBefore} → <b>{item.balanceAfter}</b></span></div>
      </li>)}</ul> : <p>Sem movimentações nesta página.</p>}
      <div className="reseller-admin-pagination"><button type="button" disabled={busy || pagination.page <= 1} onClick={() => void load(key, pagination.page - 1)}>Anterior</button><span>Página {pagination.page} · {pagination.total} registros</span><button type="button" disabled={busy || pagination.page * pagination.limit >= pagination.total} onClick={() => void load(key, pagination.page + 1)}>Próxima</button></div>
    </section>
  </div>;
}
