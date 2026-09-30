import { env } from "cloudflare:workers";

export async function ensureReviewTable() {
  await env.DB!.prepare(
    "CREATE TABLE IF NOT EXISTS trial_reviews (trial_id TEXT PRIMARY KEY NOT NULL, reviewed_at INTEGER NOT NULL)"
  ).run();
}
