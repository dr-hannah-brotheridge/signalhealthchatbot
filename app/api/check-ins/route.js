import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

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

export async function GET(request) {
  // Verify this is a cron job (secret key)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    console.log('🔄 Starting check-in notification job...')

    // Get all conversations that need check-ins
    const now = new Date().toISOString()
    const { data: conversations } = await supabaseAdmin
      .from('conversations')
      .select('user_id, next_check_in_at, is_proactive')
      .lte('next_check_in_at', now)
      .is('is_proactive', true)

    if (!conversations || conversations.length === 0) {
      console.log('✅ No check-ins due')
      return Response.json({ message: 'No check-ins due', sent: 0 })
    }

    console.log(`📋 Found ${conversations.length} conversations needing check-ins`)

    // Send notifications
    let sentCount = 0
    let failedCount = 0

    for (const conversation of conversations) {
      try {
        // Get user's push subscriptions
        const { data: subscriptions } = await supabaseAdmin
          .from('push_subscriptions')
          .select('subscription')
          .eq('user_id', conversation.user_id)

        if (!subscriptions || subscriptions.length === 0) {
          console.log(`⚠️ No subscription for user ${conversation.user_id}`)
          continue
        }

        // Send notification to all subscriptions
        for (const { subscription } of subscriptions) {
          try {
            await webpush.sendNotification(subscription, JSON.stringify({
              title: '💚 Health Check-in',
              body: "It's time for your health check-in! How are you feeling today?",
              icon: '/icon.png',
              badge: '/icon.png',
              url: '/chat'
            }))
            sentCount++
            console.log(`✅ Sent notification to user ${conversation.user_id}`)
          } catch (error) {
            failedCount++
            console.error(`❌ Failed to send to user ${conversation.user_id}:`, error.message)
          }
        }

        // Update next_check_in_at based on check_in_interval_days
        const nextCheckIn = new Date()
        nextCheckIn.setDate(nextCheckIn.getDate() + (conversation.check_in_interval_days || 7))
        
        await supabaseAdmin
          .from('conversations')
          .update({ next_check_in_at: nextCheckIn.toISOString() })
          .eq('user_id', conversation.user_id)

      } catch (error) {
        console.error(`❌ Error processing user ${conversation.user_id}:`, error)
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