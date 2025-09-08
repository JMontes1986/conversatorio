

"use client";

import { useState, useEffect } from "react";
import { Timer } from "@/components/timer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Video, Settings, Send, Trash2, Plus, Loader2, Save, MessageSquare, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { db } from "@/lib/firebase";
import { doc, setDoc, onSnapshot, collection, addDoc, query, orderBy, deleteDoc, updateDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
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
import { ModeratorAuth } from "@/components/auth/moderator-auth";

const DEBATE_STATE_DOC_ID = "current";

interface Question {
    id: string;
    text: string;
    round: string;
    videoUrl?: string;
}

const debateRounds = ["Ronda 1", "Ronda 2", "Cuartos de Final", "Semifinal", "Final"];

function CompetitionSettings() {
    const { toast } = useToast();
    const [currentRound, setCurrentRound] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const DEBATE_STATE_DOC_ID = "current";

    const handleUpdateRound = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentRound) {
            toast({ variant: "destructive", title: "Error", description: "Por favor seleccione una ronda." });
            return;
        }
        setIsSubmitting(true);
        try {
            const docRef = doc(db, "debateState", DEBATE_STATE_DOC_ID);
            await setDoc(docRef, { currentRound: currentRound }, { merge: true });
            toast({ title: "Ronda Actualizada", description: `La ronda activa ahora es: ${currentRound}.` });
        } catch (error) {
            console.error("Error updating round:", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar la ronda." });
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Ajustes de la Competencia</CardTitle>
                <CardDescription>Configuración general de la competencia.</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleUpdateRound} className="space-y-4 max-w-sm">
                    <div className="space-y-2">
                        <Label htmlFor="current-round">Ronda de Debate Activa</Label>
                         <Select onValueChange={setCurrentRound} value={currentRound} disabled={isSubmitting}>
                            <SelectTrigger id="current-round">
                                <SelectValue placeholder="Seleccione la ronda actual" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Ronda 1">Ronda 1</SelectItem>
                                <SelectItem value="Ronda 2">Ronda 2</SelectItem>
                                <SelectItem value="Cuartos de Final">Cuartos de Final</SelectItem>
                                <SelectItem value="Semifinal">Semifinal</SelectItem>
                                <SelectItem value="Final">Final</SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">Esta será la ronda que se mostrará públicamente en la página de Debate.</p>
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


function ModeratorDashboard() {
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
        </div>
    );
}

export default function ModeratorPage() {
    return (
        <ModeratorAuth>
            <ModeratorDashboard />
        </ModeratorAuth>
    );
}
