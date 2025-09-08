

"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { School, User, Settings, PlusCircle, MoreHorizontal, FilePen, Trash2, Loader2, Trophy, KeyRound, Copy, Check, ToggleLeft, ToggleRight, Video, Send, Plus, Save, MessageSquare, RefreshCw } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, getDocs, where, deleteDoc, doc, updateDoc, setDoc } from 'firebase/firestore';
import { useToast } from "@/hooks/use-toast";
import { AdminAuth } from '@/components/auth/admin-auth';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import Link from 'next/link';
import { nanoid } from 'nanoid';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


const DEBATE_STATE_DOC_ID = "current";

interface Question {
    id: string;
    text: string;
    round: string;
    videoUrl?: string;
}

const debateRounds = ["Ronda 1", "Ronda 2", "Cuartos de Final", "Semifinal", "Final"];
interface Team {
    id: number;
    name: string;
}

interface Participant {
    name: string;
}
interface SchoolData {
    id: string;
    schoolName: string;
    teamName: string;
    participants: Participant[];
    attendees: Participant[];
    status: 'Verificado' | 'Pendiente';
}
interface JudgeData {
    id: string;
    name: string;
    cedula: string;
}
interface ModeratorData {
    id: string;
    username: string;
    token: string;
    status: 'active' | 'inactive';
}
interface ScoreData {
    id: string;
    matchId: string;
    judgeName: string;
    teamA_total: number;
    teamB_total: number;
}
interface MatchResults {
    matchId: string;
    scores: ScoreData[];
    totalTeamA: number;
    totalTeamB: number;
    winner: 'teamA' | 'teamB' | 'Tie';
}

function CompetitionSettings() {
    const { toast } = useToast();
    const [currentRound, setCurrentRound] = useState('');
    const [teams, setTeams] = useState<Team[]>([{ id: 1, name: '' }, { id: 2, name: '' }]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const docRef = doc(db, "debateState", DEBATE_STATE_DOC_ID);
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setCurrentRound(data.currentRound || '');
                 if (data.teams && data.teams.length > 0) {
                    setTeams(data.teams);
                } else {
                    // Legacy support or default state
                    const legacyTeams = [
                        data.teamAName && { id: 1, name: data.teamAName },
                        data.teamBName && { id: 2, name: data.teamBName }
                    ].filter(Boolean);
                    if (legacyTeams.length > 0) {
                      setTeams(legacyTeams)
                    } else {
                       setTeams([{ id: 1, name: '' }, { id: 2, name: '' }]);
                    }
                }
            }
        });
        return () => unsubscribe();
    }, []);

    const handleUpdateRound = async (e: React.FormEvent) => {
        e.preventDefault();
        const validTeams = teams.filter(t => t.name.trim() !== '');

        if (!currentRound || validTeams.length < 2) {
            toast({ variant: "destructive", title: "Error", description: "Por favor, seleccione una ronda y añada al menos dos equipos." });
            return;
        }
        setIsSubmitting(true);
        try {
            const docRef = doc(db, "debateState", DEBATE_STATE_DOC_ID);
            // We store the clean list of teams
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
    
    const handleTeamNameChange = (id: number, name: string) => {
        setTeams(teams.map(team => team.id === id ? { ...team, name } : team));
    };

    const addTeam = () => {
        setTeams([...teams, { id: Date.now(), name: '' }]);
    };

    const removeTeam = (id: number) => {
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
                         <Select onValueChange={setCurrentRound} value={currentRound} disabled={isSubmitting}>
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
                                <Input 
                                    value={team.name}
                                    onChange={(e) => handleTeamNameChange(team.id, e.target.value)}
                                    placeholder={`Nombre del Equipo ${index + 1}`}
                                    disabled={isSubmitting}
                                />
                                <Button type="button" variant="ghost" size="icon" onClick={() => removeTeam(team.id)} disabled={teams.length <= 2 || isSubmitting}>
                                    <Trash2 className="h-4 w-4 text-destructive"/>
                                </Button>
                            </div>
                        ))}
                         <Button type="button" variant="outline" size="sm" onClick={addTeam} disabled={isSubmitting}>
                            <Plus className="mr-2 h-4 w-4" /> Añadir Equipo
                        </Button>
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

function QuestionManagement({ preparedQuestions, loadingQuestions, currentDebateRound, videoInputs, setVideoInputs, savingVideoId, onAddQuestion, onDeleteQuestion, onSaveVideoLink, onSendVideo, onSendQuestion }: any) {
    const { toast } = useToast();
    const [newQuestionInput, setNewQuestionInput] = useState("");
    const [newQuestionRound, setNewQuestionRound] = useState("");
    const [isAddingQuestion, setIsAddingQuestion] = useState(false);

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
    
    const questionsByRound = preparedQuestions.reduce((acc: any, q: Question) => {
        (acc[q.round] = acc[q.round] || []).push(q);
        return acc;
    }, {} as Record<string, Question[]>);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Gestión de Preguntas y Videos</CardTitle>
                 <CardDescription>
                    Prepare, envíe y gestione las preguntas y videos del debate por ronda.
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
                                {debateRounds.map(round => (
                                    <SelectItem key={round} value={round}>{round}</SelectItem>
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
                        {debateRounds.map(round => (
                            (questionsByRound[round]?.length > 0) && (
                            <AccordionItem value={round} key={round}>
                                <AccordionTrigger>{round}</AccordionTrigger>
                                <AccordionContent className="space-y-4">
                                    {questionsByRound[round].map((q: Question) => (
                                        <div key={q.id} className="space-y-3 bg-background p-3 rounded-md border">
                                            <p className="flex-grow text-sm font-medium">{q.text}</p>
                                            
                                            <div className="space-y-2">
                                                <Label htmlFor={`video-url-${q.id}`} className="text-xs">Enlace del Video (OneDrive)</Label>
                                                <div className="flex items-center gap-2">
                                                    <Input 
                                                        id={`video-url-${q.id}`}
                                                        placeholder="Pegar enlace de OneDrive"
                                                        value={videoInputs[q.id] || ''}
                                                        onChange={(e) => setVideoInputs((prev: any) => ({...prev, [q.id]: e.target.value}))}
                                                        disabled={savingVideoId === q.id}
                                                    />
                                                    <Button 
                                                        size="icon" 
                                                        variant="outline" 
                                                        className="h-9 w-9 shrink-0" 
                                                        onClick={() => onSaveVideoLink(q.id)}
                                                        disabled={savingVideoId === q.id}
                                                        title="Guardar Enlace">
                                                        {savingVideoId === q.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4" />}
                                                    </Button>
                                                </div>
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
                                                <Button size="sm" onClick={() => onSendVideo(q)} variant="outline">
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

function DebateControl() {
    const { toast } = useToast();
    const [mainTimer, setMainTimer] = useState({ duration: 5 * 60, label: "Temporizador General", lastUpdated: Date.now() });
    const [previewQuestion, setPreviewQuestion] = useState("Esperando pregunta del moderador...");
    const [previewVideoUrl, setPreviewVideoUrl] = useState("");
    const [currentDebateRound, setCurrentDebateRound] = useState("Ronda 1");
    
    const [preparedQuestions, setPreparedQuestions] = useState<Question[]>([]);
    const [loadingQuestions, setLoadingQuestions] = useState(true);
    const [videoInputs, setVideoInputs] = useState<Record<string, string>>({});
    const [savingVideoId, setSavingVideoId] = useState<string | null>(null);


    useEffect(() => {
        const debateStateRef = doc(db, "debateState", DEBATE_STATE_DOC_ID);
        const unsubscribeDebateState = onSnapshot(debateStateRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setPreviewQuestion(data.question || "Esperando pregunta del moderador...");
                setPreviewVideoUrl(data.videoUrl || "");
                if(data.timer) setMainTimer(prev => ({...prev, duration: data.timer.duration}));
                if(data.currentRound) setCurrentDebateRound(data.currentRound);
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

        return () => {
            unsubscribeDebateState();
            unsubscribeQuestions();
        };
    }, []);
    

    const updateTimer = async (newDuration: number) => {
        const newTime = { ...mainTimer, duration: newDuration, lastUpdated: Date.now() };
        setMainTimer(newTime);
        try {
            const docRef = doc(db, "debateState", DEBATE_STATE_DOC_ID);
            await setDoc(docRef, { timer: { duration: newDuration } }, { merge: true });
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
    
    const handleSendVideo = async (question: Question) => {
         try {
            const docRef = doc(db, "debateState", DEBATE_STATE_DOC_ID);
            const videoUrlToSend = videoInputs[question.id] || "";
            await setDoc(docRef, {
                videoUrl: videoUrlToSend,
                question: "" // Clear question when sending video
            }, { merge: true });
            toast({ title: "Video Enviado", description: "El video es ahora visible para los participantes." });
        } catch (error) {
            console.error("Error setting video: ", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudo enviar el video." });
        }
    };

    const handleSendQuestion = async (question: Question) => {
        try {
            const docRef = doc(db, "debateState", DEBATE_STATE_DOC_ID);
            await setDoc(docRef, { 
                question: question.text,
            }, { merge: true });
            toast({ title: "Pregunta Enviada", description: "La pregunta es ahora visible." });
        } catch (error) {
             console.error("Error setting question: ", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudo enviar la pregunta." });
        }
    };

    const handleClearScreen = async () => {
        try {
            const docRef = doc(db, "debateState", DEBATE_STATE_DOC_ID);
            await setDoc(docRef, { 
                question: "",
                videoUrl: ""
            }, { merge: true });
            toast({ title: "Pantalla Limpiada", description: "La vista de los participantes ha sido reiniciada." });
        } catch (error) {
             console.error("Error clearing screen: ", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudo limpiar la pantalla." });
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
                                {!previewVideoUrl && !previewQuestion && "Pantalla Limpia"}
                                {previewVideoUrl && !previewQuestion && "Video en pantalla. Esperando pregunta."}
                                {previewQuestion}
                            </div>
                        </div>
                    </CardContent>
                </Card>
                
                <CompetitionSettings />

                <QuestionManagement 
                    preparedQuestions={preparedQuestions}
                    loadingQuestions={loadingQuestions}
                    currentDebateRound={currentDebateRound}
                    videoInputs={videoInputs}
                    setVideoInputs={setVideoInputs}
                    savingVideoId={savingVideoId}
                    onAddQuestion={handleAddQuestion}
                    onDeleteQuestion={handleDeleteQuestion}
                    onSaveVideoLink={handleSaveVideoLink}
                    onSendVideo={handleSendVideo}
                    onSendQuestion={handleSendQuestion}
                />
            </div>

            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="font-headline">Control del Debate</CardTitle>
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
            </div>
        </div>
    );
}

function AdminDashboard() {
  const { toast } = useToast();
  const [schools, setSchools] = useState<SchoolData[]>([]);
  const [judges, setJudges] = useState<JudgeData[]>([]);
  const [scores, setScores] = useState<ScoreData[]>([]);
  const [moderators, setModerators] = useState<ModeratorData[]>([]);

  const [loadingSchools, setLoadingSchools] = useState(true);
  const [loadingJudges, setLoadingJudges] = useState(true);
  const [loadingScores, setLoadingScores] = useState(true);
  const [loadingModerators, setLoadingModerators] = useState(true);
  
  const [newJudgeName, setNewJudgeName] = useState("");
  const [newJudgeCedula, setNewJudgeCedula] = useState("");
  const [isSubmittingJudge, setIsSubmittingJudge] = useState(false);
  
  const [newModeratorUsername, setNewModeratorUsername] = useState("");
  const [isSubmittingModerator, setIsSubmittingModerator] = useState(false);
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);


  useEffect(() => {
    const schoolsQuery = query(collection(db, "schools"), orderBy("createdAt", "desc"));
    const unsubscribeSchools = onSnapshot(schoolsQuery, (querySnapshot) => {
        const schoolsData: SchoolData[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            schoolsData.push({
                id: doc.id,
                schoolName: data.schoolName,
                teamName: data.teamName,
                status: data.status,
                participants: data.participants || [],
                attendees: data.attendees || [],
            });
        });
        setSchools(schoolsData);
        setLoadingSchools(false);
    }, (error) => {
        console.error("Error fetching schools:", error);
        setLoadingSchools(false);
    });

    const judgesQuery = query(collection(db, "judges"), orderBy("createdAt", "asc"));
    const unsubscribeJudges = onSnapshot(judgesQuery, (querySnapshot) => {
        const judgesData: JudgeData[] = [];
        querySnapshot.forEach((doc) => {
            judgesData.push({ id: doc.id, ...doc.data() } as JudgeData);
        });
        setJudges(judgesData);
        setLoadingJudges(false);
    }, (error) => {
        console.error("Error fetching judges:", error);
        setLoadingJudges(false);
    });

    const scoresQuery = query(collection(db, "scores"), orderBy("createdAt", "desc"));
    const unsubscribeScores = onSnapshot(scoresQuery, (querySnapshot) => {
        const scoresData: ScoreData[] = [];
        querySnapshot.forEach((doc) => {
            scoresData.push({ id: doc.id, ...doc.data()} as ScoreData);
        });
        setScores(scoresData);
        setLoadingScores(false);
    });
    
     const moderatorsQuery = query(collection(db, "moderators"), orderBy("createdAt", "asc"));
     const unsubscribeModerators = onSnapshot(moderatorsQuery, (querySnapshot) => {
        const moderatorsData: ModeratorData[] = [];
        querySnapshot.forEach((doc) => {
            moderatorsData.push({ id: doc.id, ...doc.data() } as ModeratorData);
        });
        setModerators(moderatorsData);
        setLoadingModerators(false);
     }, (error) => {
        console.error("Error fetching moderators:", error);
        setLoadingModerators(false);
     });


    return () => {
        unsubscribeSchools();
        unsubscribeJudges();
        unsubscribeScores();
        unsubscribeModerators();
    };
  }, []);

 const handleAddJudge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJudgeName.trim() || !newJudgeCedula.trim()) {
        toast({ variant: "destructive", title: "Error", description: "Nombre y cédula son requeridos." });
        return;
    }
    setIsSubmittingJudge(true);
    try {
        await addDoc(collection(db, "judges"), {
            name: newJudgeName,
            cedula: newJudgeCedula,
            createdAt: serverTimestamp(),
        });
        toast({ title: "Jurado Añadido", description: "El nuevo jurado ha sido registrado." });
        setNewJudgeName("");
        setNewJudgeCedula("");
    } catch (error) {
        console.error("Error adding judge:", error);
        toast({ variant: "destructive", title: "Error", description: "No se pudo añadir el jurado." });
    } finally {
        setIsSubmittingJudge(false);
    }
 };
 
   const handleAddModerator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModeratorUsername.trim()) {
        toast({ variant: "destructive", title: "Error", description: "El nombre de usuario es requerido." });
        return;
    }
    setIsSubmittingModerator(true);
    try {
        const existingModeratorQuery = query(collection(db, "moderators"), where("username", "==", newModeratorUsername.trim()));
        const existingModeratorSnapshot = await getDocs(existingModeratorQuery);
        if (!existingModeratorSnapshot.empty) {
            toast({ variant: "destructive", title: "Error", description: "Ese nombre de usuario ya existe." });
            return;
        }

        await addDoc(collection(db, "moderators"), {
            username: newModeratorUsername.trim(),
            token: nanoid(16), // Generate a 16-character secure token
            status: 'active',
            createdAt: serverTimestamp(),
        });
        toast({ title: "Moderador Creado", description: "Se ha creado un nuevo moderador con su token de acceso." });
        setNewModeratorUsername("");
    } catch (error) {
        console.error("Error adding moderator:", error);
        toast({ variant: "destructive", title: "Error", description: "No se pudo añadir el moderador." });
    } finally {
        setIsSubmittingModerator(false);
    }
  };

  const handleDeleteModerator = async (moderatorId: string) => {
    try {
      await deleteDoc(doc(db, "moderators", moderatorId));
      toast({ title: "Moderador Eliminado" });
    } catch (error) {
      console.error("Error deleting moderator:", error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar el moderador." });
    }
  };
  
  const handleToggleModeratorStatus = async (moderator: ModeratorData) => {
    const newStatus = moderator.status === 'active' ? 'inactive' : 'active';
    try {
        const moderatorRef = doc(db, "moderators", moderator.id);
        await updateDoc(moderatorRef, { status: newStatus });
        toast({
            title: "Estado Actualizado",
            description: `El token de ${moderator.username} ahora está ${newStatus === 'active' ? 'activo' : 'inactivo'}.`
        });
    } catch (error) {
         console.error("Error toggling moderator status:", error);
         toast({ variant: "destructive", title: "Error", description: "No se pudo cambiar el estado del moderador." });
    }
  }

  const copyToken = (token: string, id: string) => {
    navigator.clipboard.writeText(token);
    setCopiedTokenId(id);
    setTimeout(() => setCopiedTokenId(null), 2000);
  };
 
  const processedResults: MatchResults[] = scores.reduce((acc, score) => {
    let match = acc.find(m => m.matchId === score.matchId);
    if (!match) {
        match = { matchId: score.matchId, scores: [], totalTeamA: 0, totalTeamB: 0, winner: 'Tie' };
        acc.push(match);
    }
    match.scores.push(score);
    match.totalTeamA += score.teamA_total;
    match.totalTeamB += score.teamB_total;
    
    if (match.totalTeamA > match.totalTeamB) match.winner = 'teamA';
    else if (match.totalTeamB > match.totalTeamA) match.winner = 'teamB';
    else match.winner = 'Tie';

    return acc;
  }, [] as MatchResults[]);


  return (
    <div className="container mx-auto py-10 px-4 md:px-6">
      <div className="mb-8">
        <h1 className="font-headline text-3xl md:text-4xl font-bold">
          Panel de Administrador
        </h1>
        <p className="text-muted-foreground mt-2">
          Gestione todos los aspectos de la competencia Conversatorio Colgemelli.
        </p>
      </div>

      <Tabs defaultValue="schools" className="w-full">
        <TabsList className="grid w-full grid-cols-5 md:w-[800px]">
          <TabsTrigger value="schools"><School className="h-4 w-4 mr-2" />Colegios</TabsTrigger>
          <TabsTrigger value="judges"><User className="h-4 w-4 mr-2" />Jurados</TabsTrigger>
          <TabsTrigger value="moderators"><KeyRound className="h-4 w-4 mr-2" />Moderadores</TabsTrigger>
          <TabsTrigger value="debate-control"><Gavel className="h-4 w-4 mr-2" />Control del Debate</TabsTrigger>
          <TabsTrigger value="results"><Trophy className="h-4 w-4 mr-2"/>Resultados</TabsTrigger>
        </TabsList>
        <TabsContent value="schools">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Gestión de Colegios</CardTitle>
                    <CardDescription>
                        Añada, edite o elimine colegios participantes.
                    </CardDescription>
                </div>
                 <Button size="sm" className="gap-1" asChild>
                    <Link href="/register">
                      <PlusCircle className="h-3.5 w-3.5" />
                      Añadir Colegio
                    </Link>
                </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colegio (Equipo)</TableHead>
                    <TableHead className="text-center">Participantes</TableHead>
                    <TableHead className="text-center hidden md:table-cell">Asistentes</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>
                      <span className="sr-only">Acciones</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingSchools ? (
                    <TableRow>
                        <TableCell colSpan={5} className="text-center">Cargando colegios...</TableCell>
                    </TableRow>
                  ) : schools.map(school => (
                    <TableRow key={school.id}>
                        <TableCell className="font-medium">
                            <div>{school.schoolName}</div>
                            <div className="text-xs text-muted-foreground">{school.teamName}</div>
                        </TableCell>
                        <TableCell className="text-center">{school.participants.length}</TableCell>
                        <TableCell className="text-center hidden md:table-cell">{school.attendees.length}</TableCell>
                        <TableCell>
                            <Badge variant={school.status === 'Verificado' ? 'default' : 'secondary'}>{school.status}</Badge>
                        </TableCell>
                        <TableCell>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                <Button
                                    aria-haspopup="true"
                                    size="icon"
                                    variant="ghost"
                                >
                                    <MoreHorizontal className="h-4 w-4" />
                                    <span className="sr-only">Toggle menu</span>
                                </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                <DropdownMenuItem><FilePen className="mr-2 h-4 w-4"/>Editar</DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive"><Trash2 className="mr-2 h-4 w-4"/>Eliminar</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="judges">
            <div className="grid md:grid-cols-3 gap-6">
                <div className="md:col-span-1">
                     <Card>
                        <CardHeader>
                            <CardTitle>Añadir Jurado</CardTitle>
                            <CardDescription>Registre un nuevo jurado para la competencia.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleAddJudge} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="judge-name">Nombre completo</Label>
                                    <Input id="judge-name" value={newJudgeName} onChange={(e) => setNewJudgeName(e.target.value)} placeholder="Nombre del jurado" disabled={isSubmittingJudge}/>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="judge-cedula">Cédula</Label>
                                    <Input id="judge-cedula" value={newJudgeCedula} onChange={(e) => setNewJudgeCedula(e.target.value)} placeholder="Cédula del jurado" disabled={isSubmittingJudge}/>
                                </div>
                                <Button type="submit" className="w-full" disabled={isSubmittingJudge}>
                                     {isSubmittingJudge && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Añadir Jurado
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>
                <div className="md:col-span-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Jurados Registrados</CardTitle>
                            <CardDescription>Lista de jurados para la competencia.</CardDescription>
                        </CardHeader>
                        <CardContent>
                             <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[80px]">#</TableHead>
                                        <TableHead>Nombre</TableHead>
                                        <TableHead>Cédula</TableHead>
                                        <TableHead><span className="sr-only">Acciones</span></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loadingJudges ? (
                                         <TableRow>
                                            <TableCell colSpan={4} className="text-center">Cargando jurados...</TableCell>
                                        </TableRow>
                                    ) : judges.map((judge, index) => (
                                        <TableRow key={judge.id}>
                                            <TableCell className="font-medium">Jurado {index + 1}</TableCell>
                                            <TableCell>{judge.name}</TableCell>
                                            <TableCell>{judge.cedula}</TableCell>
                                            <TableCell>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button aria-haspopup="true" size="icon" variant="ghost">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                            <span className="sr-only">Toggle menu</span>
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                                        <DropdownMenuItem><FilePen className="mr-2 h-4 w-4"/>Editar</DropdownMenuItem>
                                                        <DropdownMenuItem className="text-destructive"><Trash2 className="mr-2 h-4 w-4"/>Eliminar</DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </TabsContent>
         <TabsContent value="moderators">
            <div className="grid md:grid-cols-3 gap-6">
                <div className="md:col-span-1">
                     <Card>
                        <CardHeader>
                            <CardTitle>Crear Moderador</CardTitle>
                            <CardDescription>Cree un nuevo acceso para un moderador.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleAddModerator} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="moderator-username">Nombre de usuario</Label>
                                    <Input id="moderator-username" value={newModeratorUsername} onChange={(e) => setNewModeratorUsername(e.target.value)} placeholder="Ej: moderador1" disabled={isSubmittingModerator}/>
                                </div>
                                <Button type="submit" className="w-full" disabled={isSubmittingModerator}>
                                     {isSubmittingModerator && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Crear Moderador
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>
                <div className="md:col-span-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Moderadores Activos</CardTitle>
                            <CardDescription>Lista de moderadores y sus tokens de acceso.</CardDescription>
                        </CardHeader>
                        <CardContent>
                             <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Usuario</TableHead>
                                        <TableHead>Token de Acceso</TableHead>
                                        <TableHead className="text-center">Estado</TableHead>
                                        <TableHead className="text-right">Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loadingModerators ? (
                                         <TableRow>
                                            <TableCell colSpan={4} className="text-center">Cargando moderadores...</TableCell>
                                        </TableRow>
                                    ) : moderators.map((mod) => (
                                        <TableRow key={mod.id}>
                                            <TableCell className="font-medium">{mod.username}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Input type="text" readOnly value={mod.token} className="font-mono text-xs h-8"/>
                                                     <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => copyToken(mod.token, mod.id)}>
                                                        {copiedTokenId === mod.id ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                                                     </Button>
                                                </div>
                                            </TableCell>
                                             <TableCell className="text-center">
                                                <Badge variant={mod.status === 'active' ? 'default' : 'destructive'}>
                                                    {mod.status === 'active' ? 'Activo' : 'Inactivo'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button aria-haspopup="true" size="icon" variant="ghost">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                            <span className="sr-only">Toggle menu</span>
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                                        <DropdownMenuItem onClick={() => handleToggleModeratorStatus(mod)}>
                                                            {mod.status === 'active' ? <ToggleLeft className="mr-2 h-4 w-4" /> : <ToggleRight className="mr-2 h-4 w-4" />}
                                                            {mod.status === 'active' ? 'Desactivar' : 'Activar'}
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteModerator(mod.id)}>
                                                            <Trash2 className="mr-2 h-4 w-4"/>Eliminar
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </TabsContent>
        <TabsContent value="debate-control">
          <DebateControl />
        </TabsContent>
         <TabsContent value="results">
          <Card>
            <CardHeader>
              <CardTitle>Resultados de las Rondas</CardTitle>
              <CardDescription>
                Resultados detallados de cada partida, jurado por jurado.
              </CardDescription>
            </CardHeader>
            <CardContent>
                {loadingScores && <p className="text-center">Cargando resultados...</p>}
                {!loadingScores && processedResults.length === 0 && <p className="text-center text-muted-foreground">Aún no hay resultados para mostrar.</p>}
                <Accordion type="single" collapsible className="w-full">
                    {processedResults.map(result => (
                        <AccordionItem value={result.matchId} key={result.matchId}>
                            <AccordionTrigger>
                                <div className="flex justify-between items-center w-full pr-4">
                                    <span className="font-bold text-lg capitalize">Ronda: {result.matchId.replace('-', ' ')}</span>
                                    <div className="text-right">
                                        <p className="text-sm">Ganador: <Badge variant={result.winner === 'teamA' ? 'default' : 'secondary'}>{result.winner === 'teamA' ? 'Equipo A' : result.winner === 'teamB' ? 'Equipo B' : 'Empate'}</Badge></p>
                                        <p className="text-xs text-muted-foreground">A: {result.totalTeamA} vs B: {result.totalTeamB}</p>
                                    </div>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent>
                               <Table>
                                 <TableHeader>
                                    <TableRow>
                                        <TableHead>Jurado</TableHead>
                                        <TableHead className="text-center">Puntaje Equipo A</TableHead>
                                        <TableHead className="text-center">Puntaje Equipo B</TableHead>
                                    </TableRow>
                                 </TableHeader>
                                 <TableBody>
                                    {result.scores.map(score => (
                                         <TableRow key={score.id}>
                                            <TableCell>{score.judgeName}</TableCell>
                                            <TableCell className="text-center">{score.teamA_total}</TableCell>
                                            <TableCell className="text-center">{score.teamB_total}</TableCell>
                                         </TableRow>
                                    ))}
                                     <TableRow className="bg-secondary font-bold">
                                        <TableCell>Total</TableCell>
                                        <TableCell className="text-center text-lg">{result.totalTeamA}</TableCell>
                                        <TableCell className="text-center text-lg">{result.totalTeamB}</TableCell>
                                     </TableRow>
                                 </TableBody>
                               </Table>
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function AdminPage() {
    return (
        <AdminAuth>
            <AdminDashboard />
        </AdminAuth>
    );
}
