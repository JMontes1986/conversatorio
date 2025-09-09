

"use client";

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from '@/components/ui/badge';
import { Swords, Check, Hash, Loader2, History, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, addDoc, doc, onSnapshot, query, where, getDocs, orderBy } from 'firebase/firestore';
import { JudgeAuth } from '@/components/auth/judge-auth';
import { useJudgeAuth } from '@/context/judge-auth-context';
import { cn } from '@/lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface RubricCriterion {
    id: string;
    name: string;
    description: string;
}

const DEBATE_STATE_DOC_ID = "current";

interface Team {
    name: string;
}

interface DebateState {
    currentRound: string;
    teams: Team[];
}

interface ScoreData {
    id: string;
    matchId: string;
    judgeId?: string;
    teams: { name: string; total: number }[];
    fullScores?: { name: string; total: number; scores: Record<string, number> }[];
    createdAt: any;
}


function ScoringPanel() {
  const { toast } = useToast();
  const { judge } = useJudgeAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scores, setScores] = useState<Record<string, Record<string, number>>>({});
  const [debateState, setDebateState] = useState<DebateState>({
      currentRound: 'N/A',
      teams: [],
  });
  const [loadingDebateState, setLoadingDebateState] = useState(true);
  const [pastScores, setPastScores] = useState<ScoreData[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [rubricCriteria, setRubricCriteria] = useState<RubricCriterion[]>([]);
  const [loadingRubric, setLoadingRubric] = useState(true);

  useEffect(() => {
    const debateStateRef = doc(db, "debateState", DEBATE_STATE_DOC_ID);
    const unsubscribeDebateState = onSnapshot(debateStateRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            const currentTeams = data.teams || [];
            setDebateState({
                currentRound: data.currentRound || 'N/A',
                teams: currentTeams,
            });
            // Initialize scores state for the new teams
            const initialScores: Record<string, Record<string, number>> = {};
            if (currentTeams) {
                currentTeams.forEach((team: Team) => {
                    initialScores[team.name] = {};
                });
            }
            setScores(initialScores);
        }
        setLoadingDebateState(false);
    });

    const rubricQuery = query(collection(db, "rubric"), orderBy("createdAt", "asc"));
    const unsubscribeRubric = onSnapshot(rubricQuery, (snapshot) => {
        const criteria = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RubricCriterion));
        setRubricCriteria(criteria);
        setLoadingRubric(false);
    });


    return () => {
        unsubscribeDebateState();
        unsubscribeRubric();
    };
  }, []);

  useEffect(() => {
      if (!judge?.id) return;
      
      setLoadingHistory(true);
      // Simplified query to avoid composite index
      const scoresQuery = query(
          collection(db, "scores"),
          orderBy("createdAt", "desc")
      );

      const unsubscribeHistory = onSnapshot(scoresQuery, (querySnapshot) => {
          // Filter scores for the current judge on the client side
          const allScores = querySnapshot.docs
            .map(doc => ({
              id: doc.id,
              ...doc.data()
            } as ScoreData))
            .filter(score => score.judgeId === judge.id);
          
          setPastScores(allScores);
          setLoadingHistory(false);
      }, (error) => {
        console.error("Error fetching score history:", error);
        setLoadingHistory(false);
      });

      return () => unsubscribeHistory();

  }, [judge]);
  
  const hasAlreadyScoredCurrentRound = useMemo(() => {
    if (!judge || !debateState.currentRound || pastScores.length === 0) {
        return false;
    }
    return pastScores.some(score => score.matchId === debateState.currentRound);
  }, [pastScores, debateState.currentRound, judge]);


  const handleScoreChange = (teamName: string, criteriaId: string, value: number) => {
    setScores(prev => ({
      ...prev,
      [teamName]: {
        ...prev[teamName],
        [criteriaId]: value
      }
    }));
  };

  const calculateTotal = (teamName: string) => {
    if (!scores[teamName]) return 0;
    return Object.values(scores[teamName]).reduce((sum, score) => sum + score, 0);
  };
  
  const calculateChecksum = (teamName: string) => {
    if (!scores[teamName] || rubricCriteria.length === 0) return '';
    const scoreString = rubricCriteria.map(criterion => scores[teamName][criterion.id] || 0).join('-');
    let hash = 0;
    for (let i = 0; i < scoreString.length; i++) {
        const char = scoreString.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString(16).toUpperCase().slice(-6);
  }

  const handleSubmit = async () => {
    if (rubricCriteria.length === 0) {
        toast({
            variant: "destructive",
            title: "Error",
            description: "No hay criterios de evaluación configurados. Contacte al administrador.",
        });
        return;
    }
    for (const team of debateState.teams) {
        if (Object.keys(scores[team.name] || {}).length < rubricCriteria.length) {
            toast({
                variant: "destructive",
                title: "Error de Validación",
                description: `Por favor, asigne una puntuación a todos los criterios para el equipo ${team.name}.`,
            });
            return;
        }
    }

    setIsSubmitting(true);
    
    const teamsScoreData = debateState.teams.map(team => ({
        name: team.name,
        scores: scores[team.name],
        total: calculateTotal(team.name),
        checksum: calculateChecksum(team.name),
    }));

    const finalScoreData = {
        matchId: debateState.currentRound,
        judgeId: judge?.id || '',
        judgeName: judge?.name || 'Jurado Anónimo',
        judgeCedula: judge?.cedula || '',
        teams: teamsScoreData.map(({name, total}) => ({name, total})),
        fullScores: teamsScoreData,
        createdAt: new Date(),
    };

    try {
        await addDoc(collection(db, "scores"), finalScoreData);
        toast({
            title: "Puntuación Enviada",
            description: "Sus calificaciones han sido registradas exitosamente.",
        });
        const resetScores: Record<string, Record<string, number>> = {};
        debateState.teams.forEach(team => {
            resetScores[team.name] = {};
        });
        setScores(resetScores);
    } catch(error) {
        console.error("Error submitting score: ", error);
        toast({
            variant: "destructive",
            title: "Error al Enviar",
            description: "No se pudo guardar la puntuación. Por favor, inténtelo de nuevo.",
        });
    } finally {
        setIsSubmitting(false);
    }
  };

  const ScoreButtons = ({ teamName, criteriaId }: { teamName: string, criteriaId: string }) => (
    <div className="flex justify-center items-center gap-1 md:gap-2">
      {[1, 2, 3, 4, 5].map((value) => (
        <Button
          key={value}
          variant={(scores[teamName]?.[criteriaId]) === value ? 'default' : 'outline'}
          size="icon"
          className="h-8 w-8 md:h-9 md:w-9 rounded-full"
          onClick={() => handleScoreChange(teamName, criteriaId, value)}
          disabled={isSubmitting}
        >
          {value}
        </Button>
      ))}
    </div>
  );
  
  const getCriterionName = (id: string) => {
    return rubricCriteria.find(c => c.id === id)?.name || 'Criterio Desconocido';
  }


  if (loadingDebateState || loadingRubric || loadingHistory) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>
  }

  return (
    <div className="container mx-auto py-10 px-4 md:px-6">
      <div className="mb-8 text-center">
        <h1 className="font-headline text-3xl md:text-4xl font-bold">
          Panel de Puntuación del Juez
        </h1>
        <div className="text-muted-foreground mt-2 capitalize">
            Juez: <span className="font-semibold text-foreground">{judge?.name}</span> | Ronda Activa: <Badge>{debateState.currentRound}</Badge>
        </div>
      </div>
      
      {debateState.teams.length > 0 && (
         <div className="flex justify-center items-center mb-8 space-x-2 md:space-x-4 flex-wrap">
            {debateState.teams.map((team, index) => (
                <div key={`${team.name}-${index}`} className="flex items-center">
                    <h2 className="font-headline text-xl md:text-2xl text-center">{team.name}</h2>
                    {index < debateState.teams.length - 1 && <Swords className="h-6 w-6 md:h-8 md:w-8 text-primary shrink-0 mx-2" />}
                </div>
            ))}
        </div>
      )}

      {debateState.teams.length > 0 ? (
        hasAlreadyScoredCurrentRound ? (
            <Card className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
                <CardContent className="pt-6 text-center text-green-700 dark:text-green-300">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-4"/>
                    <h3 className="text-xl font-bold">Ronda Calificada</h3>
                    <p className="text-muted-foreground text-green-600 dark:text-green-400">Ya ha enviado su puntuación para esta ronda. Puede verla en su historial a continuación.</p>
                </CardContent>
            </Card>
        ) : (
            <>
                <Card>
                    <CardHeader>
                    <CardTitle>Rúbrica de Evaluación</CardTitle>
                    <CardDescription>Seleccione una puntuación de 1 a 5 para cada criterio.</CardDescription>
                    </CardHeader>
                    <CardContent>
                    <div className="w-full overflow-x-auto">
                        <Table>
                            <TableHeader>
                            <TableRow>
                                <TableHead className="w-1/3 min-w-[200px]">Criterio</TableHead>
                                {debateState.teams.map(team => (
                                    <TableHead key={team.name} className="w-1/3 text-center min-w-[200px]">{team.name}</TableHead>
                                ))}
                            </TableRow>
                            </TableHeader>
                            <TableBody>
                            {rubricCriteria.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={debateState.teams.length + 1} className="text-center text-muted-foreground">
                                        No hay criterios de evaluación definidos. Contacte al administrador.
                                    </TableCell>
                                </TableRow>
                            ) :
                            rubricCriteria.map(criterion => (
                                <TableRow key={criterion.id}>
                                <TableCell>
                                    <p className="font-medium">{criterion.name}</p>
                                    <p className="text-xs text-muted-foreground">{criterion.description}</p>
                                </TableCell>
                                {debateState.teams.map(team => (
                                    <TableCell key={team.name}>
                                        <ScoreButtons teamName={team.name} criteriaId={criterion.id} />
                                    </TableCell>
                                ))}
                                </TableRow>
                            ))}
                            <TableRow className="bg-secondary/50">
                                <TableCell className="font-bold">Total</TableCell>
                                {debateState.teams.map(team => (
                                    <TableCell key={team.name} className="text-center font-bold text-lg text-primary">{calculateTotal(team.name)}</TableCell>
                                ))}
                            </TableRow>
                            <TableRow>
                                <TableCell className="font-medium text-xs text-muted-foreground flex items-center gap-2"><Hash className="h-3 w-3"/>Checksum</TableCell>
                                {debateState.teams.map(team => (
                                    <TableCell key={team.name} className="text-center font-mono text-xs text-muted-foreground">{calculateChecksum(team.name)}</TableCell>
                                ))}
                            </TableRow>
                            </TableBody>
                        </Table>
                    </div>
                    </CardContent>
                </Card>
                <div className="mt-8 flex justify-end">
                    <Button size="lg" onClick={handleSubmit} disabled={isSubmitting || rubricCriteria.length === 0}>
                        {isSubmitting ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Check className="mr-2 h-4 w-4" />
                        )}
                        {isSubmitting ? 'Enviando...' : 'Enviar Puntuación'}
                    </Button>
                </div>
            </>
        )
      ) : (
        <Card>
            <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">Esperando a que el moderador configure los equipos para la ronda actual...</p>
            </CardContent>
        </Card>
      )}


       <Card className="mt-12">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><History className="h-6 w-6"/>Historial de Puntuaciones</CardTitle>
                <CardDescription>Revise las puntuaciones que ha enviado en rondas anteriores.</CardDescription>
            </CardHeader>
            <CardContent>
                {loadingHistory && <p>Cargando historial...</p>}
                {!loadingHistory && pastScores.length === 0 && <p className="text-muted-foreground text-sm">Aún no ha enviado ninguna puntuación.</p>}
                <Accordion type="single" collapsible className="w-full">
                    {pastScores.map(score => (
                        <AccordionItem value={score.id} key={score.id}>
                            <AccordionTrigger>
                                <div className="flex justify-between items-center w-full pr-4">
                                    <span className="font-bold capitalize">{score.matchId.replace(/-/g, ' ')}</span>
                                    <div className="text-right text-sm">
                                      {score.teams.map(t => `${t.name}: ${t.total}`).join(' vs ')}
                                    </div>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent>
                                {score.fullScores && score.fullScores.length > 0 ? (
                                    <div className="space-y-4">
                                        {score.fullScores.map(teamScore => (
                                            <div key={teamScore.name}>
                                                <h4 className="font-semibold">{teamScore.name} - Total: {teamScore.total}</h4>
                                                <Table className="mt-2 text-xs">
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead>Criterio</TableHead>
                                                            <TableHead className="text-right">Puntaje</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {Object.entries(teamScore.scores).map(([criterionId, points]) => (
                                                            <TableRow key={criterionId}>
                                                                <TableCell>{getCriterionName(criterionId)}</TableCell>
                                                                <TableCell className="text-right">{points}</TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">No hay desglose disponible para esta puntuación.</p>
                                )}
                                <p className="text-xs text-muted-foreground mt-4">Enviado el: {new Date(score.createdAt.seconds * 1000).toLocaleString()}</p>
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </CardContent>
        </Card>
    </div>
  );
}

export default function ScoringPage() {
    return (
        <JudgeAuth>
            <ScoringPanel />
        </JudgeAuth>
    )
}

    