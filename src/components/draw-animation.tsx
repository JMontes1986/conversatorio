
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Shuffle, ShieldCheck, Loader2 } from "lucide-react";
import { collection, onSnapshot, query, where, orderBy, doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
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

type ScoreData = {
    id: string;
    matchId: string;
    teams: { name: string; total: number }[];
}

const shuffleArray = (array: any[]) => {
  let currentIndex = array.length, randomIndex;
  const newArray = [...array]; // Create a copy to avoid mutating the original array
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [newArray[currentIndex], newArray[randomIndex]] = [newArray[randomIndex], newArray[currentIndex]];
  }
  return newArray;
};

function getTopScoringTeamsFromPhase(scores: ScoreData[], phaseRounds: RoundData[], limit: number): string[] {
    const phaseRoundNames = phaseRounds.map(r => r.name);
    const phaseScores = scores.filter(s => phaseRoundNames.some(name => s.matchId.startsWith(name)));

    const teamTotals: Record<string, number> = {};

    phaseScores.forEach(score => {
        score.teams.forEach(team => {
            if (!teamTotals[team.name]) {
                teamTotals[team.name] = 0;
            }
            teamTotals[team.name] += team.total;
        });
    });

    return Object.entries(teamTotals)
        .sort(([, scoreA], [, scoreB]) => scoreB - scoreA)
        .slice(0, limit)
        .map(([teamName]) => teamName);
}


export function DrawAnimation() {
  const { toast } = useToast();
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [allRounds, setAllRounds] = useState<RoundData[]>([]);
  const [rounds, setRounds] = useState<RoundData[]>([]);
  const [allScores, setAllScores] = useState<ScoreData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [activeTab, setActiveTab] = useState("groups");

  useEffect(() => {
    setLoading(true);
    
    const settingsRef = doc(db, "settings", SETTINGS_DOC_ID);
    const unsubscribeSettings = onSnapshot(settingsRef, async (settingsSnap) => {
        const settingsData = settingsSnap.exists() ? settingsSnap.data() : {};
        
        let teamsToFetchQuery;
        if (settingsData.registrationsClosed && settingsData.lockedInTeams) {
            // If registrations are closed, use the locked-in list of team IDs
            const lockedInTeamIds = settingsData.lockedInTeams.map((t: any) => t.id);
            if (lockedInTeamIds.length > 0) {
                teamsToFetchQuery = query(collection(db, "schools"), where('__name__', 'in', lockedInTeamIds));
            } else {
                setAllTeams([]); // No teams locked in
            }
        } else {
            // Otherwise, fetch all verified schools
            teamsToFetchQuery = query(collection(db, "schools"), where("status", "==", "Verificado"));
        }

        if (teamsToFetchQuery) {
            onSnapshot(teamsToFetchQuery, (snapshot) => {
                const fetchedTeams = snapshot.docs.map(doc => ({
                    id: doc.id,
                    name: doc.data().teamName,
                    round: null
                }));
                setAllTeams(fetchedTeams);
            });
        }
    });

    const roundsQuery = query(collection(db, "rounds"), orderBy("createdAt", "asc"));
    const unsubscribeRounds = onSnapshot(roundsQuery, (snapshot) => {
        const roundsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RoundData));
        setAllRounds(roundsData);
    });

    const scoresQuery = query(collection(db, "scores"), orderBy("createdAt", "desc"));
    const unsubscribeScores = onSnapshot(scoresQuery, (snapshot) => {
        const scoresData: ScoreData[] = [];
        snapshot.forEach((doc) => {
            scoresData.push({ id: doc.id, ...doc.data()} as ScoreData);
        });
        setAllScores(scoresData);
    });
    
    const drawStateRef = doc(db, "drawState", DRAW_STATE_DOC_ID);
    const unsubscribeDrawState = onSnapshot(drawStateRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            const currentTabInDb = data.activeTab || 'groups';
            
            if (currentTabInDb === activeTab) {
                setTeams(data.teams || []);
                setRounds(data.rounds || []);
                setIsDrawing(data.isDrawing || false);
                setIsFinished(data.isFinished || false);
            }
        }
        setLoading(false);
    });


    return () => {
        unsubscribeSettings();
        unsubscribeRounds();
        unsubscribeScores();
        unsubscribeDrawState();
    };
  }, [activeTab]);

  const resetDraw = useCallback(async (isTabChange = false) => {
    let eligibleTeams: Team[] = [];
    let eligibleRounds: RoundData[] = [];
    
    if (activeTab === "groups") {
        eligibleRounds = allRounds.filter(r => r.phase === "Fase de Grupos");
        eligibleTeams = allTeams.map(t => ({...t, round: null}));
    } else if (activeTab === "quarters") {
        eligibleRounds = allRounds.filter(r => r.phase === "Cuartos de Final");
        const groupRounds = allRounds.filter(r => r.phase === "Fase de Grupos");
        const qualifiedTeamNames = getTopScoringTeamsFromPhase(allScores, groupRounds, 8);
        const teamsSource = allTeams.filter(t => qualifiedTeamNames.includes(t.name));
        eligibleTeams = teamsSource.map(t => ({...t, round: null}));
    }
    
    let finalState;
    const drawStateRef = doc(db, "drawState", DRAW_STATE_DOC_ID);
    const docSnap = await getDoc(drawStateRef);

    if (docSnap.exists() && docSnap.data().activeTab === activeTab) {
        const data = docSnap.data();
        finalState = {
            teams: data.teams || eligibleTeams,
            rounds: data.rounds || eligibleRounds,
            isDrawing: data.isDrawing || false,
            isFinished: data.isFinished || false,
            activeTab
        };
    } else {
        finalState = {
            teams: eligibleTeams,
            rounds: eligibleRounds,
            isDrawing: false,
            isFinished: false,
            activeTab
        };
        // Only update remotely if it's a fresh state for this tab
        await updateLiveDrawState(finalState);
    }
    
    setTeams(finalState.teams);
    setRounds(finalState.rounds);
    setIsDrawing(finalState.isDrawing);
    setIsFinished(finalState.isFinished);
    setIsFixing(false);
    setLoading(false);
    
  }, [activeTab, allRounds, allTeams, allScores]);
  
  useEffect(() => {
      if (loading || allRounds.length === 0 || allTeams.length === 0) return;
      resetDraw(true);
  }, [activeTab, allTeams, allRounds, resetDraw, loading]);


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
        activeTab
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
    await updateLiveDrawState({ isDrawing: false, isFinished: true, teams: assignedTeams, rounds, activeTab });
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
            <p className="text-muted-foreground">Seleccione la fase, realice el sorteo y se reflejará para el público.</p>
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
                <TabsTrigger value="groups">Fase de Grupos</TabsTrigger>
                <TabsTrigger value="quarters">Cuartos de Final</TabsTrigger>
            </TabsList>
            
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                <div className="space-y-1">
                    <h2 className="font-headline text-2xl font-bold capitalize">{activeTab === 'groups' ? 'Sorteo de Grupos' : 'Sorteo de Cuartos'}</h2>
                    <p className="text-muted-foreground">
                        {activeTab === 'groups' 
                        ? 'Observe cómo los equipos son asignados aleatoriamente a sus rondas iniciales.'
                        : 'Los equipos clasificados serán sorteados para los enfrentamientos de cuartos de final.'}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={startDraw} disabled={isDrawing || isFinished || loading || teams.length === 0 || rounds.length === 0}>
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Shuffle className="mr-2 h-4 w-4" />}
                        {loading ? "Cargando..." : "Iniciar Sorteo"}
                    </Button>
                    <Button onClick={() => resetDraw(false)} variant="outline" disabled={isDrawing}>
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
                    <p className="text-muted-foreground text-center px-4">
                        {teams.length === 0 
                            ? (activeTab === 'groups' ? "No hay colegios verificados para el sorteo." : "No hay equipos clasificados para esta fase.")
                            : (activeTab === 'groups' ? "No hay rondas de 'Fase de Grupos' configuradas." : "No hay rondas de 'Cuartos de Final' configuradas.")
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
        </Tabs>


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
