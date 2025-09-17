
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
          top: 0,
          right: 0,
          width: 0,
          height: 0,
          borderStyle: 'solid',
          borderWidth: '0 60px 60px 0',
          borderColor: 'transparent #000 transparent transparent',
          zIndex: 9999,
        }}></div>
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
