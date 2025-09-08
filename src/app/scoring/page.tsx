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
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from '@/components/ui/badge';
import { Swords, Check, Hash } from 'lucide-react';

const rubricCriteria = [
    { id: 'arg', name: 'Argumentación', description: 'Calidad y solidez de los argumentos.' },
    { id: 'reb', name: 'Refutación', description: 'Habilidad para contra-argumentar eficazmente.' },
    { id: 'clar', name: 'Claridad y Oratoria', description: 'Expresión verbal, lenguaje corporal y claridad.' },
    { id: 'est', name: 'Estrategia', description: 'Uso del tiempo y estructura del discurso.' },
    { id: 'resp', name: 'Respeto y Ética', description: 'Conducta hacia el equipo contrario y moderador.' },
];

export default function ScoringPage() {
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

  return (
    <div className="container mx-auto py-10 px-4 md:px-6">
      <div className="mb-8 text-center">
        <h1 className="font-headline text-3xl md:text-4xl font-bold">
          Panel de Puntuación del Juez
        </h1>
        <p className="text-muted-foreground mt-2">
          Ronda: Semifinales - Partida SF-1
        </p>
      </div>

      <div className="flex justify-center items-center mb-8 space-x-4">
        <h2 className="font-headline text-2xl">Águilas Doradas</h2>
        <Swords className="h-8 w-8 text-primary" />
        <h2 className="font-headline text-2xl">Búhos Sabios</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Rúbrica de Evaluación</CardTitle>
          <CardDescription>Deslice para asignar una puntuación de 1 a 10 para cada criterio.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-1/4">Criterio</TableHead>
                <TableHead className="w-1/3 text-center">Águilas Doradas</TableHead>
                <TableHead className="w-1/3 text-center">Búhos Sabios</TableHead>
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
                    <div className="flex items-center gap-4">
                        <Slider
                            defaultValue={[5]}
                            max={10}
                            min={1}
                            step={1}
                            onValueChange={(value) => handleScoreChange('teamA', criterion.id, value[0])}
                        />
                        <Badge className="w-12 justify-center" variant="secondary">{scores.teamA[criterion.id] || '-'}</Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-4">
                        <Slider
                            defaultValue={[5]}
                            max={10}
                            min={1}
                            step={1}
                            onValueChange={(value) => handleScoreChange('teamB', criterion.id, value[0])}
                        />
                        <Badge className="w-12 justify-center" variant="secondary">{scores.teamB[criterion.id] || '-'}</Badge>
                    </div>
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
        </CardContent>
      </Card>
      <div className="mt-8 flex justify-end">
          <Button size="lg">
              <Check className="mr-2 h-4 w-4" />
              Enviar Puntuación
          </Button>
      </div>
    </div>
  );
}
