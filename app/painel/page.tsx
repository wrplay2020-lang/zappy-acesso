import { Dashboard } from "./dashboard";

export default function Painel() {
  return <main className="dashboard-page">
    <div className="dashboard-shell">
      <a className="dashboard-back" href="/" target="_top">← Voltar para o site</a>
      <nav className="dashboard-switch" aria-label="Áreas do painel">
        <span className="dashboard-switch-current" aria-current="page">Clientes</span>
        <a href="/painel/revendas" target="_top">Revendas</a>
      </nav>
      <p className="eyebrow">ACESSO RESTRITO</p>
      <h1>Painel de testes</h1>
      <p>Acompanhe os testes criados, as tentativas recentes e os motivos das falhas.</p>
      <Dashboard />
    </div>
  </main>;
}
