
"use client";

import { useForm, useFieldArray, Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Loader2, UserPlus, Trash2, Users, CheckCircle } from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import React, { useEffect, useState, useCallback, useRef } from "react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "./ui/badge";

const participantSchema = z.object({
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
});

const formSchema = z.object({
  schoolName: z.string().min(3, "El nombre del colegio debe tener al menos 3 caracteres."),
  teamName: z.string().min(3, "El nombre del equipo debe tener al menos 3 caracteres."),
  contactName: z.string().min(3, "El nombre del contacto debe tener al menos 3 caracteres."),
  contactEmail: z.string().email("Por favor, introduzca un correo electrónico válido."),
  participants: z.array(participantSchema).min(1, "Debe haber al menos un participante en el debate."),
  attendees: z.array(participantSchema).optional(),
});

type FormData = z.infer<typeof formSchema>;

interface SchoolData {
    id: string;
    schoolName: string;
    teamName: string;
    participants: { name: string }[];
    attendees?: { name: string }[];
    status: 'Verificado' | 'Pendiente';
    contactName: string;
    contactEmail: string;
}

type SaveStatus = "idle" | "saving" | "saved";


function DynamicFieldArray({ control, name, label, buttonText, Icon }: {
    control: Control<FormData>;
    name: "participants" | "attendees";
    label: string;
    buttonText: string;
    Icon: React.ElementType
}) {
    const { fields, append, remove } = useFieldArray({
        control,
        name
    });

    return (
        <div className="space-y-4 rounded-md border p-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium flex items-center gap-2"><Icon className="h-5 w-5" /> {label}</h3>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => append({ name: "" })}
                >
                    <UserPlus className="mr-2 h-4 w-4" />
                    {buttonText}
                </Button>
            </div>
            {fields.map((field, index) => (
                <FormField
                    key={field.id}
                    control={control}
                    name={`${name}.${index}.name` as const}
                    render={({ field }) => (
                        <FormItem>
                            <div className="flex items-center gap-2">
                                <FormControl>
                                    <Input placeholder={`Nombre del ${label.slice(0, -1).toLowerCase()} ${index + 1}`} {...field} />
                                </FormControl>
                                <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            </div>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            ))}
            {name === 'participants' && fields.length === 0 && (
                <p className="text-sm text-destructive">
                    Debe registrar al menos un participante para el debate.
                </p>
            )}
        </div>
    );
}

export function EditSchoolForm({ school, onFinished }: { school: SchoolData, onFinished: () => void }) {
  const { toast } = useToast();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const isInitialLoad = useRef(true);


  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      schoolName: school.schoolName || "",
      teamName: school.teamName || "",
      contactName: school.contactName || "",
      contactEmail: school.contactEmail || "",
      participants: school.participants || [{ name: "" }],
      attendees: school.attendees || [],
    },
  });

  const handleAutoSave = useCallback(async (values: FormData) => {
    setSaveStatus("saving");
    try {
      const schoolRef = doc(db, "schools", school.id);
      await updateDoc(schoolRef, values);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (error) {
      console.error("Error auto-saving school data: ", error);
      toast({
        variant: "destructive",
        title: "Error de Guardado Automático",
        description: "Hubo un problema al guardar los cambios.",
      });
      setSaveStatus("idle");
    }
  }, [school.id, toast]);

    useEffect(() => {
        // Set a flag to indicate the initial data load is complete.
        setTimeout(() => {
            isInitialLoad.current = false;
        }, 50);
    }, []);


  useEffect(() => {
    const subscription = form.watch((value, { name, type }) => {
      if (!isInitialLoad.current && type === 'change') {
        handleAutoSave(value as FormData);
      }
    });
    return () => subscription.unsubscribe();
  }, [form, handleAutoSave]);


  return (
    <Form {...form}>
        <form className="space-y-6 max-h-[70vh] overflow-y-auto p-1">
            <div className="flex justify-end">
                 {saveStatus === 'saving' && <Badge variant="outline"><Loader2 className="mr-2 h-3 w-3 animate-spin"/>Guardando...</Badge>}
                {saveStatus === 'saved' && <Badge variant="secondary" className="bg-green-100 text-green-800"><CheckCircle className="mr-2 h-3 w-3"/>Guardado</Badge>}
            </div>
            <FormField
            control={form.control}
            name="schoolName"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Nombre del Colegio</FormLabel>
                <FormControl>
                    <Input placeholder="Ej: Instituto Nacional" {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
            <FormField
            control={form.control}
            name="teamName"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Nombre del Equipo</FormLabel>
                <FormControl>
                    <Input placeholder="Ej: Los Lógicos" {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
            <div className="grid md:grid-cols-2 gap-6">
            <FormField
                control={form.control}
                name="contactName"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Nombre del Contacto Responsable</FormLabel>
                    <FormControl>
                    <Input placeholder="Ej: Juana Pérez" {...field} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="contactEmail"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Email del Contacto</FormLabel>
                    <FormControl>
                    <Input type="email" placeholder="Ej: juana.perez@email.com" {...field} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />
            </div>

            <Separator />

            <DynamicFieldArray
                control={form.control}
                name="participants"
                label="Participantes del Debate"
                buttonText="Añadir Participante"
                Icon={Users}
            />
            
            <DynamicFieldArray
                control={form.control}
                name="attendees"
                label="Asistentes"
                buttonText="Añadir Asistente"
                Icon={Users}
            />
        </form>
    </Form>
  );
}
