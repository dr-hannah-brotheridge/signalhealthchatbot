'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'

export default function ChatPage() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    const getUser = async () => {
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
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [], userId })
  })
  const data = await res.json()
  const initialMessage = { role: 'assistant', content: data.reply }
  setMessages([initialMessage])
  await saveConversation(userId, [initialMessage])
  setLoading(false)
}

  const saveConversation = async (userId, msgs) => {
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('user_id', userId)
      .single()

    if (existing) {
      await supabase
        .from('conversations')
        .update({ messages: msgs, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
    } else {
      await supabase
        .from('conversations')
        .insert({ user_id: userId, messages: msgs })
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || loading) return
    const userMessage = { role: 'user', content: input }
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setInput('')
    setLoading(true)

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: updatedMessages, userId: user.id })
    })
    const data = await res.json()
    const assistantMessage = { role: 'assistant', content: data.reply }
    const finalMessages = [...updatedMessages, assistantMessage]
    setMessages(finalMessages)
    await saveConversation(user.id, finalMessages)
    setLoading(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
          <span className="text-emerald-600">♥</span>
        </div>
        <div className="flex-1">
          <h1 className="text-sm font-medium text-gray-900">SignalHealth</h1>
          <p className="text-xs text-gray-500">Your health companion</p>
        </div>
        <button
          onClick={handleLogout}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          Sign out
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 max-w-2xl mx-auto w-full">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`rounded-2xl px-4 py-3 max-w-xs lg:max-w-md text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-emerald-500 text-white rounded-br-sm'
                : 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm'
            }`}>
              {msg.content.replace(/\*\*(.*?)\*\*/g, '$1')}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
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

      <div className="bg-white border-t border-gray-100 px-4 py-3">
        <div className="max-w-2xl mx-auto flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder="Type a message..."
            className="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-emerald-400"
          />
          <button
            onClick={sendMessage}
            disabled={loading}
            className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50 transition-colors"
          >
            Send
          </button>
        </div>
        <p className="text-center text-xs text-gray-400 mt-2">SignalHealth does not diagnose conditions or replace medical care.</p>
      </div>
    </div>
  )
}