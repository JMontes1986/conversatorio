
"use client";

import { useForm } from "react-hook-form";
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
import { Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import React from "react";
import { getSupabase } from "@/lib/supabase";

const formSchema = z.object({
  email: z.string().trim().email("Por favor, introduzca un correo electrónico válido."),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres."),
});

type FormData = z.infer<typeof formSchema>;

export function AdminLoginForm() {
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: FormData) {
    setIsSubmitting(true);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);

      let response: Response;
      try {
        response = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          signal: controller.signal,
          body: JSON.stringify({
            email: values.email.trim().toLowerCase(),
            password: values.password,
          }),
        });
      } catch (cause) {
        if ((cause as Error)?.name === 'AbortError') {
          throw new Error('La conexión está tardando demasiado. Revise la red e inténtelo nuevamente.');
        }
        throw new Error('No se pudo contactar el servicio de acceso. Revise la conexión de este equipo.');
      } finally {
        clearTimeout(timeout);
      }

      const result = await response.json();
      if (!response.ok || !result?.session?.access_token || !result?.session?.refresh_token) {
        throw new Error(result?.error || 'No se pudo iniciar sesión.');
      }

      const supabase = getSupabase();
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: result.session.access_token,
        refresh_token: result.session.refresh_token,
      });
      if (sessionError) {
        throw new Error('La cuenta fue validada, pero este navegador no pudo guardar la sesión.');
      }
      toast({
        title: "¡Inicio de Sesión Exitoso!",
        description: "Bienvenido al panel de administración.",
      });
      router.push("/admin");
    } catch (error) {
      console.error("Error signing in: ", error);
      toast({
        variant: "destructive",
        title: "Error de Autenticación",
        description: error instanceof Error ? error.message : 'No se pudo iniciar sesión.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <Lock className="mx-auto h-12 w-12 text-primary mb-4" />
        <CardTitle className="font-headline text-3xl">Acceso de Administrador</CardTitle>
        <CardDescription>
          Ingrese sus credenciales para gestionar la competencia.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="admin@colgemelli.edu.pa" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contraseña</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
              {isSubmitting ? "Ingresando..." : "Ingresar"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
