import Anthropic from '@anthropic-ai/sdk'
import { SYSTEM_PROMPT } from '../../../lib/prompt'
import { buildPreAppointmentSystemPrompt } from '../../../lib/preAppointmentPrompt'
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
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
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

CRITICAL RULES:

1. known_health_problems: ONLY include DIAGNOSED CHRONIC CONDITIONS
   - Include: "Migraines", "Diabetes", "Asthma", "Heart condition", "Hypertension"
   - EXCLUDE: Current symptoms, undiagnosed issues, injuries, resolved symptoms
   - EXCLUDE examples: "Dry eyes", "Chest pain", "Blurred vision", "Tailbone pain", "Rib issue"
   - These symptoms go in health_story, NOT known_health_problems

2. health_summary: A concise clinical overview formatted as 3 distinct paragraphs:
   
   PARAGRAPH 1 (Demographics & Chronic Conditions):
   - Include: age, gender, ethnicity, diagnosed chronic conditions, current medications
   - Example: "[Name] is a [age]-year-old [ethnicity] [gender] with a known history of [diagnosed conditions] managed with [medications]."
   
   PARAGRAPH 2 (Active Concerns):
   - List ALL current active concerns/symptoms with brief context
   - Include: breast growth, ankle injury, heart palpitations, foot pain, dry eyes, etc.
   - Example: "Active concerns include [symptom 1], [symptom 2], and [symptom 3]. [Brief context for each]."
   
   PARAGRAPH 3 (Family History & Lifestyle):
   - Include: family history, lifestyle factors (alcohol, smoking, exercise)
   - Example: "Family history includes [conditions]. Lifestyle factors: [details]."
   
   Separate each paragraph with \n\n
   Update this with every new concern mentioned

3. health_story: A comprehensive narrative covering:
   - Write in flowing narrative prose with varied sentence structure
   - Group related information into logical paragraphs (2-4 sentences each)
   - Separate paragraphs with \n\n
   - Avoid repetitive naming - use pronouns after first mention in paragraph
   - Start new paragraphs for different health topics
   - Include: all symptoms (current and resolved), patterns, triggers, timeline, context
   - Structure: General overview → Recurring issues → Recent concerns → Historical issues → Upcoming appointments
   - Example paragraph structure:
     
     "[Name] is a [age]-year-old [ethnicity] [gender] presenting with multiple health concerns. [They/He/She] have a history of [condition] managed with [medication].
     
     The most prominent issue is [main concern]. This presents as [description] and occurs [frequency/pattern]. [Additional details about this issue].
     
     [They/He/She] also experience [second concern]. [Details]. [Context or timeline].
     
     Previously, [past issue]. This has [current status]. [Any relevant follow-up].
     
     [They/He/She] have an upcoming [appointment type] appointment on [date] to address [focus]."

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

    const { messages, userId, conversationType = 'general', conversationId = null, appointmentType = null, appointmentDate = null, appointmentFocus = null } = await request.json()

    // Keep only last 15 messages, use health_story for older context
    let messagesToSend = messages
    if (messages.length > 15) {
      messagesToSend = messages.slice(-15)
    }

    // Get complete profile for full context (not just health_story)
    const { data: profileData } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    // Build system prompt based on conversation type
    let systemWithContext = SYSTEM_PROMPT
    
    if (conversationType === 'pre_appointment' && appointmentType && appointmentDate) {
      // Use pre-appointment specialized prompt
      systemWithContext = buildPreAppointmentSystemPrompt(
        profileData,
        appointmentType,
        appointmentDate,
        appointmentFocus
      )
    } else {
      // Build comprehensive profile context for general chat
      let profileContext = ''
      if (profileData) {
        profileContext = `\n\nCURRENT USER PROFILE:
Name: ${profileData.name || 'Not recorded'}
Age: ${profileData.age || 'Not recorded'}
Gender: ${profileData.gender || 'Not recorded'}
Ethnicity: ${profileData.ethnicity || 'Not recorded'}
Medications: ${profileData.medications || 'Not recorded'}
Known Health Problems: ${profileData.known_health_problems || 'Not recorded'}
Family History: ${profileData.family_history || 'Not recorded'}
Allergies: ${profileData.allergies || 'Not recorded'}
Alcohol & Smoking: ${profileData.alcohol_and_smoking || 'Not recorded'}
Surgeries: ${profileData.surgeries || 'Not recorded'}

HEALTH STORY:
${profileData.health_story || 'Not yet recorded'}

IMPORTANT: Use this profile information to maintain continuity. Do NOT ask about fields that are already recorded unless you need clarification or the user is specifically requesting to update them. The profile is automatically updated through conversation.`
      }

      systemWithContext = profileContext
        ? `${SYSTEM_PROMPT}${profileContext}`
        : SYSTEM_PROMPT
    }

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
    
    // Track if we should show onboarding modal
    let showOnboardingModal = false

    // Save conversation
    if (conversationId) {
      // Update specific conversation by ID (for pre-appointment mode)
      await supabase
        .from('conversations')
        .update({ messages: updatedMessages, updated_at: new Date().toISOString() })
        .eq('id', conversationId)
    } else {
      // Handle general conversation
      const { data: existing } = await supabase
        .from('conversations')
        .select('id')
        .eq('user_id', userId)
        .eq('conversation_type', conversationType)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single()

      if (existing) {
        await supabase
          .from('conversations')
          .update({ messages: updatedMessages, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
      } else {
        await supabase
          .from('conversations')
          .insert({ 
            user_id: userId, 
            messages: updatedMessages,
            conversation_type: conversationType,
            is_proactive: false
          })
      }
    }

    // Extract and save profile data every message after the first 2 (for all conversation types)
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
        
        // Count how many core fields were filled BEFORE this update
        const coreFields = ['name', 'age', 'gender', 'ethnicity', 'medications']
        const filledBefore = coreFields.filter(field => {
          const val = currentProfile?.[field]
          return val && val !== '' && val !== '[]' && val !== '{}'
        }).length
        
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
              
              // Check if this is first meaningful profile update (onboarding complete)
              // Trigger modal if: profile had < 3 core fields before, now has >= 3
              const filledAfter = coreFields.filter(field => {
                const val = updates[field] || currentProfile?.[field]
                return val && val !== '' && val !== '[]' && val !== '{}'
              }).length
              
              if (filledBefore < 3 && filledAfter >= 3) {
                console.log('🎉 First meaningful profile update detected! Trigger onboarding modal.')
                showOnboardingModal = true
              }
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

    return Response.json({ reply, showOnboardingModal })
  } catch (err) {
    console.log('API error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}