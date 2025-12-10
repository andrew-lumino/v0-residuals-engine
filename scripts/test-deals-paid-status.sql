-- Test script to verify deals table has paid_status column and test the update

-- 1. Check paid_status column values
SELECT 
  'paid_status column check' as test_name,
  COUNT(*) as total_deals,
  COUNT(CASE WHEN paid_status = 'paid' THEN 1 END) as paid_count,
  COUNT(CASE WHEN paid_status = 'unpaid' THEN 1 END) as unpaid_count,
  COUNT(CASE WHEN paid_status IS NULL THEN 1 END) as null_count
FROM deals;

-- 2. Check available_to_purchase column values
SELECT 
  'available_to_purchase column check' as test_name,
  COUNT(*) as total_deals,
  COUNT(CASE WHEN available_to_purchase = true THEN 1 END) as available_count,
  COUNT(CASE WHEN available_to_purchase = false THEN 1 END) as not_available_count
FROM deals;

-- 3. Sample 5 deals to verify columns
SELECT 
  id,
  mid,
  paid_status,
  available_to_purchase
FROM deals
LIMIT 5;

-- 4. Test update for paid_status (will be rolled back - just testing)
BEGIN;
UPDATE deals 
SET paid_status = 'paid' 
WHERE id = (SELECT id FROM deals WHERE paid_status = 'unpaid' LIMIT 1)
RETURNING id, mid, paid_status;
ROLLBACK;
