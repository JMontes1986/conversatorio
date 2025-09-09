
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
import { doc, setDoc, collection, query, onSnapshot, orderBy, getDoc } from 'firebase/firestore';
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup } from "@/components/ui/select";
import { nanoid } from 'nanoid';

const DEBATE_STATE_DOC_ID = "current";
const DRAW_STATE_DOC_ID = "liveDraw";

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
    judgeName: string;
    teams: { name: string; total: number }[];
}
interface RoundData {
    id: string;
    name: string;
    phase: string;
}
type DrawTeam = {
  id: string;
  name: string;
  round: string | null;
};
type DrawState = {
    teams: DrawTeam[];
    rounds: RoundData[];
    activeTab?: string;
};


function getWinnersOfRound(scores: ScoreData[], roundName: string): string[] {
    const roundScores = scores.filter(score => score.matchId.startsWith(roundName));

    const matches: Record<string, { teamTotals: Record<string, number> }> = {};

    roundScores.forEach(score => {
        const teamNames = score.teams.map(t => t.name).sort().join(' vs ');
        if (!matches[teamNames]) {
            matches[teamNames] = { teamTotals: {} };
        }
        score.teams.forEach(team => {
            if (!matches[teamNames].teamTotals[team.name]) {
                matches[teamNames].teamTotals[team.name] = 0;
            }
            matches[teamNames].teamTotals[team.name] += team.total;
        });
    });
    
    const winners: string[] = [];
    Object.values(matches).forEach(match => {
        const entries = Object.entries(match.teamTotals);
        if (entries.length > 0) {
            const winner = entries.reduce((a, b) => a[1] > b[1] ? a : b)[0];
            winners.push(winner);
        }
    });

    return winners;
}


function getTopScoringTeamsFromPhase(scores: ScoreData[], phaseRounds: RoundData[], limit: number): string[] {
    const phaseRoundNames = phaseRounds.map(r => r.name);
    const phaseScores = scores.filter(s => phaseRoundNames.includes(s.matchId));

    const teamTotals: Record<string, number> = {};

    phaseScores.forEach(score => {
        score.teams.forEach(team => {
            if (!teamTotals[team.name]) {
                teamTotals[team.name] = 0;
            }
            teamTotals[team.name] += team.total;
        });
    });

    return Object.entries(teamTotals)
        .sort(([, scoreA], [, scoreB]) => scoreB - scoreA)
        .slice(0, limit)
        .map(([teamName]) => teamName);
}


export function CompetitionSettings({ registeredSchools = [], allScores = [] }: { registeredSchools?: SchoolData[], allScores?: ScoreData[] }) {
    const { toast } = useToast();
    const [currentRound, setCurrentRound] = useState('');
    const [teams, setTeams] = useState<Team[]>([{ id: nanoid(), name: '' }, { id: nanoid(), name: '' }]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isAutoFilled, setIsAutoFilled] = useState(false);
    const [debateRounds, setDebateRounds] = useState<RoundData[]>([]);
    const [loadingRounds, setLoadingRounds] = useState(true);
    const [drawState, setDrawState] = useState<DrawState | null>(null);


    useEffect(() => {
        setLoadingRounds(true);
        const roundsQuery = query(collection(db, "rounds"), orderBy("createdAt", "asc"));
        const unsubscribeRounds = onSnapshot(roundsQuery, (snapshot) => {
            const roundsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RoundData));
            setDebateRounds(roundsData);
            setLoadingRounds(false);
        }, (error) => {
            console.error("Error fetching rounds:", error);
            setLoadingRounds(false);
        });

        const drawStateRef = doc(db, "drawState", DRAW_STATE_DOC_ID);
        const unsubscribeDrawState = onSnapshot(drawStateRef, (docSnap) => {
            if (docSnap.exists()) {
                setDrawState(docSnap.data() as DrawState);
            }
        });

        return () => {
            unsubscribeRounds();
            unsubscribeDrawState();
        };
    }, []);
    
    const roundsByPhase = useMemo(() => {
        const grouped = debateRounds.reduce((acc, round) => {
            const phase = round.phase || 'General';
            if (!acc[phase]) {
                acc[phase] = [];
            }
            acc[phase].push(round);
            return acc;
        }, {} as Record<string, RoundData[]>);
        
        const sortedPhases = Object.keys(grouped).sort((a,b) => {
            if (a === 'General') return -1;
            if (b === 'General') return 1;
            return a.localeCompare(b);
        });
        
        const result: Record<string, RoundData[]> = {};
        sortedPhases.forEach(phase => {
            result[phase] = grouped[phase];
        });
        return result;

    }, [debateRounds]);

    const handleRoundChange = useCallback((roundName: string) => {
        setCurrentRound(roundName);
        const selectedRoundData = debateRounds.find(r => r.name === roundName);
        
        let qualifiedTeams: string[] = [];

        // Check draw state first
        if (drawState && drawState.teams) {
            const teamsFromDraw = drawState.teams.filter(t => t.round === roundName).map(t => t.name);
            if (teamsFromDraw.length > 0) {
                qualifiedTeams = teamsFromDraw;
            }
        }

        // If not found in draw, check advanced rounds logic
        if (qualifiedTeams.length === 0 && selectedRoundData) {
            if (selectedRoundData.phase === "Cuartos de Final") {
                 const groupStageRounds = debateRounds.filter(r => r.phase === "Fase de Grupos");
                 qualifiedTeams = getTopScoringTeamsFromPhase(allScores, groupStageRounds, 8);
            } else {
                 const roundDependencies: Record<string, string> = {
                    "Semifinal": "Cuartos de Final",
                    "Final": "Semifinal"
                };
                const previousRoundPhase = roundDependencies[selectedRoundData.phase];
                if (previousRoundPhase) {
                    const previousRounds = debateRounds.filter(r => r.phase === previousRoundPhase);
                    qualifiedTeams = previousRounds.flatMap(r => getWinnersOfRound(allScores, r.name));
                }
            }
        }
        
        if (qualifiedTeams.length > 0) {
             setIsAutoFilled(true);
             setTeams(qualifiedTeams.map(name => ({ id: nanoid(), name })));
             toast({ title: "Equipos Llenados Automáticamente", description: `Los equipos para ${roundName} han sido cargados.` });
        } else {
            setIsAutoFilled(false);
            setTeams([{ id: nanoid(), name: '' }, { id: nanoid(), name: '' }]);
        }

    }, [allScores, toast, debateRounds, drawState]);

     const handleUpdateRound = async (e: React.FormEvent) => {
        e.preventDefault();
        const validTeams = teams.filter(t => t.name.trim() !== '');

        if (!currentRound || validTeams.length < 2) {
            toast({ variant: "destructive", title: "Error", description: "Por favor, seleccione una ronda y asegúrese de que haya al menos dos equipos." });
            return;
        }
        setIsSubmitting(true);
        try {
            const docRef = doc(db, "debateState", DEBATE_STATE_DOC_ID);
            await setDoc(docRef, { 
                currentRound,
                teams: validTeams.map(t => ({ name: t.name })) // Store only name
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
                        <Select onValueChange={handleRoundChange} value={currentRound} disabled={isSubmitting || loadingRounds}>
                            <SelectTrigger id="current-round">
                                <SelectValue placeholder={loadingRounds ? "Cargando rondas..." : "Seleccione la ronda actual"} />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.entries(roundsByPhase).map(([phase, rounds]) => (
                                    <SelectGroup key={phase}>
                                        <Label className="px-2 py-1.5 text-xs font-semibold">{phase}</Label>
                                        {rounds.map(round => (
                                            <SelectItem key={round.id} value={round.name}>{round.name}</SelectItem>
                                        ))}
                                    </SelectGroup>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-3">
                        <Label>Equipos Participantes</Label>
                        {teams.map((team, index) => (
                            <div key={team.id} className="flex items-center gap-2">
                                <Select onValueChange={(value) => handleTeamNameChange(team.id, value)} value={team.name} disabled={isSubmitting || isAutoFilled}>
                                    <SelectTrigger>
                                        <SelectValue placeholder={`Equipo ${index + 1}`} />
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

    