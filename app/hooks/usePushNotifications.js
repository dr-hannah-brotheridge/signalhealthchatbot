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
          console.log('ℹ️ Existing subscription found')
        }

        console.log('🔐 Checking authentication...')
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          console.error('❌ Not authenticated')
          return { success: false, error: 'You must be logged in to enable notifications.' }
        }
        console.log('✅ User authenticated:', user.id)

        console.log('💾 Saving subscription to database...')
        const subscriptionData = subscription.toJSON()
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
          if (error.code === '23505') {
            console.log('ℹ️ Subscription already exists (duplicate)')
            return { success: true, message: 'Notifications are already enabled!' }
          }
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

    return { subscribeToPush }
  }
