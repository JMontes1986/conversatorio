import { createClient } from '@supabase/supabase-js';
import { createHash, randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';

const schema = z.object({
  identifier: z.string().trim().min(1).max(100),
  password: z.string().min(8).max(128),
});

function participantEmail(identifier: string) {
  const normalized = identifier.trim().toLowerCase();
  return `${createHash('sha256').update(`judge:${normalized}`).digest('hex')}@participants.conversatorio.invalid`;
}

function requestDetails(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
  const userAgent = request.headers.get('user-agent')?.slice(0, 500) || null;
  return { ip: forwarded, userAgent };
}

function serverClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Falta configurar Supabase en el servidor.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function authClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Falta configurar la clave pública de Supabase.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function writeAudit(
  action: string,
  identifier: string,
  request: Request,
  extra: Record<string, unknown> = {},
) {
  const supabase = serverClient();
  const { error } = await supabase.from('audit_logs').insert({
    id: randomUUID(),
    data: {
      category: 'judge_access',
      action,
      actorRole: 'judge',
      identifier: identifier.trim().toLowerCase(),
      details: { ...requestDetails(request), ...extra },
    },
  });
  if (error) console.error('Judge access audit failed:', error);
}

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Credenciales no válidas.' }, { status: 400 });
    }

    const identifier = parsed.data.identifier.trim().toLowerCase();
    const client = authClient();
    const { data, error } = await client.auth.signInWithPassword({
      email: participantEmail(identifier),
      password: parsed.data.password,
    });

    if (error || !data.session || !data.user) {
      await writeAudit('judge_login_failed', identifier, request, { reason: 'invalid_credentials' });
      return NextResponse.json({ error: 'Cédula o contraseña incorrectos.' }, { status: 401 });
    }

    const server = serverClient();
    const { data: profile, error: profileError } = await server
      .from('profiles')
      .select('role,subject_id,display_name,identifier')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profileError || profile?.role !== 'judge' || !profile.subject_id) {
      await writeAudit('judge_login_failed', identifier, request, { reason: 'invalid_profile' });
      return NextResponse.json({ error: 'La cuenta no está habilitada como jurado.' }, { status: 403 });
    }

    const { data: judge, error: judgeError } = await server
      .from('judges')
      .select('data')
      .eq('id', profile.subject_id)
      .maybeSingle();

    if (judgeError || judge?.data?.status !== 'active') {
      await writeAudit('judge_login_failed', identifier, request, {
        reason: 'inactive',
        subjectId: profile.subject_id,
      });
      return NextResponse.json({ error: 'La cuenta del jurado está inactiva.' }, { status: 403 });
    }

    await writeAudit('judge_login_success', identifier, request, {
      subjectId: profile.subject_id,
      subjectName: profile.display_name,
    });

    return NextResponse.json({
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      },
    });
  } catch (cause) {
    console.error('Judge login failed:', cause);
    return NextResponse.json({ error: 'No se pudo validar el acceso.' }, { status: 500 });
  }
}
