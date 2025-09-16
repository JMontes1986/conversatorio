

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
import { Loader2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import React from "react";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

const formSchema = z.object({
  text: z.string().min(10, "La pregunta debe tener al menos 10 caracteres."),
  round: z.string().min(1, "Debe seleccionar una ronda."),
});

type FormData = z.infer<typeof formSchema>;

interface QuestionData {
    id: string;
    text: string;
    round: string;
}

interface RoundData {
    id: string;
    name: string;
    phase: string;
}

interface EditQuestionFormProps {
    question: QuestionData;
    allRounds: RoundData[];
    onFinished: () => void;
}

export function EditQuestionForm({ question, allRounds, onFinished }: EditQuestionFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      text: question.text || "",
      round: question.round || "",
    },
  });
  
  const roundsByPhase = React.useMemo(() => {
    const grouped = allRounds.reduce((acc, round) => {
        const phase = round.phase || 'General';
        if (!acc[phase]) acc[phase] = [];
        acc[phase].push(round);
        return acc;
    }, {} as Record<string, RoundData[]>);
    
    const phaseOrder = ["Fase de Grupos", "Fase de semifinal", "Fase de Finales"];
    const sortedPhases = Object.keys(grouped).sort((a,b) => phaseOrder.indexOf(a) - phaseOrder.indexOf(b));
    
    const result: Record<string, RoundData[]> = {};
    sortedPhases.forEach(phase => {
        result[phase] = grouped[phase];
    });
    return result;
  }, [allRounds]);


  async function onSubmit(values: FormData) {
    setIsSubmitting(true);
    try {
      const questionRef = doc(db, "questions", question.id);
      await updateDoc(questionRef, values);
      toast({
        title: "¡Pregunta Actualizada!",
        description: "La pregunta ha sido modificada exitosamente.",
      });
      onFinished();
    } catch (error) {
      console.error("Error updating question: ", error);
      toast({
        variant: "destructive",
        title: "Error al actualizar",
        description: "Hubo un problema al guardar los datos.",
      });
    } finally {
        setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
                control={form.control}
                name="text"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Texto de la Pregunta</FormLabel>
                        <FormControl>
                            <Textarea placeholder="Escriba la pregunta..." {...field} rows={5} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
             <FormField
                control={form.control}
                name="round"
                render={({ field }) => (
                     <FormItem>
                         <FormLabel>Ronda Asignada</FormLabel>
                         <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccione una ronda" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {Object.entries(roundsByPhase).map(([phase, rounds]) => (
                                    <SelectGroup key={phase}>
                                        <FormLabel className="px-2 py-1.5 text-xs font-semibold">{phase}</FormLabel>
                                        {rounds.map(round => (
                                            <SelectItem key={round.id} value={round.name}>{round.name}</SelectItem>
                                        ))}
                                    </SelectGroup>
                                ))}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )}
            />
            <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSubmitting ? "Guardando..." : "Guardar Cambios"}
            </Button>
        </form>
    </Form>
  );
}
