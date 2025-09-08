"use client";

import { useState } from "react";
import { Timer } from "@/components/timer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlayCircle, Video, Settings } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

interface TimerSettings {
    duration: number;
    label: string;
}

const EditableTimer = ({ setting, onUpdate }: { setting: TimerSettings, onUpdate: (newDuration: number) => void }) => {
    const [minutes, setMinutes] = useState(Math.floor(setting.duration / 60));
    const [seconds, setSeconds] = useState(setting.duration % 60);

    const handleUpdate = () => {
        const newDuration = (minutes * 60) + seconds;
        onUpdate(newDuration);
    };

    return (
        <div className="space-y-4">
            <Timer initialTime={setting.duration} title={setting.label} />
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full gap-2">
                        <Settings className="h-4 w-4" /> Editar Tiempo
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-60">
                    <div className="grid gap-4">
                        <div className="space-y-2">
                            <h4 className="font-medium leading-none">{setting.label}</h4>
                            <p className="text-sm text-muted-foreground">
                                Ajuste los minutos y segundos.
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <Label htmlFor="minutes">Minutos</Label>
                                <Input
                                    id="minutes"
                                    type="number"
                                    value={minutes}
                                    onChange={(e) => setMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                                    className="h-8"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="seconds">Segundos</Label>
                                <Input
                                    id="seconds"
                                    type="number"
                                    value={seconds}
                                    onChange={(e) => setSeconds(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                                    className="h-8"
                                />
                            </div>
                        </div>
                         <Button onClick={handleUpdate} size="sm">Actualizar</Button>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
};


export default function ModeratorPage() {
    const [timerSettings, setTimerSettings] = useState({
        roundTimer: { duration: 8 * 60, label: "Tiempo de Ronda" },
        interventionTimer: { duration: 2 * 60, label: "Intervención" },
        questionTimer: { duration: 30, label: "Pregunta" },
    });

    const updateTimer = (timerKey: keyof typeof timerSettings, newDuration: number) => {
        setTimerSettings(prev => ({
            ...prev,
            [timerKey]: { ...prev[timerKey], duration: newDuration }
        }));
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
                        <CardContent className="space-y-6">
                             <EditableTimer setting={timerSettings.roundTimer} onUpdate={(d) => updateTimer('roundTimer', d)} />
                             <EditableTimer setting={timerSettings.interventionTimer} onUpdate={(d) => updateTimer('interventionTimer', d)} />
                             <EditableTimer setting={timerSettings.questionTimer} onUpdate={(d) => updateTimer('questionTimer', d)} />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}