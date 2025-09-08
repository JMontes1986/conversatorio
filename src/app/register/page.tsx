"use client";

import { useForm } from "react-hook-form";
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
import { School } from "lucide-react";

const formSchema = z.object({
  schoolName: z.string().min(3, "El nombre de la escuela debe tener al menos 3 caracteres."),
  contactName: z.string().min(3, "El nombre del contacto debe tener al menos 3 caracteres."),
  contactEmail: z.string().email("Por favor, introduzca un correo electrónico válido."),
  teamName: z.string().min(3, "El nombre del equipo debe tener al menos 3 caracteres."),
});

export default function RegisterPage() {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      schoolName: "",
      contactName: "",
      contactEmail: "",
      teamName: "",
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    console.log(values);
    // Here you would handle form submission, e.g., API call
  }

  return (
    <div className="container mx-auto flex items-center justify-center py-10 md:py-20 px-4">
      <Card className="w-full max-w-2xl">
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
                      <FormLabel>Nombre del Contacto</FormLabel>
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

              <Button type="submit" className="w-full" size="lg">
                Enviar Registro
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
