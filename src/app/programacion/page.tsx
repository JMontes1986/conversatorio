
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { format, parse } from 'date-fns';


interface ScheduleItem {
  id: string;
  time: string;
  activity: string;
}

interface ScheduleData {
  day1: ScheduleItem[];
  day2: ScheduleItem[];
}

const defaultSchedule: ScheduleData = {
  day1: [
    { id: 'd1-1', time: "08:00", activity: "Registro y Bienvenida" },
    { id: 'd1-2', time: "08:30", activity: "Ceremonia de Apertura" },
    { id: 'd1-3', time: "09:00", activity: "Fase de Grupos - Ronda 1 (Grupo A vs Grupo B)" },
    { id: 'd1-4', time: "10:00", activity: "Receso" },
    { id: 'd1-5', time: "10:15", activity: "Fase de Grupos - Ronda 2 (Grupo C vs Grupo D)" },
    { id: 'd1-6', time: "11:15", activity: "Fase de Grupos - Ronda 3 (Grupo A vs Grupo C)" },
    { id: 'd1-7', time: "12:15", activity: "Almuerzo" },
    { id: 'd1-8', time: "13:30", activity: "Fase de Grupos - Ronda 4 (Grupo B vs Grupo D)" },
    { id: 'd1-9', time: "14:30", activity: "Anuncio de Clasificados a Cuartos de Final" },
  ],
  day2: [
    { id: 'd2-1', time: "09:00", activity: "Cuartos de Final - Enfrentamiento 1" },
    { id: 'd2-2', time: "10:00", activity: "Cuartos de Final - Enfrentamiento 2" },
    { id: 'd2-3', time: "11:00", activity: "Receso" },
    { id: 'd2-4', time: "11:15", activity: "Semifinal 1" },
    { id: 'd2-5', time: "12:15", activity: "Semifinal 2" },
    { id: 'd2-6', time: "13:15", activity: "Almuerzo" },
    { id: 'd2-7', time: "14:30", activity: "GRAN FINAL" },
    { id: 'd2-8', time: "16:00", activity: "Deliberación del Jurado" },
    { id: 'd2-9', time: "16:30", activity: "Ceremonia de Premiación y Clausura" },
  ]
};

const formatTimeForDisplay = (timeString: string) => {
    if (!timeString || !timeString.includes(':')) {
        return timeString; // Return original if not in HH:mm format
    }
    try {
        const date = parse(timeString, 'HH:mm', new Date());
        return format(date, 'h:mm a');
    } catch (e) {
        console.error("Error formatting time:", e);
        return timeString; // Fallback to original string
    }
};


export default function ProgramacionPage() {
  const [schedule, setSchedule] = useState<ScheduleData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const docRef = doc(db, 'siteContent', 'schedule');
    const unsubscribe = onSnapshot(docRef, (doc) => {
      if (doc.exists()) {
        setSchedule(doc.data() as ScheduleData);
      } else {
        setSchedule(defaultSchedule);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading || !schedule) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10 px-4 md:px-6">
      <div className="mb-8 text-center">
        <h1 className="font-headline text-3xl md:text-4xl font-bold">
          Programación del Evento
        </h1>
        <p className="text-muted-foreground mt-2">
          Cronograma de actividades para el Conversatorio Colgemelli.
        </p>
      </div>

      <Card>
        <CardContent className="p-4 md:p-6">
          <Tabs defaultValue="day1" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="day1">Sábado, 17 de Agosto</TabsTrigger>
              <TabsTrigger value="day2">Domingo, 18 de Agosto</TabsTrigger>
            </TabsList>
            <TabsContent value="day1" className="mt-6">
                <ScheduleTable schedule={schedule.day1} />
            </TabsContent>
            <TabsContent value="day2" className="mt-6">
                <ScheduleTable schedule={schedule.day2} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function ScheduleTable({ schedule }: { schedule: ScheduleItem[] }) {
    if (!schedule || schedule.length === 0) {
        return <p className="text-center text-muted-foreground py-8">No hay programación definida para este día.</p>;
    }
    return (
        <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead className="w-[150px] md:w-[200px]">Hora</TableHead>
                    <TableHead>Descripción de la Actividad</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {schedule.map((item) => (
                    <TableRow key={item.id}>
                        <TableCell className="font-medium">{formatTimeForDisplay(item.time)}</TableCell>
                        <TableCell>{item.activity}</TableCell>
                    </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
