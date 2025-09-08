
"use client";

import { TournamentBracket } from "@/components/tournament-bracket";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ScoreboardPage() {
    return (
        <div className="container mx-auto py-10 px-4 md:px-6">
            <div className="mb-8">
                <h1 className="font-headline text-3xl md:text-4xl font-bold">
                    Marcador de la Competencia
                </h1>
                <p className="text-muted-foreground mt-2">
                    Siga el progreso del torneo en tiempo real.
                </p>
            </div>
            
            <div className="space-y-8">
                <Card>
                    <CardHeader>
                        <CardTitle className="font-headline">Bracket del Torneo</CardTitle>
                        <CardDescription>Visualización de las rondas eliminatorias.</CardDescription>
                    </CardHeader>
                    <CardContent className="w-full overflow-x-auto">
                        <TournamentBracket />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
