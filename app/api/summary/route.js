import Anthropic from '@anthropic-ai/sdk'
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

For health_summary: write a succinct clinical summary using natural flowing sentences. Only use confirmed onboarding details. Do not use markdown, asterisks, or dashes. If there isn't enough information yet, use null.

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

// Helper function to clean out markdown leftovers
function cleanMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/\*\*/g, '')          // Removes all double asterisks (bold)
    .replace(/\*/g, '')            // Removes all single asterisks (italics/bullets)
    .replace(/^---\s*$/gm, '')     // Removes standalone markdown horizontal lines (---)
    .replace(/^\s*[\r\n]/gm, '\n') // Cleans up excessive double blank lines
    .trim();                       // Trims trailing whitespace at start and end
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

    const { profile, userId } = await request.json()

    // Get conversation history
    const { data: conversation } = await supabase
      .from('conversations')
      .select('messages')
      .eq('user_id', userId)
      .single()

    const messages = conversation?.messages || []

    // Extract FRESH profile data from full conversation
    const freshProfile = await extractProfile(messages)

    // Get existing health story
    const { data: profileData } = await supabaseAdmin
      .from('profiles')
      .select('health_story')
      .eq('id', userId)
      .single()

    // Extract FRESH health story (merge existing + recent)
    const freshHealthStory = await extractHealthStory(
      profileData?.health_story,
      messages
    )

    // Use fresh profile data, falling back to provided profile if needed
    const profileForSummary = {
      name: freshProfile?.name || profile?.name || 'Not provided',
      age: freshProfile?.age || profile?.age || 'Not provided',
      gender: freshProfile?.gender || profile?.gender || 'Not provided',
      ethnicity: freshProfile?.ethnicity || profile?.ethnicity || 'Not provided',
      medications: freshProfile?.medications || profile?.medications || 'None recorded',
      known_health_problems: freshProfile?.known_health_problems || profile?.known_health_problems || 'None recorded',
      family_history: freshProfile?.family_history || profile?.family_history || 'None recorded',
      allergies: freshProfile?.allergies || profile?.allergies || 'None recorded',
      alcohol_and_smoking: freshProfile?.alcohol_and_smoking || profile?.alcohol_and_smoking || 'None recorded',
      surgeries: freshProfile?.surgeries || profile?.surgeries || 'None recorded'
    }

    const recentMessages = messages.slice(-20).map(m => `${m.role}: ${m.content}`).join('\n')

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: `You are generating a structured GP summary for a patient. Use only confirmed information from their profile and conversation history. Do not invent or infer anything.

Patient Profile:
Name: ${profileForSummary.name}
Age: ${profileForSummary.age}
Gender: ${profileForSummary.gender}
Ethnicity: ${profileForSummary.ethnicity}
Medications: ${profileForSummary.medications}
Known health problems: ${profileForSummary.known_health_problems}
Family history: ${profileForSummary.family_history}
Allergies: ${profileForSummary.allergies}
Alcohol and smoking: ${profileForSummary.alcohol_and_smoking}
Surgeries: ${profileForSummary.surgeries}

Health Story Context:
${freshHealthStory || 'No health story available'}

Recent conversation highlights:
${recentMessages}

Generate a clear, structured GP summary using ONLY the following section headers exactly as written, followed by a colon. 

Patient Overview:
Current Concerns:
Medications:
Relevant Medical History:
Family History:
Lifestyle:
Suggested Discussion Points for GP:

CRITICAL FORMATTING RULES:
1. Do NOT write a title like "**GP SUMMARY**" at the top. Jump straight into the "Patient Overview:" section.
2. Do NOT use any asterisks (**), dashes (---), or symbols. 
3. Separate each section with exactly one blank line.
4. End with a brief one-sentence factual disclaimer in plain text.
`
        }
      ]
    })

    // Extract raw text and clean it up immediately
    let summaryText = response.content[0].text
    summaryText = cleanMarkdown(summaryText)

    // Save cleaned text to Supabase
    await supabaseAdmin
      .from('profiles')
      .update({ gp_summary: summaryText })
      .eq('id', userId)

    // Optionally save fresh profile data if it has new information
    if (freshProfile) {
      const updates = {}
      if (freshProfile.name && freshProfile.name !== profile?.name) updates.name = freshProfile.name
      if (freshProfile.age && freshProfile.age !== profile?.age) updates.age = freshProfile.age
      if (freshProfile.gender && freshProfile.gender !== profile?.gender) updates.gender = freshProfile.gender
      if (freshProfile.ethnicity && freshProfile.ethnicity !== profile?.ethnicity) updates.ethnicity = freshProfile.ethnicity
      if (freshProfile.medications && freshProfile.medications !== profile?.medications) updates.medications = freshProfile.medications
      if (freshProfile.known_health_problems && freshProfile.known_health_problems !== profile?.known_health_problems) updates.known_health_problems = freshProfile.known_health_problems
      if (freshProfile.family_history && freshProfile.family_history !== profile?.family_history) updates.family_history = freshProfile.family_history
      if (freshProfile.allergies && freshProfile.allergies !== profile?.allergies) updates.allergies = freshProfile.allergies
      if (freshProfile.alcohol_and_smoking && freshProfile.alcohol_and_smoking !== profile?.alcohol_and_smoking) updates.alcohol_and_smoking = freshProfile.alcohol_and_smoking
      if (freshProfile.surgeries && freshProfile.surgeries !== profile?.surgeries) updates.surgeries = freshProfile.surgeries
      if (freshProfile.health_summary && freshProfile.health_summary !== profile?.health_summary) updates.health_summary = freshProfile.health_summary
      
      if (Object.keys(updates).length > 0) {
        updates.last_updated = new Date().toISOString()
        await supabaseAdmin
          .from('profiles')
          .update(updates)
          .eq('id', userId)
      }
    }

    return Response.json({ summary: summaryText })
  } catch (err) {
    console.log('Summary error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
