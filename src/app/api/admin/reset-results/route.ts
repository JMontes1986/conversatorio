import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import {
  createCompetitionBackup,
  currentCompetitionHash,
} from '@/lib/server/competition-backup';
import { NextResponse } from 'next/server';

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

export async function POST(request: Request) {
  try {
    const auth = await authorizeAdmin(request);
    if (!auth) {
      return NextResponse.json({ error: 'Acceso reservado al administrador.' }, { status: 403 });
    }

    const { supabase, user, profile } = auth;

    // La copia cifrada se crea y verifica antes de cualquier borrado.
    const backup = await createCompetitionBackup(supabase, 'before_reset');

    // Si el schema actualizado ya está instalado, usamos la operación SQL atómica,
    // que es la única autorizada para retirar desempates sellados.
    const rpcReset = await supabase.rpc('reset_competition_results');
    if (!rpcReset.error) {
      const newHash = await currentCompetitionHash(supabase);

      const { data: settingsRow } = await supabase
        .from('settings')
        .select('data')
        .eq('id', 'competition')
        .maybeSingle();

      const activeVersion = {
        kind: 'current',
        createdAt: new Date().toISOString(),
        hash: newHash,
        previousBackupId: backup.id,
        previousBackupHash: backup.hash,
      };

      const settingsUpdate = await supabase
        .from('settings')
        .upsert({
          id: 'competition',
          data: {
            ...(settingsRow?.data || {}),
            activeVersion,
          },
        });
      if (settingsUpdate.error) throw settingsUpdate.error;

      return NextResponse.json({
        ok: true,
        deletedScores: rpcReset.data?.deletedScores ?? 0,
        deletedTiebreaks: rpcReset.data?.deletedTiebreaks ?? 0,
        mode: 'database',
        backup,
        activeVersion,
      });
    }

    // Compatibilidad temporal con bases que aún no tienen la RPC instalada.
    // Solo hacemos fallback cuando PostgREST indica que la función no existe.
    const missingRpc = rpcReset.error.code === 'PGRST202'
      || /reset_competition_results/i.test(rpcReset.error.message || '');
    if (!missingRpc) throw rpcReset.error;

    const [{ count: scoreCount, error: scoreCountError }, { count: tiebreakCount, error: tiebreakCountError }] = await Promise.all([
      supabase.from('scores').select('id', { count: 'exact', head: true }),
      supabase.from('tiebreak').select('id', { count: 'exact', head: true }),
    ]);
    if (scoreCountError) throw scoreCountError;
    if (tiebreakCountError) throw tiebreakCountError;

    // El service role solo se usa dentro de esta ruta protegida. Permite limpiar
    // registros sellados durante un reinicio explícito sin exponer esa capacidad al cliente.
    const deleteTiebreaks = await supabase.from('tiebreak').delete().neq('id', '__never__');
    if (deleteTiebreaks.error) throw deleteTiebreaks.error;

    const deleteScores = await supabase.from('scores').delete().neq('id', '__never__');
    if (deleteScores.error) throw deleteScores.error;

    const { data: settingsRow, error: settingsReadError } = await supabase
      .from('settings')
      .select('data')
      .eq('id', 'competition')
      .maybeSingle();
    if (settingsReadError) throw settingsReadError;

    const settingsUpdate = await supabase
      .from('settings')
      .update({
        data: {
          ...(settingsRow?.data || {}),
          groupStageResultsPublished: false,
          semifinalsResultsPublished: false,
          finalsResultsPublished: false,
        },
      })
      .eq('id', 'competition');
    if (settingsUpdate.error) throw settingsUpdate.error;

    const { data: debateStateRow, error: debateStateReadError } = await supabase
      .from('debate_state')
      .select('data')
      .eq('id', 'current')
      .maybeSingle();
    if (debateStateReadError) throw debateStateReadError;

    const debateStateUpdate = await supabase
      .from('debate_state')
      .update({
        data: {
          ...(debateStateRow?.data || {}),
          publicTiebreak: null,
        },
      })
      .eq('id', 'current');
    if (debateStateUpdate.error) throw debateStateUpdate.error;

    await supabase.from('audit_logs').insert({
      id: randomUUID(),
      data: {
        category: 'competition_reset',
        action: 'competition_results_reset',
        actorRole: 'admin',
        actorId: user.id,
        subjectName: profile.display_name,
        details: {
          deletedScores: scoreCount || 0,
          deletedTiebreaks: tiebreakCount || 0,
        },
      },
    });

    const newHash = await currentCompetitionHash(supabase);
    const activeVersion = {
      kind: 'current',
      createdAt: new Date().toISOString(),
      hash: newHash,
      previousBackupId: backup.id,
      previousBackupHash: backup.hash,
    };

    const { data: refreshedSettings } = await supabase
      .from('settings')
      .select('data')
      .eq('id', 'competition')
      .maybeSingle();

    const versionUpdate = await supabase
      .from('settings')
      .upsert({
        id: 'competition',
        data: {
          ...(refreshedSettings?.data || {}),
          activeVersion,
        },
      });
    if (versionUpdate.error) throw versionUpdate.error;

    return NextResponse.json({
      ok: true,
      deletedScores: scoreCount || 0,
      deletedTiebreaks: tiebreakCount || 0,
      mode: 'compatibility',
      backup,
      activeVersion,
    });
  } catch (cause) {
    console.error('Competition results reset failed:', cause);
    return NextResponse.json({
      error: 'No se pudieron reiniciar los resultados. Revisa la configuración de Supabase del servidor.',
    }, { status: 500 });
  }
}
