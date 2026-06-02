import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

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

    // Get conversation history [cite: 99]
    const { data: conversation } = await supabase
      .from('conversations') [cite: 44]
      .select('messages') [cite: 47]
      .eq('user_id', userId) [cite: 46]
      .single()

    const messages = conversation?.messages || [] [cite: 47]
    const recentMessages = messages.slice(-20).map(m => `${m.role}: ${m.content}`).join('\n') [cite: 99]

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6', [cite: 14]
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: `You are generating a structured GP summary for a patient. Use only confirmed information from their profile and conversation history. Do not invent or infer anything.

Patient Profile:
Name: ${profile?.name || 'Not provided'}
Age: ${profile?.age || 'Not provided'}
Gender: ${profile?.gender || 'Not provided'}
Ethnicity: ${profile?.ethnicity || 'Not provided'}
Medications: ${profile?.medications || 'None recorded'}
Known health problems: ${profile?.known_health_problems || 'None recorded'}
Family history: ${profile?.family_history || 'None recorded'}
Allergies: ${profile?.allergies || 'None recorded'}
Alcohol and smoking: ${profile?.alcohol_and_smoking || 'None recorded'}
Surgeries: ${profile?.surgeries || 'None recorded'}

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
      }
    ])

    // Extract raw text and clean it up immediately
    let summaryText = response.content[0].text
    summaryText = cleanMarkdown(summaryText)

    // Save cleaned text to Supabase 
    await supabaseAdmin
      .from('profiles') [cite: 24]
      .update({ gp_summary: summaryText }) [cite: 101]
      .eq('id', userId)

    return Response.json({ summary: summaryText })
  } catch (err) {
    console.log('Summary error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}