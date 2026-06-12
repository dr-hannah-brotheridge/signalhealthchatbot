'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [authMode, setAuthMode] = useState('signin') // 'signin', 'signup', 'forgot', or 'recovery'
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)

  useEffect(() => {
    // 1. Check for recovery tokens in the URL immediately on mount
    const isRecoveryInUrl = 
      window.location.hash.includes('type=recovery') || 
      window.location.search.includes('type=recovery');
    
    if (isRecoveryInUrl) {
      setAuthMode('recovery');
    }

    const checkUserSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      // ONLY redirect if there is a session AND we aren't in recovery mode
      // This stops the page from bouncing to chat while the user is typing a new password
      if (session && authMode !== 'recovery' && !isRecoveryInUrl) {
        window.location.href = '/chat'
      }
    }
    checkUserSession()

    // 2. Listen for the specific PASSWORD_RECOVERY event from Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setAuthMode('recovery')
      } else if (event === 'SIGNED_IN' && authMode !== 'recovery') {
        // Only auto-redirect on standard sign-ins, not during password updates
        window.location.href = '/chat'
      }
    })

    return () => subscription.unsubscribe()
  }, [authMode]) // Re-run logic if authMode changes to ensure we don't redirect away from recovery

  const handleAuth = async (e) => {
    if (e) e.preventDefault()
    setMessage('')
    setIsError(false)
    
    if (authMode === 'recovery') {
      if (password !== confirmPassword) {
        setIsError(true)
        setMessage('Passwords do not match.')
        return
      }
      if (password.length < 6) {
        setIsError(true)
        setMessage('Password must be at least 6 characters.')
        return
      }
      setLoading(true)
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        setIsError(true)
        setMessage(error.message)
      } else {
        setMessage('Password updated successfully! Redirecting to chat...')
        setTimeout(() => {
          window.location.href = '/chat'
        }, 1500)
      }
      setLoading(false)
      return
    }

    if (authMode === 'forgot') {
      if (!email) {
        setIsError(true)
        setMessage('Please enter your email address.')
        return
      }
      setLoading(true)
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`, 
      })
      if (error) {
        setIsError(true)
        setMessage(error.message)
      } else {
        setMessage('Password reset email sent! Check your inbox.')
      }
      setLoading(false)
      return
    }

    if (authMode === 'signup' && password !== confirmPassword) {
      setIsError(true)
      setMessage("Passwords do not match.")
      return
    }

    setLoading(true)

    if (authMode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setIsError(true)
        setMessage(error.message)
      } else {
        setMessage('Check your email to confirm your account!')
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setIsError(true)
        setMessage(error.message)
      } else {
        window.location.href = '/chat'
      }
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-slate-50 text-gray-900 font-sans flex flex-col items-center justify-center px-4">
      
      {/* Logo — matches app header format exactly */}
      <div className="flex items-center gap-2.5 mb-8">
        <div className="w-9 h-9 rounded-full bg-teal-700 flex items-center justify-center shadow-sm">
          <span className="text-white text-base font-bold">♥</span>
        </div>
        <span className="text-xl font-bold tracking-tight text-gray-950">
          Signal<span className="text-teal-700">Health</span>
        </span>
      </div>

      {/* Auth Card */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        
        {authMode === 'recovery' ? (
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Choose a new password</h1>
        ) : authMode === 'forgot' ? (
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Reset your password</h1>
        ) : authMode === 'signup' ? (
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Create your account</h1>
        ) : (
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome back</h1>
        )}

        {authMode === 'signin' && (
          <p className="text-base text-slate-500 mb-6">Sign in to continue to your health companion.</p>
        )}
        {authMode === 'signup' && (
          <p className="text-base text-slate-500 mb-6">Join SignalHealth to start building your health story.</p>
        )}
        {authMode === 'forgot' && (
          <p className="text-base text-slate-500 mb-6">We'll send you a link to reset your password.</p>
        )}
        {authMode === 'recovery' && (
          <p className="text-base text-slate-500 mb-6">Enter your new password below.</p>
        )}

        <form onSubmit={handleAuth} className="space-y-5">
          
          {authMode !== 'recovery' && (
            <div>
              <label htmlFor="email" className="block text-base font-medium text-slate-700 mb-1.5">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full border border-slate-200 rounded-xl px-4 py-3.5 text-lg outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 transition-colors bg-white"
              />
            </div>
          )}
          
          {authMode !== 'forgot' && (
            <>
              <div>
                <label htmlFor="password" className="block text-base font-medium text-slate-700 mb-1.5">
                  {authMode === 'recovery' ? 'New password' : 'Password'}
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    className="w-full border border-slate-200 rounded-xl px-4 py-3.5 pr-14 text-lg outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 transition-colors bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none select-none"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? '⌣' : '👁'}
                  </button>
                </div>
              </div>

              {(authMode === 'signup' || authMode === 'recovery') && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                  <label htmlFor="confirmPassword" className="block text-base font-medium text-slate-700 mb-1.5">
                    {authMode === 'recovery' ? 'Repeat new password' : 'Repeat password'}
                  </label>
                  <input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                    className="w-full border border-slate-200 rounded-xl px-4 py-3.5 text-lg outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 transition-colors bg-white"
                  />
                </div>
              )}

              {authMode === 'signin' && (
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => { setAuthMode('forgot'); setMessage(''); }}
                    className="text-sm font-medium text-teal-700 hover:text-teal-800 hover:underline focus:outline-none"
                  >
                    Forgot password?
                  </button>
                </div>
              )}
            </>
          )}

          {message && (
            <p className={`text-sm font-medium p-3 rounded-xl border animate-in fade-in duration-200 ${
              isError 
              ? 'text-red-600 bg-red-50 border-red-100' 
              : 'text-teal-700 bg-teal-50 border-teal-100'
            }`}>
              {isError ? '⚠️ ' : '✓ '}{message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-teal-700 hover:bg-teal-800 text-white rounded-xl py-4 text-lg font-semibold transition-colors disabled:opacity-50 shadow-sm focus:ring-2 focus:ring-teal-700/30 focus:ring-offset-2 active:scale-[0.98]"
          >
            {loading ? 'Please wait...' : authMode === 'signup' ? 'Create account' : authMode === 'forgot' ? 'Send recovery link' : authMode === 'recovery' ? 'Update Password' : 'Sign in'}
          </button>
        </form>

        {authMode !== 'recovery' && (
          <div className="text-base text-slate-500 text-center mt-6">
            {authMode === 'forgot' ? (
              <button
                type="button"
                onClick={() => { setAuthMode('signin'); setMessage(''); }}
                className="text-teal-700 font-medium hover:underline focus:outline-none"
              >
                Back to Sign In
              </button>
            ) : (
              <p>
                {authMode === 'signup' ? 'Already have an account?' : "Don't have an account?"}
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode(authMode === 'signup' ? 'signin' : 'signup');
                    setMessage('');
                  }}
                  className="text-teal-700 ml-1 font-medium hover:underline focus:outline-none"
                >
                  {authMode === 'signup' ? 'Sign in' : 'Sign up'}
                </button>
              </p>
            )}
          </div>
        )}
      </div>

      {/* Trust Footer */}
      <div className="mt-8 text-center space-y-3">
        <p className="text-sm text-slate-400 flex items-center justify-center gap-1.5">
          <span>🔒</span> Your data is encrypted and private
        </p>
        {authMode !== 'recovery' && (
          <p className="text-xs text-slate-300">© 2026 SignalHealth</p>
        )}
      </div>
    </div>
  )
}
