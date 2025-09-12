
"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "lucide-react";

const scheduleDay1 = [
    { time: "8:00 AM - 8:30 AM", activity: "Registro y Bienvenida" },
    { time: "8:30 AM - 9:00 AM", activity: "Ceremonia de Apertura" },
    { time: "9:00 AM - 10:00 AM", activity: "Fase de Grupos - Ronda 1 (Grupo A vs Grupo B)" },
    { time: "10:00 AM - 10:15 AM", activity: "Receso" },
    { time: "10:15 AM - 11:15 AM", activity: "Fase de Grupos - Ronda 2 (Grupo C vs Grupo D)" },
    { time: "11:15 AM - 12:15 PM", activity: "Fase de Grupos - Ronda 3 (Grupo A vs Grupo C)" },
    { time: "12:15 PM - 1:30 PM", activity: "Almuerzo" },
    { time: "1:30 PM - 2:30 PM", activity: "Fase de Grupos - Ronda 4 (Grupo B vs Grupo D)" },
    { time: "2:30 PM - 3:30 PM", activity: "Anuncio de Clasificados a Cuartos de Final" },
];

const scheduleDay2 = [
    { time: "9:00 AM - 10:00 AM", activity: "Cuartos de Final - Enfrentamiento 1" },
    { time: "10:00 AM - 11:00 AM", activity: "Cuartos de Final - Enfrentamiento 2" },
    { time: "11:00 AM - 11:15 AM", activity: "Receso" },
    { time: "11:15 AM - 12:15 PM", activity: "Semifinal 1" },
    { time: "12:15 PM - 1:15 PM", activity: "Semifinal 2" },
    { time: "1:15 PM - 2:30 PM", activity: "Almuerzo" },
    { time: "2:30 PM - 4:00 PM", activity: "GRAN FINAL" },
    { time: "4:00 PM - 4:30 PM", activity: "Deliberación del Jurado" },
    { time: "4:30 PM - 5:00 PM", activity: "Ceremonia de Premiación y Clausura" },
];


export default function ProgramacionPage() {
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
                <ScheduleTable schedule={scheduleDay1} />
            </TabsContent>
            <TabsContent value="day2" className="mt-6">
                <ScheduleTable schedule={scheduleDay2} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function ScheduleTable({ schedule }: { schedule: { time: string, activity: string }[] }) {
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
                    {schedule.map((item, index) => (
                    <TableRow key={index}>
                        <TableCell className="font-medium">{item.time}</TableCell>
                        <TableCell>{item.activity}</TableCell>
                    </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
