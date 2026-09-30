import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zappy | Seu acesso",
  description: "Crie seu acesso grátis ao Zappy, assista no celular e continue pelo aplicativo ou navegador.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <head><link rel="preconnect" href="https://onzappy.com" crossOrigin="anonymous" /></head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
