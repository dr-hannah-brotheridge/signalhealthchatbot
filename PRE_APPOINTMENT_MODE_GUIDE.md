# Pre-Appointment Mode - Implementation Guide

## Overview
SignalHealth now has a pre-appointment preparation mode that helps users get ready for upcoming medical appointments. This feature creates a focused conversation that captures relevant health information and generates a comprehensive GP summary.

---

## What Was Built

### 1. Database Changes
**File:** `supabase/migrations/20240615_add_pre_appointment.sql`

Added to `profiles` table:
- `upcoming_appointment_type` (text)
- `upcoming_appointment_date` (date)
- `upcoming_appointment_focus` (text)

Added to `conversations` table:
- `conversation_type` (text) with check constraint for: 'general', 'pre_appointment', 'check_in', 'symptom_followup'
- Removed unique constraint on `user_id` to allow multiple conversations per user
- Added index for efficient querying by user_id and conversation_type

### 2. Pre-Appointment Prompt Builder
**File:** `lib/preAppointmentPrompt.js`

Creates a specialized system prompt for Claude that:
- Includes the user's full health profile
- References the specific appointment type, date, and focus
- Guides a focused prep conversation
- Contains the exact ending phrase that triggers completion detection

### 3. Chat Page Updates
**File:** `app/(app)/chat/page.js`

Added features:
- **"Prep for an Appointment" button** - Appears above message input (when not in pre-appointment mode)
- **Appointment details modal** - Collects appointment type, date, and optional focus
- **Pre-appointment mode banner** - Shows active appointment details with exit button
- **Completion detection** - Detects ending phrase and shows "Go to Summary & Update" button
- **Health extraction** - Silent API call to extract and save new health information from prep conversation
- **Mode switching** - Separate state for pre-appointment vs general chat

State management:
```javascript
- isPreAppointmentMode
- showAppointmentModal
- appointmentType, appointmentDate, appointmentFocus
- preAppointmentConversationId
```

### 4. Chat API Updates
**File:** `app/api/chat/route.js`

Enhanced to handle:
- Multiple conversation types with dynamic system prompts
- Pre-appointment mode using specialized prompt
- Conversation ID-based updates (for pre-appointment conversations)
- Separate conversation saving logic for different types
- Profile extraction only runs for general conversations (not pre-appointment)

New parameters:
```javascript
conversationType, conversationId, appointmentType, appointmentDate, appointmentFocus
```

### 5. Summary API Updates
**File:** `app/api/summary/route.js`

Now pulls messages from **ALL conversations** (general + pre-appointment + others) to generate comprehensive GP summaries that include everything discussed in prep sessions.

---

## User Flow

### Step 1: Start Prep
1. User clicks "📋 Prep for an Appointment" button in chat
2. Modal appears asking for:
   - Appointment type (required) - e.g., "GP", "Cardiologist"
   - Appointment date (required)
   - Specific focus (optional) - e.g., "my headaches"
3. User clicks "Start Prep"

### Step 2: Appointment Details Saved
- Appointment details saved to `profiles` table
- New conversation created with `conversation_type: 'pre_appointment'`
- Banner appears showing: "📋 Preparing for [type] · [date]"

### Step 3: Focused Conversation
- Claude opens with a warm, focused message about the upcoming appointment
- Conversation covers:
  - New or worsening symptoms
  - Status of known health problems
  - Medication changes or concerns
  - Questions for the appointment
  - Other relevant information
- User responds naturally, one question at a time

### Step 4: Completion
- When prep is complete, Claude responds with:
  > "I think we've captured everything important for your [type] appointment. Head to your Summary page and press Update — it will generate a fresh summary you can share with your [type]. Good luck!"
- **"📄 Go to Summary & Update →" button appears**
- Silent health extraction runs in background

### Step 5: Summary Generation
- User clicks button → navigates to Summary page
- Clicks "Update" to regenerate GP summary
- Summary now includes all information from prep conversation

### Step 6: Exit
User can exit pre-appointment mode by:
- Clicking the ✕ button in the banner
- Going to Summary (button press)
- Appointment details are cleared from profile
- Returns to general chat

---

## Key Features

### 🎯 Focused Conversations
Pre-appointment mode uses a specialized prompt that keeps the conversation focused on preparing for the specific appointment type.

### 📊 Automatic Health Extraction
When prep is complete, the system silently:
1. Extracts new health information mentioned during prep
2. Updates the profile fields:
   - Known health problems
   - Medications
   - Health story
3. Fails silently if errors occur (no user-facing errors)

### 🔄 Multi-Conversation Architecture
The system now supports multiple conversations per user:
- General daily conversations
- Pre-appointment prep sessions
- Future: check-ins, symptom follow-ups

### 🎨 UI/UX Enhancements
- Modal overlay (doesn't navigate away from chat)
- Active mode banner with exit button
- Completion detection with prominent call-to-action button
- Matches existing SignalHealth styling (teal/green theme)

---

## Technical Details

### Conversation Type Architecture
```javascript
// conversations table now has conversation_type column
{
  id: uuid,
  user_id: uuid,
  messages: jsonb,
  conversation_type: 'general' | 'pre_appointment' | 'check_in' | 'symptom_followup',
  is_proactive: boolean,
  created_at: timestamp,
  updated_at: timestamp
}
```

### Loading Conversations
```javascript
// Load most recent general conversation
const { data } = await supabase
  .from('conversations')
  .select('messages, id')
  .eq('user_id', userId)
  .eq('conversation_type', 'general')
  .order('updated_at', { ascending: false })
  .limit(1)
  .single()
```

### System Prompt Switching
```javascript
if (conversationType === 'pre_appointment' && appointmentType && appointmentDate) {
  systemWithContext = buildPreAppointmentSystemPrompt(
    profileData,
    appointmentType,
    appointmentDate,
    appointmentFocus
  )
} else {
  systemWithContext = `${SYSTEM_PROMPT}${profileContext}`
}
```

---

## Deployment Steps

### 1. Run Database Migration
```bash
# Connect to your Supabase project and run:
psql [your-connection-string] -f supabase/migrations/20240615_add_pre_appointment.sql

# OR use Supabase CLI:
supabase db push
```

### 2. Deploy Code
```bash
# Commit and push changes
git add .
git commit -m "Add pre-appointment mode feature"
git push

# Deploy to Vercel (auto-deploys on push if configured)
# Or manually: vercel --prod
```

### 3. Verify Migration
Check that:
- `profiles` table has new appointment columns
- `conversations` table has `conversation_type` column
- Existing conversations have `conversation_type = 'general'`
- Index `idx_conversations_user_type` exists

---

## Testing Checklist

### Basic Flow
- [ ] Click "Prep for an Appointment" button
- [ ] Modal appears with form fields
- [ ] Enter appointment details and click "Start Prep"
- [ ] Banner appears with appointment info
- [ ] Claude starts with appropriate opening message
- [ ] Have conversation about health concerns
- [ ] Claude ends with exact completion phrase
- [ ] "Go to Summary & Update" button appears
- [ ] Click button → navigate to Summary page
- [ ] Click "Update" → summary regenerates with prep info
- [ ] Verify prep conversation context is included in summary

### Exit Flow
- [ ] Click ✕ button in banner
- [ ] Returns to general chat
- [ ] Appointment fields cleared from profile
- [ ] Can start new prep session

### Edge Cases
- [ ] Cancel modal without starting prep
- [ ] Try to submit form without required fields (should be disabled)
- [ ] Start prep, then refresh page (state should be maintained)
- [ ] Multiple prep sessions for different appointments
- [ ] General chat still works normally when not in prep mode

---

## API Key Note

The health extraction function in `chat/page.js` uses:
```javascript
'x-api-key': process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || ''
```

⚠️ **Security Note**: Exposing the API key in client-side code is not ideal for production. Consider moving this to a server-side API route for better security.

**Alternative Implementation:**
Create `/api/extract-health` route that handles the extraction server-side.

---

## Future Enhancements

### Potential Additions
1. **Appointment reminders** - Push notification day before appointment
2. **Past appointments archive** - View previous prep sessions
3. **Export prep notes** - Download/print appointment prep
4. **Multiple appointment types** - Templates for different specialists
5. **Post-appointment follow-up** - Capture what happened at appointment

### Conversation Types Planned
- `check_in` - Regular health check-ins
- `symptom_followup` - Following up on specific symptoms
- Custom types for specific use cases

---

## Files Modified

1. ✅ `supabase/migrations/20240615_add_pre_appointment.sql` (NEW)
2. ✅ `lib/preAppointmentPrompt.js` (NEW)
3. ✅ `app/(app)/chat/page.js` (MODIFIED)
4. ✅ `app/api/chat/route.js` (MODIFIED)
5. ✅ `app/api/summary/route.js` (MODIFIED)

---

## Support

If you encounter issues:
1. Check browser console for errors
2. Verify database migration ran successfully
3. Check Supabase logs for API errors
4. Review Claude API response format

---

Built for SignalHealth by Cline 🤖
