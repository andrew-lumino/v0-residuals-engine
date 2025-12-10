-- Remove plan references and add legacy import tracking

-- 1. Add is_legacy_import column to both tables
ALTER TABLE public.deals 
ADD COLUMN IF NOT EXISTS is_legacy_import boolean NOT NULL DEFAULT false;

ALTER TABLE public.payouts 
ADD COLUMN IF NOT EXISTS is_legacy_import boolean NOT NULL DEFAULT false;

-- 2. Mark existing payouts as legacy imports
UPDATE public.payouts SET is_legacy_import = true WHERE csv_data_id IS NULL;

-- 3. Drop the deprecated plan columns
ALTER TABLE public.deals DROP COLUMN IF EXISTS plan;
ALTER TABLE public.payouts DROP COLUMN IF EXISTS deal_plan;

-- 4. Create index for legacy imports
CREATE INDEX IF NOT EXISTS idx_payouts_is_legacy_import ON public.payouts(is_legacy_import);
CREATE INDEX IF NOT EXISTS idx_deals_is_legacy_import ON public.deals(is_legacy_import);
