
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, doc, orderBy } from "firebase/firestore";
import { Loader2, Trophy, EyeOff, CheckCircle, Swords } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Badge } from "./ui/badge";

type ScoreData = {
  id: string;
  matchId: string;
  teams: { name: string; total: number }[];
  judgeName: string;
  createdAt: { seconds: number };
}

type RoundData = {
    id: string;
    name: string;
    phase: string;
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


export function KnockoutStageResults() {
    const [allScores, setAllScores] = useState<ScoreData[]>([]);
    const [allRounds, setAllRounds] = useState<RoundData[]>([]);
    const [debateState, setDebateState] = useState<DebateState | null>(null);
    const [resultsPublished, setResultsPublished] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const scoresQuery = query(collection(db, "scores"), orderBy("createdAt", "desc"));
        const unsubscribeScores = onSnapshot(scoresQuery, (snapshot) => {
            const scoresData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ScoreData));
            setAllScores(scoresData);
        });

        const roundsQuery = query(collection(db, "rounds"), orderBy("createdAt", "asc"));
        const unsubscribeRounds = onSnapshot(roundsQuery, (snapshot) => {
            const roundsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RoundData));
            setAllRounds(roundsData);
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
            unsubscribeScores();
            unsubscribeSettings();
            unsubscribeDebateState();
            unsubscribeRounds();
        };
    }, []);

    const finalStageResults = useMemo(() => {
        if (loading) return [];
        
        const groupRoundNames = allRounds
            .filter(r => r.phase === "Fase de Grupos")
            .map(r => r.name);

        const finalScores = allScores.filter(score => {
            // Check if the matchId exactly matches a group round name OR starts with a group round name (for byes)
            return !groupRoundNames.some(groupName => score.matchId.startsWith(groupName));
        });

        const matches: Record<string, ScoreData[]> = {};
        finalScores.forEach(score => {
            if (!matches[score.matchId]) {
                matches[score.matchId] = [];
            }
            matches[score.matchId].push(score);
        });

        const processedMatches: MatchResult[] = Object.entries(matches).map(([matchId, scores]) => {
            const teamTotals: Record<string, number> = {};
            
            if (matchId.includes('-bye-')) {
                const team = scores[0].teams[0];
                return {
                    id: matchId,
                    teams: [{ name: team.name, total: team.total }],
                    winner: team.name,
                    isTie: false,
                    isBye: true,
                };
            }

            scores.forEach(score => {
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
                if (winners.length === 1) {
                    winner = winners[0].name;
                } else {
                    isTie = true;
                }
            }

            return { id: matchId, teams, winner, isTie };
        });

        if (debateState?.currentRound && debateState.teams.length > 0) {
            const isCurrentRoundFromGroups = groupRoundNames.includes(debateState.currentRound);
            const isAlreadyScored = processedMatches.some(match => match.id === debateState.currentRound);

            if (!isCurrentRoundFromGroups && !isAlreadyScored) {
                processedMatches.push({
                    id: debateState.currentRound,
                    teams: debateState.teams.map(t => ({ name: t.name, total: 0 })),
                    winner: null,
                    isTie: false,
                    isPending: true,
                });
            }
        }
        
        processedMatches.sort((a, b) => {
             const aDate = matches[a.id]?.[0]?.createdAt.seconds || Infinity;
             const bDate = matches[b.id]?.[0]?.createdAt.seconds || Infinity;
             return aDate - bDate;
        });


        return processedMatches;

    }, [allScores, debateState, allRounds, loading]);


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

    if (finalStageResults.length === 0) {
        return (
            <div className="text-center text-muted-foreground p-8">
                Aún no hay resultados para las fases finales.
            </div>
        );
    }

    return (
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {finalStageResults.map((match) => (
                <Card key={match.id}>
                    <CardHeader>
                        <CardTitle className="text-lg capitalize">{match.id.replace(/-/g, ' ')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                       {match.isBye ? (
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
                                <Badge variant="outline" className="mt-3">Pendiente de Resultado</Badge>
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
                       )}
                    </CardContent>
                </Card>
           ))}
        </div>
    );
}
