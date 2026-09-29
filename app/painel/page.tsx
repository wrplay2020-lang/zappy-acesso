import { Dashboard } from "./dashboard";
import Link from "next/link";

export default function Painel() {
  return <main className="dashboard-page">
    <div className="dashboard-shell">
      <Link className="dashboard-back" href="/">← Voltar para o site</Link>
      <p className="eyebrow">ACESSO RESTRITO</p>
      <h1>Painel de testes</h1>
      <p>Veja quantos testes foram criados nas últimas 24 horas e nos últimos 7 dias.</p>
      <Dashboard />
    </div>
  </main>;
}
