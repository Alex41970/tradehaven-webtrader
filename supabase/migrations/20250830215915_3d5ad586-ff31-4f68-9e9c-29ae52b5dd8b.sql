-- Delete all problematic assets added on 2025-08-30
DELETE FROM assets 
WHERE DATE(created_at) = '2025-08-30';