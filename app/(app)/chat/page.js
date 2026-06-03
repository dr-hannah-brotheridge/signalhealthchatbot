'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../../lib/supabase'

export default function ChatPage() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    const getUser = async () => {
      // 1. Check if the URL contains a recovery hash or access token from Supabase Auth
      if (window.location.hash.includes('type=recovery') || window.location.search.includes('type=recovery')) {
        // Kick them back to login immediately so the Login page's onAuthStateChange can handle it
        window.location.href = `/login${window.location.hash}${window.location.search}`
        return
      }

      // 2. Normal auth guard sequence
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = '/login'
        return
      }
      setUser(user)
      loadConversation(user.id)
    }
    getUser()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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
    window.location.href = '/login'
  }

  return (
    <div className="flex flex-col h-screen pb-16">
      
      {/* Brand Header Banner (Pale Green Layout) */}
      <div className="bg-emerald-50 border-b border-emerald-100/30 px-4 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center shadow-sm flex-shrink-0">
            <span className="text-white text-base font-bold">♥</span>
          </div>
          <div className="text-left">
            <span className="text-lg font-bold tracking-tight text-gray-950">
              Signal<span className="text-emerald-600">Health</span>
            </span>
            <p className="text-xs text-gray-500 font-medium">Your health companion</p>
          </div>
        </div>
        
        <button
          onClick={handleLogout}
          className="text-sm font-medium text-gray-500 hover:text-red-500 bg-white/60 hover:bg-white border border-gray-100 px-3 py-1.5 rounded-xl transition-colors shadow-sm"
        >
          Sign out
        </button>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 max-w-2xl mx-auto w-full">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`rounded-2xl px-4 py-3 max-w-xs lg:max-w-md text-base leading-relaxed ${
              msg.role === 'user'
                ? 'bg-emerald-500 text-white rounded-br-sm'
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

      {/* Chat Input Area */}
      <div className="bg-white border-t border-gray-100 px-4 py-3 pb-4">
        <div className="max-w-2xl mx-auto flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder="Type a message..."
            className="flex-1 border border-gray-200 rounded-2xl px-4 py-3 text-base outline-none focus:border-emerald-400"
          />
          <button
            onClick={sendMessage}
            disabled={loading}
            className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl px-5 py-3 text-base font-medium disabled:opacity-50 transition-colors"
          >
            Send
          </button>
        </div>
        <p className="text-center text-xs text-gray-400 mt-2">SignalHealth does not diagnose conditions or replace medical care.</p>
      </div>
    </div>
  )
}