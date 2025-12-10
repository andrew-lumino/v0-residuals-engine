-- Script 2: Update payouts.partner_name from partner_sync
-- Run this in Supabase SQL Editor AFTER script 001

-- First, check how many payouts need updating
SELECT COUNT(*) as payouts_missing_partner_name
FROM payouts
WHERE partner_name IS NULL;

-- Update payouts.partner_name from partner_sync table
UPDATE payouts p
SET partner_name = ps.name
FROM partner_sync ps
WHERE p.partner_airtable_id = ps.airtable_record_id
AND p.partner_name IS NULL;

-- For any remaining payouts without a match in partner_sync, use partner_role as fallback
UPDATE payouts
SET partner_name = partner_role
WHERE partner_name IS NULL;

-- Verify the update worked
SELECT 
  COUNT(*) as total_payouts,
  COUNT(partner_name) as has_partner_name,
  COUNT(*) - COUNT(partner_name) as still_missing
FROM payouts;
