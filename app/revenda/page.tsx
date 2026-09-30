import Link from "next/link";
import { ResellerSignupForm } from "./reseller-signup-form";

export default function Revenda() {
  return <main className="site reseller-page">
    <header className="topbar">
      <Link href="/" className="logo" aria-label="Zappy, voltar ao início"><span className="logo-z">Z</span> Zappy</Link>
      <Link href="/" className="login-link">Voltar ao site</Link>
    </header>
    <section className="reseller-content" aria-labelledby="reseller-title">
      <p className="eyebrow">PARA REVENDEDORES</p>
      <h1 id="reseller-title">Venda novelinhas com a <em>Zappy.</em></h1>
      <p className="reseller-intro">Crie sua conta de revendedor aqui. Depois do cadastro, você poderá entrar no painel da Zappy.</p>
      <ResellerSignupForm />
      <div className="reseller-steps">
        <h2>Como funciona</h2>
        <ol>
          <li><strong>Crie sua conta</strong><span>Escolha o nome da revenda, o usuário e a senha nesta página.</span></li>
          <li><strong>Entre no painel</strong><span>Guarde seus dados e acesse o painel de revendedor da Zappy.</span></li>
          <li><strong>Receba créditos</strong><span>A conta começa com zero créditos. Você poderá criar acessos depois que receber créditos.</span></li>
        </ol>
      </div>
    </section>
  </main>;
}
