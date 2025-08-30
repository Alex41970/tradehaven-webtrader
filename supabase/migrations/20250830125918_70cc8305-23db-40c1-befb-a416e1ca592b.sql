-- Reset password for admin user 2@1.com for testing
-- This sets the password to "password123"
UPDATE auth.users 
SET 
  encrypted_password = '$2a$10$8K1p/a0xLKRkUb7wD1CViuWpZw9P5PFhOjQ7w5M9b9CaGW1xC4UJ2',
  password_hash = '$2a$10$8K1p/a0xLKRkUb7wD1CViuWpZw9P5PFhOjQ7w5M9b9CaGW1xC4UJ2'
WHERE email = '2@1.com';