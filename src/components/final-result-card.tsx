

"use client";

import React, { useMemo } from "react";
import { Loader2, Trophy, Swords, EyeOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Badge } from "./ui/badge";

type ScoreData = {
  id: string;
  matchId: string;
  teams: { name: string; total: number }[];
  judgeName: string;
}

const getWinnerOfRound = (scores: ScoreData[], roundName: string): string | null => {
    const roundScores = scores.filter(s => s.matchId.startsWith(roundName));
    if (roundScores.length === 0) return null;

    const teamTotals: Record<string, number> = {};
    roundScores.forEach(score => {
        score.teams.forEach(team => {
            if (!teamTotals[team.name]) teamTotals[team.name] = 0;
            teamTotals[team.name] += team.total;
        });
    });

    const teams = Object.entries(teamTotals);
    if (teams.length === 0) return null;

    const winner = teams.reduce((a, b) => a[1] > b[1] ? a : b)[0];
    return winner;
};

interface FinalResultCardProps {
    scores: ScoreData[];
    resultsPublished: boolean;
    loading: boolean;
}

export function FinalResultCard({ scores, resultsPublished, loading }: FinalResultCardProps) {
    const finalMatch = useMemo(() => {
        const winnerSemifinal1 = getWinnerOfRound(scores, "Semifinal 1");
        const winnerSemifinal2 = getWinnerOfRound(scores, "Semifinal 2");

        const finalRoundScores = scores.filter(s => s.matchId.startsWith("FINAL"));

        if (finalRoundScores.length > 0) {
             const teamTotals: Record<string, number> = {};
            finalRoundScores.forEach(score => {
                score.teams.forEach(team => {
                    if (!teamTotals[team.name]) teamTotals[team.name] = 0;
                    teamTotals[team.name] += team.total;
                });
            });
            const teams = Object.entries(teamTotals).map(([name, total]) => ({ name, total }));
            const winner = teams.length > 0 ? teams.reduce((a, b) => a.total > b.total ? a : b) : null;

            return {
                teams,
                winner: winner ? winner.name : null,
                isTie: teams.length > 1 && teams[0].total === teams[1].total,
            }
        }
        
        if (winnerSemifinal1 && winnerSemifinal2) {
            return {
                teams: [
                    { name: winnerSemifinal1, total: 0 },
                    { name: winnerSemifinal2, total: 0 }
                ],
                winner: null,
                isTie: false,
            }
        }

        return null;

    }, [scores]);


    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline">Resultado FINAL</CardTitle>
                </CardHeader>
                <CardContent className="flex justify-center items-center h-24">
                     <Loader2 className="h-8 w-8 animate-spin" />
                </CardContent>
            </Card>
        );
    }
    
    if (!resultsPublished) {
         return (
            <Card>
                 <CardHeader>
                    <CardTitle className="font-headline">Resultado de la Gran Final</CardTitle>
                    <CardDescription>El enfrentamiento culminante del torneo.</CardDescription>
                </CardHeader>
                <CardContent className="text-center text-muted-foreground p-8">
                     <EyeOff className="mx-auto h-8 w-8 mb-2" />
                    <p>El resultado final se publicará pronto.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-primary border-2 shadow-lg">
            <CardHeader className="text-center">
                <CardTitle className="font-headline text-2xl md:text-3xl">Resultado de la Gran Final</CardTitle>
                <CardDescription>El enfrentamiento culminante del torneo.</CardDescription>
            </CardHeader>
            <CardContent>
                {finalMatch ? (
                     finalMatch.winner ? (
                         <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Equipo</TableHead>
                                    <TableHead className="text-right">Puntaje Final</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {finalMatch.teams.sort((a, b) => b.total - a.total).map(team => (
                                    <TableRow key={team.name} className={team.name === finalMatch.winner ? "font-bold text-lg" : ""}>
                                        <TableCell className="flex items-center gap-2">
                                            {team.name}
                                            {team.name === finalMatch.winner && <Trophy className="h-5 w-5 text-amber-500" />}
                                        </TableCell>
                                        <TableCell className="text-right text-xl">{team.total}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                     ) : (
                         <div className="text-center space-y-3 py-4">
                            <div className="flex items-center justify-center gap-4 text-xl md:text-2xl font-bold">
                                <span>{finalMatch.teams[0].name}</span>
                                <Swords className="h-8 w-8 text-primary"/>
                                <span>{finalMatch.teams[1].name}</span>
                            </div>
                            <Badge variant="outline">Final Pendiente</Badge>
                         </div>
                     )
                ) : (
                    <div className="text-center text-muted-foreground p-8">
                        Esperando a los ganadores de las semifinales para definir la final...
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
