

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
import { Loader2, Plus, Trash2, Swords, MoreHorizontal, Folder } from "lucide-react";
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
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

const competitionPhases = ["Fase de Grupos", "Fase de Finales"];

export function RoundManagement() {
    const { toast } = useToast();
    const [rounds, setRounds] = useState<RoundData[]>([]);
    const [loading, setLoading] = useState(true);
    const [newRoundName, setNewRoundName] = useState("");
    const [newRoundPhase, setNewRoundPhase] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const roundsQuery = query(collection(db, "rounds"), orderBy("createdAt", "asc"));
        const unsubscribe = onSnapshot(roundsQuery, (querySnapshot) => {
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

        return () => unsubscribe();
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

    return (
        <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-1">
                <Card>
                    <CardHeader>
                        <CardTitle>Crear Ronda</CardTitle>
                        <CardDescription>Añada una nueva ronda y asígnele una fase del torneo.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleAddRound} className="space-y-4">
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

    
