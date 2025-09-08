import Link from "next/link";
import { Scale } from "lucide-react";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-card border-t mt-auto">
      <div className="container mx-auto px-4 md:px-6 py-6">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center gap-2">
            <Scale className="h-6 w-6 text-primary" />
            <span className="font-headline text-lg font-semibold">Conversatorio Colgemelli</span>
          </div>
          <p className="text-sm text-muted-foreground mt-4 md:mt-0">
            &copy; {currentYear} Colgemelli. Todos los derechos reservados.
          </p>
          <div className="flex gap-4 mt-4 md:mt-0">
            <Link href="#" className="text-sm text-muted-foreground hover:text-primary">
              Términos de Servicio
            </Link>
            <Link href="#" className="text-sm text-muted-foreground hover:text-primary">
              Política de Privacidad
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
