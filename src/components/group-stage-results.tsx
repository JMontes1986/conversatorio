
"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy, where, doc } from "firebase/firestore";
import { Loader2, Trophy, EyeOff } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Badge } from "./ui/badge";

type RoundData = {
  id: string;
  name: string;
  phase: string;
  createdAt: { seconds: number, nanoseconds: number };
}

type ScoreData = {
  matchId: string;
  teams: { name: string; total: number }[];
  judgeName: string;
}

type MatchResult = {
    id: string;
    teams: { name: string; total: number }[];
    winner: string;
    judges: number;
}

export function GroupStageResults() {
    const [groupRounds, setGroupRounds] = useState<RoundData[]>([]);
    const [scores, setScores] = useState<ScoreData[]>([]);
    const [resultsPublished, setResultsPublished] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const roundsQuery = query(
            collection(db, "rounds"), 
            where("phase", "==", "Fase de Grupos")
        );
        const unsubscribeRounds = onSnapshot(roundsQuery, (snapshot) => {
            const rounds = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RoundData));
            // Sort client-side to avoid composite index
            rounds.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
            setGroupRounds(rounds);
        });

        const scoresQuery = query(collection(db, "scores"), orderBy("createdAt", "desc"));
        const unsubscribeScores = onSnapshot(scoresQuery, (snapshot) => {
            const scoresData = snapshot.docs.map(doc => doc.data() as ScoreData);
            setScores(scoresData);
            checkPublicationStatus();
        });
        
        const settingsRef = doc(db, "settings", "competition");
        const unsubscribeSettings = onSnapshot(settingsRef, (docSnap) => {
            if (docSnap.exists()) {
                setResultsPublished(docSnap.data().resultsPublished || false);
            }
            setLoading(false);
        });
        
        const checkPublicationStatus = async () => {
             const settingsSnap = await doc(db, "settings", "competition").get();
             if(settingsSnap.exists()){
                setResultsPublished(settingsSnap.data().resultsPublished || false);
             }
             setLoading(false);
        }


        return () => {
            unsubscribeRounds();
            unsubscribeScores();
            unsubscribeSettings();
        };
    }, []);

    const resultsByRound = groupRounds.map(round => {
        const roundScores = scores.filter(s => s.matchId === round.name);
        if (roundScores.length === 0) {
            return {
                id: round.id,
                name: round.name,
                match: null,
            };
        }

        const teamTotals: Record<string, number> = {};
        const judges = new Set<string>();

        roundScores.forEach(score => {
            judges.add(score.judgeName);
            score.teams.forEach(team => {
                if (!teamTotals[team.name]) teamTotals[team.name] = 0;
                teamTotals[team.name] += team.total;
            });
        });

        const teams = Object.entries(teamTotals).map(([name, total]) => ({ name, total }));
        const winner = teams.length === 0 ? 'N/A' : teams.reduce((a, b) => a.total > b.total ? a : b).name;

        return {
            id: round.id,
            name: round.name,
            match: {
                id: round.name,
                teams,
                winner,
                judges: judges.size,
            } as MatchResult,
        };
    });

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[200px]">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="ml-4">Cargando resultados de grupos...</p>
            </div>
        );
    }
    
    if (!resultsPublished) {
         return (
            <div className="text-center text-muted-foreground p-8 col-span-1 md:col-span-2 lg:col-span-3">
                <Card className="max-w-md mx-auto">
                    <CardHeader>
                        <CardTitle className="flex items-center justify-center gap-2"><EyeOff /> Resultados Ocultos</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p>Los resultados de la fase de grupos se publicarán pronto. ¡Estén atentos!</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (resultsByRound.length === 0) {
        return (
            <div className="text-center text-muted-foreground p-8">
                No hay rondas de fase de grupos configuradas o no se han registrado puntuaciones todavía.
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {resultsByRound.map(result => (
                <Card key={result.id}>
                    <CardHeader>
                        <CardTitle className="text-lg">{result.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                       {result.match ? (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Equipo</TableHead>
                                        <TableHead className="text-right">Puntaje Total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {result.match.teams.map(team => (
                                        <TableRow key={team.name} className={team.name === result.match?.winner ? "font-bold" : ""}>
                                            <TableCell className="flex items-center gap-2">
                                                {team.name}
                                                {team.name === result.match?.winner && <Trophy className="h-4 w-4 text-amber-500" />}
                                            </TableCell>
                                            <TableCell className="text-right text-lg">{team.total}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                       ) : (
                           <div className="text-center text-sm text-muted-foreground h-24 flex items-center justify-center">
                                Esperando resultados...
                           </div>
                       )}
                    </CardContent>
                </Card>
           ))}
        </div>
    );
}
