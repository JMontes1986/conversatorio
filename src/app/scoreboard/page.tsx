

"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy, doc } from 'firebase/firestore';
import { TournamentBracket } from "@/components/tournament-bracket";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GroupStageResults } from "@/components/group-stage-results";
import { FinalResultCard } from "@/components/final-result-card";
import { SemifinalsStageResults } from "@/components/semifinals-stage-results";
import { KnockoutStageResults } from '@/components/knockout-stage-results';
import { Loader2 } from 'lucide-react';

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

type PublishedResults = {
    groupStage: boolean;
    semifinals: boolean;
    finals: boolean;
}

export default function ScoreboardPage() {
    const [allScores, setAllScores] = useState<ScoreData[]>([]);
    const [allRounds, setAllRounds] = useState<RoundData[]>([]);
    const [debateState, setDebateState] = useState<DebateState | null>(null);
    const [publishedResults, setPublishedResults] = useState<PublishedResults>({
        groupStage: false,
        semifinals: false,
        finals: false,
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const scoresQuery = query(collection(db, "scores"), orderBy("createdAt", "desc"));
        const unsubscribeScores = onSnapshot(scoresQuery, (snapshot) => {
            setAllScores(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ScoreData)));
        });

        const roundsQuery = query(collection(db, "rounds"), orderBy("createdAt", "asc"));
        const unsubscribeRounds = onSnapshot(roundsQuery, (snapshot) => {
            setAllRounds(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RoundData)));
        });
        
        const debateStateRef = doc(db, "debateState", "current");
        const unsubscribeDebateState = onSnapshot(debateStateRef, (docSnap) => {
            setDebateState(docSnap.exists() ? (docSnap.data() as DebateState) : null);
        });
        
        const settingsRef = doc(db, "settings", "competition");
        const unsubscribeSettings = onSnapshot(settingsRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                 setPublishedResults({
                    groupStage: data.groupStageResultsPublished || false,
                    semifinals: data.semifinalsResultsPublished || false,
                    finals: data.finalsResultsPublished || false,
                });
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

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="container mx-auto py-10 px-4 md:px-6">
            <div className="mb-8">
                <h1 className="font-headline text-3xl md:text-4xl font-bold">
                    Marcador de la Competencia
                </h1>
                <p className="text-muted-foreground mt-2">
                    Siga el progreso del torneo en tiempo real, desde la fase de grupos hasta la final.
                </p>
            </div>
            
            <div className="space-y-8">
                 <Card>
                    <CardHeader>
                        <CardTitle className="font-headline">Resultados de la Fase de Grupos</CardTitle>
                        <CardDescription>Puntuaciones de las rondas iniciales.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <GroupStageResults resultsPublished={publishedResults.groupStage} />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="font-headline">Resultados de Semifinales</CardTitle>
                        <CardDescription>Puntuaciones de las rondas que definen a los finalistas.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <SemifinalsStageResults 
                             allScores={allScores}
                             allRounds={allRounds}
                             debateState={debateState}
                             resultsPublished={publishedResults.semifinals}
                             loading={loading}
                        />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="font-headline">Resultados Fase de Finales</CardTitle>
                        <CardDescription>Puntuaciones de Cuartos, Semifinales y Final.</CardDescription>
                    </CardHeader>
                    <CardContent>
                       <KnockoutStageResults 
                             allScores={allScores}
                             allRounds={allRounds}
                             debateState={debateState}
                             resultsPublished={publishedResults.finals}
                             loading={loading}
                        />
                    </CardContent>
                </Card>

                <FinalResultCard scores={allScores} resultsPublished={publishedResults.finals} loading={loading} />
                
                <TournamentBracket />

            </div>
        </div>
    );
}
