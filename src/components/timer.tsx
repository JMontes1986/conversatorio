
"use client";

import { useState, useEffect, useRef } from "react";
import * as Tone from "tone";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Play, Pause, RotateCcw, Bell, TimerIcon } from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, setDoc, getDoc } from "firebase/firestore";
import { cn } from "@/lib/utils";

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
  const synth = useRef<Tone.Synth | null>(null);

  useEffect(() => {
    synth.current = new Tone.Synth().toDestination();
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

            if (newTime <= 0) {
                 if (showControls) {
                    toggleTimer(false); // Stop the timer on server
                    playSound();
                 }
            }
        } else if (serverState) {
            setTimeRemaining(serverState.duration);
        }
    };
    
    // Initial tick to sync immediately
    tick();

    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);

  }, [serverState, showControls]);
  

  const playSound = async () => {
     if (Tone.context.state !== 'running') {
      await Tone.start();
    }
    if (synth.current) {
        synth.current.triggerAttackRelease("C5", "8n", Tone.now());
        synth.current.triggerAttackRelease("G5", "8n", Tone.now() + 0.2);
    }
  };
  
  const toggleTimer = async (forceState?: boolean) => {
     if (!showControls) return;

     if (Tone.context.state !== 'running') {
      await Tone.start();
    }
    const newIsActive = forceState !== undefined ? forceState : !(serverState?.isActive);

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
        console.error("Error updating timer state in Firestore:", error);
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
            console.error("Error resetting timer state in Firestore:", error);
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
                     <Button onClick={playSound} variant="outline" size="icon" className="h-8 w-8">
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
            <Button onClick={playSound} variant="outline" size="icon" className="w-10 h-10">
                <Bell className="h-4 w-4" />
            </Button>
        </div>
      </CardContent>
    </Card>
  );
}
