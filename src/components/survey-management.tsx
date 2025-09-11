
"use client";

import { useForm, useFieldArray, Control } from "react-hook-form";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Loader2, Trash2, PlusCircle, Save, BarChart, Power, PowerOff, FolderPlus, Copy, Send, TrendingUp, TrendingDown } from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, setDoc, onSnapshot, collection, query, orderBy } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import React, { useEffect, useState, useMemo } from "react";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "./ui/textarea";
import { nanoid } from "nanoid";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Switch } from "./ui/switch";
import { cn } from "@/lib/utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";
import { Bar, BarChart as RechartsBarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import Image from "next/image";
import Link from "next/link";


const questionSchema = z.object({
  id: z.string(),
  text: z.string().min(3, "El texto de la pregunta es requerido."),
  type: z.enum(["rating", "text"]),
  required: z.boolean().optional(),
});

const sectionSchema = z.object({
  id: z.string(),
  title: z.string().min(3, "El título de la sección es requerido."),
  questions: z.array(questionSchema).min(1, "La sección debe tener al menos una pregunta."),
});


const formSchema = z.object({
  title: z.string().min(3, "El título es requerido."),
  subtitle: z.string().min(10, "El subtítulo es requerido."),
  imageUrl: z.string().url("Debe ser una URL válida.").optional().or(z.literal('')),
  sections: z.array(sectionSchema).min(1, "Debe haber al menos una sección."),
  isActive: z.boolean().optional(),
});

type FormData = z.infer<typeof formSchema>;
type SurveyResponse = {
    id: string;
    createdAt: any;
    answers: Record<string, string | number>;
    isAdminSubmission?: boolean;
}


const defaultSections: z.infer<typeof sectionSchema>[] = [
    {
        id: nanoid(),
        title: "Sobre el Evento",
        questions: [
            { id: nanoid(), text: "El tema del conversatorio fue relevante y de actualidad.", type: "rating", required: true },
            { id: nanoid(), text: "La organización general del evento fue excelente.", type: "rating", required: true },
            { id: nanoid(), text: "Los moderadores del conversatorio facilitaron un diálogo dinámico y ordenado.", type: "rating", required: true },
            { id: nanoid(), text: "La plataforma o el lugar donde se realizó el evento fue adecuado y cómodo.", type: "rating", required: true },
            { id: nanoid(), text: "El tiempo asignado para cada intervención fue suficiente.", type: "rating", required: true },
        ]
    },
    {
        id: nanoid(),
        title: "Sobre el Contenido",
        questions: [
             { id: nanoid(), text: "Los recursos audiovisuales utilizados (presentaciones, videos, etc.) fueron de alta calidad y enriquecieron el debate.", type: "rating", required: true },
            { id: nanoid(), text: "La calidad de los argumentos y la preparación de los equipos participantes fue alta.", type: "rating", required: true },
        ]
    },
    {
        id: nanoid(),
        title: "Opinión General",
        questions: [
            { id: nanoid(), text: "El evento cumplió con mis expectativas.", type: "rating", required: true },
            { id: nanoid(), text: "Recomendaría este evento a otros colegios o estudiantes.", type: "rating", required: true },
            { id: nanoid(), text: "¿Qué sugerencias tiene para mejorar futuros conversatorios?", type: "text", required: false },
            { id: nanoid(), text: "¿En qué rol participó en el evento?", type: "text", required: false },
        ]
    }
];

const defaultValues: FormData = {
    title: "ENCUESTA DE SATISFACCIÓN",
    subtitle: "CONVERSATORIO INTERCOLEGIAL COLEGIO BILINGÜE PADRE FRANCESCO COLL",
    imageUrl: "",
    sections: defaultSections,
    isActive: false,
};


export function SurveyManagement() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [loadingResponses, setLoadingResponses] = useState(true);
  
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: defaultValues,
  });

  const isSurveyActive = form.watch('isActive');

  useEffect(() => {
    const configRef = doc(db, 'siteContent', 'survey');
    const unsubscribeConfig = onSnapshot(configRef, (doc) => {
        if (doc.exists()) {
            const data = doc.data() as Partial<FormData>;
            const sanitizedData: FormData = {
                title: data.title || defaultValues.title,
                subtitle: data.subtitle || defaultValues.subtitle,
                imageUrl: data.imageUrl || defaultValues.imageUrl,
                sections: data.sections && data.sections.length > 0 ? data.sections : defaultValues.sections,
                isActive: data.isActive || false,
            };
            form.reset(sanitizedData);
        } else {
             form.reset(defaultValues);
        }
        setLoading(false);
    });

    const responsesQuery = query(collection(db, "surveyResponses"), orderBy("createdAt", "desc"));
    const unsubscribeResponses = onSnapshot(responsesQuery, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SurveyResponse));
        setResponses(data);
        setLoadingResponses(false);
    });

    return () => {
        unsubscribeConfig();
        unsubscribeResponses();
    };
  }, [form]);

  const { fields: sectionFields, append: appendSection, remove: removeSection, insert: insertSection } = useFieldArray({
    control: form.control,
    name: "sections"
  });

  async function onSubmit(values: FormData) {
    setIsSubmitting(true);
    try {
      await setDoc(doc(db, 'siteContent', 'survey'), values);
      toast({
        title: "¡Encuesta Actualizada!",
        description: "El formulario de la encuesta ha sido guardado.",
      });
    } catch (error) {
      console.error("Error updating survey: ", error);
      toast({
        variant: "destructive",
        title: "Error al actualizar",
        description: "Hubo un problema al guardar los datos.",
      });
    } finally {
        setIsSubmitting(false);
    }
  }

  const handleToggleSurveyStatus = async (isActive: boolean) => {
    setIsSubmitting(true);
    try {
        const currentValues = form.getValues();
        await setDoc(doc(db, 'siteContent', 'survey'), { ...currentValues, isActive });
        form.setValue('isActive', isActive);
        toast({
            title: "Estado de la Encuesta Actualizado",
            description: `La encuesta ahora está ${isActive ? 'activa' : 'inactiva'}.`
        });
    } catch (error) {
        toast({
            variant: "destructive",
            title: "Error",
            description: "No se pudo actualizar el estado de la encuesta."
        });
    } finally {
        setIsSubmitting(false);
    }
  };

   const handleDuplicateSection = (index: number) => {
        const sectionToDuplicate = form.getValues(`sections.${index}`);
        const newSection = {
            ...sectionToDuplicate,
            id: nanoid(),
            title: `${sectionToDuplicate.title} (Copia)`,
            questions: sectionToDuplicate.questions.map(q => ({...q, id: nanoid()}))
        };
        insertSection(index + 1, newSection);
    }

    const ratingQuestionStats = useMemo(() => {
        const sections = form.getValues('sections');
        if (responses.length === 0 || !sections) return null;

        const allRatingQuestions = sections.flatMap(section => 
            section.questions.filter(q => q.type === 'rating')
        );

        if (allRatingQuestions.length === 0) return null;

        const questionAverages = allRatingQuestions.map(q => {
            const ratings = responses
                .map(r => parseInt(r.answers[q.id] as string, 10))
                .filter(rating => !isNaN(rating) && rating >= 1 && rating <= 5);
            
            if (ratings.length === 0) return { id: q.id, text: q.text, average: 0 };
            
            const sum = ratings.reduce((acc, rating) => acc + rating, 0);
            return { id: q.id, text: q.text, average: sum / ratings.length };
        });

        const highest = questionAverages.reduce((max, q) => q.average > max.average ? q : max, questionAverages[0]);
        const lowest = questionAverages.filter(q => q.average > 0).reduce((min, q) => q.average < min.average ? q : min, questionAverages.find(q => q.average > 0) || { average: 5 });


        return { highest, lowest };

    }, [responses, form]);


    const calculateChartData = () => {
        const sections = form.getValues('sections');
        if (responses.length === 0 || !sections) return [];

        return sections.map(section => {
            const ratingQuestionsData = section.questions
                .filter(q => q.type === 'rating')
                .map(q => {
                    const counts: { [key: string]: number } = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
                    responses.forEach(r => {
                        const answer = r.answers[q.id];
                        const rating = parseInt(answer as string, 10);
                        if (!isNaN(rating) && rating >= 1 && rating <= 5) {
                            counts[String(rating)]++;
                        }
                    });

                    const chartData = Object.entries(counts).map(([name, value]) => ({
                        name,
                        Total: value,
                    }));
                    
                    const totalVotes = chartData.reduce((sum, item) => sum + item.Total, 0);

                    return {
                        id: q.id,
                        text: q.text,
                        chartData,
                        totalVotes
                    };
                });
            return { title: section.title, questions: ratingQuestionsData };
        });
    };

  const getTextResponses = () => {
        const sections = form.getValues('sections');
        if (responses.length === 0 || !sections) return [];
        
        return sections.flatMap(section => {
            const textQuestions = section.questions.filter(q => q.type === 'text');
            return textQuestions.map(q => {
                const answers = responses
                    .map(r => r.answers[q.id])
                    .filter(a => typeof a === 'string' && a.trim() !== '') as string[];
                return { id: q.id, text: q.text, answers };
            });
        });
  }


  if (loading) {
      return (
          <div className="flex justify-center items-center py-10">
              <Loader2 className="h-8 w-8 animate-spin" />
          </div>
      )
  }

  return (
    <div className="space-y-8">
        <Card className={cn(
            "transition-colors",
            isSurveyActive ? "border-green-500" : "border-destructive"
        )}>
            <CardHeader>
                <CardTitle>Estado de la Encuesta</CardTitle>
                <CardDescription>Activa o desactiva la encuesta para el público y haz pruebas.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex items-center space-x-4 rounded-md border p-4">
                    <div className="flex-1 space-y-1">
                        <p className="text-sm font-medium leading-none">
                            {isSurveyActive ? "Encuesta Activa" : "Encuesta Inactiva"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                            {isSurveyActive 
                                ? "El público puede ver y responder la encuesta." 
                                : "La encuesta no es visible para el público."
                            }
                        </p>
                    </div>
                    <Switch
                        checked={isSurveyActive || false}
                        onCheckedChange={handleToggleSurveyStatus}
                        disabled={isSubmitting}
                        aria-readonly
                    />
                </div>
                 <Button asChild className="mt-4 w-full md:w-auto" variant="outline">
                    <Link href="/survey" target="_blank">
                        <Send className="mr-2 h-4 w-4" />
                        Hacer Encuesta como Admin
                    </Link>
                </Button>
            </CardContent>
             <CardFooter>
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                    {isSurveyActive ? <Power className="h-3 w-3 text-green-500"/> : <PowerOff className="h-3 w-3 text-destructive"/>}
                     El enlace de la encuesta en el menú de navegación también se ocultará/mostrará.
                </p>
            </CardFooter>
        </Card>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card>
                <CardHeader>
                    <CardTitle>Editor del Formulario de Encuesta</CardTitle>
                    <CardDescription>
                    Modifique el título, secciones y preguntas.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                        <FormField
                            control={form.control}
                            name="imageUrl"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>URL de la Imagen de Cabecera (Opcional)</FormLabel>
                                <FormControl><Input {...field} value={field.value ?? ''} placeholder="https://ejemplo.com/imagen.png" /></FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="title"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Título Principal</FormLabel>
                                <FormControl><Input {...field} value={field.value ?? ''} /></FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="subtitle"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Subtítulo</FormLabel>
                                <FormControl><Textarea {...field} value={field.value ?? ''} rows={2} /></FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        
                        <Separator />

                        <div className="space-y-4">
                             <div className="flex items-center justify-between">
                                <h3 className="text-lg font-medium">Secciones y Preguntas</h3>
                                <Button type="button" variant="outline" size="sm" onClick={() => appendSection({ id: nanoid(), title: '', questions: [{id: nanoid(), text: '', type: 'rating', required: false}] })}>
                                    <FolderPlus className="mr-2 h-4 w-4" /> Añadir Sección
                                </Button>
                            </div>
                            <Accordion type="multiple" className="w-full">
                                {sectionFields.map((section, sectionIndex) => (
                                    <AccordionItem value={section.id} key={section.id} className="border-b-0 mb-2">
                                        <Card className="bg-secondary/30">
                                            <div className="flex items-start p-4">
                                                <AccordionTrigger className="flex-1 p-0 text-left hover:no-underline">
                                                    <FormField
                                                        control={form.control}
                                                        name={`sections.${sectionIndex}.title`}
                                                        render={({ field }) => (
                                                            <FormItem className='flex-1'>
                                                                <FormLabel>Título de la Sección {sectionIndex + 1}</FormLabel>
                                                                <FormControl><Input {...field} placeholder="Escriba el título de la sección" className="bg-background" /></FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                </AccordionTrigger>
                                                <div className="flex flex-col ml-2 pt-6">
                                                     <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={(e) => { e.stopPropagation(); handleDuplicateSection(sectionIndex); }}>
                                                        <Copy className="h-4 w-4" />
                                                    </Button>
                                                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={(e) => { e.stopPropagation(); removeSection(sectionIndex); }}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                            <AccordionContent className="p-4 pt-0">
                                                <div className="space-y-4 pl-4 border-l-2 ml-2">
                                                     <QuestionFields control={form.control} sectionIndex={sectionIndex} />
                                                </div>
                                            </AccordionContent>
                                        </Card>
                                    </AccordionItem>
                                ))}
                            </Accordion>
                        </div>

                        <Button type="submit" className="w-full" size="lg" disabled={isSubmitting || loading}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Guardar Cambios en Encuesta
                        </Button>
                    </form>
                    </Form>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><BarChart className="h-6 w-6"/>Dashboard de Resultados ({responses.length} respuestas)</CardTitle>
                    <CardDescription>
                    Visualice las respuestas recibidas en tiempo real.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {loadingResponses ? (
                        <div className="flex justify-center items-center py-10">
                            <Loader2 className="h-8 w-8 animate-spin" />
                        </div>
                    ) : responses.length > 0 ? (
                        <>
                            {ratingQuestionStats && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Card className="border-green-500 bg-green-50/50">
                                        <CardHeader>
                                            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-green-700">
                                                <TrendingUp className="h-5 w-5" /> Pregunta Mejor Calificada
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="text-xs text-muted-foreground">{ratingQuestionStats.highest.text}</p>
                                            <p className="text-2xl font-bold text-green-700">{ratingQuestionStats.highest.average.toFixed(2)}</p>
                                        </CardContent>
                                    </Card>
                                     <Card className="border-red-500 bg-red-50/50">
                                        <CardHeader>
                                            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-red-700">
                                                <TrendingDown className="h-5 w-5" /> Pregunta con Menor Calificación
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="text-xs text-muted-foreground">{ratingQuestionStats.lowest.text}</p>
                                            <p className="text-2xl font-bold text-red-700">{ratingQuestionStats.lowest.average.toFixed(2)}</p>
                                        </CardContent>
                                    </Card>
                                </div>
                            )}

                            <div>
                                <h3 className="font-semibold mb-2">Resultados por Calificación</h3>
                                <Accordion type="single" collapsible className="w-full">
                                    {calculateChartData().map((section, i) => (
                                        section.questions.length > 0 &&
                                        <AccordionItem value={`section-${i}`} key={i}>
                                            <AccordionTrigger>{section.title}</AccordionTrigger>
                                            <AccordionContent className="space-y-6">
                                                {section.questions.map(q => (
                                                    <div key={q.id}>
                                                        <p className="text-sm font-medium mb-2">{q.text} <span className="text-muted-foreground">({q.totalVotes} votos)</span></p>
                                                        <ResponsiveContainer width="100%" height={150}>
                                                            <RechartsBarChart layout="vertical" data={q.chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                                                                <XAxis type="number" hide />
                                                                <YAxis type="category" dataKey="name" width={10} tickLine={false} axisLine={false} />
                                                                <Tooltip cursor={{ fill: 'hsl(var(--secondary))' }} contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}/>
                                                                <Bar dataKey="Total" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                                                            </RechartsBarChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                ))}
                                            </AccordionContent>
                                        </AccordionItem>
                                    ))}
                                </Accordion>
                            </div>
                            <Separator />
                            <div className="space-y-4">
                                <h3 className="font-semibold mb-2">Respuestas de Texto Abierto</h3>
                                 <Accordion type="multiple" className="w-full">
                                {getTextResponses().map((item) => (
                                    item.answers.length > 0 && (
                                    <AccordionItem value={item.id} key={item.id}>
                                         <AccordionTrigger>{item.text}</AccordionTrigger>
                                         <AccordionContent>
                                            <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                                                {item.answers.map((answer, j) => (
                                                    <p key={j} className="text-sm bg-secondary p-2 rounded-md border">{answer}</p>
                                                ))}
                                            </div>
                                         </AccordionContent>
                                    </AccordionItem>
                                    )
                                ))}
                                </Accordion>
                            </div>
                        </>
                    ) : (
                        <p className="text-center text-muted-foreground py-10">Aún no hay respuestas para mostrar.</p>
                    )}
                </CardContent>
            </Card>
        </div>
    </div>
  );
}

function QuestionFields({ control, sectionIndex }: { control: Control<FormData>, sectionIndex: number }) {
    const { fields, append, remove, insert } = useFieldArray({
        control,
        name: `sections.${sectionIndex}.questions`
    });

    const handleDuplicateQuestion = (index: number) => {
        const questionToDuplicate = control.getValues(`sections.${sectionIndex}.questions.${index}`);
        insert(index + 1, { ...questionToDuplicate, id: nanoid() });
    }

    return (
        <>
            {fields.map((field, questionIndex) => (
                <div key={field.id} className="space-y-3 rounded-md border p-4 relative bg-background shadow-sm">
                    <div className="absolute top-1 right-1 flex">
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => handleDuplicateQuestion(questionIndex)}>
                            <Copy className="h-4 w-4" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(questionIndex)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>

                    <FormField
                        control={control}
                        name={`sections.${sectionIndex}.questions.${questionIndex}.text`}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Texto de la Pregunta {questionIndex + 1}</FormLabel>
                                <FormControl><Textarea rows={2} {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={control}
                        name={`sections.${sectionIndex}.questions.${questionIndex}.type`}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Tipo de Respuesta</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="rating">Calificación (1-5)</SelectItem>
                                        <SelectItem value="text">Texto Abierto</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={control}
                        name={`sections.${sectionIndex}.questions.${questionIndex}.required`}
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm mt-2 bg-secondary/50">
                                <div className="space-y-0.5">
                                    <FormLabel>Pregunta Obligatoria</FormLabel>
                                </div>
                                <FormControl>
                                    <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => append({ id: nanoid(), text: '', type: 'rating', required: false })}>
                <PlusCircle className="mr-2 h-4 w-4" /> Añadir Pregunta a esta Sección
            </Button>
        </>
    );
}

    