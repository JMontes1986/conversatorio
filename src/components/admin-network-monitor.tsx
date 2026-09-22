"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  CloudOff,
  Gauge,
  Loader2,
  Signal,
  SignalHigh,
  SignalLow,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getNetworkProfile, subscribeToNetworkProfile, type NetworkProfile } from "@/lib/network-profile";

type ProbeSample = {
  at: number;
  latencyMs: number | null;
  ok: boolean;
};

function formatMbps(value: number | null) {
  if (value === null) return "No disponible";
  return `${value.toFixed(value < 10 ? 1 : 0)} Mbps`;
}

function formatLatency(value: number | null) {
  if (value === null) return "Sin dato";
  return `${Math.round(value)} ms`;
}

function qualityLabel(profile: NetworkProfile, recentLatency: number | null, online: boolean) {
  if (!online) return { label: "Sin conexión", tone: "destructive" as const };
  const latency = recentLatency ?? profile.rttMs;

  if (
    profile.lowBandwidth
    || profile.highLatency
    || (latency !== null && latency >= 500)
  ) {
    return { label: "Conexión crítica", tone: "destructive" as const };
  }

  if (
    (profile.downlinkMbps !== null && profile.downlinkMbps <= 10)
    || (latency !== null && latency >= 250)
  ) {
    return { label: "Conexión limitada", tone: "secondary" as const };
  }

  return { label: "Conexión estable", tone: "default" as const };
}

export function AdminNetworkMonitor() {
  const [online, setOnline] = useState(true);
  const [profile, setProfile] = useState<NetworkProfile>(() => getNetworkProfile());
  const [samples, setSamples] = useState<ProbeSample[]>([]);
  const [probing, setProbing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setOnline(navigator.onLine);
    const unsubscribe = subscribeToNetworkProfile((next) => {
      setProfile(next);
      setOnline(navigator.onLine);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const runProbe = async () => {
      if (cancelled || document.hidden) {
        schedule();
        return;
      }

      if (!navigator.onLine) {
        setOnline(false);
        setSamples((current) => [
          ...current.slice(-23),
          { at: Date.now(), latencyMs: null, ok: false },
        ]);
        schedule();
        return;
      }

      setProbing(true);
      const started = performance.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      try {
        const response = await fetch(`/api/network/ping?t=${Date.now()}`, {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });
        const latencyMs = performance.now() - started;
        const ok = response.ok || response.status === 204;
        if (!cancelled) {
          setOnline(true);
          setSamples((current) => [
            ...current.slice(-23),
            { at: Date.now(), latencyMs, ok },
          ]);
        }
      } catch {
        if (!cancelled) {
          setSamples((current) => [
            ...current.slice(-23),
            { at: Date.now(), latencyMs: null, ok: false },
          ]);
        }
      } finally {
        clearTimeout(timeout);
        if (!cancelled) setProbing(false);
        schedule();
      }
    };

    const schedule = () => {
      if (cancelled) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      const delay = profile.lowBandwidth ? 15_000 : 8_000;
      timerRef.current = setTimeout(() => { void runProbe(); }, delay);
    };

    void runProbe();

    const onVisibility = () => {
      if (!document.hidden) {
        if (timerRef.current) clearTimeout(timerRef.current);
        void runProbe();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [profile.lowBandwidth]);

  const recent = samples.filter((sample) => sample.ok && sample.latencyMs !== null);
  const latestLatency = [...samples].reverse().find((sample) => sample.ok)?.latencyMs ?? null;
  const averageLatency = recent.length
    ? recent.reduce((sum, sample) => sum + (sample.latencyMs || 0), 0) / recent.length
    : null;
  const successRate = samples.length
    ? (samples.filter((sample) => sample.ok).length / samples.length) * 100
    : null;

  const recentWindow = samples.slice(-12);
  const drops = recentWindow.filter((sample) => !sample.ok).length;
  const variability = useMemo(() => {
    const values = recentWindow
      .filter((sample) => sample.ok && sample.latencyMs !== null)
      .map((sample) => sample.latencyMs as number);
    if (values.length < 2) return null;
    return Math.max(...values) - Math.min(...values);
  }, [samples]);

  const quality = qualityLabel(profile, latestLatency, online);

  return (
    <Card className="mt-8 border-dashed">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Monitor de Red del Administrador
            </CardTitle>
            <CardDescription className="mt-1">
              Mide la conexión de este equipo. No representa automáticamente la conexión de los jurados ni otros dispositivos.
            </CardDescription>
          </div>
          <Badge variant={quality.tone} className="gap-1.5">
            {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            {quality.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border p-4">
            <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
              <Gauge className="h-4 w-4" />
              Ancho de banda estimado
            </div>
            <p className="text-2xl font-bold tabular-nums">{formatMbps(profile.downlinkMbps)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Estimación del navegador; puede no estar disponible en Safari.
            </p>
          </div>

          <div className="rounded-lg border p-4">
            <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
              <Signal className="h-4 w-4" />
              Latencia real a la app
            </div>
            <p className="text-2xl font-bold tabular-nums">{formatLatency(latestLatency)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Promedio: {formatLatency(averageLatency)}
            </p>
          </div>

          <div className="rounded-lg border p-4">
            <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
              <SignalHigh className="h-4 w-4" />
              Disponibilidad reciente
            </div>
            <p className="text-2xl font-bold tabular-nums">
              {successRate === null ? "Sin datos" : `${successRate.toFixed(0)}%`}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Microcortes detectados: {drops}
            </p>
          </div>

          <div className="rounded-lg border p-4">
            <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
              <SignalLow className="h-4 w-4" />
              Variación de latencia
            </div>
            <p className="text-2xl font-bold tabular-nums">{formatLatency(variability)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {profile.lowBandwidth ? "Modo ahorro activo" : "Modo normal"}
            </p>
          </div>
        </div>

        <div className="rounded-lg border bg-muted/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              <span className="font-semibold">Perfil detectado:</span>{" "}
              {profile.effectiveType ? profile.effectiveType.toUpperCase() : "No informado"}
              {profile.rttMs !== null && <> · RTT navegador {Math.round(profile.rttMs)} ms</>}
              {profile.saveData && <> · Ahorro de datos activado</>}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {probing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Prueba ligera contra Vercel cada {profile.lowBandwidth ? "15" : "8"} s
            </div>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Historial reciente de latencia
          </p>
          <div className="flex h-14 items-end gap-1 overflow-hidden rounded-md border bg-muted/10 px-2 py-2">
            {samples.length === 0 ? (
              <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                Tomando primeras mediciones...
              </div>
            ) : samples.map((sample, index) => {
              const height = sample.ok && sample.latencyMs !== null
                ? Math.max(8, Math.min(100, (sample.latencyMs / 1000) * 100))
                : 100;
              return (
                <div
                  key={`${sample.at}-${index}`}
                  title={sample.ok ? `${Math.round(sample.latencyMs || 0)} ms` : "Fallo de conexión"}
                  className={sample.ok
                    ? "min-w-1 flex-1 rounded-t bg-primary/70"
                    : "min-w-1 flex-1 rounded-t bg-destructive"}
                  style={{ height: `${height}%` }}
                />
              );
            })}
          </div>
        </div>

        {!online && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            <CloudOff className="h-4 w-4 shrink-0" />
            Este equipo está sin conexión. La aplicación seguirá mostrando los datos ya cargados y reintentará al regresar la red.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
