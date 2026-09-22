"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Dices, Loader2, ShieldCheck, Trophy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getSupabase } from "@/lib/supabase";
import type { SealedTiebreak } from "@/lib/tiebreak-integrity";

interface TieBreakerProps {
  roundName: string;
  teams: string[];
  slotsAvailable: number;
}

export function TieBreaker({ roundName, teams, slotsAvailable }: TieBreakerProps) {
  const { toast } = useToast();
  const [isResolving, setIsResolving] = useState(false);
  const [record, setRecord] = useState<SealedTiebreak | null>(null);

  const resolveTie = async () => {
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
        title: result.alreadySealed ? "Desempate ya sellado" : "Desempate sellado",
        description: "El resultado quedó protegido con SHA-256 y no puede modificarse desde la plataforma.",
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
        <Button onClick={resolveTie} disabled={isResolving}>
          {isResolving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Dices className="mr-2 h-4 w-4" />}
          {isResolving ? "Generando sorteo seguro..." : "Realizar desempate público"}
        </Button>
      ) : (
        <div className="space-y-4 rounded-lg border border-emerald-300 bg-emerald-50 p-4 dark:bg-emerald-950/20">
          <div className="flex flex-wrap items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            <span className="font-semibold">Resultado sellado</span>
            <Badge variant="outline">SHA-256</Badge>
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
          <p className="text-xs text-muted-foreground">
            Se hará visible en la pantalla pública del debate cuando los resultados de esta fase sean publicados desde Ajustes Generales.
          </p>
        </div>
      )}
    </div>
  );
}
