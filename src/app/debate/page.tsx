
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
    
    const questionToShow = showVideoPrompt ? "Por favor, observe el video presentado." : debateState.question;
    
    return (
        <>
            <div className="container mx-auto py-10 px-4 md:px-6 flex flex-col justify-center items-center min-h-[calc(100vh-200px)]">
                <div className="w-full max-w-5xl space-y-8 text-center">
                     <div>
                        <h1 className="font-headline text-3xl md:text-4xl font-bold capitalize">
                            {debateState.currentRound}
                        </h1>
                        <p className="text-muted-foreground mt-2">
                            Siga la pregunta, el video y el tiempo asignado.
                        </p>
                    </div>

                    <div className="bg-secondary/50 rounded-xl p-8 md:p-12 min-h-[300px] flex items-center justify-center">
                        <p className="text-3xl md:text-4xl lg:text-5xl font-medium leading-tight">
                            {questionToShow}
                        </p>
                    </div>

                    {isValidHttpUrl(debateState.videoUrl) && (
                         <div className="flex flex-col items-center gap-4">
                            <p className="text-muted-foreground">Hay un video disponible para esta ronda.</p>
                             <Button asChild size="lg">
                                <a href={debateState.videoUrl} target="_blank" rel="noopener noreferrer">
                                    <Video className="mr-2 h-5 w-5"/> Ver Video en OneDrive
                                </a>
                            </Button>
                        </div>
                    )}
                </div>
            </div>
            
            <div className="fixed bottom-6 right-6 z-50">
                 <Timer 
                    key={debateState.timer.lastUpdated}
                    initialTime={debateState.timer.duration}
                    title="Tiempo"
                    showControls={false}
                />
            </div>
        </>
    );
}
