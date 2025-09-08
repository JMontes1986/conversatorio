

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

const navLinks = [
  { href: "/scoreboard", label: "Marcador", icon: Trophy },
  { href: "/debate", label: "Debate", icon: MessageSquare },
  { href: "/register", label: "Registro", icon: Users, private: true },
  { href: "/moderator", label: "Moderar", icon: Gavel, private: true },
  { href: "/admin", label: "Admin", icon: Shield, private: false }, // Changed private to false
];

export function Header() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const filteredNavLinks = navLinks.filter(link => !link.private || (link.private && user));

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
           {user && (
            <Button variant="ghost" size="sm" onClick={logout}>
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
                {user && (
                  <SheetClose asChild>
                    <Button variant="ghost" onClick={logout} className="flex items-center gap-3 rounded-lg px-3 py-2 text-lg font-medium text-muted-foreground">
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
