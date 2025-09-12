
"use client";

import { useForm, useFieldArray, Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Trash2, PlusCircle, Save, CheckCircle } from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import React, { useEffect, useState, useCallback, useRef } from "react";
import { nanoid } from "nanoid";
import { Switch } from "./ui/switch";
import { Badge } from "./ui/badge";

const scheduleItemSchema = z.object({
  id: z.string(),
  time: z.string().min(1, "La hora de inicio es requerida."),
  endTime: z.string().min(1, "La hora de finalización es requerida."),
  activity: z.string().min(3, "La actividad es requerida."),
  completed: z.boolean().optional(),
});

const formSchema = z.object({
  day1: z.array(scheduleItemSchema),
  day2: z.array(scheduleItemSchema),
});

type FormData = z.infer<typeof formSchema>;

const defaultSchedule: FormData = {
  day1: [
    { id: 'd1-1', time: "08:00", endTime: "08:30", activity: "Registro y Bienvenida", completed: false },
    { id: 'd1-2', time: "08:30", endTime: "09:00", activity: "Ceremonia de Apertura", completed: false },
    { id: 'd1-3', time: "09:00", endTime: "10:00", activity: "Fase de Grupos - Ronda 1 (Grupo A vs Grupo B)", completed: false },
    { id: 'd1-4', time: "10:00", endTime: "10:15", activity: "Receso", completed: false },
    { id: 'd1-5', time: "10:15", endTime: "11:15", activity: "Fase de Grupos - Ronda 2 (Grupo C vs Grupo D)", completed: false },
    { id: 'd1-6', time: "11:15", endTime: "12:15", activity: "Fase de Grupos - Ronda 3 (Grupo A vs Grupo C)", completed: false },
    { id: 'd1-7', time: "12:15", endTime: "13:30", activity: "Almuerzo", completed: false },
    { id: 'd1-8', time: "13:30", endTime: "14:30", activity: "Fase de Grupos - Ronda 4 (Grupo B vs Grupo D)", completed: false },
    { id: 'd1-9', time: "14:30", endTime: "15:00", activity: "Anuncio de Clasificados a Cuartos de Final", completed: false },
  ],
  day2: [
    { id: 'd2-1', time: "09:00", endTime: "10:00", activity: "Cuartos de Final - Enfrentamiento 1", completed: false },
    { id: 'd2-2', time: "10:00", endTime: "11:00", activity: "Cuartos de Final - Enfrentamiento 2", completed: false },
    { id: 'd2-3', time: "11:00", endTime: "11:15", activity: "Receso", completed: false },
    { id: 'd2-4', time: "11:15", endTime: "12:15", activity: "Semifinal 1", completed: false },
    { id: 'd2-5', time: "12:15", endTime: "13:15", activity: "Semifinal 2", completed: false },
    { id: 'd2-6', time: "13:15", endTime: "14:30", activity: "Almuerzo", completed: false },
    { id: 'd2-7', time: "14:30", endTime: "16:00", activity: "GRAN FINAL", completed: false },
    { id: 'd2-8', time: "16:00", endTime: "16:30", activity: "Deliberación del Jurado", completed: false },
    { id: 'd2-9', time: "16:30", endTime: "17:00", activity: "Ceremonia de Premiación y Clausura", completed: false },
  ]
};

type SaveStatus = "idle" | "saving" | "saved";

export function ScheduleEditor() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const isInitialLoad = useRef(true);
  
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: defaultSchedule,
  });
  
  const watchedValues = form.watch();

  const saveSchedule = useCallback(async (values: FormData) => {
    setSaveStatus("saving");
    try {
      await setDoc(doc(db, 'siteContent', 'schedule'), values);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (error) {
      console.error("Error auto-saving schedule: ", error);
      toast({
        variant: "destructive",
        title: "Error de Guardado Automático",
        description: "No se pudieron guardar los cambios.",
      });
      setSaveStatus("idle");
    }
  }, [toast]);

  useEffect(() => {
    const docRef = doc(db, 'siteContent', 'schedule');
    const unsubscribe = onSnapshot(docRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        const sanitizedData: FormData = {
            day1: data.day1 && data.day1.length > 0 ? data.day1.map((item: any) => ({ ...item, completed: item.completed ?? false })) : defaultSchedule.day1,
            day2: data.day2 && data.day2.length > 0 ? data.day2.map((item: any) => ({ ...item, completed: item.completed ?? false })) : defaultSchedule.day2,
        };
        form.reset(sanitizedData);
      } else {
        form.reset(defaultSchedule);
      }
      setLoading(false);
      // Set a flag to indicate the initial data load is complete.
      setTimeout(() => {
        isInitialLoad.current = false;
      }, 50);
    });

    return () => unsubscribe();
  }, [form]);
  
  useEffect(() => {
    // Don't save on initial load or while loading.
    if (isInitialLoad.current || loading) return;

    const subscription = form.watch((value, { name, type }) => {
      if (type === 'change') {
         saveSchedule(value as FormData);
      }
    });
    return () => subscription.unsubscribe();
  }, [form, saveSchedule, loading]);


  if (loading) {
    return (
      <div className="flex justify-center items-center py-10">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
            <div>
                 <CardTitle>Editor de Programación del Evento</CardTitle>
                <CardDescription>
                Modifique el cronograma para los días del evento. Los cambios se guardan automáticamente.
                </CardDescription>
            </div>
            <div>
                 {saveStatus === 'saving' && <Badge variant="outline"><Loader2 className="mr-2 h-3 w-3 animate-spin"/>Guardando...</Badge>}
                {saveStatus === 'saved' && <Badge variant="secondary" className="bg-green-100 text-green-800"><CheckCircle className="mr-2 h-3 w-3"/>Guardado</Badge>}
            </div>
        </div>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form className="space-y-8">
            <ScheduleDayEditor day="day1" title="Sábado, 17 de Agosto" control={form.control} />
            <ScheduleDayEditor day="day2" title="Domingo, 18 de Agosto" control={form.control} />
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function ScheduleDayEditor({ day, title, control }: { day: "day1" | "day2", title: string, control: any }) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: day
  });
  
  const [debouncedAppend] = React.useCallback(
    debounce((data) => append(data), 300),
    [append]
  );
  
  const handleAppend = () => {
    debouncedAppend({ id: nanoid(), time: "", endTime: "", activity: "", completed: false })
  }

  return (
    <div className="space-y-4 rounded-md border p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">{title}</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAppend}
        >
          <PlusCircle className="mr-2 h-4 w-4" /> Añadir Actividad
        </Button>
      </div>
      <div className="space-y-4">
        {fields.map((field, index) => (
          <div key={field.id} className="grid grid-cols-1 md:grid-cols-[1fr_2fr_auto] gap-4 items-center bg-secondary/30 p-3 rounded-md relative">
             <div className="absolute top-2 right-12">
                 <FormField
                    control={control}
                    name={`${day}.${index}.completed`}
                    render={({ field }) => (
                         <FormItem className="flex items-center space-x-2">
                             <FormControl>
                                <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                />
                            </FormControl>
                            <FormLabel className="text-xs">Completado</FormLabel>
                        </FormItem>
                    )}
                    />
             </div>
            <div className="grid grid-cols-2 gap-2">
                <FormField
                control={control}
                name={`${day}.${index}.time`}
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Inicio</FormLabel>
                    <FormControl><Input type="time" {...field} /></FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                 <FormField
                control={control}
                name={`${day}.${index}.endTime`}
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Fin</FormLabel>
                    <FormControl><Input type="time" {...field} /></FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>
            <FormField
              control={control}
              name={`${day}.${index}.activity`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Actividad</FormLabel>
                  <FormControl><Input {...field} placeholder="Descripción de la actividad" /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="self-center text-destructive"
              onClick={() => remove(index)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {fields.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-4">No hay actividades para este día.</p>
        )}
      </div>
    </div>
  );
}

// Simple debounce function
function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<F>): void => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => func(...args), waitFor);
  };
}

    