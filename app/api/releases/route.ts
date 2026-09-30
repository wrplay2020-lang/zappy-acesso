import { env } from "cloudflare:workers";

type CatalogItem = { id?: unknown; title?: unknown; synopsis?: unknown; coverUrl?: unknown; publishedAt?: unknown; categories?: unknown; url?: unknown };

export async function GET() {
  const configured = env.ZAPPY_RELEASES_URL;
  if (!configured) return Response.json({ items: [] }, { headers: { "Cache-Control": "no-store" } });
  let source: URL;
  try {
    source = new URL(configured);
    if (source.protocol !== "https:" || source.hostname !== "onzappy.com" || source.username || source.password) throw new Error("Invalid catalog URL");
    const response = await fetch(source, {
      headers: env.ZAPPY_CATALOG_API_KEY ? { Authorization: `Bearer ${env.ZAPPY_CATALOG_API_KEY}` } : {},
      signal: AbortSignal.timeout(8000),
      redirect: "error",
    });
    if (!response.ok) throw new Error("Catalog request failed");
    const body = await response.json() as { success?: boolean; data?: { items?: CatalogItem[] } };
    if (!body.success || !Array.isArray(body.data?.items)) throw new Error("Invalid catalog response");
    const items = body.data.items.slice(0, 50).flatMap(item => {
      if (typeof item.id !== "string" || typeof item.title !== "string" || typeof item.coverUrl !== "string" || typeof item.url !== "string") return [];
      try {
        const cover = new URL(item.coverUrl);
        const link = new URL(item.url);
        if (cover.protocol !== "https:" || link.protocol !== "https:" || link.hostname !== "onzappy.com") return [];
        return [{ id: item.id.slice(0, 100), title: item.title.slice(0, 120), synopsis: typeof item.synopsis === "string" ? item.synopsis.slice(0, 240) : "", coverUrl: cover.href, url: link.href, publishedAt: typeof item.publishedAt === "string" ? item.publishedAt : "", categories: Array.isArray(item.categories) ? item.categories.filter((x): x is string => typeof x === "string").slice(0, 3) : [] }];
      } catch { return []; }
    }).sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)).slice(0, 6);
    return Response.json({ items }, { headers: { "Cache-Control": "public, max-age=300" } });
  } catch {
    return Response.json({ items: [] }, { headers: { "Cache-Control": "no-store" } });
  }
}
