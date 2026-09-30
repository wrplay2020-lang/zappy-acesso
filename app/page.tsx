import { TrialForm } from "./trial-form";
import Link from "next/link";
import { ReleaseShowcase } from "./release-showcase";

export default function Home() {
  return <main className="site">
    <header className="topbar">
      <Link href="/" className="logo" aria-label="Zappy, início"><span className="logo-z">Z</span><span>Zappy</span></Link>
      <a href="https://onzappy.com/login" target="_blank" rel="noopener noreferrer" className="login-link">Já tenho acesso</a>
    </header>
    <section className="experience" aria-labelledby="page-title">
      <div className="hero-copy">
        <p className="eyebrow">NOVELINHAS NO CELULAR</p>
        <h1 id="page-title">Sua próxima história <em>começa aqui.</em></h1>
        <p className="intro">Descubra histórias de romance, drama e suspense em episódios curtos.</p>
        <ul className="site-highlights" aria-label="Destaques do Zappy">
          <li><strong>Milhares de novelinhas</strong><span>para descobrir</span></li>
          <li><strong>Assista no celular</strong><span>onde preferir</span></li>
          <li><strong>Teste grátis</strong><span>por 24 horas</span></li>
        </ul>
        <TrialForm/>
        <p className="after-trial">Gostou? Adicione 30 dias por <strong>R$ 20 via Pix</strong> dentro do app.</p>
      </div>
      <ReleaseShowcase/>
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
