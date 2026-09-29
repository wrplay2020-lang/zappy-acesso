import { TrialForm } from "./trial-form";

export default function Home() {
  return <main className="site">
    <header className="topbar">
      <a href="/" className="logo" aria-label="Zappy, início"><span className="logo-z">Z</span><span>Zappy</span></a>
      <a href="https://onzappy.com/login" target="_blank" rel="noopener noreferrer" className="login-link">Já tenho acesso</a>
    </header>
    <section className="experience" aria-labelledby="page-title">
      <div className="hero-copy">
        <p className="eyebrow">NOVELINHAS NO CELULAR</p>
        <h1 id="page-title">Sua próxima história <em>começa aqui.</em></h1>
        <p className="intro">Crie seu acesso e assista grátis por 24 horas.</p>
        <TrialForm/>
        <p className="after-trial">Gostou? Adicione 30 dias por <strong>R$ 20 via Pix</strong> dentro do app.</p>
      </div>
      <a className="promo" href="#teste" aria-label="Criar teste grátis Zappy">
        <img src="/zappy-novidades.jpg" alt="Novidades do Zappy" className="promo-image promo-first"/>
        <img src="/zappy-episodio.jpg" alt="" className="promo-image promo-second"/>
        <img src="/zappy-celular.jpg" alt="" className="promo-image promo-third"/>
      </a>
    </section>
  </main>;
}
