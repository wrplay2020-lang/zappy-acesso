import { env } from "cloudflare:workers";

type CatalogItem = { id?: unknown; title?: unknown; synopsis?: unknown; coverUrl?: unknown; publishedAt?: unknown; categories?: unknown; url?: unknown };

export async function GET() {
  const unavailable = (reason: string, upstreamStatus?: number) => Response.json({ items: [], reason, ...(upstreamStatus ? { upstreamStatus } : {}) }, { headers: { "Cache-Control": "no-store" } });
  if (!env.ZAPPY_API_KEY) return unavailable("missing_zappy_key");
  try {
    const response = await fetch("https://onzappy.com/api/v1/reseller/catalog/recent?limit=50", {
      headers: { Authorization: `Bearer ${env.ZAPPY_API_KEY}` },
      signal: AbortSignal.timeout(8000),
      redirect: "error",
    });
    if (!response.ok) return unavailable("zappy_http_error", response.status);
    let body: { success?: boolean; data?: { items?: CatalogItem[] } };
    try { body = await response.json(); } catch { return unavailable("invalid_json"); }
    if (!body.success || !Array.isArray(body.data?.items)) return unavailable("unexpected_catalog_format");
    const items = body.data.items.slice(0, 50).flatMap(item => {
      if (typeof item.id !== "string" || typeof item.title !== "string" || typeof item.coverUrl !== "string" || typeof item.url !== "string") return [];
      try {
        const cover = new URL(item.coverUrl);
        const link = new URL(item.url);
        if (cover.protocol !== "https:" || link.protocol !== "https:" || link.hostname !== "onzappy.com") return [];
        return [{ id: item.id.slice(0, 100), title: item.title.slice(0, 120), synopsis: typeof item.synopsis === "string" ? item.synopsis.slice(0, 240) : "", coverUrl: cover.href, url: link.href, publishedAt: typeof item.publishedAt === "string" ? item.publishedAt : "", categories: Array.isArray(item.categories) ? item.categories.filter((x): x is string => typeof x === "string").slice(0, 3) : [] }];
      } catch { return []; }
    }).sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)).slice(0, 6);
    if (!items.length) return unavailable(body.data.items.length ? "items_filtered" : "catalog_empty");
    return Response.json({ items }, { headers: { "Cache-Control": "public, max-age=300" } });
  } catch {
    return unavailable("network_or_timeout");
  }
}
