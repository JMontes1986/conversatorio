
"use client";

import { useForm } from "react-hook-form";
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
import { Loader2, FileQuestion, Send, EyeOff, CheckCircle, Lightbulb } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, addDoc, doc, onSnapshot, getDocs, getDoc, serverTimestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import React, { useEffect, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import Image from "next/image";
import { useAuth } from "@/context/auth-context";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { usePathname, useSearchParams } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

// New Interfaces for Question Live functionality
interface Team {
    name: string;
}
interface DebateState {
    currentRound: string;
    teams: Team[];
    questionId: string;
}

// Existing Interfaces for Survey functionality
interface Question {
  id: string;
  text: string;
  type: "rating" | "text";
  required?: boolean;
}

interface Section {
  id: string;
  title: string;
  questions: Question[];
}

interface SurveyConfig {
  title: string;
  subtitle: string;
  imageUrl?: string;
  sections: Section[];
  isActive?: boolean;
}

function QuestionLiveComponent() {
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const [questionId, setQuestionId] = useState<string | null>(null);
    const [debateQuestion, setDebateQuestion] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [studentQuestion, setStudentQuestion] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [debateState, setDebateState] = useState<DebateState | null>(null);
    const [targetTeam, setTargetTeam] = useState<string>("");

    useEffect(() => {
        const q_id = searchParams.get('q_id');
        if (q_id) {
            setQuestionId(q_id);
            const questionRef = doc(db, 'questions', q_id);
            getDoc(questionRef).then(docSnap => {
                if (docSnap.exists()) {
                    setDebateQuestion(docSnap.data().text);
                } else {
                    toast({ variant: 'destructive', title: 'Error', description: 'Pregunta de debate no encontrada.'});
                }
            });

            const debateStateRef = doc(db, "debateState", "current");
            const unsubscribe = onSnapshot(debateStateRef, (docSnap) => {
                if (docSnap.exists()) {
                    setDebateState(docSnap.data() as DebateState);
                }
                setLoading(false);
            });
            return () => unsubscribe();
        } else {
            setLoading(false);
        }
    }, [searchParams, toast]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!studentQuestion.trim() || !questionId) {
            toast({ variant: 'destructive', title: 'Error', description: 'Su pregunta no puede estar vacía.'});
            return;
        }
        if (!targetTeam) {
            toast({ variant: 'destructive', title: 'Error', description: 'Por favor, seleccione a quién va dirigida la pregunta.'});
            return;
        }

        setIsSubmitting(true);
        try {
            await addDoc(collection(db, 'studentQuestions'), {
                text: studentQuestion,
                relatedDebateQuestionId: questionId,
                targetTeam: targetTeam,
                status: 'pending',
                createdAt: serverTimestamp(),
            });
            setIsSubmitted(true);
            toast({ title: '¡Pregunta Enviada!', description: 'Su pregunta ha sido enviada al moderador para revisión.' });
        } catch (error) {
            console.error('Error submitting question:', error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo enviar su pregunta. Inténtelo de nuevo.'});
        } finally {
            setIsSubmitting(false);
        }
    };
    
    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
            </div>
        );
    }
    
    if (!questionId) {
         return (
             <div className="container mx-auto flex items-center justify-center py-10 md:py-20 px-4">
                <Card className="w-full max-w-md text-center">
                   <CardHeader>
                        <CardTitle>Error</CardTitle>
                   </CardHeader>
                   <CardContent>
                    <p className="text-muted-foreground">No se ha especificado una pregunta de debate. Escanee un código QR válido.</p>
                   </CardContent>
               </Card>
            </div>
        );
    }
    
    if (isSubmitted) {
         return (
            <div className="container mx-auto flex items-center justify-center py-10 md:py-20 px-4">
                <Card className="w-full max-w-md text-center">
                    <CardHeader>
                        <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-4" />
                        <CardTitle className="font-headline text-3xl">¡Gracias por Participar!</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">Tu pregunta ha sido enviada al moderador. ¡Presta atención a la pantalla!</p>
                    </CardContent>
                </Card>
            </div>
      )
    }

    return (
        <div className="container mx-auto flex items-center justify-center py-10 md:py-20 px-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <Lightbulb className="mx-auto h-12 w-12 text-primary mb-4" />
                    <CardTitle className="font-headline text-xl">Pregunta del Debate</CardTitle>
                    <CardDescription className="text-base font-semibold text-foreground pt-2">
                        "{debateQuestion}"
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label htmlFor="student-question" className="block text-sm font-medium text-muted-foreground mb-2">
                                Basado en el tema, ¿qué pregunta tienes para los participantes?
                            </label>
                            <Textarea
                                id="student-question"
                                value={studentQuestion}
                                onChange={(e) => setStudentQuestion(e.target.value)}
                                placeholder="Escriba su pregunta aquí..."
                                rows={4}
                                disabled={isSubmitting}
                            />
                        </div>

                        {debateState && debateState.teams && debateState.teams.length > 0 && (
                            <div>
                                <Label className="block text-sm font-medium text-muted-foreground mb-2">
                                   ¿A quién va dirigida su pregunta?
                                </Label>
                                <RadioGroup
                                    onValueChange={setTargetTeam}
                                    value={targetTeam}
                                    className="grid grid-cols-1 gap-2"
                                    disabled={isSubmitting}
                                >
                                    {debateState.teams.map(team => (
                                        <div className="flex items-center space-x-2" key={team.name}>
                                            <RadioGroupItem value={team.name} id={team.name}/>
                                            <Label htmlFor={team.name} className="font-normal">{team.name}</Label>
                                        </div>
                                    ))}
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="Ambos Equipos" id="ambos" />
                                        <Label htmlFor="ambos" className="font-normal">Ambos Equipos</Label>
                                    </div>
                                </RadioGroup>
                            </div>
                        )}

                        <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4" />}
                            Enviar Pregunta
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}


function SurveyComponent() {
  const { toast } = useToast();
  const [config, setConfig] = useState<SurveyConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [responseCount, setResponseCount] = useState(0);
  const { user: adminUser } = useAuth();
  
  const form = useForm();
  
  useEffect(() => {
    const configRef = doc(db, 'siteContent', 'survey');
    const unsubscribeConfig = onSnapshot(configRef, (doc) => {
        if (doc.exists()) {
            const data = doc.data() as SurveyConfig;
            setConfig(data);
             // Create dynamic validation schema
            if (data.sections) {
                const schemaObject = data.sections.reduce((acc, section) => {
                    section.questions.forEach(q => {
                        let fieldSchema: z.ZodTypeAny = z.any();
                        if (q.required) {
                            if(q.type === 'text') {
                                fieldSchema = z.string().min(1, "Esta pregunta es requerida.");
                            } else if (q.type === 'rating') {
                                fieldSchema = z.string({ required_error: "Debe seleccionar una opción."}).min(1);
                            }
                        } else {
                            if (q.type === 'rating') {
                                fieldSchema = z.string().optional();
                            } else {
                                fieldSchema = z.string().optional();
                            }
                        }
                        acc[q.id] = fieldSchema;
                    });
                    return acc;
                }, {} as Record<string, z.ZodTypeAny>);
                
                const dynamicSchema = z.object(schemaObject);
                form.reset(undefined, { resolver: zodResolver(dynamicSchema) } as any);
            }
        }
        setLoading(false);
    });
    
    const responsesQuery = collection(db, "surveyResponses");
    const unsubscribeResponses = onSnapshot(responsesQuery, async () => {
        const snapshot = await getDocs(responsesQuery);
        setResponseCount(snapshot.size);
    });

    return () => {
        unsubscribeConfig();
        unsubscribeResponses();
    };
  }, [form]);

  useEffect(() => {
    // Admin user should always be able to submit, so we bypass this check for them.
    if (adminUser) {
        setHasSubmitted(false);
        return;
    }

    const locallySubmitted = localStorage.getItem('surveySubmitted');
    if (locallySubmitted === 'true' && responseCount > 0) {
        setHasSubmitted(true);
    } else if (responseCount === 0) {
        localStorage.removeItem('surveySubmitted');
        setHasSubmitted(false);
    }
  }, [responseCount, adminUser]);

  async function onSubmit(values: any) {
    setIsSubmitting(true);
    try {
      const cleanedValues = Object.entries(values).reduce((acc, [key, value]) => {
          acc[key] = value === undefined ? "" : value;
          return acc;
      }, {} as Record<string, any>);
      
      await addDoc(collection(db, "surveyResponses"), {
        answers: cleanedValues,
        createdAt: new Date(),
        isAdminSubmission: !!adminUser,
      });
      toast({
        title: "¡Gracias por su opinión!",
        description: "Su respuesta ha sido enviada exitosamente.",
      });
      
      if (!adminUser) {
          localStorage.setItem('surveySubmitted', 'true');
          setHasSubmitted(true);
      } else {
          form.reset(); 
      }

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

  if (hasSubmitted) {
      return (
            <div className="container mx-auto flex items-center justify-center py-10 md:py-20 px-4">
                <Card className="w-full max-w-md text-center">
                    <CardHeader>
                        <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-4" />
                        <CardTitle className="font-headline text-3xl">¡Gracias!</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">Tu respuesta ha sido registrada exitosamente.</p>
                    </CardContent>
                </Card>
            </div>
      )
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
            {config.imageUrl && (
                <div className="relative w-full h-48 mb-6">
                    <Image 
                        src={config.imageUrl}
                        alt="Encuesta Cabecera"
                        fill
                        objectFit="cover"
                        className="rounded-t-lg"
                    />
                </div>
            )}
          {!config.imageUrl && <FileQuestion className="mx-auto h-12 w-12 text-primary mb-4" />}
          <CardTitle className="font-headline text-3xl">{config.title}</CardTitle>
          <CardDescription>
            {config.subtitle}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              {(config.sections || []).map((section) => (
                  <div key={section.id} className="space-y-6 rounded-lg border-2 border-primary/20 p-4 md:p-6">
                      <h2 className="text-xl font-bold text-primary">{section.title}</h2>
                      {section.questions.map((q, qIndex) => (
                         <FormField
                            key={q.id}
                            control={form.control}
                            name={q.id}
                            render={({ field }) => (
                                <FormItem className="space-y-3 rounded-md border bg-background p-4 shadow-sm">
                                    <FormLabel className="text-base">
                                        {qIndex + 1}. {q.text}
                                        {q.required && <span className="text-destructive ml-1">*</span>}
                                    </FormLabel>
                                    <FormControl>
                                        {q.type === 'rating' ? (
                                            <RadioGroup
                                                onValueChange={(value) => field.onChange(value)}
                                                defaultValue={field.value}
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
                  </div>
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


function PublicPageLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const noHeaderFooter = pathname === '/debate';
    
    return (
        <>
            {!noHeaderFooter && (
                <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
                    <div className="container mx-auto flex h-16 items-center justify-center px-4 md:px-6">
                         <Link href="/" className="flex items-center gap-2">
                            <Image src="https://mbosvnmhnbrslfwlfcxu.supabase.co/storage/v1/object/public/Software/Logo%20Slogan%20Nuevo%20FINAL-05.png" alt="Logo Colgemelli" width={60} height={60} />
                            <span className="font-headline text-lg font-bold">Conversatorio Colgemelli</span>
                        </Link>
                    </div>
                </header>
            )}
            {children}
            {!noHeaderFooter && <Footer />}
        </>
    );
}


export default function SurveyPage() {
    const searchParams = useSearchParams();
    const isQuestionLive = searchParams.has('q_id');
    
    // This is the router component. It decides whether to show the "Question Live" UI
    // or the "Survey" UI based on the URL query parameter.
    if (isQuestionLive) {
        return <PublicPageLayout><QuestionLiveComponent /></PublicPageLayout>;
    }
    
    // Default to survey component
    return <PublicPageLayout><SurveyComponent /></PublicPageLayout>;
}
