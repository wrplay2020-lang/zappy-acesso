declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    ZAPPY_API_KEY?: string;
    TURNSTILE_SITE_KEY?: string;
    TURNSTILE_SECRET_KEY?: string;
    ADMIN_DASHBOARD_KEY?: string;
    ZAPPY_RELEASES_URL?: string;
    ZAPPY_CATALOG_API_KEY?: string;
  }
}
