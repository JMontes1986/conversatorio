"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Projector, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const schema = z.object({
  email: z.string().trim().email("Ingrese un correo válido."),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres."),
});

type FormData = z.infer<typeof schema>;

export function ProjectionLoginForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [submitting, setSubmitting] = React.useState(false);
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: FormData) => {
    setSubmitting(true);
    try {
      const response = await fetch("/api/projection/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(values),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || "No se pudo iniciar sesión.");

      const { error } = await getSupabase().auth.setSession(result.session);
      if (error) throw error;

      toast({
        title: "Proyección conectada",
        description: "El equipo de proyección quedó autenticado.",
      });
      router.push("/debate");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error de acceso",
        description: error instanceof Error ? error.message : "No se pudo iniciar sesión.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <Projector className="mx-auto mb-4 h-12 w-12 text-primary" />
        <CardTitle className="text-3xl">Acceso de Proyección</CardTitle>
        <CardDescription>
          Ingrese las credenciales del equipo encargado de la pantalla principal.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem>
                <FormLabel>Correo</FormLabel>
                <FormControl><Input type="email" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="password" render={({ field }) => (
              <FormItem>
                <FormLabel>Contraseña</FormLabel>
                <FormControl><Input type="password" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Ingresar a Proyección
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
