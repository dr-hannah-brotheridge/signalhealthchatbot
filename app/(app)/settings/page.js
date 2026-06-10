'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'

export default function SettingsPage() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const [user, setUser] = useState(null)
  const [notificationPreferences, setNotificationPreferences] = useState({
    enabled: true,
    frequency: 'daily',
    days_of_week: [],
    day_of_month: 1,
    time: '09:00',
    timezone: 'UTC'
  })
  const [savingPreferences, setSavingPreferences] = useState(false)
  
  // Controls the legal text pop-up modals
  const [activeModal, setActiveModal] = useState(null)

  // Controls the password updating interface block
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Controls Account Deletion flow
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState('')

  const daysOfWeek = [
    { value: 0, label: 'Sun' },
    { value: 1, label: 'Mon' },
    { value: 2, label: 'Tue' },
    { value: 3, label: 'Wed' },
    { value: 4, label: 'Thu' },
    { value: 5, label: 'Fri' },
    { value: 6, label: 'Sat' }
  ]

  const timezones = [
    'UTC',
    'America/New_York',
    'America/Los_Angeles',
    'America/Chicago',
    'Europe/London',
    'Europe/Paris',
    'Asia/Tokyo',
    'Australia/Sydney',
    'Pacific/Auckland'
  ]

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error || !session) {
        window.location.replace('/login')
        return
      }

      setUser(session.user)
      loadNotificationPreferences(session.user.id)
    }
    
    checkAuth()
  }, [])

  const loadNotificationPreferences = async (userId) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/notification-preferences', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })
      const data = await res.json()
      
      if (data.preferences) {
        setNotificationPreferences(data.preferences)
      }
    } catch (error) {
      console.error('Error loading notification preferences:', error)
    }
  }

  const handleSaveNotificationPreferences = async () => {
    setSavingPreferences(true)
    setMessage('')
    setIsError(false)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/notification-preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(notificationPreferences)
      })
      
      const data = await res.json()
      
      if (data.success) {
        setMessage('Notification preferences saved successfully!')
      } else {
        setIsError(true)
        setMessage(data.error || 'Failed to save preferences')
      }
    } catch (error) {
      setIsError(true)
      setMessage('Failed to save preferences')
    } finally {
      setSavingPreferences(false)
    }
  }

  const handleDayToggle = (dayValue) => {
    setNotificationPreferences(prev => ({
      ...prev,
      days_of_week: prev.days_of_week.includes(dayValue)
        ? prev.days_of_week.filter(d => d !== dayValue)
        : [...prev.days_of_week, dayValue]
    }))
  }

  function getOrdinalSuffix(day) {
    if (day > 3 && day < 21) return 'th'
    switch (day % 10) {
      case 1: return 'st'
      case 2: return 'nd'
      case 3: return 'rd'
      default: return 'th'
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const handleUpdatePassword = async (e) => {
    e.preventDefault()
    loading(true)
    setMessage('')
    setIsError(false)

    // Form matching validation check
    if (newPassword !== confirmPassword) {
      setIsError(true)
      setMessage('Passwords do not match.')
      setLoading(false)
      return
    }

    if (newPassword.length < 6) {
      setIsError(true)
      setMessage('Password must be at least 6 characters.')
      setLoading(false)
      return
    }

    // Direct update call to Supabase Auth engine
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    })

    if (error) {
      setIsError(true)
      setMessage(error.message)
    } else {
      setMessage('Password updated successfully!')
      setNewPassword('')
      setConfirmPassword('')
      setIsChangingPassword(false)
    }
    setLoading(false)
  }

  const handleDeleteAccount = async (e) => {
    e.preventDefault()
    if (deleteConfirmationInput !== 'DELETE') {
      setIsError(true)
      setMessage('Please type DELETE to confirm.')
      return
    }

    setLoading(true)
    setMessage('')
    setIsError(false)

    // Invokes the secure database function we created in Step 1
    const { error } = await supabase.rpc('delete_user_account')

    if (error) {
      setIsError(true)
      setMessage(error.message)
      setLoading(false)
    } else {
      // Clear out the auth session client-side and kick them back out to login
      await supabase.auth.signOut()
      window.location.href = '/login'
    }
  }

  // Content for the legal modals
  const modalContent = {
    about: {
      title: "About SignalHealth",
      text: `SignalHealth is an AI health companion that checks in with users over time, builds their health story, spots patterns, and helps them prepare for better conversations with clinicians.

Instead of waiting for users to ask medical questions, it regularly checks in with them, builds a personalised health profile, and asks targeted questions based on their age, background, medical history, symptoms, and risk factors.
Over time, it helps identify patterns that may otherwise be missed, such as persistent fatigue, sleep issues, pain, medication changes, cognitive changes, or symptoms worth discussing with a GP. 
It does not replace medical care or diagnose conditions. Its role is to help users notice changes earlier, understand what information may be important, and prepare a clear summary to take to healthcare appointments.`
    },
    disclaimer: {
      title: "Medical Disclaimer",
      text: `SignalHealth - Medical Disclaimer

1. Not Medical Advice
SignalHealth is an artificial intelligence companion designed to assist you in tracking your personal health narrative and preparing summaries for your doctor. It does not provide medical advice, professional diagnosis, opinion, treatment, or services.

2. No Doctor-Patient Relationship
Your use of SignalHealth does not create a doctor-patient relationship between you and SignalHealth or its developers. The application is a tool to support, not replace, the relationship that exists between you and your general practitioner or other qualified healthcare professionals.

3. Do Not Delay Seeking Care
If you think you may have a medical emergency, call 111 (in New Zealand) or go to the nearest emergency room immediately. You should never disregard professional medical advice or delay seeking medical treatment because of something you have read or processed through SignalHealth.

4. Limitation of AI Capability
The health summaries and insights generated by SignalHealth are based on information you provide and are processed via artificial intelligence. AI can make mistakes, overlook nuances, or misinterpret descriptions. Always review your generated summaries carefully before sharing them with a medical professional.`
    },
    privacy: {
      title: "Privacy Policy",
      text: `SignalHealth - Privacy Policy
Last Updated: June 2026

1. Commitment to Privacy
We respect your privacy and are committed to protecting your personal and health information. This Privacy Policy explains how SignalHealth collects, uses, and safeguards your data in strict compliance with the New Zealand Privacy Act 2020 and the Health Information Privacy Code 2020.

2. Information We Collect
To provide our services, we collect the following information:
- Account Information: Your email and password provided during sign-up.
- Profile Information: Name, age, gender, ethnicity, medications, known health conditions, allergies, lifestyle factors, and medical history.
- Conversation Logs: The text-based chat messages exchanged between you and the SignalHealth AI companion.

3. How We Use Your Information
We use your information solely to:
- Maintain your personal health profile and history.
- Provide interactive AI conversations to help track your well-being.
- Generate structured GP summaries upon your direct request.
We do not sell, rent, or trade your personal or health data to any third parties.

4. Data Processing and Storage
Your profile information and chat history are securely stored in our database. Text information from your conversations is processed via secure Application Programming Interfaces (ABIs) to generate your health summaries. Data processed through these APIs is protected under strict commercial privacy terms and is not used to train public AI models.

5. Your Rights Under New Zealand Law
In accordance with the New Zealand Privacy Act 2020, you have the right to request access to any personal information we hold about you and to request corrections to that information. You can update your profile details or change your password directly within the application settings at any time.

6. Contact Us
If you have any questions about this Privacy Policy or wish to exercise your data access rights, please contact the developer via the official project channels.`
    },
    terms: {
      title: "Terms of Service",
      text: `SignalHealth - Terms of Service
Last Updated: June 2026

1. Acceptance of Terms
By accessing or using SignalHealth, you agree to be bound by these Terms of Service. If you do not agree to these terms, you must not use this application.

2. Description of Service
SignalHealth is a proactive AI health companion web application designed to help users track health insights, build a personal health profile, and organize summaries to assist with general practitioner (GP) consultations. SignalHealth does not provide medical advice, diagnosis, or treatment.

3. Eligibility and Accounts
 You must provide accurate and complete information when creating an account. You are solely responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.

4. User Conduct and Responsibilities
You agree to use SignalHealth only for lawful personal purposes. You must not use the service to input false, malicious, or intentionally misleading health data. 

5. Limitation of Liability
SignalHealth is provided on an as-is and as-available basis. To the maximum extent permitted by New Zealand law, SignalHealth and its developer shall not be liable for any direct, indirect, incidental, or consequential damages arising out of your use or inability to use the service.

6. Changes to Terms
We reserve the right to modify these terms at any time. Continued use of the application after changes are made constitutes your acceptance of the updated terms.`
    }
  }

  return (
    <div className="flex flex-col min-h-screen pb-20 bg-gray-50">
      
      {/* Branded Header Banner */}
      <div className="bg-emerald-50 border-b border-emerald-100/30 px-4 py-4">
        <div className="max-w-2xl mx-auto w-full flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center shadow-sm flex-shrink-0">
              <span className="text-white text-base font-bold">♥</span>
            </div>
            <div className="text-left">
              <span className="text-lg font-bold tracking-tight text-gray-950">
                Signal<span className="text-emerald-600">Health</span>
              </span>
              <p className="text-xs text-gray-500 font-medium">App Settings</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4 max-w-2xl mx-auto w-full">

        {/* Account Controls Card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50 bg-gray-50/30">
            <h2 className="text-base font-semibold text-gray-800">Account</h2>
          </div>
          
          {/* Change Password Menu Trigger */}
          <button 
            onClick={() => {
              setIsChangingPassword(!isChangingPassword);
              setIsDeletingAccount(false);
              setMessage('');
            }} 
            className="w-full px-4 py-4 flex justify-between items-center border-b border-gray-50 hover:bg-gray-50 transition-colors group"
          >
            <span className="text-base text-gray-700">Change Password</span>
            <span className={`text-gray-300 group-hover:text-gray-400 transition-transform duration-200 ${isChangingPassword ? 'rotate-90' : ''}`}>›</span>
          </button>

          {/* Secure Interactive New Password Form Block */}
          {isChangingPassword && (
            <form onSubmit={handleUpdatePassword} className="p-4 bg-gray-50/50 border-b border-gray-50 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-12 text-sm bg-white outline-none focus:border-emerald-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-base text-gray-400 hover:text-gray-600 focus:outline-none select-none"
                >
                  {showPassword ? '⌣' : '👁'}
                </button>
              </div>

              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Repeat new password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white outline-none focus:border-emerald-500 transition-colors"
              />

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl py-2.5 transition-colors disabled:opacity-50 shadow-sm"
                >
                  {loading ? 'Saving...' : 'Save New Password'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsChangingPassword(false);
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                  className="px-4 bg-white border border-gray-200 text-gray-500 font-medium text-sm rounded-xl py-2.5 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Logout Button */}
          <button onClick={handleLogout} className="w-full px-4 py-4 flex justify-between items-center border-b border-gray-50 hover:bg-gray-50 transition-colors group">
            <span className="text-base text-gray-700">Sign Out</span>
            <span className="text-gray-300 group-hover:text-gray-400 transition-colors">›</span>
          </button>

          {/* Delete Account Expandable Toggle */}
          <button 
            type="button"
            onClick={() => {
              setIsDeletingAccount(!isDeletingAccount);
              setIsChangingPassword(false);
              setMessage('');
              setDeleteConfirmationInput('');
            }} 
            className="w-full px-4 py-4 flex justify-between items-center hover:bg-red-50/30 transition-colors group"
          >
            <span className="text-base text-red-500 font-medium">Delete Account</span>
            <span className={`text-red-300 group-hover:text-red-400 transition-transform duration-200 ${isDeletingAccount ? 'rotate-90 text-red-500' : ''}`}>›</span>
          </button>

          {/* Delete Account Confirmation Block */}
          {isDeletingAccount && (
            <form onSubmit={handleDeleteAccount} className="p-4 bg-red-50/40 border-t border-gray-100 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-red-600 uppercase tracking-wider">Warning: This action is irreversible</p>
                <p className="text-sm text-gray-600">All data associated with your healthcare summaries, profiles, and chats will be permanently wiped.</p>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-gray-500 block font-medium">
                  Type <span className="font-bold text-gray-800">DELETE</span> below to confirm your request:
                </label>
                <input
                  type="text"
                  placeholder="DELETE"
                  value={deleteConfirmationInput}
                  onChange={e => setDeleteConfirmationInput(e.target.value)}
                  required
                  className="w-full border border-red-200 rounded-xl px-4 py-3 text-sm bg-white outline-none focus:border-red-500 transition-colors tracking-wide font-medium"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={loading || deleteConfirmationInput !== 'DELETE'}
                  className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white font-semibold text-sm rounded-xl py-2.5 transition-colors shadow-sm"
                >
                  {loading ? 'Deleting Profile...' : 'Permanently Delete Account'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsDeletingAccount(false);
                    setDeleteConfirmationInput('');
                  }}
                  className="px-4 bg-white border border-gray-200 text-gray-500 font-medium text-sm rounded-xl py-2.5 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Notification Preferences Card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50 bg-gray-50/30">
            <h2 className="text-base font-semibold text-gray-800">Notification Preferences</h2>
          </div>
          
          {/* Enable/Disable Toggle */}
          <div className="px-4 py-4 border-b border-gray-50">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-base text-gray-700">Enable Notifications</span>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={notificationPreferences.enabled}
                  onChange={async (e) => {
                    const newEnabled = e.target.checked
                    setNotificationPreferences(prev => ({ ...prev, enabled: newEnabled }))
                    
                    // Auto-save immediately
                    setMessage('')
                    setIsError(false)
                    try {
                      const { data: { session } } = await supabase.auth.getSession()
                      const res = await fetch('/api/notification-preferences', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${session.access_token}`
                        },
                        body: JSON.stringify({ ...notificationPreferences, enabled: newEnabled })
                      })
                      const data = await res.json()
                      
                      if (data.success) {
                        setMessage(newEnabled ? 'Notifications enabled!' : 'Notifications disabled!')
                      } else {
                        setIsError(true)
                        setMessage(data.error || 'Failed to update')
                        // Revert on error
                        setNotificationPreferences(prev => ({ ...prev, enabled: !newEnabled }))
                      }
                    } catch (error) {
                      setIsError(true)
                      setMessage('Failed to update')
                      // Revert on error
                      setNotificationPreferences(prev => ({ ...prev, enabled: !newEnabled }))
                    }
                  }}
                  className="sr-only"
                />
                <div className={`w-14 h-8 rounded-full transition-colors ${
                  notificationPreferences.enabled ? 'bg-emerald-600' : 'bg-gray-300'
                }`}>
                  <div className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform ${
                    notificationPreferences.enabled ? 'translate-x-6' : 'translate-x-1'
                  } mt-1`}></div>
                </div>
              </div>
            </label>
          </div>

          {notificationPreferences.enabled && (
            <>
              {/* Frequency Selector */}
              <div className="px-4 py-4 border-b border-gray-50">
                <label className="block text-sm font-medium text-gray-700 mb-2">Frequency</label>
                <select
                  value={notificationPreferences.frequency}
                  onChange={(e) => setNotificationPreferences(prev => ({ ...prev, frequency: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:border-emerald-400 focus:outline-none"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>

              {/* Days of Week (for weekly) */}
              {notificationPreferences.frequency === 'weekly' && (
                <div className="px-4 py-4 border-b border-gray-50">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Days</label>
                  <div className="grid grid-cols-7 gap-2">
                    {daysOfWeek.map(day => (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => handleDayToggle(day.value)}
                        className={`py-2 px-2 rounded-lg text-xs font-medium transition-colors ${
                          notificationPreferences.days_of_week.includes(day.value)
                            ? 'bg-emerald-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Day of Month (for monthly) */}
              {notificationPreferences.frequency === 'monthly' && (
                <div className="px-4 py-4 border-b border-gray-50">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Day of Month</label>
                  <select
                    value={notificationPreferences.day_of_month}
                    onChange={(e) => setNotificationPreferences(prev => ({ ...prev, day_of_month: parseInt(e.target.value) }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:border-emerald-400 focus:outline-none"
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                      <option key={day} value={day}>{day}{getOrdinalSuffix(day)}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Time Picker */}
              <div className="px-4 py-4 border-b border-gray-50">
                <label className="block text-sm font-medium text-gray-700 mb-2">Time</label>
                <input
                  type="time"
                  value={notificationPreferences.time}
                  onChange={(e) => setNotificationPreferences(prev => ({ ...prev, time: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:border-emerald-400 focus:outline-none"
                />
              </div>

              {/* Timezone Selector */}
              <div className="px-4 py-4 border-b border-gray-50">
                <label className="block text-sm font-medium text-gray-700 mb-2">Timezone</label>
                <select
                  value={notificationPreferences.timezone}
                  onChange={(e) => setNotificationPreferences(prev => ({ ...prev, timezone: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:border-emerald-400 focus:outline-none"
                >
                  {timezones.map(tz => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
              </div>

              {/* Save Button */}
              <div className="px-4 py-4">
                <button
                  onClick={handleSaveNotificationPreferences}
                  disabled={savingPreferences}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl py-3 transition-colors disabled:opacity-50 shadow-sm"
                >
                  {savingPreferences ? 'Saving...' : 'Save Preferences'}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Global Operational Message Box */}
        {message && (
          <p className={`text-sm font-medium text-center py-2.5 px-4 rounded-xl border animate-in fade-in slide-in-from-top-1 ${
            isError 
              ? 'text-red-600 bg-red-50 border-red-100' 
              : 'text-emerald-600 bg-emerald-50 border-emerald-100'
          }`}>
            {message}
          </p>
        )}

        {/* Application Information Cards */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50 bg-gray-50/30">
            <h2 className="text-base font-semibold text-gray-800">Information</h2>
          </div>
          <button onClick={() => setActiveModal('about')} className="w-full px-4 py-4 flex justify-between items-center border-b border-gray-50 hover:bg-gray-50 transition-colors group">
            <span className="text-base text-gray-700">About SignalHealth</span>
            <span className="text-gray-300 group-hover:text-gray-400 transition-colors">›</span>
          </button>
          <button onClick={() => setActiveModal('disclaimer')} className="w-full px-4 py-4 flex justify-between items-center border-b border-gray-50 hover:bg-gray-50 transition-colors group">
            <span className="text-base text-gray-700">Medical Disclaimer</span>
            <span className="text-gray-300 group-hover:text-gray-400 transition-colors">›</span>
          </button>
          <button onClick={() => setActiveModal('privacy')} className="w-full px-4 py-4 flex justify-between items-center border-b border-gray-50 hover:bg-gray-50 transition-colors group">
            <span className="text-base text-gray-700">Privacy Policy</span>
            <span className="text-gray-300 group-hover:text-gray-400 transition-colors">›</span>
          </button>
          <button onClick={() => setActiveModal('terms')} className="w-full px-4 py-4 flex justify-between items-center hover:bg-gray-50 transition-colors group">
            <span className="text-base text-gray-700">Terms of Service</span>
            <span className="text-gray-300 group-hover:text-gray-400 transition-colors">›</span>
          </button>
        </div>

        <p className="text-xs text-gray-400 text-center italic">SignalHealth v1.0 — Built by Dr Hannah Brotheridge in NZ</p>

      </div>

      {/* Pop-up Info Modal Component */}
      {activeModal && modalContent[activeModal] && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-2xl rounded-t-3xl sm:rounded-2xl max-h-[85vh] sm:max-h-[80vh] flex flex-col shadow-xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-3xl sm:rounded-t-2xl">
              <h2 className="text-lg font-bold text-gray-900">{modalContent[activeModal].title}</h2>
              <button 
                onClick={() => setActiveModal(null)}
                className="w-8 h-8 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center text-lg font-bold hover:bg-gray-300 transition-colors"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Modal Scrollable Text Content */}
            <div className="p-6 overflow-y-auto text-left">
              <pre className="whitespace-pre-wrap font-sans text-base text-gray-700 leading-relaxed tracking-normal">
                {modalContent[activeModal].text}
              </pre>
            </div>

            {/* Modal Footer Close Button */}
            <div className="p-4 border-t border-gray-100 bg-white sticky bottom-0 rounded-b-2xl">
              <button 
                onClick={() => setActiveModal(null)}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-base rounded-xl transition-colors shadow-sm"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}