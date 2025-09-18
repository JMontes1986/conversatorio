
import type { Metadata } from 'next';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/context/auth-context';
import { JudgeProvider } from '@/context/judge-auth-context';
import { ModeratorProvider } from '@/context/moderator-auth-context';
import './globals.css';
import { inter, spaceGrotesk } from './fonts';
import { cn } from '@/lib/utils';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';

export const metadata: Metadata = {
  title: 'Conversatorio Colgemelli - Plataforma de Debate',
  description: 'Plataforma integral para la gestión de la competencia de debate intercolegial "Conversatorio Colgemelli".',
  icons: {
    icon: '/favicon.ico',
  },
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={cn("scroll-smooth", inter.variable, spaceGrotesk.variable)}>
      <body className="font-body antialiased flex flex-col min-h-screen">
        <AuthProvider>
          <JudgeProvider>
            <ModeratorProvider>
              <Header />
              <main className="flex-grow">
                {children}
              </main>
              <Footer />
              <Toaster />
            </ModeratorProvider>
          </JudgeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
