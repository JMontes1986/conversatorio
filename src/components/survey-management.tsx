
"use client";

import { useForm, useFieldArray } from "react-hook-form";
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
import { Loader2, Trash2, PlusCircle, Save, BarChart, Power, PowerOff, FolderPlus } from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, setDoc, onSnapshot, collection, query, orderBy } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import React, { useEffect, useState } from "react";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "./ui/textarea";
import { nanoid } from "nanoid";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Switch } from "./ui/switch";
import { cn } from "@/lib/utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";

const questionSchema = z.object({
  id: z.string(),
  text: z.string().min(3, "El texto de la pregunta es requerido."),
  type: z.enum(["rating", "text"]),
});

const sectionSchema = z.object({
  id: z.string(),
  title: z.string().min(3, "El título de la sección es requerido."),
  questions: z.array(questionSchema).min(1, "La sección debe tener al menos una pregunta."),
});


const formSchema = z.object({
  title: z.string().min(3, "El título es requerido."),
  subtitle: z.string().min(10, "El subtítulo es requerido."),
  sections: z.array(sectionSchema).min(1, "Debe haber al menos una sección."),
  isActive: z.boolean().optional(),
});

type FormData = z.infer<typeof formSchema>;
type SurveyResponse = {
    id: string;
    createdAt: any;
    answers: Record<string, string | number>;
}


const defaultSections: z.infer<typeof sectionSchema>[] = [
    {
        id: nanoid(),
        title: "Sobre el Evento",
        questions: [
            { id: nanoid(), text: "El tema del conversatorio fue relevante y de actualidad.", type: "rating" },
            { id: nanoid(), text: "La organización general del evento fue excelente.", type: "rating" },
            { id: nanoid(), text: "Los moderadores del conversatorio facilitaron un diálogo dinámico y ordenado.", type: "rating" },
            { id: nanoid(), text: "La plataforma o el lugar donde se realizó el evento fue adecuado y cómodo.", type: "rating" },
            { id: nanoid(), text: "El tiempo asignado para cada intervención fue suficiente.", type: "rating" },
        ]
    },
    {
        id: nanoid(),
        title: "Sobre el Contenido",
        questions: [
             { id: nanoid(), text: "Los recursos audiovisuales utilizados (presentaciones, videos, etc.) fueron de alta calidad y enriquecieron el debate.", type: "rating" },
            { id: nanoid(), text: "La calidad de los argumentos y la preparación de los equipos participantes fue alta.", type: "rating" },
        ]
    },
    {
        id: nanoid(),
        title: "Opinión General",
        questions: [
            { id: nanoid(), text: "El evento cumplió con mis expectativas.", type: "rating" },
            { id: nanoid(), text: "Recomendaría este evento a otros colegios o estudiantes.", type: "rating" },
            { id: nanoid(), text: "¿Qué sugerencias tiene para mejorar futuros conversatorios?", type: "text" },
            { id: nanoid(), text: "¿En qué rol participó en el evento?", type: "text" },
        ]
    }
];


export function SurveyManagement() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [loadingResponses, setLoadingResponses] = useState(true);
  
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "ENCUESTA DE SATISFACCIÓN",
      subtitle: "CONVERSATORIO INTERCOLEGIAL COLEGIO BILINGÜE PADRE FRANCESCO COLL",
      sections: defaultSections,
      isActive: false,
    },
  });

  const isSurveyActive = form.watch('isActive');

  useEffect(() => {
    const configRef = doc(db, 'siteContent', 'survey');
    const unsubscribeConfig = onSnapshot(configRef, (doc) => {
        if (doc.exists()) {
            form.reset(doc.data() as FormData);
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

  const { fields: sectionFields, append: appendSection, remove: removeSection } = useFieldArray({
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

  const calculateAverages = () => {
        const sections = form.getValues('sections');
        if (responses.length === 0 || sections.length === 0) return [];
        
        return sections.map(section => {
            const ratingQuestions = section.questions.filter(q => q.type === 'rating');
            const questionAverages = ratingQuestions.map(q => {
                const ratings = responses
                    .map(r => r.answers[q.id])
                    .filter(a => typeof a === 'number' && a > 0 && a <= 5) as number[];
                
                if (ratings.length === 0) return { text: q.text, average: 'N/A' };

                const sum = ratings.reduce((acc, val) => acc + val, 0);
                const average = (sum / ratings.length).toFixed(2);
                return { text: q.text, average };
            });
            return { title: section.title, questions: questionAverages };
        });
  };
  
  const getTextResponses = () => {
        const sections = form.getValues('sections');
        if (responses.length === 0 || sections.length === 0) return [];
        
        return sections.flatMap(section => {
            const textQuestions = section.questions.filter(q => q.type === 'text');
            return textQuestions.map(q => {
                const answers = responses
                    .map(r => r.answers[q.id])
                    .filter(a => typeof a === 'string' && a.trim() !== '') as string[];
                return { text: q.text, answers };
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
                <CardDescription>Activa o desactiva la encuesta para el público.</CardDescription>
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
                        checked={isSurveyActive}
                        onCheckedChange={handleToggleSurveyStatus}
                        disabled={isSubmitting}
                        aria-readonly
                    />
                </div>
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
                            name="title"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Título Principal</FormLabel>
                                <FormControl><Input {...field} /></FormControl>
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
                                <FormControl><Textarea {...field} rows={2} /></FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        
                        <Separator />

                        <div className="space-y-4">
                             <div className="flex items-center justify-between">
                                <h3 className="text-lg font-medium">Secciones y Preguntas</h3>
                                <Button type="button" variant="outline" size="sm" onClick={() => appendSection({ id: nanoid(), title: '', questions: [{id: nanoid(), text: '', type: 'rating'}] })}>
                                    <FolderPlus className="mr-2 h-4 w-4" /> Añadir Sección
                                </Button>
                            </div>
                             {sectionFields.map((section, sectionIndex) => (
                                <div key={section.id} className="space-y-4 rounded-md border p-4 relative bg-secondary/30">
                                    <FormField
                                        control={form.control}
                                        name={`sections.${sectionIndex}.title`}
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Título de la Sección {sectionIndex + 1}</FormLabel>
                                                <FormControl><Input {...field} placeholder="Escriba el título de la sección" /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 text-destructive" onClick={() => removeSection(sectionIndex)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>

                                    <QuestionFields control={form.control} sectionIndex={sectionIndex} />
                                </div>
                            ))}
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
                    <CardTitle className="flex items-center gap-2"><BarChart className="h-6 w-6"/>Resultados de la Encuesta</CardTitle>
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
                            <div>
                                <h3 className="font-semibold mb-2">Promedio de Calificaciones</h3>
                                <Accordion type="single" collapsible className="w-full">
                                    {calculateAverages().map((section, i) => (
                                        <AccordionItem value={`section-${i}`} key={i}>
                                            <AccordionTrigger>{section.title}</AccordionTrigger>
                                            <AccordionContent>
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead>Pregunta</TableHead>
                                                            <TableHead className="text-right">Promedio (1-5)</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {section.questions.map((item, j) => (
                                                            <TableRow key={j}>
                                                                <TableCell className="text-sm">{item.text}</TableCell>
                                                                <TableCell className="text-right font-bold text-lg">{item.average}</TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </AccordionContent>
                                        </AccordionItem>
                                    ))}
                                </Accordion>
                            </div>
                            <Separator />
                            <div className="space-y-4">
                                {getTextResponses().map((item, i) => (
                                    item.answers.length > 0 && (
                                    <div key={i}>
                                        <h3 className="font-semibold mb-2">{item.text}</h3>
                                        <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                                            {item.answers.map((answer, j) => (
                                                <p key={j} className="text-sm bg-secondary p-2 rounded-md border">{answer}</p>
                                            ))}
                                        </div>
                                    </div>
                                    )
                                ))}
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

function QuestionFields({ control, sectionIndex }: { control: any, sectionIndex: number }) {
    const { fields, append, remove } = useFieldArray({
        control,
        name: `sections.${sectionIndex}.questions`
    });

    return (
        <div className="space-y-4 pl-4 border-l-2 ml-2">
            {fields.map((field, questionIndex) => (
                <div key={field.id} className="space-y-3 rounded-md border p-3 relative bg-background">
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
                    <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 text-destructive" onClick={() => remove(questionIndex)}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => append({ id: nanoid(), text: '', type: 'rating' })}>
                <PlusCircle className="mr-2 h-4 w-4" /> Añadir Pregunta a esta Sección
            </Button>
        </div>
    );
}
