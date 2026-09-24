export type TiebreakRoll = {
  team: string;
  value: number;
};

export type TiebreakAttempt = {
  number: number;
  rolls: TiebreakRoll[];
};

export type TiebreakIntegrity = {
  algorithm: "SHA-256";
  version: 1;
  hash: string;
};

export type SealedTiebreak = {
  sealed: true;
  roundName: string;
  phase: string;
  tiedScore: number;
  qualifiersPerRound: number;
  slotsAvailable: number;
  teams: string[];
  attempts: TiebreakAttempt[];
  selectedTeams: string[];
  sourceHash: string;
  nonce: string;
  sealedAt: string;
  integrity: TiebreakIntegrity;
};

export type TiebreakSealInput = Omit<SealedTiebreak, "integrity">;

export function serializeTiebreakSeal(input: TiebreakSealInput | SealedTiebreak) {
  return JSON.stringify({
    version: 1,
    sealed: true,
    roundName: input.roundName,
    phase: input.phase,
    tiedScore: input.tiedScore,
    qualifiersPerRound: input.qualifiersPerRound,
    slotsAvailable: input.slotsAvailable,
    teams: input.teams,
    attempts: input.attempts.map((attempt) => ({
      number: attempt.number,
      rolls: attempt.rolls.map((roll) => ({
        team: roll.team,
        value: roll.value,
      })),
    })),
    selectedTeams: input.selectedTeams,
    sourceHash: input.sourceHash,
    nonce: input.nonce,
    sealedAt: input.sealedAt,
  });
}

export async function verifyTiebreakSeal(record: SealedTiebreak) {
  if (record.integrity?.algorithm !== "SHA-256" || record.integrity?.version !== 1) {
    return false;
  }

  const bytes = new TextEncoder().encode(serializeTiebreakSeal(record));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const calculated = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

  return calculated === record.integrity.hash;
}

export function phaseResultsArePublished(
  phase: string,
  settings: Record<string, unknown> | null | undefined,
) {
  const normalized = phase.trim().normalize("NFC").toLocaleLowerCase("es");
  if (normalized.includes("grupo")) return settings?.groupStageResultsPublished === true;
  if (normalized.includes("semifinal")) return settings?.semifinalsResultsPublished === true;
  if (normalized.includes("final")) return settings?.finalsResultsPublished === true;
  return false;
}
