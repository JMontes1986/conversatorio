"use client";

import React, { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where, doc, orderBy } from "firebase/firestore";
import { Loader2, Trophy, EyeOff, CheckCircle, Swords, Folder } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Badge } from "./ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";

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
    judges: number;
    isBye?: boolean;
    isPending?: boolean;
}

const knockoutPhases = ["Cuartos de Final", "Semifinal", "Final"];

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

    const resultsByPhase = useMemo(() => {
        const phases: Record<string, MatchResult[]> = {};
        
        knockoutPhases.forEach(phase => {
            const roundsInPhase = knockoutRounds.filter(r => r.phase === phase);
            const roundNamesInPhase = roundsInPhase.map(r => r.name);
            const phaseScores = scores.filter(s => roundNamesInPhase.includes(s.matchId.split('-bye-')[0]));
            
            const matches: Record<string, { scores: ScoreData[], roundName: string }> = {};

            phaseScores.forEach(score => {
                const matchIdentifier = score.matchId;
                if (!matches[matchIdentifier]) {
                    matches[matchIdentifier] = { scores: [], roundName: score.matchId };
                }
                matches[matchIdentifier].scores.push(score);
            });
            
            let matchResults: MatchResult[] = Object.entries(matches).map(([matchId, data]) => {
                const isBye = matchId.includes('-bye-');
                if (isBye) {
                     const winnerTeam = data.scores[0].teams[0];
                     return { id: matchId, teams: [winnerTeam], winner: winnerTeam.name, isTie: false, judges: 0, isBye: true };
                }

                const teamTotals: Record<string, number> = {};
                const judges = new Set<string>();

                data.scores.forEach(score => {
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
                    if (winners.length === 1) winner = winners[0].name;
                    else isTie = true;
                }
                return { id: matchId, teams, winner, isTie, judges: judges.size };
            });

            // Add pending match from debateState
            if (debateState && debateState.currentRound && roundNamesInPhase.includes(debateState.currentRound)) {
                const isAlreadyScored = scores.some(s => s.matchId === debateState.currentRound);
                if (!isAlreadyScored && debateState.teams.length > 0) {
                     matchResults.push({
                        id: debateState.currentRound,
                        teams: debateState.teams.map(t => ({ name: t.name, total: 0 })),
                        winner: null,
                        isTie: false,
                        judges: 0,
                        isPending: true,
                    });
                }
            }


            if(matchResults.length > 0) {
                phases[phase] = matchResults.sort((a,b) => a.id.localeCompare(b.id));
            }
        });

        return phases;
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

    if (Object.keys(resultsByPhase).length === 0) {
        return (
            <div className="text-center text-muted-foreground p-8">
                Aún no hay resultados para las fases finales.
            </div>
        );
    }

    return (
        <Accordion type="multiple" className="w-full space-y-4" defaultValue={knockoutPhases}>
            {knockoutPhases.map(phase => resultsByPhase[phase] && (
                <AccordionItem value={phase} key={phase}>
                    <Card>
                        <AccordionTrigger className="p-6">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Folder className="h-5 w-5"/>
                                {phase}
                            </CardTitle>
                        </AccordionTrigger>
                        <AccordionContent className="p-6 pt-0">
                           <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {resultsByPhase[phase].map((match) => (
                                <Card key={match.id} className="bg-secondary/50">
                                    <CardHeader>
                                        <CardTitle className="text-base text-center capitalize">{match.id.replace(/-/g, ' ')}</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        {match.isBye ? (
                                            <div className="text-center text-sm h-16 flex flex-col items-center justify-center">
                                                <p className="font-bold flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-500" />{match.winner}</p>
                                                <Badge variant="secondary" className="mt-2"><CheckCircle className="h-3 w-3 mr-1"/>Avance Automático</Badge>
                                            </div>
                                        ) : match.isPending ? (
                                            <div className="text-sm h-16 flex flex-col items-center justify-center text-center">
                                                <div className="flex items-center gap-2 font-semibold">
                                                    <span>{match.teams[0]?.name || 'Equipo 1'}</span>
                                                    <Swords className="h-4 w-4 text-muted-foreground"/>
                                                    <span>{match.teams[1]?.name || 'Equipo 2'}</span>
                                                </div>
                                                <Badge variant="outline" className="mt-3">Pendiente</Badge>
                                            </div>
                                        ) : (
                                            <Table>
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
                        </AccordionContent>
                    </Card>
                </AccordionItem>
            ))}
        </Accordion>
    );
}
