"use client";

import { useEffect, useRef, useState } from "react";

type Release = { id: string; title: string; synopsis: string; coverUrl: string; url: string; categories: string[]; publishedAt?: string };

export function ReleaseShowcase() {
  const [items, setItems] = useState<Release[]>([]);
  const [current, setCurrent] = useState(0);
  const [catalogUnavailable, setCatalogUnavailable] = useState(false);
  const [paused, setPaused] = useState(false);
  const newestId = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    let loading = false;
    async function refresh() {
      if (!active || loading) return;
      loading = true;
      try {
        const response = await fetch("/api/releases", { cache: "no-store" });
        const body = await response.json() as { items?: Release[] };
        if (!active) return;
        if (!response.ok || !Array.isArray(body.items) || !body.items.length) { setCatalogUnavailable(true); return; }
        setCatalogUnavailable(false);
        if (body.items[0].id !== newestId.current) {
          newestId.current = body.items[0].id;
          setCurrent(0);
        }
        setItems(body.items);
      } catch { if (active) setCatalogUnavailable(true); /* Keep the last successful list on a temporary failure. */ }
      finally { loading = false; }
    }
    void refresh();
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 5 * 60 * 1000);
    const onVisible = () => { if (!document.hidden) void refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { active = false; window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, []);

  useEffect(() => {
    if (items.length < 2 || paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => { if (!document.hidden) setCurrent(index => (index + 1) % items.length); }, 6000);
    return () => window.clearInterval(timer);
  }, [items.length, paused]);

  useEffect(() => {
    if (items.length < 2 || document.hidden) return;
    const next = items[(current + 1) % items.length];
    if (!next?.coverUrl) return;
    const image = new Image();
    image.decoding = "async";
    image.src = next.coverUrl;
  }, [items, current]);

  if (!items.length) return <div className="release-fallback"><a className="promo" href="#teste" aria-label="Criar teste grátis Zappy">
    <img src="/zappy-novidades.jpg" alt="Novidades do Zappy" className="promo-image promo-first"/>
    <img src="/zappy-episodio.jpg" alt="" className="promo-image promo-second"/>
    <img src="/zappy-celular.jpg" alt="" className="promo-image promo-third"/>
  </a>{catalogUnavailable && <p role="status" className="release-unavailable">Lançamentos indisponíveis no momento. Tentaremos atualizar automaticamente.</p>}</div>;

  const item = items[current] ?? items[0];
  return <div className="release-showcase" aria-label="Catálogo do Zappy" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocusCapture={() => setPaused(true)} onBlurCapture={() => setPaused(false)} onTouchStart={() => setPaused(true)} onTouchEnd={() => setPaused(false)} onTouchCancel={() => setPaused(false)}>
    <a className="release-link" href={item.url} target="_blank" rel="noopener noreferrer">
      <img className="release-cover" src={item.coverUrl} alt="" decoding="async" fetchPriority={current === 0 ? "high" : "auto"} onError={event => { if (!event.currentTarget.src.endsWith("/zappy-novidades.jpg")) event.currentTarget.src = "/zappy-novidades.jpg"; }}/>
      <span className="release-caption"><span className="release-badge">CATÁLOGO ZAPPY</span><strong>{item.title}</strong><span className="release-category">{item.categories.join(" · ")}{item.publishedAt && !Number.isNaN(Date.parse(item.publishedAt)) ? ` · Publicado em ${new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "short", year: "numeric" }).format(new Date(item.publishedAt))}` : ""}</span><span className="release-action">Ver no Zappy ↗</span></span>
    </a>
  </div>;
}
