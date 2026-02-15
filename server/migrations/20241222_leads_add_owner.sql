-- Add createdBy/createdByName to leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS created_by varchar;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS created_by_name text;
