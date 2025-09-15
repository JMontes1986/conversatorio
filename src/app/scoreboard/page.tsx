
"use client";

import { TournamentBracket } from "@/components/tournament-bracket";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GroupStageResults } from "@/components/group-stage-results";
import { KnockoutStageResults } from "@/components/knockout-stage-results";
import { FinalResultCard } from "@/components/final-result-card";
import { OctavosStageResults } from "@/components/octavos-stage-results";

export default function ScoreboardPage() {
    return (
        <div className="container mx-auto py-10 px-4 md:px-6">
            <div className="mb-8">
                <h1 className="font-headline text-3xl md:text-4xl font-bold">
                    Marcador de la Competencia
                </h1>
                <p className="text-muted-foreground mt-2">
                    Siga el progreso del torneo en tiempo real, desde la fase de grupos hasta la final.
                </p>
            </div>
            
            <div className="space-y-8">
                 <Card>
                    <CardHeader>
                        <CardTitle className="font-headline">Resultados de la Fase de Grupos</CardTitle>
                        <CardDescription>Puntuaciones de las rondas iniciales.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <GroupStageResults />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="font-headline">Resultados de Octavos de Final</CardTitle>
                        <CardDescription>Puntuaciones de las primeras rondas eliminatorias.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <OctavosStageResults />
                    </CardContent>
                </Card>

                 <Card>
                    <CardHeader>
                        <CardTitle className="font-headline">Resultados Fase de Finales</CardTitle>
                        <CardDescription>Puntuaciones de Cuartos, Semifinales y Final.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <KnockoutStageResults />
                    </CardContent>
                </Card>

                <FinalResultCard />
                
                <TournamentBracket />

            </div>
        </div>
    );
}
