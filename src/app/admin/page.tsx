
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
import { School, User, Settings, PlusCircle, MoreHorizontal, FilePen, Trash2, Loader2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy, addDoc } from 'firebase/firestore';
import { useToast } from "@/hooks/use-toast";
import { AdminAuth } from '@/components/auth/admin-auth';

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

function AdminDashboard() {
  const { toast } = useToast();
  const [schools, setSchools] = useState<SchoolData[]>([]);
  const [judges, setJudges] = useState<JudgeData[]>([]);
  const [loadingSchools, setLoadingSchools] = useState(true);
  const [loadingJudges, setLoadingJudges] = useState(true);
  
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

    return () => {
        unsubscribeSchools();
        unsubscribeJudges();
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
        <TabsList className="grid w-full grid-cols-3 md:w-[400px]">
          <TabsTrigger value="schools"><School className="h-4 w-4 mr-2" />Colegios</TabsTrigger>
          <TabsTrigger value="judges"><User className="h-4 w-4 mr-2" />Jurados</TabsTrigger>
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
                 <Button size="sm" className="gap-1">
                    <PlusCircle className="h-3.5 w-3.5" />
                    Añadir Colegio
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
        <TabsContent value="settings">
        <Card>
                <CardHeader>
                    <CardTitle>Ajustes de la Competencia</CardTitle>
                    <CardDescription>Configuración general de la competencia.</CardDescription>
                </CardHeader>
                <CardContent className="text-center p-10 text-muted-foreground">
                    Próximamente...
                </CardContent>
            </Card>
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
