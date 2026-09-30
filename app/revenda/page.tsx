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
      <p className="reseller-intro">Cadastre sua sub-revenda sob Wrplay no site da Zappy. Sua conta começa com 0 créditos e sem testes até receber créditos do superior.</p>
      <ul className="reseller-benefits">
        <li><strong>Painel de revenda</strong><span>Organize seus acessos em um só lugar.</span></li>
        <li><strong>Ative após receber créditos</strong><span>Comece a criar acessos quando Wrplay carregar sua conta.</span></li>
        <li><strong>Acompanhe clientes</strong><span>Consulte os acessos da sua revenda pelo painel.</span></li>
      </ul>
      <div className="reseller-steps">
        <h2>Como começar</h2>
        <ol>
          <li><strong>Abra o convite</strong><span>Você será levado ao cadastro da Zappy.</span></li>
          <li><strong>Crie sua sub-revenda</strong><span>Preencha os dados solicitados pela plataforma.</span></li>
          <li><strong>Aguarde os créditos</strong><span>Você começa com 0 créditos e sem testes até Wrplay carregar sua conta.</span></li>
        </ol>
      </div>
      <a className="reseller-cta" href={signupUrl} target="_blank" rel="noopener noreferrer">Quero ser revendedor <span aria-hidden="true">↗</span></a>
      <p className="reseller-note">O cadastro abre no site da Zappy sob Wrplay. Não há créditos nem testes incluídos no cadastro.</p>
    </section>
  </main>;
}
