
"use client";

import { useState, useEffect } from 'react';
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
import { Swords, Check, Hash, Loader2, History } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, addDoc, doc, onSnapshot, query, where, getDocs, orderBy } from 'firebase/firestore';
import { JudgeAuth } from '@/components/auth/judge-auth';
import { useJudgeAuth } from '@/context/judge-auth-context';
import { cn } from '@/lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const rubricCriteria = [
    { id: 'arg', name: 'Argumentación', description: 'Calidad y solidez de los argumentos.' },
    { id: 'reb', name: 'Refutación', description: 'Habilidad para contra-argumentar eficazmente.' },
    { id: 'clar', name: 'Claridad y Oratoria', description: 'Expresión verbal, lenguaje corporal y claridad.' },
    { id: 'est', name: 'Estrategia', description: 'Uso del tiempo y estructura del discurso.' },
    { id: 'resp', name: 'Respeto y Ética', description: 'Conducta hacia el equipo contrario y moderador.' },
];

const DEBATE_STATE_DOC_ID = "current";

interface Team {
    id: number;
    name: string;
}

interface DebateState {
    currentRound: string;
    teams: Team[];
}

interface ScoreData {
    id: string;
    matchId: string;
    teams: { name: string; total: number }[];
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

    return () => unsubscribeDebateState();
  }, []);

  useEffect(() => {
      if (!judge?.id) return;
      
      setLoadingHistory(true);
      const scoresQuery = query(
          collection(db, "scores"),
          where("judgeId", "==", judge.id),
          orderBy("createdAt", "desc")
      );

      const unsubscribeHistory = onSnapshot(scoresQuery, (querySnapshot) => {
          const scoresData: ScoreData[] = querySnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
          } as ScoreData));
          setPastScores(scoresData);
          setLoadingHistory(false);
      }, (error) => {
        console.error("Error fetching score history:", error);
        setLoadingHistory(false);
      });

      return () => unsubscribeHistory();

  }, [judge]);


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
    if (!scores[teamName]) return '';
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

  if (loadingDebateState) {
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
                <div key={team.id} className="flex items-center">
                    <h2 className="font-headline text-xl md:text-2xl text-center">{team.name}</h2>
                    {index < debateState.teams.length - 1 && <Swords className="h-6 w-6 md:h-8 md:w-8 text-primary shrink-0 mx-2" />}
                </div>
            ))}
        </div>
      )}

      {debateState.teams.length > 0 ? (
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
                                <TableHead key={team.id} className="w-1/3 text-center min-w-[200px]">{team.name}</TableHead>
                            ))}
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {rubricCriteria.map(criterion => (
                            <TableRow key={criterion.id}>
                            <TableCell>
                                <p className="font-medium">{criterion.name}</p>
                                <p className="text-xs text-muted-foreground">{criterion.description}</p>
                            </TableCell>
                            {debateState.teams.map(team => (
                                <TableCell key={team.id}>
                                    <ScoreButtons teamName={team.name} criteriaId={criterion.id} />
                                </TableCell>
                            ))}
                            </TableRow>
                        ))}
                        <TableRow className="bg-secondary/50">
                            <TableCell className="font-bold">Total</TableCell>
                            {debateState.teams.map(team => (
                                <TableCell key={team.id} className="text-center font-bold text-lg text-primary">{calculateTotal(team.name)}</TableCell>
                            ))}
                        </TableRow>
                        <TableRow>
                            <TableCell className="font-medium text-xs text-muted-foreground flex items-center gap-2"><Hash className="h-3 w-3"/>Checksum</TableCell>
                            {debateState.teams.map(team => (
                                <TableCell key={team.id} className="text-center font-mono text-xs text-muted-foreground">{calculateChecksum(team.name)}</TableCell>
                            ))}
                        </TableRow>
                        </TableBody>
                    </Table>
                </div>
                </CardContent>
            </Card>
            <div className="mt-8 flex justify-end">
                <Button size="lg" onClick={handleSubmit} disabled={isSubmitting}>
                    {isSubmitting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Check className="mr-2 h-4 w-4" />
                    )}
                    {isSubmitting ? 'Enviando...' : 'Enviar Puntuación'}
                </Button>
            </div>
        </>
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
                                {score.teams.map(t => (
                                     <p key={t.name} className="text-sm">Puntuación final para <span className="font-semibold">{t.name}</span>: <span className="font-bold text-primary">{t.total}</span></p>
                                ))}
                                <p className="text-xs text-muted-foreground mt-2">Enviado el: {new Date(score.createdAt.seconds * 1000).toLocaleString()}</p>
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

    