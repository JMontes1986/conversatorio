
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
import { ClipboardCheck, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import React from "react";
import { useJudgeAuth } from "@/context/judge-auth-context";

const formSchema = z.object({
  cedula: z.string().min(1, "El número de cédula es requerido."),
});

type FormData = z.infer<typeof formSchema>;

export default function JudgeLoginPage() {
  const { toast } = useToast();
  const router = useRouter();
  const { login, judge, loading } = useJudgeAuth();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      cedula: "",
    },
  });

  React.useEffect(() => {
    if (!loading && judge) {
        router.push("/scoring");
    }
  }, [judge, loading, router]);


  async function onSubmit(values: FormData) {
    setIsSubmitting(true);
    try {
      const success = await login(values.cedula);
      if (success) {
        toast({
            title: "¡Acceso Correcto!",
            description: "Bienvenido al panel de puntuación.",
        });
        router.push("/scoring");
      } else {
        throw new Error("Invalid cedula or inactive judge");
      }
    } catch (error) {
      console.error("Error signing in: ", error);
      toast({
        variant: "destructive",
        title: "Error de Acceso",
        description: "Cédula no registrada o jurado inactivo. Contacte al administrador.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="container mx-auto flex items-center justify-center py-10 md:py-20 px-4">
        <Card className="w-full max-w-md">
        <CardHeader className="text-center">
            <ClipboardCheck className="mx-auto h-12 w-12 text-primary mb-4" />
            <CardTitle className="font-headline text-3xl">Acceso de Jurado</CardTitle>
            <CardDescription>
            Ingrese su número de cédula para acceder al panel.
            </CardDescription>
        </CardHeader>
        <CardContent>
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                control={form.control}
                name="cedula"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Número de Cédula</FormLabel>
                    <FormControl>
                        <Input placeholder="Escriba su cédula" {...field} />
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

    

    