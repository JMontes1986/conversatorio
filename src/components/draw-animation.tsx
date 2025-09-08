"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Shuffle, ShieldCheck, Loader2 } from "lucide-react";

const TEAMS = [
  "Águilas Doradas", "Leones Intrépidos", "Tigres del Saber", "Cobras Estratégicas",
  "Halcones Reales", "Lobos Plateados", "Pumas Analíticos", "Serpientes de Élite",
  "Jaguares Audaces", "Osos Polares", "Búhos Sabios", "Panteras Negras",
  "Caimanes Filosóficos", "Dragones del Debate", "Fénix Retóricos", "Grifos Elocuentes",
];

type Team = {
  id: number;
  name: string;
  group: number | null;
};

const shuffleArray = (array: any[]) => {
  let currentIndex = array.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
  return array;
};

export function DrawAnimation() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [isFixing, setIsFixing] = useState(false);

  useEffect(() => {
    setTeams(TEAMS.map((name, index) => ({ id: index, name, group: null })));
  }, []);

  const startDraw = () => {
    setIsDrawing(true);
    setIsFinished(false);
    const shuffledTeams = shuffleArray([...teams]);
    
    shuffledTeams.forEach((team, index) => {
      setTimeout(() => {
        setTeams(prevTeams =>
          prevTeams.map(t =>
            t.id === team.id ? { ...t, group: (index % 4) + 1 } : t
          )
        );
        if (index === shuffledTeams.length - 1) {
          setIsDrawing(false);
          setIsFinished(true);
        }
      }, index * 200);
    });
  };

  const resetDraw = () => {
    setTeams(TEAMS.map((name, index) => ({ id: index, name, group: null })));
    setIsDrawing(false);
    setIsFinished(false);
    setIsFixing(false);
  };
  
  const fixToBlockchain = () => {
    setIsFixing(true);
    setTimeout(() => {
      setIsFixing(false);
    }, 2000);
  };

  const getGroupTeams = (groupNumber: number) => {
    return teams.filter(t => t.group === groupNumber);
  }

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div className="space-y-1">
          <h1 className="font-headline text-3xl font-bold">Sorteo Automático de Grupos</h1>
          <p className="text-muted-foreground">Observe cómo los equipos son asignados aleatoriamente a sus grupos.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={startDraw} disabled={isDrawing || isFinished}>
            <Shuffle className="mr-2 h-4 w-4" />
            Iniciar Sorteo
          </Button>
          <Button onClick={resetDraw} variant="outline" disabled={isDrawing}>
            Reiniciar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 min-h-[400px]">
        {[1, 2, 3, 4].map(groupNumber => (
          <Card key={groupNumber} className="flex flex-col">
            <CardHeader>
              <CardTitle className="font-headline text-center">Grupo {groupNumber}</CardTitle>
            </CardHeader>
            <CardContent className="flex-grow space-y-2 relative">
              {getGroupTeams(groupNumber).map((team, index) => (
                <div key={team.id} className="p-3 bg-secondary rounded-md text-secondary-foreground font-medium text-center animate-in fade-in-50 duration-500">
                  {team.name}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className={cn(
        "fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center transition-opacity duration-300",
        isDrawing ? "opacity-100" : "opacity-0 pointer-events-none"
      )}>
        <div className="relative w-64 h-64">
          {teams.map((team, index) => {
            const angle = (index / teams.length) * 2 * Math.PI;
            const x = Math.cos(angle) * 120;
            const y = Math.sin(angle) * 120;
            const group = (team.id % 4) + 1;
            
            return (
              <div
                key={team.id}
                className={cn(
                  "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-2 bg-primary text-primary-foreground rounded-md shadow-lg transition-all duration-1000 ease-in-out",
                  isDrawing && team.group === null ? "opacity-100" : "opacity-0"
                )}
                style={{
                  animation: isDrawing ? `fly-to-group-${group} 1s ${index * 0.1}s forwards ease-in-out` : "none",
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
            <p className="text-muted-foreground">Los grupos han sido definidos. El resultado puede ser fijado para asegurar su integridad.</p>
             <Button onClick={fixToBlockchain} disabled={isFixing} size="lg" variant="secondary" className="bg-accent hover:bg-accent/90 text-accent-foreground">
                {isFixing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                {isFixing ? "Fijando en Blockchain..." : "Fijar Resultado en Blockchain"}
            </Button>
        </div>
      )}
      
      <style jsx>{`
        @keyframes fly-to-group-1 {
          0% { transform: translate(var(--tx, 0), var(--ty, 0)); opacity: 1; }
          100% { transform: translate(-30vw, -20vh) scale(0); opacity: 0; }
        }
        @keyframes fly-to-group-2 {
          0% { transform: translate(var(--tx, 0), var(--ty, 0)); opacity: 1; }
          100% { transform: translate(-10vw, -20vh) scale(0); opacity: 0; }
        }
        @keyframes fly-to-group-3 {
          0% { transform: translate(var(--tx, 0), var(--ty, 0)); opacity: 1; }
          100% { transform: translate(10vw, -20vh) scale(0); opacity: 0; }
        }
        @keyframes fly-to-group-4 {
          0% { transform: translate(var(--tx, 0), var(--ty, 0)); opacity: 1; }
          100% { transform: translate(30vw, -20vh) scale(0); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
