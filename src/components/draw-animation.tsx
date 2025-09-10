
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Shuffle, ShieldCheck, Loader2, Users } from "lucide-react";
import { collection, onSnapshot, query, where, doc, setDoc, getDocs, orderBy, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";

const DRAW_STATE_DOC_ID = "liveDraw";
const SETTINGS_DOC_ID = "competition";

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
  const newArray = [...array];
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [newArray[currentIndex], newArray[randomIndex]] = [newArray[randomIndex], newArray[currentIndex]];
  }
  return newArray;
};

export function DrawAnimation() {
  const { toast } = useToast();
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [allRounds, setAllRounds] = useState<RoundData[]>([]);
  
  const [teams, setTeams] = useState<Team[]>([]);
  const [rounds, setRounds] = useState<RoundData[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [isFixing, setIsFixing] = useState(false);

 useEffect(() => {
    const unsubTeams = onSnapshot(query(collection(db, "schools"), where("status", "==", "Verificado")), (snapshot) => {
        const fetchedTeams = snapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().teamName,
            round: null
        }));
        setAllTeams(fetchedTeams);
        setTeams(fetchedTeams);
        setLoading(false);
    }, (error) => {
        console.error("Error fetching teams: ", error);
        setLoading(false);
    });

    const unsubRounds = onSnapshot(query(collection(db, "rounds"), orderBy("createdAt", "asc")), (snapshot) => {
        const roundsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RoundData));
        const groupRounds = roundsData.filter(r => r.phase === "Fase de Grupos");
        setAllRounds(groupRounds);
        setRounds(groupRounds);
    });
    
    const unsubDrawState = onSnapshot(doc(db, "drawState", DRAW_STATE_DOC_ID), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.teams && data.teams.length > 0) setTeams(data.teams);
            setIsDrawing(data.isDrawing || false);
            setIsFinished(data.isFinished || false);
        }
    });

    return () => {
      unsubTeams();
      unsubRounds();
      unsubDrawState();
    };
  }, []);

  
  const updateLiveDrawState = async (state: any) => {
      try {
        const drawStateRef = doc(db, "drawState", DRAW_STATE_DOC_ID);
        await setDoc(drawStateRef, { ...state, lastUpdated: new Date() }, { merge: true });
      } catch (error) {
        console.error("Failed to update live draw state:", error);
        toast({
          variant: "destructive",
          title: "Error de Sincronización",
          description: "No se pudo actualizar el estado del sorteo en vivo."
        });
      }
  };

  const startDraw = async () => {
    if (teams.length === 0 || rounds.length === 0) return;

    setIsDrawing(true);
    setIsFinished(false);

    const shuffledTeams = shuffleArray([...teams]);
    let assignedTeams = teams.map(t => ({...t, round: null}));
    setTeams(assignedTeams);

    const initialState = {
        teams: assignedTeams,
        rounds,
        isDrawing: true,
        isFinished: false,
    };
    await updateLiveDrawState(initialState);
    
    const teamUpdatePromises: Promise<void>[] = [];

    for (let i = 0; i < shuffledTeams.length; i++) {
        const team = shuffledTeams[i];
        await new Promise(resolve => setTimeout(resolve, i * 200));

        assignedTeams = assignedTeams.map(t => 
            t.id === team.id ? { ...t, round: rounds[i % rounds.length].name } : t
        );

        setTeams([...assignedTeams]);
        teamUpdatePromises.push(updateLiveDrawState({ teams: [...assignedTeams] }));
    }

    await Promise.all(teamUpdatePromises);

    setIsDrawing(false);
    setIsFinished(true);
    await updateLiveDrawState({ isDrawing: false, isFinished: true, teams: assignedTeams, rounds });
  };
  
  const fixToBlockchain = () => {
    setIsFixing(true);
    toast({
        title: "¡Sorteo Confirmado!",
        description: "El resultado del sorteo ha sido fijado y es visible para todos."
    })
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
        <div className="space-y-1 mb-8">
            <h1 className="font-headline text-3xl font-bold">Sorteo Automático</h1>
            <p className="text-muted-foreground">Realice el sorteo para la Fase de Grupos. El resultado se reflejará para el público.</p>
        </div>

        <Card className="mb-8">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Equipos Elegibles para el Sorteo</CardTitle>
                <CardDescription>Esta es la lista de equipos que participarán en el sorteo de la Fase de Grupos.</CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? (
                     <p className="text-muted-foreground">Cargando equipos...</p>
                ) : allTeams.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                        {allTeams.map(team => (
                            <div key={team.id} className="p-2 bg-secondary rounded-md text-secondary-foreground font-medium text-sm">
                                {team.name}
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-muted-foreground">No hay equipos elegibles. Verifique que los colegios estén 'Verificado'.</p>
                )}
            </CardContent>
        </Card>
        
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
            <div className="space-y-1">
                <h2 className="font-headline text-2xl font-bold">Rondas de Grupos</h2>
                <p className="text-muted-foreground">
                    Observe cómo los equipos son asignados aleatoriamente a sus rondas iniciales.
                </p>
            </div>
            <div className="flex gap-2">
                <Button onClick={startDraw} disabled={isDrawing || isFinished || loading || teams.length === 0 || rounds.length === 0}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Shuffle className="mr-2 h-4 w-4" />}
                    {loading ? "Cargando..." : "Iniciar Sorteo"}
                </Button>
            </div>
        </div>

        {loading ? (
            <div className="flex justify-center items-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        ) : teams.length === 0 || rounds.length === 0 ? (
            <div className="flex justify-center items-center min-h-[400px] bg-secondary/50 rounded-lg">
                <p className="text-muted-foreground text-center px-4">
                    {teams.length === 0 
                        ? "No hay colegios verificados para el sorteo."
                        : "No hay rondas de 'Fase de Grupos' configuradas."
                    }
                </p>
            </div>
        ) : (
            <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${Math.max(1, rounds.length)} gap-6 min-h-[400px]`}>
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
            <p className="text-muted-foreground">Los grupos han sido definidos. El resultado es ahora visible para el público.</p>
             <Button onClick={fixToBlockchain} disabled={isFixing} size="lg" variant="secondary" className="bg-accent hover:bg-accent/90 text-accent-foreground">
                {isFixing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                {isFixing ? "Fijando..." : "Confirmar Resultado"}
            </Button>
        </div>
      )}
      
      <style jsx>{`
        ${animationStyles}
      `}</style>
    </div>
  );
}
