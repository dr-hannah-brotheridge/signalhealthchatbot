'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import SocialProofBanner from '../components/SocialProofBanner'
import { calculateProfileCompletion } from '../../../lib/profileCompletion'
import { jsPDF } from 'jspdf'

export default function ProfilePage() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [completion, setCompletion] = useState({ percentage: 0, completed: 0, total: 10 })
  const [showCheckInPrompt, setShowCheckInPrompt] = useState(false)
  const [healthStoryExpanded, setHealthStoryExpanded] = useState(false)
  const [activeSymptoms, setActiveSymptoms] = useState([])

  const downloadHealthStoryPDF = () => {
    if (!profile?.health_story) return

    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 20
    const maxWidth = pageWidth - (margin * 2)
    
    // Add header
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('SignalHealth', margin, 20)
    
    doc.setFontSize(14)
    doc.setFont('helvetica', 'normal')
    doc.text('Health Story', margin, 30)
    
    // Add patient info
    doc.setFontSize(10)
    doc.text(`Patient: ${profile.name || 'Not recorded'}`, margin, 40)
    doc.text(`Date: ${new Date().toLocaleDateString('en-NZ')}`, margin, 46)
    
    // Add line separator
    doc.setLineWidth(0.5)
    doc.line(margin, 52, pageWidth - margin, 52)
    
    // Add health story content
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    
    const paragraphs = profile.health_story.split('\n\n')
    let yPosition = 62
    
    paragraphs.forEach((paragraph, index) => {
      if (paragraph.trim()) {
        const lines = doc.splitTextToSize(paragraph, maxWidth)
        
        // Check if we need a new page
        if (yPosition + (lines.length * 6) > pageHeight - margin) {
          doc.addPage()
          yPosition = margin
        }
        
        doc.text(lines, margin, yPosition)
        yPosition += (lines.length * 6) + 6 // Add spacing between paragraphs
      }
    })
    
    // Add footer
    doc.setFontSize(8)
    doc.setTextColor(128, 128, 128)
    doc.text(
      'This document is generated from SignalHealth and should be reviewed with a qualified healthcare professional.',
      margin,
      pageHeight - 10,
      { maxWidth: maxWidth, align: 'center' }
    )
    
    // Download the PDF
    const fileName = `HealthStory_${profile.name?.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`
    doc.save(fileName)
  }

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
      
      // Calculate profile completion
      if (data) {
        const completionData = calculateProfileCompletion(data)
        setCompletion(completionData)
      }
      
      // Load active symptoms
      const { data: symptomsData } = await supabase
        .from('symptoms')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['active', 'monitoring'])
        .order('first_reported_at', { ascending: false })
      
      if (symptomsData) {
        setActiveSymptoms(symptomsData)
      }
      
      // Check if should show check-in prompt
      // Show prompt if notifications are disabled (regardless of modal state)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const res = await fetch('/api/notification-preferences', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        })
        const prefData = await res.json()
        
        // Show prompt if notifications are disabled
        if (!prefData.preferences?.enabled) {
          setShowCheckInPrompt(true)
        }
      } catch (error) {
        console.error('Error checking notification status:', error)
      }
      
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

        {/* Social Proof Banner */}
        <SocialProofBanner />

        {/* Check-in Reminder Prompt */}
        {showCheckInPrompt && (
          <a 
            href="/settings"
            className="block bg-gradient-to-r from-teal-50 to-blue-50 border border-teal-200 rounded-2xl p-4 hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">💡</span>
                <div>
                  <p className="text-sm font-semibold text-teal-900">Set up check-in reminders</p>
                  <p className="text-xs text-teal-700 mt-0.5">Keep your health profile growing over time</p>
                </div>
              </div>
              <span className="text-teal-600 group-hover:translate-x-1 transition-transform text-xl">→</span>
            </div>
          </a>
        )}

        {/* Profile Completion Tracker - Only show if less than 100% */}
        {completion.percentage < 100 && (
          <div className="bg-gradient-to-br from-teal-50 to-blue-50 border border-teal-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-start gap-3 mb-3">
              <span className="text-2xl mt-0.5">📊</span>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-semibold text-teal-900">Profile Completion</h3>
                  <span className="text-lg font-bold text-teal-700">{completion.percentage}%</span>
                </div>
                <p className="text-sm text-teal-800 leading-relaxed">
                  {completion.completed} of {completion.total} core fields completed
                </p>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="w-full bg-teal-100 rounded-full h-2.5 mb-3 overflow-hidden">
              <div 
                className="bg-teal-600 h-2.5 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${completion.percentage}%` }}
              />
            </div>
            
            {/* Helpful message */}
            <div className="flex items-start gap-2">
              <span className="text-base mt-0.5">💡</span>
              <p className="text-sm text-teal-800 leading-relaxed">
                <strong>Want to complete or update your profile?</strong> Check what's missing below and let me know in the chat!
              </p>
            </div>
          </div>
        )}

        {/* Currently Tracking */}
        {activeSymptoms && activeSymptoms.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <h2 className="text-base font-semibold text-gray-800 mb-3">Currently Tracking</h2>
            <div className="space-y-2">
              {activeSymptoms.map(symptom => (
                <div key={symptom.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800 capitalize">{symptom.symptom_name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Since {new Date(symptom.first_reported_at).toLocaleDateString('en-NZ', {
                        day: 'numeric',
                        month: 'long'
                      })}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-3 py-1 rounded-full ${
                    symptom.status === 'monitoring' 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'bg-green-100 text-green-700'
                  }`}>
                    {symptom.status === 'monitoring' ? '👁 monitoring' : '🔄 active'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Health Summary */}
        {profile?.health_summary && (
          <div className="bg-teal-50 border border-teal-100 rounded-2xl p-4 shadow-sm">
            <h2 className="text-base font-semibold text-teal-800 mb-2">Health Summary</h2>
            <p className="text-sm text-teal-700 leading-relaxed font-medium italic mb-3">
              "Built from your conversations with SignalHealth"
            </p>
            <div className="text-sm text-teal-700 leading-relaxed space-y-3">
              {profile.health_summary.split('\n\n').map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
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
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-gray-800">Health Story</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={downloadHealthStoryPDF}
                  className="text-teal-600 hover:text-teal-700 text-sm font-medium flex items-center gap-1 transition-colors"
                  title="Download as PDF"
                >
                  <span>📥</span>
                  <span>Download PDF</span>
                </button>
                <span className="text-gray-300">|</span>
                <button
                  onClick={() => setHealthStoryExpanded(!healthStoryExpanded)}
                  className="text-teal-600 hover:text-teal-700 text-sm font-medium flex items-center gap-1 transition-colors"
                >
                  {healthStoryExpanded ? (
                    <>
                      <span>Show less</span>
                      <span className="transform rotate-180 transition-transform">▼</span>
                    </>
                  ) : (
                    <>
                      <span>Read more</span>
                      <span>▼</span>
                    </>
                  )}
                </button>
              </div>
            </div>
            
            <div className={`text-sm text-gray-600 leading-relaxed space-y-3 ${!healthStoryExpanded ? 'line-clamp-3' : ''}`}>
              {profile.health_story.split('\n\n').map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
            
            {!healthStoryExpanded && profile.health_story.length > 200 && (
              <div className="mt-2 text-xs text-gray-400 italic">
                Click "Read more" to see full story
              </div>
            )}
          </div>
        )}

        <p className="text-xs text-gray-400 text-center pb-4 italic">
          This profile is updated automatically as you chat with SignalHealth
        </p>
      </div>
    </div>
  )
}