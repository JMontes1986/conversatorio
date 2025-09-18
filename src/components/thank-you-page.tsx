
"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Trophy } from 'lucide-react';
import Confetti from 'react-confetti';
import { useWindowSize } from "@/hooks/use-window-size";
import Image from "next/image";
import Link from "next/link";
import { Button } from "./ui/button";

export function ThankYouPage() {
    const { width, height } = useWindowSize();
    const [showConfetti, setShowConfetti] = useState(false);

    useEffect(() => {
        // Trigger confetti on component mount
        setShowConfetti(true);
        // Optional: stop confetti after some time
        const timer = setTimeout(() => setShowConfetti(false), 10000);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="flex flex-col min-h-screen bg-secondary">
             {showConfetti && width && height && <Confetti width={width} height={height} recycle={false} numberOfPieces={500} />}
             <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container mx-auto flex h-20 items-center justify-between px-4 md:px-6">
                    <div className="flex items-center gap-2">
                        <Image src="https://mbosvnmhnbrslfwlfcxu.supabase.co/storage/v1/object/public/Software/Logo%20Slogan%20Nuevo%20FINAL-05.png" alt="Logo Colgemelli" width={60} height={60} style={{ height: 'auto' }}/>
                        <span className="font-headline text-xl font-bold">
                            Conversatorio Colgemelli
                        </span>
                    </div>
                     <Button asChild>
                        <Link href="/admin">
                            Acceso Admin
                        </Link>
                    </Button>
                </div>
            </header>
            <main className="flex-grow flex items-center justify-center p-4">
                <Card className="w-full max-w-lg text-center animate-in fade-in-50 zoom-in-95">
                    <CardHeader>
                        <Trophy className="mx-auto h-16 w-16 text-amber-500 mb-4" />
                        <CardTitle className="font-headline text-3xl md:text-4xl">¡El Evento ha Concluido!</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <CardDescription className="text-base md:text-lg">
                            El Colegio Franciscano Agustín Gemelli agradece a todos los colegios participantes, jurados, moderadores, y al público por hacer de este Conversatorio Colgemelli una experiencia inolvidable.
                        </CardDescription>
                        <p className="mt-4 font-semibold text-foreground">¡Nos vemos en la próxima edición!</p>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
