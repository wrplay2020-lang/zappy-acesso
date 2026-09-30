import { RevendasDashboard } from "./revendas-dashboard";

export default function Revendas() {
  return <main className="dashboard-page">
    <div className="dashboard-shell">
      <a className="dashboard-back" href="/" target="_top">← Voltar para o site</a>
      <nav className="dashboard-switch" aria-label="Áreas do painel">
        <a href="/painel" target="_top">Clientes</a>
        <span className="dashboard-switch-current" aria-current="page">Revendas</span>
      </nav>
      <p className="eyebrow">ACESSO RESTRITO</p>
      <h1>Sub-revendas</h1>
      <p>Consulte suas sub-revendas, acompanhe créditos e gerencie movimentações pela API da Zappy.</p>
      <RevendasDashboard />
    </div>
  </main>;
}
