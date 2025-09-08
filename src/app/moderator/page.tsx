
import { ModeratorAuth } from "@/components/auth/moderator-auth";
import { DebateControlPanel } from "@/components/debate-control-panel";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function ModeratorDashboard() {
    return (
         <div className="container mx-auto py-10 px-4 md:px-6">
            <div className="mb-8">
                <h1 className="font-headline text-3xl md:text-4xl font-bold">
                    Panel de Moderador
                </h1>
                <p className="text-muted-foreground mt-2">
                    Gestione la ronda de debate actual.
                </p>
            </div>
            <DebateControlPanel />
        </div>
    )
}


export default function ModeratorPage() {
    return (
        <ModeratorAuth>
            <ModeratorDashboard />
        </ModeratorAuth>
    );
}

    