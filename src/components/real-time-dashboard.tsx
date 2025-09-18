
"use client";

import { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Users, HelpCircle, ClipboardCheck, BarChart3, Trophy, TrendingUp } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { ResponsiveContainer, BarChart, XAxis, YAxis, Tooltip, Bar } from 'recharts';

interface MetricCardProps {
  title: string;
  value: number | string;
  icon: React.ElementType;
  description?: string;
  loading: boolean;
}

function MetricCard({ title, value, icon: Icon, description, loading }: MetricCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : (
          <>
            <div className="text-2xl font-bold">{value}</div>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}

interface SchoolData {
  id: string;
  teamName: string;
}

interface ScoreData {
  id: string;
  matchId: string;
  teams: { name: string; total: number }[];
}

interface RoundData {
  id: string;
  name: string;
  phase: string;
}

interface RealTimeDashboardProps {
    schools: SchoolData[];
    allScores: ScoreData[];
    allRounds: RoundData[];
}

export function RealTimeDashboard({ schools, allScores, allRounds }: RealTimeDashboardProps) {
  const [questionCount, setQuestionCount] = useState(0);
  const [surveyCount, setSurveyCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const queries = [
      { collectionName: "studentQuestions", setter: setQuestionCount },
      { collectionName: "surveyResponses", setter: setSurveyCount },
    ];

    const unsubscribers = queries.map(({ collectionName, setter }) => {
      const q = query(collection(db, collectionName));
      return onSnapshot(q, (snapshot) => {
        setter(snapshot.size);
      });
    });

    if (schools.length || allScores.length || allRounds.length) {
        setLoading(false);
    }

    return () => unsubscribers.forEach(unsub => unsub());
  }, [schools, allScores, allRounds]);
  
  const topScoringTeam = useMemo(() => {
    if (allScores.length === 0) return null;
    const teamTotals: Record<string, number> = {};
    allScores.forEach(score => {
        score.teams.forEach(team => {
            teamTotals[team.name] = (teamTotals[team.name] || 0) + team.total;
        });
    });
    return Object.entries(teamTotals).reduce((top, current) => current[1] > top[1] ? current : top, ["", 0]);
  }, [allScores]);

  const pointsByPhase = useMemo(() => {
     if (allScores.length === 0 || allRounds.length === 0) return [];
     const phaseTotals: Record<string, number> = {};
     allScores.forEach(score => {
         const round = allRounds.find(r => score.matchId.startsWith(r.name));
         if (round) {
             const phase = round.phase || 'Sin Fase';
             phaseTotals[phase] = (phaseTotals[phase] || 0) + score.teams.reduce((sum, t) => sum + t.total, 0);
         }
     });
     return Object.entries(phaseTotals).map(([name, Total]) => ({ name, Total }));
  }, [allScores, allRounds]);

  const pointsByRound = useMemo(() => {
      if (allScores.length === 0) return [];
      const roundTotals: Record<string, number> = {};
      allScores.forEach(score => {
          const roundName = score.matchId.split('-bye-')[0];
          const totalPointsInScore = score.teams.reduce((sum, t) => sum + t.total, 0);
          roundTotals[roundName] = (roundTotals[roundName] || 0) + totalPointsInScore;
      });
      return Object.entries(roundTotals).sort((a,b) => a[0].localeCompare(b[0], undefined, {numeric: true}));
  }, [allScores]);


  return (
    <div>
        <div className="mb-8">
            <h1 className="font-headline text-3xl md:text-4xl font-bold">
                Dashboard en Tiempo Real
            </h1>
            <p className="text-muted-foreground mt-2">
                Métricas clave de la competencia actualizadas al instante.
            </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard 
                title="Colegios Registrados"
                value={schools.length}
                icon={Users}
                loading={loading}
            />
            <MetricCard 
                title="Preguntas del Público"
                value={questionCount}
                icon={HelpCircle}
                loading={loading}
            />
            <MetricCard 
                title="Puntuaciones de Jurados"
                value={allScores.length}
                icon={ClipboardCheck}
                loading={loading}
            />
             <MetricCard 
                title="Respuestas de Encuesta"
                value={surveyCount}
                icon={BarChart3}
                loading={loading}
            />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
            <div className="lg:col-span-1">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-amber-600">
                            <Trophy className="h-5 w-5" />
                            Equipo con Mayor Puntaje
                        </CardTitle>
                        <CardDescription>Equipo con el puntaje total más alto acumulado hasta ahora.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loading ? <Loader2 className="h-6 w-6 animate-spin"/> : topScoringTeam && topScoringTeam[0] ? (
                            <div>
                                <p className="text-3xl font-bold">{topScoringTeam[0]}</p>
                                <p className="text-lg text-muted-foreground">{topScoringTeam[1]} puntos</p>
                            </div>
                        ) : <p className="text-muted-foreground">No hay datos de puntaje.</p>}
                    </CardContent>
                </Card>
                 <Card className="mt-6">
                    <CardHeader>
                        <CardTitle>Puntos por Ronda</CardTitle>
                    </CardHeader>
                    <CardContent className="max-h-60 overflow-y-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Ronda</TableHead>
                                    <TableHead className="text-right">Puntos Totales</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {pointsByRound.map(([name, total]) => (
                                    <TableRow key={name}>
                                        <TableCell className="font-medium">{name}</TableCell>
                                        <TableCell className="text-right font-bold">{total}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
            <div className="lg:col-span-2">
                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5" />
                            Puntos Totales por Fase
                        </CardTitle>
                        <CardDescription>Visualización del total de puntos otorgados en cada fase de la competencia.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loading ? <Loader2 className="h-6 w-6 animate-spin"/> : pointsByPhase.length > 0 ? (
                        <ResponsiveContainer width="100%" height={350}>
                            <BarChart data={pointsByPhase}>
                                <XAxis
                                dataKey="name"
                                stroke="#888888"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                />
                                <YAxis
                                stroke="#888888"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(value) => `${value}`}
                                />
                                <Tooltip
                                    cursor={{ fill: 'hsl(var(--secondary))' }}
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            return (
                                                <div className="rounded-lg border bg-background p-2 shadow-sm">
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div className="flex flex-col">
                                                        <span className="text-[0.70rem] uppercase text-muted-foreground">
                                                            Fase
                                                        </span>
                                                        <span className="font-bold text-muted-foreground">
                                                            {payload[0].payload.name}
                                                        </span>
                                                        </div>
                                                        <div className="flex flex-col">
                                                        <span className="text-[0.70rem] uppercase text-muted-foreground">
                                                            Puntos
                                                        </span>
                                                        <span className="font-bold">
                                                            {payload[0].value}
                                                        </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        }
                                        return null;
                                    }}
                                />
                                <Bar dataKey="Total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                        ) : <p className="text-muted-foreground text-center py-10">No hay datos suficientes para mostrar el gráfico.</p>}
                    </CardContent>
                </Card>
            </div>
        </div>
    </div>
  );
}
