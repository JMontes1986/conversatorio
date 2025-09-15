
"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Loader2, Swords, Users } from "lucide-react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const DRAW_STATE_DOC_ID = "liveDraw";

type Matchup = {
    roundName: string;
    teams: string[];
}

type Phase = {
    name: string;
    matchups: Matchup[];
}

type DrawState = {
    phases: Phase[];
}


export function PublicDrawDisplay() {
  const [drawState, setDrawState] = useState<DrawState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const drawStateRef = doc(db, "drawState", DRAW_STATE_DOC_ID);
    
    const unsubscribeDraw = onSnapshot(drawStateRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data() as DrawState;
            setDrawState(data);
        }
        setLoading(false);
    }, (error) => {
        console.error("Error fetching live draw state:", error);
        setLoading(false);
    });

    return () => {
        unsubscribeDraw();
    };
  }, []);

  const CurrentDraw = () => {
    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="ml-4">Cargando llaves del torneo...</p>
            </div>
        );
    }

    if (!drawState || !drawState.phases || drawState.phases.length === 0) {
        return (
            <div className="flex justify-center items-center min-h-[400px] bg-secondary/50 rounded-lg">
                <p className="text-muted-foreground text-center px-4">
                    El sorteo o las llaves del torneo no han sido configurados o iniciados aún.
                </p>
            </div>
        );
    }
    
    return (
      <TooltipProvider>
        <div className="space-y-8">
            {drawState.phases.map(phase => (
                 <Card key={phase.name}>
                    <CardHeader>
                        <CardTitle className="font-headline text-xl md:text-2xl flex items-center gap-3">
                            <Users className="h-6 w-6 text-primary"/>
                            {phase.name}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {phase.matchups.map(matchup => (
                             <Card key={matchup.roundName} className="bg-background">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base text-center font-semibold">{matchup.roundName}</CardTitle>
                                </CardHeader>
                                <CardContent className="flex items-center justify-center p-4">
                                   {matchup.teams.length > 1 ? (
                                        <div className="flex items-center gap-3 text-sm font-medium text-center">
                                            <span>{matchup.teams[0]}</span>
                                            <Swords className="h-5 w-5 text-muted-foreground shrink-0"/>
                                            <span>{matchup.teams[1]}</span>
                                        </div>
                                   ) : (
                                        <div className="text-sm font-medium">{matchup.teams[0] || 'Equipo pendiente'}</div>
                                   )}
                                </CardContent>
                            </Card>
                        ))}
                    </CardContent>
                </Card>
            ))}
        </div>
      </TooltipProvider>
    )
  }

  return (
    <div className="w-full max-w-6xl mx-auto">
        <div className="space-y-1 mb-8 text-center">
            <h1 className="font-headline text-3xl md:text-4xl font-bold">Llaves del Torneo</h1>
            <p className="text-muted-foreground mt-2">
                Enfrentamientos actuales y futuros del conversatorio.
            </p>
        </div>
        
        <CurrentDraw />
    </div>
  );
}

