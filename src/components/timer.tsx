
"use client";

import { useState, useEffect, useRef } from "react";
import * as Tone from "tone";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Play, Pause, RotateCcw, Bell } from "lucide-react";

interface TimerProps {
  initialTime: number; // in seconds
  title: string;
  showControls?: boolean;
}

export function Timer({ initialTime, title, showControls = true }: TimerProps) {
  const [timeRemaining, setTimeRemaining] = useState(initialTime);
  const [isActive, setIsActive] = useState(false);
  const synth = useRef<Tone.Synth | null>(null);

  useEffect(() => {
    // Initialize Tone.js Synth on client
    synth.current = new Tone.Synth().toDestination();
  }, []);

  useEffect(() => {
    setTimeRemaining(initialTime);
    // Do not auto-start if controls are hidden, moderator will control it
    if (showControls) {
        setIsActive(false);
    } else {
        // For public view, we can assume it's active and syncing with moderator
        setIsActive(true);
    }
  }, [initialTime, showControls]);


  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isActive && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining((time) => time - 1);
      }, 1000);
    } else if (timeRemaining === 0 && isActive) {
      setIsActive(false);
      // Only the moderator's timer should make a sound
      if(showControls) playSound();
    }
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isActive, timeRemaining, showControls]);

  const playSound = () => {
    if (synth.current) {
        Tone.start();
        synth.current.triggerAttackRelease("C5", "8n", Tone.now());
        synth.current.triggerAttackRelease("G5", "8n", Tone.now() + 0.2);
    }
  };
  
  const toggleTimer = async () => {
     if (Tone.context.state !== 'running') {
      await Tone.start();
    }
    setIsActive(!isActive);
  };

  const resetTimer = () => {
    setIsActive(false);
    setTimeRemaining(initialTime);
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${remainingSeconds
      .toString()
      .padStart(2, "0")}`;
  };

  const progress = (timeRemaining / initialTime) * 100;

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
        {showControls && (
            <div className="flex items-center gap-2">
            <Button onClick={toggleTimer} size="icon" className="w-12 h-12 rounded-full">
                {isActive ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </Button>
            <Button onClick={resetTimer} variant="outline" size="icon" className="w-10 h-10">
                <RotateCcw className="h-4 w-4" />
            </Button>
            <Button onClick={playSound} variant="outline" size="icon" className="w-10 h-10">
                <Bell className="h-4 w-4" />
            </Button>
            </div>
        )}
      </CardContent>
    </Card>
  );
}
