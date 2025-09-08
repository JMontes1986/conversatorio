
"use client";

import { useForm, useFieldArray, Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { School, Loader2, UserPlus, Trash2, Users } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, addDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import React from "react";
import { Separator } from "@/components/ui/separator";

const participantSchema = z.object({
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
});

const formSchema = z.object({
  schoolName: z.string().min(3, "El nombre de la escuela debe tener al menos 3 caracteres."),
  teamName: z.string().min(3, "El nombre del equipo debe tener al menos 3 caracteres."),
  contactName: z.string().min(3, "El nombre del contacto debe tener al menos 3 caracteres."),
  contactEmail: z.string().email("Por favor, introduzca un correo electrónico válido."),
  participants: z.array(participantSchema).min(1, "Debe haber al menos un participante en el debate."),
  attendees: z.array(participantSchema).optional(),
});

type FormData = z.infer<typeof formSchema>;

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

export default function RegisterPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      schoolName: "",
      contactName: "",
      contactEmail: "",
      teamName: "",
      participants: [{ name: "" }],
      attendees: [],
    },
  });

  async function onSubmit(values: FormData) {
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "schools"), {
        ...values,
        status: "Pendiente",
        createdAt: new Date(),
      });
      toast({
        title: "¡Registro Exitoso!",
        description: "La escuela ha sido registrada y está pendiente de verificación.",
      });
      form.reset();
      router.push("/");
    } catch (error) {
      console.error("Error adding document: ", error);
      toast({
        variant: "destructive",
        title: "Error en el registro",
        description: "Hubo un problema al guardar los datos. Por favor, inténtelo de nuevo.",
      });
    } finally {
        setIsSubmitting(false);
    }
  }

  return (
    <div className="container mx-auto flex items-center justify-center py-10 md:py-20 px-4">
      <Card className="w-full max-w-3xl">
        <CardHeader className="text-center">
          <School className="mx-auto h-12 w-12 text-primary mb-4" />
          <CardTitle className="font-headline text-3xl">Registro de Escuelas</CardTitle>
          <CardDescription>
            Inscriba a su equipo en el Conversatorio Colgemelli.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="schoolName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre de la Escuela</FormLabel>
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
                     <FormDescription>
                        El nombre creativo que representará a su escuela.
                    </FormDescription>
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

              <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSubmitting ? "Enviando..." : "Enviar Registro"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
