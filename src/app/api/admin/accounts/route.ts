import { createClient } from '@supabase/supabase-js';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';
const accountSchema = z.discriminatedUnion('role', [
  z.object({ role: z.literal('admin'), email: z.string().email(), password: z.string().min(8).max(128) }),
  z.object({ role: z.literal('projection'), email: z.string().email(), password: z.string().min(8).max(128) }),
  z.object({
    role: z.literal('judge'),
    name: z.string().trim().min(1).max(200),
    identifier: z.string().trim().min(1).max(100),
    password: z.string().min(8).max(128),
  }),
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
    const credential = input.role === 'admin' || input.role === 'projection'
      ? input.password
      : input.role === 'judge'
        ? input.password
        : randomBytes(18).toString('base64url');
    const identifier = input.role === 'admin' || input.role === 'projection'
      ? input.email.trim().toLowerCase()
      : input.identifier.trim().toLowerCase();
    const email = input.role === 'admin' || input.role === 'projection'
      ? identifier
      : `${createHash('sha256').update(`${input.role}:${identifier}`).digest('hex')}@participants.conversatorio.invalid`;
    const name = input.role === 'judge'
      ? input.name
      : input.role === 'projection'
        ? 'Proyección'
        : identifier;
    let user = null as Awaited<ReturnType<typeof supabase.auth.admin.createUser>>['data']['user'];
    let reusedExistingAuthUser = false;

    const created = await supabase.auth.admin.createUser({
      email,
      password: credential,
      email_confirm: true,
    });

    if (created.error || !created.data.user) {
      // Para cuentas por correo (Admin/Proyección), un intento anterior puede haber
      // dejado el usuario creado en Auth pero sin fila en public.profiles.
      if (input.role === 'admin' || input.role === 'projection') {
        let page = 1;
        let existingAuthUser = null as typeof created.data.user;

        while (!existingAuthUser && page <= 10) {
          const listed = await supabase.auth.admin.listUsers({ page, perPage: 100 });
          if (listed.error) break;
          existingAuthUser = listed.data.users.find(
            candidate => candidate.email?.trim().toLowerCase() === email,
          ) ?? null;
          if (listed.data.users.length < 100) break;
          page += 1;
        }

        if (existingAuthUser) {
          const { data: existingProfile, error: existingProfileError } = await supabase
            .from('profiles')
            .select('id,role')
            .eq('id', existingAuthUser.id)
            .maybeSingle();

          if (existingProfileError) throw existingProfileError;

          if (existingProfile) {
            return NextResponse.json({
              error: existingProfile.role === input.role
                ? 'Esta cuenta ya existe con ese perfil.'
                : `El correo ya pertenece a una cuenta con perfil ${existingProfile.role}.`,
              code: 'account_exists',
            }, { status: 409 });
          }

          const updated = await supabase.auth.admin.updateUserById(existingAuthUser.id, {
            password: credential,
            email_confirm: true,
          });
          if (updated.error || !updated.data.user) {
            console.error('Existing Auth user reconciliation failed:', updated.error);
            return NextResponse.json({
              error: 'El correo existe en Supabase Auth, pero no fue posible recuperar la cuenta.',
              code: 'auth_reconcile_failed',
            }, { status: 409 });
          }

          user = updated.data.user;
          reusedExistingAuthUser = true;
        }
      }

      if (!user) {
        console.error('Supabase Auth create user failed:', created.error);
        return NextResponse.json({
          error: created.error?.message || 'No se pudo crear la cuenta.',
          code: created.error?.code || 'auth_create_failed',
        }, { status: 400 });
      }
    } else {
      user = created.data.user;
    }

    const table = input.role === 'judge' ? 'judges' : 'moderators';
    let inserted = false;
    try {
      if (input.role !== 'admin' && input.role !== 'projection') {
        const data = input.role === 'judge'
          ? { name, cedula: identifier, status: 'active', passwordConfigured: true }
          : { username: identifier, token: credential, status: 'active' };
        const result = await supabase.from(table).insert({ id, data });
        if (result.error) throw result.error;
        inserted = true;
      }
      const result = await supabase.from('profiles').insert({
        id: user.id,
        role: input.role,
        subject_id: input.role === 'admin' || input.role === 'projection' ? null : id,
        display_name: name,
        identifier,
      });
      if (result.error) throw result.error;
    } catch (cause) {
      if (inserted) await supabase.from(table).delete().eq('id', id);
      if (!reusedExistingAuthUser) {
        await supabase.auth.admin.deleteUser(user.id);
      }
      throw cause;
    }
    if (input.role === 'judge') {
      await supabase.from('audit_logs').insert({
        id: randomUUID(),
        data: {
          category: 'judge_security',
          action: 'judge_account_created',
          actorRole: 'admin',
          subjectId: id,
          subjectName: name,
          details: { identifier },
        },
      });
    }
    return NextResponse.json({ id, role: input.role }, { status: 201 });
  } catch (cause) {
    console.error('Account creation failed:', cause);
    return NextResponse.json({ error: 'No se pudo crear la cuenta. Revisa la configuración de Supabase o el estado previo del usuario.' }, { status: 500 });
  }
}
export async function PATCH(request: Request) {
  try {
    const supabase = await authorize(request);
    if (!supabase) return NextResponse.json({ error: 'Acceso reservado al administrador.' }, { status: 403 });

    const parsed = z.object({
      role: z.literal('judge'),
      id: z.string().min(1).max(200),
      password: z.string().min(8).max(128).optional(),
      identifier: z.string().trim().min(1).max(100).optional(),
    }).refine((value) => Boolean(value.password || value.identifier), {
      message: 'Debe enviar una contraseña o una cédula nueva.',
    }).safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Debe indicar una cédula válida o una contraseña de 8 a 128 caracteres.' }, { status: 400 });
    }

    const { id, password } = parsed.data;
    const identifier = parsed.data.identifier?.trim().toLowerCase();
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id,display_name,identifier')
      .eq('role', 'judge')
      .eq('subject_id', id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile) return NextResponse.json({ error: 'Jurado no encontrado.' }, { status: 404 });

    const { data: judgeRecord, error: judgeReadError } = await supabase
      .from('judges')
      .select('data')
      .eq('id', id)
      .single();
    if (judgeReadError) throw judgeReadError;

    if (identifier && identifier !== profile.identifier?.trim().toLowerCase()) {
      const { data: duplicate, error: duplicateError } = await supabase
        .from('judges')
        .select('id')
        .eq('data->>cedula', identifier)
        .neq('id', id)
        .maybeSingle();
      if (duplicateError) throw duplicateError;
      if (duplicate) {
        return NextResponse.json({ error: 'Ya existe otro jurado con esa cédula.' }, { status: 409 });
      }

      const newEmail = `${createHash('sha256').update(`judge:${identifier}`).digest('hex')}@participants.conversatorio.invalid`;
      const authUpdate = await supabase.auth.admin.updateUserById(profile.id, {
        email: newEmail,
        email_confirm: true,
      });
      if (authUpdate.error) throw authUpdate.error;

      const profileUpdate = await supabase
        .from('profiles')
        .update({ identifier })
        .eq('id', profile.id);
      if (profileUpdate.error) throw profileUpdate.error;
    }

    if (password) {
      const passwordUpdate = await supabase.auth.admin.updateUserById(profile.id, { password });
      if (passwordUpdate.error) throw passwordUpdate.error;
    }

    const judgeUpdate = await supabase.from('judges').update({
      data: {
        ...judgeRecord.data,
        ...(identifier ? { cedula: identifier } : {}),
        ...(password ? { passwordConfigured: true } : {}),
      },
    }).eq('id', id);
    if (judgeUpdate.error) throw judgeUpdate.error;

    if (identifier && identifier !== profile.identifier?.trim().toLowerCase()) {
      await supabase.from('audit_logs').insert({
        id: randomUUID(),
        data: {
          category: 'judge_security',
          action: 'judge_identifier_changed',
          actorRole: 'admin',
          subjectId: id,
          subjectName: profile.display_name,
          details: {
            previousIdentifier: profile.identifier,
            identifier,
          },
        },
      });
    }

    if (password) {
      await supabase.from('audit_logs').insert({
        id: randomUUID(),
        data: {
          category: 'judge_security',
          action: 'judge_password_changed',
          actorRole: 'admin',
          subjectId: id,
          subjectName: profile.display_name,
          details: { identifier: identifier || profile.identifier },
        },
      });
    }

    return NextResponse.json({ ok: true, identifier: identifier || profile.identifier });
  } catch (cause) {
    console.error('Judge password update failed:', cause);
    return NextResponse.json({ error: 'No se pudo actualizar la contraseña del jurado.' }, { status: 500 });
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
