"use client";

import { useEffect, useState } from "react";

type Release = { id: string; title: string; synopsis: string; coverUrl: string; url: string; categories: string[] };

export function ReleaseShowcase() {
  const [items, setItems] = useState<Release[]>([]);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    let active = true;
    fetch("/api/releases").then(response => response.json() as Promise<{ items?: Release[] }>).then(body => {
      if (active && Array.isArray(body.items)) setItems(body.items);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (items.length < 2) return;
    const timer = window.setInterval(() => setCurrent(index => (index + 1) % items.length), 6000);
    return () => window.clearInterval(timer);
  }, [items.length]);

  if (!items.length) return <a className="promo" href="#teste" aria-label="Criar teste grátis Zappy">
    <img src="/zappy-novidades.jpg" alt="Novidades do Zappy" className="promo-image promo-first"/>
    <img src="/zappy-episodio.jpg" alt="" className="promo-image promo-second"/>
    <img src="/zappy-celular.jpg" alt="" className="promo-image promo-third"/>
  </a>;

  const item = items[current] ?? items[0];
  return <div className="release-showcase" aria-label="Lançamentos do Zappy">
    <a className="release-link" href={item.url} target="_blank" rel="noopener noreferrer">
      <img className="release-cover" src={item.coverUrl} alt=""/>
      <span className="release-caption"><span className="release-badge">LANÇAMENTOS</span><strong>{item.title}</strong><span className="release-category">{item.categories.join(" · ")}</span><span className="release-action">Ver no Zappy ↗</span></span>
    </a>
  </div>;
}
