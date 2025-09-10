
"use client";

import React from "react";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy, where, doc, getDoc } from "firebase/firestore";
import { Loader2, Trophy, EyeOff, CheckCircle, Swords } from "lucide-react";
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

type DrawnTeam = {
  id: string;
  name: string;
  round: string | null;
}

type MatchResult = {
    id: string;
    teams: { name: string; total: number }[];
    winner: string | null;
    isTie: boolean;
    judges: number;
    isBye?: boolean;
}

export function GroupStageResults() {
    const [groupRounds, setGroupRounds] = useState<RoundData[]>([]);
    const [scores, setScores] = useState<ScoreData[]>([]);
    const [drawnTeams, setDrawnTeams] = useState<DrawnTeam[]>([]);
    const [resultsPublished, setResultsPublished] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const roundsQuery = query(
            collection(db, "rounds"), 
            where("phase", "==", "Fase de Grupos")
        );
        const unsubscribeRounds = onSnapshot(roundsQuery, (snapshot) => {
            const rounds = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RoundData));
            rounds.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
            setGroupRounds(rounds);
        });

        const scoresQuery = query(collection(db, "scores"), orderBy("createdAt", "desc"));
        const unsubscribeScores = onSnapshot(scoresQuery, (snapshot) => {
            const scoresData = snapshot.docs.map(doc => doc.data() as ScoreData);
            setScores(scoresData);
        });
        
        const drawStateRef = doc(db, "drawState", "liveDraw");
        const unsubscribeDrawState = onSnapshot(drawStateRef, (docSnap) => {
             if (docSnap.exists()) {
                const data = docSnap.data();
                setDrawnTeams(data.teams || []);
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
            unsubscribeDrawState();
        };
    }, []);

    const resultsByRound = groupRounds.map(round => {
        const roundScores = scores.filter(s => s.matchId === round.name);
        const teamsForRound = drawnTeams.filter(t => t.round === round.name).map(t => t.name);
        
        // Handle bye score
        const byeScore = scores.find(s => s.matchId.startsWith(`${round.name}-bye-`));
        if (byeScore) {
            const winnerTeam = byeScore.teams[0];
            return {
                id: round.id,
                name: round.name,
                match: {
                    id: round.name,
                    teams: [winnerTeam],
                    winner: winnerTeam.name,
                    isTie: false,
                    judges: 0,
                    isBye: true,
                } as MatchResult
            }
        }
        
        // Handle scored match
        if (roundScores.length > 0) {
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
            let winner: string | null = null;
            let isTie = false;

            if (teams.length > 0) {
                const maxScore = Math.max(...teams.map(t => t.total));
                const winners = teams.filter(t => t.total === maxScore);
                if (winners.length === 1) {
                    winner = winners[0].name;
                } else if (winners.length > 1) {
                    isTie = true;
                }
            }

            return {
                id: round.id,
                name: round.name,
                match: { id: round.name, teams, winner, isTie, judges: judges.size } as MatchResult,
            };
        }

        // Handle drawn but unscored match
        if (teamsForRound.length > 0) {
             return {
                id: round.id,
                name: round.name,
                match: {
                    id: round.name,
                    teams: teamsForRound.map(name => ({name, total: 0})),
                    winner: null,
                    isTie: false,
                    judges: 0,
                } as MatchResult,
             }
        }


        // No scores, no draw
        return { id: round.id, name: round.name, match: null };
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
            <div className="text-center text-muted-foreground p-8">
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

    if (resultsByRound.every(r => r.match === null)) {
        return (
            <div className="text-center text-muted-foreground p-8">
                No se ha realizado el sorteo de grupos o no se han registrado puntuaciones todavía.
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
                           result.match.isBye ? (
                             <div className="text-center text-sm h-24 flex flex-col items-center justify-center">
                                <p className="font-bold flex items-center gap-2">
                                     <Trophy className="h-4 w-4 text-amber-500" />
                                    {result.match.winner}
                                </p>
                                <Badge variant="secondary" className="mt-2">
                                     <CheckCircle className="h-3 w-3 mr-1"/>
                                     Avance Automático
                                </Badge>
                             </div>
                           ) : result.match.teams.length > 0 && result.match.teams.every(t => t.total === 0) ? (
                                <div className="text-sm h-24 flex flex-col items-center justify-center text-center">
                                    <div className="flex items-center gap-2 font-semibold">
                                        <span>{result.match.teams[0]?.name || 'Equipo 1'}</span>
                                        <Swords className="h-4 w-4 text-muted-foreground"/>
                                        <span>{result.match.teams[1]?.name || 'Equipo 2'}</span>
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
                           )
                       ) : (
                           <div className="text-center text-sm text-muted-foreground h-24 flex items-center justify-center">
                                Esperando sorteo...
                           </div>
                       )}
                    </CardContent>
                </Card>
           ))}
        </div>
    );
}
