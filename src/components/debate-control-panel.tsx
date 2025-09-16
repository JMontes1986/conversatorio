

"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Video, Send, Plus, Save, MessageSquare, RefreshCw, Settings, PenLine, Upload, Eraser, Crown, QrCode, Image as ImageIcon, Check, X, HelpCircle, EyeOff, XCircle, Settings2, Columns, AlertTriangle, Dices, Trash2, History, Swords, CheckCircle } from "lucide-react";
import { db, storage } from '@/lib/firebase';
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { collection, onSnapshot, query, orderBy, addDoc, doc, setDoc, deleteDoc, updateDoc, where, getDocs, writeBatch, getDoc } from 'firebase/firestore';
import { useToast } from "@/hooks/use-toast";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Timer } from "@/components/timer";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup } from "@/components/ui/select";
import { Slider } from '@/components/ui/slider';
import { Progress } from './ui/progress';
import { nanoid } from 'nanoid';
import { Switch } from './ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { EditQuestionForm } from './edit-question-form';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Checkbox } from './ui/checkbox';
import { TieBreaker } from './tie-breaker';


const DEBATE_STATE_DOC_ID = "current";
const DRAW_STATE_DOC_ID = "liveDraw";


interface Question {
    id: string;
    text: string;
    round: string;
    videoUrl?: string;
}
interface Team {
    id: string;
    name: string;
    isBye?: boolean; // To mark a team that has a bye
}

interface SchoolData {
    id: string;
    schoolName: string;
    teamName: string;
}
interface ScoreData {
    id: string;
    matchId: string;
    judgeId?: string;
    judgeName?: string;
    teams: { name: string; total: number }[];
}

interface RoundData {
    id: string;
    name: string;
    phase: string;
}
type Matchup = {
    roundName: string;
    teams: string[];
}
type Phase = {
    name: string;
    matchups: Matchup[];
}
type LiveDrawState = {
    phases: Phase[];
}

interface StudentQuestion {
    id: string;
    name: string;
    text: string;
    relatedDebateQuestionId: string;
    targetTeam: string;
    status: 'pending' | 'approved' | 'rejected';
    createdAt: any;
}
interface StudentQuestionOverlay {
    text: string;
    target: string;
    name?: string;
}




function getWinnerOfRound(scores: ScoreData[], roundName: string): string | null {
    const roundScores = scores.filter(score => score.matchId.startsWith(roundName));
    if (roundScores.length === 0) return null;

    const teamTotals: Record<string, number> = {};

    roundScores.forEach(score => {
        score.teams.forEach(team => {
            if (!teamTotals[team.name]) {
                teamTotals[team.name] = 0;
            }
            teamTotals[team.name] += team.total;
        });
    });
    
    const entries = Object.entries(teamTotals);
    if (entries.length === 0) return null;
    
    const winner = entries.reduce((a, b) => a[1] > b[1] ? a : b)[0];
    return winner;
}


function getTopScoringTeamsFromPhase(scores: ScoreData[], phaseRounds: RoundData[], limit: number): string[] {
    const phaseRoundNames = phaseRounds.map(r => r.name);
    
    // Include bye scores for the phase
    const phaseScores = scores.filter(s => 
        phaseRoundNames.some(roundName => s.matchId.startsWith(roundName))
    );

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


function RoundAndTeamSetter({ registeredSchools = [], allScores = [], drawState }: { registeredSchools?: SchoolData[], allScores?: ScoreData[], drawState: LiveDrawState | null }) {
    const { toast } = useToast();
    const [currentRound, setCurrentRound] = useState('');
    const [teams, setTeams] = useState<Team[]>([{ id: nanoid(), name: '', isBye: false }, { id: nanoid(), name: '', isBye: false }]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [debateRounds, setDebateRounds] = useState<RoundData[]>([]);
    const [loadingRounds, setLoadingRounds] = useState(true);

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

        return () => {
            unsubscribeRounds();
        };
    }, []);
    
    const availableTeams = useMemo(() => {
        const selectedRoundData = debateRounds.find(r => r.name === currentRound);
        
        if (currentRound === 'Ronda 7') {
            const winnerR3 = getWinnerOfRound(allScores, "Ronda 3");
            const winnerR4 = getWinnerOfRound(allScores, "Ronda 4");
            const winnerR5 = getWinnerOfRound(allScores, "Ronda 5");
            const qualifiedTeamNames = [winnerR3, winnerR4, winnerR5].filter(Boolean) as string[];
            return registeredSchools.filter(school => qualifiedTeamNames.includes(school.teamName));
        }

        if (selectedRoundData && selectedRoundData.phase === "Fase de Finales") {
            const phaseDependencies: Record<string, { from: string | string[], limit?: number }> = {
                "Fase de semifinal": { from: "Fase de Grupos", limit: 4 },
                "Fase de Finales": { from: "Fase de semifinal" }
            };

            let qualifiedTeamNames: string[] = [];
            const dependencyKey = Object.keys(phaseDependencies).find(key => selectedRoundData.name.includes(key) || selectedRoundData.phase.includes(key));
            const dependency = dependencyKey ? phaseDependencies[dependencyKey] : null;

            if (dependency) {
                if (typeof dependency.from === 'string') {
                    const previousRounds = debateRounds.filter(r => r.phase === dependency.from);
                     if (dependency.limit) {
                        qualifiedTeamNames = getTopScoringTeamsFromPhase(allScores, previousRounds, dependency.limit);
                     } else {
                        qualifiedTeamNames = previousRounds.flatMap(r => getWinnerOfRound(allScores, r.name) || []);
                     }
                } else { // It's an array of round names
                    qualifiedTeamNames = dependency.from.flatMap(roundName => getWinnerOfRound(allScores, roundName) || []);
                }

                return registeredSchools.filter(school => qualifiedTeamNames.includes(school.teamName));
            }
        }
        
        return registeredSchools;
    }, [currentRound, debateRounds, allScores, registeredSchools]);
    
   const unresolvedTieInfo = useMemo(() => {
        const roundTotals: Record<string, Record<string, number>> = {};

        allScores.forEach(score => {
            if (score.judgeId === 'system') return;
            
            const roundName = score.matchId.split('-bye-')[0];
            if (!roundTotals[roundName]) {
                roundTotals[roundName] = {};
            }
            score.teams.forEach(team => {
                if (!roundTotals[roundName][team.name]) {
                    roundTotals[roundName][team.name] = 0;
                }
                roundTotals[roundName][team.name] += team.total;
            });
        });
        
        const sortedRoundNames = Object.keys(roundTotals).sort();

        for (const roundName of sortedRoundNames) {
            const totals = roundTotals[roundName];
            const scores = Object.values(totals);
            
            const scoreCounts = scores.reduce((acc, score) => {
                acc[score] = (acc[score] || 0) + 1;
                return acc;
            }, {} as Record<number, number>);

            const tiedScore = Object.keys(scoreCounts).find(score => scoreCounts[parseInt(score)] > 1);

            if (tiedScore) {
                const tiedValue = parseInt(tiedScore);
                const teamsInTie = Object.keys(totals).filter(team => totals[team] === tiedValue);
                
                const tieBreakerExists = allScores.some(s => s.matchId === roundName && s.judgeId === 'system');

                if (!tieBreakerExists && teamsInTie.length > 1) {
                    return {
                        roundName: roundName,
                        team1: teamsInTie[0],
                        team2: teamsInTie[1],
                        score: tiedValue,
                    };
                }
            }
        }

        return null;
    }, [allScores]);


    const handleRoundChange = useCallback((roundName: string) => {
        setCurrentRound(roundName);
        setTeams([{ id: nanoid(), name: '', isBye: false }, { id: nanoid(), name: '', isBye: false }]);
    }, []);

     const handleUpdateRound = async (e: React.FormEvent) => {
        e.preventDefault();
        const validTeams = teams.filter(t => t.name.trim() !== '' && !t.isBye);

        if (!currentRound || validTeams.length === 0) {
            toast({ variant: "destructive", title: "Error", description: "Por favor, seleccione una ronda y al menos un equipo." });
            return;
        }
        setIsSubmitting(true);
        try {
            const debateStateRef = doc(db, "debateState", DEBATE_STATE_DOC_ID);
            const teamNames = validTeams.map(t => t.name);

            // Update the main debate state
            await setDoc(debateStateRef, { 
                currentRound,
                teams: teamNames.map(name => ({ name }))
            }, { merge: true });
            
            // Update the live draw state
            const roundData = debateRounds.find(r => r.name === currentRound);
            if (roundData) {
                const drawStateRef = doc(db, "drawState", DRAW_STATE_DOC_ID);
                const drawStateSnap = await getDoc(drawStateRef);
                const currentDrawState: LiveDrawState = drawStateSnap.exists() ? drawStateSnap.data() as LiveDrawState : { phases: [] };

                let phase = currentDrawState.phases.find(p => p.name === roundData.phase);
                if (!phase) {
                    phase = { name: roundData.phase, matchups: [] };
                    currentDrawState.phases.push(phase);
                }

                const matchupIndex = phase.matchups.findIndex(m => m.roundName === currentRound);
                const newMatchup = { roundName: currentRound, teams: teamNames };

                if (matchupIndex > -1) {
                    phase.matchups[matchupIndex] = newMatchup;
                } else {
                    phase.matchups.push(newMatchup);
                }
                
                const phaseOrder = ["Fase de Grupos", "Fase de semifinal", "Fase de Finales", "FINAL"];
                currentDrawState.phases.sort((a,b) => phaseOrder.indexOf(a.name) - phaseOrder.indexOf(b.name));


                await setDoc(drawStateRef, currentDrawState);
            }
            
            toast({ title: "Configuración Actualizada", description: `La ronda activa es ${currentRound}.` });
        } catch (error) {
            console.error("Error updating round:", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar la configuración." });
        } finally {
            setIsSubmitting(false);
        }
    }
    
    const handleConfirmBye = async (team: Team) => {
        if (!team.isBye || !currentRound || !team.name) return;
        
        setIsSubmitting(true);
        const byeMatchId = `${currentRound}-bye-${team.name}`;

        try {
            // Check if score already exists
            const scoreQuery = query(collection(db, "scores"), where("matchId", "==", byeMatchId));
            const existingScores = await getDocs(scoreQuery);
            if (!existingScores.empty) {
                toast({
                    variant: "default",
                    title: "Avance ya Registrado",
                    description: `${team.name} ya ha avanzado por bye en esta ronda.`,
                });
                setIsSubmitting(false);
                return;
            }

            const byeScoreData = {
                matchId: byeMatchId,
                judgeId: 'system',
                judgeName: "Sistema (Bye)",
                judgeCedula: 'N/A',
                teams: [{ name: team.name, total: 1 }], // Give 1 point to signify a win
                fullScores: [{ name: team.name, total: 1, scores: { bye: 1 }, checksum: 'BYE' }],
                createdAt: new Date(),
            };
            await addDoc(collection(db, "scores"), byeScoreData);
            toast({
                title: "Avance Confirmado",
                description: `${team.name} avanza a la siguiente fase.`,
            });
        } catch (error) {
            console.error("Error confirming bye:", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudo confirmar el avance del equipo." });
        } finally {
            setIsSubmitting(false);
        }
    };


    const handleTeamNameChange = (id: string, name: string) => {
        setTeams(teams.map(team => team.id === id ? { ...team, name } : team));
    };
    
    const handleByeChange = (id: string, isBye: boolean) => {
        const newTeams = teams.map(t => t.id === id ? { ...t, isBye } : t);
        if (isBye) {
            const otherTeamId = newTeams.find(t => t.id !== id)?.id;
            if (otherTeamId) {
                // Set only one team if it's a bye
                setTeams(newTeams.filter(t => t.id === id));
            }
        } else {
            // If unchecking bye, add a second team selector back
            if (newTeams.length === 1) {
                setTeams([...newTeams, { id: nanoid(), name: '', isBye: false }]);
            } else {
                 setTeams(newTeams);
            }
        }
    }


    const addTeam = () => {
        setTeams([...teams, { id: nanoid(), name: '', isBye: false }]);
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
    
    const roundsByPhase = useMemo(() => {
        const grouped = debateRounds.reduce((acc, round) => {
            const phase = round.phase || 'General';
            if (!acc[phase]) {
                acc[phase] = [];
            }
            acc[phase].push(round);
            return acc;
        }, {} as Record<string, RoundData[]>);
        
        const phaseOrder = ["Fase de Grupos", "Fase de semifinal", "Fase de Finales", "FINAL"];
        const sortedPhases = Object.keys(grouped).sort((a,b) => phaseOrder.indexOf(a) - phaseOrder.indexOf(b));
        
        const result: Record<string, RoundData[]> = {};
        sortedPhases.forEach(phase => {
            result[phase] = grouped[phase];
        });
        return result;

    }, [debateRounds]);

    const isByeRound = teams.some(t => t.isBye);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Configurar Ronda y Equipos</CardTitle>
                <CardDescription>Establezca la ronda activa y los equipos que se enfrentan. Esto se mostrará en el marcador y en las llaves del torneo.</CardDescription>
            </CardHeader>
            <CardContent>
                 {unresolvedTieInfo && (
                    <Card className="mb-6 border-amber-500 bg-amber-50 dark:bg-amber-950/20">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                                <AlertTriangle className="h-5 w-5" />
                                ¡Empate Detectado!
                            </CardTitle>
                             <CardDescription className="text-amber-600 dark:text-amber-500">
                                Se ha detectado un empate en la ronda <strong>{unresolvedTieInfo.roundName}</strong>. Utilice la herramienta de desempate para continuar.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <TieBreaker
                                roundName={unresolvedTieInfo.roundName}
                                team1={unresolvedTieInfo.team1}
                                team2={unresolvedTieInfo.team2}
                            />
                        </CardContent>
                    </Card>
                )}
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
                            <div key={team.id} className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <Select onValueChange={(value) => handleTeamNameChange(team.id, value)} value={team.name} disabled={isSubmitting}>
                                        <SelectTrigger>
                                            <SelectValue placeholder={`Equipo ${index + 1}`} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {availableTeams.map(school => (
                                                <SelectItem key={school.id} value={school.teamName}>
                                                    {school.teamName} ({school.schoolName})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {!isByeRound && (
                                        <Button type="button" variant="ghost" size="icon" onClick={() => removeTeam(team.id)} disabled={teams.length <= 1 || isSubmitting}>
                                            <Trash2 className="h-4 w-4 text-destructive"/>
                                        </Button>
                                    )}
                                </div>
                                 {index === 0 && (
                                     <div className="flex items-center space-x-2 pt-1">
                                        <Checkbox 
                                            id={`bye-${team.id}`} 
                                            checked={team.isBye} 
                                            onCheckedChange={(checked) => handleByeChange(team.id, !!checked)} 
                                        />
                                        <label
                                            htmlFor={`bye-${team.id}`}
                                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                        >
                                            Avance Automático (Bye)
                                        </label>
                                    </div>
                                )}
                            </div>
                        ))}
                         {!isByeRound && (
                            <Button type="button" variant="outline" size="sm" onClick={addTeam} disabled={isSubmitting}>
                                <Plus className="mr-2 h-4 w-4" /> Añadir Equipo
                            </Button>
                         )}
                    </div>
                    
                    {isByeRound ? (
                         <Button type="button" variant="secondary" onClick={() => handleConfirmBye(teams[0])} disabled={isSubmitting || !teams[0].name}>
                            <Crown className="mr-2 h-4 w-4 text-amber-500" />
                            Confirmar Avance
                        </Button>
                    ) : (
                        <Button type="submit" disabled={isSubmitting || !currentRound}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                            Actualizar Ronda
                        </Button>
                    )}
                </form>
                {drawState && drawState.phases.length > 0 && (
                    <div className="mt-8 pt-6 border-t">
                        <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                            <History className="h-5 w-5" /> Historial de Configuración
                        </h3>
                        <div className="space-y-4">
                            {drawState.phases.map(phase => (
                                <div key={phase.name}>
                                    <h4 className="font-medium text-muted-foreground">{phase.name}</h4>
                                    <ul className="mt-2 space-y-1 text-sm list-disc pl-5">
                                        {phase.matchups.map(matchup => {
                                            const isScored = allScores.some(score => score.matchId.startsWith(matchup.roundName));
                                            return (
                                                <li key={matchup.roundName} className="flex items-center gap-2">
                                                    {isScored && <CheckCircle className="h-4 w-4 text-green-500" />}
                                                    <span className="font-semibold">{matchup.roundName}:</span>
                                                    <span className="ml-2">{matchup.teams.join(' vs ')}</span>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function QuestionManagement({ preparedQuestions, loadingQuestions, currentDebateRound, debateRounds, videoInputs, setVideoInputs, savingVideoId, onAddQuestion, onDeleteQuestion, onSaveVideoLink, onSendQuestion, onSendVideo, onUploadComplete }: any) {
    const [newQuestionInput, setNewQuestionInput] = useState("");
    const [newQuestionRound, setNewQuestionRound] = useState("");
    const [isAddingQuestion, setIsAddingQuestion] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadingFile, setUploadingFile] = useState<{ file: File, questionId: string } | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
    
    const roundsByPhase = useMemo(() => {
        const grouped = debateRounds.reduce((acc: any, round: RoundData) => {
            const phase = round.phase || 'General';
            if (!acc[phase]) acc[phase] = [];
            acc[phase].push(round);
            return acc;
        }, {} as Record<string, RoundData[]>);

        const phaseOrder = ["Fase de Grupos", "Fase de semifinal", "Fase de Finales", "FINAL"];
        const sortedPhases = Object.keys(grouped).sort((a,b) => {
            if (a === 'General') return -1;
            if (b === 'General') return 1;
            return phaseOrder.indexOf(a) - phaseOrder.indexOf(b);
        });
        
        const result: Record<string, RoundData[]> = {};
        sortedPhases.forEach(phase => {
            result[phase] = grouped[phase];
        });
        return result;

    }, [debateRounds]);

    const handleAddQuestionSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsAddingQuestion(true);
        try {
            await onAddQuestion(newQuestionInput, newQuestionRound);
            setNewQuestionInput("");
            setNewQuestionRound("");
        } finally {
            setIsAddingQuestion(false);
        }
    };
    
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        const questionId = event.target.dataset.questionId;

        if (file && questionId) {
             setUploadingFile({ file, questionId });
        }
    };
    
    useEffect(() => {
        if (!uploadingFile) return;

        const { file, questionId } = uploadingFile;
        const storageRef = ref(storage, `videos/${Date.now()}_${file.name}`);
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                setUploadProgress(progress);
            },
            (error) => {
                console.error("Upload failed:", error);
                alert("La subida del video falló.");
                setUploadingFile(null);
            },
            async () => {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                onUploadComplete(questionId, downloadURL);
                setUploadingFile(null);
                setUploadProgress(0);
            }
        );
    }, [uploadingFile, onUploadComplete]);

    const openEditDialog = (question: Question) => {
        setSelectedQuestion(question);
        setIsEditDialogOpen(true);
    };


    const questionsByRound = preparedQuestions.reduce((acc: any, q: Question) => {
        (acc[q.round] = acc[q.round] || []).push(q);
        return acc;
    }, {} as Record<string, Question[]>);


    return (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <Card>
            <CardHeader>
                <CardTitle>Gestión de Preguntas y Videos</CardTitle>
                 <CardDescription>
                    Prepare las preguntas y videos del debate. Puede usar enlaces de YouTube, pegar código de inserción de SharePoint, o subir un archivo.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <form onSubmit={handleAddQuestionSubmit} className="space-y-3 p-3 border rounded-lg">
                    <h3 className="font-medium">Añadir Pregunta a la Lista</h3>
                    <div className="space-y-2">
                        <Label htmlFor="new-question-input">Texto de la pregunta</Label>
                        <Textarea 
                            id="new-question-input"
                            placeholder="Escriba la pregunta..."
                            value={newQuestionInput}
                            onChange={(e) => setNewQuestionInput(e.target.value)}
                            rows={3}
                            disabled={isAddingQuestion}
                        />
                    </div>
                    <div className="space-y-2">
                         <Label htmlFor="new-question-round">Asignar a Ronda</Label>
                         <Select onValueChange={setNewQuestionRound} value={newQuestionRound} disabled={isAddingQuestion}>
                            <SelectTrigger id="new-question-round">
                                <SelectValue placeholder="Seleccione una ronda" />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.entries(roundsByPhase).map(([phase, rounds]: [string, RoundData[]]) => (
                                    <SelectGroup key={phase}>
                                        <Label className="px-2 py-1.5 text-xs font-semibold">{phase}</Label>
                                        {rounds.map((round: RoundData) => (
                                            <SelectItem key={round.id} value={round.name}>{round.name}</SelectItem>
                                        ))}
                                    </SelectGroup>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <Button type="submit" className="w-full" disabled={isAddingQuestion || !newQuestionInput.trim() || !newQuestionRound}>
                        {isAddingQuestion ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4"/>}
                        Añadir a la lista
                    </Button>
                </form>
               
               <div className="space-y-2">
                    <h3 className="font-medium text-sm text-muted-foreground pt-2">Preguntas Preparadas</h3>
                    {loadingQuestions && <p className="text-center text-sm">Cargando preguntas...</p>}
                    <Accordion type="single" collapsible className="w-full" defaultValue={currentDebateRound}>
                        {Object.keys(questionsByRound).length > 0 && Object.keys(roundsByPhase).map((phase) => (
                            Object.values(roundsByPhase[phase]).map((round : RoundData) => (
                                (questionsByRound[round.name]?.length > 0) && (
                                <AccordionItem value={round.id} key={round.id}>
                                    <AccordionTrigger>{round.name}</AccordionTrigger>
                                    <AccordionContent className="space-y-4">
                                        {questionsByRound[round.name].map((q: Question) => (
                                            <div key={q.id} className="space-y-3 bg-background p-3 rounded-md border">
                                                <p className="flex-grow text-sm font-medium">{q.text}</p>
                                                
                                                <div className="space-y-2">
                                                    <Label htmlFor={`video-url-${q.id}`} className="text-xs flex items-center gap-1"><Video className="h-3 w-3"/> Video Asociado (YouTube, SharePoint, etc.)</Label>
                                                    
                                                    <Textarea
                                                        id={`video-url-${q.id}`}
                                                        placeholder="Pegue aquí el código <iframe> completo de SharePoint/OneDrive, o la URL de YouTube."
                                                        value={videoInputs[q.id] || ''}
                                                        onChange={(e) => setVideoInputs((prev: any) => ({...prev, [q.id]: e.target.value}))}
                                                        disabled={savingVideoId === q.id || (uploadingFile?.questionId === q.id)}
                                                        rows={4}
                                                    />

                                                    <div className="flex items-center gap-2">
                                                        <Button 
                                                            size="sm" 
                                                            variant="outline"
                                                            onClick={() => onSaveVideoLink(q.id)}
                                                            disabled={savingVideoId === q.id || (uploadingFile?.questionId === q.id)}
                                                            title="Guardar Enlace o Código">
                                                            {savingVideoId === q.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4" />}
                                                            Guardar Video
                                                        </Button>
                                                        <Button size="sm" variant="outline" onClick={() => {
                                                            const fileInput = document.getElementById(`file-input-${q.id}`);
                                                            fileInput?.click();
                                                        }} disabled={uploadingFile?.questionId === q.id}>
                                                           <Upload className="h-4 w-4" /> Subir Archivo
                                                        </Button>
                                                        <input type="file" id={`file-input-${q.id}`} data-question-id={q.id} onChange={handleFileChange} className="hidden" accept="video/*" />
                                                    </div>

                                                    {uploadingFile?.questionId === q.id && (
                                                        <div className="space-y-1">
                                                            <Progress value={uploadProgress} />
                                                            <p className="text-xs text-muted-foreground">Subiendo: {Math.round(uploadProgress)}%</p>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex items-center justify-end gap-2 pt-2">
                                                    <AlertDialog>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button size="icon" variant="ghost" className="h-8 w-8">
                                                                     <PenLine className="h-4 w-4"/>
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent>
                                                                 <DropdownMenuItem onClick={() => openEditDialog(q)}>
                                                                    <PenLine className="mr-2 h-4 w-4" /> Editar
                                                                </DropdownMenuItem>
                                                                <AlertDialogTrigger asChild>
                                                                    <DropdownMenuItem className="text-destructive" onSelect={(e) => e.preventDefault()}>
                                                                        <Trash2 className="mr-2 h-4 w-4"/>Eliminar
                                                                    </DropdownMenuItem>
                                                                </AlertDialogTrigger>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    Esta acción no se puede deshacer. Se eliminará la pregunta de la lista de preparación.
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => onDeleteQuestion(q.id)} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                    
                                                    <Button size="sm" variant="outline" onClick={() => onSendVideo(q)} disabled={!videoInputs[q.id]}>
                                                        <Video className="mr-2 h-4 w-4" /> Enviar Video
                                                     </Button>
                                                     <Button size="sm" onClick={() => onSendQuestion(q)}>
                                                        <MessageSquare className="mr-2 h-4 w-4" /> Enviar Pregunta
                                                     </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </AccordionContent>
                                </AccordionItem>
                                )
                            ))
                        ))}
                    </Accordion>
                    {!loadingQuestions && Object.keys(questionsByRound).length === 0 && (
                         <p className="text-xs text-center text-muted-foreground py-4">No hay preguntas preparadas.</p>
                    )}
               </div>
            </CardContent>
             <DialogContent>
                <DialogHeader>
                    <DialogTitle>Editar Pregunta</DialogTitle>
                </DialogHeader>
                {selectedQuestion && (
                    <EditQuestionForm 
                        question={selectedQuestion} 
                        allRounds={debateRounds}
                        onFinished={() => setIsEditDialogOpen(false)} 
                    />
                )}
            </DialogContent>
        </Card>
        </Dialog>
    );
}

function StudentQuestionsTab({ allPreparedQuestions, onProjectQuestion, projectedQuestion }: { allPreparedQuestions: Question[], onProjectQuestion: (question: StudentQuestion) => void, projectedQuestion: StudentQuestionOverlay | null }) {
    const { toast } = useToast();
    const [questions, setQuestions] = useState<StudentQuestion[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const q = query(collection(db, "studentQuestions"), orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudentQuestion));
            setQuestions(data);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleUpdateStatus = async (id: string, status: StudentQuestion['status']) => {
        try {
            await updateDoc(doc(db, "studentQuestions", id), { status });
            toast({ title: "Estado de la Pregunta Actualizado" });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo actualizar el estado.'});
        }
    };
    
    const handleClearProcessedQuestions = async () => {
        const questionsToDelete = questions.filter(q => q.status === 'approved' || q.status === 'rejected');
        if (questionsToDelete.length === 0) {
            toast({ description: "No hay preguntas procesadas para limpiar." });
            return;
        }

        const batch = writeBatch(db);
        questionsToDelete.forEach(q => {
            batch.delete(doc(db, "studentQuestions", q.id));
        });

        try {
            await batch.commit();
            toast({ title: "Limpieza Completada", description: "Se han eliminado las preguntas aprobadas y rechazadas." });
        } catch (error) {
            console.error("Error clearing questions:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron limpiar las preguntas.' });
        }
    };

    
    const getRelatedDebateQuestionText = (relatedId: string) => {
        return allPreparedQuestions.find(q => q.id === relatedId)?.text || "Pregunta General";
    }
    
    const pendingQuestions = questions.filter(q => q.status === 'pending');
    const approvedQuestions = questions.filter(q => q.status === 'approved');
    const rejectedQuestions = questions.filter(q => q.status === 'rejected');


    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle className="flex items-center gap-2"><HelpCircle className="h-6 w-6"/>Preguntas del Público</CardTitle>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                             <Button variant="outline" size="sm" disabled={approvedQuestions.length === 0 && rejectedQuestions.length === 0}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Limpiar Preguntas Procesadas
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Esta acción eliminará permanentemente todas las preguntas que ya han sido aprobadas o rechazadas. Las preguntas pendientes no se verán afectadas.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={handleClearProcessedQuestions}>Sí, limpiar</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
                <CardDescription>Revise, apruebe y proyecte las preguntas enviadas por los estudiantes.</CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? <Loader2 className="mx-auto animate-spin" /> : (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-lg font-semibold mb-2">Pendientes de Aprobación ({pendingQuestions.length})</h3>
                            <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                                {pendingQuestions.length > 0 ? pendingQuestions.map(q => (
                                    <div key={q.id} className="p-3 border rounded-lg bg-secondary/50">
                                        <p className="text-sm font-medium">"{q.text}"</p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            De: <span className="font-semibold">{q.name}</span>
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Para: <span className="font-semibold">{q.targetTeam || 'Ambos'}</span>
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Relacionada con: "{getRelatedDebateQuestionText(q.relatedDebateQuestionId)}"
                                        </p>
                                        <div className="flex justify-end gap-2 mt-2">
                                            <Button size="sm" variant="destructive" onClick={() => handleUpdateStatus(q.id, 'rejected')}><X className="h-4 w-4 mr-1"/> Rechazar</Button>
                                            <Button size="sm" onClick={() => handleUpdateStatus(q.id, 'approved')}><Check className="h-4 w-4 mr-1"/> Aprobar</Button>
                                        </div>
                                    </div>
                                )) : <p className="text-sm text-muted-foreground text-center py-4">No hay preguntas pendientes.</p>}
                            </div>
                        </div>
                         <div>
                            <h3 className="text-lg font-semibold mb-2">Aprobadas ({approvedQuestions.length})</h3>
                            <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                                {approvedQuestions.length > 0 ? approvedQuestions.map(q => (
                                    <div key={q.id} className={cn(
                                        "p-3 border rounded-lg transition-colors",
                                        projectedQuestion?.text === q.text ? "bg-amber-100 border-amber-300 dark:bg-amber-950/50 dark:border-amber-700" : "bg-background"
                                    )}>
                                        <p className="text-sm font-medium">"{q.text}"</p>
                                         <p className="text-xs text-muted-foreground mt-1">
                                            De: <span className="font-semibold">{q.name}</span>
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Para: <span className="font-semibold">{q.targetTeam || 'Ambos'}</span>
                                        </p>
                                         <p className="text-xs text-muted-foreground mt-1">
                                            Relacionada con: "{getRelatedDebateQuestionText(q.relatedDebateQuestionId)}"
                                        </p>
                                        <div className="flex justify-end gap-2 mt-2">
                                            <Button size="sm" onClick={() => onProjectQuestion(q)}><Send className="h-4 w-4 mr-1"/> Proyectar</Button>
                                        </div>
                                    </div>
                                )) : <p className="text-sm text-muted-foreground text-center py-4">No hay preguntas aprobadas.</p>}
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

function SidebarImageSetter({ initialUrl }: { initialUrl: string }) {
    const { toast } = useToast();
    const [imageUrl, setImageUrl] = useState(initialUrl);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setImageUrl(initialUrl);
    }, [initialUrl]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const docRef = doc(db, "debateState", DEBATE_STATE_DOC_ID);
            await setDoc(docRef, { sidebarImageUrl: imageUrl }, { merge: true });
            toast({ title: "Imagen Guardada" });
        } catch (error) {
            console.error("Error saving image URL:", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudo guardar la URL de la imagen." });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><ImageIcon className="h-5 w-5"/>Imagen de Barra Lateral</CardTitle>
                <CardDescription>Establezca una imagen para mostrar cuando el QR esté inactivo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="sidebar-image-url">URL de la Imagen</Label>
                    <Input 
                        id="sidebar-image-url"
                        placeholder="https://ejemplo.com/imagen.png"
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        disabled={isSaving}
                    />
                </div>
                <Button className="w-full" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                    Guardar Imagen
                </Button>
            </CardContent>
        </Card>
    );
}

export function DebateControlPanel({ registeredSchools = [], allScores = [] }: { registeredSchools?: SchoolData[], allScores?: ScoreData[] }) {
    const { toast } = useToast();
    const [mainTimer, setMainTimer] = useState({ duration: 5 * 60, label: "Temporizador General", lastUpdated: Date.now(), isActive: false });
    const [previewQuestion, setPreviewQuestion] = useState("Esperando pregunta del moderador...");
    const [previewVideoUrl, setPreviewVideoUrl] = useState("");
    const [isQrEnabled, setIsQrEnabled] = useState(false);
    const [sidebarImageUrl, setSidebarImageUrl] = useState("");
    const [projectedStudentQuestion, setProjectedStudentQuestion] = useState<StudentQuestionOverlay | null>(null);
    const [tempMessageInput, setTempMessageInput] = useState("");
    const [tempMessageSize, setTempMessageSize] = useState<'xs' | 'sm' | 'normal' | 'large' | 'xl' | 'xxl'>('normal');
    const [isSendingTempMessage, setIsSendingTempMessage] = useState(false);
    
    const [preparedQuestions, setPreparedQuestions] = useState<Question[]>([]);
    const [loadingQuestions, setLoadingQuestions] = useState(true);
    const [videoInputs, setVideoInputs] = useState<Record<string, string>>({});
    const [savingVideoId, setSavingVideoId] = useState<string | null>(null);
    const [currentRound, setCurrentRound] = useState('');
    const [debateRounds, setDebateRounds] = useState<RoundData[]>([]);
    const [drawState, setDrawState] = useState<LiveDrawState | null>(null);

    useEffect(() => {
        const debateStateRef = doc(db, "debateState", DEBATE_STATE_DOC_ID);
        const unsubscribeDebateState = onSnapshot(debateStateRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setPreviewQuestion(data.question || "Esperando pregunta del moderador...");
                setPreviewVideoUrl(data.videoUrl || "");
                setIsQrEnabled(data.isQrEnabled || false);
                setSidebarImageUrl(data.sidebarImageUrl || "");
                setProjectedStudentQuestion(data.studentQuestionOverlay || null);
                if(data.timer) {
                    setMainTimer(prev => ({
                        ...prev,
                        duration: data.timer.duration,
                        isActive: data.timer.isActive || false
                    }));
                }
                setCurrentRound(data.currentRound || '');
            }
        }, (error) => {
            console.error("Error listening to debate state:", error);
        });

        const questionsQuery = query(collection(db, "questions"), orderBy("createdAt", "asc"));
        const unsubscribeQuestions = onSnapshot(questionsQuery, (querySnapshot) => {
            const questionsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));
            setPreparedQuestions(questionsData);
            const initialVideoInputs: Record<string, string> = {};
            questionsData.forEach(q => {
                if(q.videoUrl) initialVideoInputs[q.id] = q.videoUrl;
            });
            setVideoInputs(initialVideoInputs);
            setLoadingQuestions(false);
        }, (error) => {
            console.error("Error fetching questions:", error);
            setLoadingQuestions(false);
        });
        
        const roundsQuery = query(collection(db, "rounds"), orderBy("createdAt", "asc"));
        const unsubscribeRounds = onSnapshot(roundsQuery, (snapshot) => {
            const roundsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RoundData));
            setDebateRounds(roundsData);
        }, (error) => {
            console.error("Error fetching rounds:", error);
        });
        
        const drawStateRef = doc(db, "drawState", DRAW_STATE_DOC_ID);
        const unsubscribeDrawState = onSnapshot(drawStateRef, (docSnap) => {
            if (docSnap.exists()) {
                setDrawState(docSnap.data() as LiveDrawState);
            }
        });


        return () => {
            unsubscribeDebateState();
            unsubscribeQuestions();
            unsubscribeRounds();
            unsubscribeDrawState();
        };
    }, []);
    

    const updateTimer = async (newDuration: number) => {
        const newTime = { ...mainTimer, duration: newDuration, lastUpdated: Date.now() };
        setMainTimer(newTime);
        try {
            const docRef = doc(db, "debateState", DEBATE_STATE_DOC_ID);
            await setDoc(docRef, { timer: { duration: newDuration, isActive: mainTimer.isActive } }, { merge: true });
             toast({
                title: "Temporizador Actualizado",
                description: `El tiempo se ha establecido en ${Math.floor(newDuration/60)}m ${newDuration%60}s.`,
            });
        } catch (error) {
            console.error("Error updating timer: ", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "No se pudo actualizar el temporizador.",
            });
        }
    };

    const handleSendQuestion = async (question: Question) => {
        try {
            const docRef = doc(db, "debateState", DEBATE_STATE_DOC_ID);
            await setDoc(docRef, { 
                question: question.text,
                questionId: question.id,
                videoUrl: "", 
                questionSize: 'normal',
            }, { merge: true });
            toast({ title: "Pregunta Enviada", description: "La pregunta es ahora visible." });
        } catch (error) {
             console.error("Error setting question: ", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudo enviar la pregunta." });
        }
    };
    
    const handleSendVideo = async (question: Question) => {
        const videoValue = videoInputs[question.id] || "";
        if (!videoValue) {
            toast({ variant: "destructive", title: "Error", description: "No hay video asociado a esta pregunta." });
            return;
        }

        try {
            const docRef = doc(db, "debateState", DEBATE_STATE_DOC_ID);
            await setDoc(docRef, { 
                videoUrl: videoValue,
                question: "",
                questionId: "",
            }, { merge: true });
            toast({ title: "Video Enviado", description: "El video es ahora visible." });
        } catch (error) {
             console.error("Error setting video: ", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudo enviar el video." });
        }
    };

    const handleClearScreen = async () => {
        try {
            const docRef = doc(db, "debateState", DEBATE_STATE_DOC_ID);
            await setDoc(docRef, { 
                question: "Esperando pregunta del moderador...",
                questionId: "",
                videoUrl: "",
                questionSize: 'normal',
            }, { merge: true });
            toast({ title: "Pantalla Limpiada", description: "La vista de los participantes ha sido reiniciada." });
        } catch (error) {
             console.error("Error clearing screen: ", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudo limpiar la pantalla." });
        }
    }
    
    const handleProjectStudentQuestion = async (question: StudentQuestion) => {
        const overlay: StudentQuestionOverlay = {
            text: question.text,
            target: question.targetTeam || 'Ambos',
            name: question.name
        };
        try {
            const docRef = doc(db, "debateState", DEBATE_STATE_DOC_ID);
            await setDoc(docRef, { 
                studentQuestionOverlay: overlay
            }, { merge: true });
            toast({ title: "Pregunta del Público Proyectada" });
        } catch (error) {
            console.error("Error projecting student question:", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudo proyectar la pregunta." });
        }
    };

     const handleClearStudentQuestion = async () => {
        try {
            const docRef = doc(db, "debateState", DEBATE_STATE_DOC_ID);
            await setDoc(docRef, { 
                studentQuestionOverlay: null
            }, { merge: true });
            toast({ title: "Pregunta del Público Ocultada" });
        } catch (error) {
            console.error("Error clearing student question:", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudo ocultar la pregunta." });
        }
    };

    const handleSendTemporaryMessage = () => {
        if (!tempMessageInput.trim()) {
            toast({ variant: "destructive", title: "Error", description: "El mensaje no puede estar vacío." });
            return;
        }
        setIsSendingTempMessage(true);
        try {
            const docRef = doc(db, "debateState", DEBATE_STATE_DOC_ID);
             setDoc(docRef, { 
                question: tempMessageInput,
                questionId: "",
                videoUrl: "",
                questionSize: tempMessageSize,
            }, { merge: true });
            toast({ title: "Mensaje Temporal Enviado" });
        } catch (error) {
             console.error("Error sending temporary message:", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudo enviar el mensaje." });
        } finally {
            setIsSendingTempMessage(false);
        }
    }
    
    const handleToggleQr = async (enabled: boolean) => {
        setIsQrEnabled(enabled);
        try {
            const docRef = doc(db, "debateState", DEBATE_STATE_DOC_ID);
            await setDoc(docRef, { isQrEnabled: enabled }, { merge: true });
            toast({ title: "Ajuste de QR Guardado" });
        } catch (error) {
             console.error("Error toggling QR: ", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudo cambiar el estado del QR." });
        }
    };


    const handleAddQuestion = async (newQuestionInput: string, newQuestionRound: string) => {
        if (!newQuestionInput.trim() || !newQuestionRound) {
             toast({ variant: "destructive", title: "Error", description: "Debe escribir una pregunta y seleccionar una ronda." });
            return;
        }
        try {
            await addDoc(collection(db, "questions"), {
                text: newQuestionInput,
                round: newQuestionRound,
                videoUrl: "",
                createdAt: new Date()
            });
             toast({ title: "Pregunta Añadida", description: "La pregunta está lista en la sección correspondiente." });
        } catch(error) {
             console.error("Error adding question:", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudo añadir la pregunta." });
        }
    };

    const handleDeleteQuestion = async (questionId: string) => {
        try {
            await deleteDoc(doc(db, "questions", questionId));
            toast({ title: "Pregunta Eliminada" });
        } catch(error) {
            console.error("Error deleting question:", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar la pregunta." });
        }
    }

    const handleSaveVideoLink = async (questionId: string) => {
        setSavingVideoId(questionId);
        const urlToSave = videoInputs[questionId] || "";

        try {
            const questionRef = doc(db, "questions", questionId);
            await updateDoc(questionRef, { videoUrl: urlToSave });
            toast({ title: "Video Guardado", description: "El video se ha asociado a la pregunta." });
        } catch (error) {
            console.error("Error saving video link:", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudo guardar el video." });
        } finally {
            setSavingVideoId(null);
        }
    }
    
    const handleUploadComplete = (questionId: string, url: string) => {
        setVideoInputs(prev => ({ ...prev, [questionId]: url }));
        handleSaveVideoLink(questionId);
        toast({ title: "Subida Completa", description: "El video se ha subido y enlazado correctamente." });
    };

    const TimerSettings = () => {
        const [minutes, setMinutes] = useState(Math.floor(mainTimer.duration / 60));
        const [seconds, setSeconds] = useState(mainTimer.duration % 60);

        const handleUpdate = () => {
            const newDuration = (minutes * 60) + seconds;
            updateTimer(newDuration);
        };

        return (
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full gap-2">
                        <Settings className="h-4 w-4" /> Editar Tiempo
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-60">
                    <div className="grid gap-4">
                        <div className="space-y-2">
                            <h4 className="font-medium leading-none">Ajustar Temporizador</h4>
                            <p className="text-sm text-muted-foreground">
                                Ajuste los minutos y segundos.
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <Label htmlFor="minutes">Minutos</Label>
                                <Input
                                    id="minutes"
                                    type="number"
                                    value={minutes}
                                    onChange={(e) => setMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                                    className="h-8"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="seconds">Segundos</Label>
                                <Input
                                    id="seconds"
                                    type="number"
                                    value={seconds}
                                    onChange={(e) => setSeconds(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                                    className="h-8"
                                />
                            </div>
                        </div>
                         <Button onClick={handleUpdate} size="sm">Actualizar</Button>
                    </div>
                </PopoverContent>
            </Popover>
        )
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-3 space-y-6">
                <Card>
                    <CardHeader>
                         <CardTitle className="flex items-center justify-between"><span className="flex items-center gap-2"><Video className="h-6 w-6"/> Vista Previa del Debate</span></CardTitle>
                        <CardDescription>Esta es una vista previa de lo que los participantes ven en la página de debate.</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <div className="space-y-4">
                            <h3 className="font-medium text-lg">Pantalla Pública:</h3>
                            <div className="relative text-xl p-4 bg-secondary rounded-md min-h-[150px] flex flex-col items-center justify-center text-center gap-4">
                                {projectedStudentQuestion && (
                                     <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-20 flex items-center justify-center p-4">
                                        <div className="bg-background rounded-lg shadow-2xl p-8 max-w-3xl w-full text-center relative">
                                            <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-8 w-8 text-muted-foreground" onClick={handleClearStudentQuestion}>
                                                <XCircle className="h-5 w-5" />
                                            </Button>
                                            <HelpCircle className="h-8 w-8 text-primary mx-auto mb-3" />
                                            <h2 className="font-headline text-lg font-bold mb-1">Pregunta del Público</h2>
                                            <p className="text-2xl font-semibold whitespace-pre-wrap">
                                                "{projectedStudentQuestion.text}"
                                            </p>
                                             <p className="mt-2 text-sm text-muted-foreground">
                                                De: <span className="font-semibold">{projectedStudentQuestion.name}</span>
                                            </p>
                                            <p className="mt-2 text-base text-muted-foreground">
                                                Para: <span className="font-semibold text-primary">{projectedStudentQuestion.target}</span>
                                            </p>
                                        </div>
                                    </div>
                                )}
                                {previewVideoUrl && "Video en pantalla. Esperando pregunta."}
                                {previewQuestion && previewQuestion}
                                {!previewVideoUrl && !previewQuestion && "Pantalla Limpia"}
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Tabs defaultValue="round-config" className="w-full">
                    <TabsList className="grid w-full grid-cols-1 sm:grid-cols-5 h-auto sm:h-10">
                        <TabsTrigger value="round-config"><Columns className="mr-2 h-4 w-4"/>Config. Ronda</TabsTrigger>
                        <TabsTrigger value="questions"><MessageSquare className="mr-2 h-4 w-4"/>Preguntas</TabsTrigger>
                        <TabsTrigger value="audience"><HelpCircle className="mr-2 h-4 w-4"/>Público</TabsTrigger>
                        <TabsTrigger value="messages"><Send className="mr-2 h-4 w-4"/>Mensajes</TabsTrigger>
                        <TabsTrigger value="display-settings"><Settings2 className="mr-2 h-4 w-4"/>Ajustes</TabsTrigger>
                    </TabsList>
                    <TabsContent value="round-config">
                        <RoundAndTeamSetter registeredSchools={registeredSchools} allScores={allScores} drawState={drawState} />
                    </TabsContent>
                    <TabsContent value="questions">
                         <QuestionManagement 
                            preparedQuestions={preparedQuestions}
                            loadingQuestions={loadingQuestions}
                            currentDebateRound={currentRound}
                            debateRounds={debateRounds}
                            videoInputs={videoInputs}
                            setVideoInputs={setVideoInputs}
                            savingVideoId={savingVideoId}
                            onAddQuestion={handleAddQuestion}
                            onDeleteQuestion={handleDeleteQuestion}
                            onSaveVideoLink={handleSaveVideoLink}
                            onSendQuestion={handleSendQuestion}
                            onSendVideo={handleSendVideo}
                            onUploadComplete={handleUploadComplete}
                        />
                    </TabsContent>
                    <TabsContent value="audience">
                        <StudentQuestionsTab 
                            allPreparedQuestions={preparedQuestions} 
                            onProjectQuestion={handleProjectStudentQuestion} 
                            projectedQuestion={projectedStudentQuestion}
                        />
                    </TabsContent>
                    <TabsContent value="messages">
                        <Card>
                            <CardHeader>
                                <CardTitle>Mensaje Temporal en Pantalla</CardTitle>
                                <CardDescription>Muestre un mensaje de texto en la pantalla pública. Esto reemplazará la pregunta o el video.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="temp-message-input">Texto del Mensaje</Label>
                                    <Textarea 
                                        id="temp-message-input"
                                        placeholder="Ej: ¡Sigan nuestras redes sociales!"
                                        value={tempMessageInput}
                                        onChange={(e) => setTempMessageInput(e.target.value)}
                                        rows={2}
                                    />
                                </div>
                                <div className="space-y-2">
                                     <Label htmlFor="temp-message-size">Tamaño de la Letra</Label>
                                      <Select onValueChange={(value) => setTempMessageSize(value as any)} defaultValue={tempMessageSize}>
                                        <SelectTrigger id="temp-message-size">
                                            <SelectValue placeholder="Seleccione un tamaño" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="xs">Muy Pequeña</SelectItem>
                                            <SelectItem value="sm">Pequeña</SelectItem>
                                            <SelectItem value="normal">Normal</SelectItem>
                                            <SelectItem value="large">Grande</SelectItem>
                                            <SelectItem value="xl">Muy Grande</SelectItem>
                                            <SelectItem value="xxl">Gigante</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="flex flex-wrap gap-2 justify-end pt-2">
                                    <Button onClick={handleSendTemporaryMessage} disabled={isSendingTempMessage}>
                                        {isSendingTempMessage ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4"/>}
                                        Enviar Mensaje
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                    <TabsContent value="display-settings">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Control de Pantalla</CardTitle>
                                    <CardDescription>Ajustes generales para la pantalla pública.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                <div>
                                        <Timer key={mainTimer.lastUpdated} initialTime={mainTimer.duration} title={mainTimer.label} showControls={true} />
                                        <div className="mt-2">
                                            <TimerSettings />
                                        </div>
                                </div>
                                    <div className="space-y-2 rounded-lg border p-3">
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="qr-switch" className="font-medium">Habilitar QR para Preguntas</Label>
                                            <Switch
                                                id="qr-switch"
                                                checked={isQrEnabled}
                                                onCheckedChange={handleToggleQr}
                                            />
                                        </div>
                                        <Button variant="outline" size="sm" className="w-full mt-2" onClick={handleClearStudentQuestion}>
                                            <EyeOff className="mr-2 h-4 w-4"/> Ocultar Pregunta del Público
                                        </Button>
                                    </div>
                                    <Button variant="outline" size="sm" className="w-full" onClick={handleClearScreen}>
                                        <RefreshCw className="mr-2 h-4 w-4"/> Limpiar Pantalla Principal
                                </Button>
                                </CardContent>
                            </Card>
                            <SidebarImageSetter initialUrl={sidebarImageUrl} />
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
