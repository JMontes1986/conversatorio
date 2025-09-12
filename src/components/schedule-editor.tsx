
"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Trash2, PlusCircle, Save } from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import React, { useEffect, useState } from "react";
import { nanoid } from "nanoid";

const scheduleItemSchema = z.object({
  id: z.string(),
  time: z.string().min(1, "La hora es requerida."),
  activity: z.string().min(3, "La actividad es requerida."),
});

const formSchema = z.object({
  day1: z.array(scheduleItemSchema),
  day2: z.array(scheduleItemSchema),
});

type FormData = z.infer<typeof formSchema>;

const defaultSchedule: FormData = {
  day1: [
    { id: 'd1-1', time: "8:00 AM - 8:30 AM", activity: "Registro y Bienvenida" },
    { id: 'd1-2', time: "8:30 AM - 9:00 AM", activity: "Ceremonia de Apertura" },
  ],
  day2: [
    { id: 'd2-1', time: "9:00 AM - 10:00 AM", activity: "Cuartos de Final - Enfrentamiento 1" },
    { id: 'd2-2', time: "10:00 AM - 11:00 AM", activity: "Cuartos de Final - Enfrentamiento 2" },
  ]
};

export function ScheduleEditor() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: defaultSchedule,
  });

  useEffect(() => {
    const docRef = doc(db, 'siteContent', 'schedule');
    const unsubscribe = onSnapshot(docRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data() as FormData;
        form.reset(data);
      } else {
        form.reset(defaultSchedule);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [form]);

  async function onSubmit(values: FormData) {
    setIsSubmitting(true);
    try {
      await setDoc(doc(db, 'siteContent', 'schedule'), values);
      toast({
        title: "¡Programación Actualizada!",
        description: "El cronograma del evento ha sido guardado.",
      });
    } catch (error) {
      console.error("Error updating schedule: ", error);
      toast({
        variant: "destructive",
        title: "Error al actualizar",
        description: "Hubo un problema al guardar los datos.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

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
        <CardTitle>Editor de Programación del Evento</CardTitle>
        <CardDescription>
          Modifique el cronograma para los días del evento. Los cambios se reflejarán en la página pública.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <ScheduleDayEditor day="day1" title="Sábado, 17 de Agosto" control={form.control} />
            <ScheduleDayEditor day="day2" title="Domingo, 18 de Agosto" control={form.control} />
            <Button type="submit" className="w-full" size="lg" disabled={isSubmitting || loading}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Guardar Programación
            </Button>
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

  return (
    <div className="space-y-4 rounded-md border p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">{title}</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ id: nanoid(), time: "", activity: "" })}
        >
          <PlusCircle className="mr-2 h-4 w-4" /> Añadir Actividad
        </Button>
      </div>
      <div className="space-y-4">
        {fields.map((field, index) => (
          <div key={field.id} className="grid grid-cols-1 md:grid-cols-[1fr_2fr_auto] gap-2 items-start bg-secondary/30 p-3 rounded-md">
            <FormField
              control={control}
              name={`${day}.${index}.time`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hora</FormLabel>
                  <FormControl><Input {...field} placeholder="Ej: 9:00 AM" /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
              className="self-end text-destructive"
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
