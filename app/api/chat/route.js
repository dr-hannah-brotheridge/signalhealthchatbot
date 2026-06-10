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
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: `Based on this conversation, extract any confirmed profile information and return ONLY a JSON object with these exact fields. Only include information the user has explicitly stated. Use null for anything not mentioned. Do not invent or infer anything.

Fields: name, age, gender, ethnicity, medications, known_health_problems, family_history, allergies, alcohol_and_smoking, surgeries, health_summary

For health_summary: write a succinct clinical summary using natural flowing sentences. For example: "Hannah is a 28-year-old NZ European female with a known history of migraines, currently managed with lamotrigine. She also has a family history of heart disease." Only use confirmed onboarding details. Do not use markdown, asterisks, or dashes. If there isn't enough information yet, use null.

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

async function extractHealthStory(existingHealthStory, recentMessages) {
  const recentConversation = recentMessages
    .slice(-50)
    .map(m => `${m.role}: ${m.content}`)
    .join('\n')

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: `You are updating a patient's health story. Your task is to maintain a comprehensive, accurate narrative of their health journey.

${existingHealthStory ? `EXISTING HEALTH STORY:\n${existingHealthStory}\n\n` : ''}RECENT CONVERSATION (last 50 messages):
${recentConversation}

Your task:
- Keep all relevant information from the existing health story
- Incorporate new information from recent conversation
- Remove information that is no longer relevant (e.g., resolved issues, but note they were previously present)
- Resolve any contradictions (prioritize newer information if user corrected themselves)
- Maintain a cohesive, chronological narrative
- Focus on clinically relevant details that would be important for future conversations or GP summaries

Guidelines:
- Don't lose important historical context (e.g., past treatments that didn't work, timeline of symptoms)
- If a user corrects themselves, use the corrected information
- If a condition is resolved, note when it was present and that it has improved/resolved
- Keep the narrative flowing and natural
- Aim for 200-400 words total
- Include timeline information (e.g., "for the past 3 months", "since January")
- Capture patterns, triggers, and progression

Return ONLY the updated health story narrative, no other text, no markdown formatting.`
      }
    ]
  })

  return response.content[0].text.trim()
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

    // Extract and save profile data every 2 messages using Haiku
    if (updatedMessages.length > 2 && updatedMessages.length % 2 === 0) {
      const profile = await extractProfile(updatedMessages)
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
        if (profile.health_summary) updates.health_summary = profile.health_summary
        if (Object.keys(updates).length > 0) {
          updates.last_updated = new Date().toISOString()
          await supabaseAdmin
            .from('profiles')
            .update(updates)
            .eq('id', userId)
        }
      }
    }

    // Update health story every 10 messages using Sonnet with merge approach
    if (updatedMessages.length > 2 && updatedMessages.length % 10 === 0) {
      const { data: profileData } = await supabaseAdmin
        .from('profiles')
        .select('health_story')
        .eq('id', userId)
        .single()
      
      const updatedHealthStory = await extractHealthStory(
        profileData?.health_story,
        updatedMessages
      )
      
      if (updatedHealthStory) {
        await supabaseAdmin
          .from('profiles')
          .update({ 
            health_story: updatedHealthStory,
            last_updated: new Date().toISOString()
          })
          .eq('id', userId)
      }
    }

    return Response.json({ reply })
  } catch (err) {
    console.log('API error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}