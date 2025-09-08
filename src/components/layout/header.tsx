
"use client";

import Link from "next/link";
import {
  Scale,
  Menu,
  Trophy,
  Users,
  Shield,
  Gavel,
  MessageSquare,
  LogOut,
  KeyRound,
  ClipboardCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/auth-context";
import { useJudgeAuth } from "@/context/judge-auth-context";
import { useModeratorAuth } from "@/context/moderator-auth-context";

const navLinks = [
  { href: "/scoreboard", label: "Marcador", icon: Trophy },
  { href: "/debate", label: "Debate", icon: MessageSquare },
  { href: "/scoring", label: "Puntuación", icon: ClipboardCheck, judge: true },
  { href: "/register", label: "Registro", icon: Users, admin: true },
  { href: "/moderator", label: "Moderar", icon: Gavel, moderator: true },
  { href: "/admin", label: "Admin", icon: Shield, admin: true },
];

export function Header() {
  const pathname = usePathname();
  const { user: adminUser, logout: adminLogout } = useAuth();
  const { judge: judgeUser, logout: judgeLogout } = useJudgeAuth();
  const { moderator: moderatorUser, logout: moderatorLogout } = useModeratorAuth();
  
  const isAuthenticated = adminUser || judgeUser || moderatorUser;

  const handleLogout = () => {
    if (adminUser) adminLogout();
    if (judgeUser) judgeLogout();
    if (moderatorUser) moderatorLogout();
  };

  const filteredNavLinks = navLinks.filter(link => {
    if (link.admin && !adminUser) return false;
    if (link.judge && !judgeUser) return false;
    if (link.moderator && !moderatorUser) return false;
    
    // Hide auth pages if not relevant user
    if(link.href === '/scoring' && !judgeUser) return false;

    // Show link if it's not restricted or if the correct user is logged in
    return !link.admin && !link.judge && !link.moderator || adminUser || judgeUser || moderatorUser;
  }).filter(link => {
    // Further filtering to avoid showing links to logged in users that they shouldn't see
    if (link.href === '/scoring' && !judgeUser) return false;
    return true;
  });

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2">
          <Scale className="h-6 w-6 text-primary" />
          <span className="font-headline text-xl font-bold">
            Conversatorio Colgemelli
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          {filteredNavLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "transition-colors hover:text-primary",
                pathname === link.href ? "text-primary" : "text-muted-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}
          {!isAuthenticated && (
              <>
                 <Link
                    href="/scoring/login"
                    className={cn("transition-colors hover:text-primary flex items-center", pathname === "/scoring/login" ? "text-primary" : "text-muted-foreground")}
                >
                    <ClipboardCheck className="mr-2 h-4 w-4" /> Jurado
                </Link>
                 <Link
                    href="/moderator/login"
                    className={cn("transition-colors hover:text-primary flex items-center", pathname === "/moderator/login" ? "text-primary" : "text-muted-foreground")}
                >
                    <Gavel className="mr-2 h-4 w-4" /> Moderador
                </Link>
                <Link
                    href="/admin/login"
                    className={cn("transition-colors hover:text-primary flex items-center", pathname === "/admin/login" ? "text-primary" : "text-muted-foreground")}
                >
                    <Shield className="mr-2 h-4 w-4" /> Admin
                </Link>
              </>
          )}
           {isAuthenticated && (
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Salir
            </Button>
          )}
        </nav>

        <div className="md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Abrir menú</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <div className="grid gap-4 py-6">
                <Link href="/" className="flex items-center gap-2 mb-4">
                  <Scale className="h-6 w-6 text-primary" />
                  <span className="font-headline text-xl font-bold">
                    Colgemelli
                  </span>
                </Link>
                {filteredNavLinks.map((link) => (
                   <SheetClose asChild key={link.href}>
                    <Link
                      href={link.href}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-lg font-medium transition-all hover:bg-secondary",
                        pathname === link.href ? "bg-secondary text-primary" : "text-muted-foreground"
                      )}
                    >
                      <link.icon className="h-5 w-5" />
                      {link.label}
                    </Link>
                  </SheetClose>
                ))}
                 {!isAuthenticated && (
                   <>
                     <SheetClose asChild>
                       <Link href="/scoring/login" className="flex items-center gap-3 rounded-lg px-3 py-2 text-lg font-medium text-muted-foreground">
                          <ClipboardCheck className="h-5 w-5" /> Jurado
                       </Link>
                    </SheetClose>
                     <SheetClose asChild>
                       <Link href="/moderator/login" className="flex items-center gap-3 rounded-lg px-3 py-2 text-lg font-medium text-muted-foreground">
                          <Gavel className="h-5 w-5" /> Moderador
                       </Link>
                    </SheetClose>
                    <SheetClose asChild>
                       <Link href="/admin/login" className="flex items-center gap-3 rounded-lg px-3 py-2 text-lg font-medium text-muted-foreground">
                          <Shield className="h-5 w-5" /> Admin
                       </Link>
                    </SheetClose>
                   </>
                )}
                {isAuthenticated && (
                  <SheetClose asChild>
                    <Button variant="ghost" onClick={handleLogout} className="flex items-center gap-3 rounded-lg px-3 py-2 text-lg font-medium text-muted-foreground">
                       <LogOut className="h-5 w-5" />
                       Salir
                    </Button>
                  </SheetClose>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

    