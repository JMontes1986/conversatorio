

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
import { AlertTriangle, Loader2, Sparkles, Trash2, Swords, MoreHorizontal, Folder } from "lucide-react";
import { db } from '@/lib/supabase';
import { collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, doc, deleteDoc } from '@/lib/documents';
import {
    DEFAULT_TOURNAMENT_FORMAT,
    type TournamentFormat,
    normalizeTournamentFormat,
    requiredRoundCount,
} from '@/lib/tournament-format';
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuItem } from './ui/dropdown-menu';
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from './ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface RoundData {
    id: string;
    name: string;
    phase: string;
}

interface SchoolData {
    status?: string;
}

const competitionPhases = ["Fase de Grupos", "Fase de semifinal", "Fase de Finales"];

function isVerifiedSchool(status: unknown) {
    return typeof status === "string"
        && status.trim().normalize("NFC").toLocaleLowerCase("es") === "verificado";
}

function groupLabel(index: number) {
    return index < 26 ? String.fromCharCode(65 + index) : String(index + 1);
}

export function RoundManagement() {
    const { toast } = useToast();
    const [rounds, setRounds] = useState<RoundData[]>([]);
    const [loading, setLoading] = useState(true);
    const [newRoundName, setNewRoundName] = useState("");
    const [newRoundPhase, setNewRoundPhase] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [registeredSchoolCount, setRegisteredSchoolCount] = useState(0);
    const [verifiedSchoolCount, setVerifiedSchoolCount] = useState(0);
    const [tournamentFormat, setTournamentFormat] = useState<TournamentFormat>(DEFAULT_TOURNAMENT_FORMAT);

    useEffect(() => {
        const roundsQuery = query(collection(db, "rounds"), orderBy("createdAt", "asc"));
        const unsubscribeRounds = onSnapshot(roundsQuery, (querySnapshot) => {
            const roundsData: RoundData[] = [];
            querySnapshot.forEach((doc) => {
                roundsData.push({ id: doc.id, ...doc.data() } as RoundData);
            });
            setRounds(roundsData);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching rounds:", error);
            setLoading(false);
        });

        const unsubscribeSchools = onSnapshot(
            query(collection(db, "schools"), orderBy("createdAt", "asc")),
            (snapshot) => {
                const schools = snapshot.docs.map((school) => school.data() as SchoolData);
                setRegisteredSchoolCount(schools.length);
                setVerifiedSchoolCount(schools.filter((school) => isVerifiedSchool(school.status)).length);
            },
            (error) => console.error("Error fetching schools for round generation:", error),
        );

        const unsubscribeSettings = onSnapshot(
            doc(db, "settings", "competition"),
            (snapshot) => {
                const data = snapshot.exists() ? snapshot.data() : {};
                setTournamentFormat(normalizeTournamentFormat(data.tournamentFormat));
            },
            (error) => console.error("Error fetching tournament format:", error),
        );

        return () => {
            unsubscribeRounds();
            unsubscribeSchools();
            unsubscribeSettings();
        };
    }, []);
    
    const roundsByPhase = rounds.reduce((acc, round) => {
        const phase = round.phase || 'General';
        if (!acc[phase]) {
            acc[phase] = [];
        }
        acc[phase].push(round);
        return acc;
    }, {} as Record<string, RoundData[]>);
    
     const sortedPhases = Object.keys(roundsByPhase).sort((a, b) => {
        return competitionPhases.indexOf(a) - competitionPhases.indexOf(b);
    });


    const handleAddRound = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newRoundName.trim() || !newRoundPhase.trim()) {
            toast({ variant: "destructive", title: "Error", description: "El nombre de la ronda y la fase son requeridos." });
            return;
        }
        setIsSubmitting(true);
        try {
            await addDoc(collection(db, "rounds"), {
                name: newRoundName,
                phase: newRoundPhase,
                createdAt: serverTimestamp(),
            });
            toast({ title: "Ronda Creada", description: `La ronda "${newRoundName}" ha sido creada.` });
            setNewRoundName("");
            setNewRoundPhase("");
        } catch (error) {
            console.error("Error adding round:", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudo crear la ronda." });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteRound = async (roundId: string) => {
        try {
            await deleteDoc(doc(db, "rounds", roundId));
            toast({ title: "Ronda Eliminada" });
        } catch (error) {
            console.error("Error deleting round:", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar la ronda." });
        }
    };

    const requiredGroupRounds = requiredRoundCount(
        verifiedSchoolCount,
        tournamentFormat.groupStage.teamsPerRound,
    );
    const currentGroupRounds = rounds.filter((round) => round.phase === "Fase de Grupos").length;
    const missingGroupRounds = Math.max(0, requiredGroupRounds - currentGroupRounds);

    const handleGenerateGroupRounds = async () => {
        if (verifiedSchoolCount < tournamentFormat.groupStage.teamsPerRound || missingGroupRounds === 0) return;

        setIsSubmitting(true);
        try {
            const existingNames = new Set(rounds.map((round) => round.name.trim().normalize("NFC")));
            const names: string[] = [];
            let index = 0;

            while (names.length < missingGroupRounds) {
                const candidate = `Grupo ${groupLabel(index)}`;
                index += 1;
                if (existingNames.has(candidate)) continue;
                existingNames.add(candidate);
                names.push(candidate);
            }

            await Promise.all(names.map((name) => addDoc(collection(db, "rounds"), {
                name,
                phase: "Fase de Grupos",
                createdAt: serverTimestamp(),
            })));
            toast({
                title: missingGroupRounds === 1 ? "Ronda generada" : "Rondas generadas",
                description: `Se ${missingGroupRounds === 1 ? "creó" : "crearon"} ${missingGroupRounds} ${missingGroupRounds === 1 ? "ronda" : "rondas"} para ${verifiedSchoolCount} equipos verificados.`,
            });
        } catch (error) {
            console.error("Error generating group rounds:", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudieron generar las rondas iniciales." });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1">
                <Card>
                    <CardHeader>
                        <CardTitle>Crear Ronda</CardTitle>
                        <CardDescription>Añada una nueva ronda y asígnele una fase del torneo.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleAddRound} className="space-y-4">
                            <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                                <p className="text-sm font-medium">Generación automática</p>
                                <p className="text-xs text-muted-foreground">
                                    {verifiedSchoolCount >= 2
                                        ? `${verifiedSchoolCount} equipos verificados requieren ${requiredGroupRounds} rondas iniciales.`
                                        : registeredSchoolCount > 0
                                            ? `Hay ${registeredSchoolCount} colegios registrados. Verifique al menos dos para generar sus rondas.`
                                            : "Registre y verifique al menos dos colegios para generar sus rondas."}
                                </p>
                                {registeredSchoolCount > 0 && verifiedSchoolCount === 0 && (
                                    <p className="flex gap-2 text-xs text-amber-700">
                                        <AlertTriangle className="h-4 w-4 shrink-0" /> Ningún colegio tiene estado Verificado.
                                    </p>
                                )}
                                <Button
                                    type="button"
                                    variant="secondary"
                                    className="w-full"
                                    disabled={isSubmitting || verifiedSchoolCount < 2 || missingGroupRounds === 0}
                                    onClick={handleGenerateGroupRounds}
                                >
                                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                                    {missingGroupRounds > 0
                                        ? `Generar ${missingGroupRounds} ${missingGroupRounds === 1 ? "ronda" : "rondas"}`
                                        : requiredGroupRounds > 0 ? "Rondas iniciales completas" : "Generar rondas iniciales"}
                                </Button>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="round-name">Nombre de la Ronda</Label>
                                <Input 
                                    id="round-name" 
                                    value={newRoundName} 
                                    onChange={(e) => setNewRoundName(e.target.value)} 
                                    placeholder="Ej: Grupo A, Final" 
                                    disabled={isSubmitting}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="round-phase">Fase del Torneo</Label>
                                <Select onValueChange={setNewRoundPhase} value={newRoundPhase} disabled={isSubmitting}>
                                    <SelectTrigger id="round-phase">
                                        <SelectValue placeholder="Seleccione una fase" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Fase de Grupos">Fase de Grupos</SelectItem>
                                        <SelectItem value="Fase de semifinal">Fase de semifinal</SelectItem>
                                        <SelectItem value="Fase de Finales">Fase de Finales</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button type="submit" className="w-full" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Crear Ronda
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
            <div className="md:col-span-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Rondas del Torneo</CardTitle>
                        <CardDescription>Lista de rondas creadas, agrupadas por fase.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nombre</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                           
                                {loading ? (
                                     <TableBody>
                                        <TableRow>
                                            <TableCell colSpan={2} className="text-center">Cargando rondas...</TableCell>
                                        </TableRow>
                                     </TableBody>
                                ) : sortedPhases.length > 0 ? (
                                    sortedPhases.map((phase) => (
                                        <TableBody key={phase}>
                                            <TableRow className="bg-secondary hover:bg-secondary">
                                                <TableCell colSpan={2} className="font-bold text-secondary-foreground">
                                                   <div className="flex items-center gap-2">
                                                    <Folder className="h-4 w-4"/> {phase}
                                                   </div>
                                                </TableCell>
                                            </TableRow>
                                            {roundsByPhase[phase].map((round) => (
                                                <TableRow key={round.id}>
                                                    <TableCell className="font-medium pl-8 flex items-center gap-2"><Swords className="h-4 w-4 text-muted-foreground" /> {round.name}</TableCell>
                                                    <TableCell className="text-right">
                                                        <AlertDialog>
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button aria-haspopup="true" size="icon" variant="ghost">
                                                                        <MoreHorizontal className="h-4 w-4" />
                                                                        <span className="sr-only">Toggle menu</span>
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end">
                                                                    <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                                                    <AlertDialogTrigger asChild>
                                                                        <DropdownMenuItem className="text-destructive" onSelect={(e) => e.preventDefault()}>
                                                                            <Trash2 className="mr-2 h-4 w-4"/>Eliminar
                                                                        </DropdownMenuItem>
                                                                    </AlertDialogTrigger>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                            <AlertDialogContent>
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
                                                                    <AlertDialogDescription>
                                                                        Esta acción no se puede deshacer. Se eliminará la ronda permanentemente.
                                                                    </AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                                    <AlertDialogAction onClick={() => handleDeleteRound(round.id)} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    ))
                                ) : (
                                     <TableBody>
                                        <TableRow>
                                            <TableCell colSpan={2} className="text-center h-24 text-muted-foreground">
                                                No hay rondas creadas.
                                            </TableCell>
                                        </TableRow>
                                    </TableBody>
                                )}
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
