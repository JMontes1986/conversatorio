import { createClient } from '@supabase/supabase-js';
import { createHash, randomBytes, randomInt, randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';

type TournamentFormat = {
  groupStage?: { qualifiersPerRound?: number };
  semifinals?: { qualifiersPerRound?: number };
  final?: { qualifiersPerRound?: number };
};

function serverClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Falta configurar Supabase en el servidor.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function authorize(request: Request) {
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
  if (profileError || !profile || !['admin', 'moderator'].includes(profile.role)) return null;
  return { supabase, user, profile };
}

function phaseKey(phase: string): keyof TournamentFormat {
  const normalized = phase.trim().normalize('NFC').toLocaleLowerCase('es');
  if (normalized.includes('semifinal')) return 'semifinals';
  if (normalized.includes('final')) return 'final';
  return 'groupStage';
}

function canonical(value: unknown) {
  return JSON.stringify(value);
}

function sha256(value: unknown) {
  return createHash('sha256').update(canonical(value)).digest('hex');
}

function resolveDice(teams: string[], slotsAvailable: number) {
  const selected: string[] = [];
  const attempts: Array<{ number: number; rolls: Array<{ team: string; value: number }> }> = [];
  let contenders = [...teams];
  let slots = slotsAvailable;
  let attemptNumber = 1;

  while (slots > 0 && contenders.length > slots) {
    const rolls = contenders.map((team) => ({ team, value: randomInt(1, 7) }));
    attempts.push({ number: attemptNumber++, rolls });
    const sorted = [...rolls].sort((a, b) => b.value - a.value || a.team.localeCompare(b.team, 'es'));
    const cutoffValue = sorted[slots - 1].value;
    const above = sorted.filter((roll) => roll.value > cutoffValue);
    const atCutoff = sorted.filter((roll) => roll.value === cutoffValue);

    selected.push(...above.map((roll) => roll.team));
    slots -= above.length;

    if (slots <= 0) break;
    if (atCutoff.length <= slots) {
      selected.push(...atCutoff.map((roll) => roll.team));
      slots -= atCutoff.length;
      contenders = sorted.filter((roll) => roll.value < cutoffValue).map((roll) => roll.team);
    } else {
      contenders = atCutoff.map((roll) => roll.team);
    }
  }

  if (slots > 0 && contenders.length <= slots) {
    selected.push(...contenders);
  }

  return { selectedTeams: Array.from(new Set(selected)).slice(0, slotsAvailable), attempts };
}

export async function POST(request: Request) {
  try {
    const auth = await authorize(request);
    if (!auth) return NextResponse.json({ error: 'Acceso reservado a organización.' }, { status: 403 });

    const parsed = z.object({ roundName: z.string().trim().min(1).max(200) }).safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Ronda no válida.' }, { status: 400 });
    const roundName = parsed.data.roundName;
    const { supabase, user, profile } = auth;

    const { data: existing } = await supabase.from('tiebreak').select('id,data').eq('id', roundName).maybeSingle();
    if (existing?.data?.sealed === true) {
      return NextResponse.json({ record: existing.data, alreadySealed: true });
    }

    const { data: round, error: roundError } = await supabase
      .from('rounds')
      .select('data')
      .eq('data->>name', roundName)
      .maybeSingle();
    if (roundError || !round) return NextResponse.json({ error: 'No se encontró la ronda.' }, { status: 404 });

    const phase = String(round.data?.phase || '');
    const { data: settings } = await supabase.from('settings').select('data').eq('id', 'competition').maybeSingle();
    const tournamentFormat = (settings?.data?.tournamentFormat || {}) as TournamentFormat;
    const qualifiersPerRound = Number(tournamentFormat[phaseKey(phase)]?.qualifiersPerRound || 1);

    const { data: scoreRows, error: scoreError } = await supabase
      .from('scores')
      .select('id,data')
      .eq('data->>matchId', roundName);
    if (scoreError) throw scoreError;

    const humanScores = (scoreRows || []).filter((row) => row.data?.judgeId !== 'system');
    const totals = new Map<string, number>();
    for (const row of humanScores) {
      for (const team of row.data?.teams || []) {
        totals.set(team.name, (totals.get(team.name) || 0) + Number(team.total || 0));
      }
    }

    const ranking = Array.from(totals.entries())
      .map(([team, score]) => ({ team, score }))
      .sort((a, b) => b.score - a.score || a.team.localeCompare(b.team, 'es'));

    if (ranking.length <= qualifiersPerRound) {
      return NextResponse.json({ error: 'No existe un empate que requiera desempate.' }, { status: 409 });
    }

    const cutoff = ranking[qualifiersPerRound - 1];
    const next = ranking[qualifiersPerRound];
    if (!cutoff || !next || cutoff.score !== next.score) {
      return NextResponse.json({ error: 'El empate no afecta el corte de clasificación.' }, { status: 409 });
    }

    const tiedScore = cutoff.score;
    const teamsAbove = ranking.filter((entry) => entry.score > tiedScore);
    const tiedTeams = ranking.filter((entry) => entry.score === tiedScore).map((entry) => entry.team);
    const slotsAvailable = qualifiersPerRound - teamsAbove.length;

    if (slotsAvailable < 1 || tiedTeams.length <= slotsAvailable) {
      return NextResponse.json({ error: 'El empate no requiere sorteo.' }, { status: 409 });
    }

    const source = {
      roundName,
      phase,
      qualifiersPerRound,
      scores: humanScores
        .map((row) => ({ id: row.id, judgeId: row.data?.judgeId, teams: row.data?.teams }))
        .sort((a, b) => a.id.localeCompare(b.id)),
      ranking,
    };
    const sourceHash = sha256(source);
    const resolved = resolveDice(tiedTeams, slotsAvailable);
    const nonce = randomBytes(32).toString('hex');
    const sealedAt = new Date().toISOString();

    const sealBase = {
      version: 1,
      sealed: true,
      roundName,
      phase,
      tiedScore,
      qualifiersPerRound,
      slotsAvailable,
      teams: tiedTeams,
      attempts: resolved.attempts,
      selectedTeams: resolved.selectedTeams,
      sourceHash,
      nonce,
      sealedAt,
    };
    const integrity = {
      algorithm: 'SHA-256',
      version: 1,
      hash: sha256(sealBase),
    };
    const record = { ...sealBase, integrity };

    const { error: insertError } = await supabase.from('tiebreak').insert({
      id: roundName,
      data: record,
    });
    if (insertError) throw insertError;

    const systemTeams = ranking.map((entry) => ({
      name: entry.team,
      total: resolved.selectedTeams.includes(entry.team) ? 1 : 0,
    }));
    const { error: scoreInsertError } = await supabase.from('scores').insert({
      id: randomUUID(),
      data: {
        matchId: roundName,
        judgeId: 'system',
        judgeName: 'Desempate público sellado',
        teams: systemTeams,
        fullScores: resolved.selectedTeams.map((team) => ({
          name: team,
          total: 1,
          scores: { tiebreaker: 1 },
          checksum: integrity.hash.slice(0, 12).toUpperCase(),
        })),
        tiebreakSealHash: integrity.hash,
        createdAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
      },
    });
    if (scoreInsertError) throw scoreInsertError;

    await supabase.from('audit_logs').insert({
      id: randomUUID(),
      data: {
        category: 'tiebreak',
        action: 'sealed_tiebreak_created',
        actorRole: profile.role,
        actorId: user.id,
        subjectName: roundName,
        details: {
          phase,
          teams: tiedTeams,
          selectedTeams: resolved.selectedTeams,
          hash: integrity.hash,
          sourceHash,
        },
      },
    });

    return NextResponse.json({ record }, { status: 201 });
  } catch (cause) {
    console.error('Sealed tiebreak failed:', cause);
    return NextResponse.json({ error: 'No se pudo generar el desempate sellado.' }, { status: 500 });
  }
}
