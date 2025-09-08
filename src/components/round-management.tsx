
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
import { Loader2, Plus, Trash2, Swords, MoreHorizontal } from "lucide-react";
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuItem } from './ui/dropdown-menu';
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from './ui/alert-dialog';

interface RoundData {
    id: string;
    name: string;
}

export function RoundManagement() {
    const { toast } = useToast();
    const [rounds, setRounds] = useState<RoundData[]>([]);
    const [loading, setLoading] = useState(true);
    const [newRoundName, setNewRoundName] = useState("");
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

    const handleAddRound = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newRoundName.trim()) {
            toast({ variant: "destructive", title: "Error", description: "El nombre de la ronda es requerido." });
            return;
        }
        setIsSubmitting(true);
        try {
            await addDoc(collection(db, "rounds"), {
                name: newRoundName,
                createdAt: serverTimestamp(),
            });
            toast({ title: "Ronda Creada", description: `La ronda "${newRoundName}" ha sido creada.` });
            setNewRoundName("");
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
                        <CardDescription>Añada una nueva ronda a la estructura del torneo.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleAddRound} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="round-name">Nombre de la Ronda</Label>
                                <Input 
                                    id="round-name" 
                                    value={newRoundName} 
                                    onChange={(e) => setNewRoundName(e.target.value)} 
                                    placeholder="Ej: Ronda 1, Final" 
                                    disabled={isSubmitting}
                                />
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
                        <CardDescription>Lista de rondas creadas para la competencia.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nombre de la Ronda</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={2} className="text-center">Cargando rondas...</TableCell>
                                    </TableRow>
                                ) : rounds.map((round) => (
                                    <TableRow key={round.id}>
                                        <TableCell className="font-medium flex items-center gap-2"><Swords className="h-4 w-4" /> {round.name}</TableCell>
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
                        </Table>
                         {!loading && rounds.length === 0 && (
                            <p className="text-center text-muted-foreground text-sm py-8">No hay rondas creadas.</p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
