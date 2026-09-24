"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Clock3, Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

const STORAGE_KEY = "conversatorio:admin-round-stopwatch";
const ROUND_TARGET_SECONDS = 15 * 60;

type StoredStopwatch = {
  running: boolean;
  startedAt: number | null;
  accumulatedMs: number;
};

function formatElapsed(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function RoundDurationStopwatch() {
  const [running, setRunning] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [accumulatedMs, setAccumulatedMs] = useState(0);
  const [now, setNow] = useState(Date.now());
  const hydrated = useRef(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as StoredStopwatch;
        setRunning(Boolean(parsed.running));
        setStartedAt(typeof parsed.startedAt === "number" ? parsed.startedAt : null);
        setAccumulatedMs(typeof parsed.accumulatedMs === "number" ? parsed.accumulatedMs : 0);
      }
    } catch (error) {
      console.error("Error restoring round stopwatch:", error);
    } finally {
      hydrated.current = true;
      setNow(Date.now());
    }
  }, []);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [running]);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ running, startedAt, accumulatedMs } satisfies StoredStopwatch),
      );
    } catch (error) {
      console.error("Error saving round stopwatch:", error);
    }
  }, [running, startedAt, accumulatedMs]);

  const elapsedMs = accumulatedMs + (running && startedAt ? Math.max(0, now - startedAt) : 0);
  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  const differenceFromReference = elapsedSeconds - ROUND_TARGET_SECONDS;
  const progress = Math.min(100, (elapsedSeconds / ROUND_TARGET_SECONDS) * 100);

  const status = useMemo(() => {
    if (differenceFromReference < 0) {
      return {
        label: `Referencia 15:00 · faltan ${formatElapsed(Math.abs(differenceFromReference))}`,
        className: "text-muted-foreground",
      };
    }
    if (differenceFromReference === 0) {
      return {
        label: "Referencia de 15:00 alcanzada",
        className: "text-amber-600",
      };
    }
    return {
      label: `Referencia superada por ${formatElapsed(differenceFromReference)}`,
      className: "text-muted-foreground",
    };
  }, [differenceFromReference]);

  const start = () => {
    if (running) return;
    const current = Date.now();
    setNow(current);
    setStartedAt(current);
    setRunning(true);
  };

  const pause = () => {
    if (!running) return;
    const current = Date.now();
    setAccumulatedMs(value => value + (startedAt ? Math.max(0, current - startedAt) : 0));
    setStartedAt(null);
    setNow(current);
    setRunning(false);
  };

  const reset = () => {
    setRunning(false);
    setStartedAt(null);
    setAccumulatedMs(0);
    setNow(Date.now());
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {}
  };

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Clock3 className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Cronómetro de Duración de Ronda</h3>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Control interno del administrador. La marca de 15:00 es solo una referencia; el cronómetro continúa sin límite.
          </p>
        </div>

        <div className="font-mono text-4xl font-bold tabular-nums">
          {formatElapsed(elapsedSeconds)}
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <Progress value={progress} />
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className={status.className}>{status.label}</span>
          <span className="text-muted-foreground">
            {running ? "Ronda en curso" : elapsedSeconds > 0 ? "Cronómetro pausado" : "Listo para iniciar"}
          </span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Button type="button" onClick={start} disabled={running}>
          <Play className="mr-2 h-4 w-4" />
          Iniciar
        </Button>
        <Button type="button" variant="outline" onClick={pause} disabled={!running}>
          <Pause className="mr-2 h-4 w-4" />
          Pausar
        </Button>
        <Button type="button" variant="outline" onClick={reset}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Reiniciar
        </Button>
      </div>

      {elapsedSeconds >= ROUND_TARGET_SECONDS && (
        <div className="mt-4 rounded-lg border bg-muted/40 p-3 text-center text-sm text-muted-foreground">
          La referencia de 15 minutos ya fue alcanzada. El cronómetro continúa contando normalmente.
        </div>
      )}
    </div>
  );
}
