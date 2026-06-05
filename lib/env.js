// Environment validation utilities

export function validateEnvironment() {
  const errors = []
  const warnings = []

  // Check required environment variables
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    errors.push('NEXT_PUBLIC_SUPABASE_URL is not configured')
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    errors.push('NEXT_PUBLIC_SUPABASE_ANON_KEY is not configured')
  }

  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    errors.push('NEXT_PUBLIC_VAPID_PUBLIC_KEY is not configured (required for push notifications)')
  } else {
    // Check if it has quotes that need to be stripped
    const stripped = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY.replace(/^["']|["']$/g, '')
    if (!stripped) {
      errors.push('NEXT_PUBLIC_VAPID_PUBLIC_KEY is empty after stripping quotes')
    }
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    errors.push('ANTHROPIC_API_KEY is not configured')
  }

  if (!process.env.SUPABASE_SERVICE_KEY) {
    warnings.push('SUPABASE_SERVICE_KEY is not configured (required for admin operations)')
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

export function logEnvironmentStatus() {
  const status = validateEnvironment()
  
  console.log('🔧 Environment Status:')
  console.log('====================')
  
  if (status.isValid) {
    console.log('✅ All required environment variables are configured')
  } else {
    console.log('❌ Missing required environment variables:')
    status.errors.forEach(err => console.log(`   - ${err}`))
  }
  
  if (status.warnings.length > 0) {
    console.log('⚠️  Warnings:')
    status.warnings.forEach(warn => console.log(`   - ${warn}`))
  }
  
  console.log('====================')
  
  return status
}