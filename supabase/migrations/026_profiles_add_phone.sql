-- Add phone column to profiles (used for admin contact)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
