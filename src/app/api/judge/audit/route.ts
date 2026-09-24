import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';

function serverClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Falta configurar Supabase en el servidor.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function POST(request: Request) {
  try {
    const token = request.headers.get('authorization')?.replace(/^Bearer /, '');
    if (!token) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

    const parsed = z.object({ action: z.literal('logout') }).safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Acción no válida.' }, { status: 400 });

    const supabase = serverClient();
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return NextResponse.json({ error: 'Sesión no válida.' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('role,subject_id,display_name,identifier')
      .eq('id', user.id)
      .maybeSingle();
    if (profile?.role !== 'judge') return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });

    const { error: auditError } = await supabase.from('audit_logs').insert({
      id: randomUUID(),
      data: {
        category: 'judge_access',
        action: 'judge_logout',
        actorRole: 'judge',
        subjectId: profile.subject_id,
        subjectName: profile.display_name,
        identifier: profile.identifier,
        details: {
          ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
          userAgent: request.headers.get('user-agent')?.slice(0, 500) || null,
        },
      },
    });
    if (auditError) throw auditError;

    return NextResponse.json({ ok: true });
  } catch (cause) {
    console.error('Judge audit failed:', cause);
    return NextResponse.json({ error: 'No se pudo registrar la auditoría.' }, { status: 500 });
  }
}
