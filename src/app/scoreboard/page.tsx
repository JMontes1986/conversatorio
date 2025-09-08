
"use client";

import { TournamentBracket } from "@/components/tournament-bracket";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldCheck } from "lucide-react";
import Link from "next/link";

const results = [
    { round: "Cuartos de Final", teamA: "Águilas Doradas", scoreA: 3, teamB: "Pumas Analíticos", scoreB: 2, winner: "Águilas Doradas", integrityLink: "#" },
    { round: "Cuartos de Final", teamA: "Leones Intrépidos", scoreA: 1, teamB: "Búhos Sabios", scoreB: 4, winner: "Búhos Sabios", integrityLink: "#" },
    { round: "Semifinales", teamA: "Águilas Doradas", scoreA: 2, teamB: "Búhos Sabios", scoreB: 3, winner: "Búhos Sabios", integrityLink: "#" },
    { round: "Final", teamA: "Búhos Sabios", scoreA: null, teamB: "Tigres del Saber", scoreB: null, winner: "Pendiente", integrityLink: null },
];

export default function ScoreboardPage() {
    return (
        <div className="container mx-auto py-10 px-4 md:px-6">
            <div className="mb-8">
                <h1 className="font-headline text-3xl md:text-4xl font-bold">
                    Marcador de la Competencia
                </h1>
                <p className="text-muted-foreground mt-2">
                    Siga los resultados y el progreso del torneo en tiempo real.
                </p>
            </div>
            
            <div className="space-y-8">
                <Tabs defaultValue="brackets" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 md:w-[300px]">
                        <TabsTrigger value="brackets">Brackets</TabsTrigger>
                        <TabsTrigger value="results">Resultados</TabsTrigger>
                    </TabsList>
                    <TabsContent value="brackets" className="mt-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="font-headline">Bracket del Torneo</CardTitle>
                                <CardDescription>Visualización de las rondas eliminatorias.</CardDescription>
                            </CardHeader>
                            <CardContent className="w-full overflow-x-auto">
                                <TournamentBracket />
                            </CardContent>
                        </Card>
                    </TabsContent>
                    <TabsContent value="results" className="mt-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="font-headline">Resultados de Partidas</CardTitle>
                                <CardDescription>Resumen de todos los enfrentamientos completados.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Ronda</TableHead>
                                            <TableHead>Equipo A</TableHead>
                                            <TableHead>Resultado</TableHead>
                                            <TableHead>Equipo B</TableHead>
                                            <TableHead className="text-center">Ganador</TableHead>
                                            <TableHead className="text-right">Integridad</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {results.map((result, index) => (
                                            <TableRow key={index}>
                                                <TableCell>{result.round}</TableCell>
                                                <TableCell className="font-medium">{result.teamA}</TableCell>
                                                <TableCell className="font-mono text-center">
                                                    {result.scoreA !== null ? `${result.scoreA} - ${result.scoreB}` : 'vs'}
                                                </TableCell>
                                                <TableCell className="font-medium">{result.teamB}</TableCell>
                                                <TableCell className="text-center">
                                                    <Badge variant={result.winner === 'Pendiente' ? 'secondary' : 'default'}>{result.winner}</Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {result.integrityLink ? (
                                                        <Link href={result.integrityLink} title="Ver prueba en Blockchain">
                                                            <ShieldCheck className="h-5 w-5 text-green-600 inline" />
                                                        </Link>
                                                    ) : (
                                                        <span className="text-muted-foreground text-xs">N/A</span>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
