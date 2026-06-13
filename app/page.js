'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Link from 'next/link'

export default function LandingPage() {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session) {
        // User is logged in, redirect to main app
        window.location.href = '/chat'
      } else {
        setLoading(false)
      }
    }

    checkSession()

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && event === 'SIGNED_IN') {
        window.location.href = '/chat'
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-teal-700 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-white text-xl font-bold">♥</span>
          </div>
          <p className="text-slate-400 text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-gray-900 font-sans">
      
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-teal-700 flex items-center justify-center shadow-sm">
              <span className="text-white text-base font-bold">♥</span>
            </div>
            <span className="text-xl font-bold tracking-tight text-gray-950">
              Signal<span className="text-teal-700">Health</span>
            </span>
          </div>

          {/* Sign In Link */}
          <Link 
            href="/login"
            className="text-sm font-medium text-teal-700 hover:text-teal-800 hover:underline transition-colors"
          >
            Sign in
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-4xl mx-auto px-4 pt-16 pb-12 md:pt-24 md:pb-16 text-center">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-950 mb-6 leading-tight">
          Your Health Story,<br />
          <span className="text-teal-700">Remembered</span>
        </h1>
        
        <p className="text-lg md:text-xl text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed">
          SignalHealth builds a persistent health profile through natural conversation — so you never forget symptoms, spot patterns over time, and arrive at every appointment prepared.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link
            href="/login?mode=signup"
            className="w-full sm:w-auto bg-teal-700 hover:bg-teal-800 text-white rounded-xl px-8 py-4 text-lg font-semibold transition-all shadow-lg hover:shadow-xl active:scale-[0.98] focus:ring-2 focus:ring-teal-700/30 focus:ring-offset-2"
          >
            Get Started
          </Link>
          
          <Link
            href="/login"
            className="w-full sm:w-auto text-slate-600 hover:text-slate-800 text-base font-medium transition-colors"
          >
            Already have an account? <span className="text-teal-700 hover:underline">Sign in</span>
          </Link>
        </div>
      </section>

      {/* Key Benefits Section */}
      <section className="max-w-6xl mx-auto px-4 py-12 md:py-16">
        <div className="grid md:grid-cols-2 gap-6">
          
          {/* Benefit 1 */}
          <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-14 h-14 rounded-full bg-teal-50 flex items-center justify-center mb-5">
              <span className="text-3xl">🧠</span>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">
              Memory That Compounds
            </h3>
            <p className="text-base text-slate-600 leading-relaxed mb-2">
              Every check-in builds a richer health profile
            </p>
            <p className="text-sm text-slate-500 leading-relaxed">
              Unlike one-off symptom checkers, SignalHealth remembers. Each conversation makes your health story more complete and valuable.
            </p>
          </div>

          {/* Benefit 2 */}
          <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-14 h-14 rounded-full bg-teal-50 flex items-center justify-center mb-5">
              <span className="text-3xl">📄</span>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">
              GP-Ready Clinical Summaries
            </h3>
            <p className="text-base text-slate-600 leading-relaxed mb-2">
              Structured reports your doctor will appreciate
            </p>
            <p className="text-sm text-slate-500 leading-relaxed">
              Transform scattered memories into organized, shareable summaries that help you make the most of every 15-minute appointment.
            </p>
          </div>

          {/* Benefit 3 */}
          <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-14 h-14 rounded-full bg-teal-50 flex items-center justify-center mb-5">
              <span className="text-3xl">🔗</span>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">
              Connect the Dots Over Time
            </h3>
            <p className="text-base text-slate-600 leading-relaxed mb-2">
              Spot patterns you'd otherwise miss
            </p>
            <p className="text-sm text-slate-500 leading-relaxed">
              See connections between symptoms, triggers, and health events across weeks and months — not just snapshots of today.
            </p>
          </div>

          {/* Benefit 4 */}
          <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-14 h-14 rounded-full bg-teal-50 flex items-center justify-center mb-5">
              <span className="text-3xl">🛡️</span>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">
              Safe Escalation, No Diagnosis
            </h3>
            <p className="text-base text-slate-600 leading-relaxed mb-2">
              Clinical discipline built into every conversation
            </p>
            <p className="text-sm text-slate-500 leading-relaxed">
              Designed to prepare, not diagnose. We help you communicate clearly while flagging urgent signals that need immediate attention.
            </p>
          </div>

        </div>
      </section>

      {/* The Problem Section */}
      <section className="max-w-4xl mx-auto px-4 py-12 md:py-16">
        <div className="bg-gradient-to-br from-slate-100 to-slate-50 rounded-2xl p-8 md:p-10 border border-slate-200">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4 text-center">
            The Healthcare Gap
          </h2>
          <p className="text-base md:text-lg text-slate-600 mb-6 text-center max-w-2xl mx-auto leading-relaxed">
            Patients forget symptoms. Doctors receive incomplete histories. 15-minute appointments aren't enough.
          </p>
          <p className="text-base md:text-lg font-medium text-teal-800 text-center">
            SignalHealth solves the <span className="font-bold">before-and-between</span> — not what's wrong right now, but what's been happening over time.
          </p>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="max-w-4xl mx-auto px-4 py-12 md:py-16 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
          Ready to build your health story?
        </h2>
        <Link
          href="/login?mode=signup"
          className="inline-block bg-teal-700 hover:bg-teal-800 text-white rounded-xl px-10 py-4 text-lg font-semibold transition-all shadow-lg hover:shadow-xl active:scale-[0.98] focus:ring-2 focus:ring-teal-700/30 focus:ring-offset-2"
        >
          Get Started
        </Link>
        <p className="text-sm text-slate-400 mt-6 flex items-center justify-center gap-2">
          <span>🔒</span> Your data is encrypted and private
        </p>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white mt-12">
        <div className="max-w-6xl mx-auto px-4 py-8 text-center text-sm text-slate-400">
          <p>© 2026 SignalHealth — Your Proactive AI Health Companion</p>
        </div>
      </footer>

    </div>
  )
}
