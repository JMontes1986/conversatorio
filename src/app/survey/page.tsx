
"use client";

import { useForm, Controller } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, FileQuestion, Send, Star, EyeOff } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, addDoc, doc, onSnapshot } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import React, { useEffect, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface Question {
  id: string;
  text: string;
  type: "rating" | "text";
}

interface SurveyConfig {
  title: string;
  subtitle: string;
  questions: Question[];
  isActive?: boolean;
}

export default function SurveyPage() {
  const { toast } = useToast();
  const [config, setConfig] = useState<SurveyConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const form = useForm();

  useEffect(() => {
    const configRef = doc(db, 'siteContent', 'survey');
    const unsubscribe = onSnapshot(configRef, (doc) => {
        if (doc.exists()) {
            setConfig(doc.data() as SurveyConfig);
        }
        setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  async function onSubmit(values: any) {
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "surveyResponses"), {
        answers: values,
        createdAt: new Date(),
      });
      toast({
        title: "¡Gracias por su opinión!",
        description: "Su respuesta ha sido enviada exitosamente.",
      });
      form.reset();
    } catch (error) {
      console.error("Error adding document: ", error);
      toast({
        variant: "destructive",
        title: "Error en el envío",
        description: "Hubo un problema al guardar su respuesta. Por favor, inténtelo de nuevo.",
      });
    } finally {
        setIsSubmitting(false);
    }
  }

  if (loading) {
    return (
        <div className="flex justify-center items-center h-screen">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
        </div>
    );
  }

  if (!config || !config.isActive) {
      return (
           <div className="container mx-auto flex items-center justify-center py-10 md:py-20 px-4">
               <Card className="w-full max-w-md text-center">
                   <CardHeader>
                        <EyeOff className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                        <CardTitle>Encuesta no Disponible</CardTitle>
                   </CardHeader>
                   <CardContent>
                    <p className="text-muted-foreground">La encuesta no está activa en este momento. Gracias por su interés.</p>
                   </CardContent>
               </Card>
            </div>
      )
  }

  return (
    <div className="container mx-auto flex items-center justify-center py-10 md:py-20 px-4">
      <Card className="w-full max-w-3xl">
        <CardHeader className="text-center">
          <FileQuestion className="mx-auto h-12 w-12 text-primary mb-4" />
          <CardTitle className="font-headline text-3xl">{config.title}</CardTitle>
          <CardDescription>
            {config.subtitle}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              {config.questions.map((q, index) => (
                <FormField
                    key={q.id}
                    control={form.control}
                    name={q.id}
                    rules={{ required: q.type === 'rating' ? 'Esta pregunta es requerida' : false }}
                    render={({ field }) => (
                        <FormItem className="space-y-3 rounded-md border p-4">
                            <FormLabel className="text-base">{index + 1}. {q.text}</FormLabel>
                            <FormControl>
                                {q.type === 'rating' ? (
                                    <RadioGroup
                                        onValueChange={(value) => field.onChange(parseInt(value))}
                                        defaultValue={String(field.value)}
                                        className="flex flex-wrap justify-center gap-2 md:gap-4 pt-2"
                                    >
                                        {[1,2,3,4,5].map(val => (
                                            <FormItem key={val} className="flex flex-col items-center space-y-1">
                                                 <FormControl>
                                                     <RadioGroupItem value={String(val)} className="h-8 w-8" />
                                                 </FormControl>
                                                <FormLabel className="font-normal text-xs text-center">
                                                    {val}
                                                </FormLabel>
                                            </FormItem>
                                        ))}
                                    </RadioGroup>
                                ) : (
                                    <Textarea
                                        placeholder="Escriba su respuesta aquí..."
                                        {...field}
                                    />
                                )}
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
              ))}

              <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                {isSubmitting ? "Enviando..." : "Enviar Encuesta"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
