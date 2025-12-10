-- Test script to verify deals table schema has paid_status and available_to_purchase columns

-- 1. Check if paid_status column exists and show sample values
SELECT 
  'paid_status column check' as test_name,
  COUNT(*) as total_deals,
  COUNT(CASE WHEN paid_status = 'paid' THEN 1 END) as paid_count,
  COUNT(CASE WHEN paid_status = 'unpaid' THEN 1 END) as unpaid_count,
  COUNT(CASE WHEN paid_status IS NULL THEN 1 END) as null_count
FROM deals;

-- 2. Check if available_to_purchase column exists and show sample values
SELECT 
  'available_to_purchase column check' as test_name,
  COUNT(*) as total_deals,
  COUNT(CASE WHEN available_to_purchase = true THEN 1 END) as available_count,
  COUNT(CASE WHEN available_to_purchase = false THEN 1 END) as not_available_count
FROM deals;

-- 3. Sample deals to verify both columns
SELECT 
  id,
  mid,
  paid_status,
  available_to_purchase
FROM deals
LIMIT 5;

-- 4. Test update for paid_status (will be rolled back)
BEGIN;
UPDATE deals 
SET paid_status = 'paid' 
WHERE id = (SELECT id FROM deals LIMIT 1)
RETURNING id, mid, paid_status;
ROLLBACK;

-- 5. Test update for available_to_purchase (will be rolled back)
BEGIN;
UPDATE deals 
SET available_to_purchase = true 
WHERE id = (SELECT id FROM deals LIMIT 1)
RETURNING id, mid, available_to_purchase;
ROLLBACK;
