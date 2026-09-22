"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, orderBy, query } from "@/lib/documents";
import { db } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { Dices, ShieldAlert, ShieldCheck, Trophy } from "lucide-react";
import {
  phaseResultsArePublished,
  type SealedTiebreak,
  verifyTiebreakSeal,
} from "@/lib/tiebreak-integrity";

export function PublicTiebreakDisplay({ roundName }: { roundName?: string }) {
  const [records, setRecords] = useState<Array<SealedTiebreak & { id: string }>>([]);
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [integrity, setIntegrity] = useState<"checking" | "valid" | "invalid">("checking");

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "tiebreak"), orderBy("createdAt", "desc")),
      (snapshot) => {
        setRecords(snapshot.docs
          .map((entry) => ({ id: entry.id, ...entry.data() } as SealedTiebreak & { id: string }))
          .filter((entry) => entry.sealed === true));
      },
      (error) => {
        console.error("Error loading public tiebreak:", error);
        setRecords([]);
      },
    );
    const unsubscribeSettings = onSnapshot(
      doc(db, "settings", "competition"),
      (snapshot) => setSettings(snapshot.exists() ? snapshot.data() : {}),
      (error) => console.error("Error loading publication settings:", error),
    );
    return () => {
      unsubscribe();
      unsubscribeSettings();
    };
  }, []);

  const activeRecord = useMemo(() => {
    if (!roundName) return null;
    return records.find((record) => record.roundName === roundName) ?? null;
  }, [records, roundName]);

  useEffect(() => {
    let cancelled = false;
    if (!activeRecord) {
      setIntegrity("checking");
      return;
    }
    setIntegrity("checking");
    void verifyTiebreakSeal(activeRecord).then((valid) => {
      if (!cancelled) setIntegrity(valid ? "valid" : "invalid");
    });
    return () => {
      cancelled = true;
    };
  }, [activeRecord]);

  if (!activeRecord || !phaseResultsArePublished(activeRecord.phase, settings)) return null;

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/96 p-4 backdrop-blur-sm">
      <div className="w-full max-w-6xl space-y-6 rounded-2xl border bg-background p-6 shadow-2xl md:p-10">
        <div className="text-center">
          <div className="mb-3 flex items-center justify-center gap-2">
            <Dices className="h-8 w-8 text-primary" />
            <h2 className="font-headline text-3xl font-bold md:text-5xl">Desempate Público</h2>
          </div>
          <p className="text-lg text-muted-foreground">
            {activeRecord.roundName} · desempate por sorteo entre {activeRecord.teams.length} equipos
          </p>
        </div>

        {integrity === "invalid" ? (
          <div className="rounded-xl border border-destructive bg-destructive/10 p-6 text-center">
            <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-destructive" />
            <p className="font-bold text-destructive">La verificación de integridad falló.</p>
            <p className="text-sm text-muted-foreground">El resultado no se mostrará como válido.</p>
          </div>
        ) : (
          <>
            <div className="grid gap-4">
              {activeRecord.attempts.map((attempt) => (
                <div key={attempt.number} className="rounded-xl border p-4">
                  <p className="mb-4 text-center text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Lanzamiento {attempt.number}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {attempt.rolls.map((roll) => {
                      const selected = activeRecord.selectedTeams.includes(roll.team);
                      return (
                        <div
                          key={`${attempt.number}-${roll.team}`}
                          className={`rounded-xl border p-5 text-center ${selected ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30" : "bg-muted/30"}`}
                        >
                          <p className="text-lg font-bold">{roll.team}</p>
                          <p className="my-3 text-5xl font-black tabular-nums">{roll.value}</p>
                          {selected && <Badge>Clasifica</Badge>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-5 text-center dark:bg-emerald-950/20">
              <div className="mb-3 flex items-center justify-center gap-2">
                <Trophy className="h-6 w-6 text-amber-500" />
                <span className="text-xl font-bold">
                  {activeRecord.selectedTeams.length === 1 ? "Equipo clasificado" : "Equipos clasificados"}
                </span>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {activeRecord.selectedTeams.map((team) => (
                  <Badge key={team} className="px-4 py-2 text-base">{team}</Badge>
                ))}
              </div>
            </div>

            <div className="flex flex-col items-center gap-2 text-center">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                <ShieldCheck className="h-5 w-5" />
                <span className="font-semibold">
                  {integrity === "valid" ? "Integridad SHA-256 verificada" : "Verificando integridad SHA-256..."}
                </span>
              </div>
              <code className="max-w-full break-all rounded bg-muted px-3 py-2 text-[11px]">
                {activeRecord.integrity.hash}
              </code>
              <p className="text-xs text-muted-foreground">
                Este registro fue sellado al momento del sorteo y no puede editarse ni eliminarse desde la plataforma.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
