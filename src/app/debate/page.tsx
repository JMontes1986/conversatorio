
"use client";

import { useState, useEffect } from "react";
import { Timer } from "@/components/timer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { MessageSquare, Video } from "lucide-react";
import { Button } from "@/components/ui/button";

const DEBATE_STATE_DOC_ID = "current";

export default function DebatePage() {
    const [debateState, setDebateState] = useState({
        question: "Esperando la pregunta del moderador...",
        timer: { duration: 300, lastUpdated: Date.now() },
        currentRound: "Ronda de Debate",
        videoUrl: ""
    });
    const [showVideoPrompt, setShowVideoPrompt] = useState(false);

    useEffect(() => {
        const docRef = doc(db, "debateState", DEBATE_STATE_DOC_ID);

        const unsubscribe = onSnapshot(docRef, (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                const questionText = data.question || "Esperando la pregunta del moderador...";
                const videoUrl = data.videoUrl || "";
                
                setDebateState(prevState => ({
                    question: questionText,
                    timer: data.timer ? { ...data.timer, lastUpdated: Date.now() } : prevState.timer,
                    currentRound: data.currentRound || prevState.currentRound,
                    videoUrl: videoUrl
                }));

                // Logic to decide what to show
                if(videoUrl && !data.question) {
                     setShowVideoPrompt(true);
                } else {
                    setShowVideoPrompt(false);
                }

            } else {
                console.log("No such document!");
                setShowVideoPrompt(false);
            }
        });

        return () => unsubscribe();
    }, []);

    const isValidHttpUrl = (str: string) => {
        try {
            const url = new URL(str);
            return url.protocol === "http:" || url.protocol === "https:";
        } catch (_) {
            return false;  
        }
    }
    
    return (
        <>
            <div className="container mx-auto py-10 px-4 md:px-6 flex justify-center items-center min-h-[calc(100vh-200px)]">
                <div className="w-full max-w-4xl space-y-8">
                     <div className="text-center">
                        <h1 className="font-headline text-3xl md:text-4xl font-bold capitalize">
                            {debateState.currentRound}
                        </h1>
                        <p className="text-muted-foreground mt-2">
                            Siga la pregunta, el video y el tiempo asignado.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-8 items-start">
                        <Card className="shadow-lg h-full">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-3 font-headline text-2xl">
                                    <MessageSquare className="h-7 w-7 text-primary" />
                                    Pregunta Actual
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-xl md:text-2xl text-center font-medium p-6 bg-secondary rounded-lg min-h-[200px] flex items-center justify-center">
                                    {showVideoPrompt ? "Por favor, observe el video presentado." : debateState.question}
                                </p>
                            </CardContent>
                        </Card>
                        
                        <Card className="shadow-lg h-full">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-3 font-headline text-2xl">
                                    <Video className="h-7 w-7 text-primary" />
                                    Video de la Ronda
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="aspect-video bg-secondary rounded-lg flex items-center justify-center text-center p-4">
                                {isValidHttpUrl(debateState.videoUrl) ? (
                                    <Button asChild size="lg">
                                        <a href={debateState.videoUrl} target="_blank" rel="noopener noreferrer">
                                            Ver Video en OneDrive
                                        </a>
                                    </Button>
                                ) : (
                                    <p className="text-muted-foreground">No hay video para esta ronda.</p>
                                )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
            
            <div className="fixed bottom-6 right-6 z-50">
                 <Timer 
                    key={debateState.timer.lastUpdated}
                    initialTime={debateState.timer.duration}
                    title="Temporizador"
                />
            </div>
        </>
    );
}
