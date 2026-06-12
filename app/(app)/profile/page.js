'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'

export default function ProfilePage() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const getProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = '/login'
        return
      }
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      setProfile(data)
      setLoading(false)
    }
    getProfile()
  }, [])

  // Safely strips [" "] brackets and formats database array structures into clean text
  const formatProfileValue = (val) => {
    if (!val) return null

    // 1. If it's already a native JavaScript array, join them with commas
    if (Array.isArray(val)) {
      return val.length > 0 ? val.join(', ') : null
    }

    // 2. If it's stored as a stringified JSON array string, parse it first
    if (typeof val === 'string' && val.trim().startsWith('[')) {
      try {
        const parsed = JSON.parse(val)
        if (Array.isArray(parsed)) {
          return parsed.length > 0 ? parsed.join(', ') : null
        }
      } catch (e) {
        // Fallback if parsing fails
      }
    }

    // 3. If it's just a normal plain string text or number, leave it exactly as is
    return val
  }

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <p className="text-gray-400 text-lg">Loading your profile...</p>
    </div>
  )

  // We wrap each item with formatProfileValue() right here at the definition layer
  const fields = [
    { label: 'Name', value: formatProfileValue(profile?.name) },
    { label: 'Age', value: formatProfileValue(profile?.age) },
    { label: 'Gender', value: formatProfileValue(profile?.gender) },
    { label: 'Ethnicity', value: formatProfileValue(profile?.ethnicity) },
    { label: 'Medications', value: formatProfileValue(profile?.medications) },
    { label: 'Known health problems', value: formatProfileValue(profile?.known_health_problems) },
    { label: 'Family history', value: formatProfileValue(profile?.family_history) },
    { label: 'Allergies', value: formatProfileValue(profile?.allergies) },
    { label: 'Alcohol and smoking', value: formatProfileValue(profile?.alcohol_and_smoking) },
    { label: 'Surgeries', value: formatProfileValue(profile?.surgeries) },
  ]

  return (
    <div className="flex flex-col min-h-screen pb-20 bg-gray-50">
      
      {/* Branded Header Banner */}
      <div className="bg-teal-50 border-b border-teal-100/30 px-4 py-4 text-center sm:text-left">
        <div className="max-w-2xl mx-auto w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center justify-center sm:justify-start gap-2.5">
            <div className="w-9 h-9 rounded-full bg-teal-700 flex items-center justify-center shadow-sm flex-shrink-0">
              <span className="text-white text-base font-bold">♥</span>
            </div>
            <div className="text-left">
              <span className="text-lg font-bold tracking-tight text-gray-950">
                Signal<span className="text-teal-700">Health</span>
              </span>
              <p className="text-xs text-gray-500 font-medium">My Health Profile</p>
            </div>
          </div>
          
          <span className="hidden sm:block text-xs font-semibold text-teal-700 bg-teal-100/60 px-3 py-1 rounded-full border border-teal-200/50">
            Confidential
          </span>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4 max-w-2xl mx-auto w-full">

        {/* Helpful Tip Banner for changing profile data */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start space-x-3 shadow-sm">
          <span className="text-xl mt-0.5">💡</span>
          <div>
            <h3 className="text-sm font-semibold text-amber-900">Need to make adjustments?</h3>
            <p className="text-sm text-amber-800 mt-0.5 leading-relaxed">
              To alter your profile, just let me know in the chat!
            </p>
          </div>
        </div>

        {/* Health Summary */}
        {profile?.health_summary && (
          <div className="bg-teal-50 border border-teal-100 rounded-2xl p-4 shadow-sm">
            <h2 className="text-base font-semibold text-teal-800 mb-2">Health Summary</h2>
            <p className="text-sm text-teal-700 leading-relaxed font-medium italic">
              "Built from your conversations with SignalHealth"
            </p>
            <p className="text-sm text-teal-700 leading-relaxed mt-2">{profile.health_summary}</p>
          </div>
        )}

        {/* Personal Details */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50 bg-gray-50/30">
            <h2 className="text-base font-semibold text-gray-800">Personal Details</h2>
          </div>
          {fields.slice(0, 4).map((field, i) => (
            <div key={i} className={`px-4 py-3.5 flex justify-between items-start ${i !== 3 ? 'border-b border-gray-50' : ''}`}>
              <span className="text-sm text-gray-500 w-1/2">{field.label}</span>
              <span className="text-sm text-gray-800 font-medium text-right w-1/2">
                {field.value || <span className="text-gray-300">Not recorded</span>}
              </span>
            </div>
          ))}
        </div>

        {/* Medical Information */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50 bg-gray-50/30">
            <h2 className="text-base font-semibold text-gray-800">Medical Information</h2>
          </div>
          {fields.slice(4).map((field, i) => (
            <div key={i} className={`px-4 py-3.5 flex justify-between items-start ${i !== fields.slice(4).length - 1 ? 'border-b border-gray-50' : ''}`}>
              <span className="text-sm text-gray-500 w-1/2">{field.label}</span>
              <span className="text-sm text-gray-800 font-medium text-right w-1/2">
                {field.value || <span className="text-gray-300">Not recorded</span>}
              </span>
            </div>
          ))}
        </div>

        {/* Health Story */}
        {profile?.health_story && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <h2 className="text-base font-semibold text-gray-800 mb-2">Health Story</h2>
            <p className="text-sm text-gray-600 leading-relaxed">{profile.health_story}</p>
          </div>
        )}

        <p className="text-xs text-gray-400 text-center pb-4 italic">
          This profile is updated automatically as you chat with SignalHealth
        </p>
      </div>
    </div>
  )
}