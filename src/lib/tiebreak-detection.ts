import type { TournamentFormat } from "@/lib/tournament-format";
import { formatForPhase } from "@/lib/tournament-format";

export type TiebreakScore = {
  matchId: string;
  judgeId?: string;
  teams: { name: string; total: number }[];
};

export type TiebreakRound = {
  name: string;
  phase: string;
};

export type UnresolvedTiebreak = {
  roundName: string;
  phase: string;
  teams: string[];
  score: number;
  qualifiersPerRound: number;
  slotsAvailable: number;
};

export function detectUnresolvedTiebreaks(
  allScores: TiebreakScore[],
  rounds: TiebreakRound[],
  tournamentFormat: TournamentFormat,
  sealedRoundNames: Set<string>,
): UnresolvedTiebreak[] {
  const roundTotals: Record<string, Record<string, number>> = {};

  allScores.forEach((score) => {
    if (score.judgeId === "system") return;
    const roundName = score.matchId.split("-bye-")[0];
    if (!roundTotals[roundName]) roundTotals[roundName] = {};
    score.teams.forEach((team) => {
      roundTotals[roundName][team.name] =
        (roundTotals[roundName][team.name] || 0) + team.total;
    });
  });

  const unresolved: UnresolvedTiebreak[] = [];

  for (const roundName of Object.keys(roundTotals).sort()) {
    if (sealedRoundNames.has(roundName)) continue;

    const round = rounds.find((candidate) => candidate.name === roundName);
    if (!round) continue;

    const qualifiersPerRound =
      formatForPhase(tournamentFormat, round.phase).qualifiersPerRound;

    const ranking = Object.entries(roundTotals[roundName])
      .map(([team, score]) => ({ team, score }))
      .sort((a, b) => b.score - a.score || a.team.localeCompare(b.team, "es"));

    if (ranking.length <= qualifiersPerRound) continue;

    const cutoff = ranking[qualifiersPerRound - 1];
    const next = ranking[qualifiersPerRound];
    if (!cutoff || !next || cutoff.score !== next.score) continue;

    const tiedScore = cutoff.score;
    const teamsAbove = ranking.filter((entry) => entry.score > tiedScore);
    const teamsInTie = ranking
      .filter((entry) => entry.score === tiedScore)
      .map((entry) => entry.team);
    const slotsAvailable = qualifiersPerRound - teamsAbove.length;

    if (slotsAvailable > 0 && teamsInTie.length > slotsAvailable) {
      unresolved.push({
        roundName,
        phase: round.phase,
        teams: teamsInTie,
        score: tiedScore,
        qualifiersPerRound,
        slotsAvailable,
      });
    }
  }

  return unresolved;
}
