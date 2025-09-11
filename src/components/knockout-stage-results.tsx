"use client";

import React, { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where, doc, orderBy } from "firebase/firestore";
import { Loader2, Trophy, EyeOff, CheckCircle, Swords, Folder } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
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

type DebateState = {
    currentRound: string;
    teams: { name: string }[];
}

type MatchResult = {
    id: string;
    teams: { name: string; total: number }[];
    winner: string | null;
    isTie: boolean;
    isBye?: boolean;
    isPending?: boolean;
}

const knockoutPhases = ["Fase de Finales"];

export function KnockoutStageResults() {
    const [knockoutRounds, setKnockoutRounds] = useState<RoundData[]>([]);
    const [scores, setScores] = useState<ScoreData[]>([]);
    const [debateState, setDebateState] = useState<DebateState | null>(null);
    const [resultsPublished, setResultsPublished] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const roundsQuery = query(
            collection(db, "rounds"), 
            where("phase", "in", knockoutPhases)
        );
        const unsubscribeRounds = onSnapshot(roundsQuery, (snapshot) => {
            const rounds = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RoundData));
            rounds.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
            setKnockoutRounds(rounds);
        });

        const scoresQuery = query(collection(db, "scores"), orderBy("createdAt", "desc"));
        const unsubscribeScores = onSnapshot(scoresQuery, (snapshot) => {
            const scoresData = snapshot.docs.map(doc => doc.data() as ScoreData);
            setScores(scoresData);
        });
        
        const debateStateRef = doc(db, "debateState", "current");
        const unsubscribeDebateState = onSnapshot(debateStateRef, (docSnap) => {
            if (docSnap.exists()) {
                setDebateState(docSnap.data() as DebateState);
            }
        });
        
        const settingsRef = doc(db, "settings", "competition");
        const unsubscribeSettings = onSnapshot(settingsRef, (docSnap) => {
            if (docSnap.exists()) {
                setResultsPublished(docSnap.data().resultsPublished || false);
            }
            setLoading(false);
        });

        return () => {
            unsubscribeRounds();
            unsubscribeScores();
            unsubscribeSettings();
            unsubscribeDebateState();
        };
    }, []);

    const resultsByRound = useMemo(() => {
        return knockoutRounds.map(round => {
            // Check for scores matching the round name
            const roundScores = scores.filter(s => s.matchId === round.name);

            // Handle bye scores that start with the round name
            const byeScore = scores.find(s => s.matchId.startsWith(`${round.name}-bye-`));
            if (byeScore) {
                const winnerTeam = byeScore.teams[0];
                return {
                    round: round,
                    match: {
                        id: round.name,
                        teams: [winnerTeam],
                        winner: winnerTeam.name,
                        isTie: false,
                        isBye: true
                    } as MatchResult
                };
            }

            // Handle normally scored match
            if (roundScores.length > 0) {
                const teamTotals: Record<string, number> = {};
                roundScores.forEach(score => {
                    score.teams.forEach(team => {
                        if (!teamTotals[team.name]) teamTotals[team.name] = 0;
                        teamTotals[team.name] += team.total;
                    });
                });
                
                const teams = Object.entries(teamTotals).map(([name, total]) => ({ name, total }));
                let winner: string | null = null;
                let isTie = false;

                if (teams.length > 0) {
                    const maxScore = Math.max(...teams.map(t => t.total));
                    const winners = teams.filter(t => t.total === maxScore);
                    if (winners.length === 1) winner = winners[0].name;
                    else isTie = true;
                }
                
                return {
                    round: round,
                    match: { id: round.name, teams, winner, isTie } as MatchResult
                };
            }

            // Handle pending match from debateState
            if (debateState?.currentRound === round.name && debateState.teams.length > 0) {
                 return {
                    round: round,
                    match: {
                        id: round.name,
                        teams: debateState.teams.map(t => ({ name: t.name, total: 0 })),
                        winner: null,
                        isTie: false,
                        isPending: true
                    } as MatchResult
                 };
            }

            // No scores or pending state for this round
            return { round: round, match: null };
        });
    }, [knockoutRounds, scores, debateState]);


    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[200px]">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="ml-4">Cargando resultados de finales...</p>
            </div>
        );
    }
    
    if (!resultsPublished) {
         return (
            <div className="text-center text-muted-foreground p-8">
                <Card className="max-w-md mx-auto">
                    <CardHeader>
                        <CardTitle className="flex items-center justify-center gap-2"><EyeOff /> Resultados Ocultos</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p>Los resultados de las fases finales se publicarán pronto. ¡Estén atentos!</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (resultsByRound.length === 0 || resultsByRound.every(r => r.match === null)) {
        return (
            <div className="text-center text-muted-foreground p-8">
                Aún no hay resultados para las fases finales.
            </div>
        );
    }

    return (
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {resultsByRound.map(({ round, match }) => (
                <Card key={round.id}>
                    <CardHeader>
                        <CardTitle className="text-lg">{round.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                       {match ? (
                           match.isBye ? (
                             <div className="text-center text-sm h-24 flex flex-col items-center justify-center">
                                <p className="font-bold flex items-center gap-2">
                                     <Trophy className="h-4 w-4 text-amber-500" />
                                    {match.winner}
                                </p>
                                <Badge variant="secondary" className="mt-2">
                                     <CheckCircle className="h-3 w-3 mr-1"/>
                                     Avance Automático
                                </Badge>
                             </div>
                           ) : match.isPending ? (
                                <div className="text-sm h-24 flex flex-col items-center justify-center text-center">
                                    <div className="flex items-center gap-2 font-semibold">
                                        <span>{match.teams[0]?.name || 'Equipo 1'}</span>
                                        <Swords className="h-4 w-4 text-muted-foreground"/>
                                        <span>{match.teams[1]?.name || 'Equipo 2'}</span>
                                    </div>
                                    <Badge variant="outline" className="mt-3">Pendiente</Badge>
                                </div>
                           ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Equipo</TableHead>
                                        <TableHead className="text-right">Puntaje Total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {match.teams.sort((a, b) => b.total - a.total).map(team => (
                                        <TableRow key={team.name} className={team.name === match.winner ? "font-bold" : ""}>
                                            <TableCell className="flex items-center gap-2">
                                                {team.name}
                                                {team.name === match.winner && <Trophy className="h-4 w-4 text-amber-500" />}
                                            </TableCell>
                                            <TableCell className="text-right text-lg">{team.total}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                           )
                       ) : (
                           <div className="text-center text-sm text-muted-foreground h-24 flex items-center justify-center">
                                Esperando enfrentamiento...
                           </div>
                       )}
                    </CardContent>
                </Card>
           ))}
        </div>
    );
}
