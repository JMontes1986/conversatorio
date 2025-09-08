"use client";

import { useState, useEffect, useRef } from "react";
import * as Tone from "tone";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Play, Pause, RotateCcw, Bell } from "lucide-react";

interface TimerProps {
  initialTime: number; // in seconds
  title: string;
}

export function Timer({ initialTime, title }: TimerProps) {
  const [timeRemaining, setTimeRemaining] = useState(initialTime);
  const [isActive, setIsActive] = useState(false);
  const synth = useRef<Tone.Synth | null>(null);

  useEffect(() => {
    // Initialize Tone.js Synth on client
    synth.current = new Tone.Synth().toDestination();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isActive && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining((time) => time - 1);
      }, 1000);
    } else if (timeRemaining === 0 && isActive) {
      setIsActive(false);
      playSound();
    }
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isActive, timeRemaining]);

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
      <CardContent className="p-6 flex flex-col items-center justify-center space-y-4">
        <h3 className="text-lg font-medium text-muted-foreground">{title}</h3>
        <div className="relative w-48 h-48">
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
             <span className="text-4xl font-bold font-mono tabular-nums">
                {formatTime(timeRemaining)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={toggleTimer} size="icon" className="w-16 h-16 rounded-full">
            {isActive ? <Pause className="h-8 w-8" /> : <Play className="h-8 w-8" />}
          </Button>
          <Button onClick={resetTimer} variant="outline" size="icon">
            <RotateCcw className="h-5 w-5" />
          </Button>
           <Button onClick={playSound} variant="outline" size="icon">
            <Bell className="h-5 w-5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
