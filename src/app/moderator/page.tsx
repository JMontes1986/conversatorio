import { Timer } from "@/components/timer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlayCircle, Video } from "lucide-react";

export default function ModeratorPage() {
  // These values would be dynamic in a real application
  const timerSettings = {
    roundTimer: { duration: 8 * 60, label: "Tiempo de Ronda" }, // 8 minutes
    interventionTimer: { duration: 2 * 60, label: "Intervención" }, // 2 minutes
    questionTimer: { duration: 30, label: "Pregunta" }, // 30 seconds
  };
  
  return (
    <div className="container mx-auto py-10 px-4 md:px-6">
      <div className="mb-8">
        <h1 className="font-headline text-3xl md:text-4xl font-bold">
          Panel de Moderador
        </h1>
        <p className="text-muted-foreground mt-2">
          Gestione la ronda de debate actual en tiempo real.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Pregunta Actual</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-lg font-semibold">
                        "¿Debería la inteligencia artificial tener un papel en las decisiones judiciales para garantizar la imparcialidad?"
                    </p>
                </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-6">
                <Card className="relative overflow-hidden">
                    <CardHeader>
                        <CardTitle>Equipo A: Águilas Doradas</CardTitle>
                    </CardHeader>
                    <CardContent className="aspect-video bg-muted flex items-center justify-center">
                        <div className="text-center text-muted-foreground">
                            <Video className="mx-auto h-12 w-12" />
                            <p>Esperando video</p>
                        </div>
                    </CardContent>
                    <Button size="sm" className="absolute top-4 right-4 gap-2">
                        <PlayCircle className="h-4 w-4" />
                        Iniciar
                    </Button>
                </Card>
                 <Card className="relative overflow-hidden">
                    <CardHeader>
                        <CardTitle>Equipo B: Búhos Sabios</CardTitle>
                    </CardHeader>
                    <CardContent className="aspect-video bg-muted flex items-center justify-center">
                        <div className="text-center text-muted-foreground">
                            <Video className="mx-auto h-12 w-12" />
                            <p>Esperando video</p>
                        </div>
                    </CardContent>
                     <Button size="sm" className="absolute top-4 right-4 gap-2">
                        <PlayCircle className="h-4 w-4" />
                        Iniciar
                    </Button>
                </Card>
            </div>
        </div>

        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline">Temporizadores</CardTitle>
                    <CardDescription>Controle el flujo del debate.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Timer initialTime={timerSettings.roundTimer.duration} title={timerSettings.roundTimer.label} />
                    <Timer initialTime={timerSettings.interventionTimer.duration} title={timerSettings.interventionTimer.label} />
                    <Timer initialTime={timerSettings.questionTimer.duration} title={timerSettings.questionTimer.label} />
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
