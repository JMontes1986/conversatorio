

"use client";

import React, { useMemo, useState, useEffect } from "react";
import { Loader2, Trophy, EyeOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import Confetti from 'react-confetti';
import { useWindowSize } from "@/hooks/use-window-size";


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
    
    const maxScore = Math.max(...teams.map(([, score]) => score));
    const winners = teams.filter(([, score]) => score === maxScore);
    
    if (winners.length === 1) {
        return winners[0][0];
    }

    return null; // Tie or no winner
};

interface FinalResultCardProps {
    scores: ScoreData[];
    resultsPublished: boolean;
    loading: boolean;
}

export function FinalResultCard({ scores, resultsPublished, loading }: FinalResultCardProps) {
    const { width, height } = useWindowSize();
    const [showConfetti, setShowConfetti] = useState(false);

    const finalWinner = useMemo(() => {
        return getWinnerOfRound(scores, "Ronda 8");
    }, [scores]);
    
    useEffect(() => {
        if (finalWinner && resultsPublished) {
            setShowConfetti(true);
            const timer = setTimeout(() => {
                setShowConfetti(false);
            }, 8000); // Show confetti for 8 seconds
            return () => clearTimeout(timer);
        }
    }, [finalWinner, resultsPublished]);


    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline">Resultado de la Gran Final</CardTitle>
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
        <Card className="border-primary border-2 shadow-lg overflow-hidden">
            {showConfetti && <Confetti width={width} height={height} recycle={false} numberOfPieces={500} />}
            <CardHeader className="text-center">
                <CardTitle className="font-headline text-2xl md:text-3xl">Gran Final</CardTitle>
                <CardDescription>El enfrentamiento culminante del torneo.</CardDescription>
            </CardHeader>
            <CardContent>
                {finalWinner ? (
                    <div className="flex flex-col items-center justify-center text-center p-6 space-y-4">
                        <Trophy className="h-20 w-20 text-amber-500 animate-pulse" />
                        <p className="text-muted-foreground">Campeón del Conversatorio Colgemelli</p>
                        <h3 className="text-4xl font-bold font-headline">{finalWinner}</h3>
                    </div>
                ) : (
                    <div className="text-center text-muted-foreground p-8">
                        Esperando el resultado de la Ronda 8 para coronar al campeón...
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

