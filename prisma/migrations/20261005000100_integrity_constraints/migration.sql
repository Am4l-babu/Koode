-- Data-consistency invariants enforced by the database itself (defence in depth
-- on top of the atomic conditional UPDATE in the donation service).
ALTER TABLE "request_items"
  ADD CONSTRAINT "request_items_quantity_required_positive" CHECK ("quantityRequired" > 0),
  ADD CONSTRAINT "request_items_committed_bounds" CHECK ("quantityCommitted" >= 0 AND "quantityCommitted" <= "quantityRequired"),
  ADD CONSTRAINT "request_items_received_bounds" CHECK ("quantityReceived" >= 0 AND "quantityReceived" <= "quantityRequired");

ALTER TABLE "donation_items"
  ADD CONSTRAINT "donation_items_quantity_positive" CHECK ("quantity" > 0);

-- Audit logs are append-only: rows may be purged by retention policy but never edited.
CREATE OR REPLACE FUNCTION audit_logs_block_update() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_no_update
  BEFORE UPDATE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION audit_logs_block_update();

-- Trigram index to keep free-text search on Browse Needs fast at scale.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS "requests_title_trgm_idx" ON "requests" USING gin ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "request_items_name_trgm_idx" ON "request_items" USING gin ("name" gin_trgm_ops);
