
"use client";

import { useState, useEffect } from "react";
import { Timer } from "@/components/timer";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { VideoEmbed } from "@/components/video-embed";

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

    const showVideo = debateState.videoUrl;
    const showQuestion = !showVideo;

    return (
        <div className="container mx-auto py-10 px-4 md:px-6 flex flex-col justify-center items-center min-h-[calc(100vh-200px)]">
            <div className="w-full max-w-5xl space-y-8 text-center">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="text-center md:text-left">
                            <h1 className="font-headline text-3xl md:text-4xl font-bold capitalize">
                                {debateState.currentRound}
                            </h1>
                            <p className="text-muted-foreground mt-2">
                                Siga las instrucciones del moderador.
                            </p>
                        </div>
                        <div className="shrink-0">
                             <Timer 
                                key={debateState.timer.lastUpdated}
                                initialTime={debateState.timer.duration}
                                title="Tiempo"
                                showControls={false}
                                size="small"
                            />
                        </div>
                    </div>

                <div className="bg-secondary/50 rounded-xl p-8 md:p-12 min-h-[400px] flex items-center justify-center">
                   <div className="space-y-6 w-full">
                        {showVideo && <VideoEmbed url={debateState.videoUrl} />}
                        {showQuestion && (
                            <p className="text-4xl md:text-5xl lg:text-6xl font-medium leading-tight">
                                {debateState.question}
                            </p>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
