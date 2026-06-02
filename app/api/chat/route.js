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

async function extractProfile(messages) {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: `Based on this conversation, extract any confirmed profile information and return ONLY a JSON object with these exact fields. Only include information the user has explicitly stated. Use null for anything not mentioned. Do not invent or infer anything.

Fields: name, age, gender, ethnicity, medications, known_health_problems, family_history, allergies, alcohol_and_smoking, surgeries

Conversation:
${messages.map(m => `${m.role}: ${m.content}`).join('\n')}

Return only valid JSON, no other text.`
      }
    ]
  })

  try {
    const text = response.content[0].text.trim()
    const clean = text.replace(/```json|```/g, '').trim()
    return JSON.parse(clean)
  } catch {
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

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: messages.length === 0
        ? [{ role: 'user', content: 'Hello, I am opening the app for the first time.' }]
        : messages
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

    // Extract and save profile data in background
    // Extract and save profile data
if (updatedMessages.length > 2) {
  const profile = await extractProfile(updatedMessages)
  console.log('Extracted profile:', JSON.stringify(profile))
  if (profile) {
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
    if (Object.keys(updates).length > 0) {
      updates.last_updated = new Date().toISOString()
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update(updates)
        .eq('id', userId)
      console.log('Profile update result:', profileError ? profileError.message : 'success')
    }
  }
}

    return Response.json({ reply })
  } catch (err) {
    console.log('API error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}