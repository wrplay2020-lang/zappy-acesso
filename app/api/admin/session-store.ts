import { env } from "cloudflare:workers";

const cookieName = "zappy_admin_session";
const lifetime = 8 * 60 * 60 * 1000;

export async function digest(value: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function matchesKey(a: string, b: string) {
  const [left, right] = await Promise.all([digest(a), digest(b)]);
  let different = 0;
  for (let i = 0; i < left.length; i++) different |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return different === 0;
}

async function ensureTable() {
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS admin_sessions (token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL)").run();
}

function tokenFrom(request: Request) {
  const raw = request.headers.get("Cookie")?.split(";").map(part => part.trim()).find(part => part.startsWith(cookieName + "="))?.slice(cookieName.length + 1) ?? "";
  return /^[0-9a-f]{64}$/.test(raw) ? raw : "";
}

export async function authorized(request: Request) {
  if (!env.ADMIN_DASHBOARD_KEY || !env.DB) return false;
  const token = tokenFrom(request);
  if (!token) return false;
  await ensureTable();
  const row = await env.DB.prepare("SELECT expires_at FROM admin_sessions WHERE token_hash = ?").bind(await digest(token)).first<{ expires_at: number }>();
  return Boolean(row && row.expires_at > Date.now());
}

export async function createSession() {
  await ensureTable();
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, "0")).join("");
  await env.DB.prepare("INSERT INTO admin_sessions (token_hash, expires_at) VALUES (?, ?)").bind(await digest(token), Date.now() + lifetime).run();
  return `${cookieName}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/api/admin; Max-Age=${lifetime / 1000}`;
}

export async function deleteSession(request: Request) {
  const token = tokenFrom(request);
  if (token && env.DB) {
    await ensureTable();
    await env.DB.prepare("DELETE FROM admin_sessions WHERE token_hash = ?").bind(await digest(token)).run();
  }
  return `${cookieName}=; HttpOnly; Secure; SameSite=Strict; Path=/api/admin; Max-Age=0`;
}
