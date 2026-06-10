  import { supabase } from '../../lib/supabase'

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/')
    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
  }

  export function usePushNotifications() {
    const unsubscribeFromPush = async () => {
      console.log('🔕 Starting push notification unsubscription...')
      
      // Check browser support
      if (!('serviceWorker' in navigator)) {
        console.error('❌ Service Workers are not supported in this browser')
        return { success: false, error: 'Service Workers are not supported in this browser' }
      }
      
      if (!('PushManager' in window)) {
        console.error('❌ Push notifications are not supported in this browser')
        return { success: false, error: 'Push notifications are not supported in this browser' }
      }
      
      try {
        console.log('⏳ Waiting for service worker to be ready...')
        let registration
        try {
          registration = await Promise.race([
            navigator.serviceWorker.ready,
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Service worker ready timeout')), 10000)
            )
          ])
          console.log('✅ Service worker is ready:', registration.scope)
        } catch (err) {
          console.error('❌ Service worker not ready:', err)
          return { success: false, error: 'Service worker not ready. Please refresh and try again.' }
        }

        console.log('⏳ Getting current push subscription...')
        const subscription = await registration.pushManager.getSubscription()
        
        if (!subscription) {
          console.log('ℹ️ No active subscription found')
          return { success: true, message: 'No active subscription to remove.' }
        }

        console.log('🔐 Checking authentication...')
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          console.error('❌ Not authenticated')
          return { success: false, error: 'You must be logged in to disable notifications.' }
        }
        console.log('✅ User authenticated:', user.id)

        console.log('💾 Removing subscription from database...')
        const subscriptionData = subscription.toJSON()
        const endpoint = subscriptionData.endpoint
        
        const { data: existingSubs } = await supabase
          .from('push_subscriptions')
          .select('id, subscription')
          .eq('user_id', user.id)

        const matchingSub = existingSubs?.find(sub => sub.subscription?.endpoint === endpoint)

        if (!matchingSub) {
          console.log('ℹ️ Subscription not found in database, only unsubscribing from browser')
        } else {
          const { error: deleteError } = await supabase
            .from('push_subscriptions')
            .delete()
            .eq('id', matchingSub.id)

          if (deleteError) {
            console.error('❌ Database error:', deleteError)
            return { success: false, error: `Failed to remove subscription: ${deleteError.message}` }
          }
          console.log('✅ Subscription removed from database')
        }

        console.log('📝 Unsubscribing from push service...')
        await subscription.unsubscribe()
        console.log('✅ Unsubscribed from push service')

        return { success: true, message: 'Notifications disabled successfully!' }
      } catch (err) {
        console.error('❌ Unsubscription failed:', err)
        return { success: false, error: `Failed to disable notifications: ${err.message}` }
      }
    }

    const subscribeToPush = async () => {
      console.log('🔔 Starting push notification subscription...')
      
      // Check browser support
      if (!('serviceWorker' in navigator)) {
        console.error('❌ Service Workers are not supported in this browser')
        return { success: false, error: 'Service Workers are not supported in this browser' }
      }
      
      if (!('PushManager' in window)) {
        console.error('❌ Push notifications are not supported in this browser')
        return { success: false, error: 'Push notifications are not supported in this browser' }
      }
      
      // Check VAPID key and strip quotes if present
      let vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) {
        console.error('❌ VAPID public key is not configured')
        return { success: false, error: 'VAPID key not configured. Please contact support.' }
      }
      
      // Strip quotes if they were accidentally included
      vapidKey = vapidKey.replace(/^["']|["']$/g, '')
      if (!vapidKey) {
        console.error('❌ VAPID public key is empty after stripping quotes')
        return { success: false, error: 'VAPID key is empty. Please contact support.' }
      }
      
      console.log('🔑 VAPID key found (length:', vapidKey.length, 'chars)')
      
      try {
        console.log('⏳ Waiting for service worker to be ready...')
        // Wait for service worker to be ready with a timeout
        let registration
        try {
          registration = await Promise.race([
            navigator.serviceWorker.ready,
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Service worker ready timeout')), 10000)
            )
          ])
          console.log('✅ Service worker is ready:', registration.scope)
        } catch (err) {
          console.error('❌ Service worker not ready:', err)
          return { success: false, error: 'Service worker not ready. Please refresh and try again.' }
        }

        console.log('⏳ Requesting notification permission...')
        const permission = await Notification.requestPermission()
        console.log('📱 Permission result:', permission)
        
        if (permission !== 'granted') {
          console.error('❌ Permission denied')
          return { success: false, error: 'Notification permission was denied. Please enable notifications in your browser settings.' }
        }

        console.log('✅ Permission granted')

        const subscribeOptions = {
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        }

        console.log('⏳ Getting or creating push subscription...')
        let subscription = await registration.pushManager.getSubscription()
        
        if (!subscription) {
          console.log('📝 Creating new push subscription...')
          subscription = await registration.pushManager.subscribe(subscribeOptions)
          console.log('✅ New subscription created')
        } else {
          console.log('ℹ️ Existing subscription found in browser')
        }

        console.log('🔐 Checking authentication...')
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          console.error('❌ Not authenticated')
          return { success: false, error: 'You must be logged in to enable notifications.' }
        }
        console.log('✅ User authenticated:', user.id)

        console.log('💾 Checking if subscription already exists in database...')
        const subscriptionData = subscription.toJSON()
        const endpoint = subscriptionData.endpoint
        console.log('📍 Browser endpoint:', endpoint)
        
        const { data: existingSubs, error: queryError } = await supabase
          .from('push_subscriptions')
          .select('id, subscription')
          .eq('user_id', user.id)

        if (queryError) {
          console.error('❌ Query error:', queryError)
          return { success: false, error: `Failed to check existing subscriptions: ${queryError.message}` }
        }

        console.log('📊 Found', existingSubs?.length || 0, 'existing subscriptions in database')
        
        const matchingSub = existingSubs?.find(sub => {
          const dbEndpoint = sub.subscription?.endpoint
          console.log('🔍 Comparing:', dbEndpoint, '===', endpoint, dbEndpoint === endpoint)
          return dbEndpoint === endpoint
        })

        if (matchingSub) {
          console.log('✅ Subscription already exists in database (ID:', matchingSub.id, ')')
          return { success: true, message: 'Notifications already enabled!' }
        }

        console.log('💾 Saving new subscription to database...')
        console.log('📦 Subscription data:', {
          endpoint: subscriptionData.endpoint,
          keys: subscriptionData.keys ? 'present' : 'missing'
        })

        const { error } = await supabase
          .from('push_subscriptions')
          .insert({
            user_id: user.id,
            subscription: subscriptionData,
          })

        if (error) {
          console.error('❌ Database error:', error)
          return { success: false, error: `Failed to save subscription: ${error.message}` }
        }

        console.log('✅ Subscription saved successfully')
        return { success: true, message: 'Notifications enabled successfully!' }
      } catch (err) {
        console.error('❌ Subscription failed:', err)
        
        // Provide user-friendly error messages
        if (err.message.includes('timeout')) {
          return { success: false, error: 'Service worker took too long to load. Please refresh and try again.' }
        }
        if (err.name === 'NotAllowedError') {
          return { success: false, error: 'Notification permission was denied. Please enable notifications in your browser settings.' }
        }
        if (err.name === 'AbortError') {
          return { success: false, error: 'Subscription was interrupted. Please try again.' }
        }
        
        return { success: false, error: `Failed to enable notifications: ${err.message}` }
      }
    }

    return { subscribeToPush, unsubscribeFromPush }
  }
