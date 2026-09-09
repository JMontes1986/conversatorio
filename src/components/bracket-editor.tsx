
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, PenLine } from "lucide-react";
import { db } from '@/lib/supabase';
import { doc, setDoc, onSnapshot } from '@/lib/documents';
import { useToast } from "@/hooks/use-toast";


const DEBATE_STATE_DOC_ID = "current";


export function BracketEditor() {
    const { toast } = useToast();
    const [bracketTitle, setBracketTitle] = useState("¿QUÉ SIGNIFICA SER JOVEN DEL SIGLO XXI?");
    const [bracketSubtitle, setBracketSubtitle] = useState("Debate Intercolegial");
    const [isSaving, setIsSaving] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const docRef = doc(db, "debateState", DEBATE_STATE_DOC_ID);
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setBracketTitle(data.bracketTitle || "¿QUÉ SIGNIFICA SER JOVEN DEL SIGLO XXI?");
                setBracketSubtitle(data.bracketSubtitle || "Debate Intercolegial");
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const docRef = doc(db, "debateState", DEBATE_STATE_DOC_ID);
            await setDoc(docRef, { 
                bracketTitle,
                bracketSubtitle,
            }, { merge: true });
            toast({ title: "Ajustes del Bracket Guardados" });
        } catch (error) {
            console.error("Error saving bracket settings:", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudieron guardar los ajustes del bracket." });
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><PenLine className="h-5 w-5"/>Editor del Bracket</CardTitle>
                </CardHeader>
                <CardContent className="flex justify-center items-center h-24">
                     <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><PenLine className="h-5 w-5"/>Editor del Bracket</CardTitle>
                <CardDescription>
                    Personalice el encabezado del bracket nativo. Los equipos y resultados se actualizan automáticamente desde el torneo.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="bracket-title">Título principal</Label>
                    <Input id="bracket-title" value={bracketTitle} onChange={(e) => setBracketTitle(e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="bracket-subtitle">Subtítulo</Label>
                    <Input id="bracket-subtitle" value={bracketSubtitle} onChange={(e) => setBracketSubtitle(e.target.value)} />
                </div>
                <Button className="w-full" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                    Guardar Cambios
                </Button>
            </CardContent>
        </Card>
    );
}
