"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { collection, doc, onSnapshot } from "@/lib/documents";
import { db } from "@/lib/supabase";
import { TieBreaker } from "@/components/tie-breaker";
import {
  DEFAULT_TOURNAMENT_FORMAT,
  type TournamentFormat,
  normalizeTournamentFormat,
} from "@/lib/tournament-format";
import { detectUnresolvedTiebreaks } from "@/lib/tiebreak-detection";
import type { SealedTiebreak } from "@/lib/tiebreak-integrity";

type ScoreData = {
  id: string;
  matchId: string;
  judgeId?: string;
  judgeName?: string;
  teams: { name: string; total: number }[];
};

type RoundData = {
  id: string;
  name: string;
  phase: string;
};

export function TiebreakManagementTab({
  allScores,
  allRounds,
}: {
  allScores: ScoreData[];
  allRounds: RoundData[];
}) {
  const [format, setFormat] = useState<TournamentFormat>(DEFAULT_TOURNAMENT_FORMAT);
  const [sealed, setSealed] = useState<Array<SealedTiebreak & { id: string }>>([]);

  useEffect(() => {
    const unsubscribeSettings = onSnapshot(
      doc(db, "settings", "competition"),
      (snapshot) => {
        const data = snapshot.exists() ? snapshot.data() : {};
        setFormat(normalizeTournamentFormat(data.tournamentFormat));
      },
      (error) => console.error("Error loading tournament format:", error),
    );

    const unsubscribeTiebreaks = onSnapshot(
      collection(db, "tiebreak"),
      (snapshot) => {
        setSealed(
          snapshot.docs
            .map((entry) => ({ id: entry.id, ...entry.data() } as SealedTiebreak & { id: string }))
            .filter((entry) => entry.sealed === true),
        );
      },
      (error) => console.error("Error loading tiebreaks:", error),
    );

    return () => {
      unsubscribeSettings();
      unsubscribeTiebreaks();
    };
  }, []);

  const sealedRoundNames = useMemo(
    () => new Set(sealed.map((entry) => entry.roundName)),
    [sealed],
  );

  const unresolved = useMemo(
    () => detectUnresolvedTiebreaks(allScores, allRounds, format, sealedRoundNames),
    [allScores, allRounds, format, sealedRoundNames],
  );

  return (
    <div className="space-y-6">
      {unresolved.length > 0 ? (
        unresolved.map((tie) => (
          <Card key={tie.roundName} className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-5 w-5" />
                Empate pendiente · {tie.roundName}
              </CardTitle>
              <CardDescription className="text-amber-700/80 dark:text-amber-400/80">
                {tie.teams.length} equipos están empatados con {tie.score} puntos y hay{" "}
                {tie.slotsAvailable} {tie.slotsAvailable === 1 ? "cupo" : "cupos"} disponible.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TieBreaker
                roundName={tie.roundName}
                teams={tie.teams}
                slotsAvailable={tie.slotsAvailable}
              />
            </CardContent>
          </Card>
        ))
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Sin empates pendientes</CardTitle>
            <CardDescription>
              Si aparece un empate que afecte el corte de clasificación, se mostrará aquí incluso después de recargar la página.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {sealed.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Desempates resueltos</CardTitle>
            <CardDescription>
              Estos registros quedaron sellados y conservan su hash de integridad.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {sealed
              .slice()
              .sort((a, b) => a.roundName.localeCompare(b.roundName, "es"))
              .map((entry) => (
                <div key={entry.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 font-semibold">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        {entry.roundName}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Clasifica: {entry.selectedTeams.join(", ")}
                      </p>
                    </div>
                    <Badge variant="outline" className="gap-1">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      SHA-256
                    </Badge>
                  </div>
                  <code className="mt-3 block break-all rounded bg-muted px-3 py-2 text-[11px]">
                    {entry.integrity.hash}
                  </code>
                </div>
              ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
