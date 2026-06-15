-- Add appointment fields to profiles table
alter table profiles
add column if not exists upcoming_appointment_type text,
add column if not exists upcoming_appointment_date date,
add column if not exists upcoming_appointment_focus text;

-- Add conversation_type column to conversations table
alter table conversations
add column if not exists conversation_type text default 'general'
check (conversation_type in ('general', 'pre_appointment', 'check_in', 'symptom_followup'));

-- Update existing conversations to be 'general' type
update conversations
set conversation_type = 'general'
where conversation_type is null;

-- Remove unique constraint on user_id if it exists (to allow multiple conversations per user)
-- Note: If there's a unique constraint, this will allow multiple conversations
-- The application will filter by conversation_type to get the right one
do $$
begin
    if exists (
        select 1 from pg_constraint 
        where conname = 'conversations_user_id_key'
    ) then
        alter table conversations drop constraint conversations_user_id_key;
    end if;
end $$;

-- Add index for efficient querying by user_id and conversation_type
create index if not exists idx_conversations_user_type 
on conversations(user_id, conversation_type, updated_at desc);
