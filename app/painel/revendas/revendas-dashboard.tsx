"use client";

import { useEffect, useState } from "react";

type Reseller = { id: string; username: string; displayName: string; creditsBalance: number; status: string; depth: number; canCreateSubresellers: boolean };
type Transaction = { id: string; type: string; amount: number; balanceBefore: number; balanceAfter: number; createdAt: string };
type Page = { page: number; limit: number; total: number };
const savedKey = "zappy-dashboard-key";
const date = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(parsed);
};

export function RevendasDashboard() {
  const [key, setKey] = useState("");
  const [ready, setReady] = useState(false);
  const [resellers, setResellers] = useState<Reseller[] | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pagination, setPagination] = useState<Page>({ page: 1, limit: 25, total: 0 });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [selected, setSelected] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [kind, setKind] = useState<"transfer" | "recall">("transfer");

  async function request(action: string, fields: Record<string, unknown> = {}, credential = key) {
    const response = await fetch("/api/admin/resellers", {
      method: "POST", headers: { "Content-Type": "application/json", "X-Dashboard-Key": credential },
      body: JSON.stringify({ action, ...fields }), cache: "no-store",
    });
    const body = await response.json() as Record<string, unknown> & { error?: string };
    if (!response.ok) {
      if (response.status === 401) sessionStorage.removeItem(savedKey);
      throw new Error(body.error ?? "Falha ao consultar a Zappy.");
    }
    return body;
  }

  async function load(credential = key, page = 1) {
    if (!credential || busy) return;
    setBusy(true); setError("");
    try {
      const [accounts, history] = await Promise.all([request("list", {}, credential), request("transactions", { page }, credential)]);
      setResellers(accounts.resellers as Reseller[]);
      setTransactions(history.transactions as Transaction[]);
      setPagination(history.pagination as Page);
      setKey(credential);
      sessionStorage.setItem(savedKey, credential);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível consultar a Zappy.");
    } finally { setBusy(false); setReady(true); }
  }

  useEffect(() => {
    const value = sessionStorage.getItem(savedKey);
    queueMicrotask(() => { if (value) { setKey(value); void load(value); } else setReady(true); });
    // Read the key from this browser tab once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!window.confirm(`Criar a sub-revenda ${displayName} (${username}) sob sua conta? A conta começa sem créditos.`)) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await request("create", { username, password, displayName, whatsapp });
      setPassword(""); setUsername(""); setDisplayName(""); setWhatsapp("");
      setMessage("Conta criada pela Zappy. Entregue a senha ao revendedor e confira a conta na lista.");
      const accounts = await request("list");
      setResellers(accounts.resellers as Reseller[]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "A Zappy não confirmou. Confira no painel antes de repetir."); }
    finally { setBusy(false); }
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
      setTransactions(history.transactions as Transaction[]);
      setPagination(history.pagination as Page);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "A Zappy não confirmou. Confira no painel antes de repetir."); }
    finally { setBusy(false); }
  }

  if (!ready) return <p className="dashboard-note">Carregando…</p>;
  if (!resellers) return <form className="dashboard-login" onSubmit={event => { event.preventDefault(); void load(key); }}>
    <label htmlFor="reseller-key">Chave do painel</label>
    <input id="reseller-key" type="password" autoComplete="off" value={key} onChange={event => setKey(event.target.value)} required />
    {error && <p role="alert" className="dashboard-error">{error}</p>}
    <button type="submit" disabled={busy}>{busy ? "Carregando…" : "Entrar"}</button>
  </form>;

  return <div className="dashboard-results">
    <div className="dashboard-actions"><button type="button" disabled={busy} onClick={() => void load(key, pagination.page)}>Atualizar</button><button type="button" onClick={() => { sessionStorage.removeItem(savedKey); setKey(""); setResellers(null); setTransactions([]); }}>Sair</button></div>
    {error && <p role="alert" className="dashboard-error">{error}</p>}
    {message && <p role="status" className="reseller-admin-success">{message}</p>}
    <section className="dashboard-history">
      <h2>Suas sub-revendas ({resellers.length})</h2>
      <p className="dashboard-note">Saldos informados pela API da Zappy. Contas novas começam com 0 créditos.</p>
      {resellers.length ? <ul className="reseller-admin-list">{resellers.map(item => <li key={item.id}><div><strong>{item.displayName}</strong><span>@{item.username} · {item.status} · nível {item.depth}</span></div><b>{item.creditsBalance} crédito(s)</b></li>)}</ul> : <p>Nenhuma sub-revenda encontrada.</p>}
    </section>
    <section className="dashboard-history">
      <h2>Criar sub-revenda</h2>
      <p className="dashboard-note">A conta é criada sob sua revenda, sem créditos. Guarde a senha escolhida e entregue-a ao novo revendedor por um canal privado.</p>
      <form className="reseller-admin-form" onSubmit={create}>
        <label>Nome comercial<input value={displayName} onChange={event => setDisplayName(event.target.value)} minLength={3} maxLength={90} required /></label>
        <label>Usuário<input value={username} onChange={event => setUsername(event.target.value)} minLength={4} maxLength={32} pattern="[a-zA-Z0-9_]+" autoComplete="off" required /></label>
        <label>Senha inicial<input value={password} onChange={event => setPassword(event.target.value)} type="password" minLength={6} maxLength={100} autoComplete="new-password" required /></label>
        <label>WhatsApp (opcional)<input value={whatsapp} onChange={event => setWhatsapp(event.target.value)} placeholder="5511999999999" inputMode="numeric" /></label>
        <button type="submit" disabled={busy}>Criar sub-revenda</button>
      </form>
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
      {transactions.length ? <div className="dashboard-table-wrap reseller-admin-transactions"><table><thead><tr><th>Data</th><th>Tipo</th><th>Quantidade</th><th>Saldo anterior</th><th>Saldo depois</th></tr></thead><tbody>{transactions.map(item => <tr key={item.id}><td>{date(item.createdAt)}</td><td>{item.type}</td><td>{item.amount}</td><td>{item.balanceBefore}</td><td>{item.balanceAfter}</td></tr>)}</tbody></table></div> : <p>Sem movimentações nesta página.</p>}
      <div className="reseller-admin-pagination"><button type="button" disabled={busy || pagination.page <= 1} onClick={() => void load(key, pagination.page - 1)}>Anterior</button><span>Página {pagination.page} · {pagination.total} registros</span><button type="button" disabled={busy || pagination.page * pagination.limit >= pagination.total} onClick={() => void load(key, pagination.page + 1)}>Próxima</button></div>
    </section>
  </div>;
}
