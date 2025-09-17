
import type { Metadata } from 'next';
import { Toaster } from "@/components/ui/toaster";
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { AuthProvider } from '@/context/auth-context';
import { JudgeProvider } from '@/context/judge-auth-context';
import { ModeratorProvider } from '@/context/moderator-auth-context';
import './globals.css';
import { inter, spaceGrotesk } from './fonts';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Conversatorio Colgemelli',
  description: 'Plataforma de debate y competencia para colegios.',
  icons: {
    icon: '/favicon.ico',
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SportsEvent",
  "name": "Conversatorio Colgemelli",
  "description": "Plataforma de debate y competencia para colegios.",
  "startDate": "2024-08-17T08:00-05:00",
  "endDate": "2024-08-18T17:00-05:00",
  "eventStatus": "https://schema.org/EventScheduled",
  "location": {
    "@type": "Place",
    "name": "Colegio Bilingüe Padre Francesco Coll",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Panama City",
      "addressCountry": "PA"
    }
  },
  "organizer": {
    "@type": "Organization",
    "name": "Colgemelli",
    "url": "https://conversatorio-colgemelli.web.app"
  }
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={cn("scroll-smooth", inter.variable, spaceGrotesk.variable)}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="font-body antialiased">
         <div style={{
          position: 'fixed',
          top: '0',
          right: '0',
          width: '80px', 
          height: '80px',
          zIndex: 9999,
          overflow: 'hidden'
        }}>
           <div style={{
            position: 'absolute',
            top: '-20px',
            right: '-20px',
            width: '100px',
            height: '100px',
            transform: 'rotate(45deg)',
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="#000000">
                <path d="M 50,0 A 30,30 0 0 0 20,30 L 20,70 L 30,70 L 30,35 A 20,20 0 0 1 50,15 A 20,20 0 0 1 70,35 L 70,70 L 80,70 L 80,30 A 30,30 0 0 0 50,0 z M 20,75 L 80,75 L 50,100 z" />
                 <path d="M25,70 L75,20 L80,25 L30,75z" fill="rgba(255,255,255,0.1)" />
                 <path d="M20,30 L20,70 L30,70 L30,35 A 20,20 0 0 1 50,15 L50,15 A 20,20 0 0 1 70,35 L70,70 L80,70 L80,30 A 30,30 0 0 0 50,0 A 30,30 0 0 0 20,30 M50,100 L20,75 L80,75z" stroke="#333" strokeWidth="1" fill="none" />
            </svg>
          </div>
        </div>
        <AuthProvider>
          <JudgeProvider>
            <ModeratorProvider>
              <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-grow">
                  {children}
                </main>
                <Footer />
              </div>
              <Toaster />
            </ModeratorProvider>
          </JudgeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
