
"use client";

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { CheckCircle, XCircle, UserCheck, UserX, ClipboardCheck } from 'lucide-react';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';

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


    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><ClipboardCheck className="h-6 w-6" />Monitor de Puntuación de Jurados</CardTitle>
                <CardDescription>Verifique en tiempo real qué jurados activos han enviado sus calificaciones para cada ronda.</CardDescription>
            </CardHeader>
            <CardContent>
                {sortedRounds.length > 0 ? (
                    <Accordion type="multiple" className="w-full">
                        {sortedRounds.map(round => {
                            const status = scoringStatusByRound[round.name];
                            if (!status) return null;

                            const totalJudges = status.scored.length + status.pending.length;

                            return (
                                <AccordionItem value={round.id} key={round.id}>
                                    <AccordionTrigger>
                                        <div className="flex justify-between items-center w-full pr-4">
                                            <span className="font-semibold">{round.name}</span>
                                            <Badge variant={status.scored.length === totalJudges ? 'default' : 'secondary'} className={status.scored.length === totalJudges ? 'bg-green-600 text-white' : ''}>
                                                {status.scored.length} / {totalJudges} Calificaciones
                                            </Badge>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="p-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div>
                                                <h4 className="font-medium mb-2 flex items-center gap-2 text-green-600"><UserCheck className="h-5 w-5" />Jurados que Calificaron ({status.scored.length})</h4>
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
                                                <h4 className="font-medium mb-2 flex items-center gap-2 text-red-600"><UserX className="h-5 w-5" />Jurados Pendientes ({status.pending.length})</h4>
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
