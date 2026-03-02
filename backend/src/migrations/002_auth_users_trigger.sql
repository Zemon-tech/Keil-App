-- =============================================================================
-- Migration: 002_auth_users_trigger.sql
-- Description: Creates a PostgreSQL trigger to automatically insert a new 
--              profile into `public.users` whenever a user signs up via 
--              Supabase Auth (which inserts into `auth.users`).
-- =============================================================================

-- 1. Create the function that will be executed by the trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Insert into our public.users table using the ID and Email from the newly 
  -- created auth.user. 
  -- We also attempt to extract the full_name from the user_metadata JSONB block.
  INSERT INTO public.users (id, email, name)
  VALUES (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'full_name' -- Assuming frontend sends full_name in metadata during sign up
  );
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- SECURITY DEFINER ensures this function runs with the privileges of the user who created it,
-- allowing it to bypass RLS policies if necessary to immediately create the record.

-- 2. Drop the trigger if it already exists to prevent duplication issues
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 3. Create the trigger on the auth.users table
-- This fires automatically every time a new row is inserted into auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
