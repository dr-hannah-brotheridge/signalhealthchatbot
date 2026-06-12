'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import { usePushNotifications } from '../../hooks/usePushNotifications'

export default function ChatPage() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState(null)
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [notificationMessage, setNotificationMessage] = useState(null)
  const bottomRef = useRef(null)
  
  const { subscribeToPush, unsubscribeFromPush } = usePushNotifications()
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const [notificationPreferences, setNotificationPreferences] = useState(null)

  useEffect(() => {
    const checkAuth = async () => {
      // Handle recovery link scenario
      const isRecovery = 
        window.location.hash.includes('type=recovery') || 
        window.location.href.includes('recovery') || 
        window.location.search.includes('type=recovery')

      if (isRecovery) {
        setIsRedirecting(true)
        window.location.replace(`/login${window.location.hash}${window.location.search}`)
        return
      }

      // Check session robustly
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error || !session) {
        console.log("No active session, redirecting to login...")
        window.location.replace('/login')
        return
      }

      setUser(session.user)
      loadConversation(session.user.id)
    }
    
    checkAuth()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const checkNotificationStatus = async () => {
      if (typeof window !== 'undefined' && 'serviceWorker' in navigator && user) {
        try {
          const registration = await navigator.serviceWorker.ready
          const subscription = await registration.pushManager.getSubscription()
          
          if (subscription) {
            // Check if subscription exists in database
            const subscriptionData = subscription.toJSON()
            const { data: existingSubs } = await supabase
              .from('push_subscriptions')
              .select('id, subscription')
              .eq('user_id', user.id)
            
            const matchingSub = existingSubs?.find(sub => sub.subscription?.endpoint === subscriptionData.endpoint)
            
            if (matchingSub) {
              // Subscription exists in both browser and database
              setNotificationsEnabled(true)
            } else {
              // Browser has subscription but database doesn't - clean up
              console.log('🧹 Cleaning up orphaned browser subscription...')
              await subscription.unsubscribe()
              setNotificationsEnabled(false)
            }
          } else {
            // No browser subscription
            setNotificationsEnabled(false)
          }
        } catch (err) {
          console.error('Error checking notification status:', err)
          setNotificationsEnabled(false)
        }
      }
    }
    checkNotificationStatus()
  }, [user])

  useEffect(() => {
    const loadNotificationPreferences = async () => {
      if (user) {
        try {
          const { data: { session } } = await supabase.auth.getSession()
          const res = await fetch('/api/notification-preferences', {
            headers: {
              'Authorization': `Bearer ${session.access_token}`
            }
          })
          const data = await res.json()
          
          console.log('📥 Chat page loaded preferences:', data.preferences)
          
          if (data.preferences) {
            setNotificationPreferences(data.preferences)
            // Sync button state with database enabled field
            setNotificationsEnabled(data.preferences.enabled)
            console.log('🔄 Button state synced with database:', data.preferences.enabled)
          }
        } catch (error) {
          console.error('Error loading notification preferences:', error)
        }
      }
    }
    loadNotificationPreferences()
  }, [user])

  const loadConversation = async (userId) => {
    const { data } = await supabase
      .from('conversations')
      .select('messages')
      .eq('user_id', userId)
      .single()
    if (data?.messages?.length > 0) {
      setMessages(data.messages)
    } else {
      startConversation(userId)
    }
  }

  const startConversation = async (userId) => {
    if (!userId) return
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ messages: [], userId })
    })
    const data = await res.json()
    const initialMessage = { role: 'assistant', content: data.reply }
    setMessages([initialMessage])
    setLoading(false)
  }

  const sendMessage = async () => {
    if (!input.trim() || loading || !user) return
    const userMessage = { role: 'user', content: input }
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setInput('')
    setLoading(true)

    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ messages: updatedMessages, userId: user.id })
    })
    const data = await res.json()
    const assistantMessage = { role: 'assistant', content: data.reply }
    setMessages([...updatedMessages, assistantMessage])
    setLoading(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.replace('/login')
  }

  if (isRedirecting || !user) {
    return <div className="min-h-screen bg-white" />
  }

  return (
    <div className="flex flex-col h-screen pb-16">
      <div className="bg-teal-50 border-b border-teal-100/30 px-4 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-teal-700 flex items-center justify-center shadow-sm flex-shrink-0">
            <span className="text-white text-base font-bold">♥</span>
          </div>
          <div className="text-left">
            <span className="text-lg font-bold tracking-tight text-gray-950">
              Signal<span className="text-teal-700">Health</span>
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {notificationsEnabled ? (
            <button
              onClick={async () => {
                const result = await unsubscribeFromPush()
                if (result.success) {
                  setNotificationsEnabled(false)
                  // Update notification_preferences
                  try {
                    const { data: { session } } = await supabase.auth.getSession()
                    await fetch('/api/notification-preferences', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`
                      },
                      body: JSON.stringify({ ...notificationPreferences, enabled: false })
                    })
                  } catch (error) {
                    console.error('Error updating notification preferences:', error)
                  }
                  alert(result.message || "Notifications disabled!")
                } else {
                  alert(result.error || "Failed to disable notifications")
                }
              }}
              className="text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 px-3 py-1.5 rounded-xl transition-colors"
            >
              Disable Alerts
            </button>
          ) : (
            <button
              onClick={async () => {
                const result = await subscribeToPush()
                if (result.success) {
                  setNotificationsEnabled(true)
                  // Update notification_preferences
                  try {
                    const { data: { session } } = await supabase.auth.getSession()
                    await fetch('/api/notification-preferences', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`
                      },
                      body: JSON.stringify({ ...notificationPreferences, enabled: true })
                    })
                  } catch (error) {
                    console.error('Error updating notification preferences:', error)
                  }
                  alert(result.message || "Notifications enabled!")
                } else {
                  alert(result.error || "Failed to enable notifications")
                }
              }}
              className="text-xs font-medium text-teal-700 bg-teal-100 hover:bg-teal-200 px-3 py-1.5 rounded-xl transition-colors"
            >
              Enable Alerts
            </button>
          )}
          <button
            onClick={handleLogout}
            className="text-sm font-medium text-gray-500 hover:text-red-500 bg-white/60 hover:bg-white border border-gray-100 px-3 py-1.5 rounded-xl transition-colors shadow-sm"
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 max-w-2xl mx-auto w-full">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`rounded-2xl px-4 py-3 max-w-xs lg:max-w-md text-base leading-relaxed ${
              msg.role === 'user'
                ? 'bg-teal-600 text-white rounded-br-sm'
                : 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm shadow-sm'
            }`}>
              {msg.content.replace(/\*\*(.*?)\*\*/g, '$1').split('\n').map((line, i) => (
                <span key={i}>{line}{i !== msg.content.split('\n').length - 1 && <br />}</span>
              ))}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce"></span>
                <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{animationDelay:'0.2s'}}></span>
                <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{animationDelay:'0.4s'}}></span>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="bg-white border-t border-gray-100 px-4 py-3 pb-4">
        <div className="max-w-2xl mx-auto flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder="Type a message..."
            className="flex-1 border border-gray-200 rounded-2xl px-4 py-3 text-base text-gray-900 placeholder-gray-400 outline-none focus:border-teal-500 bg-white"
          />
          <button
            onClick={sendMessage}
            disabled={loading}
            className="bg-teal-600 hover:bg-teal-700 text-white rounded-2xl px-5 py-3 text-base font-medium disabled:opacity-50 transition-colors"
          >
            Send
          </button>
        </div>
        <p className="text-center text-xs text-gray-400 mt-2">SignalHealth does not diagnose conditions or replace medical care.</p>
      </div>
    </div>
  )
}