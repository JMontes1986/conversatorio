import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';

function serverClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Falta configurar Supabase en el servidor.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function authorizeJudge(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '');
  if (!token) return null;

  const supabase = serverClient();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role,subject_id')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || profile?.role !== 'judge' || !profile.subject_id) return null;
  return { supabase, profile };
}

function phaseKey(phase: string) {
  const normalized = phase.trim().normalize('NFC').toLocaleLowerCase('es');
  if (normalized.includes('semifinal')) return 'semifinals';
  if (normalized.includes('final')) return 'final';
  return 'groupStage';
}

async function calculateRoundResult(supabase: ReturnType<typeof serverClient>, roundName: string) {
  const [{ data: judges, error: judgesError }, { data: scores, error: scoresError }] = await Promise.all([
    supabase.from('judges').select('id,data'),
    supabase.from('scores').select('id,data').eq('data->>matchId', roundName),
  ]);
  if (judgesError) throw judgesError;
  if (scoresError) throw scoresError;

  const activeJudgeIds = new Set(
    (judges || [])
      .filter((entry) => entry.data?.status === 'active' && entry.data?.passwordConfigured === true)
      .map((entry) => String(entry.id)),
  );

  const humanScores = (scores || []).filter((entry) =>
    entry.data?.judgeId
      && entry.data.judgeId !== 'system'
      && activeJudgeIds.has(String(entry.data.judgeId)),
  );

  const completedJudgeIds = new Set(humanScores.map((entry) => String(entry.data.judgeId)));
  const totalJudges = activeJudgeIds.size;
  const completedJudges = completedJudgeIds.size;

  if (totalJudges === 0 || completedJudges < totalJudges) {
    return {
      roundName,
      status: 'pending',
      completedJudges,
      totalJudges,
    };
  }

  const [{ data: round }, { data: settings }, { data: tiebreak }] = await Promise.all([
    supabase.from('rounds').select('data').eq('data->>name', roundName).maybeSingle(),
    supabase.from('settings').select('data').eq('id', 'competition').maybeSingle(),
    supabase.from('tiebreak').select('data').eq('id', roundName).maybeSingle(),
  ]);

  const phase = String(round?.data?.phase || 'Fase de Grupos');
  const tournamentFormat = settings?.data?.tournamentFormat || {};
  const qualifiersPerRound = Number(tournamentFormat?.[phaseKey(phase)]?.qualifiersPerRound || 1);

  const totals = new Map<string, number>();
  for (const entry of humanScores) {
    for (const team of entry.data?.teams || []) {
      totals.set(String(team.name), (totals.get(String(team.name)) || 0) + Number(team.total || 0));
    }
  }

  const ranking = Array.from(totals.entries())
    .map(([team, total]) => ({ team, total }))
    .sort((a, b) => b.total - a.total || a.team.localeCompare(b.team, 'es'));

  if (tiebreak?.data?.sealed === true && Array.isArray(tiebreak.data?.selectedTeams)) {
    return {
      roundName,
      status: 'resolved',
      method: 'tiebreak',
      completedJudges,
      totalJudges,
      qualifiersPerRound,
      classifiedTeams: tiebreak.data.selectedTeams.map(String),
      tiedTeams: Array.isArray(tiebreak.data?.teams) ? tiebreak.data.teams.map(String) : [],
      integrityHash: tiebreak.data?.integrity?.hash || null,
    };
  }

  if (ranking.length === 0) {
    return {
      roundName,
      status: 'pending',
      completedJudges,
      totalJudges,
    };
  }

  const cutoff = ranking[Math.min(qualifiersPerRound, ranking.length) - 1];
  const next = ranking[Math.min(qualifiersPerRound, ranking.length)];

  if (cutoff && next && cutoff.total === next.total) {
    const teamsAbove = ranking.filter((entry) => entry.total > cutoff.total);
    const tiedTeams = ranking
      .filter((entry) => entry.total === cutoff.total)
      .map((entry) => entry.team);

    return {
      roundName,
      status: 'tie',
      completedJudges,
      totalJudges,
      qualifiersPerRound,
      tiedTeams,
      teamsAlreadyQualified: teamsAbove.map((entry) => entry.team),
    };
  }

  return {
    roundName,
    status: 'resolved',
    method: 'scores',
    completedJudges,
    totalJudges,
    qualifiersPerRound,
    classifiedTeams: ranking
      .slice(0, Math.min(qualifiersPerRound, ranking.length))
      .map((entry) => entry.team),
  };
}

export async function POST(request: Request) {
  try {
    const auth = await authorizeJudge(request);
    if (!auth) return NextResponse.json({ error: 'Acceso reservado a jurados.' }, { status: 403 });

    const parsed = z.object({
      roundNames: z.array(z.string().trim().min(1).max(200)).min(1).max(30),
    }).safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json({ error: 'Rondas no válidas.' }, { status: 400 });
    }

    const uniqueRoundNames = Array.from(new Set(parsed.data.roundNames));
    const results = await Promise.all(
      uniqueRoundNames.map((roundName) => calculateRoundResult(auth.supabase, roundName)),
    );

    return NextResponse.json({ results });
  } catch (cause) {
    console.error('Judge round result failed:', cause);
    return NextResponse.json({ error: 'No se pudo consultar el resultado de la ronda.' }, { status: 500 });
  }
}
