import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function serverClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase servidor no está configurado.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function GET(request: Request) {
  try {
    const authorization = request.headers.get('authorization') || '';
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    if (!token) {
      return NextResponse.json({ error: 'Sesión requerida.' }, { status: 401 });
    }

    const supabase = serverClient();
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return NextResponse.json({ error: 'Sesión no válida.' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id,role,subject_id,display_name,identifier')
      .eq('id', userData.user.id)
      .maybeSingle();

    if (profileError) {
      console.error('Profile endpoint failed:', profileError);
      return NextResponse.json({ error: 'No se pudo consultar el perfil.' }, { status: 503 });
    }

    if (!profile) {
      return NextResponse.json({ error: 'Perfil no encontrado.' }, { status: 404 });
    }

    return NextResponse.json({ profile });
  } catch (cause) {
    console.error('Profile endpoint failed:', cause);
    return NextResponse.json({ error: 'No se pudo validar la sesión.' }, { status: 503 });
  }
}
