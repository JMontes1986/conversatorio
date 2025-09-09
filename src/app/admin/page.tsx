

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
import { School, User, Settings, PlusCircle, MoreHorizontal, FilePen, Trash2, Loader2, Trophy, KeyRound, Copy, Check, ToggleLeft, ToggleRight, Video, Send, Plus, Save, MessageSquare, RefreshCw, Gavel, Swords, ChevronDown, Users, CheckCircle2, Shuffle, ListChecks } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, getDocs, where, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { useToast } from "@/hooks/use-toast";
import { AdminAuth } from '@/components/auth/admin-auth';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import Link from 'next/link';
import { nanoid } from 'nanoid';
import { DebateControlPanel } from '@/components/debate-control-panel';
import { RoundManagement } from '@/components/round-management';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { EditSchoolForm } from '@/components/edit-school-form';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DrawAnimation } from '@/components/draw-animation';
import { RubricManagement } from '@/components/rubric-management';


interface SchoolData {
    id: string;
    schoolName: string;
    teamName: string;
    participants: { name: string }[];
    attendees: { name: string }[];
    status: 'Verificado' | 'Pendiente';
    contactName: string;
    contactEmail: string;
}
interface JudgeData {
    id: string;
    name: string;
    cedula: string;
}
interface ModeratorData {
    id: string;
    username: string;
    token: string;
    status: 'active' | 'inactive';
}
interface ScoreData {
    id: string;
    matchId: string;
    judgeName: string;
    teams: { name: string; total: number }[];
}
interface MatchResults {
    matchId: string;
    scores: ScoreData[];
    teamTotals: Record<string, number>;
    winner: string;
}


function AdminDashboard() {
  const { toast } = useToast();
  const [schools, setSchools] = useState<SchoolData[]>([]);
  const [judges, setJudges] = useState<JudgeData[]>([]);
  const [scores, setScores] = useState<ScoreData[]>([]);
  const [moderators, setModerators] = useState<ModeratorData[]>([]);

  const [loadingSchools, setLoadingSchools] = useState(true);
  const [loadingJudges, setLoadingJudges] = useState(true);
  const [loadingScores, setLoadingScores] = useState(true);
  const [loadingModerators, setLoadingModerators] = useState(true);
  
  const [newJudgeName, setNewJudgeName] = useState("");
  const [newJudgeCedula, setNewJudgeCedula] = useState("");
  const [isSubmittingJudge, setIsSubmittingJudge] = useState(false);
  
  const [newModeratorUsername, setNewModeratorUsername] = useState("");
  const [isSubmittingModerator, setIsSubmittingModerator] = useState(false);
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState<SchoolData | null>(null);

  useEffect(() => {
    const schoolsQuery = query(collection(db, "schools"), orderBy("createdAt", "desc"));
    const unsubscribeSchools = onSnapshot(schoolsQuery, (querySnapshot) => {
        const schoolsData: SchoolData[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            schoolsData.push({
                id: doc.id,
                ...data
            } as SchoolData);
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
    
     const moderatorsQuery = query(collection(db, "moderators"), orderBy("createdAt", "asc"));
     const unsubscribeModerators = onSnapshot(moderatorsQuery, (querySnapshot) => {
        const moderatorsData: ModeratorData[] = [];
        querySnapshot.forEach((doc) => {
            moderatorsData.push({ id: doc.id, ...doc.data() } as ModeratorData);
        });
        setModerators(moderatorsData);
        setLoadingModerators(false);
     }, (error) => {
        console.error("Error fetching moderators:", error);
        setLoadingModerators(false);
     });


    return () => {
        unsubscribeSchools();
        unsubscribeJudges();
        unsubscribeScores();
        unsubscribeModerators();
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
            createdAt: serverTimestamp(),
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
 
   const handleAddModerator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModeratorUsername.trim()) {
        toast({ variant: "destructive", title: "Error", description: "El nombre de usuario es requerido." });
        return;
    }
    setIsSubmittingModerator(true);
    try {
        const existingModeratorQuery = query(collection(db, "moderators"), where("username", "==", newModeratorUsername.trim()));
        const existingModeratorSnapshot = await getDocs(existingModeratorQuery);
        if (!existingModeratorSnapshot.empty) {
            toast({ variant: "destructive", title: "Error", description: "Ese nombre de usuario ya existe." });
            return;
        }

        await addDoc(collection(db, "moderators"), {
            username: newModeratorUsername.trim(),
            token: nanoid(16),
            status: 'active',
            createdAt: serverTimestamp(),
        });
        toast({ title: "Moderador Creado", description: "Se ha creado un nuevo moderador con su token de acceso." });
        setNewModeratorUsername("");
    } catch (error) {
        console.error("Error adding moderator:", error);
        toast({ variant: "destructive", title: "Error", description: "No se pudo añadir el moderador." });
    } finally {
        setIsSubmittingModerator(false);
    }
  };

  const handleDeleteModerator = async (moderatorId: string) => {
    try {
      await deleteDoc(doc(db, "moderators", moderatorId));
      toast({ title: "Moderador Eliminado" });
    } catch (error) {
      console.error("Error deleting moderator:", error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar el moderador." });
    }
  };

  const handleDeleteSchool = async (schoolId: string) => {
    try {
      await deleteDoc(doc(db, "schools", schoolId));
      toast({ title: "Colegio Eliminado" });
    } catch (error) {
      console.error("Error deleting school:", error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar el colegio." });
    }
  };
  
  const handleToggleModeratorStatus = async (moderator: ModeratorData) => {
    const newStatus = moderator.status === 'active' ? 'inactive' : 'active';
    try {
        const moderatorRef = doc(db, "moderators", moderator.id);
        await updateDoc(moderatorRef, { status: newStatus });
        toast({
            title: "Estado Actualizado",
            description: `El token de ${moderator.username} ahora está ${newStatus === 'active' ? 'activo' : 'inactivo'}.`
        });
    } catch (error) {
         console.error("Error toggling moderator status:", error);
         toast({ variant: "destructive", title: "Error", description: "No se pudo cambiar el estado del moderador." });
    }
  }

  const handleToggleSchoolStatus = async (school: SchoolData) => {
    const newStatus = school.status === 'Verificado' ? 'Pendiente' : 'Verificado';
     try {
        const schoolRef = doc(db, "schools", school.id);
        await updateDoc(schoolRef, { status: newStatus });
        toast({
            title: "Estado del Colegio Actualizado",
            description: `El estado de ${school.schoolName} es ahora ${newStatus}.`
        });
    } catch (error) {
         console.error("Error toggling school status:", error);
         toast({ variant: "destructive", title: "Error", description: "No se pudo cambiar el estado del colegio." });
    }
  }

  const copyToken = (token: string, id: string) => {
    navigator.clipboard.writeText(token);
    setCopiedTokenId(id);
    setTimeout(() => setCopiedTokenId(null), 2000);
  };
 
 const processedResults: MatchResults[] = scores.reduce((acc, score) => {
    let match = acc.find(m => m.matchId === score.matchId);
    if (!match) {
        match = { matchId: score.matchId, scores: [], teamTotals: {}, winner: '' };
        acc.push(match);
    }
    match.scores.push(score);

    score.teams.forEach(team => {
        if (!match!.teamTotals[team.name]) {
            match!.teamTotals[team.name] = 0;
        }
        match!.teamTotals[team.name] += team.total;
    });
    
    // Determine winner
    const totals = Object.values(match.teamTotals);
    const maxScore = Math.max(...totals);
    const winners = Object.entries(match.teamTotals).filter(([, score]) => score === maxScore);
    
    if (winners.length > 1) {
        match.winner = 'Empate';
    } else if (winners.length === 1) {
        match.winner = winners[0][0];
    }

    return acc;
  }, [] as MatchResults[]);

  const openEditDialog = (school: SchoolData) => {
    setSelectedSchool(school);
    setIsEditDialogOpen(true);
  }


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

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <Tabs defaultValue="schools" className="w-full">
            <TabsList className="grid w-full grid-cols-1 md:grid-cols-8">
            <TabsTrigger value="schools"><School className="mr-2 h-4 w-4" />Colegios</TabsTrigger>
            <TabsTrigger value="rounds"><Swords className="mr-2 h-4 w-4" />Rondas</TabsTrigger>
            <TabsTrigger value="rubric"><ListChecks className="mr-2 h-4 w-4" />Rúbrica</TabsTrigger>
            <TabsTrigger value="draw"><Shuffle className="mr-2 h-4 w-4"/>Sorteo</TabsTrigger>
            <TabsTrigger value="judges"><User className="mr-2 h-4 w-4" />Jurados</TabsTrigger>
            <TabsTrigger value="moderators"><KeyRound className="mr-2 h-4 w-4" />Moderadores</TabsTrigger>
            <TabsTrigger value="debate-control"><Gavel className="mr-2 h-4 w-4" />Control del Debate</TabsTrigger>
            <TabsTrigger value="results"><Trophy className="mr-2 h-4 w-4"/>Resultados</TabsTrigger>
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
                        <TableHead className="w-[50px]"></TableHead>
                        <TableHead>Colegio (Equipo)</TableHead>
                        <TableHead className="text-center">Participantes</TableHead>
                        <TableHead className="text-center hidden md:table-cell">Asistentes</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>
                        <span className="sr-only">Acciones</span>
                        </TableHead>
                    </TableRow>
                    </TableHeader>
                    
                    {loadingSchools ? (
                        <TableBody>
                            <TableRow>
                                <TableCell colSpan={6} className="text-center">Cargando colegios...</TableCell>
                            </TableRow>
                        </TableBody>
                    ) : (
                        schools.map(school => (
                            <Collapsible asChild key={school.id}>
                                <TableBody>
                                    <TableRow>
                                        <TableCell>
                                            <CollapsibleTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                    <ChevronDown className="h-4 w-4 transition-transform [&[data-state=open]]:-rotate-180" />
                                                    <span className="sr-only">Toggle details</span>
                                                </Button>
                                            </CollapsibleTrigger>
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            <div>{school.schoolName}</div>
                                            <div className="text-xs text-muted-foreground">{school.teamName}</div>
                                        </TableCell>
                                        <TableCell className="text-center">{school.participants.length}</TableCell>
                                        <TableCell className="text-center hidden md:table-cell">{school.attendees?.length || 0}</TableCell>
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
                                                    <DropdownMenuItem onClick={() => handleToggleSchoolStatus(school)}>
                                                        <CheckCircle2 className="mr-2 h-4 w-4"/>
                                                        {school.status === 'Verificado' ? 'Marcar como Pendiente' : 'Marcar como Verificado'}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => openEditDialog(school)}>
                                                        <FilePen className="mr-2 h-4 w-4"/>Editar
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <DropdownMenuItem className="text-destructive" onSelect={(e) => e.preventDefault()}>
                                                                <Trash2 className="mr-2 h-4 w-4"/>Eliminar
                                                            </DropdownMenuItem>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                Esta acción no se puede deshacer. Se eliminará el colegio y todos sus datos asociados permanentemente.
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => handleDeleteSchool(school.id)} className="bg-destructive hover:bg-destructive/90">
                                                                Eliminar
                                                                </AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                    <CollapsibleContent asChild>
                                        <TableRow>
                                            <TableCell colSpan={6} className="p-0">
                                                <div className="bg-secondary/50 p-4">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div>
                                                            <h4 className="font-semibold flex items-center gap-2 mb-2"><Users className="h-4 w-4 text-primary"/> Participantes del Debate</h4>
                                                            <ul className="list-disc pl-5 text-sm">
                                                                {school.participants.map((p, i) => <li key={i}>{p.name}</li>)}
                                                            </ul>
                                                        </div>
                                                        <div>
                                                            <h4 className="font-semibold flex items-center gap-2 mb-2"><Users className="h-4 w-4 text-primary"/> Asistentes</h4>
                                                            {school.attendees && school.attendees.length > 0 ? (
                                                                <ul className="list-disc pl-5 text-sm">
                                                                    {school.attendees.map((a, i) => <li key={i}>{a.name}</li>)}
                                                                </ul>
                                                            ) : (
                                                                <p className="text-sm text-muted-foreground">No hay asistentes registrados.</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    </CollapsibleContent>
                                </TableBody>
                            </Collapsible>
                        ))
                    )}
                </Table>
                </CardContent>
            </Card>
            </TabsContent>
            <TabsContent value="rounds">
                <RoundManagement />
            </TabsContent>
            <TabsContent value="rubric">
                <RubricManagement />
            </TabsContent>
            <TabsContent value="draw">
                <DrawAnimation />
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
            <TabsContent value="moderators">
                <div className="grid md:grid-cols-3 gap-6">
                    <div className="md:col-span-1">
                        <Card>
                            <CardHeader>
                                <CardTitle>Crear Moderador</CardTitle>
                                <CardDescription>Cree un nuevo acceso para un moderador.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleAddModerator} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="moderator-username">Nombre de usuario</Label>
                                        <Input id="moderator-username" value={newModeratorUsername} onChange={(e) => setNewModeratorUsername(e.target.value)} placeholder="Ej: moderador1" disabled={isSubmittingModerator}/>
                                    </div>
                                    <Button type="submit" className="w-full" disabled={isSubmittingModerator}>
                                        {isSubmittingModerator && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Crear Moderador
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>
                    </div>
                    <div className="md:col-span-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Moderadores Activos</CardTitle>
                                <CardDescription>Lista de moderadores y sus tokens de acceso.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Usuario</TableHead>
                                            <TableHead>Token de Acceso</TableHead>
                                            <TableHead className="text-center">Estado</TableHead>
                                            <TableHead className="text-right">Acciones</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loadingModerators ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center">Cargando moderadores...</TableCell>
                                            </TableRow>
                                        ) : moderators.map((mod) => (
                                            <TableRow key={mod.id}>
                                                <TableCell className="font-medium">{mod.username}</TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Input type="text" readOnly value={mod.token} className="font-mono text-xs h-8"/>
                                                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => copyToken(mod.token, mod.id)}>
                                                            {copiedTokenId === mod.id ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Badge variant={mod.status === 'active' ? 'default' : 'destructive'}>
                                                        {mod.status === 'active' ? 'Activo' : 'Inactivo'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button aria-haspopup="true" size="icon" variant="ghost">
                                                                <MoreHorizontal className="h-4 w-4" />
                                                                <span className="sr-only">Toggle menu</span>
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                                            <DropdownMenuItem onClick={() => handleToggleModeratorStatus(mod)}>
                                                                {mod.status === 'active' ? <ToggleLeft className="mr-2 h-4 w-4" /> : <ToggleRight className="mr-2 h-4 w-4" />}
                                                                {mod.status === 'active' ? 'Desactivar' : 'Activar'}
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteModerator(mod.id)}>
                                                                <Trash2 className="mr-2 h-4 w-4"/>Eliminar
                                                            </DropdownMenuItem>
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
            <TabsContent value="debate-control">
            <DebateControlPanel registeredSchools={schools} allScores={scores} />
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
                                        <span className="font-bold text-lg capitalize">Ronda: {result.matchId.replace(/-/g, ' ')}</span>
                                        <div className="text-right">
                                            <p className="text-sm">Ganador: <Badge variant={result.winner === 'Empate' ? 'secondary' : 'default'}>{result.winner}</Badge></p>
                                            <p className="text-xs text-muted-foreground">
                                                {Object.entries(result.teamTotals).map(([name, total]) => `${name}: ${total}`).join(' vs ')}
                                            </p>
                                        </div>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Jurado</TableHead>
                                            {Object.keys(result.teamTotals).map(teamName => (
                                                <TableHead key={teamName} className="text-center">Puntaje {teamName}</TableHead>
                                            ))}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {result.scores.map(score => (
                                            <TableRow key={score.id}>
                                                <TableCell>{score.judgeName}</TableCell>
                                                {Object.keys(result.teamTotals).map(teamName => (
                                                    <TableCell key={teamName} className="text-center">{score.teams.find(t => t.name === teamName)?.total || 0}</TableCell>
                                                ))}
                                            </TableRow>
                                        ))}
                                        <TableRow className="bg-secondary font-bold">
                                            <TableCell>Total</TableCell>
                                            {Object.entries(result.teamTotals).map(([name, total]) => (
                                                <TableCell key={name} className="text-center text-lg">{total}</TableCell>
                                            ))}
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
        </Tabs>

        <DialogContent>
            <DialogHeader>
                <DialogTitle>Editar Colegio</DialogTitle>
            </DialogHeader>
            {selectedSchool && <EditSchoolForm school={selectedSchool} onFinished={() => setIsEditDialogOpen(false)} />}
        </DialogContent>
      </Dialog>
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
