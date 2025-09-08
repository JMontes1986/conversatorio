
"use client";

import { useState } from 'react';
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
import { Swords, Check, Hash, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { JudgeAuth } from '@/components/auth/judge-auth';
import { useJudgeAuth } from '@/context/judge-auth-context';
import { cn } from '@/lib/utils';

const rubricCriteria = [
    { id: 'arg', name: 'Argumentación', description: 'Calidad y solidez de los argumentos.' },
    { id: 'reb', name: 'Refutación', description: 'Habilidad para contra-argumentar eficazmente.' },
    { id: 'clar', name: 'Claridad y Oratoria', description: 'Expresión verbal, lenguaje corporal y claridad.' },
    { id: 'est', name: 'Estrategia', description: 'Uso del tiempo y estructura del discurso.' },
    { id: 'resp', name: 'Respeto y Ética', description: 'Conducta hacia el equipo contrario y moderador.' },
];

// MOCK DATA - This would come from the router or a state management solution
const MOCK_MATCH_DATA = {
    matchId: 'semifinal-1',
    teamAName: 'Águilas Doradas',
    teamBName: 'Búhos Sabios',
};

function ScoringPanel() {
  const { toast } = useToast();
  const { judge } = useJudgeAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scores, setScores] = useState<Record<string, Record<string, number>>>({
    teamA: {},
    teamB: {}
  });

  const handleScoreChange = (team: 'teamA' | 'teamB', criteriaId: string, value: number) => {
    setScores(prev => ({
      ...prev,
      [team]: {
        ...prev[team],
        [criteriaId]: value
      }
    }));
  };

  const calculateTotal = (team: 'teamA' | 'teamB') => {
    return Object.values(scores[team]).reduce((sum, score) => sum + score, 0);
  };
  
  const calculateChecksum = (team: 'teamA' | 'teamB') => {
    const scoreString = Object.keys(rubricCriteria).map(key => scores[team][rubricCriteria[parseInt(key)].id] || 0).join('-');
    let hash = 0;
    for (let i = 0; i < scoreString.length; i++) {
        const char = scoreString.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString(16).toUpperCase();
  }

  const handleSubmit = async () => {
     if (Object.keys(scores.teamA).length < rubricCriteria.length || Object.keys(scores.teamB).length < rubricCriteria.length) {
        toast({
            variant: "destructive",
            title: "Error de Validación",
            description: "Por favor, asigne una puntuación a todos los criterios para ambos equipos.",
        });
        return;
    }

    setIsSubmitting(true);
    
    const totalTeamA = calculateTotal('teamA');
    const totalTeamB = calculateTotal('teamB');

    const scoreData = {
        matchId: MOCK_MATCH_DATA.matchId,
        judgeName: judge?.name || 'Jurado Anónimo',
        judgeCedula: judge?.cedula || '',
        teamAName: MOCK_MATCH_DATA.teamAName,
        teamBName: MOCK_MATCH_DATA.teamBName,
        scoresTeamA: scores.teamA,
        scoresTeamB: scores.teamB,
        teamA_total: totalTeamA,
        teamB_total: totalTeamB,
        checksumA: calculateChecksum('teamA'),
        checksumB: calculateChecksum('teamB'),
        createdAt: new Date(),
    };

    try {
        await addDoc(collection(db, "scores"), scoreData);
        toast({
            title: "Puntuación Enviada",
            description: "Sus calificaciones han sido registradas exitosamente.",
        });
        // Optionally reset the form or redirect
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

  const ScoreButtons = ({ team, criteriaId }: { team: 'teamA' | 'teamB', criteriaId: string }) => (
    <div className="flex justify-center items-center gap-1 md:gap-2">
      {[1, 2, 3, 4, 5].map((value) => (
        <Button
          key={value}
          variant={scores[team][criteriaId] === value ? 'default' : 'outline'}
          size="icon"
          className="h-8 w-8 md:h-9 md:w-9 rounded-full"
          onClick={() => handleScoreChange(team, criteriaId, value)}
          disabled={isSubmitting}
        >
          {value}
        </Button>
      ))}
    </div>
  );

  return (
    <div className="container mx-auto py-10 px-4 md:px-6">
      <div className="mb-8 text-center">
        <h1 className="font-headline text-3xl md:text-4xl font-bold">
          Panel de Puntuación del Juez
        </h1>
        <p className="text-muted-foreground mt-2 capitalize">
            Juez: <span className="font-semibold text-foreground">{judge?.name}</span> | Ronda: {MOCK_MATCH_DATA.matchId.replace('-', ' ')}
        </p>
      </div>

      <div className="flex justify-center items-center mb-8 space-x-4">
        <h2 className="font-headline text-2xl text-center">{MOCK_MATCH_DATA.teamAName}</h2>
        <Swords className="h-8 w-8 text-primary shrink-0" />
        <h2 className="font-headline text-2xl text-center">{MOCK_MATCH_DATA.teamBName}</h2>
      </div>

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
                    <TableHead className="w-1/3 text-center min-w-[200px]">{MOCK_MATCH_DATA.teamAName}</TableHead>
                    <TableHead className="w-1/3 text-center min-w-[200px]">{MOCK_MATCH_DATA.teamBName}</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {rubricCriteria.map(criterion => (
                    <TableRow key={criterion.id}>
                    <TableCell>
                        <p className="font-medium">{criterion.name}</p>
                        <p className="text-xs text-muted-foreground">{criterion.description}</p>
                    </TableCell>
                    <TableCell>
                        <ScoreButtons team="teamA" criteriaId={criterion.id} />
                    </TableCell>
                    <TableCell>
                        <ScoreButtons team="teamB" criteriaId={criterion.id} />
                    </TableCell>
                    </TableRow>
                ))}
                <TableRow className="bg-secondary/50">
                    <TableCell className="font-bold">Total</TableCell>
                    <TableCell className="text-center font-bold text-lg text-primary">{calculateTotal('teamA')}</TableCell>
                    <TableCell className="text-center font-bold text-lg text-primary">{calculateTotal('teamB')}</TableCell>
                </TableRow>
                <TableRow>
                    <TableCell className="font-medium text-xs text-muted-foreground flex items-center gap-2"><Hash className="h-3 w-3"/>Checksum</TableCell>
                    <TableCell className="text-center font-mono text-xs text-muted-foreground">{calculateChecksum('teamA')}</TableCell>
                    <TableCell className="text-center font-mono text-xs text-muted-foreground">{calculateChecksum('teamB')}</TableCell>
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
