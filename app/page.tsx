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
    <section className="faq" aria-labelledby="faq-title">
      <p className="eyebrow">DÚVIDAS RÁPIDAS</p>
      <h2 id="faq-title">Como funciona o teste?</h2>
      <div className="faq-list">
        <details><summary>Como recebo meu acesso?</summary><p>Preencha seu nome e escolha um usuário. Depois de criar o teste, o login e a senha aparecem nesta página. Copie os dados antes de sair.</p></details>
        <details><summary>Onde posso assistir?</summary><p>Você pode usar o aplicativo no Android, entrar pelo navegador ou abrir o Zappy no Safari do iPhone. Os links aparecem junto com seus dados de acesso.</p></details>
        <details><summary>O que acontece depois das 24 horas?</summary><p>O acesso de teste termina. Se gostar, você pode adicionar 30 dias por R$ 20 via Pix dentro do aplicativo.</p></details>
      </div>
    </section>
  </main>;
}
