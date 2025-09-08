
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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
  } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge";
import { School, User, Settings, PlusCircle, MoreHorizontal, FilePen, Trash2, Users as UsersIcon } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';

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

export default function AdminPage() {
  const [schools, setSchools] = useState<SchoolData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "schools"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
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
        setLoading(false);
    }, (error) => {
        console.error("Error fetching schools:", error);
        setLoading(false);
    });

    return () => unsubscribe();
}, []);

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
          <TabsTrigger value="schools"><School className="h-4 w-4 mr-2" />Escuelas</TabsTrigger>
          <TabsTrigger value="judges"><User className="h-4 w-4 mr-2" />Jueces</TabsTrigger>
          <TabsTrigger value="settings"><Settings className="h-4 w-4 mr-2" />Ajustes</TabsTrigger>
        </TabsList>
        <TabsContent value="schools">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Gestión de Escuelas</CardTitle>
                    <CardDescription>
                        Añada, edite o elimine escuelas participantes.
                    </CardDescription>
                </div>
                 <Button size="sm" className="gap-1">
                    <PlusCircle className="h-3.5 w-3.5" />
                    Añadir Escuela
                </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Escuela (Equipo)</TableHead>
                    <TableHead className="text-center">Participantes</TableHead>
                    <TableHead className="text-center hidden md:table-cell">Asistentes</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>
                      <span className="sr-only">Acciones</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                        <TableCell colSpan={5} className="text-center">Cargando escuelas...</TableCell>
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
            <Card>
                <CardHeader>
                    <CardTitle>Gestión de Jueces</CardTitle>
                    <CardDescription>Contenido para la gestión de jueces.</CardDescription>
                </CardHeader>
                <CardContent className="text-center p-10 text-muted-foreground">
                    Próximamente...
                </CardContent>
            </Card>
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
