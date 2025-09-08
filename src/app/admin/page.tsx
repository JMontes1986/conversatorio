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
import { School, User, Settings, PlusCircle, MoreHorizontal, FilePen, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const schools = [
    { id: 'ESC001', name: 'Águilas Doradas', contact: 'Juan Pérez', email: 'juan.perez@aguilas.edu', status: 'Verificado' },
    { id: 'ESC002', name: 'Leones Intrépidos', contact: 'Ana Gómez', email: 'ana.gomez@leones.edu', status: 'Pendiente' },
    { id: 'ESC003', name: 'Tigres del Saber', contact: 'Carlos Ruiz', email: 'carlos.ruiz@tigres.edu', status: 'Verificado' },
];

export default function AdminPage() {
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
                    <TableHead>Nombre</TableHead>
                    <TableHead className="hidden md:table-cell">Contacto</TableHead>
                    <TableHead className="hidden md:table-cell">Email</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>
                      <span className="sr-only">Acciones</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schools.map(school => (
                    <TableRow key={school.id}>
                        <TableCell className="font-medium">{school.name}</TableCell>
                        <TableCell className="hidden md:table-cell">{school.contact}</TableCell>
                        <TableCell className="hidden md:table-cell">{school.email}</TableCell>
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
