

"use client";

import { useState, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, Save, AlertTriangle, PlusCircle, Trash2, Users, Shuffle, X } from "lucide-react";
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, where, doc, setDoc, getDoc } from 'firebase/firestore';
import { useToast } from "@/hooks/use-toast";
import { nanoid } from 'nanoid';
import { Input } from './ui/input';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';

const BRACKET_DOC_ID = "liveBracket";
const SETTINGS_DOC_ID = "competition";

type Team = {
  id: string;
  name: string;
};

type Participant = {
  id: string;
  name: string;
};

type Match = {
  id: string;
  participants: (Participant | null)[];
  nextMatchId?: string | null;
};

type BracketRound = {
  id: string;
  title: string;
  matches: Match[];
};

const TeamSelector = ({ onSelectTeam, availableTeams }: { onSelectTeam: (team: Team) => void, availableTeams: Team[] }) => (
    <PopoverContent className="p-0 w-56">
        <ScrollArea className="h-64">
            <div className="p-2 space-y-1">
                {availableTeams.length > 0 ? availableTeams.map(team => (
                    <Button
                        key={team.id}
                        variant="ghost"
                        className="w-full justify-start font-normal"
                        onClick={() => onSelectTeam(team)}
                    >
                        {team.name}
                    </Button>
                )) : <p className="text-sm text-muted-foreground p-2 text-center">No hay equipos disponibles</p>}
            </div>
        </ScrollArea>
    </PopoverContent>
);

export function BracketManagement() {
    const { toast } = useToast();
    const [allAvailableTeams, setAllAvailableTeams] = useState<Team[]>([]);
    const [bracketRounds, setBracketRounds] = useState<BracketRound[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const settingsRef = doc(db, "settings", SETTINGS_DOC_ID);
        const unsubscribeSettings = onSnapshot(settingsRef, async (settingsSnap) => {
            const settingsData = settingsSnap.exists() ? settingsSnap.data() : {};
            let teamsQuery;
            if (settingsData.registrationsClosed && settingsData.lockedInTeams) {
                const lockedInTeamIds = settingsData.lockedInTeams.map((t: any) => t.id);
                if (lockedInTeamIds.length > 0) {
                    teamsQuery = query(collection(db, "schools"), where('__name__', 'in', lockedInTeamIds));
                }
            } else {
                teamsQuery = query(collection(db, "schools"), where("status", "==", "Verificado"));
            }

            if (teamsQuery) {
                onSnapshot(teamsQuery, (snapshot) => {
                    const teamsData = snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().teamName }));
                    setAllAvailableTeams(teamsData);
                });
            } else {
                setAllAvailableTeams([]);
            }
        });

        const bracketDocRef = doc(db, "bracketState", BRACKET_DOC_ID);
        const unsubscribeBracket = onSnapshot(bracketDocRef, (docSnap) => {
            if (docSnap.exists()) {
                setBracketRounds(docSnap.data().bracketRounds || []);
            }
            setLoading(false);
        });

        return () => {
            unsubscribeSettings();
            unsubscribeBracket();
        };
    }, []);
    
    const handleAddRound = () => setBracketRounds([...bracketRounds, { id: nanoid(), title: `Ronda ${bracketRounds.length + 1}`, matches: [] }]);
    const handleRemoveRound = (roundId: string) => setBracketRounds(bracketRounds.filter(r => r.id !== roundId));
    const handleRoundTitleChange = (roundId: string, newTitle: string) => setBracketRounds(bracketRounds.map(r => r.id === roundId ? { ...r, title: newTitle } : r));
    const handleAddMatch = (roundId: string) => setBracketRounds(bracketRounds.map(r => r.id === roundId ? { ...r, matches: [...r.matches, { id: nanoid(), participants: [null, null] }] } : r));
    const handleRemoveMatch = (roundId: string, matchId: string) => setBracketRounds(bracketRounds.map(r => r.id === roundId ? { ...r, matches: r.matches.filter(m => m.id !== matchId) } : r));

    const handleAssignTeam = (roundId: string, matchId: string, participantIndex: number, team: Team) => {
        setBracketRounds(bracketRounds.map(r => {
            if (r.id === roundId) {
                return { ...r, matches: r.matches.map(m => {
                    if (m.id === matchId) {
                        const newParticipants = [...m.participants];
                        newParticipants[participantIndex] = { id: team.id, name: team.name };
                        return { ...m, participants: newParticipants };
                    }
                    return m;
                })};
            }
            return r;
        }));
    };
    
    const handleUnassignTeam = (roundId: string, matchId: string, participantIndex: number) => {
         setBracketRounds(bracketRounds.map(r => {
            if (r.id === roundId) {
                return { ...r, matches: r.matches.map(m => {
                    if (m.id === matchId) {
                        const newParticipants = [...m.participants];
                        newParticipants[participantIndex] = null;
                        return { ...m, participants: newParticipants };
                    }
                    return m;
                })};
            }
            return r;
        }));
    };

    const handleAddParticipantSlot = (roundId: string, matchId: string) => {
         setBracketRounds(bracketRounds.map(r => {
            if (r.id === roundId) {
                return { ...r, matches: r.matches.map(m => {
                    if (m.id === matchId) {
                        return { ...m, participants: [...m.participants, null] };
                    }
                    return m;
                })};
            }
            return r;
        }));
    }

    const handleRemoveParticipantSlot = (roundId: string, matchId: string, participantIndex: number) => {
         setBracketRounds(bracketRounds.map(r => {
            if (r.id === roundId) {
                return { ...r, matches: r.matches.map(m => {
                    if (m.id === matchId) {
                        // Prevent removing slots if it would leave fewer than 2
                        if (m.participants.length <= 2) {
                            toast({ variant: "destructive", title: "Acción no permitida", description: "Un partido debe tener al menos 2 participantes." });
                            return m;
                        }
                        const newParticipants = [...m.participants];
                        newParticipants.splice(participantIndex, 1);
                        return { ...m, participants: newParticipants };
                    }
                    return m;
                })};
            }
            return r;
        }));
    }


    const handleShuffleTeams = (roundId: string) => {
        const teamsForThisRound = bracketRounds
            .find(r => r.id === roundId)?.matches
            .flatMap(m => m.participants)
            .filter((p): p is Participant => p !== null) || [];
        
        const shuffled = [...teamsForThisRound].sort(() => Math.random() - 0.5);

        let teamIndex = 0;
        const newRounds = bracketRounds.map(r => {
            if (r.id === roundId) {
                return {
                    ...r,
                    matches: r.matches.map(m => {
                        const newParticipants = m.participants.map(() => {
                           const team = shuffled[teamIndex];
                           teamIndex++;
                           return team || null;
                        });
                        return { ...m, participants: newParticipants };
                    })
                };
            }
            return r;
        });
        setBracketRounds(newRounds);
    };

    const handleSaveBracket = async () => {
        setIsSubmitting(true);
        const linkedRounds = bracketRounds.map((round, roundIndex) => {
            if (roundIndex < bracketRounds.length - 1) {
                const nextRound = bracketRounds[roundIndex + 1];
                return { ...round, matches: round.matches.map((match, matchIndex) => ({ ...match, nextMatchId: nextRound.matches[Math.floor(matchIndex / 2)]?.id || null })) };
            }
            return round;
        });
        try {
            await setDoc(doc(db, "bracketState", BRACKET_DOC_ID), { bracketRounds: linkedRounds });
            toast({ title: "Bracket Guardado", description: "La estructura del bracket ha sido guardada exitosamente." });
        } catch (error) {
            console.error("Error saving bracket:", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudo guardar el bracket." });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    // This function returns available teams for a SPECIFIC slot, excluding teams already in the SAME match.
    const getAvailableTeamsForSlot = (roundId: string, matchId: string) => {
        const currentMatch = bracketRounds.find(r => r.id === roundId)?.matches.find(m => m.id === matchId);
        const teamsInCurrentMatch = new Set(currentMatch?.participants.map(p => p?.id).filter(Boolean));
        return allAvailableTeams.filter(t => !teamsInCurrentMatch.has(t.id));
    };


    if (loading) {
        return <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Gestión del Bracket</CardTitle>
                <CardDescription>Organice visualmente los enfrentamientos del torneo. Asigne equipos a cada partido en las diferentes rondas.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col gap-8">
                    {bracketRounds.map(round => (
                        <div key={round.id} className="space-y-4 p-4 border rounded-lg">
                            <div className="flex items-center gap-4 justify-between">
                                <Input value={round.title} onChange={(e) => handleRoundTitleChange(round.id, e.target.value)} className="text-lg font-bold flex-grow" />
                                <Button size="icon" variant="ghost" onClick={() => handleRemoveRound(round.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {round.matches.map(match => (
                                    <Card key={match.id} className="p-4 pt-8 space-y-2 bg-secondary/30 relative group">
                                        {match.participants.map((participant, index) => (
                                            <div key={index} className="flex items-center gap-1">
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <Button variant="outline" className="w-full justify-start font-normal text-left h-10 truncate">
                                                            {participant ? participant.name : <span className="text-muted-foreground">Asignar Equipo...</span>}
                                                        </Button>
                                                    </PopoverTrigger>
                                                     <PopoverContent className="p-0 w-auto">
                                                        {participant ? (
                                                            <Button variant="destructive" size="sm" className="w-full" onClick={() => handleUnassignTeam(round.id, match.id, index)}>Desasignar</Button>
                                                        ) : (
                                                            <TeamSelector onSelectTeam={(team) => handleAssignTeam(round.id, match.id, index, team)} availableTeams={allAvailableTeams} />
                                                        )}
                                                    </PopoverContent>
                                                </Popover>
                                                <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => handleRemoveParticipantSlot(round.id, match.id, index)}>
                                                    <X className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </div>
                                        ))}
                                         <Button size="xs" variant="ghost" className="w-full mt-2 text-xs" onClick={() => handleAddParticipantSlot(round.id, match.id)}>
                                            <PlusCircle className="h-3 w-3 mr-1" /> Añadir Equipo al Partido
                                        </Button>
                                        <Button size="icon" variant="ghost" className="absolute top-1 right-1 h-6 w-6" onClick={() => handleRemoveMatch(round.id, match.id)}>
                                            <X className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </Card>
                                ))}
                            </div>
                            <div className="flex items-center gap-2 mt-4">
                                <Button variant="outline" size="sm" onClick={() => handleAddMatch(round.id)}><PlusCircle className="mr-2 h-4 w-4" /> Añadir Partido</Button>
                                {round.matches.length > 0 && round.matches.every(m => m.participants.every(p => p !== null)) && (
                                    <Button variant="secondary" size="sm" onClick={() => handleShuffleTeams(round.id)}><Shuffle className="mr-2 h-4 w-4" /> Mezclar Equipos</Button>
                                )}
                            </div>
                        </div>
                    ))}
                    <div className="pt-4">
                        <Button variant="secondary" onClick={handleAddRound}><PlusCircle className="mr-2 h-4 w-4" /> Añadir Ronda</Button>
                    </div>
                </div>

                 <Separator className="my-8" />
                 <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        Guarde los cambios para que sean visibles públicamente en el marcador.
                    </p>
                    <Button onClick={handleSaveBracket} disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Guardar Bracket
                    </Button>
                 </div>
            </CardContent>
        </Card>
    );
}
