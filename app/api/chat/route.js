import Anthropic from '@anthropic-ai/sdk'
import { SYSTEM_PROMPT } from '../../../lib/prompt'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

async function extractProfile(currentProfile, recentMessages) {
  try {
    console.log('🔍 Profile extraction called with', recentMessages.length, 'recent messages')
    console.log('📋 Current profile:', JSON.stringify(currentProfile, null, 2))
    
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: `You are updating a patient's profile. You have:

CURRENT PROFILE:
${JSON.stringify(currentProfile, null, 2)}

RECENT CONVERSATION (last 30 messages):
${recentMessages.map(m => `${m.role}: ${m.content}`).join('\n')}

Your task:
- Keep all information from the current profile
- Add or update any new information from recent conversation
- Remove information that is no longer relevant
- Resolve any contradictions (prioritize newer information)
- Return the complete updated profile

Fields: name, age, gender, ethnicity, medications, known_health_problems, family_history, allergies, alcohol_and_smoking, surgeries, health_summary, health_story

IMPORTANT: known_health_problems should ONLY include DIAGNOSED MEDICAL CONDITIONS (e.g., "migraines", "diabetes", "asthma", "hypertension") and RESOLVED ISSUES (e.g., "migraines resolved 3 months ago", "chest pain resolved after treatment"). Do NOT include current symptoms (e.g., "headache today", "chest pain", "blurred vision"). Current symptoms go in the health story narrative, not in known health problems.

For health_summary: write a succinct clinical summary using natural flowing sentences. For example: "Hannah is a 28-year-old NZ European female with a known history of migraines, currently managed with lamotrigine. She also has a family history of heart disease." Only use confirmed onboarding details. Do not use markdown, asterisks, or dashes. If there isn't enough information yet, use null.

For health_story: write a succinct but comprehensive narrative summary covering everything discussed including symptoms, concerns, patterns, triggers, and any other health details mentioned in conversation. Update and replace this each time with the most complete picture. If there isn't enough information yet, use null.

Return only valid JSON, no other text.`
        }
      ]
    })

    const text = response.content[0].text.trim()
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)
    console.log('✅ Profile extraction successful:', JSON.stringify(parsed, null, 2))
    return parsed
  } catch (error) {
    console.log('❌ Profile extraction error:', error.message)
    return null
  }
}

export async function POST(request) {
  try {
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    )

    const { messages, userId } = await request.json()

    // Keep only last 15 messages, use health_story for older context
    let messagesToSend = messages
    if (messages.length > 15) {
      messagesToSend = messages.slice(-15)
    }

    // Get health story for long term context
    const { data: profileData } = await supabaseAdmin
      .from('profiles')
      .select('health_story')
      .eq('id', userId)
      .single()

    const systemWithContext = profileData?.health_story
      ? `${SYSTEM_PROMPT}\n\nLONG TERM HEALTH CONTEXT FOR THIS USER:\n${profileData.health_story}\n\nUse this context to maintain continuity but prioritise the recent conversation.`
      : SYSTEM_PROMPT

    const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 1000,
  system: [
    {
      type: 'text',
      text: systemWithContext,
      cache_control: { type: 'ephemeral' }
    }
  ],
  messages: messages.length === 0
    ? [{ role: 'user', content: 'Hello, I am opening the app for the first time.' }]
    : messagesToSend
})

    const reply = response.content[0].text

    const updatedMessages = messages.length === 0
      ? [{ role: 'assistant', content: reply }]
      : [...messages, { role: 'assistant', content: reply }]

    // Save conversation
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('user_id', userId)
      .single()

    if (existing) {
      await supabase
        .from('conversations')
        .update({ messages: updatedMessages, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
    } else {
      await supabase
        .from('conversations')
        .insert({ user_id: userId, messages: updatedMessages })
    }

    // Extract and save profile data every message after the first 2
    if (updatedMessages.length > 2) {
      console.log('📊 Profile update condition met at message', updatedMessages.length)
      
      // Get current profile from database
      const { data: currentProfile } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      
      // Only send last 30 messages for extraction to avoid JSON parsing errors
      const recentMessages = updatedMessages.slice(-30)
      console.log('📤 Sending last', recentMessages.length, 'messages for extraction')
      
      const profile = await extractProfile(currentProfile || {}, recentMessages)
      if (profile) {
        console.log('📝 Profile data extracted, building updates object...')
        const updates = {}
        if (profile.name) updates.name = profile.name
        if (profile.age) updates.age = profile.age
        if (profile.gender) updates.gender = profile.gender
        if (profile.ethnicity) updates.ethnicity = profile.ethnicity
        if (profile.medications) updates.medications = profile.medications
        if (profile.known_health_problems) updates.known_health_problems = profile.known_health_problems
        if (profile.family_history) updates.family_history = profile.family_history
        if (profile.allergies) updates.allergies = profile.allergies
        if (profile.alcohol_and_smoking) updates.alcohol_and_smoking = profile.alcohol_and_smoking
        if (profile.surgeries) updates.surgeries = profile.surgeries
        if (profile.health_summary) updates.health_summary = profile.health_summary
        if (profile.health_story) updates.health_story = profile.health_story
        
        console.log('🔄 Updates object:', JSON.stringify(updates, null, 2))
        
        if (Object.keys(updates).length > 0) {
          updates.last_updated = new Date().toISOString()
          console.log('💾 Attempting to update profile for user:', userId)
          try {
            const { error } = await supabaseAdmin
              .from('profiles')
              .update(updates)
              .eq('id', userId)
            
            if (error) {
              console.log('❌ Database update error:', error)
            } else {
              console.log('✅ Database update successful')
            }
          } catch (dbError) {
            console.log('❌ Database update exception:', dbError)
          }
        } else {
          console.log('⚠️ No fields to update - updates object is empty')
        }
      } else {
        console.log('⚠️ Profile extraction returned null')
      }
    } else {
      console.log('⏭️ Profile update not triggered (message count:', updatedMessages.length, ')')
    }

    return Response.json({ reply })
  } catch (err) {
    console.log('API error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}