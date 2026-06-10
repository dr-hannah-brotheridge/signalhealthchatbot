import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

console.log('🔧 API Configuration:')
console.log('  Supabase URL:', supabaseUrl ? '✅ Set' : '❌ Missing')
console.log('  Anon Key:', supabaseAnonKey ? '✅ Set (length: ' + supabaseAnonKey.length + ')' : '❌ Missing')

const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Configure VAPID
webpush.setVapidDetails(
  'mailto:signalhealth@example.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

export async function POST(request) {
  try {
    const { userId, title, body } = await request.json()

    console.log('🔔 Test notification request received')
    console.log('📝 User ID:', userId)
    console.log('📝 User ID length:', userId?.length)
    console.log('📝 User ID type:', typeof userId)

    if (!userId) {
      return Response.json({ error: 'userId is required' }, { status: 400 })
    }

    // Get user's push subscription
    console.log('🔍 Querying database for subscriptions...')
    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('subscription, user_id, created_at')
      .eq('user_id', userId)

    console.log('📊 Query result:', {
      subscriptionsFound: subscriptions?.length || 0,
      error: error?.message
    })

    if (error) {
      console.error('❌ Database error:', error)
      return Response.json({ error: `Database error: ${error.message}` }, { status: 500 })
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('❌ No subscriptions found for user:', userId)
      
      // Debug: Check what subscriptions exist
      const { data: allSubs } = await supabase
        .from('push_subscriptions')
        .select('user_id, created_at')
        .limit(5)
      
      console.log('📋 Sample subscriptions in database:', allSubs)
      
      return Response.json({ 
        error: 'No push subscription found for this user',
        userId: userId,
        totalSubscriptionsInDb: allSubs?.length || 0
      }, { status: 404 })
    }

    console.log('✅ Found', subscriptions.length, 'subscription(s)')

    // Send notification to all subscriptions for this user
    const results = []
    for (const { subscription } of subscriptions) {
      try {
        await webpush.sendNotification(subscription, JSON.stringify({
          title: title || 'Test Notification',
          body: body || 'This is a test notification from SignalHealth!',
          icon: '/icon.png',
          badge: '/icon.png',
          url: '/chat'
        }))
        results.push({ success: true, subscription })
      } catch (error) {
        console.error('Failed to send notification:', error)
        results.push({ success: false, error: error.message, subscription })
      }
    }

    const successful = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length

    return Response.json({
      message: `Sent ${successful} notification(s), ${failed} failed`,
      details: results
    })
  } catch (error) {
    console.error('Error sending test notification:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}