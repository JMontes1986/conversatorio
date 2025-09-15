

"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Loader2, Swords, Users, Dices, Crown } from "lucide-react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

const DRAW_STATE_DOC_ID = "liveDraw";
const TIEBREAK_DOC_ID = "current";

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
type TiebreakState = {
    isActive: boolean;
    roundName: string;
    team1: string;
    team2: string;
    results: { team1: number, team2: number } | null;
    winner: string | null;
    isRolling: boolean;
}

const Dice = ({ value }: { value: number }) => {
  const dots = [];
  const dotPositions: { [key: number]: number[][] } = {
    1: [[4]],
    2: [[0, 8], [2, 6]],
    3: [[0, 4, 8], [2, 4, 6]],
    4: [[0, 2, 6, 8]],
    5: [[0, 2, 4, 6, 8]],
    6: [[0, 3, 6, 2, 5, 8]],
  };
  // Ensure value is within bounds
  const validValue = Math.max(1, Math.min(6, value || 1));
  const positions = dotPositions[validValue][Math.floor(Math.random() * dotPositions[validValue].length)];
  for (let i = 0; i < 9; i++) {
    dots.push(
      <div
        key={i}
        className={cn(
          'w-4 h-4 rounded-full',
          positions.includes(i) ? 'bg-foreground' : 'bg-transparent'
        )}
      />
    );
  }
  return <div className="w-16 h-16 border-2 rounded-lg p-2 grid grid-cols-3 gap-1">{dots}</div>;
};


export function PublicDrawDisplay() {
  const [drawState, setDrawState] = useState<DrawState | null>(null);
  const [tiebreakState, setTiebreakState] = useState<TiebreakState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const drawStateRef = doc(db, "drawState", DRAW_STATE_DOC_ID);
    const tiebreakRef = doc(db, "tiebreak", TIEBREAK_DOC_ID);
    
    const unsubscribeDraw = onSnapshot(drawStateRef, (docSnap) => {
        if (docSnap.exists()) {
            setDrawState(docSnap.data() as DrawState);
        }
        setLoading(false);
    });

    const unsubscribeTiebreak = onSnapshot(tiebreakRef, (docSnap) => {
        if (docSnap.exists()) {
            setTiebreakState(docSnap.data() as TiebreakState);
        } else {
            setTiebreakState(null);
        }
    });

    return () => {
        unsubscribeDraw();
        unsubscribeTiebreak();
    };
  }, []);

  const TiebreakModal = () => {
      if (!tiebreakState || !tiebreakState.isActive) return null;

      return (
        <Dialog open={true}>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle className="font-headline text-2xl text-center">
                        ¡Desempate en Vivo!
                    </DialogTitle>
                </DialogHeader>
                <div className="text-center">
                    <p className="text-muted-foreground">Resolviendo empate en la ronda:</p>
                    <p className="font-bold text-lg mb-4">{tiebreakState.roundName}</p>

                     <div className="grid grid-cols-2 gap-4 items-center">
                        <div className={cn("p-4 rounded-lg transition-colors", tiebreakState.winner === tiebreakState.team1 && 'bg-green-100 dark:bg-green-900/50')}>
                            <p className="font-bold text-xl">{tiebreakState.team1}</p>
                            {tiebreakState.isRolling && <Dices className="h-16 w-16 mx-auto my-4 animate-spin" />}
                            {tiebreakState.results && <div className="flex justify-center my-4"><Dice value={tiebreakState.results.team1} /></div>}
                        </div>
                        <div className={cn("p-4 rounded-lg transition-colors", tiebreakState.winner === tiebreakState.team2 && 'bg-green-100 dark:bg-green-900/50')}>
                            <p className="font-bold text-xl">{tiebreakState.team2}</p>
                            {tiebreakState.isRolling && <Dices className="h-16 w-16 mx-auto my-4 animate-spin" />}
                            {tiebreakState.results && <div className="flex justify-center my-4"><Dice value={tiebreakState.results.team2} /></div>}
                        </div>
                    </div>

                    {tiebreakState.results && !tiebreakState.winner && (
                         <p className='font-bold text-xl text-amber-600 mt-4'>¡Otro Empate! Volviendo a lanzar...</p>
                    )}

                    {tiebreakState.winner && (
                        <div className="mt-6">
                            <p className="text-xl font-bold flex items-center justify-center gap-2">
                                <Crown className="h-6 w-6 text-amber-500"/>
                                Ganador: <span className="text-green-600 dark:text-green-400">{tiebreakState.winner}</span>
                            </p>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
      )
  }

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
        
        <TiebreakModal />
        <CurrentDraw />
    </div>
  );
}
