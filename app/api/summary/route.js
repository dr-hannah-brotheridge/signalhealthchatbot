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

    // Get ALL conversation history (general + pre-appointment + other types)
    const { data: conversations } = await supabase
      .from('conversations')
      .select('messages, conversation_type')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })

    // Combine messages from all conversations, with most recent first
    let allMessages = []
    if (conversations && conversations.length > 0) {
      conversations.forEach(conv => {
        if (conv.messages && conv.messages.length > 0) {
          allMessages.push(...conv.messages)
        }
      })
    }
    
    // Take last 30 messages across all conversations for context
    const recentMessages = allMessages.slice(-30).map(m => `${m.role}: ${m.content}`).join('\n')

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
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

CRITICAL MEDICATION RULE (Applies to ALL sections):
When mentioning medications in ANY section of the summary (Current Concerns, Medications, Relevant Medical History, Suggested Discussion Points for GP):

ONLY state medication purpose if:
- The user explicitly said "I take [medication] for [condition]"
- This is explicitly recorded in their profile

DO NOT state medication purpose if:
- The user only mentioned the medication name
- The purpose is not explicitly stated or recorded
- You are inferring it from symptoms or patterns

Examples:
- User said "I take lamotrigine for migraines" → OK to say "lamotrigine for migraines"
- User only said "I take lamotrigine" → NOT OK to say "lamotrigine for migraines"
- User has migraines and takes lamotrigine → NOT OK to say "lamotrigine for migraines" (inference)

Do NOT infer or assume medication purposes. Only use information explicitly stated by the user.

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
4. Within the "Current Concerns" and "Suggested Discussion Points for GP" sections, IF using numbered lists (1., 2., 3.) or hyphenated lists (-), add a blank line after each item for better readability.
5. End with a brief one-sentence factual disclaimer in plain text.

SECTION-SPECIFIC RULES:
Relevant Medical History: ONLY include DIAGNOSED MEDICAL CONDITIONS (e.g., migraines, diabetes, asthma, hypertension) and RESOLVED ISSUES (e.g., "migraines resolved 3 months ago"). Do NOT include current symptoms (e.g., headache today, chest pain, blurred vision). Current symptoms go in "Current Concerns" section.
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

    return Response.json({ summary: summaryText })
  } catch (err) {
    console.log('Summary error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}