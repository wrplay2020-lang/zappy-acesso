import Link from "next/link";
import { RevendasDashboard } from "./revendas-dashboard";

export default function Revendas() {
  return <main className="dashboard-page">
    <div className="dashboard-shell">
      <Link className="dashboard-back" href="/painel">← Painel de testes</Link>
      <p className="eyebrow">ACESSO RESTRITO</p>
      <h1>Sub-revendas</h1>
      <p>Consulte suas sub-revendas, acompanhe créditos e gerencie movimentações pela API da Zappy.</p>
      <RevendasDashboard />
    </div>
  </main>;
}
