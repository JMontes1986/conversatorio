
"use client";

import { useForm, useFieldArray, Controller } from "react-hook-form";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Trash2, PlusCircle, Save, Home, Users, Shuffle, Gavel, ClipboardCheck, Trophy, Monitor, Calendar, Shield, Star, Icon as LucideIcon } from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import React, { useEffect, useState } from "react";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "./ui/textarea";
import { nanoid } from "nanoid";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";


const featureSchema = z.object({
  id: z.string(),
  icon: z.string().min(1, "Debe seleccionar un ícono."),
  title: z.string().min(3, "El título debe tener al menos 3 caracteres."),
  description: z.string().min(10, "La descripción debe tener al menos 10 caracteres."),
  link: z.string().min(1, "El enlace es requerido."),
});

const formSchema = z.object({
  hero: z.object({
    title: z.string().min(3, "El título principal es requerido."),
    subtitle: z.string().min(10, "El subtítulo es requerido."),
  }),
  features: z.array(featureSchema).min(1, "Debe haber al menos una característica."),
  promoSection: z.object({
    title: z.string().min(3, "El título de la sección es requerido."),
    paragraph1: z.string().min(10, "El primer párrafo es requerido."),
    paragraph2: z.string().min(10, "El segundo párrafo es requerido."),
  }),
});

type FormData = z.infer<typeof formSchema>;

const iconOptions = ["Users", "Shuffle", "Gavel", "ClipboardCheck", "Trophy", "Home", "Monitor", "Calendar", "Shield", "Star"];

export function HomePageEditor() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      hero: { title: "", subtitle: "" },
      features: [],
      promoSection: { title: "", paragraph1: "", paragraph2: "" },
    },
  });

  useEffect(() => {
    const docRef = doc(db, 'siteContent', 'home');
    const unsubscribe = onSnapshot(docRef, (doc) => {
        if (doc.exists()) {
            form.reset(doc.data() as FormData);
        } else {
             // Initialize with default data if document doesn't exist
            form.reset({
                hero: { title: "Conversatorio Colgemelli", subtitle: "La plataforma definitiva para competencias de debate escolar. Fomentando el pensamiento crítico y la oratoria en la próxima generación de líderes." },
                features: [
                    { id: nanoid(), icon: 'Users', title: 'Registro de Colegios', description: 'Inscriba a su colegio en la competencia de manera rápida y sencilla.', link: '/register' },
                    { id: nanoid(), icon: 'Shuffle', title: 'Sorteo de Grupos', description: 'Vea en tiempo real cómo se definen los enfrentamientos de las rondas.', link: '/draw' },
                ],
                promoSection: { title: "Listos para el Debate del Siglo", paragraph1: "Nuestra plataforma está diseñada para ser intuitiva para estudiantes, jueces y administradores, permitiendo que todos se concentren en lo que realmente importa: el poder de las ideas.", paragraph2: "Con características como sorteos auditables y puntuación transparente, garantizamos una competencia equitativa y emocionante para todos los participantes." }
            });
        }
        setLoading(false);
    });

    return () => unsubscribe();
  }, [form]);

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "features"
  });

  async function onSubmit(values: FormData) {
    setIsSubmitting(true);
    try {
      const docRef = doc(db, 'siteContent', 'home');
      await setDoc(docRef, values);
      toast({
        title: "¡Contenido Actualizado!",
        description: "La página de inicio ha sido actualizada con la nueva información.",
      });
    } catch (error) {
      console.error("Error updating document: ", error);
      toast({
        variant: "destructive",
        title: "Error al actualizar",
        description: "Hubo un problema al guardar los datos. Por favor, inténtelo de nuevo.",
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
      )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Editor de la Página Principal</CardTitle>
        <CardDescription>
          Modifique el contenido que se muestra en la página de inicio (/).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            
            {/* Hero Section */}
            <div className="space-y-4 rounded-md border p-4">
              <h3 className="text-lg font-medium">Sección Principal (Hero)</h3>
              <FormField
                control={form.control}
                name="hero.title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Título Principal</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="hero.subtitle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subtítulo</FormLabel>
                    <FormControl><Textarea {...field} rows={3} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            {/* Features Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Tarjetas de Características</h3>
                <Button type="button" variant="outline" size="sm" onClick={() => append({ id: nanoid(), icon: 'Star', title: '', description: '', link: '/' })}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Añadir Tarjeta
                </Button>
              </div>
                {fields.map((field, index) => (
                   <div key={field.id} className="space-y-4 rounded-md border p-4 relative">
                        <h4 className="font-medium">Tarjeta {index + 1}</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name={`features.${index}.title`}
                                render={({ field }) => (
                                    <FormItem><FormLabel>Título</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name={`features.${index}.icon`}
                                render={({ field }) => (
                                    <FormItem><FormLabel>Ícono</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Seleccione un ícono" /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            {iconOptions.map(icon => <SelectItem key={icon} value={icon}>{icon}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <FormField
                            control={form.control}
                            name={`features.${index}.description`}
                            render={({ field }) => (
                                <FormItem><FormLabel>Descripción</FormLabel><FormControl><Textarea {...field} rows={2}/></FormControl><FormMessage /></FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name={`features.${index}.link`}
                            render={({ field }) => (
                                <FormItem><FormLabel>Enlace</FormLabel><FormControl><Input {...field} placeholder="/ejemplo" /></FormControl><FormMessage /></FormItem>
                            )}
                        />
                        <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 text-destructive" onClick={() => remove(index)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                   </div>
                ))}
            </div>

            {/* Promo Section */}
            <div className="space-y-4 rounded-md border p-4">
              <h3 className="text-lg font-medium">Sección de Promoción</h3>
              <FormField
                control={form.control}
                name="promoSection.title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Título</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="promoSection.paragraph1"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Primer Párrafo</FormLabel>
                    <FormControl><Textarea {...field} rows={3} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="promoSection.paragraph2"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Segundo Párrafo</FormLabel>
                    <FormControl><Textarea {...field} rows={3} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={isSubmitting || loading}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Guardar Cambios
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
