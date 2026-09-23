"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, ShieldCheck, Shuffle, Users } from "lucide-react";
import { doc, onSnapshot } from "@/lib/documents";
import { db } from "@/lib/supabase";
import {
  type DrawIntegrity,
  type DrawMatchup,
  normalizeDrawMatchups,
  verifyGroupDraw,
} from "@/lib/draw-integrity";

type DrawState = {
  phases?: Array<{
    name: string;
    matchups: DrawMatchup[];
  }>;
  integrity?: DrawIntegrity | null;
  status?: "waiting" | "drawing" | "finished";
};

type DebatePublicDraw = {
  active?: boolean;
  publishedAt?: string;
};

export function PublicDrawDisplay() {
  const [active, setActive] = useState(false);
  const [drawState, setDrawState] = useState<DrawState | null>(null);
  const [integrityStatus, setIntegrityStatus] = useState<"checking" | "valid" | "invalid" | "none">("none");

  useEffect(() => {
    const unsubscribeDebate = onSnapshot(
      doc(db, "debateState", "current"),
      (snapshot) => {
        const data = snapshot.exists() ? snapshot.data() : {};
        const publicDraw = (data.publicDraw || null) as DebatePublicDraw | null;
        setActive(publicDraw?.active === true);
      },
      (error) => {
        console.error("Error loading public draw state:", error);
        setActive(false);
      },
    );

    const unsubscribeDraw = onSnapshot(
      doc(db, "drawState", "liveDraw"),
      (snapshot) => {
        setDrawState(snapshot.exists() ? (snapshot.data() as DrawState) : null);
      },
      (error) => {
        console.error("Error loading draw result:", error);
        setDrawState(null);
      },
    );

    return () => {
      unsubscribeDebate();
      unsubscribeDraw();
    };
  }, []);

  const groupMatchups = useMemo(() => {
    const phase = drawState?.phases?.find((item) => item.name === "Fase de Grupos");
    return normalizeDrawMatchups(phase?.matchups || []);
  }, [drawState]);

  useEffect(() => {
    let cancelled = false;

    if (!active || groupMatchups.length === 0 || !drawState?.integrity) {
      setIntegrityStatus(drawState?.integrity ? "checking" : "none");
      return;
    }

    setIntegrityStatus("checking");
    void verifyGroupDraw(groupMatchups, drawState.integrity).then((valid) => {
      if (!cancelled) setIntegrityStatus(valid ? "valid" : "invalid");
    });

    return () => {
      cancelled = true;
    };
  }, [active, groupMatchups, drawState?.integrity]);

  if (!active) return null;

  return (
    <div className="absolute inset-0 z-[25] flex items-center justify-center overflow-auto bg-background/95 p-4 backdrop-blur-sm">
      <div className="my-auto w-full max-w-6xl space-y-6 rounded-2xl border bg-background p-6 shadow-2xl md:p-10">
        <div className="text-center">
          <div className="mb-3 flex items-center justify-center gap-3">
            <Shuffle className="h-8 w-8 text-primary" />
            <h2 className="font-headline text-3xl font-bold md:text-5xl">Sorteo Público</h2>
          </div>
          <p className="text-lg text-muted-foreground">
            {drawState?.status === "waiting"
              ? "Pantalla lista. El sorteo comenzará en breve."
              : drawState?.status === "drawing"
                ? "Sorteo en vivo · los equipos aparecerán progresivamente"
                : "Distribución oficial de equipos para la fase de grupos"}
          </p>
        </div>

        {groupMatchups.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {groupMatchups.map((matchup) => (
              <div key={matchup.roundName} className="overflow-hidden rounded-xl border bg-card shadow-sm">
                <div className="bg-primary px-4 py-3 text-primary-foreground">
                  <p className="text-xs font-semibold uppercase tracking-widest">Ronda</p>
                  <p className="text-xl font-bold">{matchup.roundName}</p>
                </div>
                <div className="divide-y">
                  {matchup.teams.map((team, index) => (
                    <div key={`${matchup.roundName}-${team}`} className="flex items-center gap-3 px-4 py-4">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold">
                        {index + 1}
                      </div>
                      <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="text-lg font-semibold">{team}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed p-8 text-center">
            <Shuffle className="mx-auto mb-3 h-10 w-10 animate-pulse text-primary" />
            <p className="text-xl font-semibold">
              {drawState?.status === "drawing" ? "Sorteando equipos..." : "Sorteo listo para iniciar"}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {drawState?.status === "drawing"
                ? "Mantenga esta pantalla visible: las rondas aparecerán automáticamente."
                : "Cuando el administrador pulse “Iniciar Sorteo”, los resultados se mostrarán aquí en tiempo real."}
            </p>
          </div>
        )}

        {drawState?.status === "finished" && drawState?.integrity && (
          <div className={
            integrityStatus === "invalid"
              ? "rounded-xl border border-destructive bg-destructive/10 p-5"
              : "rounded-xl border border-emerald-300 bg-emerald-50 p-5 dark:bg-emerald-950/20"
          }>
            <div className="flex flex-col items-center gap-2 text-center">
              <div className={
                integrityStatus === "invalid"
                  ? "flex items-center gap-2 font-semibold text-destructive"
                  : "flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-400"
              }>
                {integrityStatus === "invalid"
                  ? <ShieldAlert className="h-5 w-5" />
                  : <ShieldCheck className="h-5 w-5" />}
                <span>
                  {integrityStatus === "checking"
                    ? "Verificando integridad SHA-256..."
                    : integrityStatus === "valid"
                      ? "Sorteo SHA-256 verificado"
                      : "La verificación de integridad falló"}
                </span>
              </div>
              <code className="max-w-full break-all rounded bg-background/70 px-3 py-2 text-[11px]">
                {drawState.integrity.hash}
              </code>
              <Badge variant="outline">{drawState.integrity.algorithm}</Badge>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
