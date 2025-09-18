
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Users, HelpCircle, ClipboardCheck, BarChart3 } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: number | string;
  icon: React.ElementType;
  loading: boolean;
}

function MetricCard({ title, value, icon: Icon, loading }: MetricCardProps) {
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
          <div className="text-2xl font-bold">{value}</div>
        )}
      </CardContent>
    </Card>
  );
}

export function RealTimeDashboard() {
  const [schoolCount, setSchoolCount] = useState(0);
  const [questionCount, setQuestionCount] = useState(0);
  const [scoreCount, setScoreCount] = useState(0);
  const [surveyCount, setSurveyCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const queries = [
      { collectionName: "schools", setter: setSchoolCount },
      { collectionName: "studentQuestions", setter: setQuestionCount },
      { collectionName: "scores", setter: setScoreCount },
      { collectionName: "surveyResponses", setter: setSurveyCount },
    ];

    const unsubscribers = queries.map(({ collectionName, setter }) => {
      const q = query(collection(db, collectionName));
      return onSnapshot(q, (snapshot) => {
        setter(snapshot.size);
      }, (error) => {
        console.error(`Error fetching ${collectionName}:`, error);
      });
    });

    setLoading(false);

    return () => unsubscribers.forEach(unsub => unsub());
  }, []);

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
                value={schoolCount}
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
                value={scoreCount}
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
    </div>
  );
}
