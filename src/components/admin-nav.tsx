
"use client";

import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { 
    Home, 
    Calendar, 
    School, 
    Swords, 
    Projector, 
    ListChecks, 
    Shuffle, 
    FileQuestion, 
    Settings, 
    User, 
    KeyRound, 
    Gavel, 
    Trophy 
} from "lucide-react";

const navItems = [
    { id: "home", label: "Home", icon: Home },
    { id: "schedule", label: "Programación", icon: Calendar },
    { id: "schools", label: "Colegios", icon: School },
    { id: "rounds", label: "Rondas", icon: Swords },
    { id: "bracket", label: "Bracket", icon: Projector },
    { id: "rubric", label: "Rúbrica", icon: ListChecks },
    { id: "draw", label: "Sorteo", icon: Shuffle },
    { id: "survey", label: "Encuesta", icon: FileQuestion },
    { id: "debate-control", label: "Control del Debate", icon: Gavel },
    { id: "results", label: "Resultados", icon: Trophy },
];

const settingsNavItems = [
    { id: "judges", label: "Jurados", icon: User },
    { id: "moderators", label: "Moderadores", icon: KeyRound },
    { id: "settings", label: "Ajustes Generales", icon: Settings },
];

interface AdminNavProps {
    activeView: string;
    setActiveView: (view: string) => void;
}

export function AdminNav({ activeView, setActiveView }: AdminNavProps) {
    return (
        <nav className="flex flex-col gap-4">
             <div className="flex flex-col gap-1">
                {navItems.map((item) => (
                    <Button
                        key={item.id}
                        variant={activeView === item.id ? "secondary" : "ghost"}
                        className={cn(
                            "justify-start",
                            activeView === item.id && "font-bold"
                        )}
                        onClick={() => setActiveView(item.id)}
                    >
                        <item.icon className="mr-2 h-4 w-4" />
                        {item.label}
                    </Button>
                ))}
            </div>
             <div className="flex flex-col gap-1">
                 <h3 className="px-4 text-xs font-semibold text-muted-foreground tracking-wider uppercase mt-4 mb-2">
                    Ajustes de Usuarios y Competencia
                </h3>
                {settingsNavItems.map((item) => (
                    <Button
                        key={item.id}
                        variant={activeView === item.id ? "secondary" : "ghost"}
                        className={cn(
                            "justify-start",
                            activeView === item.id && "font-bold"
                        )}
                        onClick={() => setActiveView(item.id)}
                    >
                        <item.icon className="mr-2 h-4 w-4" />
                        {item.label}
                    </Button>
                ))}
            </div>
        </nav>
    );
}

