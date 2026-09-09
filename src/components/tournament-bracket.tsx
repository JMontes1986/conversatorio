"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, ShieldAlert, ShieldCheck, Swords, Trophy } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { cn } from "@/lib/utils";
import { collection, doc, onSnapshot, orderBy, query, setDoc } from "@/lib/documents";
import { db } from "@/lib/supabase";
import {
  type DrawIntegrity,
  normalizeDrawMatchups,
  verifyGroupDraw,
} from "@/lib/draw-integrity";

type SchoolData = {
  teamName?: string;
  schoolName?: string;
  status?: string;
};

type RoundData = {
  id: string;
  name: string;
  phase: string;
};

type ScoreData = {
  matchId: string;
  teams: { name: string; total: number }[];
};

type DrawMatchup = {
  roundName: string;
  teams: string[];
};

type TeamSlot = {
  name: string;
  pending: boolean;
  score?: number;
};

type BracketMatch = {
  id: string;
  label: string;
  teams: TeamSlot[];
  winner: string | null;
  isBye: boolean;
};

type BracketStage = {
  id: string;
  title: string;
  matches: BracketMatch[];
};

type SeedingMode = "automatic" | "manual";
type DrawIntegrityStatus = "none" | "checking" | "valid" | "invalid" | "rounds-mismatch" | "teams-mismatch";

const DEFAULT_TITLE = "Conversatorio Colgemelli";
const DEFAULT_SUBTITLE = "Bracket del torneo";

function uniqueTeamNames(names: unknown[]) {
  const seen = new Set<string>();
  const uniqueNames: string[] = [];
  names.forEach((name) => {
    if (typeof name !== "string") return;
    const normalized = name.trim().normalize("NFC");
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    uniqueNames.push(normalized);
  });
  return uniqueNames;
}

function scoreResult(matchName: string, scores: ScoreData[]) {
  const matchingScores = scores.filter(
    (score) => score.matchId.split("-bye-")[0] === matchName,
  );
  if (matchingScores.length === 0) return null;

  const totals = new Map<string, number>();
  matchingScores.forEach((score) => {
    score.teams.forEach((team) => {
      totals.set(team.name, (totals.get(team.name) ?? 0) + team.total);
    });
  });

  const teams = Array.from(totals, ([name, total]) => ({
    name,
    score: total,
    pending: false,
  })).sort((a, b) => b.score - a.score);

  if (teams.length === 0) return null;
  const winner = teams.length === 1 || teams[0].score > teams[1].score
    ? teams[0].name
    : null;

  return { teams, winner };
}

function stageTitle(matchCount: number) {
  if (matchCount === 1) return "Final";
  if (matchCount === 2) return "Semifinales";
  if (matchCount <= 4) return "Cuartos de final";
  if (matchCount <= 8) return "Octavos de final";
  return "Fase eliminatoria";
}

function configuredStageTitle(phase: string, matchCount: number) {
  const normalizedPhase = phase.toLocaleLowerCase("es");
  if (normalizedPhase.includes("semifinal")) return "Semifinales";
  if (normalizedPhase.includes("final")) return matchCount === 1 ? "Final" : "Fase final";
  return phase;
}

function advancingSlot(match: BracketMatch): TeamSlot {
  if (match.isBye && match.teams.length === 1) {
    return {
      name: match.winner ?? match.teams[0].name,
      pending: !match.winner || match.teams[0].pending,
    };
  }
  return {
    name: match.winner ?? `Ganador de ${match.label}`,
    pending: !match.winner,
  };
}

function buildBracket(
  teamNames: string[],
  drawMatchups: DrawMatchup[],
  rounds: RoundData[],
  scores: ScoreData[],
  currentRound: string,
  currentTeams: string[],
) {
  const registeredTeams = uniqueTeamNames(
    teamNames.length > 0 ? teamNames : drawMatchups.flatMap((matchup) => matchup.teams),
  );
  const registeredSet = new Set(registeredTeams);
  const assignedTeams = new Set<string>();
  const initialPairs: { label?: string; teams: string[] }[] = [];

  drawMatchups.forEach((matchup) => {
    const teams = uniqueTeamNames(matchup.teams)
      .filter((team) => registeredSet.has(team) && !assignedTeams.has(team));
    teams.forEach((team) => assignedTeams.add(team));
    if (teams.length > 0) initialPairs.push({ label: matchup.roundName, teams });
  });

  const unassignedTeams = registeredTeams.filter((team) => !assignedTeams.has(team));
  for (let index = 0; index < unassignedTeams.length; index += 2) {
    initialPairs.push({ teams: unassignedTeams.slice(index, index + 2) });
  }

  const groupRounds = rounds.filter((round) => round.phase === "Fase de Grupos");
  const eliminationRounds = rounds.filter((round) => round.phase !== "Fase de Grupos");

  const initialMatches = initialPairs.map((pair, index): BracketMatch => {
    const label = pair.label || groupRounds[index]?.name || `Llave ${index + 1}`;
    const result = scoreResult(label, scores);
    const isBye = pair.teams.length === 1;
    return {
      id: `initial-${index}`,
      label,
      teams: result?.teams ?? pair.teams.map((name) => ({ name, pending: false })),
      winner: result?.winner ?? (isBye ? pair.teams[0] : null),
      isBye,
    };
  });

  if (initialMatches.length === 0) return [];

  const stages: BracketStage[] = [{
    id: "initial",
    title: groupRounds.length > 0 ? "Fase de grupos" : "Llaves iniciales",
    matches: initialMatches,
  }];

  let previousMatches = initialMatches;
  let stageIndex = 1;

  const configuredPhases = eliminationRounds.reduce<{ name: string; rounds: RoundData[] }[]>((phases, round) => {
    const existingPhase = phases.find((phase) => phase.name === round.phase);
    if (existingPhase) existingPhase.rounds.push(round);
    else phases.push({ name: round.phase, rounds: [round] });
    return phases;
  }, []);

  configuredPhases.forEach((phase) => {
    if (previousMatches.length === 0 || phase.rounds.length === 0) return;
    const advancingSlots = previousMatches.map(advancingSlot);
    const baseSize = Math.floor(advancingSlots.length / phase.rounds.length);
    const remainder = advancingSlots.length % phase.rounds.length;
    let slotIndex = 0;

    const matches = phase.rounds.map((round, roundIndex): BracketMatch => {
      const receivesExtraSlot = remainder > 0 && roundIndex >= phase.rounds.length - remainder;
      const slotCount = baseSize + (receivesExtraSlot ? 1 : 0);
      const slots = advancingSlots.slice(slotIndex, slotIndex + slotCount);
      slotIndex += slotCount;

      const result = scoreResult(round.name, scores);
      const activeTeams = round.name === currentRound
        ? uniqueTeamNames(currentTeams).map((name) => ({ name, pending: false }))
        : null;
      const displayedTeams = result?.teams ?? activeTeams ?? (slots.length > 0
        ? slots
        : [{ name: "Clasificado por definir", pending: true }]);
      const isBye = displayedTeams.length === 1;

      return {
        id: `stage-${stageIndex}-match-${roundIndex}`,
        label: round.name,
        teams: displayedTeams,
        winner: result?.winner ?? (isBye && !displayedTeams[0].pending ? displayedTeams[0].name : null),
        isBye,
      };
    });

    stages.push({
      id: `stage-${stageIndex}`,
      title: configuredStageTitle(phase.name, matches.length),
      matches,
    });
    previousMatches = matches;
    stageIndex += 1;
  });

  while (previousMatches.length > 1) {
    const advancingSlots = previousMatches.map(advancingSlot);
    const nextMatches: BracketMatch[] = [];

    for (let index = 0; index < advancingSlots.length; index += 2) {
      const slots = advancingSlots.slice(index, index + 2);
      const isBye = slots.length === 1;
      const label = isBye ? "Pase directo" : `Llave ${stages.length + 1}.${nextMatches.length + 1}`;

      const result = scoreResult(label, scores);
      const activeTeams = label === currentRound
        ? uniqueTeamNames(currentTeams).map((name) => ({ name, pending: false }))
        : null;
      const displayedTeams = result?.teams ?? activeTeams ?? slots;

      nextMatches.push({
        id: `stage-${stageIndex}-match-${nextMatches.length}`,
        label,
        teams: displayedTeams,
        winner: result?.winner ?? (isBye && !slots[0].pending ? slots[0].name : null),
        isBye,
      });
    }

    stages.push({
      id: `stage-${stageIndex}`,
      title: stageTitle(nextMatches.length),
      matches: nextMatches,
    });
    previousMatches = nextMatches;
    stageIndex += 1;
  }

  return stages;
}

function MatchCard({ match, isLastStage }: { match: BracketMatch; isLastStage: boolean }) {
  return (
    <div className="relative w-64 shrink-0">
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <span className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {match.label}
        </span>
        {match.isBye && <Badge variant="secondary">Pase directo</Badge>}
      </div>
      <div className="overflow-hidden rounded-xl border bg-background shadow-sm">
        {match.teams.map((team, index) => {
          const isWinner = match.winner === team.name;
          return (
            <div
              key={`${match.id}-${team.name}-${index}`}
              className={cn(
                "flex min-h-12 items-center justify-between gap-3 px-4 py-3",
                index > 0 && "border-t",
                team.pending && "bg-muted/40 text-muted-foreground",
                isWinner && "bg-emerald-600 font-semibold text-white",
              )}
            >
              <span className="min-w-0 truncate">{team.name}</span>
              <span className="flex shrink-0 items-center gap-2">
                {typeof team.score === "number" && (
                  <span className="tabular-nums">{team.score}</span>
                )}
                {isWinner && <CheckCircle2 className="h-4 w-4" aria-label="Ganador de la llave" />}
              </span>
            </div>
          );
        })}
      </div>
      {!isLastStage && (
        <div className="absolute left-full top-[calc(50%+10px)] h-px w-10 bg-border" aria-hidden="true" />
      )}
    </div>
  );
}

export function TournamentBracket() {
  const [teams, setTeams] = useState<string[]>([]);
  const [publicTeams, setPublicTeams] = useState<string[]>([]);
  const [rounds, setRounds] = useState<RoundData[]>([]);
  const [scores, setScores] = useState<ScoreData[]>([]);
  const [drawMatchups, setDrawMatchups] = useState<DrawMatchup[]>([]);
  const [drawIntegrity, setDrawIntegrity] = useState<DrawIntegrity | null>(null);
  const [drawIntegrityStatus, setDrawIntegrityStatus] = useState<DrawIntegrityStatus>("none");
  const [currentRound, setCurrentRound] = useState("");
  const [currentTeams, setCurrentTeams] = useState<string[]>([]);
  const [title, setTitle] = useState(DEFAULT_TITLE);
  const [subtitle, setSubtitle] = useState(DEFAULT_SUBTITLE);
  const [seedingMode, setSeedingMode] = useState<SeedingMode>("automatic");
  const [manualTeamOrder, setManualTeamOrder] = useState<string[]>([]);
  const [manualAcceptedAt, setManualAcceptedAt] = useState<string | null>(null);
  const [loadingTeams, setLoadingTeams] = useState(true);

  useEffect(() => {
    const unsubscribeTeams = onSnapshot(
      query(collection(db, "schools"), orderBy("createdAt", "asc")),
      (snapshot) => {
        setTeams(snapshot.docs.flatMap((school) => {
          const data = school.data() as SchoolData;
          if (data.status !== "Verificado") return [];
          return [data.teamName || data.schoolName || ""];
        }));
        setLoadingTeams(false);
      },
      (error) => {
        console.error("Error loading bracket teams:", error);
        setLoadingTeams(false);
      },
    );

    const unsubscribeRounds = onSnapshot(
      query(collection(db, "rounds"), orderBy("createdAt", "asc")),
      (snapshot) => setRounds(snapshot.docs.map((round) => ({
        id: round.id,
        ...round.data(),
      } as RoundData))),
    );

    const unsubscribeScores = onSnapshot(
      query(collection(db, "scores"), orderBy("createdAt", "desc")),
      (snapshot) => setScores(snapshot.docs.map((score) => score.data() as ScoreData)),
    );

    const unsubscribeDraw = onSnapshot(doc(db, "drawState", "liveDraw"), (snapshot) => {
      const drawData = snapshot.exists() ? snapshot.data() : {};
      const phases = drawData.phases;
      const groupPhase = Array.isArray(phases)
        ? phases.find((phase) => phase.name === "Fase de Grupos")
        : null;
      setDrawMatchups(normalizeDrawMatchups(groupPhase?.matchups));
      setDrawIntegrity(drawData.integrity ?? null);
    });

    const unsubscribeState = onSnapshot(doc(db, "debateState", "current"), (snapshot) => {
      const data = snapshot.exists() ? snapshot.data() : {};
      setTitle(data.bracketTitle || DEFAULT_TITLE);
      setSubtitle(data.bracketSubtitle || DEFAULT_SUBTITLE);
      setSeedingMode(data.bracketSeedingMode === "manual" ? "manual" : "automatic");
      setManualAcceptedAt(
        data.bracketSeedingMode === "manual" && typeof data.bracketManualAcceptedAt === "string"
          ? data.bracketManualAcceptedAt
          : null,
      );
      setManualTeamOrder(Array.isArray(data.bracketTeamOrder)
        ? uniqueTeamNames(data.bracketTeamOrder)
        : []);
      setPublicTeams(Array.isArray(data.bracketTeams)
        ? data.bracketTeams.filter((team): team is string => typeof team === "string")
        : []);
      setCurrentRound(data.currentRound || "");
      setCurrentTeams(Array.isArray(data.teams)
        ? data.teams.map((team) => team.name).filter(Boolean)
        : []);
    });

    return () => {
      unsubscribeTeams();
      unsubscribeRounds();
      unsubscribeScores();
      unsubscribeDraw();
      unsubscribeState();
    };
  }, []);

  const availableTeams = useMemo(
    () => teams.length > 0 ? uniqueTeamNames(teams) : uniqueTeamNames(publicTeams),
    [teams, publicTeams],
  );

  const displayTeams = useMemo(() => {
    if (seedingMode !== "manual") return availableTeams;
    const availableSet = new Set(availableTeams);
    const savedOrder = manualTeamOrder.filter((team) => availableSet.has(team));
    const savedSet = new Set(savedOrder);
    return [...savedOrder, ...availableTeams.filter((team) => !savedSet.has(team))];
  }, [availableTeams, manualTeamOrder, seedingMode]);

  useEffect(() => {
    let cancelled = false;
    if (drawMatchups.length === 0 || !drawIntegrity) {
      setDrawIntegrityStatus("none");
      return;
    }

    setDrawIntegrityStatus("checking");
    void verifyGroupDraw(drawMatchups, drawIntegrity).then((isValid) => {
      if (cancelled) return;
      if (!isValid) {
        setDrawIntegrityStatus("invalid");
        return;
      }

      const configuredRoundNames = rounds
        .filter((round) => round.phase === "Fase de Grupos")
        .map((round) => round.name.trim().normalize("NFC"));
      const drawRoundNames = drawMatchups.map((matchup) => matchup.roundName);
      if (JSON.stringify(configuredRoundNames) !== JSON.stringify(drawRoundNames)) {
        setDrawIntegrityStatus("rounds-mismatch");
        return;
      }

      const configuredTeams = [...availableTeams].sort((a, b) => a.localeCompare(b, "es"));
      const drawnTeams = uniqueTeamNames(drawMatchups.flatMap((matchup) => matchup.teams))
        .sort((a, b) => a.localeCompare(b, "es"));
      setDrawIntegrityStatus(
        JSON.stringify(configuredTeams) === JSON.stringify(drawnTeams) ? "valid" : "teams-mismatch",
      );
    });

    return () => {
      cancelled = true;
    };
  }, [availableTeams, drawIntegrity, drawMatchups, rounds]);

  useEffect(() => {
    if (teams.length === 0) return;
    const sanitizedTeams = uniqueTeamNames(teams);
    if (JSON.stringify(sanitizedTeams) === JSON.stringify(uniqueTeamNames(publicTeams))) return;

    void setDoc(
      doc(db, "debateState", "current"),
      { bracketTeams: sanitizedTeams },
      { merge: true },
    ).catch((error) => {
      console.error("Error publishing bracket team names:", error);
    });
  }, [teams, publicTeams]);

  const stages = useMemo(() => buildBracket(
    displayTeams,
    seedingMode === "automatic" && drawIntegrityStatus === "valid" ? drawMatchups : [],
    rounds,
    scores,
    currentRound,
    currentTeams,
  ), [displayTeams, drawIntegrityStatus, drawMatchups, rounds, scores, currentRound, currentTeams, seedingMode]);

  const champion = stages.at(-1)?.matches[0]?.winner ?? null;

  return (
    <Card className="overflow-hidden border-0 shadow-xl">
      <CardHeader className="border-b bg-gradient-to-r from-slate-950 via-slate-900 to-orange-950 text-white">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <CardTitle className="font-headline text-2xl md:text-3xl">{title}</CardTitle>
            <CardDescription className="mt-1 text-slate-300">{subtitle}</CardDescription>
          </div>
          <Badge className="w-fit bg-amber-400 text-slate-950 hover:bg-amber-400">
            <Swords className="mr-1 h-4 w-4" /> {displayTeams.length} equipos
          </Badge>
          <Badge variant="outline" className="w-fit border-white/40 text-white">
            {seedingMode === "manual" ? (
              <><ShieldCheck className="mr-1 h-4 w-4" /> Cambio manual aceptado</>
            ) : "Organización automática"}
          </Badge>
          {seedingMode === "automatic" && (
            <Badge
              variant="outline"
              className={cn(
                "w-fit border-white/40 text-white",
                drawIntegrityStatus === "valid" && "border-emerald-300 bg-emerald-500/20",
                ["invalid", "rounds-mismatch", "teams-mismatch"].includes(drawIntegrityStatus) && "border-red-300 bg-red-500/20",
              )}
            >
              {drawIntegrityStatus === "valid" ? <ShieldCheck className="mr-1 h-4 w-4" /> : <ShieldAlert className="mr-1 h-4 w-4" />}
              {{
                none: "Sorteo sin sello",
                checking: "Verificando sorteo",
                valid: "Sorteo SHA-256 verificado",
                invalid: "Hash del sorteo inválido",
                "rounds-mismatch": "Las rondas no coinciden",
                "teams-mismatch": "Los equipos no coinciden",
              }[drawIntegrityStatus]}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="bg-gradient-to-br from-slate-100 via-background to-orange-50 p-0 dark:from-slate-950 dark:via-background dark:to-orange-950/30">
        {seedingMode === "automatic" && drawIntegrityStatus !== "valid" && drawIntegrityStatus !== "checking" && (
          <div className="border-b border-amber-300 bg-amber-50 px-6 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
            El bracket no aplicará el sorteo hasta que su hash, sus rondas y sus equipos coincidan. Mientras tanto muestra el orden de colegios verificados.
          </div>
        )}
        {seedingMode === "manual" && (
          <div className="border-b border-emerald-300 bg-emerald-50 px-6 py-3 text-sm text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">
            Esta organización manual fue aceptada por el administrador y reemplaza el orden del sorteo automático.
            {manualAcceptedAt && ` Guardada el ${new Date(manualAcceptedAt).toLocaleString("es-CO")}.`}
          </div>
        )}
        {loadingTeams ? (
          <div className="flex min-h-96 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : stages.length === 0 ? (
          <div className="flex min-h-80 flex-col items-center justify-center gap-3 px-6 text-center text-muted-foreground">
            <Swords className="h-12 w-12" />
            <p className="font-medium">Aún no hay equipos registrados para crear el bracket.</p>
          </div>
        ) : (
          <div className="overflow-x-auto p-6 md:p-10">
            <div className="flex min-w-max items-stretch gap-10">
              {stages.map((stage, stageIndex) => (
                <section key={stage.id} className="flex w-64 shrink-0 flex-col" aria-labelledby={`${stage.id}-title`}>
                  <h3
                    id={`${stage.id}-title`}
                    className="mb-6 text-center font-headline text-lg font-bold uppercase tracking-wide text-slate-900 dark:text-slate-100"
                  >
                    {stage.title}
                  </h3>
                  <div className="flex flex-1 flex-col justify-around gap-8">
                    {stage.matches.map((match) => (
                      <MatchCard
                        key={match.id}
                        match={match}
                        isLastStage={stageIndex === stages.length - 1}
                      />
                    ))}
                  </div>
                </section>
              ))}

              <section className="flex w-64 shrink-0 flex-col justify-center" aria-labelledby="champion-title">
                <h3 id="champion-title" className="mb-6 text-center font-headline text-xl font-bold uppercase tracking-wide">
                  Campeón
                </h3>
                <div className={cn(
                  "rounded-2xl border-2 p-6 text-center shadow-lg",
                  champion
                    ? "border-amber-400 bg-gradient-to-br from-amber-300 to-orange-400 text-slate-950"
                    : "border-dashed bg-background/80 text-muted-foreground",
                )}>
                  <Trophy className={cn("mx-auto mb-3 h-10 w-10", champion && "text-amber-950")} />
                  <p className="font-headline text-xl font-bold">{champion || "Por definir"}</p>
                </div>
              </section>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
