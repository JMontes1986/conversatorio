
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
import { Gavel, KeyRound, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import React from "react";
import { useModeratorAuth } from "@/context/moderator-auth-context";

const formSchema = z.object({
  username: z.string().min(1, "El nombre de usuario es requerido."),
  token: z.string().min(1, "El token es requerido."),
});

type FormData = z.infer<typeof formSchema>;

export default function ModeratorLoginPage() {
  const { toast } = useToast();
  const router = useRouter();
  const { login, moderator, loading } = useModeratorAuth();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      token: "",
    },
  });

  React.useEffect(() => {
    if (!loading && moderator) {
        router.push("/moderator");
    }
  }, [moderator, loading, router]);


  async function onSubmit(values: FormData) {
    setIsSubmitting(true);
    try {
      const success = await login(values.username, values.token);
      if (success) {
        toast({
            title: "¡Acceso Correcto!",
            description: "Bienvenido al panel de moderación.",
        });
        router.push("/moderator");
      } else {
        throw new Error("Invalid credentials or inactive token");
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error de Acceso",
        description: "Credenciales incorrectas o token inactivo. Por favor, contacte al administrador.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="container mx-auto flex items-center justify-center py-10 md:py-20 px-4">
        <Card className="w-full max-w-md">
        <CardHeader className="text-center">
            <Gavel className="mx-auto h-12 w-12 text-primary mb-4" />
            <CardTitle className="font-headline text-3xl">Acceso de Moderador</CardTitle>
            <CardDescription>
            Ingrese sus credenciales para acceder al panel.
            </CardDescription>
        </CardHeader>
        <CardContent>
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Nombre de Usuario</FormLabel>
                    <FormControl>
                        <Input placeholder="Escriba su usuario" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                 <FormField
                control={form.control}
                name="token"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Token de Acceso</FormLabel>
                    <FormControl>
                        <Input type="password" placeholder="Pegue su token de acceso" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                  {isSubmitting ? "Verificando..." : "Ingresar"}
                </Button>
            </form>
            </Form>
        </CardContent>
        </Card>
    </div>
  );
}

    