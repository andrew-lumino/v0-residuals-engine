-- Make csv_data_id nullable in payouts table to allow legacy data imports
-- This allows importing historical payouts that don't have corresponding csv_data records

ALTER TABLE payouts 
ALTER COLUMN csv_data_id DROP NOT NULL;

-- Optional: Drop the foreign key constraint temporarily for legacy imports
-- You can re-enable it later if needed
-- ALTER TABLE payouts DROP CONSTRAINT IF EXISTS payouts_csv_data_id_fkey;
