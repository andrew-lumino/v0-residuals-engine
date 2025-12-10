-- Script 1: Update deals.participants_json to add partner_name from partner_sync
-- Run this in Supabase SQL Editor

-- First, let's see how many deals need updating
SELECT COUNT(*) as deals_missing_partner_name
FROM deals d
WHERE d.participants_json IS NOT NULL
AND EXISTS (
  SELECT 1 FROM jsonb_array_elements(d.participants_json) elem
  WHERE elem->>'partner_name' IS NULL
);

-- Update all deals to add partner_name from partner_sync
UPDATE deals d
SET participants_json = (
  SELECT jsonb_agg(
    CASE 
      WHEN elem->>'partner_name' IS NOT NULL THEN elem
      ELSE elem || jsonb_build_object(
        'partner_name', COALESCE(ps.name, elem->>'partner_role'),
        'partner_email', COALESCE(ps.email, '')
      )
    END
  )
  FROM jsonb_array_elements(d.participants_json) elem
  LEFT JOIN partner_sync ps ON ps.airtable_record_id = elem->>'partner_airtable_id'
)
WHERE d.participants_json IS NOT NULL
AND d.participants_json != '[]'::jsonb;
