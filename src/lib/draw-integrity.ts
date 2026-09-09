export type DrawMatchup = {
  roundName: string;
  teams: string[];
};

export type DrawIntegrity = {
  algorithm: "SHA-256";
  version: 1;
  hash: string;
  sealedAt: string;
};

function normalizeText(value: string) {
  return value.trim().normalize("NFC");
}

export function normalizeDrawMatchups(matchups: unknown): DrawMatchup[] {
  if (!Array.isArray(matchups)) return [];
  return matchups.flatMap((matchup) => {
    if (!matchup || typeof matchup !== "object") return [];
    const candidate = matchup as { roundName?: unknown; teams?: unknown };
    if (typeof candidate.roundName !== "string" || !Array.isArray(candidate.teams)) return [];
    const teams = candidate.teams
      .filter((team): team is string => typeof team === "string")
      .map(normalizeText)
      .filter(Boolean);
    const roundName = normalizeText(candidate.roundName);
    return roundName && teams.length > 0 ? [{ roundName, teams }] : [];
  });
}

export function serializeGroupDraw(matchups: DrawMatchup[]) {
  return JSON.stringify({
    version: 1,
    phase: "Fase de Grupos",
    matchups: normalizeDrawMatchups(matchups),
  });
}

export async function hashGroupDraw(matchups: DrawMatchup[]) {
  const bytes = new TextEncoder().encode(serializeGroupDraw(matchups));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function sealGroupDraw(matchups: DrawMatchup[]): Promise<DrawIntegrity> {
  return {
    algorithm: "SHA-256",
    version: 1,
    hash: await hashGroupDraw(matchups),
    sealedAt: new Date().toISOString(),
  };
}

export async function verifyGroupDraw(matchups: DrawMatchup[], integrity?: DrawIntegrity | null) {
  if (!integrity || integrity.algorithm !== "SHA-256" || integrity.version !== 1) return false;
  return (await hashGroupDraw(matchups)) === integrity.hash;
}

function secureRandomIndex(maxExclusive: number) {
  if (maxExclusive <= 1) return 0;
  const range = 0x1_0000_0000;
  const limit = range - (range % maxExclusive);
  const value = new Uint32Array(1);
  do {
    crypto.getRandomValues(value);
  } while (value[0] >= limit);
  return value[0] % maxExclusive;
}

export function secureShuffle<T>(values: readonly T[]) {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = secureRandomIndex(index + 1);
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return shuffled;
}
