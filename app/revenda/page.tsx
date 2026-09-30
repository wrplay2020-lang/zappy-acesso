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
      <div className="reseller-next">
        <h2>Depois do cadastro</h2>
        <p>Guarde seu usuário e sua senha para entrar no painel da Zappy. Sua conta começa sem créditos; quando receber créditos, você poderá criar acessos.</p>
      </div>
    </section>
  </main>;
}
