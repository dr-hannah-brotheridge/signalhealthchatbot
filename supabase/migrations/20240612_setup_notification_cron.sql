-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Create a function to call our Vercel API endpoint
CREATE OR REPLACE FUNCTION trigger_notification_check()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  response record;
BEGIN
  -- Make HTTP request to Vercel endpoint
  -- Replace YOUR_VERCEL_URL with your actual Vercel deployment URL
  -- Replace YOUR_CRON_SECRET with the secret you'll add to Vercel env vars
  SELECT * INTO response
  FROM http((
    'GET',
    '- `https://signalhealth.dev/api/check-ins`',
    ARRAY[http_header('Authorization', 'Bearer 1140413e1a6230e5e6e21484b8e1cae3edaa4fdc627b309ddfebfe5a974871e4')],
    'application/json',
    ''
  )::http_request);
  
  RAISE NOTICE 'Notification check triggered: %', response.status;
END;
$$;

-- Schedule the cron job to run every 15 minutes
-- Format: '*/15 * * * *' = every 15 minutes
SELECT cron.schedule(
  'check-notifications',           -- Job name
  '*/15 * * * *',                   -- Every 15 minutes
  'SELECT trigger_notification_check();'
);

-- View scheduled cron jobs
SELECT * FROM cron.job;