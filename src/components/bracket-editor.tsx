
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
import { db } from '@/lib/firebase';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { useToast } from "@/hooks/use-toast";
import { Slider } from './ui/slider';


const DEBATE_STATE_DOC_ID = "current";


export function BracketEditor() {
    const { toast } = useToast();
    const [bracketTitle, setBracketTitle] = useState("¿QUÉ SIGNIFICA SER JOVEN DEL SIGLO XXI?");
    const [bracketSubtitle, setBracketSubtitle] = useState("Debate Intercolegial");
    const [bracketCanvaUrl, setBracketCanvaUrl] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const docRef = doc(db, "debateState", DEBATE_STATE_DOC_ID);
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setBracketTitle(data.bracketTitle || "¿QUÉ SIGNIFICA SER JOVEN DEL SIGLO XXI?");
                setBracketSubtitle(data.bracketSubtitle || "Debate Intercolegial");
                setBracketCanvaUrl(data.bracketCanvaUrl || "");
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
                bracketCanvaUrl,
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
                <CardDescription>Personalice el enlace de Canva que se muestra en el bracket del torneo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="bracket-canva-url">URL del Bracket de Canva</Label>
                    <Input id="bracket-canva-url" placeholder="Pegue el enlace para compartir de Canva" value={bracketCanvaUrl} onChange={(e) => setBracketCanvaUrl(e.target.value)} />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="bracket-title">Título Principal (No se usa con Canva)</Label>
                    <Input id="bracket-title" value={bracketTitle} onChange={(e) => setBracketTitle(e.target.value)} disabled />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="bracket-subtitle">Subtítulo (No se usa con Canva)</Label>
                    <Input id="bracket-subtitle" value={bracketSubtitle} onChange={(e) => setBracketSubtitle(e.target.value)} disabled />
                </div>
                <Button className="w-full" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                    Guardar Cambios
                </Button>
            </CardContent>
        </Card>
    );
}

