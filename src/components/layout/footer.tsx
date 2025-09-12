
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

const TikTokIcon = (props: React.ComponentProps<'svg'>) => (
    <svg
        {...props}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="currentColor"
    >
        <path d="M0 0h24v24H0z" fill="none"/>
        <rect x="3" y="3" width="18" height="18" rx="3" fill="#4A4A4A"/>
        <path d="M14.4 6.71c.06 1.44.59 2.89 1.64 3.91 1.05 1.04 2.53 1.52 4.02 1.68v3.78c-1.35-.05-2.71-.33-3.94-.91-.53-.25-1.03-.55-1.52-.87-.01 2.74.01 5.48-.02 8.21-.07 1.31-.51 2.61-1.27 3.7-1.23 1.8-3.36 2.97-5.55 3-2.28.05-4.54-.89-6.04-2.63-1.5-1.75-2.18-3.94-1.93-6.13.25-2.19 1.45-4.14 3.2-5.28.58-.38 1.2-.68 1.84-.94.02-2.96.02-5.93.01-8.9-.07-1.44.58-2.89 1.64-3.91 1.05-1.04 2.53-1.52 4.02-1.68l.04.02z" transform="scale(0.5) translate(10, 8)" fill="black" />
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
             <Link href="https://www.tiktok.com/@colgemelli" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                <TikTokIcon className="h-6 w-6" />
                <span className="sr-only">TikTok</span>
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
