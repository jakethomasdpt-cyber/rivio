-- Apply before the application update. No issued invoice numbers or line items change.
ALTER TABLE public.veda_organization_mappings
  ADD COLUMN IF NOT EXISTS organization_name text;
ALTER TABLE public.veda_organization_mappings
  ADD CONSTRAINT veda_organization_name_valid CHECK (
    organization_name IS NULL OR
    (length(btrim(organization_name)) BETWEEN 1 AND 200
     AND organization_name !~ '[[:cntrl:]]')
  );
COMMENT ON COLUMN public.veda_organization_mappings.organization_name IS
  'Public originating organization name; falls back to the mapped Rivio workspace business_name.';
