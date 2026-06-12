# Supabase Cron - Quick Setup Guide

## ✅ Your Configuration

**Your Vercel URL:** `https://signalhealth.dev/api/check-ins`  
**Your CRON_SECRET:** `1140413e1a6230e5e6e21484b8e1cae3edaa4fdc627b309ddfebfe5a974871e4`

---

## Step 1: Add CRON_SECRET to Vercel (2 minutes)

1. Go to: https://vercel.com/dashboard
2. Click your **SignalHealth** project
3. Go to **Settings** → **Environment Variables**
4. Click **"Add New"**
5. Set:
   - **Name:** `CRON_SECRET`
   - **Value:** `1140413e1a6230e5e6e21484b8e1cae3edaa4fdc627b309ddfebfe5a974871e4`
   - **Environments:** Check all (Production, Preview, Development)
6. Click **"Save"**
7. Click **"Redeploy"** to apply the new variable

---

## Step 2: Run the Migration in Supabase (1 minute)

1. Go to: https://supabase.com/dashboard
2. Select your project
3. Click **"SQL Editor"** in the left sidebar
4. Click **"New Query"**
5. Copy the contents of `supabase/migrations/20240612_setup_notification_cron_fixed.sql`
6. Paste into the SQL Editor
7. Click **"Run"** button (or press Ctrl/Cmd + Enter)

**Expected Result:**
```
✅ Extensions created
✅ Function created
✅ Cron job scheduled
✅ Shows 1 row with job details
```

---

## Step 3: Verify It's Working (30 seconds)

**Run this query in Supabase SQL Editor:**

```sql
-- Check cron job exists
SELECT * FROM cron.job WHERE jobname = 'check-notifications';

-- Manually trigger a test
SELECT trigger_notification_check();

-- Check if request was made (wait a few seconds, then run)
SELECT * FROM net.http_request_queue ORDER BY id DESC LIMIT 5;
```

**Expected Result:**
- Cron job shows: `*/15 * * * *` schedule
- Manual trigger returns successfully
- HTTP request queue shows request to signalhealth.dev

---

## Step 4: Test with a Real Notification

1. In your app, set a notification for **20 minutes from now**
2. Wait for the next cron run (runs every 15 minutes)
3. You should receive a notification within 15 minutes of your scheduled time

---

## Monitoring

### Check Recent Cron Runs:

```sql
SELECT 
  jobid,
  runid,
  status,
  return_message,
  start_time
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'check-notifications')
ORDER BY start_time DESC
LIMIT 20;
```

### Check HTTP Requests:

```sql
SELECT 
  id,
  created,
  url,
  status_code,
  content
FROM net.http_request_queue
ORDER BY id DESC
LIMIT 10;
```

---

## Troubleshooting

### If Cron Job Not Running:

```sql
-- Unschedule old job
SELECT cron.unschedule(jobid) 
FROM cron.job 
WHERE jobname = 'check-notifications';

-- Run the migration again to recreate it
```

### If HTTP Requests Failing:

1. **Check Vercel URL is correct:** `https://signalhealth.dev/api/check-ins`
2. **Check CRON_SECRET is added to Vercel** environment variables
3. **Redeploy Vercel** after adding the secret
4. **Test endpoint manually:**
   ```bash
   curl -H "Authorization: Bearer 1140413e1a6230e5e6e21484b8e1cae3edaa4fdc627b309ddfebfe5a974871e4" \
        https://signalhealth.dev/api/check-ins
   ```

### Check Vercel Logs:

1. Vercel Dashboard → Your Project
2. Click **Deployments**
3. Click latest **"Production"** deployment
4. Click **"Functions"** tab
5. Click `api/check-ins`
6. View logs for any errors

---

## Success Checklist ✅

- [ ] CRON_SECRET added to Vercel environment variables
- [ ] Vercel redeployed with new environment variable
- [ ] Supabase migration ran successfully
- [ ] Cron job shows in `cron.job` table
- [ ] Manual test trigger works
- [ ] HTTP requests appear in `net.http_request_queue`
- [ ] Test notification scheduled for 20 minutes from now
- [ ] Notification received successfully

---

## How It Works

```
Every 15 minutes:
  ┌─────────────────┐
  │  Supabase       │
  │  pg_cron        │
  │  triggers       │
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │  pg_net makes   │
  │  HTTP GET to:   │
  │  signalhealth   │
  │  .dev           │
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │  Vercel API     │
  │  /api/check-ins │
  │                 │
  │  1. Verifies    │
  │     CRON_SECRET │
  │  2. Queries DB  │
  │  3. Sends push  │
  │     notifications│
  └─────────────────┘
```

---

**That's it! You're done!** 🎉

Your notifications will now check every 15 minutes and send on time.