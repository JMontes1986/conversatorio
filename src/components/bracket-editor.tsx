
"use client";

import { useEffect, useRef, useState } from 'react';
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
import { ArrowDown, ArrowUp, Bot, GripVertical, Loader2, PenLine, RotateCcw, Save, SlidersHorizontal } from "lucide-react";
import { db } from '@/lib/supabase';
import { collection, doc, onSnapshot, orderBy, query, setDoc } from '@/lib/documents';
import { useToast } from "@/hooks/use-toast";
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';


const DEBATE_STATE_DOC_ID = "current";
type SeedingMode = "automatic" | "manual";

type SchoolData = {
    teamName?: string;
    schoolName?: string;
    status?: string;
};

function sanitizeTeamNames(names: unknown[]) {
    const seen = new Set<string>();
    const result: string[] = [];
    names.forEach((name) => {
        if (typeof name !== "string") return;
        const normalized = name.trim().normalize("NFC");
        if (!normalized || seen.has(normalized)) return;
        seen.add(normalized);
        result.push(normalized);
    });
    return result;
}


export function BracketEditor() {
    const { toast } = useToast();
    const [bracketTitle, setBracketTitle] = useState("¿QUÉ SIGNIFICA SER JOVEN DEL SIGLO XXI?");
    const [bracketSubtitle, setBracketSubtitle] = useState("Debate Intercolegial");
    const [seedingMode, setSeedingMode] = useState<SeedingMode>("automatic");
    const [registeredTeams, setRegisteredTeams] = useState<string[]>([]);
    const [teamOrder, setTeamOrder] = useState<string[]>([]);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [loadingConfig, setLoadingConfig] = useState(true);
    const [loadingTeams, setLoadingTeams] = useState(true);
    const hasLocalChanges = useRef(false);

    useEffect(() => {
        const docRef = doc(db, "debateState", DEBATE_STATE_DOC_ID);
        const unsubscribeConfig = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists() && !hasLocalChanges.current) {
                const data = docSnap.data();
                setBracketTitle(data.bracketTitle || "¿QUÉ SIGNIFICA SER JOVEN DEL SIGLO XXI?");
                setBracketSubtitle(data.bracketSubtitle || "Debate Intercolegial");
                setSeedingMode(data.bracketSeedingMode === "manual" ? "manual" : "automatic");
                setTeamOrder(Array.isArray(data.bracketTeamOrder)
                    ? sanitizeTeamNames(data.bracketTeamOrder)
                    : []);
            }
            setLoadingConfig(false);
        });

        const unsubscribeTeams = onSnapshot(
            query(collection(db, "schools"), orderBy("createdAt", "asc")),
            (snapshot) => {
                const names = sanitizeTeamNames(snapshot.docs.flatMap((school) => {
                    const data = school.data() as SchoolData;
                    if (data.status !== "Verificado") return [];
                    return [data.teamName || data.schoolName || ""];
                }));
                setRegisteredTeams(names);
                setLoadingTeams(false);
            },
            (error) => {
                console.error("Error loading teams for bracket editor:", error);
                setLoadingTeams(false);
            },
        );

        return () => {
            unsubscribeConfig();
            unsubscribeTeams();
        };
    }, []);

    useEffect(() => {
        setTeamOrder((currentOrder) => {
            const registeredSet = new Set(registeredTeams);
            const availableCurrentOrder = currentOrder.filter((team) => registeredSet.has(team));
            const currentSet = new Set(availableCurrentOrder);
            return [
                ...availableCurrentOrder,
                ...registeredTeams.filter((team) => !currentSet.has(team)),
            ];
        });
    }, [registeredTeams]);

    const markChanged = () => {
        hasLocalChanges.current = true;
    };

    const changeMode = (mode: SeedingMode) => {
        markChanged();
        setSeedingMode(mode);
    };

    const moveTeam = (fromIndex: number, toIndex: number) => {
        if (toIndex < 0 || toIndex >= teamOrder.length) return;
        markChanged();
        setTeamOrder((currentOrder) => {
            const nextOrder = [...currentOrder];
            const [team] = nextOrder.splice(fromIndex, 1);
            nextOrder.splice(toIndex, 0, team);
            return nextOrder;
        });
    };

    const resetTeamOrder = () => {
        markChanged();
        setTeamOrder(registeredTeams);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const docRef = doc(db, "debateState", DEBATE_STATE_DOC_ID);
            const updatedAt = new Date().toISOString();
            await setDoc(docRef, { 
                bracketTitle,
                bracketSubtitle,
                bracketSeedingMode: seedingMode,
                bracketTeamOrder: teamOrder,
                bracketTeams: registeredTeams,
                bracketManualAccepted: seedingMode === "manual",
                bracketManualAcceptedAt: seedingMode === "manual" ? updatedAt : null,
                bracketConfigurationUpdatedAt: updatedAt,
            }, { merge: true });
            hasLocalChanges.current = false;
            toast(seedingMode === "manual" ? {
                title: "Organización manual aceptada",
                description: "El orden definido por el administrador ya tiene prioridad sobre el sorteo automático.",
            } : {
                title: "Modo automático activado",
                description: "El bracket volverá a utilizar únicamente el sorteo SHA-256 verificado.",
            });
        } catch (error) {
            console.error("Error saving bracket settings:", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudieron guardar los ajustes del bracket." });
        } finally {
            setIsSaving(false);
        }
    };

    if (loadingConfig || loadingTeams) {
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
                    Personalice el encabezado y decida si las llaves se forman con el sorteo o con un orden manual.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="bracket-title">Título principal</Label>
                    <Input id="bracket-title" value={bracketTitle} onChange={(e) => {
                        markChanged();
                        setBracketTitle(e.target.value);
                    }} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="bracket-subtitle">Subtítulo</Label>
                    <Input id="bracket-subtitle" value={bracketSubtitle} onChange={(e) => {
                        markChanged();
                        setBracketSubtitle(e.target.value);
                    }} />
                </div>
                <div className="space-y-3 rounded-lg border p-4">
                    <div>
                        <p className="text-sm font-medium">Organización de las llaves</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            El modo automático usa el sorteo SHA-256 verificado y sus rondas. En modo manual, cada dos posiciones consecutivas forman un enfrentamiento.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <Button
                            type="button"
                            variant={seedingMode === "automatic" ? "default" : "outline"}
                            aria-pressed={seedingMode === "automatic"}
                            onClick={() => changeMode("automatic")}
                        >
                            <Bot className="mr-2 h-4 w-4" /> Automático
                        </Button>
                        <Button
                            type="button"
                            variant={seedingMode === "manual" ? "default" : "outline"}
                            aria-pressed={seedingMode === "manual"}
                            onClick={() => changeMode("manual")}
                        >
                            <SlidersHorizontal className="mr-2 h-4 w-4" /> Manual
                        </Button>
                    </div>

                    {seedingMode === "manual" && (
                        <div className="space-y-3 pt-2">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-sm font-medium">Orden de los equipos</p>
                                    <p className="text-xs text-muted-foreground">Arrastre los equipos o use las flechas para cambiar sus posiciones.</p>
                                </div>
                                <Button type="button" variant="ghost" size="sm" onClick={resetTeamOrder}>
                                    <RotateCcw className="mr-2 h-4 w-4" /> Orden de registro
                                </Button>
                            </div>
                            {teamOrder.length > 0 ? (
                                <div className="space-y-2">
                                    {teamOrder.map((team, index) => (
                                        <div
                                            key={team}
                                            draggable
                                            onDragStart={() => setDraggedIndex(index)}
                                            onDragOver={(event) => event.preventDefault()}
                                            onDrop={() => {
                                                if (draggedIndex !== null) moveTeam(draggedIndex, index);
                                                setDraggedIndex(null);
                                            }}
                                            onDragEnd={() => setDraggedIndex(null)}
                                            className={cn(
                                                "flex cursor-grab items-center gap-2 rounded-lg border p-2 active:cursor-grabbing",
                                                draggedIndex === index && "opacity-50",
                                                Math.floor(index / 2) % 2 === 0 ? "bg-amber-50/70 dark:bg-amber-950/20" : "bg-sky-50/70 dark:bg-sky-950/20",
                                            )}
                                        >
                                            <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                                            <Badge variant="outline" className="w-8 justify-center tabular-nums">{index + 1}</Badge>
                                            <span className="min-w-0 flex-1 truncate font-medium">{team}</span>
                                            <Badge variant="secondary" className="hidden sm:inline-flex">
                                                Llave {Math.floor(index / 2) + 1}
                                            </Badge>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                disabled={index === 0}
                                                aria-label={`Subir ${team}`}
                                                onClick={() => moveTeam(index, index - 1)}
                                            >
                                                <ArrowUp className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                disabled={index === teamOrder.length - 1}
                                                aria-label={`Bajar ${team}`}
                                                onClick={() => moveTeam(index, index + 1)}
                                            >
                                                <ArrowDown className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="rounded-lg bg-muted p-4 text-center text-sm text-muted-foreground">
                                    No hay equipos registrados para organizar.
                                </p>
                            )}
                        </div>
                    )}
                </div>
                <Button className="w-full" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                    Guardar Cambios
                </Button>
            </CardContent>
        </Card>
    );
}
