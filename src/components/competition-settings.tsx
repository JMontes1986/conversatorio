
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Loader2, AlertTriangle, Lock } from "lucide-react";
import { db } from '@/lib/firebase';
import { doc, setDoc, collection, query, onSnapshot, orderBy, getDoc, where } from 'firebase/firestore';
import { useToast } from "@/hooks/use-toast";
import { Switch } from './ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { cn } from '@/lib/utils';


const SETTINGS_DOC_ID = "competition";

interface SchoolData {
    id: string;
    schoolName: string;
    teamName: string;
    status: 'Verificado' | 'Pendiente';
}
interface ScoreData {
    id: string;
    matchId: string;
    teams: { name: string; total: number }[];
}


export function CompetitionSettings({ allScores = [] }: { allScores?: ScoreData[] }) {
    const { toast } = useToast();
    const [registrationsClosed, setRegistrationsClosed] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loading, setLoading] = useState(true);
    const [verifiedSchools, setVerifiedSchools] = useState<SchoolData[]>([]);

    useEffect(() => {
        const settingsRef = doc(db, "settings", SETTINGS_DOC_ID);
        const unsubscribeSettings = onSnapshot(settingsRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setRegistrationsClosed(data.registrationsClosed || false);
            }
            setLoading(false);
        });
        
        const schoolsQuery = query(collection(db, "schools"), where("status", "==", "Verificado"));
        const unsubscribeSchools = onSnapshot(schoolsQuery, (snapshot) => {
            const schools = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as SchoolData));
            setVerifiedSchools(schools);
        });


        return () => {
            unsubscribeSettings();
            unsubscribeSchools();
        }
    }, []);

    const handleToggleRegistration = async (closed: boolean) => {
        setIsSubmitting(true);
        try {
            const settingsRef = doc(db, "settings", SETTINGS_DOC_ID);
            
            const dataToSet: any = { registrationsClosed: closed };
            if (closed) {
                // If closing, store the current list of verified schools
                dataToSet.lockedInTeams = verifiedSchools.map(school => ({
                    id: school.id,
                    teamName: school.teamName
                }));
            }

            await setDoc(settingsRef, dataToSet, { merge: true });
            
            setRegistrationsClosed(closed);
            toast({
                title: "Ajustes Actualizados",
                description: `Las inscripciones ahora están ${closed ? 'cerradas' : 'abiertas'}.`
            });
        } catch (error) {
            console.error("Error updating settings:", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudieron actualizar los ajustes." });
        } finally {
            setIsSubmitting(false);
        }
    }

    if (loading) {
        return (
            <div className="flex justify-center items-center py-10">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Ajustes Generales de la Competencia</CardTitle>
                <CardDescription>
                    Controle aspectos clave del torneo, como el cierre de inscripciones.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className={cn(
                    "flex items-center justify-between rounded-lg border p-4 transition-colors",
                    registrationsClosed 
                        ? "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800"
                        : "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800"
                )}>
                    <div>
                        <Label htmlFor="registrations-switch" className={cn("font-bold text-lg", registrationsClosed ? "text-destructive" : "text-green-800 dark:text-green-300")}>
                            {registrationsClosed ? "Inscripciones Cerradas" : "Inscripciones Abiertas"}
                        </Label>
                        <p className="text-xs text-muted-foreground mt-1">
                            {registrationsClosed 
                                ? "Cerradas. Solo los equipos ya verificados participarán en el sorteo."
                                : "Abiertas. Nuevos colegios verificados pueden entrar al sorteo."
                            }
                        </p>
                    </div>

                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Switch
                                id="registrations-switch"
                                checked={registrationsClosed}
                                disabled={isSubmitting}
                                className={cn(registrationsClosed && "data-[state=checked]:bg-destructive")}
                                // We trigger the dialog but don't change the switch state directly
                                onCheckedChange={() => {}} 
                            />
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>¿Está seguro que desea {registrationsClosed ? 'abrir' : 'cerrar'} las inscripciones?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Esta acción es importante y afectará qué equipos pueden participar en los sorteos.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <div className="mt-4 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md">
                                <div className="flex">
                                    <div className="flex-shrink-0">
                                        <AlertTriangle className="h-5 w-5 text-yellow-400" aria-hidden="true" />
                                    </div>
                                    <div className="ml-3">
                                        <p className="text-sm text-yellow-700">
                                            {registrationsClosed 
                                                ? "Al abrir las inscripciones, nuevos colegios verificados podrán participar en el sorteo."
                                                : `Al cerrar, se fijará la lista de ${verifiedSchools.length} equipos verificados para el sorteo. No se podrán añadir más equipos.`
                                            } 
                                            Esta acción no se puede deshacer fácilmente.
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction 
                                    onClick={() => handleToggleRegistration(!registrationsClosed)} 
                                    className={!registrationsClosed ? "bg-destructive hover:bg-destructive/90" : ""}
                                >
                                    {registrationsClosed ? 'Sí, abrir inscripciones' : 'Sí, cerrar inscripciones'}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

                </div>
            </CardContent>
             <CardFooter>
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <Lock className="h-3 w-3" />
                    Este ajuste es global y afecta la elegibilidad de equipos para el sorteo.
                </p>
            </CardFooter>
        </Card>
    );
}
