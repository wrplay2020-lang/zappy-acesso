"use client";
import { useEffect, useRef, useState } from "react";
import { YellowRobot } from "./yellow-robot";

type Access = { username: string; password: string; expiresAt?: string; login: string; android: string };
type TurnstileApi = { render: (element: HTMLElement, options: { sitekey: string; theme: string; action: string; callback: (token: string) => void; "expired-callback": () => void; "error-callback": () => void }) => string; reset: (id: string) => void; remove: (id: string) => void };
declare global { interface Window { turnstile?: TurnstileApi } }

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onload = () => window.turnstile ? resolve(window.turnstile) : reject(new Error("Verificação indisponível."));
    script.onerror = () => reject(new Error("Verificação indisponível."));
    document.head.appendChild(script);
  });
}

export function TrialForm() {
  const [access, setAccess] = useState<Access | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [usernameTaken, setUsernameTaken] = useState(false);
  const usernameRef = useRef<HTMLInputElement>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [siteKey, setSiteKey] = useState<string | null>(null);
  const [securityReady, setSecurityReady] = useState(false);
  const [securityError, setSecurityError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/site-config", { cache: "no-store" })
      .then(async response => { if (!response.ok) throw new Error(); return response.json() as Promise<{ turnstileSiteKey: string | null }>; })
      .then(config => { if (!cancelled) { setSiteKey(config.turnstileSiteKey); setSecurityReady(true); } })
      .catch(() => { if (!cancelled) setSecurityError("Não foi possível carregar o formulário. Atualize a página."); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!siteKey || !widgetRef.current) return;
    let cancelled = false;
    loadTurnstile().then(api => {
      if (cancelled || !widgetRef.current) return;
      widgetIdRef.current = api.render(widgetRef.current, {
        sitekey: siteKey, theme: "light", action: "trial",
        callback: token => { setTurnstileToken(token); setSecurityError(""); },
        "expired-callback": () => setTurnstileToken(""),
        "error-callback": () => { setTurnstileToken(""); setSecurityError("A verificação falhou. Atualize a página e tente novamente."); },
      });
    }).catch(() => { if (!cancelled) setSecurityError("Não foi possível carregar a verificação. Atualize a página."); });
    return () => { cancelled = true; if (widgetIdRef.current) { window.turnstile?.remove(widgetIdRef.current); widgetIdRef.current = null; } };
  }, [siteKey]);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!securityReady || securityError || (siteKey && !turnstileToken)) {
      setError("Aguarde a verificação de segurança antes de criar o teste.");
      return;
    }
    setBusy(true); setError(""); setUsernameTaken(false);
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/trial", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: data.get("name"), username: String(data.get("username") ?? "").toLowerCase(), turnstileToken }),
      });
      const result = await response.json() as Access & { error?: string; code?: string };
      if (!response.ok) {
        if (response.status === 409 && result.code === "username_taken") {
          setUsernameTaken(true);
          setError("Esse usuário já está em uso. Escolha outro nome e tente novamente.");
          usernameRef.current?.focus();
          return;
        }
        throw new Error(result.error ?? "Não foi possível criar o teste.");
      }
      setAccess(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Tente novamente mais tarde.");
    } finally {
      setBusy(false);
      if (siteKey && widgetIdRef.current) { window.turnstile?.reset(widgetIdRef.current); setTurnstileToken(""); }
    }
  }

  if (access) return <div className="trial-card" id="teste">
    <p className="card-eyebrow">TUDO PRONTO</p><h2>Seu acesso está criado</h2>
    <p>Use estes dados para entrar no Zappy. Guarde o login e a senha em um lugar seguro.</p>
    <div className="trial-credential"><span>Usuário</span><strong>{access.username}</strong></div>
    <div className="trial-credential"><span>Senha</span><div className="password-row"><strong>{showPassword ? access.password : "•".repeat(access.password.length)}</strong><button type="button" className="password-toggle" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} aria-pressed={showPassword}>{showPassword ? "Ocultar" : "Mostrar"}</button></div></div>
    {access.expiresAt && <p className="trial-expiry">Teste válido até {new Date(access.expiresAt).toLocaleString("pt-BR")}.</p>}
    <button type="button" onClick={async () => { await navigator.clipboard.writeText(`Login: ${access.username}\nSenha: ${access.password}`); setCopied(true); }}>{copied ? "Dados copiados" : "Copiar login e senha"}</button>
    <p className="access-heading">Agora escolha onde assistir:</p>
    <ol className="first-steps"><li>Copie e guarde seu login e senha.</li><li>Escolha abaixo o seu aparelho.</li><li>Entre no Zappy com esses dados e aproveite as 24 horas.</li></ol>
    <a href={access.android} target="_blank" rel="noopener noreferrer"><span className="access-label"><YellowRobot/> Android · Baixar aplicativo</span></a>
    <a href={access.login} target="_blank" rel="noopener noreferrer">🌐 Navegador · Entrar online</a>
    <a href="https://onzappy.com" target="_blank" rel="noopener noreferrer">🍎 iPhone · Abrir no Safari</a>
  </div>;
  return <><div className="trial-card" id="teste">
    <p className="card-eyebrow">COMECE AGORA</p><h2>Crie seu acesso</h2>
    <p>Informe seu nome, escolha um usuário e receba sua senha na hora.</p>
    <form onSubmit={create}>
      <label htmlFor="trial-name">Seu nome</label>
      <input id="trial-name" name="name" type="text" autoComplete="name" placeholder="Digite seu nome" required minLength={3} maxLength={90}/>
      <label htmlFor="trial-username">Escolha seu usuário</label>
      <input ref={usernameRef} id="trial-username" name="username" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="Ex.: joaosilva" required minLength={4} maxLength={20} pattern="[a-zA-Z0-9_]{4,20}" title="Use de 4 a 20 letras, números ou _; sem espaços e acentos" aria-describedby={usernameTaken ? "username-help trial-error" : "username-help"} aria-invalid={usernameTaken} onChange={() => { if (usernameTaken) { setUsernameTaken(false); setError(""); } }}/>
      <span className="field-help" id="username-help">4 a 20 caracteres, sem espaços ou acentos.</span>
      {error && <p className="trial-error" id="trial-error" role="alert">{error}</p>}
      {siteKey && <div className="turnstile-container" ref={widgetRef} aria-label="Verificação de segurança"/>}
      {securityError && <p className="trial-error" role="alert">{securityError}</p>}
      <button type="submit" disabled={busy || !securityReady || !!securityError || (!!siteKey && !turnstileToken)}>{busy ? "Criando seu acesso…" : "Criar teste grátis"}</button>
    </form>
    <small>Depois do teste, você pode adicionar 30 dias por R$ 20 via Pix dentro do app.</small>
  </div>
    <p className="platform-title">Assista onde preferir</p>
    <nav className="platform-links" aria-label="Onde assistir ao Zappy">
      <a href="https://onzappy.com/download" target="_blank" rel="noopener noreferrer"><YellowRobot/> Android</a>
      <a href="https://onzappy.com/login" target="_blank" rel="noopener noreferrer">🌐 Navegador</a>
      <a href="https://onzappy.com" target="_blank" rel="noopener noreferrer">🍎 iPhone</a>
    </nav>
  </>;
}
