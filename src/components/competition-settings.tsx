
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Loader2, Send, Plus, Trash2 } from "lucide-react";
import { db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { nanoid } from 'nanoid';

const DEBATE_STATE_DOC_ID = "current";

const advancedRounds = ["Cuartos de Final", "Semifinal", "Final"];

interface Team {
    id: string;
    name: string;
}
interface SchoolData {
    id: string;
    schoolName: string;
    teamName: string;
}
interface ScoreData {
    id: string;
    matchId: string;
    teams: { name: string; total: number }[];
}


function getWinnersOfRound(scores: ScoreData[], roundName: string): string[] {
    const roundScores = scores.filter(s => s.matchId === roundName);
    
    const teamTotals: Record<string, number> = {};
    
    roundScores.forEach(score => {
        score.teams.forEach(team => {
            if (!teamTotals[team.name]) {
                teamTotals[team.name] = 0;
            }
            teamTotals[team.name] += team.total;
        });
    });

    const matches: Record<string, { name: string; total: number }[][]> = {};
    roundScores.forEach(s => {
        const key = s.teams.map(t => t.name).sort().join('-');
        if (!matches[key]) matches[key] = [];
        matches[key].push(s.teams);
    });

    const winners: string[] = [];
    Object.values(matches).forEach(matchJudgements => {
        const matchTotals: Record<string, number> = {};
        matchJudgements.forEach(judgement => {
            judgement.forEach(team => {
                 if (!matchTotals[team.name]) matchTotals[team.name] = 0;
                 matchTotals[team.name] += team.total;
            });
        });
        
        let winner = '';
        let maxScore = -1;
        for (const [teamName, total] of Object.entries(matchTotals)) {
            if (total > maxScore) {
                maxScore = total;
                winner = teamName;
            }
        }
        if (winner) winners.push(winner);
    });
    
    return winners;
}


export function CompetitionSettings({ registeredSchools = [], allScores = [] }: { registeredSchools?: SchoolData[], allScores?: ScoreData[] }) {
    const { toast } = useToast();
    const [currentRound, setCurrentRound] = useState('');
    const [teams, setTeams] = useState<Team[]>([{ id: nanoid(), name: '' }, { id: nanoid(), name: '' }]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isAutoFilled, setIsAutoFilled] = useState(false);
    
    const debateRounds = useMemo(() => {
        const numTeams = registeredSchools.length;
        if (numTeams === 0) return [...advancedRounds];

        // Assuming 2 teams per match in group stage
        const groupRoundsCount = Math.ceil(numTeams / 2);
        const groupRounds = Array.from({ length: groupRoundsCount }, (_, i) => `Ronda ${i + 1}`);

        return [...groupRounds, ...advancedRounds];
    }, [registeredSchools]);

    const handleRoundChange = useCallback((round: string) => {
        setCurrentRound(round);
        if (advancedRounds.includes(round)) {
            setIsAutoFilled(true);
            let winners: string[] = [];
            
            if (round === "Cuartos de Final") {
                 const groupStageRounds = debateRounds.filter(r => r.startsWith("Ronda"));
                 const allWinners = groupStageRounds.flatMap(r => getWinnersOfRound(allScores, r));
                 winners = [...new Set(allWinners)];

            } else {
                 const roundDependencies: Record<string, string> = {
                    "Semifinal": "Cuartos de Final",
                    "Final": "Semifinal"
                };
                const previousRound = roundDependencies[round];
                if (previousRound) {
                    winners = getWinnersOfRound(allScores, previousRound);
                }
            }
            
            if (winners.length > 0) {
                 setTeams(winners.map((name) => ({ id: nanoid(), name })));
                 toast({ title: "Equipos Llenados Automáticamente", description: `Los ganadores de la ronda anterior han sido seleccionados para ${round}.`});
            } else {
                 setTeams([{ id: nanoid(), name: '' }, { id: nanoid(), name: '' }]);
                 toast({ variant: "destructive", title: "No se encontraron ganadores", description: `No se pudieron determinar los ganadores de la ronda anterior.`});
            }

        } else {
            setIsAutoFilled(false);
            setTeams([{ id: nanoid(), name: '' }, { id: nanoid(), name: '' }]);
        }
    }, [allScores, toast, debateRounds]);

     const handleUpdateRound = async (e: React.FormEvent) => {
        e.preventDefault();
        const validTeams = teams.filter(t => t.name.trim() !== '');

        if (!currentRound || validTeams.length < 2) {
            toast({ variant: "destructive", title: "Error", description: "Por favor, seleccione una ronda y al menos dos equipos." });
            return;
        }
        setIsSubmitting(true);
        try {
            const docRef = doc(db, "debateState", DEBATE_STATE_DOC_ID);
            await setDoc(docRef, { 
                currentRound,
                teams: validTeams
            }, { merge: true });
            toast({ title: "Configuración Actualizada", description: `La ronda activa es ${currentRound}.` });
        } catch (error) {
            console.error("Error updating round:", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar la configuración." });
        } finally {
            setIsSubmitting(false);
        }
    }
    
    const handleTeamNameChange = (id: string, name: string) => {
        setTeams(teams.map(team => team.id === id ? { ...team, name } : team));
    };

    const addTeam = () => {
        setTeams([...teams, { id: nanoid(), name: '' }]);
    };

    const removeTeam = (id: string) => {
        if (teams.length > 2) {
            setTeams(teams.filter(team => team.id !== id));
        } else {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Debe haber al menos dos equipos.'
            });
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Ajustes de la Competencia</CardTitle>
                <CardDescription>Configuración de la ronda activa y los equipos que se enfrentan.</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleUpdateRound} className="space-y-4 max-w-lg">
                    <div className="space-y-2">
                        <Label htmlFor="current-round">Ronda de Debate Activa</Label>
                        <Select onValueChange={handleRoundChange} value={currentRound} disabled={isSubmitting}>
                            <SelectTrigger id="current-round">
                                <SelectValue placeholder="Seleccione la ronda actual" />
                            </SelectTrigger>
                            <SelectContent>
                                {debateRounds.map(round => <SelectItem key={round} value={round}>{round}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-3">
                        <Label>Equipos Participantes</Label>
                        {teams.map((team, index) => (
                            <div key={team.id} className="flex items-center gap-2">
                                <Select onValueChange={(value) => handleTeamNameChange(team.id, value)} value={team.name} disabled={isSubmitting || isAutoFilled}>
                                    <SelectTrigger>
                                        <SelectValue placeholder={`Seleccione Equipo ${index + 1}`} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {registeredSchools.map(school => (
                                            <SelectItem key={school.id} value={school.teamName}>
                                                {school.teamName} ({school.schoolName})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <Button type="button" variant="ghost" size="icon" onClick={() => removeTeam(team.id)} disabled={teams.length <= 2 || isSubmitting || isAutoFilled}>
                                    <Trash2 className="h-4 w-4 text-destructive"/>
                                </Button>
                            </div>
                        ))}
                        <Button type="button" variant="outline" size="sm" onClick={addTeam} disabled={isSubmitting || isAutoFilled}>
                            <Plus className="mr-2 h-4 w-4" /> Añadir Equipo
                        </Button>
                        {isAutoFilled && <p className="text-xs text-muted-foreground">La selección de equipos es automática para esta ronda.</p>}
                    </div>
                    <Button type="submit" disabled={isSubmitting || !currentRound}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                        Actualizar Configuración
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
