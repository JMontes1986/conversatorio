import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';

const schema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(6).max(256),
});

function authClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase público no está configurado.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function serverClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase servidor no está configurado.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Correo o contraseña no válidos.', code: 'invalid_input' }, { status: 400 });
    }

    const client = authClient();
    const { data, error } = await client.auth.signInWithPassword({
      email: parsed.data.email.toLowerCase(),
      password: parsed.data.password,
    });

    if (error || !data.session || !data.user) {
      const code = error?.code || 'auth_failed';
      if (code === 'invalid_credentials') {
        return NextResponse.json({
          error: 'Correo o contraseña incorrectos.',
          code,
        }, { status: 401 });
      }
      if (code === 'email_not_confirmed') {
        return NextResponse.json({
          error: 'El correo todavía no está confirmado.',
          code,
        }, { status: 403 });
      }

      console.error('Admin Supabase auth failed:', code, error?.message);
      return NextResponse.json({
        error: 'Supabase no respondió correctamente. Intente nuevamente.',
        code: 'supabase_unavailable',
      }, { status: 503 });
    }

    const server = serverClient();
    const { data: profile, error: profileError } = await server
      .from('profiles')
      .select('id,role,subject_id,display_name,identifier')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profileError) {
      console.error('Admin profile lookup failed:', profileError);
      return NextResponse.json({
        error: 'La contraseña fue aceptada, pero no fue posible validar el perfil.',
        code: 'profile_unavailable',
      }, { status: 503 });
    }

    if (profile?.role !== 'admin') {
      return NextResponse.json({
        error: 'Esta cuenta no tiene permisos de administrador.',
        code: 'not_admin',
      }, { status: 403 });
    }

    return NextResponse.json({
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      },
      profile,
    });
  } catch (cause) {
    console.error('Admin login route failed:', cause);
    return NextResponse.json({
      error: 'No se pudo conectar con el servicio de autenticación.',
      code: 'network_or_server_error',
    }, { status: 503 });
  }
}
