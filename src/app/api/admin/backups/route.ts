import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import {
  createCompetitionBackup,
  currentCompetitionHash,
  listCompetitionBackups,
  loadCompetitionBackup,
  restoreCompetitionSnapshot,
} from '@/lib/server/competition-backup';

export const runtime = 'nodejs';

function serverClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Falta configurar Supabase en el servidor.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function authorizeAdmin(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '');
  if (!token) return null;

  const supabase = serverClient();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role,display_name')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || profile?.role !== 'admin') return null;
  return { supabase, user, profile };
}

async function readActiveVersion(supabase: ReturnType<typeof serverClient>) {
  const { data, error } = await supabase
    .from('settings')
    .select('data')
    .eq('id', 'competition')
    .maybeSingle();
  if (error) throw error;
  return data?.data?.activeVersion || null;
}

async function writeActiveVersion(
  supabase: ReturnType<typeof serverClient>,
  activeVersion: Record<string, unknown>,
) {
  const { data, error } = await supabase
    .from('settings')
    .select('data')
    .eq('id', 'competition')
    .maybeSingle();
  if (error) throw error;

  const update = await supabase
    .from('settings')
    .upsert({
      id: 'competition',
      data: {
        ...(data?.data || {}),
        activeVersion,
      },
    });
  if (update.error) throw update.error;
}

export async function GET(request: Request) {
  try {
    const auth = await authorizeAdmin(request);
    if (!auth) {
      return NextResponse.json({ error: 'Acceso reservado al administrador.' }, { status: 403 });
    }

    const [backups, currentHash, activeVersion] = await Promise.all([
      listCompetitionBackups(auth.supabase),
      currentCompetitionHash(auth.supabase),
      readActiveVersion(auth.supabase),
    ]);

    return NextResponse.json({
      backups,
      currentHash,
      activeVersion,
    });
  } catch (cause) {
    console.error('Backup list failed:', cause);
    return NextResponse.json({ error: 'No se pudieron consultar las versiones.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await authorizeAdmin(request);
    if (!auth) {
      return NextResponse.json({ error: 'Acceso reservado al administrador.' }, { status: 403 });
    }

    const backup = await createCompetitionBackup(auth.supabase, 'manual');
    return NextResponse.json({ backup }, { status: 201 });
  } catch (cause) {
    console.error('Manual backup failed:', cause);
    return NextResponse.json({ error: 'No se pudo crear la copia de seguridad.' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await authorizeAdmin(request);
    if (!auth) {
      return NextResponse.json({ error: 'Acceso reservado al administrador.' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const backupId = typeof body?.backupId === 'string' ? body.backupId.trim() : '';
    if (!backupId) {
      return NextResponse.json({ error: 'Debe seleccionar una versión.' }, { status: 400 });
    }

    const target = await loadCompetitionBackup(auth.supabase, backupId);
    const safetyBackup = await createCompetitionBackup(auth.supabase, 'before_restore');
    const safetySnapshot = await loadCompetitionBackup(auth.supabase, safetyBackup.id);

    try {
      await restoreCompetitionSnapshot(auth.supabase, target.snapshot);
      await writeActiveVersion(auth.supabase, {
        kind: 'backup',
        backupId: target.metadata.id,
        backupCreatedAt: target.metadata.createdAt,
        hash: target.metadata.hash,
        restoredAt: new Date().toISOString(),
      });
    } catch (restoreError) {
      console.error('Restore failed, attempting automatic rollback:', restoreError);
      try {
        await restoreCompetitionSnapshot(auth.supabase, safetySnapshot.snapshot);
        await writeActiveVersion(auth.supabase, {
          kind: 'backup',
          backupId: safetyBackup.id,
          backupCreatedAt: safetyBackup.createdAt,
          hash: safetyBackup.hash,
          restoredAt: new Date().toISOString(),
          automaticRollback: true,
        });
      } catch (rollbackError) {
        console.error('Automatic rollback also failed:', rollbackError);
      }
      throw restoreError;
    }

    const restoredHash = await currentCompetitionHash(auth.supabase);
    if (restoredHash !== target.metadata.hash) {
      throw new Error('La versión restaurada no coincide con el hash del backup seleccionado.');
    }

    await auth.supabase.from('audit_logs').insert({
      id: randomUUID(),
      data: {
        category: 'competition_restore',
        action: 'encrypted_backup_restored',
        actorRole: 'admin',
        actorId: auth.user.id,
        subjectName: auth.profile.display_name,
        details: {
          backupId: target.metadata.id,
          hash: target.metadata.hash,
          backupCreatedAt: target.metadata.createdAt,
          safetyBackupId: safetyBackup.id,
        },
      },
    });

    return NextResponse.json({
      ok: true,
      restored: target.metadata,
      safetyBackup,
      currentHash: restoredHash,
    });
  } catch (cause) {
    console.error('Competition restore failed:', cause);
    return NextResponse.json({
      error: cause instanceof Error ? cause.message : 'No se pudo restaurar la versión.',
    }, { status: 500 });
  }
}
