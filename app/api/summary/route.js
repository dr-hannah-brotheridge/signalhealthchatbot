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
      .order('updated_at', { ascending: true })

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

CRITICAL MEDICATION RULE:
ONLY state medication purpose if explicitly stated by the user (e.g., "I take X for Y"). Do NOT infer medication purposes from symptoms or conditions.

Generate a clear, structured GP summary using ONLY the following section headers exactly as written, followed by a colon. 

Patient Overview:
Current Concerns:
Resolved Issues:
Medications:
Relevant Medical History:
Family History:
Lifestyle:
Suggested Discussion Points for GP:

CRITICAL FORMATTING RULES:
1. Do NOT write a title like "**GP SUMMARY**" at the top. Jump straight into the "Patient Overview:" section.
2. Do NOT use any asterisks (**), dashes (---), or symbols. 
3. Separate each section with exactly one blank line.
4. Within numbered lists (1., 2., 3.) or hyphenated lists (-), add a blank line after each item for better readability.
5. End with a brief one-sentence factual disclaimer in plain text.

SECTION-SPECIFIC RULES:

Current Concerns: ONLY include ACTIVE, ONGOING issues that require attention NOW
- Include: New symptoms, worsening conditions, unresolved problems
- Format: Numbered list with 1-2 sentence descriptions
- EXCLUDE: Any issue marked as "improving", "resolved", "better", or "no longer present"
- Examples to INCLUDE: "Breast growth - tender, noticed 1 week ago", "Ankle pain - worsening since injury", "Heart palpitations - occurring few times per week"
- Examples to EXCLUDE: "Chest pain - improving", "Tailbone pain - resolved", "Eye pain - no longer present"

Resolved Issues: ONLY issues explicitly described as resolved, improving significantly, or no longer present
- Include: Issues marked as "resolved", "improving", "better", "no longer bothering"
- Format: Clean bulleted list WITHOUT redundantly stating "resolved" for each item
- Since this section is titled "Resolved Issues", do NOT add "resolved" to each line
- Examples: "Eye pain", "Blurred vision", "Chest pain", "Tailbone pain following fall from ladder"
- If there are no resolved issues to report, you may omit this section entirely

Relevant Medical History: ONLY include DIAGNOSED CHRONIC CONDITIONS and past surgeries
- Include: Migraines, Heart condition, Diabetes, Asthma, etc.
- EXCLUDE: Current symptoms (those go in Current Concerns)
- EXCLUDE: Resolved temporary issues (those go in Resolved Issues if applicable)

Suggested Discussion Points for GP: Based only on items in "Current Concerns"
- Do NOT include resolved or improving issues
- Focus on active concerns that need assessment or management
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