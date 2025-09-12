
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Send, CheckCircle, FileQuestion, EyeOff } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, addDoc, doc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import React, { useEffect, useState, useMemo } from "react";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import Image from "next/image";
import { useAuth } from "@/context/auth-context";

const questionSchema = z.object({
  id: z.string(),
  text: z.string(),
  type: z.enum(["rating", "text"]),
  required: z.boolean().optional(),
});

const sectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  questions: z.array(questionSchema),
});

const surveySchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  imageUrl: z.string().optional(),
  sections: z.array(sectionSchema),
  isActive: z.boolean().optional(),
});

type SurveyConfig = z.infer<typeof surveySchema>;

function PublicSurveyPage() {
    const { toast } = useToast();
    const { user: adminUser } = useAuth();
    const [surveyConfig, setSurveyConfig] = useState<SurveyConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [submissionId, setSubmissionId] = useState<string | null>(null);
    
    const formSchema = useMemo(() => {
        if (!surveyConfig) return z.object({});

        const schemaShape: Record<string, z.ZodTypeAny> = {};
        surveyConfig.sections.forEach(section => {
            section.questions.forEach(question => {
                if (question.required) {
                    if (question.type === 'text') {
                        schemaShape[question.id] = z.string().min(1, "Este campo es requerido.");
                    } else { // rating
                        schemaShape[question.id] = z.string({ required_error: "Debe seleccionar una opción." });
                    }
                } else {
                     schemaShape[question.id] = z.string().optional();
                }
            });
        });
        return z.object(schemaShape);
    }, [surveyConfig]);
    
    type FormData = z.infer<typeof formSchema>;
    
    const form = useForm<FormData>({
        resolver: zodResolver(formSchema),
    });

    useEffect(() => {
        const storedSubmissionId = localStorage.getItem('surveySubmissionId');
        if (storedSubmissionId) {
            setIsSubmitted(true);
            setSubmissionId(storedSubmissionId);
        }

        const configRef = doc(db, 'siteContent', 'survey');
        const unsubscribe = onSnapshot(configRef, (doc) => {
            if (doc.exists()) {
                setSurveyConfig(doc.data() as SurveyConfig);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    async function onSubmit(values: FormData) {
        setIsSubmitting(true);
        try {
            const docRef = await addDoc(collection(db, "surveyResponses"), {
                answers: values,
                createdAt: serverTimestamp(),
                isAdminSubmission: !!adminUser,
            });
            
            if (!adminUser) {
                localStorage.setItem('surveySubmissionId', docRef.id);
                setSubmissionId(docRef.id);
            }
            
            setIsSubmitted(true);
            toast({
                title: "¡Encuesta Enviada!",
                description: "Gracias por sus valiosos comentarios.",
            });
        } catch (error) {
            console.error("Error submitting survey:", error);
            toast({
                variant: "destructive",
                title: "Error al enviar",
                description: "No se pudo guardar su respuesta. Por favor, inténtelo de nuevo.",
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
    
    if (!surveyConfig || (!surveyConfig.isActive && !adminUser)) {
        return (
             <div className="container mx-auto flex items-center justify-center py-10 md:py-20 px-4">
                <Card className="w-full max-w-md text-center">
                   <CardHeader>
                        <EyeOff className="mx-auto h-12 w-12 text-muted-foreground mb-4"/>
                        <CardTitle>Encuesta no Disponible</CardTitle>
                   </CardHeader>
                   <CardContent>
                    <p className="text-muted-foreground">La encuesta no se encuentra activa en este momento. Vuelva a intentarlo más tarde.</p>
                   </CardContent>
               </Card>
            </div>
        );
    }
    
    if (isSubmitted && !adminUser) {
         return (
            <div className="container mx-auto flex items-center justify-center py-10 md:py-20 px-4">
                <Card className="w-full max-w-lg text-center">
                    <CardHeader>
                        <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-4" />
                        <CardTitle className="font-headline text-3xl">¡Gracias por Participar!</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">Su respuesta ha sido registrada. Solo puede enviar la encuesta una vez.</p>
                        <p className="text-xs text-muted-foreground mt-4">ID de envío: {submissionId}</p>
                    </CardContent>
                </Card>
            </div>
      )
    }

    return (
         <div className="container mx-auto flex items-center justify-center py-10 md:py-20 px-4">
            <Card className="w-full max-w-4xl">
                {surveyConfig.imageUrl && (
                     <div className="relative h-48 w-full">
                        <Image
                            src={surveyConfig.imageUrl}
                            alt="Encabezado de la encuesta"
                            layout="fill"
                            objectFit="cover"
                            className="rounded-t-lg"
                        />
                    </div>
                )}
                <CardHeader className="text-center">
                    <CardTitle className="font-headline text-3xl pt-6">{surveyConfig.title}</CardTitle>
                    <CardDescription className="text-lg">
                        {surveyConfig.subtitle}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                            {surveyConfig.sections.map((section) => (
                                <div key={section.id} className="space-y-6 rounded-lg border p-4 md:p-6">
                                    <h2 className="text-xl font-semibold">{section.title}</h2>
                                    {section.questions.map((question) => (
                                        <Card key={question.id}>
                                            <CardContent className="p-4">
                                                <FormField
                                                    control={form.control}
                                                    name={question.id}
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel className="font-medium text-base">
                                                                {question.text}
                                                                {question.required && <span className="text-destructive"> *</span>}
                                                            </FormLabel>
                                                            <FormControl>
                                                                {question.type === 'rating' ? (
                                                                    <RadioGroup
                                                                        onValueChange={field.onChange}
                                                                        defaultValue={field.value}
                                                                        className="flex flex-wrap items-center justify-center gap-4 pt-4"
                                                                    >
                                                                        {[1, 2, 3, 4, 5].map((value) => (
                                                                            <FormItem key={value} className="flex flex-col items-center space-y-2">
                                                                                <FormLabel className="font-bold text-xl">{value}</FormLabel>
                                                                                <FormControl>
                                                                                    <RadioGroupItem value={String(value)} className="h-5 w-5" />
                                                                                </FormControl>
                                                                            </FormItem>
                                                                        ))}
                                                                    </RadioGroup>
                                                                ) : (
                                                                    <Textarea
                                                                        placeholder="Escriba su respuesta aquí..."
                                                                        rows={3}
                                                                        {...field}
                                                                        className="mt-2"
                                                                    />
                                                                )}
                                                            </FormControl>
                                                            <FormMessage className="text-center pt-2" />
                                                        </FormItem>
                                                    )}
                                                />
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            ))}
                            
                             {isSubmitted && adminUser && (
                                <div className="text-center p-4 bg-green-100 text-green-800 rounded-md border border-green-200">
                                    <p>Respuesta enviada como Administrador. Puede enviar otra.</p>
                                </div>
                            )}

                            <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4" />}
                                Enviar Encuesta
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
    );
}


export default function SurveyPage() {
    return <PublicSurveyPage />
}
