"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "@/lib/documents";
import { db } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { Dices, ShieldAlert, ShieldCheck, Trophy } from "lucide-react";
import {
  type SealedTiebreak,
  verifyTiebreakSeal,
} from "@/lib/tiebreak-integrity";

type PublicTiebreakState = {
  active?: boolean;
  status?: "ready" | "resolved";
  roundName?: string;
  teams?: string[];
  slotsAvailable?: number;
  selectedTeams?: string[];
  integrityHash?: string;
  sealedRecord?: SealedTiebreak;
};

export function PublicTiebreakDisplay({ roundName }: { roundName?: string }) {
  const [publicState, setPublicState] = useState<PublicTiebreakState | null>(null);
  const [integrity, setIntegrity] = useState<"checking" | "valid" | "invalid">("checking");

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, "debateState", "current"),
      (snapshot) => {
        const data = snapshot.exists() ? snapshot.data() : {};
        setPublicState((data.publicTiebreak || null) as PublicTiebreakState | null);
      },
      (error) => {
        console.error("Error loading public tiebreak state:", error);
        setPublicState(null);
      },
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const record = publicState?.sealedRecord;
    if (!record || publicState?.status !== "resolved") {
      setIntegrity("checking");
      return;
    }

    setIntegrity("checking");
    void verifyTiebreakSeal(record).then((valid) => {
      if (!cancelled) setIntegrity(valid ? "valid" : "invalid");
    });

    return () => {
      cancelled = true;
    };
  }, [publicState]);

  if (!publicState?.active) return null;
  if (roundName && publicState.roundName && publicState.roundName !== roundName) return null;

  const isReady = publicState.status === "ready";
  const record = publicState.sealedRecord;

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/96 p-4 backdrop-blur-sm">
      <div className="w-full max-w-6xl space-y-6 rounded-2xl border bg-background p-6 shadow-2xl md:p-10">
        <div className="text-center">
          <div className="mb-3 flex items-center justify-center gap-2">
            <Dices className="h-8 w-8 text-primary" />
            <h2 className="font-headline text-3xl font-bold md:text-5xl">Desempate Público</h2>
          </div>
          <p className="text-lg text-muted-foreground">
            {publicState.roundName} · {publicState.teams?.length || 0} equipos empatados
          </p>
        </div>

        {isReady ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(publicState.teams || []).map((team) => (
                <div key={team} className="rounded-xl border bg-muted/20 p-6 text-center">
                  <p className="text-xl font-bold">{team}</p>
                  <p className="mt-2 text-sm text-muted-foreground">Equipo en desempate</p>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-dashed p-5 text-center">
              <p className="text-lg font-semibold">El desempate está listo para realizarse</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Se disputan <strong>{publicState.slotsAvailable || 0}</strong>{" "}
                {(publicState.slotsAvailable || 0) === 1 ? "cupo" : "cupos"}.
                El sorteo se ejecutará con aleatoriedad criptográfica y el resultado será sellado con SHA-256.
              </p>
            </div>
          </>
        ) : integrity === "invalid" ? (
          <div className="rounded-xl border border-destructive bg-destructive/10 p-6 text-center">
            <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-destructive" />
            <p className="font-bold text-destructive">La verificación de integridad falló.</p>
            <p className="text-sm text-muted-foreground">
              El resultado no se mostrará como válido.
            </p>
          </div>
        ) : record ? (
          <>
            <div className="grid gap-4">
              {record.attempts.map((attempt) => (
                <div key={attempt.number} className="rounded-xl border p-4">
                  <p className="mb-4 text-center text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Lanzamiento {attempt.number}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {attempt.rolls.map((roll) => {
                      const selected = record.selectedTeams.includes(roll.team);
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
                  {record.selectedTeams.length === 1 ? "Equipo clasificado" : "Equipos clasificados"}
                </span>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {record.selectedTeams.map((team) => (
                  <Badge key={team} className="px-4 py-2 text-base">{team}</Badge>
                ))}
              </div>
            </div>

            <div className="flex flex-col items-center gap-2 text-center">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                <ShieldCheck className="h-5 w-5" />
                <span className="font-semibold">
                  {integrity === "valid"
                    ? "Integridad SHA-256 verificada"
                    : "Verificando integridad SHA-256..."}
                </span>
              </div>
              <code className="max-w-full break-all rounded bg-muted px-3 py-2 text-[11px]">
                {record.integrity.hash}
              </code>
              <p className="text-xs text-muted-foreground">
                El resultado fue sellado al momento del sorteo para garantizar transparencia.
              </p>
            </div>
          </>
        ) : (
          <div className="rounded-xl border p-6 text-center text-muted-foreground">
            Esperando el resultado del desempate...
          </div>
        )}
      </div>
    </div>
  );
}
