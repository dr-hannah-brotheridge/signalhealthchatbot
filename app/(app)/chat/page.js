'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import SocialProofBanner from '../components/SocialProofBanner'
import CheckInOnboardingModal from '../components/CheckInOnboardingModal'

export default function ChatPage() {
  const router = useRouter()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState(null)
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [showOnboardingModal, setShowOnboardingModal] = useState(false)
  
  // Pre-appointment mode state
  const [isPreAppointmentMode, setIsPreAppointmentMode] = useState(false)
  const [showAppointmentModal, setShowAppointmentModal] = useState(false)
  const [appointmentType, setAppointmentType] = useState('')
  const [appointmentDate, setAppointmentDate] = useState('')
  const [appointmentFocus, setAppointmentFocus] = useState('')
  const [preAppointmentConversationId, setPreAppointmentConversationId] = useState(null)
  
  const bottomRef = useRef(null)

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


  const loadConversation = async (userId) => {
    // Load the most recent general conversation
    const { data } = await supabase
      .from('conversations')
      .select('messages, id')
      .eq('user_id', userId)
      .eq('conversation_type', 'general')
      .order('updated_at', { ascending: false })
      .limit(1)
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
      body: JSON.stringify({ 
        messages: [], 
        userId,
        conversationType: 'general'
      })
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
      body: JSON.stringify({ 
        messages: updatedMessages, 
        userId: user.id,
        conversationType: isPreAppointmentMode ? 'pre_appointment' : 'general',
        conversationId: isPreAppointmentMode ? preAppointmentConversationId : null,
        appointmentType: isPreAppointmentMode ? appointmentType : null,
        appointmentDate: isPreAppointmentMode ? appointmentDate : null,
        appointmentFocus: isPreAppointmentMode ? appointmentFocus : null
      })
    })
    const data = await res.json()
    const assistantMessage = { role: 'assistant', content: data.reply }
    const finalMessages = [...updatedMessages, assistantMessage]
    setMessages(finalMessages)
    setLoading(false)
    
    // Check for pre-appointment completion
    if (isPreAppointmentMode && data.reply.includes('Head to your Summary page and press Update')) {
      // Extract and save health updates
      await extractAndSaveHealthUpdates(finalMessages)
    }
    
    // Check if we should show onboarding modal
    if (data.showOnboardingModal) {
      // Only show if not already dismissed or accepted
      const dismissed = localStorage.getItem('checkinModalDismissed') === 'true'
      const accepted = localStorage.getItem('checkinModalAccepted') === 'true'
      
      if (!dismissed && !accepted) {
        setShowOnboardingModal(true)
      }
    }
  }

  const handleStartPrep = async () => {
    if (!appointmentType || !appointmentDate) return

    // Save appointment details to profile
    await supabase
      .from('profiles')
      .update({
        upcoming_appointment_type: appointmentType,
        upcoming_appointment_date: appointmentDate,
        upcoming_appointment_focus: appointmentFocus || null,
        last_updated: new Date().toISOString()
      })
      .eq('id', user.id)

    // Create a new conversation for this prep session
    const { data: newConversation } = await supabase
      .from('conversations')
      .insert({
        user_id: user.id,
        messages: [],
        conversation_type: 'pre_appointment',
        is_proactive: false
      })
      .select()
      .single()

    setPreAppointmentConversationId(newConversation.id)
    setShowAppointmentModal(false)
    setIsPreAppointmentMode(true)
    setMessages([])

    // Trigger opening message from Claude automatically
    await sendPreAppointmentOpeningMessage(newConversation.id)
  }

  const sendPreAppointmentOpeningMessage = async (conversationId) => {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ 
        messages: [], 
        userId: user.id,
        conversationType: 'pre_appointment',
        conversationId: conversationId,
        appointmentType,
        appointmentDate,
        appointmentFocus
      })
    })
    
    const data = await res.json()
    const initialMessage = { role: 'assistant', content: data.reply }
    setMessages([initialMessage])
    setLoading(false)
  }

  const extractAndSaveHealthUpdates = async (conversationMessages) => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      const { data: { session } } = await supabase.auth.getSession()
      
      const extractionResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || '',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1000,
          system: `You are a medical data extraction assistant.
Review this pre-appointment conversation and extract any NEW health information not already in the patient's profile.
Return ONLY a JSON object with these fields (omit any field where nothing new was mentioned):
{
  "new_symptoms": "comma separated list of new symptoms mentioned",
  "medication_changes": "any changes, new medications, or side effects mentioned",
  "resolved_issues": "anything the patient says has improved or resolved",
  "new_concerns": "any new worries or questions they raised",
  "health_story_addition": "a 2-3 sentence paragraph summarising what was NEW in this conversation to append to their health story"
}

CURRENT PROFILE FOR REFERENCE:
Known health problems: ${profile.known_health_problems || 'None'}
Medications: ${profile.medications || 'None'}
Health story: ${profile.health_story || 'None'}

Only return NEW information not already captured. Return valid JSON only, no other text.`,
          messages: [
            {
              role: 'user',
              content: `Pre-appointment conversation:\n${conversationMessages.map(m => `${m.role}: ${m.content}`).join('\n')}`
            }
          ]
        })
      })

      const data = await extractionResponse.json()
      const text = data.content?.[0]?.text?.trim() || '{}'

      try {
        const updates = JSON.parse(text)
        const profileUpdates = { last_updated: new Date().toISOString() }

        if (updates.new_symptoms && profile.known_health_problems) {
          profileUpdates.known_health_problems = profile.known_health_problems + ', ' + updates.new_symptoms
        } else if (updates.new_symptoms) {
          profileUpdates.known_health_problems = updates.new_symptoms
        }

        if (updates.medication_changes && profile.medications) {
          profileUpdates.medications = profile.medications + ' — ' + updates.medication_changes
        }

        if (updates.health_story_addition && profile.health_story) {
          profileUpdates.health_story = profile.health_story + '\n\n' + updates.health_story_addition
        } else if (updates.health_story_addition) {
          profileUpdates.health_story = updates.health_story_addition
        }

        if (Object.keys(profileUpdates).length > 1) {
          await supabase
            .from('profiles')
            .update(profileUpdates)
            .eq('id', user.id)
        }
      } catch (parseError) {
        console.error('Failed to parse health extraction:', text)
      }
    } catch (error) {
      console.error('Health extraction error:', error)
    }
  }

  const exitPreAppointmentMode = async () => {
    // Clear upcoming appointment from profile
    await supabase
      .from('profiles')
      .update({
        upcoming_appointment_type: null,
        upcoming_appointment_date: null,
        upcoming_appointment_focus: null
      })
      .eq('id', user.id)

    setIsPreAppointmentMode(false)
    setPreAppointmentConversationId(null)
    setAppointmentType('')
    setAppointmentDate('')
    setAppointmentFocus('')
    
    // Reload general conversation
    loadConversation(user.id)
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
          <button
            onClick={handleLogout}
            className="text-sm font-medium text-gray-500 hover:text-red-500 bg-white/60 hover:bg-white border border-gray-100 px-3 py-1.5 rounded-xl transition-colors shadow-sm"
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Pre-Appointment Mode Banner */}
      {isPreAppointmentMode && (
        <div className="bg-teal-600 text-white px-4 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2 max-w-2xl mx-auto w-full">
            <span className="text-lg">📋</span>
            <span className="text-sm font-medium">
              Preparing for {appointmentType} · {appointmentDate && new Date(appointmentDate).toLocaleDateString('en-NZ')}
            </span>
            <button 
              onClick={exitPreAppointmentMode}
              className="ml-auto text-white hover:bg-teal-700 rounded-full w-6 h-6 flex items-center justify-center text-lg transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 max-w-2xl mx-auto w-full">
        {/* Social Proof Banner - shown at top of chat */}
        {messages.length === 0 && (
          <div className="mb-4">
            <SocialProofBanner />
          </div>
        )}
        
        {/* Compact banner shown after first interaction */}
        {messages.length > 0 && messages.length < 5 && (
          <div className="mb-4">
            <SocialProofBanner variant="compact" />
          </div>
        )}
        
        {messages.map((msg, i) => {
          const isPrepComplete = isPreAppointmentMode && msg.role === 'assistant' && msg.content.includes('Head to your Summary page and press Update')
          
          return (
            <div key={i}>
              <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
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
              
              {/* Go to Summary Button */}
              {isPrepComplete && (
                <div className="flex justify-center mt-3">
                  <button
                    onClick={() => router.push('/summary')}
                    className="bg-teal-600 hover:bg-teal-700 text-white rounded-2xl px-6 py-3 text-base font-semibold shadow-md transition-colors w-full max-w-xs"
                  >
                    📄 Go to Summary & Update →
                  </button>
                </div>
              )}
            </div>
          )
        })}
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
        <div className="max-w-2xl mx-auto space-y-2">
          {/* Pre-Appointment Button */}
          {!isPreAppointmentMode && (
            <button
              onClick={() => setShowAppointmentModal(true)}
              className="w-full bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 rounded-2xl px-4 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <span>📋</span>
              Prep for an Appointment
            </button>
          )}
          
          <div className="flex gap-2">
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
        </div>
        <p className="text-center text-xs text-gray-400 mt-2">SignalHealth does not diagnose conditions or replace medical care.</p>
      </div>

      {/* Appointment Details Modal */}
      {showAppointmentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-xl font-bold text-gray-900">Upcoming Appointment</h2>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Appointment Type *
                </label>
                <input
                  type="text"
                  placeholder="e.g. GP, Cardiologist, Physio, Dentist"
                  value={appointmentType}
                  onChange={e => setAppointmentType(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-base text-gray-900 placeholder-gray-400 outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Appointment Date *
                </label>
                <input
                  type="date"
                  value={appointmentDate}
                  onChange={e => setAppointmentDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-base text-gray-900 outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Anything specific you want to discuss? (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. my headaches, medication review"
                  value={appointmentFocus}
                  onChange={e => setAppointmentFocus(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-base text-gray-900 placeholder-gray-400 outline-none focus:border-teal-500"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowAppointmentModal(false)}
                className="flex-1 border border-gray-200 text-gray-600 rounded-2xl py-3 text-base font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleStartPrep}
                disabled={!appointmentType || !appointmentDate}
                className="flex-1 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl py-3 text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Start Prep
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Onboarding Modal */}
      {showOnboardingModal && (
        <CheckInOnboardingModal onClose={() => setShowOnboardingModal(false)} />
      )}
    </div>
  )
}