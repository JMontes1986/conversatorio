
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

    useEffect(() => {
        const docRef = doc(db, "debateState", DEBATE_STATE_DOC_ID);

        const unsubscribe = onSnapshot(docRef, (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                setDebateState({
                    question: data.question || "Esperando la pregunta del moderador...",
                    timer: data.timer ? { ...data.timer, lastUpdated: Date.now() } : { duration: 300, lastUpdated: Date.now() },
                    currentRound: data.currentRound || "Ronda de Debate",
                    videoUrl: data.videoUrl || ""
                });

            } else {
                console.log("No such document!");
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
    
    // New logic: Show question if it exists, otherwise show video prompt if URL exists.
    const showQuestion = debateState.question && debateState.question !== "Esperando la pregunta del moderador...";
    const showVideo = !showQuestion && isValidHttpUrl(debateState.videoUrl);

    let mainContent;

    if (showQuestion) {
        mainContent = (
            <p className="text-3xl md:text-4xl lg:text-5xl font-medium leading-tight">
                {debateState.question}
            </p>
        );
    } else if (showVideo) {
        mainContent = (
             <div className="flex flex-col items-center gap-6">
                <p className="text-3xl md:text-4xl lg:text-5xl font-medium leading-tight">
                    Por favor, observe el video presentado.
                </p>
                 <Button asChild size="lg">
                    <a href={debateState.videoUrl} target="_blank" rel="noopener noreferrer">
                        <Video className="mr-2 h-5 w-5"/> Ver Video en OneDrive
                    </a>
                </Button>
            </div>
        );
    } else {
        mainContent = (
             <p className="text-3xl md:text-4xl lg:text-5xl font-medium leading-tight">
                {debateState.question}
            </p>
        );
    }
    
    return (
        <>
            <div className="container mx-auto py-10 px-4 md:px-6 flex flex-col justify-center items-center min-h-[calc(100vh-200px)]">
                <div className="w-full max-w-5xl space-y-8 text-center">
                     <div>
                        <h1 className="font-headline text-3xl md:text-4xl font-bold capitalize">
                            {debateState.currentRound}
                        </h1>
                        <p className="text-muted-foreground mt-2">
                            Siga las instrucciones del moderador.
                        </p>
                    </div>

                    <div className="bg-secondary/50 rounded-xl p-8 md:p-12 min-h-[300px] flex items-center justify-center">
                       {mainContent}
                    </div>

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
