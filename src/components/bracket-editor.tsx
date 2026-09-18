
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
import { AlertTriangle, ArrowDown, ArrowUp, Bot, GripVertical, Loader2, PenLine, RotateCcw, Save, Shuffle, SlidersHorizontal } from "lucide-react";
import { db } from '@/lib/supabase';
import { collection, doc, onSnapshot, orderBy, query, setDoc } from '@/lib/documents';
import { useToast } from "@/hooks/use-toast";
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';
import { secureShuffle } from '@/lib/draw-integrity';


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

function isVerifiedSchool(status: unknown) {
    return typeof status === "string"
        && status.trim().normalize("NFC").toLocaleLowerCase("es") === "verificado";
}

function sameTeams(left: string[], right: string[]) {
    if (left.length !== right.length) return false;
    const rightSet = new Set(right);
    return left.every((team) => rightSet.has(team));
}

function matchupSignature(teams: string[]) {
    const pairs: string[] = [];
    for (let index = 0; index < teams.length; index += 2) {
        pairs.push(teams.slice(index, index + 2).sort((a, b) => a.localeCompare(b, "es")).join("::"));
    }
    return pairs.sort((a, b) => a.localeCompare(b, "es")).join("||");
}

function shuffleIntoNewMatchups(teams: string[], currentOrder: string[] = []) {
    if (teams.length < 3) return secureShuffle(teams);
    const currentSignature = matchupSignature(currentOrder);

    for (let attempt = 0; attempt < 12; attempt += 1) {
        const candidate = secureShuffle(teams);
        if (matchupSignature(candidate) !== currentSignature) return candidate;
    }

    return [...teams.slice(1), teams[0]];
}


export function BracketEditor() {
    const { toast } = useToast();
    const [bracketTitle, setBracketTitle] = useState("¿QUÉ SIGNIFICA SER JOVEN DEL SIGLO XXI?");
    const [bracketSubtitle, setBracketSubtitle] = useState("Debate Intercolegial");
    const [seedingMode, setSeedingMode] = useState<SeedingMode>("automatic");
    const [registeredTeams, setRegisteredTeams] = useState<string[]>([]);
    const [verifiedTeams, setVerifiedTeams] = useState<string[]>([]);
    const [teamOrder, setTeamOrder] = useState<string[]>([]);
    const [automaticOrderIsRandomized, setAutomaticOrderIsRandomized] = useState(false);
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
                setAutomaticOrderIsRandomized(typeof data.bracketAutomaticRandomizedAt === "string");
            }
            setLoadingConfig(false);
        });

        const unsubscribeTeams = onSnapshot(
            query(collection(db, "schools"), orderBy("createdAt", "asc")),
            (snapshot) => {
                const schools = snapshot.docs.map((school) => school.data() as SchoolData);
                const names = sanitizeTeamNames(schools.map((school) => (
                    school.teamName || school.schoolName || ""
                )));
                const verifiedNames = sanitizeTeamNames(schools.flatMap((school) => {
                    if (!isVerifiedSchool(school.status)) return [];
                    return [school.teamName || school.schoolName || ""];
                }));
                setRegisteredTeams(names);
                setVerifiedTeams(verifiedNames);
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

    const availableTeams = seedingMode === "manual" ? registeredTeams : verifiedTeams;

    useEffect(() => {
        if (loadingConfig || loadingTeams) return;
        const availableSet = new Set(availableTeams);
        const availableCurrentOrder = teamOrder.filter((team) => availableSet.has(team));

        if (seedingMode === "automatic" && (
            !automaticOrderIsRandomized
            || !sameTeams(availableCurrentOrder, availableTeams)
        )) {
            setTeamOrder(shuffleIntoNewMatchups(availableTeams, teamOrder));
            setAutomaticOrderIsRandomized(true);
            return;
        }

        const currentSet = new Set(availableCurrentOrder);
        const nextOrder = [
            ...availableCurrentOrder,
            ...availableTeams.filter((team) => !currentSet.has(team)),
        ];
        if (JSON.stringify(nextOrder) !== JSON.stringify(teamOrder)) setTeamOrder(nextOrder);
    }, [automaticOrderIsRandomized, availableTeams, loadingConfig, loadingTeams, seedingMode, teamOrder]);

    const markChanged = () => {
        hasLocalChanges.current = true;
    };

    const changeMode = (mode: SeedingMode) => {
        markChanged();
        setSeedingMode(mode);
        if (mode === "automatic") {
            setTeamOrder(shuffleIntoNewMatchups(verifiedTeams, teamOrder));
            setAutomaticOrderIsRandomized(true);
        } else {
            setTeamOrder((currentOrder) => {
                const registeredSet = new Set(registeredTeams);
                const savedTeams = currentOrder.filter((team) => registeredSet.has(team));
                const savedSet = new Set(savedTeams);
                return [...savedTeams, ...registeredTeams.filter((team) => !savedSet.has(team))];
            });
        }
    };

    const reshuffleAutomaticTeams = () => {
        markChanged();
        setTeamOrder(shuffleIntoNewMatchups(verifiedTeams, teamOrder));
        setAutomaticOrderIsRandomized(true);
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
        setTeamOrder(availableTeams);
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
                bracketTeams: availableTeams,
                bracketManualAccepted: seedingMode === "manual",
                bracketManualAcceptedAt: seedingMode === "manual" ? updatedAt : null,
                bracketAutomaticRandomizedAt: seedingMode === "automatic" ? updatedAt : null,
                bracketConfigurationUpdatedAt: updatedAt,
            }, { merge: true });
            hasLocalChanges.current = false;
            toast(seedingMode === "manual" ? {
                title: "Organización manual aceptada",
                description: "El orden definido por el administrador ya tiene prioridad sobre el sorteo automático.",
            } : {
                title: "Llaves aleatorias guardadas",
                description: "Los enfrentamientos iniciales quedaron sorteados y permanecerán estables hasta que vuelva a generarlos.",
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
                            El modo automático sortea aleatoriamente los equipos verificados. El resultado queda guardado y no cambia al recargar. En modo manual puede organizar todos los colegios registrados.
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

                    {seedingMode === "automatic" && verifiedTeams.length === 0 && registeredTeams.length > 0 && (
                        <div className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                            <p>
                                Hay {registeredTeams.length} {registeredTeams.length === 1 ? "colegio registrado" : "colegios registrados"},
                                pero ninguno está verificado. Verifíquelos en <strong>Colegios</strong> o use el modo manual.
                            </p>
                        </div>
                    )}

                    {seedingMode === "automatic" && verifiedTeams.length > 0 && (
                        <div className="space-y-3 pt-2">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-sm font-medium">Vista previa del sorteo</p>
                                    <p className="text-xs text-muted-foreground">Cada fila corresponde a una llave inicial.</p>
                                </div>
                                <Button type="button" variant="outline" size="sm" onClick={reshuffleAutomaticTeams}>
                                    <Shuffle className="mr-2 h-4 w-4" /> Volver a sortear
                                </Button>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2">
                                {Array.from({ length: Math.ceil(teamOrder.length / 2) }, (_, matchIndex) => {
                                    const firstTeam = teamOrder[matchIndex * 2];
                                    const secondTeam = teamOrder[(matchIndex * 2) + 1];
                                    return (
                                        <div key={`${firstTeam}-${secondTeam || "bye"}`} className="rounded-lg border bg-muted/30 p-3">
                                            <Badge variant="outline" className="mb-2">Llave {matchIndex + 1}</Badge>
                                            <p className="font-medium">{firstTeam}</p>
                                            <p className="my-1 text-xs text-muted-foreground">contra</p>
                                            <p className="font-medium">{secondTeam || "Pase directo"}</p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

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
                                    No hay colegios registrados para organizar.
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
