
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Loader2, Send, CheckCircle, Lightbulb, ArrowLeft, User } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, addDoc, doc, onSnapshot, getDoc, serverTimestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import React, { useEffect, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";


interface Team {
    name: string;
}
interface DebateState {
    currentRound: string;
    teams: Team[];
    questionId: string;
}


function PublicPageLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
                <div className="container mx-auto flex h-16 items-center justify-center px-4 md:px-6">
                     <Link href="/" className="flex items-center gap-2">
                        <Image src="https://mbosvnmhnbrslfwlfcxu.supabase.co/storage/v1/object/public/Software/Logo%20Slogan%20Nuevo%20FINAL-05.png" alt="Logo Colgemelli" width={60} height={60} />
                        <span className="font-headline text-lg font-bold">Conversatorio Colgemelli</span>
                    </Link>
                </div>
            </header>
            <main className="flex-grow">{children}</main>
        </>
    );
}

function QuestionLiveComponent() {
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const [questionId, setQuestionId] = useState<string | null>(null);
    const [debateQuestion, setDebateQuestion] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [studentName, setStudentName] = useState('');
    const [studentQuestion, setStudentQuestion] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [debateState, setDebateState] = useState<DebateState | null>(null);
    const [targetTeam, setTargetTeam] = useState<string>("");

    useEffect(() => {
        const q_id = searchParams.get('q_id');
        if (q_id) {
            // Check if a question has already been submitted for this debate question ID
            if (localStorage.getItem(`submitted_question_${q_id}`)) {
                setIsSubmitted(true);
            }

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
        if (!studentName.trim()) {
             toast({ variant: 'destructive', title: 'Error', description: 'Su nombre es requerido.'});
            return;
        }
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
                name: studentName,
                text: studentQuestion,
                relatedDebateQuestionId: questionId,
                targetTeam: targetTeam,
                status: 'pending',
                createdAt: serverTimestamp(),
            });
            
            // Set a flag in localStorage to prevent another submission for this question
            localStorage.setItem(`submitted_question_${questionId}`, 'true');

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
                        <p className="text-muted-foreground">Tu pregunta ha sido enviada. Solo puedes enviar una pregunta por tema de debate.</p>
                    </CardContent>
                    <CardFooter className="flex justify-center pt-4">
                        <Button asChild>
                            <Link href="/debate">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Volver al Debate
                            </Link>
                        </Button>
                    </CardFooter>
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
                        <div className="space-y-2">
                             <Label htmlFor="student-name" className="text-sm font-medium text-muted-foreground">
                                Su Nombre
                            </Label>
                             <Input
                                id="student-name"
                                value={studentName}
                                onChange={(e) => setStudentName(e.target.value)}
                                placeholder="Escriba su nombre aquí..."
                                disabled={isSubmitting}
                            />
                        </div>
                        <div>
                            <label htmlFor="student-question" className="block text-sm font-medium text-muted-foreground mb-2">
                                Basado en el tema, ¿qué pregunta tienes para los participantes?
                            </label>
                            <Textarea
                                id="student-question"
                                value={studentQuestion}
                                onChange={(e) => setStudentQuestion(e.target.value)}
                                placeholder="Escriba su pregunta aquí..."
                                rows={3}
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

export default function LivePage() {
    return <PublicPageLayout><QuestionLiveComponent /></PublicPageLayout>;
}
