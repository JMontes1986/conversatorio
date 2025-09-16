
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Shuffle, ShieldCheck, Loader2, Users } from "lucide-react";
import { collection, onSnapshot, query, where, doc, setDoc, getDocs, orderBy, deleteDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";

const DRAW_STATE_DOC_ID = "liveDraw";

type Team = {
  id: string;
  name: string;
};

type RoundData = {
    id: string;
    name: string;
    phase: string;
}

type Matchup = {
    roundName: string;
    teams: string[];
}
type Phase = {
    name: string;
    matchups: Matchup[];
}
type LiveDrawState = {
    phases: Phase[];
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
  const [groupRounds, setGroupRounds] = useState<RoundData[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  
  const [assignedTeams, setAssignedTeams] = useState<Matchup[]>([]);


 useEffect(() => {
    setLoading(true);
    const unsubTeams = onSnapshot(query(collection(db, "schools"), where("status", "==", "Verificado")), (snapshot) => {
        const fetchedTeams = snapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().teamName,
        }));
        setAllTeams(fetchedTeams);
    }, (error) => {
        console.error("Error fetching teams: ", error);
    });

    const unsubRounds = onSnapshot(query(collection(db, "rounds"), orderBy("createdAt", "asc")), (snapshot) => {
        const roundsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RoundData));
        const filteredRounds = roundsData.filter(r => r.phase === "Fase de Grupos");
        setGroupRounds(filteredRounds);
    });

    const drawStateRef = doc(db, "drawState", DRAW_STATE_DOC_ID);
    const unsubDrawState = onSnapshot(drawStateRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data() as LiveDrawState;
            const groupPhase = data.phases?.find(p => p.name === "Fase de Grupos");
            if (groupPhase && groupPhase.matchups.length > 0) {
                setAssignedTeams(groupPhase.matchups);
                setIsFinished(true); // Mark as finished if there's a saved state
            }
        }
        setLoading(false);
    });
    
    return () => {
      unsubTeams();
      unsubRounds();
      unsubDrawState();
    };
  }, []);

  const startDraw = async () => {
    if (allTeams.length === 0 || groupRounds.length === 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'No hay suficientes equipos o rondas de grupo configuradas.' });
      return;
    }

    setIsDrawing(true);
    setIsFinished(false);
    setAssignedTeams([]);

    const shuffledTeams = shuffleArray([...allTeams]);
    const matchups: Matchup[] = [];
    const teamsPerRound = 2;

    for (let i = 0; i < groupRounds.length; i++) {
        const round = groupRounds[i];
        const teamsForThisRound = shuffledTeams.slice(i * teamsPerRound, (i * teamsPerRound) + teamsPerRound).map(t => t.name);
        if (teamsForThisRound.length > 0) {
            matchups.push({ roundName: round.name, teams: teamsForThisRound });
        }
    }
    
    // Simulate animation
    for (let i = 0; i < matchups.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      setAssignedTeams(current => [...current, matchups[i]]);
    }
    
    const drawState: LiveDrawState = {
        phases: [{
            name: "Fase de Grupos",
            matchups: matchups
        }]
    };
    
    try {
        await setDoc(doc(db, "drawState", DRAW_STATE_DOC_ID), drawState);
        setIsDrawing(false);
        setIsFinished(true);
    } catch (error) {
        console.error("Error saving draw state:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo guardar el resultado del sorteo.' });
        setIsDrawing(false);
    }
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


  return (
    <div className="w-full max-w-6xl mx-auto">
        <div className="space-y-1 mb-8">
            <h1 className="font-headline text-3xl font-bold">Sorteo Automático de Grupos</h1>
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
                <Button onClick={startDraw} disabled={isDrawing || loading || allTeams.length === 0 || groupRounds.length === 0}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Shuffle className="mr-2 h-4 w-4" />}
                    {loading ? "Cargando..." : isFinished ? "Volver a Sortear" : "Iniciar Sorteo"}
                </Button>
            </div>
        </div>

        {loading ? (
            <div className="flex justify-center items-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        ) : allTeams.length === 0 || groupRounds.length === 0 ? (
            <div className="flex justify-center items-center min-h-[400px] bg-secondary/50 rounded-lg">
                <p className="text-muted-foreground text-center px-4">
                    {allTeams.length === 0 
                        ? "No hay colegios verificados para el sorteo."
                        : "No hay rondas de 'Fase de Grupos' configuradas."
                    }
                </p>
            </div>
        ) : (
            <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${Math.max(1, groupRounds.length)} gap-6 min-h-[400px]`}>
            {groupRounds.map(round => {
                const matchup = assignedTeams.find(m => m.roundName === round.name);
                return (
                    <Card key={round.id} className="flex flex-col">
                        <CardHeader>
                            <CardTitle className="font-headline text-center">{round.name}</CardTitle>
                        </CardHeader>
                        <CardContent className="flex-grow space-y-2 relative">
                            {matchup?.teams.map((teamName, index) => (
                                <div key={`${teamName}-${index}`} className="p-3 bg-secondary rounded-md text-secondary-foreground font-medium text-center animate-in fade-in-50 duration-500">
                                    {teamName}
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                )
            })}
            </div>
        )}

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
    </div>
  );
}
