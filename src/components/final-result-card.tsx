

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

type RoundData = {
  id: string;
  name: string;
  phase: string;
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

    return null;
};

interface FinalResultCardProps {
    scores: ScoreData[];
    rounds: RoundData[];
    resultsPublished: boolean;
    loading: boolean;
}

function isFinalPhase(phase: string) {
    const normalized = phase.trim().normalize("NFC").toLocaleLowerCase("es");
    return normalized.includes("final") && !normalized.includes("semifinal");
}

function resolveFinalRoundName(rounds: RoundData[], scores: ScoreData[]) {
    const explicitFinals = rounds.filter((round) => isFinalPhase(round.phase));
    if (explicitFinals.length > 0) {
        return explicitFinals[explicitFinals.length - 1].name;
    }

    const nonGroupNonSemifinal = rounds.filter((round) => {
        const normalized = round.phase.trim().normalize("NFC").toLocaleLowerCase("es");
        return !normalized.includes("grupo") && !normalized.includes("semifinal");
    });
    if (nonGroupNonSemifinal.length > 0) {
        return nonGroupNonSemifinal[nonGroupNonSemifinal.length - 1].name;
    }

    const scoredRoundNames = Array.from(new Set(
        scores.map((score) => score.matchId.split("-bye-")[0]).filter(Boolean),
    ));
    return scoredRoundNames[scoredRoundNames.length - 1] || null;
}

export function FinalResultCard({ scores, rounds, resultsPublished, loading }: FinalResultCardProps) {
    const { width, height } = useWindowSize();
    const [showConfetti, setShowConfetti] = useState(false);

    const finalRoundName = useMemo(
        () => resolveFinalRoundName(rounds, scores),
        [rounds, scores],
    );

    const finalWinner = useMemo(() => {
        return finalRoundName ? getWinnerOfRound(scores, finalRoundName) : null;
    }, [scores, finalRoundName]);
    
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
                        {finalRoundName
                            ? `Esperando el resultado de ${finalRoundName} para coronar al campeón...`
                            : "Esperando que se configure la ronda final..."}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

