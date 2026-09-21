

"use client";

import React from "react";
import { useState, useEffect } from "react";
import { db } from "@/lib/supabase";
import { collection, onSnapshot, query, orderBy, where, doc } from "@/lib/documents";
import { Loader2, Trophy, EyeOff, CheckCircle, Swords } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Badge } from "./ui/badge";
import {
    DEFAULT_TOURNAMENT_FORMAT,
    type TournamentFormat,
    normalizeTournamentFormat,
} from "@/lib/tournament-format";

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
    qualifiers: string[];
    isTie: boolean;
    judges: number;
    isBye?: boolean;
}

interface GroupStageResultsProps {
    resultsPublished: boolean;
}

export function GroupStageResults({ resultsPublished }: GroupStageResultsProps) {
    const [groupRounds, setGroupRounds] = useState<RoundData[]>([]);
    const [scores, setScores] = useState<ScoreData[]>([]);
    const [drawnTeams, setDrawnTeams] = useState<DrawnTeam[]>([]);
    const [loading, setLoading] = useState(true);
    const [tournamentFormat, setTournamentFormat] = useState<TournamentFormat>(DEFAULT_TOURNAMENT_FORMAT);

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
        
        const settingsRef = doc(db, "settings", "competition");
        const unsubscribeSettings = onSnapshot(settingsRef, (docSnap) => {
            const data = docSnap.exists() ? docSnap.data() : {};
            setTournamentFormat(normalizeTournamentFormat(data.tournamentFormat));
        });

        const drawStateRef = doc(db, "drawState", "liveDraw");
        const unsubscribeDrawState = onSnapshot(drawStateRef, (docSnap) => {
             if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.phases) {
                    const groupPhase = data.phases.find((p: any) => p.name === 'Fase de Grupos');
                    if (groupPhase && groupPhase.matchups) {
                         const teamsFromMatchups = groupPhase.matchups.flatMap((m: any) => 
                            m.teams.map((teamName: string) => ({ id: teamName, name: teamName, round: m.roundName }))
                         );
                        setDrawnTeams(teamsFromMatchups);
                    }
                }
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
                    qualifiers: [winnerTeam.name],
                    isTie: false,
                    judges: 0,
                    isBye: true,
                } as MatchResult
            }
        }
        
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

            const teams = Object.entries(teamTotals)
                .map(([name, total]) => ({ name, total }))
                .sort((a, b) => b.total - a.total);
            let winner: string | null = null;
            let isTie = false;
            let qualifiers: string[] = [];

            if (teams.length > 0) {
                const maxScore = teams[0].total;
                const winners = teams.filter(t => t.total === maxScore);
                if (winners.length === 1) {
                    winner = winners[0].name;
                }

                const qualifierCount = tournamentFormat.groupStage.qualifiersPerRound;
                const cutoff = teams[qualifierCount - 1];
                const next = teams[qualifierCount];
                isTie = Boolean(cutoff && next && cutoff.total === next.total);
                qualifiers = isTie ? [] : teams.slice(0, qualifierCount).map(team => team.name);
            }

            return {
                id: round.id,
                name: round.name,
                match: { id: round.name, teams, winner, qualifiers, isTie, judges: judges.size } as MatchResult,
            };
        }

        if (teamsForRound.length > 0) {
             return {
                id: round.id,
                name: round.name,
                match: {
                    id: round.name,
                    teams: teamsForRound.map(name => ({name, total: 0})),
                    winner: null,
                    qualifiers: [],
                    isTie: false,
                    judges: 0,
                } as MatchResult,
             }
        }

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
                                        <TableRow key={team.name} className={result.match?.qualifiers.includes(team.name) ? "font-bold" : ""}>
                                            <TableCell className="flex items-center gap-2">
                                                {team.name}
                                                {team.name === result.match?.winner && <Trophy className="h-4 w-4 text-amber-500" />}
                                                {result.match?.qualifiers.includes(team.name) && (
                                                    <Badge variant="secondary" className="ml-1">Clasificado</Badge>
                                                )}
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
