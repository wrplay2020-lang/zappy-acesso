-- Execute uma vez no D1 de produção antes de publicar o código do histórico.
ALTER TABLE trial_requests ADD COLUMN username TEXT;
ALTER TABLE trial_requests ADD COLUMN failure_code TEXT;
CREATE INDEX IF NOT EXISTS trial_requests_created_at_idx ON trial_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS trial_requests_status_created_at_idx ON trial_requests (status, created_at DESC);
