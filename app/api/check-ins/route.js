import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import { DateTime } from 'luxon'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

console.log('🔧 Check-ins API Configuration:')
console.log('  Supabase URL:', supabaseUrl ? '✅ Set' : '❌ Missing')
console.log('  Service Key:', supabaseServiceKey ? '✅ Set (length: ' + supabaseServiceKey.length + ')' : '❌ Missing')

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

// Configure VAPID
webpush.setVapidDetails(
  'mailto:signalhealth@example.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

// Helper function to calculate next check-in based on preferences
function calculateNextCheckIn(preferences) {
  if (!preferences.enabled || preferences.frequency === 'disabled') {
    return null
  }

  const userTimezone = preferences.timezone || 'UTC'
  const [hours, minutes] = preferences.time.split(':').map(Number)
  
  // Get current time in user's timezone
  const userNow = DateTime.now().setZone(userTimezone)
  
  // Create target time today in user's timezone
  let targetTime = userNow.set({ 
    hour: hours, 
    minute: minutes, 
    second: 0, 
    millisecond: 0 
  })
  
  // If the time has already passed today, move to next occurrence
  if (targetTime <= userNow) {
    switch (preferences.frequency) {
      case 'daily':
        targetTime = targetTime.plus({ days: 1 })
        break
      case 'weekly':
        if (preferences.days_of_week && preferences.days_of_week.length > 0) {
          // Find the next selected day
          const currentDay = targetTime.weekday % 7 // Convert to 0-6 (Sun-Sat)
          const sortedDays = [...preferences.days_of_week].sort((a, b) => a - b)
          
          // Find next occurrence
          let daysToAdd = null
          for (const day of sortedDays) {
            if (day > currentDay) {
              daysToAdd = day - currentDay
              break
            }
          }
          
          // If no day found after today, wrap to next week
          if (daysToAdd === null) {
            daysToAdd = 7 - currentDay + sortedDays[0]
          }
          
          targetTime = targetTime.plus({ days: daysToAdd })
        } else {
          targetTime = targetTime.plus({ days: 7 })
        }
        break
      case 'monthly':
        const dayOfMonth = preferences.day_of_month || 1
        const currentDayOfMonth = targetTime.day
        
        if (dayOfMonth > currentDayOfMonth) {
          // Set to the target day this month
          targetTime = targetTime.set({ day: dayOfMonth })
        } else {
          // Move to next month
          targetTime = targetTime.plus({ months: 1 }).set({ day: 1 })
          // Get the last day of the target month
          const daysInMonth = targetTime.daysInMonth
          // Set to target day or last day of month, whichever is smaller
          targetTime = targetTime.set({ day: Math.min(dayOfMonth, daysInMonth) })
        }
        break
    }
  }
  
  // Convert to UTC for storage
  return targetTime.toUTC().toISO()
}

export async function GET(request) {
  // Verify this is a cron job (secret key)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    console.log('🔄 Starting check-in notification job...')

    // Get all notification preferences that need check-ins
    const now = new Date().toISOString()
    const { data: preferences } = await supabaseAdmin
      .from('notification_preferences')
      .select('*')
      .lte('next_check_in_at', now)
      .eq('enabled', true)

    if (!preferences || preferences.length === 0) {
      console.log('✅ No check-ins due')
      return Response.json({ message: 'No check-ins due', sent: 0 })
    }

    console.log(`📋 Found ${preferences.length} users needing check-ins`)

    // Send notifications
    let sentCount = 0
    let failedCount = 0

    for (const pref of preferences) {
      try {
        // Get user's push subscriptions
        const { data: subscriptions } = await supabaseAdmin
          .from('push_subscriptions')
          .select('subscription')
          .eq('user_id', pref.user_id)

        if (!subscriptions || subscriptions.length === 0) {
          console.log(`⚠️ No subscription for user ${pref.user_id}`)
          continue
        }

        // Get user's name from profiles
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('name')
          .eq('id', pref.user_id)
          .single()
        
        const userName = profile?.name || 'there'  // Fallback if no name

        // Send notification to all subscriptions
        for (const { subscription } of subscriptions) {
          try {
            await webpush.sendNotification(subscription, JSON.stringify({
              title: 'Health Check-in',
              body: `Hey ${userName}, just checking in, how are you feeling today?`,
              icon: '/icon.png',
              url: '/chat'
            }))
            sentCount++
            console.log(`✅ Sent notification to user ${pref.user_id}`)
          } catch (error) {
            failedCount++
            console.error(`❌ Failed to send to user ${pref.user_id}:`, error.message)
          }
        }

        // Calculate and update next check-in
        const nextCheckInAt = calculateNextCheckIn(pref)
        
        if (nextCheckInAt) {
          await supabaseAdmin
            .from('notification_preferences')
            .update({ 
              next_check_in_at: nextCheckInAt,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', pref.user_id)
          
          console.log(`📅 Next check-in for user ${pref.user_id}: ${nextCheckInAt}`)
        }

      } catch (error) {
        console.error(`❌ Error processing user ${pref.user_id}:`, error)
        failedCount++
      }
    }

    console.log(`✅ Job complete: ${sentCount} sent, ${failedCount} failed`)

    return Response.json({
      message: 'Check-in notifications sent',
      sent: sentCount,
      failed: failedCount
    })
  } catch (error) {
    console.error('❌ Check-in job failed:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}
