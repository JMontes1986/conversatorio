

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
import { Loader2, AlertTriangle, Lock, Eye, Trash2, ShieldQuestion, FileQuestion } from "lucide-react";
import { db } from '@/lib/firebase';
import { doc, setDoc, collection, query, onSnapshot, orderBy, getDoc, where, deleteDoc, writeBatch, getDocs } from 'firebase/firestore';
import { useToast } from "@/hooks/use-toast";
import { Switch } from './ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { cn } from '@/lib/utils';
import { Separator } from './ui/separator';


const SETTINGS_DOC_ID = "competition";
const DRAW_STATE_DOC_ID = "liveDraw";

interface SchoolData {
    id: string;
    schoolName: string;
    teamName: string;
    status: 'Verificado' | 'Pendiente';
}

interface ScoreData {
    id: string;
}
interface SurveyResponse {
    id: string;
}

type PublishedResults = {
    groupStage: boolean;
    semifinals: boolean;
    finals: boolean;
}


export function CompetitionSettings({ allScores = [] }: { allScores?: ScoreData[] }) {
    const { toast } = useToast();
    const [registrationsClosed, setRegistrationsClosed] = useState(false);
    const [publishedResults, setPublishedResults] = useState<PublishedResults>({
        groupStage: false,
        semifinals: false,
        finals: false
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loading, setLoading] = useState(true);
    const [verifiedSchools, setVerifiedSchools] = useState<SchoolData[]>([]);
    const [surveyResponses, setSurveyResponses] = useState<SurveyResponse[]>([]);


    useEffect(() => {
        const settingsRef = doc(db, "settings", SETTINGS_DOC_ID);
        const unsubscribeSettings = onSnapshot(settingsRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setRegistrationsClosed(data.registrationsClosed || false);
                setPublishedResults({
                    groupStage: data.groupStageResultsPublished || false,
                    semifinals: data.semifinalsResultsPublished || false,
                    finals: data.finalsResultsPublished || false,
                })
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
        
        const surveyResponsesQuery = query(collection(db, "surveyResponses"));
        const unsubscribeSurveyResponses = onSnapshot(surveyResponsesQuery, (snapshot) => {
            const responses = snapshot.docs.map(doc => ({ id: doc.id }));
            setSurveyResponses(responses);
        });


        return () => {
            unsubscribeSettings();
            unsubscribeSchools();
            unsubscribeSurveyResponses();
        }
    }, []);

    const handleToggleRegistration = async (closed: boolean) => {
        setIsSubmitting(true);
        try {
            const settingsRef = doc(db, "settings", SETTINGS_DOC_ID);
            
            const dataToSet: any = { registrationsClosed: closed };
            if (closed) {
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
    
    const handleToggleResultsPublication = async (phase: keyof PublishedResults, published: boolean) => {
        setIsSubmitting(true);
        const fieldMap = {
            groupStage: 'groupStageResultsPublished',
            semifinals: 'semifinalsResultsPublished',
            finals: 'finalsResultsPublished',
        };
        const fieldToUpdate = fieldMap[phase];

        try {
            const settingsRef = doc(db, "settings", SETTINGS_DOC_ID);
            await setDoc(settingsRef, { [fieldToUpdate]: published }, { merge: true });
            
            setPublishedResults(prev => ({...prev, [phase]: published}));
            
            toast({
                title: "Ajustes de Visibilidad Actualizados",
                description: `Los resultados de ${phase} ahora están ${published ? 'públicos' : 'ocultos'}.`
            });
        } catch (error) {
            console.error("Error updating settings:", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudieron actualizar los ajustes." });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleResetAllScores = async () => {
        setIsSubmitting(true);
        try {
            const batch = writeBatch(db);
            allScores.forEach(score => {
                const scoreRef = doc(db, "scores", score.id);
                batch.delete(scoreRef);
            });
            await batch.commit();

            toast({
                title: "Resultados Reiniciados",
                description: "Todas las puntuaciones han sido eliminadas."
            });
        } catch (error) {
            console.error("Error resetting scores:", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudieron eliminar las puntuaciones." });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleResetAllSurveys = async () => {
        setIsSubmitting(true);
        try {
            const surveyResponsesRef = collection(db, "surveyResponses");
            const querySnapshot = await getDocs(surveyResponsesRef);
            const batch = writeBatch(db);
            querySnapshot.forEach((doc) => {
                batch.delete(doc.ref);
            });
            await batch.commit();

            toast({
                title: "Encuestas Reiniciadas",
                description: "Todas las respuestas de la encuesta han sido eliminadas."
            });
        } catch (error) {
            console.error("Error resetting surveys:", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudieron eliminar las respuestas." });
        } finally {
            setIsSubmitting(false);
        }
    }

    const handleResetDraw = async () => {
        setIsSubmitting(true);
        try {
            await deleteDoc(doc(db, "drawState", DRAW_STATE_DOC_ID));
            toast({
                title: "Sorteo Reiniciado",
                description: "El estado del sorteo en vivo ha sido eliminado."
            });
        } catch (error) {
            console.error("Error resetting draw:", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudo reiniciar el sorteo." });
        } finally {
            setIsSubmitting(false);
        }
    };


    if (loading) {
        return (
            <div className="flex justify-center items-center py-10">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Ajustes Generales de la Competencia</CardTitle>
                    <CardDescription>
                        Controle aspectos clave del torneo como el cierre de inscripciones y la visibilidad de los resultados.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
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
                        Estos ajustes afectan la visualización y elegibilidad en toda la plataforma.
                    </p>
                </CardFooter>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Publicación de Resultados</CardTitle>
                    <CardDescription>Controle la visibilidad de los resultados para cada fase del torneo.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {([
                        { key: 'groupStage', label: 'Fase de Grupos' },
                        { key: 'semifinals', label: 'Fase de Semifinales' },
                        { key: 'finals', label: 'Fase de Finales' }
                    ] as { key: keyof PublishedResults, label: string }[]).map(phase => (
                        <div key={phase.key} className={cn(
                            "flex items-center justify-between rounded-lg border p-4 transition-colors",
                            publishedResults[phase.key] 
                                ? "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800"
                                : "bg-secondary"
                        )}>
                            <div>
                                <Label htmlFor={`results-${phase.key}`} className={cn("font-medium", publishedResults[phase.key] ? "text-blue-800 dark:text-blue-300" : "text-foreground")}>
                                    Publicar Resultados de {phase.label}
                                </Label>
                            </div>
                            <Switch
                                id={`results-${phase.key}`}
                                checked={publishedResults[phase.key]}
                                onCheckedChange={(checked) => handleToggleResultsPublication(phase.key, checked)}
                                disabled={isSubmitting}
                            />
                        </div>
                    ))}
                </CardContent>
                 <CardFooter>
                    <p className="text-xs text-muted-foreground flex items-center gap-2">
                        <Eye className="h-3 w-3" />
                        Active cada interruptor para que los resultados de esa fase sean visibles públicamente.
                    </p>
                </CardFooter>
            </Card>


            <Card className="border-destructive">
                <CardHeader>
                    <CardTitle className="text-destructive">Zona de Peligro</CardTitle>
                    <CardDescription>
                        Estas acciones son irreversibles. Úselas con precaución para reiniciar partes de la competencia.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div className="flex items-center justify-between rounded-lg border border-destructive/50 p-4">
                        <div>
                            <h3 className="font-semibold">Reiniciar Todos los Resultados</h3>
                            <p className="text-xs text-muted-foreground mt-1">
                                Elimina permanentemente todas las puntuaciones de todas las rondas. ({allScores.length} registros)
                            </p>
                        </div>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" disabled={isSubmitting || allScores.length === 0}>
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Reiniciar Resultados
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>¿Está absolutamente seguro?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Esta acción eliminará todas las puntuaciones de los jurados de la base de datos. No podrá recuperar estos datos.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleResetAllScores} className="bg-destructive hover:bg-destructive/90">
                                        Sí, eliminar todo
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                     <div className="flex items-center justify-between rounded-lg border border-destructive/50 p-4">
                        <div>
                            <h3 className="font-semibold">Reiniciar Sorteo en Vivo</h3>
                            <p className="text-xs text-muted-foreground mt-1">
                                Borra el estado del sorteo actual. Tendrá que realizarlo de nuevo.
                            </p>
                        </div>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" disabled={isSubmitting}>
                                    <ShieldQuestion className="mr-2 h-4 w-4" />
                                    Reiniciar Sorteo
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>¿Está absolutamente seguro?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                       Esta acción borrará los grupos y enfrentamientos definidos en el sorteo en vivo. Deberá realizar el sorteo nuevamente para continuar.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleResetDraw} className="bg-destructive hover:bg-destructive/90">
                                        Sí, reiniciar sorteo
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-destructive/50 p-4">
                        <div>
                            <h3 className="font-semibold">Reiniciar Todas las Encuestas</h3>
                            <p className="text-xs text-muted-foreground mt-1">
                                Elimina permanentemente todas las respuestas de la encuesta. ({surveyResponses.length} respuestas)
                            </p>
                        </div>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" disabled={isSubmitting || surveyResponses.length === 0}>
                                    <FileQuestion className="mr-2 h-4 w-4" />
                                    Reiniciar Encuestas
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>¿Está absolutamente seguro?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Esta acción eliminará todas las respuestas de la encuesta enviadas por los usuarios. No podrá recuperar estos datos.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleResetAllSurveys} className="bg-destructive hover:bg-destructive/90">
                                        Sí, eliminar todo
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

    
