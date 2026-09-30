import { ResellerSignupForm } from "./reseller-signup-form";

export default function Revenda() {
  return <main className="site reseller-page">
    <header className="topbar">
      <a href="/" className="logo" aria-label="Zappy, voltar ao início"><span className="logo-z">Z</span> Zappy</a>
      <a href="/" className="login-link">Voltar ao site</a>
    </header>
    <nav className="audience-nav" aria-label="Escolha seu acesso">
      <a href="/" className="audience-link">Para assistir</a>
      <span className="audience-current" aria-current="page">Para revender</span>
    </nav>
    <section className="reseller-content" aria-labelledby="reseller-title">
      <p className="eyebrow">PARA REVENDEDORES</p>
      <h1 id="reseller-title">Venda novelinhas com a <em>Zappy.</em></h1>
      <p className="reseller-intro">Cadastre sua revenda, acesse o painel da Zappy e solicite créditos para começar a atender seus clientes.</p>
      <ResellerSignupForm />
      <div className="reseller-next">
        <h2>Depois do cadastro</h2>
        <p>Guarde seu usuário e sua senha para entrar no painel da Zappy. Sua conta começa sem créditos. Para comprar créditos, fale com o responsável pela sua revenda; depois da recarga, você poderá criar acessos.</p>
      </div>
    </section>
  </main>;
}
