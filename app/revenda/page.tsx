import Link from "next/link";

const signupUrl = "https://onzappy.com/signup/reseller?ref=on1F5x_sBqvcKYKA0SkWifC5";

export default function Revenda() {
  return <main className="site reseller-page">
    <header className="topbar">
      <Link href="/" className="logo" aria-label="Zappy, início"><span className="logo-z">Z</span><span>Zappy</span></Link>
      <Link href="/" className="login-link">Voltar ao site</Link>
    </header>
    <section className="reseller-content" aria-labelledby="reseller-title">
      <p className="eyebrow">PARA REVENDEDORES</p>
      <h1 id="reseller-title">Venda novelinhas com a <em>Zappy.</em></h1>
      <p className="reseller-intro">Crie sua sub-revenda pelo convite e gerencie seus acessos no painel da Zappy.</p>
      <ul className="reseller-benefits">
        <li><strong>Painel de revenda</strong><span>Organize seus acessos em um só lugar.</span></li>
        <li><strong>Crie acessos</strong><span>Atenda novos clientes pelo painel.</span></li>
        <li><strong>Acompanhe clientes</strong><span>Consulte as informações da sua revenda.</span></li>
      </ul>
      <div className="reseller-steps">
        <h2>Como começar</h2>
        <ol>
          <li><strong>Abra o convite</strong><span>Você será levado ao cadastro da Zappy.</span></li>
          <li><strong>Crie sua sub-revenda</strong><span>Preencha os dados solicitados pela plataforma.</span></li>
          <li><strong>Acesse seu painel</strong><span>Siga as orientações da Zappy para iniciar.</span></li>
        </ol>
      </div>
      <a className="reseller-cta" href={signupUrl} target="_blank" rel="noopener noreferrer">Quero ser revendedor <span aria-hidden="true">↗</span></a>
      <p className="reseller-note">O cadastro abre no site oficial da Zappy. Confira as condições antes de concluir.</p>
    </section>
  </main>;
}
