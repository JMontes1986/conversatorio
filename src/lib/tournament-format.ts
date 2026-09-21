export type PhaseFormat = {
  teamsPerRound: number;
  qualifiersPerRound: number;
};

export type TournamentFormat = {
  groupStage: PhaseFormat;
  semifinals: PhaseFormat;
  final: PhaseFormat;
};

export const DEFAULT_TOURNAMENT_FORMAT: TournamentFormat = {
  groupStage: {
    teamsPerRound: 3,
    qualifiersPerRound: 1,
  },
  semifinals: {
    teamsPerRound: 3,
    qualifiersPerRound: 2,
  },
  final: {
    teamsPerRound: 2,
    qualifiersPerRound: 1,
  },
};

function positiveInteger(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizePhaseFormat(value: unknown, fallback: PhaseFormat): PhaseFormat {
  const candidate = value && typeof value === "object"
    ? value as Partial<PhaseFormat>
    : {};

  const teamsPerRound = positiveInteger(candidate.teamsPerRound, fallback.teamsPerRound);
  const requestedQualifiers = positiveInteger(candidate.qualifiersPerRound, fallback.qualifiersPerRound);
  const qualifiersPerRound = Math.min(requestedQualifiers, Math.max(1, teamsPerRound - 1));

  return { teamsPerRound, qualifiersPerRound };
}

export function normalizeTournamentFormat(value: unknown): TournamentFormat {
  const candidate = value && typeof value === "object"
    ? value as Partial<TournamentFormat>
    : {};

  return {
    groupStage: normalizePhaseFormat(candidate.groupStage, DEFAULT_TOURNAMENT_FORMAT.groupStage),
    semifinals: normalizePhaseFormat(candidate.semifinals, DEFAULT_TOURNAMENT_FORMAT.semifinals),
    final: normalizePhaseFormat(candidate.final, DEFAULT_TOURNAMENT_FORMAT.final),
  };
}

export function phaseKeyFromName(phase: string): keyof TournamentFormat {
  const normalized = phase.trim().normalize("NFC").toLocaleLowerCase("es");
  if (normalized.includes("semifinal")) return "semifinals";
  if (normalized.includes("final")) return "final";
  return "groupStage";
}

export function formatForPhase(format: TournamentFormat, phase: string): PhaseFormat {
  return format[phaseKeyFromName(phase)];
}

export function requiredRoundCount(teamCount: number, teamsPerRound: number) {
  if (teamCount <= 0) return 0;
  return Math.ceil(teamCount / Math.max(1, teamsPerRound));
}

export function expectedQualifierCount(teamCount: number, phaseFormat: PhaseFormat) {
  if (teamCount <= 0) return 0;
  const rounds = requiredRoundCount(teamCount, phaseFormat.teamsPerRound);
  const completeRounds = Math.floor(teamCount / phaseFormat.teamsPerRound);
  const remainder = teamCount % phaseFormat.teamsPerRound;
  return (completeRounds * phaseFormat.qualifiersPerRound)
    + (remainder > 0 ? Math.min(remainder, phaseFormat.qualifiersPerRound) : 0)
    + Math.max(0, rounds - completeRounds - (remainder > 0 ? 1 : 0)) * phaseFormat.qualifiersPerRound;
}
