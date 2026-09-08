import { createClient } from '@supabase/supabase-js';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';
const accountSchema = z.discriminatedUnion('role', [
  z.object({ role: z.literal('admin'), email: z.string().email(), password: z.string().min(8).max(128) }),
  z.object({ role: z.literal('judge'), name: z.string().trim().min(1).max(200), identifier: z.string().trim().min(1).max(100) }),
  z.object({ role: z.literal('moderator'), identifier: z.string().trim().min(1).max(100) }),
]);
async function authorize(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '');
  if (!token) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Falta configurar Supabase en el servidor.');
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  const { data: profile, error: profileError } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profileError || profile?.role !== 'admin') return null;
  return supabase;
}
export async function POST(request: Request) {
  try {
    const supabase = await authorize(request);
    if (!supabase) return NextResponse.json({ error: 'Acceso reservado al administrador.' }, { status: 403 });
    const parsed = accountSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Datos no válidos. La contraseña de administrador debe tener al menos 8 caracteres.' }, { status: 400 });
    const input = parsed.data;
    const id = randomUUID();
    const token = input.role === 'admin' ? input.password : randomBytes(18).toString('base64url');
    const identifier = input.role === 'admin' ? input.email.trim().toLowerCase() : input.identifier.trim().toLowerCase();
    const email = input.role === 'admin' ? identifier : `${createHash('sha256').update(`${input.role}:${identifier}`).digest('hex')}@participants.conversatorio.invalid`;
    const name = input.role === 'judge' ? input.name : identifier;
    const { data: { user }, error } = await supabase.auth.admin.createUser({ email, password: token, email_confirm: true });
    if (error || !user) return NextResponse.json({ error: 'No se pudo crear la cuenta. Comprueba que el correo, cédula o usuario no esté registrado.' }, { status: 400 });
    const table = input.role === 'judge' ? 'judges' : 'moderators';
    let inserted = false;
    try {
      if (input.role !== 'admin') {
        const data = input.role === 'judge' ? { name, cedula: identifier, token, status: 'active' } : { username: identifier, token, status: 'active' };
        const result = await supabase.from(table).insert({ id, data });
        if (result.error) throw result.error;
        inserted = true;
      }
      const result = await supabase.from('profiles').insert({ id: user.id, role: input.role, subject_id: input.role === 'admin' ? null : id, display_name: name, identifier });
      if (result.error) throw result.error;
    } catch (cause) {
      if (inserted) await supabase.from(table).delete().eq('id', id);
      await supabase.auth.admin.deleteUser(user.id);
      throw cause;
    }
    return NextResponse.json({ id, role: input.role }, { status: 201 });
  } catch (cause) {
    console.error('Account creation failed:', cause);
    return NextResponse.json({ error: 'No se pudo crear la cuenta. Revisa el schema y las variables de Supabase del servidor.' }, { status: 500 });
  }
}
export async function DELETE(request: Request) {
  try {
    const supabase = await authorize(request);
    if (!supabase) return NextResponse.json({ error: 'Acceso reservado al administrador.' }, { status: 403 });
    const parsed = z.object({ role: z.enum(['judge', 'moderator']), id: z.string().min(1).max(200) }).safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Cuenta no válida.' }, { status: 400 });
    const { role, id } = parsed.data;
    const { data: profile, error } = await supabase.from('profiles').select('id').eq('role', role).eq('subject_id', id).maybeSingle();
    if (error) throw error;
    // Removing the record immediately revokes access, including existing sessions.
    const removed = await supabase.from(role === 'judge' ? 'judges' : 'moderators').delete().eq('id', id);
    if (removed.error) throw removed.error;
    if (profile) {
      const deleted = await supabase.auth.admin.deleteUser(profile.id);
      if (deleted.error) throw deleted.error;
    }
    return NextResponse.json({ ok: true });
  } catch (cause) {
    console.error('Account deletion failed:', cause);
    return NextResponse.json({ error: 'No se pudo completar la eliminación de la cuenta.' }, { status: 500 });
  }
}
