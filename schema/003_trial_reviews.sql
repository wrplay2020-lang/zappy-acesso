-- Registro separado: conferido manualmente não significa teste criado ou assinatura ativa.
CREATE TABLE IF NOT EXISTS trial_reviews (
  trial_id TEXT PRIMARY KEY NOT NULL,
  reviewed_at INTEGER NOT NULL
);
