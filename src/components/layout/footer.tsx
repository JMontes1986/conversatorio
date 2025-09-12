
import Link from "next/link";
import { Instagram, Youtube } from "lucide-react";
import Image from "next/image";

const FacebookIcon = (props: React.ComponentProps<'svg'>) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
);


export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-card border-t mt-auto">
      <div className="container mx-auto px-4 md:px-6 py-6">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center gap-2">
            <Image src="https://mbosvnmhnbrslfwlfcxu.supabase.co/storage/v1/object/public/Software/Logo%20Slogan%20Nuevo%20FINAL-05.png" alt="Logo Colgemelli" width={50} height={50} />
            <span className="font-headline text-lg font-semibold">Conversatorio Colgemelli</span>
          </div>
          <div className="flex gap-4 mt-4 md:mt-0">
             <Link href="https://www.facebook.com/ColegioGemelli" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                <FacebookIcon className="h-6 w-6" />
                <span className="sr-only">Facebook</span>
            </Link>
             <Link href="https://www.instagram.com/colgemelli/" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                <Instagram className="h-6 w-6" />
                <span className="sr-only">Instagram</span>
            </Link>
             <Link href="https://www.youtube.com/@colgemelli" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                <Youtube className="h-6 w-6" />
                <span className="sr-only">YouTube</span>
            </Link>
          </div>
          <p className="text-sm text-muted-foreground mt-4 md:mt-0">
            &copy; {currentYear} Colgemelli. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
