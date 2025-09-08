"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

const DRAW_STATE_DOC_ID = "liveDraw";

type Team = {
  id: string;
  name: string;
  round: string | null;
};

type RoundData = {
    id: string;
    name: string;
    phase: string;
}

export function PublicDrawDisplay() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [rounds, setRounds] = useState<RoundData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [activeTab, setActiveTab] = useState("groups");

  useEffect(() => {
    setLoading(true);
    const drawStateRef = doc(db, "drawState", DRAW_STATE_DOC_ID);
    
    const unsubscribe = onSnapshot(drawStateRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            setTeams(data.teams || []);
            setRounds(data.rounds || []);
            setIsDrawing(data.isDrawing || false);
            setIsFinished(data.isFinished || false);
            setActiveTab(data.activeTab || 'groups');
        }
        setLoading(false);
    }, (error) => {
        console.error("Error fetching live draw state:", error);
        setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const getRoundTeams = (roundName: string) => {
    return teams.filter(t => t.round === roundName);
  }

  const animationStyles = useMemo(() => {
    if (rounds.length === 0) return '';
    
    const numRounds = rounds.length;
    const baseWidth = 100 / numRounds;
    
    return rounds.map((round, index) => `
        @keyframes fly-to-round-${index + 1} {
          0% { transform: translate(var(--tx, 0), var(--ty, 0)); opacity: 1; }
          100% { transform: translate(calc(-50vw + ${baseWidth * (index + 0.5)}vw), -20vh) scale(0); opacity: 0; }
        }
    `).join('\n');
  }, [rounds]);

  const CurrentDraw = () => {
    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="ml-4">Esperando inicio del sorteo...</p>
            </div>
        );
    }

    if (teams.length === 0 || rounds.length === 0) {
        return (
            <div className="flex justify-center items-center min-h-[400px] bg-secondary/50 rounded-lg">
                <p className="text-muted-foreground text-center px-4">
                    El sorteo para esta fase no ha sido configurado o iniciado aún.
                </p>
            </div>
        );
    }
    
    return (
        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${Math.max(1, rounds.length)} gap-6 min-h-[400px]`}>
            {rounds.map(round => (
                <Card key={round.id} className="flex flex-col">
                <CardHeader>
                    <CardTitle className="font-headline text-center">{round.name}</CardTitle>
                </CardHeader>
                <CardContent className="flex-grow space-y-2 relative">
                    {getRoundTeams(round.name).map((team) => (
                    <div key={team.id} className="p-3 bg-secondary rounded-md text-secondary-foreground font-medium text-center animate-in fade-in-50 duration-500">
                        {team.name}
                    </div>
                    ))}
                </CardContent>
                </Card>
            ))}
        </div>
    )
  }

  return (
    <div className="w-full max-w-6xl mx-auto">
        <div className="space-y-1 mb-8 text-center">
            <h1 className="font-headline text-3xl md:text-4xl font-bold">Sorteo en Vivo</h1>
            <p className="text-muted-foreground mt-2">
                Los equipos están siendo asignados a sus respectivas rondas. ¡Mucha suerte a todos!
            </p>
        </div>
        
        <CurrentDraw />

        <div className={cn(
            "fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center transition-opacity duration-300",
            isDrawing ? "opacity-100" : "opacity-0 pointer-events-none"
        )}>
            <div className="relative w-64 h-64">
            {teams.map((team, index) => {
                const angle = (index / (teams.length || 1)) * 2 * Math.PI;
                const x = Math.cos(angle) * 120;
                const y = Math.sin(angle) * 120;
                const roundIndex = rounds.findIndex(r => r.name === team.round) + 1;
                
                return (
                <div
                    key={team.id}
                    className={cn(
                    "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-2 bg-primary text-primary-foreground rounded-md shadow-lg transition-all duration-1000 ease-in-out",
                    isDrawing && team.round === null ? "opacity-100" : "opacity-0"
                    )}
                    style={{
                    animation: isDrawing && roundIndex > 0 ? `fly-to-round-${roundIndex} 1s ${index * 0.1}s forwards ease-in-out` : "none",
                    transform: `translate(${x}px, ${y}px) rotate(${angle}rad)`
                    }}
                >
                    {team.name}
                </div>
                );
            })}
            </div>
        </div>

        {isFinished && (
            <div className="mt-8 text-center flex flex-col items-center gap-4 animate-in fade-in-50">
                <h2 className="font-headline text-2xl font-bold">¡Sorteo Completado!</h2>
                <p className="text-muted-foreground">Los grupos han sido definidos.</p>
            </div>
        )}
        
        <style jsx>{`
            ${animationStyles}
        `}</style>
    </div>
  );
}
