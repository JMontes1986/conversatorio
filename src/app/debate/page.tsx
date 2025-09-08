
"use client";

import { useState, useEffect } from "react";
import { Timer } from "@/components/timer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { MessageSquare, Clock } from "lucide-react";

const DEBATE_STATE_DOC_ID = "current";

export default function DebatePage() {
    const [debateState, setDebateState] = useState({
        question: "Esperando la pregunta del moderador...",
        timer: { duration: 300, lastUpdated: Date.now() },
    });

    useEffect(() => {
        const docRef = doc(db, "debateState", DEBATE_STATE_DOC_ID);

        const unsubscribe = onSnapshot(docRef, (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                setDebateState(prevState => ({
                    question: data.question || prevState.question,
                    timer: data.timer ? { ...data.timer, lastUpdated: Date.now() } : prevState.timer,
                }));
            } else {
                console.log("No such document!");
            }
        });

        return () => unsubscribe();
    }, []);

    return (
        <div className="container mx-auto py-10 px-4 md:px-6 flex justify-center items-center min-h-[calc(100vh-200px)]">
            <div className="w-full max-w-4xl space-y-8">
                 <div className="text-center">
                    <h1 className="font-headline text-3xl md:text-4xl font-bold">
                        Ronda de Debate
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        Siga la pregunta y el tiempo asignado.
                    </p>
                </div>

                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-3 font-headline text-2xl">
                            <MessageSquare className="h-7 w-7 text-primary" />
                            Pregunta Actual
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xl md:text-2xl text-center font-medium p-6 bg-secondary rounded-lg min-h-[150px] flex items-center justify-center">
                            {debateState.question}
                        </p>
                    </CardContent>
                </Card>

                 <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-3 font-headline text-2xl">
                           <Clock className="h-7 w-7 text-primary" />
                            Tiempo Restante
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex justify-center">
                        <Timer 
                            key={debateState.timer.lastUpdated}
                            initialTime={debateState.timer.duration}
                            title="Temporizador del Debate"
                        />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
