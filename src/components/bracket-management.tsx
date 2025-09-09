
"use client";

import { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, Save, AlertTriangle, PlusCircle, Trash2 } from "lucide-react";
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy, doc, setDoc } from 'firebase/firestore';
import { useToast } from "@/hooks/use-toast";
import { nanoid } from 'nanoid';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from './ui/input';

const BRACKET_DOC_ID = "liveBracket";

type Team = {
  id: string;
  name: string;
};

type Participant = {
  id: string | null;
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

export function BracketManagement() {
    const { toast } = useToast();
    const [verifiedTeams, setVerifiedTeams] = useState<Team[]>([]);
    const [bracketRounds, setBracketRounds] = useState<BracketRound[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const teamsQuery = query(collection(db, "schools"), orderBy("teamName", "asc"));
        const unsubscribeTeams = onSnapshot(teamsQuery, (snapshot) => {
            const teamsData = snapshot.docs.map(doc => ({
                id: doc.id,
                name: doc.data().teamName,
            }));
            setVerifiedTeams(teamsData);
        });

        const bracketDocRef = doc(db, "bracketState", BRACKET_DOC_ID);
        const unsubscribeBracket = onSnapshot(bracketDocRef, (docSnap) => {
            if (docSnap.exists()) {
                setBracketRounds(docSnap.data().bracketRounds || []);
            }
            setLoading(false);
        });

        return () => {
            unsubscribeTeams();
            unsubscribeBracket();
        };
    }, []);
    
    const handleAddRound = () => {
        const newRound: BracketRound = {
            id: nanoid(),
            title: `Ronda ${bracketRounds.length + 1}`,
            matches: [],
        };
        setBracketRounds([...bracketRounds, newRound]);
    };

    const handleRemoveRound = (roundId: string) => {
        setBracketRounds(bracketRounds.filter(r => r.id !== roundId));
    };

    const handleRoundTitleChange = (roundId: string, newTitle: string) => {
        setBracketRounds(bracketRounds.map(r => r.id === roundId ? { ...r, title: newTitle } : r));
    };

    const handleAddMatch = (roundId: string) => {
        setBracketRounds(bracketRounds.map(r => {
            if (r.id === roundId) {
                const newMatch: Match = { id: nanoid(), participants: [null, null] };
                return { ...r, matches: [...r.matches, newMatch] };
            }
            return r;
        }));
    };

    const handleRemoveMatch = (roundId: string, matchId: string) => {
         setBracketRounds(bracketRounds.map(r => 
            r.id === roundId ? { ...r, matches: r.matches.filter(m => m.id !== matchId) } : r
        ));
    };
    
    const handleParticipantChange = (roundId: string, matchId: string, participantIndex: number, teamId: string) => {
        const selectedTeam = verifiedTeams.find(t => t.id === teamId);
        if (!selectedTeam) return;

        setBracketRounds(bracketRounds.map(r => {
            if (r.id === roundId) {
                return {
                    ...r,
                    matches: r.matches.map(m => {
                        if (m.id === matchId) {
                            const newParticipants = [...m.participants];
                            newParticipants[participantIndex] = { id: selectedTeam.id, name: selectedTeam.name };
                            return { ...m, participants: newParticipants };
                        }
                        return m;
                    })
                };
            }
            return r;
        }));
    };

    const handleSaveBracket = async () => {
        setIsSubmitting(true);
        
        // Auto-link nextMatchId
        const linkedRounds = bracketRounds.map((round, roundIndex) => {
            if (roundIndex < bracketRounds.length - 1) {
                const nextRound = bracketRounds[roundIndex + 1];
                return {
                    ...round,
                    matches: round.matches.map((match, matchIndex) => ({
                        ...match,
                        nextMatchId: nextRound.matches[Math.floor(matchIndex / 2)]?.id || null,
                    }))
                };
            }
            return round;
        });

        try {
            const bracketDocRef = doc(db, "bracketState", BRACKET_DOC_ID);
            await setDoc(bracketDocRef, { bracketRounds: linkedRounds });
            toast({
                title: "Bracket Guardado",
                description: "La estructura del bracket ha sido guardada exitosamente."
            });
        } catch (error) {
            console.error("Error saving bracket:", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudo guardar el bracket." });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center py-10">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Gestión Manual del Bracket</CardTitle>
                <CardDescription>
                    Organice los enfrentamientos del torneo. Seleccione los equipos para cada partida en las diferentes rondas.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-6">
                    {bracketRounds.map(round => (
                        <Card key={round.id} className="bg-secondary/50">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <Input 
                                        value={round.title}
                                        onChange={(e) => handleRoundTitleChange(round.id, e.target.value)}
                                        className="text-lg font-bold w-1/2"
                                    />
                                    <Button size="icon" variant="ghost" onClick={() => handleRemoveRound(round.id)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {round.matches.map(match => (
                                    <div key={match.id} className="flex items-center gap-4 p-2 border rounded-md bg-background">
                                        <div className="flex flex-col gap-2 flex-grow">
                                           {[0, 1].map(index => (
                                             <Select
                                                key={index}
                                                onValueChange={(teamId) => handleParticipantChange(round.id, match.id, index, teamId)}
                                                value={match.participants[index]?.id || ""}
                                             >
                                                <SelectTrigger>
                                                    <SelectValue placeholder={`Equipo ${index + 1}`} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {verifiedTeams.map(team => (
                                                        <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                           ))}
                                        </div>
                                         <Button size="icon" variant="ghost" onClick={() => handleRemoveMatch(round.id, match.id)}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                                ))}
                                <Button variant="outline" size="sm" onClick={() => handleAddMatch(round.id)}>
                                    <PlusCircle className="mr-2 h-4 w-4" /> Añadir Partido
                                </Button>
                            </CardContent>
                        </Card>
                    ))}

                    <Button variant="secondary" onClick={handleAddRound}>
                         <PlusCircle className="mr-2 h-4 w-4" /> Añadir Ronda
                    </Button>
                </div>
                 <div className="mt-8 flex items-center justify-between border-t pt-6">
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        Guarde los cambios para que sean visibles públicamente.
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

