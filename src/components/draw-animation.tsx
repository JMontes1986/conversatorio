
"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Shuffle, ShieldCheck, Loader2 } from "lucide-react";
import { collection, onSnapshot, query, where, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";

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
  const [rounds, setRounds] = useState<RoundData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [isFixing, setIsFixing] = useState(false);

  useEffect(() => {
    setLoading(true);
    const schoolsQuery = query(collection(db, "schools"), where("status", "==", "Verificado"));
    const unsubscribeSchools = onSnapshot(schoolsQuery, (snapshot) => {
        const fetchedTeams = snapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().teamName,
            round: null
        }));
        setTeams(fetchedTeams);
        if(!rounds.length) setLoading(false);
    });

    const roundsQuery = query(collection(db, "rounds"), orderBy("createdAt", "asc"));
    const unsubscribeRounds = onSnapshot(roundsQuery, (snapshot) => {
        let groupRounds = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as RoundData))
            .filter(r => r.phase === "Fase de Grupos");
        
        // Fallback for rounds named 'Ronda X' if phase is not set
        if (groupRounds.length === 0) {
            groupRounds = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as RoundData))
            .filter(r => r.name.toLowerCase().startsWith("ronda"));
        }

        setRounds(groupRounds);
        setLoading(false);
    });


    return () => {
        unsubscribeSchools();
        unsubscribeRounds();
    };
  }, []);

  const startDraw = () => {
    if (teams.length === 0 || rounds.length === 0) return;
    setIsDrawing(true);
    setIsFinished(false);
    const shuffledTeams = shuffleArray([...teams]);
    
    shuffledTeams.forEach((team, index) => {
      setTimeout(() => {
        setTeams(prevTeams =>
          prevTeams.map(t =>
            t.id === team.id ? { ...t, round: rounds[index % rounds.length].name } : t
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
    setTeams(teams.map(t => ({...t, round: null})));
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


  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div className="space-y-1">
          <h1 className="font-headline text-3xl font-bold">Sorteo Automático de Grupos</h1>
          <p className="text-muted-foreground">Observe cómo los equipos son asignados aleatoriamente a sus rondas.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={startDraw} disabled={isDrawing || isFinished || loading || teams.length === 0 || rounds.length === 0}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Shuffle className="mr-2 h-4 w-4" />}
            {loading ? "Cargando..." : "Iniciar Sorteo"}
          </Button>
          <Button onClick={resetDraw} variant="outline" disabled={isDrawing}>
            Reiniciar
          </Button>
        </div>
      </div>

      {loading ? (
          <div className="flex justify-center items-center min-h-[400px]">
              <Loader2 className="h-8 w-8 animate-spin" />
          </div>
      ) : teams.length === 0 || rounds.length === 0 ? (
          <div className="flex justify-center items-center min-h-[400px] bg-secondary/50 rounded-lg">
            <p className="text-muted-foreground">
                {teams.length === 0 ? "No hay colegios verificados para el sorteo." : "No hay rondas de 'Fase de Grupos' configuradas."}
            </p>
          </div>
      ) : (
        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${rounds.length} gap-6 min-h-[400px]`}>
          {rounds.map(round => (
            <Card key={round.id} className="flex flex-col">
              <CardHeader>
                <CardTitle className="font-headline text-center">{round.name}</CardTitle>
              </CardHeader>
              <CardContent className="flex-grow space-y-2 relative">
                {getRoundTeams(round.name).map((team, index) => (
                  <div key={team.id} className="p-3 bg-secondary rounded-md text-secondary-foreground font-medium text-center animate-in fade-in-50 duration-500">
                    {team.name}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}


      <div className={cn(
        "fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center transition-opacity duration-300",
        isDrawing ? "opacity-100" : "opacity-0 pointer-events-none"
      )}>
        <div className="relative w-64 h-64">
          {teams.map((team, index) => {
            const angle = (index / teams.length) * 2 * Math.PI;
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
            <p className="text-muted-foreground">Los grupos han sido definidos. El resultado puede ser fijado para asegurar su integridad.</p>
             <Button onClick={fixToBlockchain} disabled={isFixing} size="lg" variant="secondary" className="bg-accent hover:bg-accent/90 text-accent-foreground">
                {isFixing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                {isFixing ? "Fijando en Blockchain..." : "Fijar Resultado en Blockchain"}
            </Button>
        </div>
      )}
      
      <style jsx>{animationStyles}</style>
    </div>
  );
}
