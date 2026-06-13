import { createClient } from '@supabase/supabase-js'
import { DateTime } from 'luxon'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

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
  if (targetTime < userNow) {
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
  try {
    // Get user from session
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's notification preferences
    const { data: preferences, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') {
      return Response.json({ error: error.message }, { status: 500 })
    }

    // Return preferences or default values (opt-in design: enabled false by default)
    return Response.json({
      preferences: preferences || {
        enabled: false,
        frequency: 'weekly',
        days_of_week: [1], // Monday
        day_of_month: 1,
        time: '09:00',
        timezone: 'UTC'
      }
    })
  } catch (error) {
    console.error('Error getting notification preferences:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    console.log('📥 POST /api/notification-preferences called')
    
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      console.error('❌ No auth header')
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      console.error('❌ Auth error:', authError)
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('✅ User authenticated:', user.id)

    const body = await request.json()
    const { enabled, frequency, days_of_week, day_of_month, time, timezone } = body
    
    console.log('📝 Received data:', { enabled, frequency, days_of_week, day_of_month, time, timezone })

    // Calculate next check-in
    const nextCheckInAt = calculateNextCheckIn({
      enabled,
      frequency,
      days_of_week,
      day_of_month,
      time,
      timezone
    })
    
    console.log('📅 Next check-in calculated:', nextCheckInAt)

    // Use native upsert to prevent race conditions and duplicates
    console.log('💾 Upserting notification preferences...')
    const { data: preferences, error } = await supabase
      .from('notification_preferences')
      .upsert({
        user_id: user.id,
        enabled: enabled !== undefined ? enabled : false,
        frequency: frequency || 'weekly',
        days_of_week: days_of_week || [1],
        day_of_month: day_of_month || 1,
        time: time || '09:00',
        timezone: timezone || 'UTC',
        next_check_in_at: nextCheckInAt,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id',
        ignoreDuplicates: false
      })
      .select()
      .single()
    
    if (error) {
      console.error('❌ Upsert error:', error)
    } else {
      console.log('✅ Upsert successful:', preferences)
    }

    if (error) {
      console.error('❌ Error saving notification preferences:', error)
      return Response.json({ error: error.message }, { status: 500 })
    }

    console.log('✅ Returning success response')
    return Response.json({ 
      success: true, 
      preferences,
      message: 'Notification preferences saved successfully'
    })
  } catch (error) {
    console.error('❌ Error saving notification preferences:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}
