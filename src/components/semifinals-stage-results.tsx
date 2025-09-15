

"use client";

import React, { useMemo } from "react";
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

interface SemifinalsStageResultsProps {
    allScores: ScoreData[];
    allRounds: RoundData[];
    debateState: DebateState | null;
    resultsPublished: boolean;
    loading: boolean;
}

export function SemifinalsStageResults({ allScores, allRounds, debateState, resultsPublished, loading }: SemifinalsStageResultsProps) {

    const semifinalsResults = useMemo(() => {
        if (loading) return [];
        
        const semifinalsRoundNames = allRounds
            .filter(r => r.phase === "Fase de semifinales")
            .map(r => r.name);

        const semifinalsScores = allScores.filter(score => {
            return semifinalsRoundNames.some(roundName => score.matchId.startsWith(roundName));
        });

        const matches: Record<string, ScoreData[]> = {};
        semifinalsScores.forEach(score => {
            const matchId = score.matchId.split('-bye-')[0]; // Group bye scores with their round
            if (!matches[matchId]) {
                matches[matchId] = [];
            }
            matches[matchId].push(score);
        });

        const processedMatches: MatchResult[] = Object.entries(matches).map(([matchId, scores]) => {
            const teamTotals: Record<string, number> = {};
            
            if (scores.some(s => s.matchId.includes('-bye-'))) {
                 const byeScore = scores.find(s => s.matchId.includes('-bye-'))!;
                const team = byeScore.teams[0];
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
             const currentRoundData = allRounds.find(r => r.name === debateState.currentRound);
             if (currentRoundData && currentRoundData.phase === "Fase de semifinales") {
                const isAlreadyScored = processedMatches.some(match => match.id === debateState.currentRound);
                if (!isAlreadyScored) {
                    processedMatches.push({
                        id: debateState.currentRound,
                        teams: debateState.teams.map(t => ({ name: t.name, total: 0 })),
                        winner: null,
                        isTie: false,
                        isPending: true,
                    });
                }
            }
        }
        
        const roundOrder = allRounds.map(r => r.name);
        processedMatches.sort((a, b) => {
             return roundOrder.indexOf(a.id) - roundOrder.indexOf(b.id);
        });


        return processedMatches;

    }, [allScores, debateState, allRounds, loading]);


    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[200px]">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="ml-4">Cargando resultados de semifinales...</p>
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
                        <p>Los resultados de las semifinales se publicarán pronto. ¡Estén atentos!</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (semifinalsResults.length === 0) {
        return (
            <div className="text-center text-muted-foreground p-8">
                Aún no hay resultados para la fase de semifinales.
            </div>
        );
    }

    return (
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {semifinalsResults.map((match) => (
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
