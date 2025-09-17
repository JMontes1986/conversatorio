
"use client";

import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { CheckCircle, XCircle, UserCheck, UserX, ClipboardCheck, History, Loader2 } from 'lucide-react';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Button } from './ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';


const DEBATE_STATE_DOC_ID = "current";
const DRAW_STATE_DOC_ID = "liveDraw";

interface ScoreData {
    id: string;
    matchId: string;
    judgeId?: string;
    judgeName?: string;
}

interface JudgeData {
    id: string;
    name: string;
    status: 'active' | 'inactive';
}

interface RoundData {
    id: string;
    name: string;
    phase: string;
}

interface ScoringStatusTrackerProps {
    allRounds: RoundData[];
    allJudges: JudgeData[];
    allScores: ScoreData[];
}

export function ScoringStatusTracker({ allRounds = [], allJudges = [], allScores = [] }: ScoringStatusTrackerProps) {
    const { toast } = useToast();
    const [isReactivating, setIsReactivating] = useState<string | null>(null);
    const activeJudges = useMemo(() => allJudges.filter(j => j.status === 'active'), [allJudges]);

    const scoringStatusByRound = useMemo(() => {
        if (activeJudges.length === 0) return {};

        const status: Record<string, { scored: JudgeData[], pending: JudgeData[] }> = {};

        allRounds.forEach(round => {
            const scoresForRound = allScores.filter(score => score.matchId.startsWith(round.name));
            const judgeIdsWhoScored = new Set(scoresForRound.map(score => score.judgeId));

            const scored: JudgeData[] = [];
            const pending: JudgeData[] = [];

            activeJudges.forEach(judge => {
                if (judgeIdsWhoScored.has(judge.id)) {
                    scored.push(judge);
                } else {
                    pending.push(judge);
                }
            });
            status[round.name] = { scored, pending };
        });

        return status;
    }, [allRounds, activeJudges, allScores]);

    const sortedRounds = useMemo(() => [...allRounds].sort((a,b) => a.name.localeCompare(b.name, undefined, { numeric: true })), [allRounds]);
    
    const handleReactivateRound = async (roundName: string) => {
        setIsReactivating(roundName);
        try {
            const drawStateRef = doc(db, "drawState", DRAW_STATE_DOC_ID);
            const drawStateSnap = await getDoc(drawStateRef);
            
            if (!drawStateSnap.exists()) {
                toast({ variant: 'destructive', title: 'Error', description: 'No se encontró el estado del sorteo para obtener los equipos.' });
                return;
            }

            const drawData = drawStateSnap.data();
            let teams: string[] = [];
            
            for (const phase of drawData.phases) {
                const matchup = phase.matchups.find((m: any) => m.roundName === roundName);
                if (matchup) {
                    teams = matchup.teams;
                    break;
                }
            }

            if (teams.length === 0) {
                 toast({ variant: 'destructive', title: 'Error', description: `No se encontraron los equipos para la ronda "${roundName}". Configure la ronda manualmente.` });
                 return;
            }

            const debateStateRef = doc(db, "debateState", DEBATE_STATE_DOC_ID);
            await setDoc(debateStateRef, { 
                currentRound: roundName,
                teams: teams.map(name => ({ name }))
            }, { merge: true });

            toast({ title: 'Ronda Reactivada', description: `La ronda "${roundName}" ahora está activa para todos los jurados.` });

        } catch (error) {
            console.error("Error reactivating round:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo reactivar la ronda.' });
        } finally {
            setIsReactivating(null);
        }
    }


    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><ClipboardCheck className="h-6 w-6" />Monitor de Puntuación de Jurados</CardTitle>
                <CardDescription>Verifique en tiempo real qué jurados activos han enviado sus calificaciones para cada ronda y reactive rondas si es necesario.</CardDescription>
            </CardHeader>
            <CardContent>
                {sortedRounds.length > 0 ? (
                    <Accordion type="multiple" className="w-full">
                        {sortedRounds.map(round => {
                            const status = scoringStatusByRound[round.name];
                            if (!status) return null;

                            const totalJudges = status.scored.length + status.pending.length;
                            const isComplete = totalJudges > 0 && status.scored.length === totalJudges;

                            return (
                                <AccordionItem value={round.id} key={round.id}>
                                    <AccordionTrigger>
                                        <div className="flex justify-between items-center w-full pr-4">
                                            <span className="font-semibold">{round.name}</span>
                                            <div className="flex items-center gap-4">
                                                <Badge variant={isComplete ? 'default' : 'secondary'} className={isComplete ? 'bg-green-600 text-white' : ''}>
                                                    {status.scored.length} / {totalJudges || 'N/A'} Calificaciones
                                                </Badge>
                                            </div>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="p-4">
                                        <div className="flex items-start justify-between mb-4">
                                             <h4 className="font-medium">Estado de Calificación</h4>
                                             <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="outline" size="sm" disabled={isReactivating === round.name}>
                                                        {isReactivating === round.name ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <History className="mr-2 h-4 w-4"/>}
                                                        Reactivar Ronda
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>¿Reactivar la {round.name}?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Esta acción establecerá la "{round.name}" como la ronda activa para TODOS los jurados. Podrán calificarla (si no lo han hecho ya) hasta que usted cambie manualmente a otra ronda desde el panel de "Configurar Ronda".
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleReactivateRound(round.name)}>Sí, reactivar</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div>
                                                <h5 className="font-medium mb-2 flex items-center gap-2 text-green-600"><UserCheck className="h-5 w-5" />Jurados que Calificaron ({status.scored.length})</h5>
                                                {status.scored.length > 0 ? (
                                                    <ul className="space-y-1 text-sm list-inside">
                                                        {status.scored.map(judge => (
                                                            <li key={judge.id} className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" />{judge.name}</li>
                                                        ))}
                                                    </ul>
                                                ) : <p className="text-sm text-muted-foreground">Ningún jurado ha calificado aún.</p>}
                                            </div>
                                            <Separator orientation="vertical" className="hidden md:block"/>
                                             <div>
                                                <h5 className="font-medium mb-2 flex items-center gap-2 text-red-600"><UserX className="h-5 w-5" />Jurados Pendientes ({status.pending.length})</h5>
                                                {status.pending.length > 0 ? (
                                                    <ul className="space-y-1 text-sm list-inside">
                                                        {status.pending.map(judge => (
                                                            <li key={judge.id} className="flex items-center gap-2"><XCircle className="h-4 w-4 text-red-500" />{judge.name}</li>
                                                        ))}
                                                    </ul>
                                                ) : <p className="text-sm text-muted-foreground">¡Todos los jurados han calificado!</p>}
                                            </div>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            );
                        })}
                    </Accordion>
                ) : (
                    <p className="text-center text-muted-foreground py-8">No hay rondas configuradas.</p>
                )}
            </CardContent>
        </Card>
    );
}

