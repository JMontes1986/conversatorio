
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
import { Loader2, Trash2, MoreHorizontal, ListChecks } from "lucide-react";
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuItem } from './ui/dropdown-menu';
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from './ui/alert-dialog';
import { Textarea } from './ui/textarea';

interface RubricCriterion {
    id: string;
    name: string;
    description: string;
}

export function RubricManagement() {
    const { toast } = useToast();
    const [criteria, setCriteria] = useState<RubricCriterion[]>([]);
    const [loading, setLoading] = useState(true);
    const [newCriterionName, setNewCriterionName] = useState("");
    const [newCriterionDescription, setNewCriterionDescription] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const criteriaQuery = query(collection(db, "rubric"), orderBy("createdAt", "asc"));
        const unsubscribe = onSnapshot(criteriaQuery, (querySnapshot) => {
            const criteriaData: RubricCriterion[] = [];
            querySnapshot.forEach((doc) => {
                criteriaData.push({ id: doc.id, ...doc.data() } as RubricCriterion);
            });
            setCriteria(criteriaData);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching rubric criteria:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleAddCriterion = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCriterionName.trim() || !newCriterionDescription.trim()) {
            toast({ variant: "destructive", title: "Error", description: "El nombre y la descripción del criterio son requeridos." });
            return;
        }
        setIsSubmitting(true);
        try {
            await addDoc(collection(db, "rubric"), {
                name: newCriterionName,
                description: newCriterionDescription,
                createdAt: serverTimestamp(),
            });
            toast({ title: "Criterio Creado", description: `El criterio "${newCriterionName}" ha sido añadido a la rúbrica.` });
            setNewCriterionName("");
            setNewCriterionDescription("");
        } catch (error) {
            console.error("Error adding criterion:", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudo crear el criterio." });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteCriterion = async (criterionId: string) => {
        try {
            await deleteDoc(doc(db, "rubric", criterionId));
            toast({ title: "Criterio Eliminado" });
        } catch (error) {
            console.error("Error deleting criterion:", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar el criterio." });
        }
    };

    return (
        <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-1">
                <Card>
                    <CardHeader>
                        <CardTitle>Añadir Criterio</CardTitle>
                        <CardDescription>Añada un nuevo criterio a la rúbrica de evaluación.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleAddCriterion} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="criterion-name">Nombre del Criterio</Label>
                                <Input 
                                    id="criterion-name" 
                                    value={newCriterionName} 
                                    onChange={(e) => setNewCriterionName(e.target.value)} 
                                    placeholder="Ej: Argumentación" 
                                    disabled={isSubmitting}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="criterion-description">Descripción del Criterio</Label>
                                <Textarea
                                    id="criterion-description" 
                                    value={newCriterionDescription} 
                                    onChange={(e) => setNewCriterionDescription(e.target.value)} 
                                    placeholder="Ej: Calidad y solidez de los argumentos." 
                                    disabled={isSubmitting}
                                    rows={3}
                                />
                            </div>
                            <Button type="submit" className="w-full" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Crear Criterio
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
            <div className="md:col-span-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Rúbrica de Evaluación</CardTitle>
                        <CardDescription>Lista de criterios que los jueces usarán para calificar.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Criterio</TableHead>
                                    <TableHead>Descripción</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center">Cargando criterios...</TableCell>
                                    </TableRow>
                                ) : criteria.length > 0 ? (
                                    criteria.map((criterion) => (
                                        <TableRow key={criterion.id}>
                                            <TableCell className="font-medium">{criterion.name}</TableCell>
                                            <TableCell className="text-muted-foreground">{criterion.description}</TableCell>
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
                                                                Esta acción no se puede deshacer. Se eliminará el criterio permanentemente de la rúbrica.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDeleteCriterion(criterion.id)} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center h-24 text-muted-foreground">
                                            No hay criterios definidos.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
