

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
    PanelRightClose,
    Menu,
    ShieldAlert,
    LayoutDashboard
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { Separator } from "./ui/separator";
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "./ui/sheet";
import React from "react";

const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
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
    { id: "logs", label: "Logs", icon: ShieldAlert },
    { id: "settings", label: "Ajustes Generales", icon: Settings },
];

interface AdminNavProps {
    isCollapsed: boolean;
    setIsCollapsed: (collapsed: boolean) => void;
    activeView: string;
    setActiveView: (view: string) => void;
}

const NavLink = ({ item, activeView, setActiveView, isCollapsed }: { item: typeof navItems[0], activeView: string, setActiveView: (view: string) => void, isCollapsed: boolean }) => {
    const linkContent = (
        <>
            <item.icon className={cn("shrink-0", isCollapsed ? "h-5 w-5" : "h-4 w-4")} />
            <span className={cn("truncate", isCollapsed && "hidden")}>{item.label}</span>
        </>
    );

    const buttonProps = {
        variant: activeView === item.id ? "secondary" : "ghost" as const,
        className: cn("w-full", !isCollapsed && "justify-start", activeView === item.id && "font-bold"),
        onClick: () => setActiveView(item.id),
    };

    if (isCollapsed) {
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button {...buttonProps} size="icon">
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
        <Button {...buttonProps}>
            {linkContent}
        </Button>
    );
};

const MobileNav = ({ activeView, setActiveView }: { activeView: string, setActiveView: (view: string) => void }) => {
    return (
        <Sheet>
            <SheetTrigger asChild>
                <Button variant="outline" size="icon">
                    <Menu className="h-6 w-6" />
                    <span className="sr-only">Abrir Menú</span>
                </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-4">
                 <h2 className="text-lg font-semibold mb-4 px-2">Admin</h2>
                 <nav className="flex flex-col gap-1">
                    {navItems.map((item) => (
                        <SheetClose asChild key={item.id}>
                            <Button
                                variant={activeView === item.id ? "secondary" : "ghost"}
                                className="justify-start"
                                onClick={() => setActiveView(item.id)}
                            >
                                <item.icon className="mr-2 h-4 w-4" />
                                {item.label}
                            </Button>
                        </SheetClose>
                    ))}
                    <Separator className="my-2" />
                     <h3 className="px-2 text-xs font-semibold text-muted-foreground tracking-wider uppercase mb-2">
                        Ajustes
                    </h3>
                     {settingsNavItems.map((item) => (
                         <SheetClose asChild key={item.id}>
                            <Button
                                variant={activeView === item.id ? "secondary" : "ghost"}
                                className="justify-start"
                                onClick={() => setActiveView(item.id)}
                            >
                                <item.icon className="mr-2 h-4 w-4" />
                                {item.label}
                            </Button>
                        </SheetClose>
                    ))}
                 </nav>
            </SheetContent>
        </Sheet>
    )
}


export function AdminNav({ isCollapsed, setIsCollapsed, activeView, setActiveView }: AdminNavProps) {
    return (
        <>
            {/* Mobile Nav */}
            <header className="md:hidden sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b p-2 flex justify-between items-center">
                 <h1 className="font-bold text-lg">Panel de Administrador</h1>
                <MobileNav activeView={activeView} setActiveView={setActiveView} />
            </header>

            {/* Desktop Nav */}
            <aside className={cn(
                "hidden md:flex flex-col gap-4 h-full p-2 border-r bg-background",
                isCollapsed ? "w-[70px]" : "w-[220px] lg:w-[280px]"
            )}>
                 <TooltipProvider delayDuration={0}>
                    <div className={cn("flex h-9 items-center", isCollapsed ? 'justify-center' : 'justify-between')}>
                        {!isCollapsed && <span className="font-bold text-lg px-2">Admin</span>}
                        <Button
                            variant="ghost"
                            size='icon'
                            className="h-9 w-9"
                            onClick={() => setIsCollapsed(!isCollapsed)}
                        >
                            {isCollapsed ? <PanelRightClose /> : <PanelLeftClose />}
                            <span className="sr-only">{isCollapsed ? 'Expandir' : 'Colapsar'}</span>
                        </Button>
                    </div>
                    <Separator />
                    <div className="flex-grow flex flex-col gap-1">
                        {navItems.map((item) => (
                            <NavLink key={item.id} item={item} activeView={activeView} setActiveView={setActiveView} isCollapsed={isCollapsed}/>
                        ))}
                        
                        <Separator className={cn("my-4", isCollapsed && "my-2")} />

                        {!isCollapsed && (
                            <h3 className="px-4 text-xs font-semibold text-muted-foreground tracking-wider uppercase mb-2">
                                Ajustes
                            </h3>
                        )}
                        {settingsNavItems.map((item) => (
                           <NavLink key={item.id} item={item} activeView={activeView} setActiveView={setActiveView} isCollapsed={isCollapsed}/>
                        ))}
                    </div>
                 </TooltipProvider>
            </aside>
        </>
    );
}
