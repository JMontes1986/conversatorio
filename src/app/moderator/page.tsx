
"use client";

import { useState, useEffect } from "react";
import { Timer } from "@/components/timer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlayCircle, Video, Settings, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { db } from "@/lib/firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

const DEBATE_STATE_DOC_ID = "current";

export default function ModeratorPage() {
    const { toast } = useToast();
    const [mainTimer, setMainTimer] = useState({ duration: 5 * 60, label: "Temporizador General", lastUpdated: Date.now() });
    const [currentQuestion, setCurrentQuestion] = useState("Esperando pregunta del moderador...");
    const [questionInput, setQuestionInput] = useState("");

    useEffect(() => {
        const fetchDebateState = async () => {
            const docRef = doc(db, "debateState", DEBATE_STATE_DOC_ID);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                if(data.question) {
                    setCurrentQuestion(data.question);
                    setQuestionInput(data.question);
                }
                if(data.timer) {
                    setMainTimer(prev => ({...prev, duration: data.timer.duration}));
                }
            }
        };
        fetchDebateState();
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
    
    const handleSetQuestion = async () => {
        if(!questionInput.trim()) return;
        setCurrentQuestion(questionInput);
        try {
            const docRef = doc(db, "debateState", DEBATE_STATE_DOC_ID);
            await setDoc(docRef, { question: questionInput }, { merge: true });
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
                    Gestione la ronda de debate actual en tiempo real.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                     <div className="grid md:grid-cols-2 gap-6">
                        <Card className="relative overflow-hidden">
                            <CardHeader>
                                <CardTitle>Equipo A: Águilas Doradas</CardTitle>
                            </CardHeader>
                            <CardContent className="aspect-video bg-muted flex items-center justify-center">
                                <div className="text-center text-muted-foreground">
                                    <Video className="mx-auto h-12 w-12" />
                                    <p>Esperando video</p>
                                </div>
                            </CardContent>
                            <Button size="sm" className="absolute top-4 right-4 gap-2">
                                <PlayCircle className="h-4 w-4" />
                                Iniciar
                            </Button>
                        </Card>
                        <Card className="relative overflow-hidden">
                            <CardHeader>
                                <CardTitle>Equipo B: Búhos Sabios</CardTitle>
                            </CardHeader>
                            <CardContent className="aspect-video bg-muted flex items-center justify-center">
                                <div className="text-center text-muted-foreground">
                                    <Video className="mx-auto h-12 w-12" />
                                    <p>Esperando video</p>
                                </div>
                            </CardContent>
                            <Button size="sm" className="absolute top-4 right-4 gap-2">
                                <PlayCircle className="h-4 w-4" />
                                Iniciar
                            </Button>
                        </Card>
                    </div>
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
                                Envíe la pregunta que los equipos debatirán.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div>
                                    <h3 className="font-medium mb-2">Pregunta Actual:</h3>
                                    <p className="text-sm p-3 bg-secondary rounded-md min-h-[60px]">
                                        {currentQuestion}
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="question-input">Nueva Pregunta</Label>
                                    <Textarea 
                                        id="question-input"
                                        placeholder="Escriba la nueva pregunta aquí..."
                                        value={questionInput}
                                        onChange={(e) => setQuestionInput(e.target.value)}
                                        rows={4}
                                    />
                                </div>
                                <Button onClick={handleSetQuestion} className="w-full">
                                    <Send className="mr-2 h-4 w-4"/>
                                    Enviar Pregunta
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
