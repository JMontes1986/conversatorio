
"use client";

import { useState, useEffect, useRef } from "react";
import { TimerAudio, getSharedTimerAudio } from "@/lib/timer-audio";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Play, Pause, RotateCcw, Bell, BellRing, TimerIcon, Volume2 } from "lucide-react";
import { db } from "@/lib/supabase";
import { doc, onSnapshot, setDoc } from "@/lib/documents";
import { useToast } from "@/hooks/use-toast";

const DEBATE_STATE_DOC_ID = "current";

interface TimerState {
  duration: number;
  lastUpdated: number;
  isActive: boolean;
  endsAt?: number;
  alarmId?: string;
}

interface TimerProps {
  initialTime: number; // in seconds
  title: string;
  showControls?: boolean;
  size?: 'default' | 'small';
}

export function Timer({ initialTime, title, showControls = true, size = 'default' }: TimerProps) {
  const [timeRemaining, setTimeRemaining] = useState(initialTime);
  const [serverState, setServerState] = useState<TimerState | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [visualAlarm, setVisualAlarm] = useState(false);
  const audio = useRef<TimerAudio | null>(null);
  const completedRun = useRef<number | null>(null);
  const lastAlarmId = useRef<string | null>(null);
  const serverOffsetMs = useRef(0);
  const { toast } = useToast();

  useEffect(() => {
    const controller = getSharedTimerAudio();
    audio.current = controller;
    setAudioEnabled(controller.isEnabled());

    const unlock = () => {
      void controller.enable().then((enabled) => {
        setAudioEnabled(enabled);
      });
    };

    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    window.addEventListener("touchstart", unlock, { once: true });

    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
      audio.current = null;
    };
  }, []);
  
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const syncClock = async () => {
      const started = Date.now();
      try {
        const response = await fetch(`/api/time?t=${started}`, { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json() as { now?: number };
        const finished = Date.now();
        if (cancelled || typeof data.now !== "number") return;

        const midpoint = started + (finished - started) / 2;
        serverOffsetMs.current = data.now - midpoint;
      } catch {
        // Keep the last known offset. Timer still works if the time probe is unavailable.
      }
    };

    void syncClock();
    timer = setInterval(() => { void syncClock(); }, 15_000);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const docRef = doc(db, "debateState", DEBATE_STATE_DOC_ID);
    const unsubscribe = onSnapshot(docRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        if (data.timer) {
            const nextTimer = data.timer as TimerState;
            setServerState(nextTimer);

            if (nextTimer.alarmId && nextTimer.alarmId !== lastAlarmId.current) {
                lastAlarmId.current = nextTimer.alarmId;
                const rang = audio.current?.ring() ?? false;
                setVisualAlarm(true);
                if (rang) {
                  setTimeout(() => setVisualAlarm(false), 2500);
                }
            }
        }
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const tick = () => {
        if (serverState && serverState.isActive) {
            const now = Date.now() + serverOffsetMs.current;
            const targetEnd = serverState.endsAt
                ?? (serverState.lastUpdated + serverState.duration * 1000);
            const newTime = Math.max(0, Math.ceil((targetEnd - now) / 1000));
            setTimeRemaining(newTime);

            if (newTime <= 0 && completedRun.current !== serverState.lastUpdated) {
                completedRun.current = serverState.lastUpdated;

                if (showControls) {
                    const alarmId = `${serverState.lastUpdated}-${targetEnd}`;
                    lastAlarmId.current = alarmId;
                    const rang = audio.current?.ring() ?? false;
                    setVisualAlarm(true);
                    if (rang) {
                      setTimeout(() => setVisualAlarm(false), 2500);
                    }

                    void setDoc(doc(db, "debateState", DEBATE_STATE_DOC_ID), {
                        timer: {
                            isActive: false,
                            duration: 0,
                            lastUpdated: now,
                            endsAt: targetEnd,
                            alarmId,
                        },
                    }, { merge: true }).catch(error => console.error("Error stopping expired timer:", error));
                }
            }
        } else if (serverState) {
            completedRun.current = null;
            setTimeRemaining(serverState.duration);
        }
    };
    
    // Initial tick to sync immediately
    tick();

    const interval = setInterval(tick, 200);
    return () => clearInterval(interval);

  }, [serverState, showControls]);
  

  const playSound = async () => {
    const controller = audio.current;
    const enabled = Boolean(controller && await controller.enable());
    setAudioEnabled(enabled);

    if (controller && enabled && controller.ring()) {
        setVisualAlarm(false);
        return;
    }

    toast({
      title: "Audio no disponible",
      description: "El navegador bloqueó el sonido. Pulse “Activar sonido” y vuelva a probar.",
    });
  };

  const activateSound = async () => {
    const controller = audio.current;
    const enabled = Boolean(controller && await controller.enable());
    setAudioEnabled(enabled);

    if (enabled) {
      controller?.ring();
      setVisualAlarm(false);
      toast({
        title: "Sonido activado",
        description: "La campana sonará automáticamente cuando el temporizador llegue a cero.",
      });
    } else {
      toast({
        variant: "destructive",
        title: "No se pudo activar el sonido",
        description: "Revise que la pestaña y el dispositivo no estén silenciados.",
      });
    }
  };
  
  const toggleTimer = async () => {
     if (!showControls) return;

    // Start/resume synchronously from the button gesture; never from the tick.
    void audio.current?.enable();
    const newIsActive = !(serverState?.isActive);

    try {
        const docRef = doc(db, "debateState", DEBATE_STATE_DOC_ID);
        const now = Date.now() + serverOffsetMs.current;
        const duration = timeRemaining > 0 ? timeRemaining : initialTime;
        const nextTimerState: TimerState = {
            isActive: newIsActive,
            duration,
            lastUpdated: now,
            endsAt: newIsActive ? now + duration * 1000 : undefined,
            alarmId: undefined,
        };

        // El equipo de control cambia inmediatamente; Debate usa el mismo endsAt
        // cuando recibe el estado, por lo que ambos convergen al mismo segundo.
        setServerState(nextTimerState);
        setTimeRemaining(duration);
        completedRun.current = null;

        await setDoc(docRef, { 
            timer: {
                isActive: nextTimerState.isActive,
                duration: nextTimerState.duration,
                lastUpdated: nextTimerState.lastUpdated,
                endsAt: nextTimerState.endsAt ?? null,
                alarmId: null,
            } 
        }, { merge: true });
    } catch (error) {
        console.error("Error updating timer state in Supabase:", error);
    }
  };

  const resetTimer = async () => {
    if (showControls) {
        try {
            const docRef = doc(db, "debateState", DEBATE_STATE_DOC_ID);
            const now = Date.now() + serverOffsetMs.current;
            const nextTimerState: TimerState = {
                isActive: false,
                duration: initialTime,
                lastUpdated: now,
                endsAt: undefined,
                alarmId: undefined,
            };
            setServerState(nextTimerState);
            setTimeRemaining(initialTime);
            completedRun.current = null;

            await setDoc(docRef, { 
                timer: { 
                    isActive: false, 
                    duration: initialTime,
                    lastUpdated: now,
                    endsAt: null,
                    alarmId: null,
                } 
            }, { merge: true });
        } catch (error) {
            console.error("Error resetting timer state in Supabase:", error);
        }
    }
  };

  const formatTime = (seconds: number) => {
    const s = Math.max(0, seconds);
    const minutes = Math.floor(s / 60);
    const remainingSeconds = s % 60;
    return `${minutes.toString().padStart(2, "0")}:${remainingSeconds
      .toString()
      .padStart(2, "0")}`;
  };

  const progress = initialTime > 0 ? (timeRemaining / initialTime) * 100 : 0;
  const isActive = serverState?.isActive ?? false;

  if (size === 'small') {
      return (
          <Card className={visualAlarm ? "max-w-xs border-destructive ring-2 ring-destructive/50" : "max-w-xs"}>
              <CardContent className="p-2 flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <TimerIcon className="h-5 w-5" />
                        <span className="text-sm font-medium">{title}</span>
                    </div>
                    <span className="text-2xl font-bold font-mono tabular-nums text-foreground">
                        {formatTime(timeRemaining)}
                    </span>
                     {showControls && (
                        <div className="flex items-center gap-1">
                            <Button onClick={() => toggleTimer()} size="icon" className="h-8 w-8">
                                {isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                            </Button>
                            <Button onClick={resetTimer} variant="outline" size="icon" className="h-8 w-8">
                                <RotateCcw className="h-4 w-4" />
                            </Button>
                        </div>
                     )}
                     {showControls ? (
                       <Button onClick={playSound} aria-label="Probar alarma y activar sonido" variant="outline" size="icon" className="h-8 w-8">
                          <Bell className="h-4 w-4" />
                       </Button>
                     ) : (
                       <Button
                         onClick={activateSound}
                         variant={audioEnabled ? "outline" : "default"}
                         size="sm"
                         className="h-8 gap-1.5"
                       >
                         {audioEnabled ? <Volume2 className="h-4 w-4" /> : <BellRing className="h-4 w-4" />}
                         {audioEnabled ? "Sonido activo" : "Activar sonido"}
                       </Button>
                     )}
                     {visualAlarm && (
                       <div className="w-full animate-pulse rounded-md bg-destructive px-3 py-2 text-center text-sm font-bold text-destructive-foreground">
                         TIEMPO FINALIZADO
                       </div>
                     )}
              </CardContent>
          </Card>
      )
  }

  return (
    <Card className={visualAlarm ? "border-destructive ring-2 ring-destructive/50" : undefined}>
      <CardContent className="p-3 flex flex-col items-center justify-center space-y-2">
        {visualAlarm && (
          <div className="w-full animate-pulse rounded-md bg-destructive px-3 py-2 text-center text-sm font-bold text-destructive-foreground">
            TIEMPO FINALIZADO
          </div>
        )}
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        <div className="relative w-28 h-28 md:w-36 md:h-36">
          <svg className="w-full h-full" viewBox="0 0 100 100">
            <circle
              className="text-secondary"
              strokeWidth="7"
              stroke="currentColor"
              fill="transparent"
              r="45"
              cx="50"
              cy="50"
            />
            <circle
              className="text-primary transition-all duration-1000 ease-linear"
              strokeWidth="7"
              strokeDasharray="283"
              strokeDashoffset={283 - (progress / 100) * 283}
              strokeLinecap="round"
              stroke="currentColor"
              fill="transparent"
              r="45"
              cx="50"
              cy="50"
              style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%" }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
             <span className="text-2xl md:text-3xl font-bold font-mono tabular-nums">
                {formatTime(timeRemaining)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
            {showControls && (
                <>
                    <Button onClick={() => toggleTimer()} size="icon" className="w-12 h-12 rounded-full">
                        {isActive ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                    </Button>
                    <Button onClick={resetTimer} variant="outline" size="icon" className="w-10 h-10">
                        <RotateCcw className="h-4 w-4" />
                    </Button>
                </>
            )}
            <Button onClick={playSound} aria-label="Probar alarma y activar sonido" variant="outline" size="icon" className="w-10 h-10">
                <Bell className="h-4 w-4" />
            </Button>
        </div>
      </CardContent>
    </Card>
  );
}
