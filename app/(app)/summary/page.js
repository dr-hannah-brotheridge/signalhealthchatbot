'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'

export default function SummaryPage() {
  const [profile, setProfile] = useState(null)
  const [summary, setSummary] = useState('')
  const [loading, setLoading] = useState(false)
  const [generated, setGenerated] = useState(false)
  const [user, setUser] = useState(null)
  const [shareMessage, setShareMessage] = useState('')

  useEffect(() => {
    const getProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = '/login'
        return
      }
      setUser(user)
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      setProfile(data)
      if (data?.gp_summary) {
        setSummary(data.gp_summary)
        setGenerated(true)
      }
    }
    getProfile()
  }, [])

  const generateSummary = async () => {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/summary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ profile, userId: user.id })
    })
    const data = await res.json()
    setSummary(data.summary)
    setGenerated(true)
    setLoading(false)
  }

  const handleShare = async () => {
    // Privacy confirmation
    const confirmed = window.confirm(
      '⚠️ You are about to share your health summary.\n\nThis contains sensitive medical information.\n\nOnly share with your healthcare provider or trusted individuals.\n\nContinue?'
    )
    
    if (!confirmed) return

    // Try Web Share API first (mobile devices)
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'SignalHealth GP Summary',
          text: summary,
        })
        setShareMessage('✅ Shared successfully!')
        setTimeout(() => setShareMessage(''), 3000)
      } catch (err) {
        // User cancelled or error occurred
        if (err.name !== 'AbortError') {
          console.error('Share failed:', err)
          // Fallback to clipboard
          handleCopyToClipboard()
        }
      }
    } else {
      // Fallback for desktop: Copy to clipboard
      handleCopyToClipboard()
    }
  }

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(summary)
      setShareMessage('✅ Summary copied to clipboard!')
      setTimeout(() => setShareMessage(''), 3000)
    } catch (err) {
      setShareMessage('❌ Failed to copy. Please try again.')
      setTimeout(() => setShareMessage(''), 3000)
    }
  }

  return (
    <div className="flex flex-col min-h-screen pb-20 bg-gray-50">
      
      {/* Branded Header Banner */}
      <div className="bg-teal-50 border-b border-teal-100/30 px-4 py-4">
        <div className="max-w-2xl mx-auto w-full flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-teal-700 flex items-center justify-center shadow-sm flex-shrink-0">
              <span className="text-white text-base font-bold">♥</span>
            </div>
            <div className="text-left">
              <span className="text-lg font-bold tracking-tight text-gray-950">
                Signal<span className="text-teal-700">Health</span>
              </span>
              <p className="text-xs text-gray-500 font-medium">GP Clinical Summary</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4 max-w-2xl mx-auto w-full">

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-sm text-gray-600 leading-relaxed">
            SignalHealth can generate a structured summary of your health profile and recent concerns that you can share with your healthcare provider.
          </p>
        </div>

        {!generated && (
          <button
            onClick={generateSummary}
            disabled={loading || !profile}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white rounded-2xl py-4 text-base font-semibold disabled:opacity-50 transition-colors shadow-sm"
          >
            {loading ? 'Generating your summary...' : 'Generate GP Summary'}
          </button>
        )}

        {generated && summary && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            <div className="border-b border-gray-50 pb-2">
              <h2 className="text-base font-semibold text-gray-800">Your GP Summary</h2>
            </div>
            <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap bg-gray-50/50 p-4 rounded-xl border border-gray-100 font-sans">
              {summary}
            </div>
            
            {/* Privacy Warning */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-xs text-amber-800 leading-relaxed">
                ⚠️ <strong>Privacy Notice:</strong> This summary contains personal health information. Only share with your healthcare provider or trusted individuals.
              </p>
            </div>

            {/* Share Message Feedback */}
            {shareMessage && (
              <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 animate-in fade-in slide-in-from-top-2 duration-200">
                <p className="text-sm text-teal-800 text-center font-medium">
                  {shareMessage}
                </p>
              </div>
            )}
            
            <div className="space-y-2 pt-2">
              {/* Primary Share Button */}
              <button
                onClick={handleShare}
                className="w-full bg-teal-700 hover:bg-teal-800 text-white rounded-2xl py-3 text-base font-semibold transition-colors shadow-sm flex items-center justify-center gap-2"
              >
                <span>📤</span>
                Share Summary
              </button>

              {/* Secondary Actions */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleCopyToClipboard}
                  className="border border-teal-500 text-teal-700 rounded-2xl py-3 text-sm font-medium hover:bg-teal-50 transition-colors"
                >
                  📋 Copy
                </button>
                <button
                  onClick={generateSummary}
                  disabled={loading}
                  className="border border-gray-200 text-gray-500 rounded-2xl py-3 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  {loading ? '⏳ Updating...' : '🔄 Update'}
                </button>
              </div>
            </div>
          </div>
        )}

        <p className="text-xs text-gray-400 text-center italic">
          This summary is generated from your health profile and conversations. Always review before sharing with a healthcare provider.
        </p>

      </div>
    </div>
  )
}