import { env } from "cloudflare:workers";

const allowedParams = new Set(["query", "language", "append_to_response", "region"]);
const requestCounts = new Map<string, { count: number; expires: number }>();

function overLimit(ip: string) {
  const now = Date.now();
  for (const [key, value] of requestCounts) if (value.expires <= now) requestCounts.delete(key);
  const current = requestCounts.get(ip);
  if (!current || current.expires <= now) {
    requestCounts.set(ip, { count: 1, expires: now + 60_000 });
    return false;
  }
  current.count += 1;
  return current.count > 60;
}

export async function GET(request: Request) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  if (overLimit(ip)) {
    return Response.json({ error: "Muitas buscas em pouco tempo. Aguarde um minuto e tente novamente." }, {
      status: 429,
      headers: { "Cache-Control": "no-store", "Retry-After": "60" },
    });
  }

  const key = env.TMDB_API_KEY?.trim();
  if (!key) {
    return Response.json({ error: "A busca do TMDB ainda não foi configurada no servidor." }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const incoming = new URL(request.url);
  const path = incoming.searchParams.get("path") || "";
  if (!/^(search\/multi|movie\/(popular|\d{1,10})|tv\/(popular|\d{1,10}))$/.test(path)) {
    return Response.json({ error: "Consulta TMDB inválida." }, { status: 400 });
  }

  const target = new URL("https://api.themoviedb.org/3/" + path);
  for (const name of allowedParams) {
    const value = incoming.searchParams.get(name);
    if (!value) continue;
    if (name === "query" && value.length > 100) {
      return Response.json({ error: "A busca aceita até 100 caracteres." }, { status: 400 });
    }
    if (name === "append_to_response" && value !== "images") {
      return Response.json({ error: "Parâmetro inválido." }, { status: 400 });
    }
    if (name === "language" && !/^[a-z]{2}-[A-Z]{2}$/.test(value)) {
      return Response.json({ error: "Idioma inválido." }, { status: 400 });
    }
    if (name === "region" && !/^[A-Z]{2}$/.test(value)) {
      return Response.json({ error: "Região inválida." }, { status: 400 });
    }
    target.searchParams.set(name, value);
  }
  const readAccessToken = key.startsWith("eyJ") || key.length > 80;
  if (!readAccessToken) target.searchParams.set("api_key", key);

  try {
    const headers = new Headers({ accept: "application/json" });
    if (readAccessToken) headers.set("Authorization", "Bearer " + key);
    const upstream = await fetch(target, {
      headers,
      signal: AbortSignal.timeout(12000),
      redirect: "manual",
    });
    if (!upstream.ok) {
      return Response.json(
        { error: upstream.status === 401 ? "A credencial TMDB do servidor foi rejeitada. Confira se o secret contém uma API Key v3 ou um Read Access Token válido." : "O TMDB não conseguiu concluir a busca." },
        { status: upstream.status === 401 ? 503 : upstream.status, headers: { "Cache-Control": "no-store" } },
      );
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=60, s-maxage=600, stale-while-revalidate=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json({ error: "Não foi possível conectar ao TMDB. Tente novamente." }, {
      status: 502,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
