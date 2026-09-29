import { Dashboard } from "./dashboard";
import Link from "next/link";

export default function Painel() {
  return <main className="dashboard-page">
    <div className="dashboard-shell">
      <Link className="dashboard-back" href="/">← Voltar para o site</Link>
      <p className="eyebrow">ACESSO RESTRITO</p>
      <h1>Painel de testes</h1>
      <p>Acompanhe os testes criados, as tentativas recentes e os motivos das falhas.</p>
      <Dashboard />
    </div>
  </main>;
}
