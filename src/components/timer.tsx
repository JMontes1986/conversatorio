
"use client";

import { useState, useEffect, useRef } from "react";
import * as Tone from "tone";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Play, Pause, RotateCcw, Bell, TimerIcon } from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { cn } from "@/lib/utils";

const DEBATE_STATE_DOC_ID = "current";

interface TimerProps {
  initialTime: number; // in seconds
  title: string;
  showControls?: boolean;
  size?: 'default' | 'small';
}

export function Timer({ initialTime, title, showControls = true, size = 'default' }: TimerProps) {
  const [timeRemaining, setTimeRemaining] = useState(initialTime);
  const [isActive, setIsActive] = useState(false);
  const synth = useRef<Tone.Synth | null>(null);

  useEffect(() => {
    // Initialize Tone.js Synth on client
    synth.current = new Tone.Synth().toDestination();
  }, []);

  useEffect(() => {
    setTimeRemaining(initialTime);
    // Resetting active state should be handled by Firestore to ensure sync
    setIsActive(false);
  }, [initialTime]);
  
  useEffect(() => {
    // Both public and moderator views listen to Firestore for the timer's active state
    const docRef = doc(db, "debateState", DEBATE_STATE_DOC_ID);
    const unsubscribe = onSnapshot(docRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        if (data.timer && typeof data.timer.isActive === 'boolean') {
            setIsActive(data.timer.isActive);
            // If the timer was reset, sync the time remaining
            if (data.timer.lastUpdated && timeRemaining !== data.timer.duration) {
                setTimeRemaining(data.timer.duration);
            }
        }
      }
    });
    return () => unsubscribe();
  }, [timeRemaining]);


  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isActive && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining((time) => time - 1);
      }, 1000);
    } else if (timeRemaining <= 0 && isActive) {
      // Only the moderator's panel should be able to stop the timer and play the sound
      if (showControls) {
          toggleTimer(); 
          playSound();
      }
    }
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isActive, timeRemaining, showControls]);

  const playSound = async () => {
     if (Tone.context.state !== 'running') {
      await Tone.start();
    }
    if (synth.current) {
        synth.current.triggerAttackRelease("C5", "8n", Tone.now());
        synth.current.triggerAttackRelease("G5", "8n", Tone.now() + 0.2);
    }
  };
  
  const toggleTimer = async () => {
     if (Tone.context.state !== 'running') {
      await Tone.start();
    }
    const newIsActive = !isActive;

    // The moderator panel is the source of truth, it writes the new state to Firestore
    if (showControls) {
        try {
            const docRef = doc(db, "debateState", DEBATE_STATE_DOC_ID);
            await setDoc(docRef, { 
                timer: { 
                    isActive: newIsActive,
                    duration: initialTime,
                    lastUpdated: Date.now()
                } 
            }, { merge: true });
        } catch (error) {
            console.error("Error updating timer state in Firestore:", error);
        }
    }
  };

  const resetTimer = async () => {
    // Moderator is the only one who can reset
    if (showControls) {
        try {
            const docRef = doc(db, "debateState", DEBATE_STATE_DOC_ID);
            await setDoc(docRef, { 
                timer: { 
                    isActive: false, 
                    duration: initialTime,
                    lastUpdated: Date.now() // Force a refresh on all clients
                } 
            }, { merge: true });
            // The useEffect listener will handle setting the state locally
        } catch (error) {
            console.error("Error resetting timer state in Firestore:", error);
        }
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${remainingSeconds
      .toString()
      .padStart(2, "0")}`;
  };

  const progress = (timeRemaining / initialTime) * 100;

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
                            <Button onClick={toggleTimer} size="icon" className="h-8 w-8">
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
                    <Button onClick={toggleTimer} size="icon" className="w-12 h-12 rounded-full">
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
