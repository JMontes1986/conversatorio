
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus, Loader2, Projector } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import React from "react";
import { manageAccount } from "@/lib/accounts";

const formSchema = z.object({
  role: z.enum(["admin", "projection"]),
  email: z.string().email("Por favor, introduzca un correo electrónico válido."),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
});

type FormData = z.infer<typeof formSchema>;

export function AdminCreateUserForm() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      role: "admin",
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: FormData) {
    setIsSubmitting(true);
    try {
      await manageAccount(values);
      toast({
        title: "¡Usuario Creado!",
        description: values.role === "projection"
          ? `La cuenta de Proyección ${values.email} fue creada.`
          : `El administrador ${values.email} fue creado.`,
      });
      form.reset();
    } catch (error: any) {
      console.error("Error creating user: ", error);
      const description = error instanceof Error ? error.message : "No se pudo crear el usuario.";
      toast({
        variant: "destructive",
        title: "Error al Crear Usuario",
        description: description,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <UserPlus className="mx-auto h-12 w-12 text-primary mb-4" />
        <CardTitle className="font-headline text-3xl">Crear Usuario de Organización</CardTitle>
        <CardDescription>
          Cree una cuenta de Administrador o de Proyección.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Perfil</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione un perfil" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="admin">Administrador</SelectItem>
                      <SelectItem value="projection">Proyección</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email del Nuevo Usuario</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="nuevo.admin@colgemelli.edu.pa" {...field} />
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
                    <Input type="password" placeholder="Mínimo 8 caracteres" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : "Crear Usuario"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}


