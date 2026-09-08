import { getSupabase } from './supabase';

export type AppRole = 'admin' | 'judge' | 'moderator';
export type Profile = { id: string; role: AppRole; subject_id: string | null; display_name: string; identifier: string | null };

export async function participantEmail(role: 'judge' | 'moderator', identifier: string) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${role}:${identifier.trim().toLowerCase()}`));
  return `${Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('')}@participants.conversatorio.invalid`;
}
export async function loginParticipant(role: 'judge' | 'moderator', identifier: string, token: string) {
  const supabase = getSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email: await participantEmail(role, identifier), password: token.trim() });
  if (error) return false;
  const { data, error: profileError } = await supabase.rpc('current_profile');
  if (profileError || data?.role !== role) { await supabase.auth.signOut(); return false; }
  return true;
}
export async function manageAccount(body: Record<string, unknown>, method = 'POST') {
  const { data: { session } } = await getSupabase().auth.getSession();
  if (!session) throw new Error('Debes iniciar sesión como administrador.');
  const response = await fetch('/api/admin/accounts', {
    method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'No se pudo gestionar la cuenta.');
  return result;
}
