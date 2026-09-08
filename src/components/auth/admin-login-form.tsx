
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
      const supabase = getSupabase();
      const { error } = await supabase.auth.signInWithPassword({ email: values.email, password: values.password });
      if (error) {
        console.error('Supabase authentication failed:', error.code);
        throw new Error(error.code === 'invalid_credentials'
          ? 'Correo o contraseña incorrectos para este proyecto de Supabase.'
          : error.code === 'email_not_confirmed'
            ? 'El correo de esta cuenta aún no está confirmado en Supabase.'
            : 'No se pudo iniciar sesión en Supabase. Inténtalo de nuevo.');
      }
      const { data: profile, error: profileError } = await supabase.rpc('current_profile');
      if (profileError) {
        console.error('Supabase profile lookup failed:', profileError);
        await supabase.auth.signOut();
        throw new Error('La contraseña fue aceptada, pero no se pudo consultar el perfil. Revisa que el schema esté instalado en el proyecto Supabase conectado a Vercel.');
      }
      if (profile?.role !== 'admin') {
        await supabase.auth.signOut();
        throw new Error('La contraseña fue aceptada, pero esta cuenta no tiene el rol administrador. Asigna el rol a este correo en public.profiles.');
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
