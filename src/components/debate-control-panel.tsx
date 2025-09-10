

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
import { Loader2, Video, Send, Plus, Save, MessageSquare, RefreshCw, Settings, PenLine, Upload, Eraser, Crown } from "lucide-react";
import { db, storage } from '@/lib/firebase';
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { collection, onSnapshot, query, orderBy, addDoc, doc, setDoc, deleteDoc, updateDoc, where, getDocs } from 'firebase/firestore';
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
import { Trash2 } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Progress } from './ui/progress';
import { nanoid } from 'nanoid';


const DEBATE_STATE_DOC_ID = "current";

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
        // Handle bye rounds, which won't have multiple teams
        if (score.matchId.includes('-bye')) {
             if (!matches[score.matchId]) {
                matches[score.matchId] = { teamTotals: {} };
             }
             score.teams.forEach(team => {
                 matches[score.matchId].teamTotals[team.name] = team.total;
             });
             return;
        }

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


function RoundAndTeamSetter({ registeredSchools = [], allScores = [] }: { registeredSchools?: SchoolData[], allScores?: ScoreData[] }) {
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

        const drawStateRef = doc(db, "drawState", "liveDraw");
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
             const teamObjects: Team[] = qualifiedTeams.map(name => ({ id: nanoid(), name }));
             
             // Check for bye
             if (teamObjects.length % 2 !== 0) {
                 const byeTeam = teamObjects[teamObjects.length - 1];
                 byeTeam.isBye = true;
             }

             setTeams(teamObjects);
             toast({ title: "Equipos Llenados Automáticamente", description: `Los equipos para ${roundName} han sido cargados.` });
        } else {
            setIsAutoFilled(false);
            setTeams([{ id: nanoid(), name: '' }, { id: nanoid(), name: '' }]);
        }

    }, [allScores, toast, debateRounds, drawState]);

     const handleUpdateRound = async (e: React.FormEvent) => {
        e.preventDefault();
        const validTeams = teams.filter(t => t.name.trim() !== '');

        if (!currentRound || validTeams.length < 1) { // Can be 1 in case of a bye
            toast({ variant: "destructive", title: "Error", description: "Por favor, seleccione una ronda y asegúrese de que haya al menos un equipo." });
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
    
    const handleConfirmBye = async (team: Team) => {
        if (!team.isBye || !currentRound) return;
        
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
                judgeName: "Sistema",
                teams: [{ name: team.name, total: 1 }], // Give 1 point to signify a win
                fullScores: [{ name: team.name, total: 1, scores: { bye: 1 } }],
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
                <CardTitle>Configurar Ronda y Equipos</CardTitle>
                <CardDescription>Establezca la ronda activa y los equipos que se enfrentan.</CardDescription>
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
                                {team.isBye ? (
                                    <Button type="button" variant="secondary" size="sm" onClick={() => handleConfirmBye(team)} disabled={isSubmitting}>
                                        <Crown className="mr-2 h-4 w-4 text-amber-500" />
                                        Confirmar Avance
                                    </Button>
                                ) : (
                                    <Button type="button" variant="ghost" size="icon" onClick={() => removeTeam(team.id)} disabled={teams.length <= 2 || isSubmitting || isAutoFilled}>
                                        <Trash2 className="h-4 w-4 text-destructive"/>
                                    </Button>
                                )}
                            </div>
                        ))}
                        <Button type="button" variant="outline" size="sm" onClick={addTeam} disabled={isSubmitting || isAutoFilled}>
                            <Plus className="mr-2 h-4 w-4" /> Añadir Equipo
                        </Button>
                        {isAutoFilled && <p className="text-xs text-muted-foreground">La selección de equipos es automática para esta ronda.</p>}
                    </div>
                    <Button type="submit" disabled={isSubmitting || !currentRound}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                        Actualizar Ronda
                    </Button>
                </form>
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
    
    const roundsByPhase = useMemo(() => {
        const grouped = debateRounds.reduce((acc: any, round: RoundData) => {
            const phase = round.phase || 'General';
            if (!acc[phase]) acc[phase] = [];
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


    const questionsByRound = preparedQuestions.reduce((acc: any, q: Question) => {
        (acc[q.round] = acc[q.round] || []).push(q);
        return acc;
    }, {} as Record<string, Question[]>);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Gestión de Preguntas y Videos</CardTitle>
                 <CardDescription>
                    Prepare las preguntas y videos del debate. Puede usar enlaces de YouTube, enlaces directos a videos, o subir un archivo.
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
                                                    <Label htmlFor={`video-url-${q.id}`} className="text-xs flex items-center gap-1"><Video className="h-3 w-3"/> Enlace o Archivo de Video</Label>
                                                    <div className="flex items-center gap-2">
                                                        <Input 
                                                            id={`video-url-${q.id}`}
                                                            placeholder="Pegar enlace o subir archivo"
                                                            value={videoInputs[q.id] || ''}
                                                            onChange={(e) => setVideoInputs((prev: any) => ({...prev, [q.id]: e.target.value}))}
                                                            disabled={savingVideoId === q.id || (uploadingFile?.questionId === q.id)}
                                                        />
                                                        <Button 
                                                            size="icon" 
                                                            variant="outline" 
                                                            className="h-9 w-9 shrink-0" 
                                                            onClick={() => onSaveVideoLink(q.id)}
                                                            disabled={savingVideoId === q.id || (uploadingFile?.questionId === q.id)}
                                                            title="Guardar Enlace">
                                                            {savingVideoId === q.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4" />}
                                                        </Button>
                                                        <Button size="icon" variant="outline" className="h-9 w-9 shrink-0" onClick={() => fileInputRef.current?.click()} disabled={uploadingFile?.questionId === q.id}>
                                                           <Upload className="h-4 w-4" />
                                                        </Button>
                                                        <input type="file" ref={fileInputRef} data-question-id={q.id} onChange={handleFileChange} className="hidden" accept="video/*" />
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
                                                        <AlertDialogTrigger asChild>
                                                            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive text-xs h-8 w-8 p-0">
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                            <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                Esta acción no se puede deshacer. Se eliminará la pregunta y su video asociado de la lista de preparación.
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
        </Card>
    );
}

export function DebateControlPanel({ registeredSchools = [], allScores = [] }: { registeredSchools?: SchoolData[], allScores?: ScoreData[] }) {
    const { toast } = useToast();
    const [mainTimer, setMainTimer] = useState({ duration: 5 * 60, label: "Temporizador General", lastUpdated: Date.now(), isActive: false });
    const [previewQuestion, setPreviewQuestion] = useState("Esperando pregunta del moderador...");
    const [previewVideoUrl, setPreviewVideoUrl] = useState("");
    const [previewTempMessage, setPreviewTempMessage] = useState("");
    const [tempMessageInput, setTempMessageInput] = useState("");
    const [isSendingTempMessage, setIsSendingTempMessage] = useState(false);
    
    const [preparedQuestions, setPreparedQuestions] = useState<Question[]>([]);
    const [loadingQuestions, setLoadingQuestions] = useState(true);
    const [videoInputs, setVideoInputs] = useState<Record<string, string>>({});
    const [savingVideoId, setSavingVideoId] = useState<string | null>(null);
    const [currentRound, setCurrentRound] = useState('');
    const [debateRounds, setDebateRounds] = useState<RoundData[]>([]);

    const [bracketTitle, setBracketTitle] = useState("¿QUÉ SIGNIFICA SER JOVEN DEL SIGLO XXI?");
    const [bracketSubtitle, setBracketSubtitle] = useState("Debate Intercolegial");
    const [bracketTitleSize, setBracketTitleSize] = useState([3]);
    const [isSavingBracketSettings, setIsSavingBracketSettings] = useState(false);

    useEffect(() => {
        const debateStateRef = doc(db, "debateState", DEBATE_STATE_DOC_ID);
        const unsubscribeDebateState = onSnapshot(debateStateRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setPreviewQuestion(data.question || "Esperando pregunta del moderador...");
                setPreviewVideoUrl(data.videoUrl || "");
                setPreviewTempMessage(data.temporaryMessage || "");
                if(data.timer) {
                    setMainTimer(prev => ({
                        ...prev,
                        duration: data.timer.duration,
                        isActive: data.timer.isActive || false
                    }));
                }
                setCurrentRound(data.currentRound || '');
                setBracketTitle(data.bracketTitle || "¿QUÉ SIGNIFICA SER JOVEN DEL SIGLO XXI?");
                setBracketSubtitle(data.bracketSubtitle || "Debate Intercolegial");
                setBracketTitleSize([data.bracketTitleSize || 3]);
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


        return () => {
            unsubscribeDebateState();
            unsubscribeQuestions();
            unsubscribeRounds();
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
                videoUrl: "", // Clear video when question is sent
                temporaryMessage: "" // Clear temp message
            }, { merge: true });
            toast({ title: "Pregunta Enviada", description: "La pregunta es ahora visible." });
        } catch (error) {
             console.error("Error setting question: ", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudo enviar la pregunta." });
        }
    };
    
    const handleSendVideo = async (question: Question) => {
        try {
            const docRef = doc(db, "debateState", DEBATE_STATE_DOC_ID);
            await setDoc(docRef, { 
                videoUrl: videoInputs[question.id] || "",
                question: "", // Clear question when video is sent
                temporaryMessage: "" // Clear temp message
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
                videoUrl: "",
                temporaryMessage: ""
            }, { merge: true });
            toast({ title: "Pantalla Limpiada", description: "La vista de los participantes ha sido reiniciada." });
        } catch (error) {
             console.error("Error clearing screen: ", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudo limpiar la pantalla." });
        }
    }

    const handleSendTemporaryMessage = async () => {
        if (!tempMessageInput.trim()) {
            toast({ variant: "destructive", title: "Error", description: "El mensaje no puede estar vacío." });
            return;
        }
        setIsSendingTempMessage(true);
        try {
            const docRef = doc(db, "debateState", DEBATE_STATE_DOC_ID);
            await setDoc(docRef, { 
                temporaryMessage: tempMessageInput,
                question: "",
                videoUrl: ""
            }, { merge: true });
            toast({ title: "Mensaje Temporal Enviado" });
        } catch (error) {
            console.error("Error sending temporary message:", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudo enviar el mensaje." });
        } finally {
            setIsSendingTempMessage(false);
        }
    }

    const handleClearTemporaryMessage = async () => {
        try {
            const docRef = doc(db, "debateState", DEBATE_STATE_DOC_ID);
            await setDoc(docRef, { temporaryMessage: "" }, { merge: true });
            setTempMessageInput("");
            toast({ title: "Mensaje Temporal Limpiado" });
        } catch (error) {
            console.error("Error clearing temporary message:", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudo limpiar el mensaje." });
        }
    }


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
        const url = videoInputs[questionId] || "";
        try {
            const questionRef = doc(db, "questions", questionId);
            await updateDoc(questionRef, { videoUrl: url });
            toast({ title: "Enlace de Video Guardado", description: "El enlace se ha asociado a la pregunta." });
        } catch (error) {
            console.error("Error saving video link:", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudo guardar el enlace." });
        } finally {
            setSavingVideoId(null);
        }
    }
    
    const handleUploadComplete = (questionId: string, url: string) => {
        setVideoInputs(prev => ({ ...prev, [questionId]: url }));
        handleSaveVideoLink(questionId);
        toast({ title: "Subida Completa", description: "El video se ha subido y enlazado correctamente." });
    };

    const handleSaveBracketSettings = async () => {
        setIsSavingBracketSettings(true);
        try {
            const docRef = doc(db, "debateState", DEBATE_STATE_DOC_ID);
            await setDoc(docRef, { 
                bracketTitle,
                bracketSubtitle,
                bracketTitleSize: bracketTitleSize[0]
            }, { merge: true });
            toast({ title: "Ajustes del Bracket Guardados" });
        } catch (error) {
            console.error("Error saving bracket settings:", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudieron guardar los ajustes del bracket." });
        } finally {
            setIsSavingBracketSettings(false);
        }
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

    const titleSizeMap: Record<number, string> = {
        1: "text-xl",
        2: "text-2xl",
        3: "text-3xl",
        4: "text-4xl",
        5: "text-5xl"
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
                <Card>
                    <CardHeader>
                         <CardTitle className="flex items-center justify-between"><span className="flex items-center gap-2"><Video className="h-6 w-6"/> Vista Previa del Debate</span></CardTitle>
                        <CardDescription>Esta es una vista previa de lo que los participantes ven en la página de debate.</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <div className="space-y-4">
                            <h3 className="font-medium text-lg">Pantalla Pública:</h3>
                            <div className="text-xl p-4 bg-secondary rounded-md min-h-[100px] flex items-center justify-center text-center">
                                {!previewVideoUrl && !previewQuestion && !previewTempMessage && "Pantalla Limpia"}
                                {previewTempMessage && <span className="text-muted-foreground">{previewTempMessage}</span>}
                                {previewVideoUrl && !previewTempMessage && "Video en pantalla. Esperando pregunta."}
                                {previewQuestion && !previewTempMessage && previewQuestion}
                            </div>
                        </div>
                    </CardContent>
                </Card>
                
                <RoundAndTeamSetter registeredSchools={registeredSchools} allScores={allScores} />

                 <Card>
                    <CardHeader>
                        <CardTitle>Mensaje Temporal en Pantalla</CardTitle>
                        <CardDescription>Muestre un mensaje temporal en la pantalla pública.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <Textarea 
                            placeholder="Ej: En breves momentos, la siguiente pregunta..."
                            value={tempMessageInput}
                            onChange={(e) => setTempMessageInput(e.target.value)}
                            rows={3}
                        />
                        <div className="flex gap-2">
                            <Button onClick={handleSendTemporaryMessage} disabled={isSendingTempMessage} className="w-full">
                                {isSendingTempMessage ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4"/>}
                                Enviar Mensaje
                            </Button>
                             <Button onClick={handleClearTemporaryMessage} variant="outline" className="w-full">
                                <Eraser className="mr-2 h-4 w-4"/>
                                Limpiar Mensaje
                            </Button>
                        </div>
                    </CardContent>
                </Card>

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
            </div>

            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Control del Debate</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                       <div>
                            <Timer key={mainTimer.lastUpdated} initialTime={mainTimer.duration} title={mainTimer.label} showControls={true} />
                            <div className="mt-2">
                                 <TimerSettings />
                            </div>
                       </div>
                        <Button variant="outline" size="sm" className="w-full" onClick={handleClearScreen}>
                            <RefreshCw className="mr-2 h-4 w-4"/> Limpiar Pantalla Pública
                       </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><PenLine className="h-5 w-5"/>Ajustes del Bracket</CardTitle>
                        <CardDescription>Personalice el título que aparece en el marcador del torneo.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                         <div className="space-y-2">
                            <Label htmlFor="bracket-title">Título Principal</Label>
                            <Input id="bracket-title" value={bracketTitle} onChange={(e) => setBracketTitle(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="bracket-subtitle">Subtítulo</Label>
                            <Input id="bracket-subtitle" value={bracketSubtitle} onChange={(e) => setBracketSubtitle(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="bracket-title-size">Tamaño del Título</Label>
                            <div className="flex items-center gap-4">
                                <Slider
                                    id="bracket-title-size"
                                    min={1}
                                    max={5}
                                    step={1}
                                    value={bracketTitleSize}
                                    onValueChange={setBracketTitleSize}
                                />
                                <span className={`font-bold ${titleSizeMap[bracketTitleSize[0]]}`}>Aa</span>
                            </div>
                        </div>
                        <Button className="w-full" onClick={handleSaveBracketSettings} disabled={isSavingBracketSettings}>
                            {isSavingBracketSettings ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                            Guardar Ajustes del Bracket
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
