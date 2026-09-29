import { env } from "cloudflare:workers";

export async function GET() {
  return Response.json({ turnstileSiteKey: env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET_KEY ? env.TURNSTILE_SITE_KEY : null }, {
    headers: { "Cache-Control": "no-store" },
  });
}
