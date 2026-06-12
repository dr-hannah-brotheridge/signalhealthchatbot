-- Enable pg_net extension (Supabase's HTTP extension)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA net TO postgres;
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Create a function to call our Vercel API endpoint using pg_net
CREATE OR REPLACE FUNCTION trigger_notification_check()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_id bigint;
BEGIN
  -- Make HTTP GET request using pg_net
  SELECT net.http_get(
    url := 'https://signalhealth.dev/api/check-ins',
    headers := jsonb_build_object(
      'Authorization', 'Bearer 1140413e1a6230e5e6e21484b8e1cae3edaa4fdc627b309ddfebfe5a974871e4'
    )
  ) INTO request_id;
  
  RAISE NOTICE 'Notification check triggered with request_id: %', request_id;
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

-- Optional: View http request history
-- SELECT * FROM net.http_request_queue ORDER BY id DESC LIMIT 10;