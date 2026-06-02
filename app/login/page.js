'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  // Automatically redirect users to the chat if they are already signed in
  useEffect(() => {
    const checkUserSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        window.location.href = '/chat'
      }
    }
    
    checkUserSession()

    // Also listen for any automatic background login state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        window.location.href = '/chat'
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleAuth = async () => {
    setLoading(true)
    setMessage('')

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setMessage(error.message)
      } else {
        setMessage('Check your email to confirm your account!')
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setMessage(error.message)
      } else {
        window.location.href = '/chat'
      }
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">
      
      {/* 1. Hero Section */}
      <div className="px-6 pt-12 pb-14 bg-emerald-50 text-center border-b border-emerald-100/30">
        
        {/* Prominent Brand Logo Header */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center shadow-sm">
            <span className="text-white text-base font-bold">♥</span>
          </div>
          <span className="text-xl font-bold tracking-tight text-gray-950">
            Signal<span className="text-emerald-600">Health</span>
          </span>
        </div>

        <div className="inline-block px-3 py-1 mb-5 text-xs font-semibold tracking-wider uppercase text-emerald-700 bg-emerald-100/80 rounded-full">
          Early Access Participant
        </div>
        
        <h1 className="text-3xl font-extrabold leading-tight text-gray-900 mb-4 max-w-xl mx-auto">
          Understand your health before something gets missed.
        </h1>
        <p className="text-base text-gray-600 max-w-md mx-auto mb-8 leading-relaxed">
          SignalHealth checks in regularly, builds your health story over time, and helps you know what’s worth discussing with a clinician.
        </p>
        <a href="#auth-box" className="inline-block px-8 py-4 bg-emerald-600 text-white font-bold rounded-2xl shadow-md hover:bg-emerald-700 transition-all">
          Get Started
        </a>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-12 space-y-16">
        
        {/* 2. "What it does" Section */}
        <section>
          <h2 className="text-xl font-bold mb-6 text-gray-900">Healthcare shouldn't rely on one-off conversations.</h2>
          <div className="grid gap-4">
            {[
              "Checks in with you regularly",
              "Builds a personalised picture of your health over time",
              "Asks targeted questions based on your background and symptoms",
              "Helps you recognise patterns you might not notice",
              "Informs you what your doctor would like to know"
            ].map((item, i) => (
              <div key={i} className="flex items-center space-x-3 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <span className="text-emerald-600 font-bold text-lg">✓</span>
                <span className="text-gray-700 font-medium text-base">{item}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 3. The "Why it Matters" Section */}
        <section className="bg-emerald-950 text-white p-8 rounded-3xl shadow-md">
          <h2 className="text-xl font-bold mb-4">They miss it because no one is connecting the dots.</h2>
          <p className="text-emerald-100/90 leading-relaxed mb-6 text-base">
            Ongoing fatigue, poor sleep, subtle changes—these are easy to overlook in day-to-day life, and hard to communicate in a short appointment.
          </p>
          <p className="text-lg font-semibold text-emerald-400 italic">
            SignalHealth helps you notice earlier and explain it clearly.
          </p>
        </section>

        {/* 4. Prepare for Appointments Section */}
        <section className="text-center">
          <h2 className="text-xl font-bold mb-3 text-gray-900">Walk into appointments prepared.</h2>
          <p className="text-gray-600 text-base mb-6">
            SignalHealth turns your check-ins into a clear summary you can bring to your GP, including symptoms that matter and suggested discussion points.
          </p>
          <div className="grid grid-cols-2 gap-4 text-sm font-medium text-gray-600">
            <div className="p-3.5 bg-gray-50 border border-gray-100 rounded-xl">No more forgetting details</div>
            <div className="p-3.5 bg-gray-50 border border-gray-100 rounded-xl">No more vague explanations</div>
          </div>
        </section>

        {/* 5. Clean, Integrated Login/Signup Box */}
        <section id="auth-box" className="pt-12 border-t border-gray-100">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 w-full max-w-md mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <span className="text-emerald-600 text-lg">♥</span>
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">SignalHealth</h3>
                <p className="text-sm text-gray-500">Your health companion</p>
              </div>
            </div>

            <h4 className="text-lg font-medium text-gray-900 mb-6">
              {isSignUp ? 'Create your account' : 'Welcome back'}
            </h4>

            <div className="space-y-4">
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3.5 text-base outline-none focus:border-emerald-500 transition-colors"
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3.5 text-base outline-none focus:border-emerald-500 transition-colors"
              />

              {message && (
                <p className="text-sm font-medium text-emerald-600 bg-emerald-50 p-3 rounded-xl border border-emerald-100">{message}</p>
              )}

              <button
                onClick={handleAuth}
                disabled={loading}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl py-3.5 text-base font-semibold transition-colors disabled:opacity-50 shadow-sm"
              >
                {loading ? 'Please wait...' : isSignUp ? 'Create account' : 'Sign in'}
              </button>
            </div>

            <p className="text-sm text-gray-500 text-center mt-6">
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}
              <button
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-emerald-600 ml-1 font-medium hover:underline focus:outline-none"
              >
                {isSignUp ? 'Sign in' : 'Sign up'}
              </button>
            </p>
          </div>
        </section>

        <footer className="text-center pb-8 pt-4">
          <p className="text-xs text-gray-400">© 2026 SignalHealth — Built for better healthcare conversations.</p>
        </footer>
      </div>
    </div>
  )
}