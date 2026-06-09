CREATE TABLE term_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  trimester smallint NOT NULL CHECK (trimester IN (1, 2, 3)),
  start_date date NOT NULL,
  end_date date NOT NULL,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, trimester)
);

ALTER TABLE term_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON term_dates
  USING (tenant_id = (SELECT id FROM tenants WHERE slug = current_setting('app.tenant_slug', true)));
