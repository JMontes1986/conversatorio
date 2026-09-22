"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Dices, Eye, EyeOff, Loader2, MonitorUp, ShieldCheck, Trophy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { db, getSupabase } from "@/lib/supabase";
import { doc, onSnapshot, setDoc } from "@/lib/documents";
import type { SealedTiebreak } from "@/lib/tiebreak-integrity";

interface TieBreakerProps {
  roundName: string;
  teams: string[];
  slotsAvailable: number;
}

type PublicTiebreakState = {
  active?: boolean;
  status?: "ready" | "resolved";
  roundName?: string;
  teams?: string[];
  slotsAvailable?: number;
  integrityHash?: string;
};

export function TieBreaker({ roundName, teams, slotsAvailable }: TieBreakerProps) {
  const { toast } = useToast();
  const [isResolving, setIsResolving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [record, setRecord] = useState<SealedTiebreak | null>(null);
  const [publicState, setPublicState] = useState<PublicTiebreakState | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, "debateState", "current"),
      (snapshot) => {
        const data = snapshot.exists() ? snapshot.data() : {};
        setPublicState((data.publicTiebreak || null) as PublicTiebreakState | null);
      },
      (error) => console.error("Error loading public tiebreak state:", error),
    );
    return unsubscribe;
  }, []);

  const isThisTieOnDebate = Boolean(
    publicState?.active
      && publicState.roundName === roundName
      && publicState.status === "ready",
  );

  const isResolvedOnDebate = Boolean(
    publicState?.active
      && publicState.roundName === roundName
      && publicState.status === "resolved",
  );

  const normalizedTeams = useMemo(
    () => teams.map((team) => team.trim()).filter(Boolean).sort((a, b) => a.localeCompare(b, "es")),
    [teams],
  );

  const sendToDebate = async () => {
    setIsSending(true);
    try {
      await setDoc(
        doc(db, "debateState", "current"),
        {
          publicTiebreak: {
            active: true,
            status: "ready",
            roundName,
            teams: normalizedTeams,
            slotsAvailable,
            sentAt: Date.now(),
          },
        },
        { merge: true },
      );
      toast({
        title: "Desempate enviado a Debate",
        description: "La pantalla pública ya muestra los equipos empatados. Ahora puede realizar el desempate.",
      });
    } catch (error) {
      console.error("Error sending tiebreak to debate:", error);
      toast({
        variant: "destructive",
        title: "No se pudo enviar a Debate",
        description: "Revise la conexión e inténtelo nuevamente.",
      });
    } finally {
      setIsSending(false);
    }
  };

  const hideFromDebate = async () => {
    setIsSending(true);
    try {
      await setDoc(
        doc(db, "debateState", "current"),
        {
          publicTiebreak: {
            ...(publicState || {}),
            active: false,
          },
        },
        { merge: true },
      );
      toast({
        title: "Desempate retirado de pantalla",
        description: "La pantalla pública volvió al contenido normal del conversatorio.",
      });
    } catch (error) {
      console.error("Error hiding tiebreak from debate:", error);
      toast({
        variant: "destructive",
        title: "No se pudo retirar de Debate",
        description: "Inténtelo nuevamente.",
      });
    } finally {
      setIsSending(false);
    }
  };

  const resolveTie = async () => {
    if (!isThisTieOnDebate) {
      toast({
        variant: "destructive",
        title: "Primero envíelo a Debate",
        description: "Por transparencia, el público debe ver el desempate antes de ejecutar el sorteo.",
      });
      return;
    }

    setIsResolving(true);
    try {
      const { data: { session } } = await getSupabase().auth.getSession();
      if (!session) throw new Error("Debe iniciar sesión como administrador o moderador.");

      const response = await fetch("/api/tiebreak/resolve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ roundName }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo resolver el empate.");

      setRecord(result.record as SealedTiebreak);
      toast({
        title: result.alreadySealed ? "Desempate ya sellado" : "Desempate realizado y sellado",
        description: "El resultado ya es visible en Debate y quedó protegido con SHA-256.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "No se pudo realizar el desempate",
        description: error instanceof Error ? error.message : "Inténtelo nuevamente.",
      });
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {teams.map((team) => (
          <div key={team} className="rounded-lg border bg-background p-4 text-center">
            <p className="font-semibold">{team}</p>
            <p className="mt-1 text-xs text-muted-foreground">Equipo empatado</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        Se sortearán <strong>{slotsAvailable}</strong> {slotsAvailable === 1 ? "cupo" : "cupos"} entre{" "}
        <strong>{teams.length}</strong> equipos. El cálculo se realiza en el servidor con aleatoriedad criptográfica.
      </div>

      {!record ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3">
            {!isThisTieOnDebate ? (
              <Button type="button" variant="outline" onClick={sendToDebate} disabled={isSending}>
                {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MonitorUp className="mr-2 h-4 w-4" />}
                Enviar a Debate
              </Button>
            ) : (
              <Badge variant="secondary" className="gap-2 px-3 py-2 text-sm">
                <Eye className="h-4 w-4" />
                Visible en la pantalla de Debate
              </Badge>
            )}

            <Button type="button" onClick={resolveTie} disabled={isResolving || !isThisTieOnDebate}>
              {isResolving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Dices className="mr-2 h-4 w-4" />}
              {isResolving ? "Generando sorteo seguro..." : "Realizar Desempate"}
            </Button>
          </div>

          {!isThisTieOnDebate && (
            <p className="text-xs text-muted-foreground">
              El botón de desempate se habilita cuando los equipos empatados ya estén visibles para el público.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4 rounded-lg border border-emerald-300 bg-emerald-50 p-4 dark:bg-emerald-950/20">
          <div className="flex flex-wrap items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            <span className="font-semibold">Resultado sellado</span>
            <Badge variant="outline">SHA-256</Badge>
            {isResolvedOnDebate && (
              <Badge variant="secondary" className="gap-1">
                <Eye className="h-3.5 w-3.5" />
                Visible en Debate
              </Badge>
            )}
          </div>

          {record.attempts.map((attempt) => (
            <div key={attempt.number}>
              <p className="mb-2 text-sm font-medium">Lanzamiento {attempt.number}</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {attempt.rolls.map((roll) => (
                  <div key={`${attempt.number}-${roll.team}`} className="rounded-md bg-background p-3 text-center">
                    <div className="text-sm font-medium">{roll.team}</div>
                    <div className="text-3xl font-bold">{roll.value}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="flex flex-wrap items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            <span className="font-semibold">Clasifica:</span>
            {record.selectedTeams.map((team) => <Badge key={team}>{team}</Badge>)}
          </div>

          <div className="break-all rounded bg-background/80 p-3 font-mono text-[11px]">
            Hash: {record.integrity.hash}
          </div>

          {isResolvedOnDebate && (
            <Button type="button" variant="outline" onClick={hideFromDebate} disabled={isSending}>
              {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <EyeOff className="mr-2 h-4 w-4" />}
              Quitar de la pantalla de Debate
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
