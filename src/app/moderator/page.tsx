
"use client";

import { useState, useEffect } from "react";
import { Timer } from "@/components/timer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlayCircle, Video, Settings, Send, Trash2, Plus, Loader2, Link as LinkIcon, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { db } from "@/lib/firebase";
import { doc, setDoc, onSnapshot, collection, addDoc, query, orderBy, deleteDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { AdminAuth } from "@/components/auth/admin-auth";
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const DEBATE_STATE_DOC_ID = "current";

interface Question {
    id: string;
    text: string;
    round: string;
}

const debateRounds = ["Ronda 1", "Ronda 2", "Cuartos de Final", "Semifinal", "Final"];

function ModeratorDashboard() {
    const { toast } = useToast();
    const [mainTimer, setMainTimer] = useState({ duration: 5 * 60, label: "Temporizador General", lastUpdated: Date.now() });
    const [currentQuestion, setCurrentQuestion] = useState("Esperando pregunta del moderador...");
    const [currentDebateRound, setCurrentDebateRound] = useState("Ronda 1");
    
    // State for new question management
    const [newQuestionInput, setNewQuestionInput] = useState("");
    const [newQuestionRound, setNewQuestionRound] = useState("");
    const [isAddingQuestion, setIsAddingQuestion] = useState(false);
    const [preparedQuestions, setPreparedQuestions] = useState<Question[]>([]);
    const [loadingQuestions, setLoadingQuestions] = useState(true);
    
    // State for video links
    const [videoLinkA, setVideoLinkA] = useState("");
    const [videoLinkB, setVideoLinkB] = useState("");
    const [teamAName, setTeamAName] = useState("Equipo A");
    const [teamBName, setTeamBName] = useState("Equipo B");
    const [isSavingVideos, setIsSavingVideos] = useState(false);


    useEffect(() => {
        // Listener for the main debate state
        const debateStateRef = doc(db, "debateState", DEBATE_STATE_DOC_ID);
        const unsubscribeDebateState = onSnapshot(debateStateRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                if(data.question) setCurrentQuestion(data.question);
                if(data.timer) setMainTimer(prev => ({...prev, duration: data.timer.duration}));
                if(data.currentRound) setCurrentDebateRound(data.currentRound);
                if(data.videos) {
                    setVideoLinkA(data.videos.teamA.url || "");
                    setVideoLinkB(data.videos.teamB.url || "");
                    setTeamAName(data.videos.teamA.name || "Equipo A");
                    setTeamBName(data.videos.teamB.name || "Equipo B");
                }
            }
        }, (error) => {
            console.error("Error listening to debate state:", error);
        });

        // Listener for the list of prepared questions
        const questionsQuery = query(collection(db, "questions"), orderBy("createdAt", "asc"));
        const unsubscribeQuestions = onSnapshot(questionsQuery, (querySnapshot) => {
            const questionsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));
            setPreparedQuestions(questionsData);
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
    
    const handleSendQuestion = async (questionText: string) => {
        try {
            const docRef = doc(db, "debateState", DEBATE_STATE_DOC_ID);
            await setDoc(docRef, { question: questionText }, { merge: true });
            toast({
                title: "Pregunta Enviada",
                description: "La nueva pregunta es visible para los participantes.",
            });
        } catch (error) {
             console.error("Error setting question: ", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "No se pudo enviar la pregunta.",
            });
        }
    }

    const handleAddQuestion = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newQuestionInput.trim() || !newQuestionRound) {
             toast({ variant: "destructive", title: "Error", description: "Debe escribir una pregunta y seleccionar una ronda." });
            return;
        }
        setIsAddingQuestion(true);
        try {
            await addDoc(collection(db, "questions"), {
                text: newQuestionInput,
                round: newQuestionRound,
                createdAt: new Date()
            });
            setNewQuestionInput("");
            setNewQuestionRound("");
             toast({ title: "Pregunta Añadida", description: "La pregunta está lista en la sección correspondiente." });
        } catch(error) {
             console.error("Error adding question:", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudo añadir la pregunta." });
        } finally {
            setIsAddingQuestion(false);
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

    const handleSaveVideoLinks = async () => {
        setIsSavingVideos(true);
        try {
            const docRef = doc(db, "debateState", DEBATE_STATE_DOC_ID);
            await setDoc(docRef, { 
                videos: {
                    teamA: { name: teamAName, url: videoLinkA },
                    teamB: { name: teamBName, url: videoLinkB },
                }
             }, { merge: true });
            toast({ title: "Enlaces de Video Guardados", description: "Los enlaces se han actualizado." });
        } catch (error) {
             console.error("Error saving video links:", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudieron guardar los enlaces." });
        } finally {
            setIsSavingVideos(false);
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
    
    const questionsByRound = preparedQuestions.reduce((acc, q) => {
        (acc[q.round] = acc[q.round] || []).push(q);
        return acc;
    }, {} as Record<string, Question[]>);


    return (
        <div className="container mx-auto py-10 px-4 md:px-6">
            <div className="mb-8">
                <h1 className="font-headline text-3xl md:text-4xl font-bold">
                    Panel de Moderador
                </h1>
                <p className="text-muted-foreground mt-2">
                    Gestione la ronda de debate actual en tiempo real. Ronda activa: <span className="font-bold text-foreground">{currentDebateRound}</span>
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                             <CardTitle className="flex items-center gap-2"><Video className="h-6 w-6"/> Gestión de Videos</CardTitle>
                            <CardDescription>Pegue los enlaces de video de OneDrive u otra plataforma para cada equipo.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                             <div className="grid md:grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <Label htmlFor="team-a-name">Nombre Equipo A</Label>
                                    <Input id="team-a-name" value={teamAName} onChange={(e) => setTeamAName(e.target.value)} placeholder="Ej: Águilas Doradas"/>
                                    <Label htmlFor="video-link-a">Enlace Video Equipo A</Label>
                                    <Input id="video-link-a" type="url" placeholder="https://onedrive.live.com/..." value={videoLinkA} onChange={e => setVideoLinkA(e.target.value)} disabled={isSavingVideos}/>
                                </div>
                                <div className="space-y-3">
                                    <Label htmlFor="team-b-name">Nombre Equipo B</Label>
                                    <Input id="team-b-name" value={teamBName} onChange={(e) => setTeamBName(e.target.value)} placeholder="Ej: Búhos Sabios"/>
                                    <Label htmlFor="video-link-b">Enlace Video Equipo B</Label>
                                    <Input id="video-link-b" type="url" placeholder="https://onedrive.live.com/..." value={videoLinkB} onChange={e => setVideoLinkB(e.target.value)} disabled={isSavingVideos}/>
                                </div>
                            </div>
                            <Button onClick={handleSaveVideoLinks} disabled={isSavingVideos}>
                                {isSavingVideos ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                                Guardar Enlaces
                            </Button>
                             <div className="grid md:grid-cols-2 gap-6 pt-4">
                                {videoLinkA ? (
                                    <a href={videoLinkA} target="_blank" rel="noopener noreferrer" className="block">
                                        <Card className="hover:border-primary transition-colors">
                                            <CardHeader>
                                                <CardTitle className="text-lg">{teamAName}</CardTitle>
                                            </CardHeader>
                                            <CardContent className="aspect-video bg-muted flex items-center justify-center rounded-b-lg">
                                                <div className="text-center text-primary">
                                                    <PlayCircle className="mx-auto h-12 w-12" />
                                                    <p>Abrir video</p>
                                                </div>
                                            </CardContent>
                                        </Card>
                                     </a>
                                ) : <div />}
                                {videoLinkB ? (
                                     <a href={videoLinkB} target="_blank" rel="noopener noreferrer" className="block">
                                        <Card className="hover:border-primary transition-colors">
                                             <CardHeader>
                                                <CardTitle className="text-lg">{teamBName}</CardTitle>
                                            </CardHeader>
                                            <CardContent className="aspect-video bg-muted flex items-center justify-center rounded-b-lg">
                                                <div className="text-center text-primary">
                                                    <PlayCircle className="mx-auto h-12 w-12" />
                                                    <p>Abrir video</p>
                                                </div>
                                            </CardContent>
                                        </Card>
                                     </a>
                                ) : <div />}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="font-headline">Control del Debate</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                           <div>
                                <Timer key={mainTimer.lastUpdated} initialTime={mainTimer.duration} title={mainTimer.label} />
                                <div className="mt-2">
                                     <TimerSettings />
                                </div>
                           </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>Gestión de Preguntas</CardTitle>
                             <CardDescription>
                                Prepare, envíe y gestione las preguntas del debate por ronda.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <h3 className="font-medium mb-2">Pregunta Activa:</h3>
                                <p className="text-sm p-3 bg-secondary rounded-md min-h-[60px]">
                                    {currentQuestion}
                                </p>
                            </div>
                           
                            <form onSubmit={handleAddQuestion} className="space-y-3 p-3 border rounded-lg">
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
                                            <AccordionContent>
                                                 <div className="space-y-2">
                                                    {questionsByRound[round].map(q => (
                                                        <div key={q.id} className="flex items-center gap-2 bg-background p-2 rounded-md border">
                                                            <p className="flex-grow text-sm">{q.text}</p>
                                                            <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => handleSendQuestion(q.text)} title="Enviar Pregunta">
                                                                <Send className="h-4 w-4" />
                                                            </Button>
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-destructive hover:text-destructive" title="Eliminar Pregunta">
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent>
                                                                    <AlertDialogHeader>
                                                                    <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
                                                                    <AlertDialogDescription>
                                                                        Esta acción no se puede deshacer. Se eliminará la pregunta de la lista de preparación.
                                                                    </AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter>
                                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                                    <AlertDialogAction onClick={() => handleDeleteQuestion(q.id)} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        </div>
                                                    ))}
                                                 </div>
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
                </div>
            </div>
        </div>
    );
}

export default function ModeratorPage() {
    return (
        <AdminAuth>
            <ModeratorDashboard />
        </AdminAuth>
    );
}

    