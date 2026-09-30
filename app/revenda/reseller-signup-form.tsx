"use client";
import { useEffect, useRef, useState } from "react";
import { Check, Copy, Eye, EyeOff } from "lucide-react";

type TurnstileApi = { render: (element: HTMLElement, options: { sitekey: string; theme: string; action: string; callback: (token: string) => void; "expired-callback": () => void; "error-callback": () => void }) => string; reset: (id: string) => void; remove: (id: string) => void };
declare global { interface Window { turnstile?: TurnstileApi } }

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-reseller-turnstile]');
    if (existing) {
      const check = window.setInterval(() => { if (window.turnstile) { window.clearInterval(check); resolve(window.turnstile); } }, 100);
      window.setTimeout(() => { window.clearInterval(check); if (!window.turnstile) reject(new Error("Verificação indisponível.")); }, 8000);
      return;
    }
    const script = document.createElement("script");
    script.dataset.resellerTurnstile = "true";
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onload = () => window.turnstile ? resolve(window.turnstile) : reject(new Error("Verificação indisponível."));
    script.onerror = () => reject(new Error("Verificação indisponível."));
    document.head.appendChild(script);
  });
}

export function ResellerSignupForm() {
  const [siteKey, setSiteKey] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [securityError, setSecurityError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [access, setAccess] = useState<{ username: string; password: string } | null>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const submitting = useRef(false);
  const usernameRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/site-config", { cache: "no-store" })
      .then(async response => { if (!response.ok) throw new Error(); return response.json() as Promise<{ turnstileSiteKey: string | null }>; })
      .then(config => { if (!cancelled) { if (config.turnstileSiteKey) setSiteKey(config.turnstileSiteKey); else setSecurityError("Cadastro temporariamente indisponível. Tente novamente mais tarde."); } })
      .catch(() => { if (!cancelled) setSecurityError("Não foi possível carregar a verificação. Atualize a página."); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!siteKey || !widgetRef.current) return;
    let cancelled = false;
    loadTurnstile().then(api => {
      if (cancelled || !widgetRef.current) return;
      widgetId.current = api.render(widgetRef.current, {
        sitekey: siteKey, theme: "light", action: "reseller",
        callback: value => { setToken(value); setSecurityError(""); },
        "expired-callback": () => setToken(""),
        "error-callback": () => { setToken(""); setSecurityError("A verificação falhou. Atualize a página."); },
      });
    }).catch(() => { if (!cancelled) setSecurityError("Não foi possível carregar a verificação. Atualize a página."); });
    return () => { cancelled = true; if (widgetId.current) { window.turnstile?.remove(widgetId.current); widgetId.current = null; } };
  }, [siteKey]);

  useEffect(() => { if (access) headingRef.current?.focus(); }, [access]);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    if (!siteKey || !token || securityError) { setError("Conclua a verificação de segurança antes de criar a conta."); return; }
    const data = new FormData(event.currentTarget);
    const username = String(data.get("username") ?? "").trim().toLowerCase();
    const password = String(data.get("password") ?? "");
    submitting.current = true; setBusy(true); setError("");
    try {
      const response = await fetch("/api/reseller-signup", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: data.get("displayName"), username, password, whatsapp: data.get("whatsapp"), turnstileToken: token }),
      });
      const result = await response.json() as { success?: boolean; username?: string; error?: string; code?: string };
      if (!response.ok || !result.success) {
        if (result.code === "username_taken") { usernameRef.current?.focus(); usernameRef.current?.select(); }
        throw new Error(result.error ?? "Não foi possível criar a conta. Tente novamente.");
      }
      setAccess({ username: result.username ?? username, password });
    } catch (cause) {
      setError(cause instanceof TypeError ? "A conexão caiu. Aguarde antes de tentar novamente para evitar um cadastro duplicado." : cause instanceof Error ? cause.message : "Tente novamente mais tarde.");
    } finally {
      submitting.current = false; setBusy(false);
      if (widgetId.current) window.turnstile?.reset(widgetId.current);
      setToken("");
    }
  }

  async function copy() {
    if (!access) return;
    try {
      await navigator.clipboard.writeText("Usuário: " + access.username + "\nSenha: " + access.password);
      setCopied(true);
    } catch { setError("Não foi possível copiar automaticamente. Anote os dados exibidos."); }
  }

  if (access) return <section className="reseller-form-card" aria-labelledby="reseller-success">
    <p className="card-eyebrow">CONTA CRIADA</p>
    <h2 id="reseller-success" ref={headingRef} tabIndex={-1}><Check size={26} aria-hidden="true" /> Sua revenda está pronta</h2>
    <p>Guarde o usuário e a senha escolhidos. Estes dados não aparecerão novamente depois que sair da página.</p>
    <div className="reseller-access-row"><span>Usuário</span><strong>{access.username}</strong></div>
    <div className="reseller-access-row"><span>Senha</span><strong>{showPassword ? access.password : "••••••••••••"}</strong><button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>{showPassword ? <EyeOff size={19}/> : <Eye size={19}/>}</button></div>
    <button className="reseller-submit" type="button" onClick={copy}><Copy size={19}/> {copied ? "Dados copiados" : "Copiar usuário e senha"}</button>
    <a className="reseller-panel-link" href="https://onzappy.com/login" target="_blank" rel="noopener noreferrer">Entrar no painel da Zappy ↗</a>
    {error && <p className="reseller-error" role="alert">{error}</p>}
    <p className="reseller-note">A conta começa com zero créditos. Para criar acessos, aguarde receber créditos.</p>
  </section>;

  return <section className="reseller-form-card" aria-labelledby="reseller-form-title">
    <p className="card-eyebrow">COMECE AGORA</p>
    <h2 id="reseller-form-title">Crie sua revenda</h2>
    <p>Preencha os dados abaixo para abrir sua conta.</p>
    <form onSubmit={create} className="reseller-signup-form">
      <label>Nome comercial<input name="displayName" required minLength={3} maxLength={90} autoComplete="organization" placeholder="Nome da sua revenda" /></label>
      <label>Usuário<input ref={usernameRef} name="username" required minLength={4} maxLength={32} pattern="[A-Za-z0-9_]{4,32}" autoCapitalize="none" autoCorrect="off" autoComplete="username" placeholder="sua_revenda" /><small>4 a 32 letras, números ou _; sem espaços e acentos.</small></label>
      <label>Senha<input name="password" required minLength={6} maxLength={100} type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="Pelo menos 6 caracteres" /><button className="reseller-show" type="button" onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>} {showPassword ? "Ocultar" : "Mostrar"}</button></label>
      <label>WhatsApp <span>(opcional)</span><input name="whatsapp" type="tel" inputMode="tel" autoComplete="tel" placeholder="DDD + número" /></label>
      <div ref={widgetRef} className="reseller-turnstile" aria-label="Verificação de segurança" />
      {securityError && <p className="reseller-error" role="alert">{securityError}</p>}
      {error && <p className="reseller-error" role="alert">{error}</p>}
      <button className="reseller-submit" disabled={busy || !siteKey || !token || !!securityError} type="submit">{busy ? "Criando conta..." : "Criar conta de revendedor"}</button>
      <p className="reseller-note">O cadastro é gratuito. A conta começa sem créditos e sem testes.</p>
    </form>
  </section>;
}
