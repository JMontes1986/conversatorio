

"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { School, User, Settings, PlusCircle, MoreHorizontal, FilePen, Trash2, Loader2, Trophy, Send } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy, addDoc, doc, setDoc } from 'firebase/firestore';
import { useToast } from "@/hooks/use-toast";
import { AdminAuth } from '@/components/auth/admin-auth';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';

interface Participant {
    name: string;
}
interface SchoolData {
    id: string;
    schoolName: string;
    teamName: string;
    participants: Participant[];
    attendees: Participant[];
    status: 'Verificado' | 'Pendiente';
}
interface JudgeData {
    id: string;
    name: string;
    cedula: string;
}
interface ScoreData {
    id: string;
    matchId: string;
    judgeName: string;
    teamA_total: number;
    teamB_total: number;
}
interface MatchResults {
    matchId: string;
    scores: ScoreData[];
    totalTeamA: number;
    totalTeamB: number;
    winner: 'teamA' | 'teamB' | 'Tie';
}

function CompetitionSettings() {
    const { toast } = useToast();
    const [currentRound, setCurrentRound] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const DEBATE_STATE_DOC_ID = "current";

    const handleUpdateRound = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentRound) {
            toast({ variant: "destructive", title: "Error", description: "Por favor seleccione una ronda." });
            return;
        }
        setIsSubmitting(true);
        try {
            const docRef = doc(db, "debateState", DEBATE_STATE_DOC_ID);
            await setDoc(docRef, { currentRound: currentRound }, { merge: true });
            toast({ title: "Ronda Actualizada", description: `La ronda activa ahora es: ${currentRound}.` });
        } catch (error) {
            console.error("Error updating round:", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar la ronda." });
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Ajustes de la Competencia</CardTitle>
                <CardDescription>Configuración general de la competencia.</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleUpdateRound} className="space-y-4 max-w-sm">
                    <div className="space-y-2">
                        <Label htmlFor="current-round">Ronda de Debate Activa</Label>
                         <Select onValueChange={setCurrentRound} value={currentRound} disabled={isSubmitting}>
                            <SelectTrigger id="current-round">
                                <SelectValue placeholder="Seleccione la ronda actual" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Ronda 1">Ronda 1</SelectItem>
                                <SelectItem value="Ronda 2">Ronda 2</SelectItem>
                                <SelectItem value="Cuartos de Final">Cuartos de Final</SelectItem>
                                <SelectItem value="Semifinal">Semifinal</SelectItem>
                                <SelectItem value="Final">Final</SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">Esta será la ronda que se mostrará públicamente en la página de Debate.</p>
                    </div>
                    <Button type="submit" disabled={isSubmitting || !currentRound}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                        Actualizar Ronda
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}

function AdminDashboard() {
  const { toast } = useToast();
  const [schools, setSchools] = useState<SchoolData[]>([]);
  const [judges, setJudges] = useState<JudgeData[]>([]);
  const [scores, setScores] = useState<ScoreData[]>([]);
  const [loadingSchools, setLoadingSchools] = useState(true);
  const [loadingJudges, setLoadingJudges] = useState(true);
  const [loadingScores, setLoadingScores] = useState(true);
  
  const [newJudgeName, setNewJudgeName] = useState("");
  const [newJudgeCedula, setNewJudgeCedula] = useState("");
  const [isSubmittingJudge, setIsSubmittingJudge] = useState(false);

  useEffect(() => {
    const schoolsQuery = query(collection(db, "schools"), orderBy("createdAt", "desc"));
    const unsubscribeSchools = onSnapshot(schoolsQuery, (querySnapshot) => {
        const schoolsData: SchoolData[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            schoolsData.push({
                id: doc.id,
                schoolName: data.schoolName,
                teamName: data.teamName,
                status: data.status,
                participants: data.participants || [],
                attendees: data.attendees || [],
            });
        });
        setSchools(schoolsData);
        setLoadingSchools(false);
    }, (error) => {
        console.error("Error fetching schools:", error);
        setLoadingSchools(false);
    });

    const judgesQuery = query(collection(db, "judges"), orderBy("createdAt", "asc"));
    const unsubscribeJudges = onSnapshot(judgesQuery, (querySnapshot) => {
        const judgesData: JudgeData[] = [];
        querySnapshot.forEach((doc) => {
            judgesData.push({ id: doc.id, ...doc.data() } as JudgeData);
        });
        setJudges(judgesData);
        setLoadingJudges(false);
    }, (error) => {
        console.error("Error fetching judges:", error);
        setLoadingJudges(false);
    });

    const scoresQuery = query(collection(db, "scores"), orderBy("createdAt", "desc"));
    const unsubscribeScores = onSnapshot(scoresQuery, (querySnapshot) => {
        const scoresData: ScoreData[] = [];
        querySnapshot.forEach((doc) => {
            scoresData.push({ id: doc.id, ...doc.data()} as ScoreData);
        });
        setScores(scoresData);
        setLoadingScores(false);
    });

    return () => {
        unsubscribeSchools();
        unsubscribeJudges();
        unsubscribeScores();
    };
  }, []);

 const handleAddJudge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJudgeName.trim() || !newJudgeCedula.trim()) {
        toast({ variant: "destructive", title: "Error", description: "Nombre y cédula son requeridos." });
        return;
    }
    setIsSubmittingJudge(true);
    try {
        await addDoc(collection(db, "judges"), {
            name: newJudgeName,
            cedula: newJudgeCedula,
            createdAt: new Date(),
        });
        toast({ title: "Jurado Añadido", description: "El nuevo jurado ha sido registrado." });
        setNewJudgeName("");
        setNewJudgeCedula("");
    } catch (error) {
        console.error("Error adding judge:", error);
        toast({ variant: "destructive", title: "Error", description: "No se pudo añadir el jurado." });
    } finally {
        setIsSubmittingJudge(false);
    }
 };
 
  const processedResults: MatchResults[] = scores.reduce((acc, score) => {
    let match = acc.find(m => m.matchId === score.matchId);
    if (!match) {
        match = { matchId: score.matchId, scores: [], totalTeamA: 0, totalTeamB: 0, winner: 'Tie' };
        acc.push(match);
    }
    match.scores.push(score);
    match.totalTeamA += score.teamA_total;
    match.totalTeamB += score.teamB_total;
    
    if (match.totalTeamA > match.totalTeamB) match.winner = 'teamA';
    else if (match.totalTeamB > match.totalTeamA) match.winner = 'teamB';
    else match.winner = 'Tie';

    return acc;
  }, [] as MatchResults[]);


  return (
    <div className="container mx-auto py-10 px-4 md:px-6">
      <div className="mb-8">
        <h1 className="font-headline text-3xl md:text-4xl font-bold">
          Panel de Administrador
        </h1>
        <p className="text-muted-foreground mt-2">
          Gestione todos los aspectos de la competencia Conversatorio Colgemelli.
        </p>
      </div>

      <Tabs defaultValue="schools" className="w-full">
        <TabsList className="grid w-full grid-cols-4 md:w-[600px]">
          <TabsTrigger value="schools"><School className="h-4 w-4 mr-2" />Colegios</TabsTrigger>
          <TabsTrigger value="judges"><User className="h-4 w-4 mr-2" />Jurados</TabsTrigger>
          <TabsTrigger value="results"><Trophy className="h-4 w-4 mr-2"/>Resultados</TabsTrigger>
          <TabsTrigger value="settings"><Settings className="h-4 w-4 mr-2" />Ajustes</TabsTrigger>
        </TabsList>
        <TabsContent value="schools">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Gestión de Colegios</CardTitle>
                    <CardDescription>
                        Añada, edite o elimine colegios participantes.
                    </CardDescription>
                </div>
                 <Button size="sm" className="gap-1" asChild>
                    <Link href="/register">
                      <PlusCircle className="h-3.5 w-3.5" />
                      Añadir Colegio
                    </Link>
                </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colegio (Equipo)</TableHead>
                    <TableHead className="text-center">Participantes</TableHead>
                    <TableHead className="text-center hidden md:table-cell">Asistentes</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>
                      <span className="sr-only">Acciones</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingSchools ? (
                    <TableRow>
                        <TableCell colSpan={5} className="text-center">Cargando colegios...</TableCell>
                    </TableRow>
                  ) : schools.map(school => (
                    <TableRow key={school.id}>
                        <TableCell className="font-medium">
                            <div>{school.schoolName}</div>
                            <div className="text-xs text-muted-foreground">{school.teamName}</div>
                        </TableCell>
                        <TableCell className="text-center">{school.participants.length}</TableCell>
                        <TableCell className="text-center hidden md:table-cell">{school.attendees.length}</TableCell>
                        <TableCell>
                            <Badge variant={school.status === 'Verificado' ? 'default' : 'secondary'}>{school.status}</Badge>
                        </TableCell>
                        <TableCell>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                <Button
                                    aria-haspopup="true"
                                    size="icon"
                                    variant="ghost"
                                >
                                    <MoreHorizontal className="h-4 w-4" />
                                    <span className="sr-only">Toggle menu</span>
                                </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                <DropdownMenuItem><FilePen className="mr-2 h-4 w-4"/>Editar</DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive"><Trash2 className="mr-2 h-4 w-4"/>Eliminar</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="judges">
            <div className="grid md:grid-cols-3 gap-6">
                <div className="md:col-span-1">
                     <Card>
                        <CardHeader>
                            <CardTitle>Añadir Jurado</CardTitle>
                            <CardDescription>Registre un nuevo jurado para la competencia.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleAddJudge} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="judge-name">Nombre completo</Label>
                                    <Input id="judge-name" value={newJudgeName} onChange={(e) => setNewJudgeName(e.target.value)} placeholder="Nombre del jurado" disabled={isSubmittingJudge}/>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="judge-cedula">Cédula</Label>
                                    <Input id="judge-cedula" value={newJudgeCedula} onChange={(e) => setNewJudgeCedula(e.target.value)} placeholder="Cédula del jurado" disabled={isSubmittingJudge}/>
                                </div>
                                <Button type="submit" className="w-full" disabled={isSubmittingJudge}>
                                     {isSubmittingJudge && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Añadir Jurado
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>
                <div className="md:col-span-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Jurados Registrados</CardTitle>
                            <CardDescription>Lista de jurados para la competencia.</CardDescription>
                        </CardHeader>
                        <CardContent>
                             <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[80px]">#</TableHead>
                                        <TableHead>Nombre</TableHead>
                                        <TableHead>Cédula</TableHead>
                                        <TableHead><span className="sr-only">Acciones</span></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loadingJudges ? (
                                         <TableRow>
                                            <TableCell colSpan={4} className="text-center">Cargando jurados...</TableCell>
                                        </TableRow>
                                    ) : judges.map((judge, index) => (
                                        <TableRow key={judge.id}>
                                            <TableCell className="font-medium">Jurado {index + 1}</TableCell>
                                            <TableCell>{judge.name}</TableCell>
                                            <TableCell>{judge.cedula}</TableCell>
                                            <TableCell>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button aria-haspopup="true" size="icon" variant="ghost">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                            <span className="sr-only">Toggle menu</span>
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                                        <DropdownMenuItem><FilePen className="mr-2 h-4 w-4"/>Editar</DropdownMenuItem>
                                                        <DropdownMenuItem className="text-destructive"><Trash2 className="mr-2 h-4 w-4"/>Eliminar</DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </TabsContent>
         <TabsContent value="results">
          <Card>
            <CardHeader>
              <CardTitle>Resultados de las Rondas</CardTitle>
              <CardDescription>
                Resultados detallados de cada partida, jurado por jurado.
              </CardDescription>
            </CardHeader>
            <CardContent>
                {loadingScores && <p className="text-center">Cargando resultados...</p>}
                {!loadingScores && processedResults.length === 0 && <p className="text-center text-muted-foreground">Aún no hay resultados para mostrar.</p>}
                <Accordion type="single" collapsible className="w-full">
                    {processedResults.map(result => (
                        <AccordionItem value={result.matchId} key={result.matchId}>
                            <AccordionTrigger>
                                <div className="flex justify-between items-center w-full pr-4">
                                    <span className="font-bold text-lg capitalize">Ronda: {result.matchId.replace('-', ' ')}</span>
                                    <div className="text-right">
                                        <p className="text-sm">Ganador: <Badge variant={result.winner === 'teamA' ? 'default' : 'secondary'}>{result.winner === 'teamA' ? 'Equipo A' : result.winner === 'teamB' ? 'Equipo B' : 'Empate'}</Badge></p>
                                        <p className="text-xs text-muted-foreground">A: {result.totalTeamA} vs B: {result.totalTeamB}</p>
                                    </div>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent>
                               <Table>
                                 <TableHeader>
                                    <TableRow>
                                        <TableHead>Jurado</TableHead>
                                        <TableHead className="text-center">Puntaje Equipo A</TableHead>
                                        <TableHead className="text-center">Puntaje Equipo B</TableHead>
                                    </TableRow>
                                 </TableHeader>
                                 <TableBody>
                                    {result.scores.map(score => (
                                         <TableRow key={score.id}>
                                            <TableCell>{score.judgeName}</TableCell>
                                            <TableCell className="text-center">{score.teamA_total}</TableCell>
                                            <TableCell className="text-center">{score.teamB_total}</TableCell>
                                         </TableRow>
                                    ))}
                                     <TableRow className="bg-secondary font-bold">
                                        <TableCell>Total</TableCell>
                                        <TableCell className="text-center text-lg">{result.totalTeamA}</TableCell>
                                        <TableCell className="text-center text-lg">{result.totalTeamB}</TableCell>
                                     </TableRow>
                                 </TableBody>
                               </Table>
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="settings">
            <CompetitionSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function AdminPage() {
    return (
        <AdminAuth>
            <AdminDashboard />
        </AdminAuth>
    );
}

    
