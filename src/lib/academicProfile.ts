import { supabase } from './supabase'

export interface AcademicProfileInput {
  displayName: string; institution?: string; faculty?: string; department?: string; level?: string;
  programme?: string; academicSession?: string; researchInterests?: string[]; skills?: string[];
  projectGoals?: string[]; discoverable?: boolean; profileVisibility?: 'private' | 'public';
  messagePolicy?: 'everyone' | 'requests' | 'nobody'; collaborationAvailable?: boolean;
}

/** Persist academic identity to the signed-in account, not just local IndexedDB. */
export async function saveStudentAcademicProfile(userId: string, input: AcademicProfileInput): Promise<void> {
  if (!supabase) throw new Error('Account storage is not configured on this device.')
  const displayName = input.displayName.trim().slice(0, 80)
  if (!displayName) throw new Error('Enter your name before saving your academic profile.')
  const row = {
    user_id: userId, display_name: displayName,
    institution: (input.institution ?? 'Olabisi Onabanjo University').trim().slice(0, 120),
    faculty: (input.faculty ?? '').trim().slice(0, 120), department: (input.department ?? '').trim().slice(0, 120),
    level: (input.level ?? '').trim().slice(0, 30), programme: (input.programme ?? '').trim().slice(0, 120),
    academic_session: (input.academicSession ?? '').trim().slice(0, 30),
    research_interests: (input.researchInterests ?? []).map(x => x.trim()).filter(Boolean).slice(0, 20),
    skills: (input.skills ?? []).map(x => x.trim()).filter(Boolean).slice(0, 20),
    project_goals: (input.projectGoals ?? []).map(x => x.trim()).filter(Boolean).slice(0, 20),
    discoverable: input.discoverable === true,
    profile_visibility: input.discoverable && input.profileVisibility === 'public' ? 'public' : 'private',
    message_policy: input.messagePolicy ?? 'requests', collaboration_available: input.collaborationAvailable === true,
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await supabase.from('student_profiles').upsert(row, { onConflict: 'user_id' }).select('user_id').single()
  if (error) throw error
  if (data?.user_id !== userId) throw new Error('Your academic profile could not be confirmed in your account.')
}
