
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
    Trophy,
    PanelLeftClose,
    PanelRightClose
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { Separator } from "./ui/separator";

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
    isCollapsed: boolean;
    setIsCollapsed: (collapsed: boolean) => void;
    activeView: string;
    setActiveView: (view: string) => void;
}

export function AdminNav({ isCollapsed, setIsCollapsed, activeView, setActiveView }: AdminNavProps) {
    const NavLink = ({ item }: { item: typeof navItems[0] }) => {
        const linkContent = (
            <>
                <item.icon className={cn("shrink-0", isCollapsed ? "h-5 w-5" : "h-4 w-4")} />
                <span className={cn("truncate", isCollapsed && "hidden")}>{item.label}</span>
            </>
        );

        if (isCollapsed) {
            return (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant={activeView === item.id ? "secondary" : "ghost"}
                            className={cn("justify-center", activeView === item.id && "font-bold")}
                            size="icon"
                            onClick={() => setActiveView(item.id)}
                        >
                            {linkContent}
                            <span className="sr-only">{item.label}</span>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                        <p>{item.label}</p>
                    </TooltipContent>
                </Tooltip>
            );
        }

        return (
            <Button
                variant={activeView === item.id ? "secondary" : "ghost"}
                className={cn("justify-start", activeView === item.id && "font-bold")}
                onClick={() => setActiveView(item.id)}
            >
                {linkContent}
            </Button>
        );
    };

    return (
        <TooltipProvider delayDuration={0}>
            <nav className="flex flex-col gap-4 h-full">
                <div className="flex-grow flex flex-col gap-1">
                    {navItems.map((item) => (
                        <NavLink key={item.id} item={item} />
                    ))}
                    
                    <Separator className={cn("my-4", isCollapsed && "my-2")} />

                    {!isCollapsed && (
                         <h3 className="px-4 text-xs font-semibold text-muted-foreground tracking-wider uppercase mb-2">
                            Ajustes
                        </h3>
                    )}
                    {settingsNavItems.map((item) => (
                        <NavLink key={item.id} item={item} />
                    ))}
                </div>
                 <div className="mt-auto">
                    <Separator className="my-2" />
                     <Button
                        variant="ghost"
                        className={cn("w-full", isCollapsed ? "justify-center" : "justify-start")}
                        size={isCollapsed ? 'icon' : 'default'}
                        onClick={() => setIsCollapsed(!isCollapsed)}
                    >
                         {isCollapsed ? <PanelRightClose /> : <PanelLeftClose />}
                         <span className={cn("ml-2", isCollapsed && "hidden")}>Colapsar</span>
                         <span className="sr-only">{isCollapsed ? 'Expandir' : 'Colapsar'}</span>
                    </Button>
                </div>
            </nav>
        </TooltipProvider>
    );
}
