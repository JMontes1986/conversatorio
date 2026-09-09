
"use client";

import { useState, useEffect, useRef } from "react";
import { TimerAudio } from "@/lib/timer-audio";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Play, Pause, RotateCcw, Bell, TimerIcon } from "lucide-react";
import { db } from "@/lib/supabase";
import { doc, onSnapshot, setDoc } from "@/lib/documents";
import { useToast } from "@/hooks/use-toast";

const DEBATE_STATE_DOC_ID = "current";

interface TimerState {
  duration: number;
  lastUpdated: number;
  isActive: boolean;
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
  const audio = useRef<TimerAudio | null>(null);
  const completedRun = useRef<number | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const controller = new TimerAudio();
    audio.current = controller;
    return () => { controller.dispose(); audio.current = null; };
  }, []);
  
  useEffect(() => {
    const docRef = doc(db, "debateState", DEBATE_STATE_DOC_ID);
    const unsubscribe = onSnapshot(docRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        if (data.timer) {
            setServerState(data.timer as TimerState);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const tick = () => {
        if (serverState && serverState.isActive) {
            const elapsed = Math.floor((Date.now() - serverState.lastUpdated) / 1000);
            const newTime = Math.max(0, serverState.duration - elapsed);
            setTimeRemaining(newTime);

            if (newTime <= 0 && showControls && completedRun.current !== serverState.lastUpdated) {
                completedRun.current = serverState.lastUpdated;
                audio.current?.ring();
                void setDoc(doc(db, "debateState", DEBATE_STATE_DOC_ID), {
                    timer: { isActive: false, duration: 0, lastUpdated: Date.now() },
                }, { merge: true }).catch(error => console.error("Error stopping expired timer:", error));
            }
        } else if (serverState) {
            completedRun.current = null;
            setTimeRemaining(serverState.duration);
        }
    };
    
    // Initial tick to sync immediately
    tick();

    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);

  }, [serverState, showControls]);
  

  const playSound = async () => {
    const controller = audio.current;
    if (controller && await controller.enable()) {
        controller.ring();
    } else {
        toast({ title: "Audio no disponible", description: "No se pudo activar el sonido. El temporizador seguirá funcionando." });
    }
  };
  
  const toggleTimer = async () => {
     if (!showControls) return;

    // Start/resume synchronously from the button gesture; never from the tick.
    void audio.current?.enable();
    const newIsActive = !(serverState?.isActive);

    try {
        const docRef = doc(db, "debateState", DEBATE_STATE_DOC_ID);
        await setDoc(docRef, { 
            timer: { 
                isActive: newIsActive,
                duration: timeRemaining > 0 ? timeRemaining : initialTime,
                lastUpdated: Date.now()
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
            await setDoc(docRef, { 
                timer: { 
                    isActive: false, 
                    duration: initialTime,
                    lastUpdated: Date.now()
                } 
            }, { merge: true });
            setTimeRemaining(initialTime);
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
          <Card className="max-w-xs">
              <CardContent className="p-2 flex items-center gap-3">
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
                     <Button onClick={playSound} aria-label="Probar alarma y activar sonido" variant="outline" size="icon" className="h-8 w-8">
                        <Bell className="h-4 w-4" />
                    </Button>
              </CardContent>
          </Card>
      )
  }

  return (
    <Card>
      <CardContent className="p-3 flex flex-col items-center justify-center space-y-2">
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
