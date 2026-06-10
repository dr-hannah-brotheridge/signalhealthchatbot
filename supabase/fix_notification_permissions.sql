-- Fix notification_preferences table permissions
-- Run this in Supabase SQL Editor

-- Check if table exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'notification_preferences'
  ) THEN
    RAISE EXCEPTION 'Table notification_preferences does not exist. Please run the migration first.';
  END IF;
END $$;

-- Enable RLS
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view own notification preferences" ON notification_preferences;
DROP POLICY IF EXISTS "Users can insert own notification preferences" ON notification_preferences;
DROP POLICY IF EXISTS "Users can update own notification preferences" ON notification_preferences;
DROP POLICY IF EXISTS "Users can delete own notification preferences" ON notification_preferences;
DROP POLICY IF EXISTS "Allow service access to notification_preferences" ON notification_preferences;

-- Create RLS policies for user access
CREATE POLICY "Users can view own notification preferences" 
  ON notification_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification preferences" 
  ON notification_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notification preferences" 
  ON notification_preferences
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notification preferences" 
  ON notification_preferences
  FOR DELETE
  USING (auth.uid() = user_id);

-- Allow service access (for cron jobs and server-side operations)
CREATE POLICY "Allow service access to notification_preferences" 
  ON notification_preferences
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Grant table-level permissions to service_role
GRANT ALL ON public.notification_preferences TO service_role;

-- Verify the setup
SELECT 
  'Table exists' as check_item,
  CASE WHEN EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'notification_preferences'
  ) THEN '✅' ELSE '❌' END as status
UNION ALL
SELECT 
  'RLS enabled' as check_item,
  CASE WHEN EXISTS (
    SELECT FROM pg_tables 
    WHERE tablename = 'notification_preferences' AND rowsecurity = true
  ) THEN '✅' ELSE '❌' END as status
UNION ALL
SELECT 
  'User policies exist' as check_item,
  CASE WHEN EXISTS (
    SELECT FROM pg_policies 
    WHERE tablename = 'notification_preferences' 
    AND policyname LIKE 'Users can%'
  ) THEN '✅' ELSE '❌' END as status
UNION ALL
SELECT 
  'Service policy exists' as check_item,
  CASE WHEN EXISTS (
    SELECT FROM pg_policies 
    WHERE tablename = 'notification_preferences' 
    AND policyname = 'Allow service access to notification_preferences'
  ) THEN '✅' ELSE '❌' END as status
UNION ALL
SELECT 
  'Service role has GRANT' as check_item,
  CASE WHEN EXISTS (
    SELECT FROM information_schema.role_table_grants 
    WHERE table_name = 'notification_preferences' 
    AND grantee = 'service_role'
  ) THEN '✅' ELSE '❌' END as status;