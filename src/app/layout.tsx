
import type { Metadata } from 'next';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/context/auth-context';
import { JudgeProvider } from '@/context/judge-auth-context';
import { ModeratorProvider } from '@/context/moderator-auth-context';
import './globals.css';
import { inter, spaceGrotesk } from './fonts';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { ThankYouPage } from '@/components/thank-you-page';

export const metadata: Metadata = {
  title: 'Conversatorio Colgemelli - ¡Gracias por Participar!',
  description: 'El Conversatorio Colgemelli ha concluido. Agradecemos a todos los participantes, jurados y moderadores.',
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
      <body className="font-body antialiased">
        <AuthProvider>
          <JudgeProvider>
            <ModeratorProvider>
                <ThankYouPage />
              <Toaster />
            </ModeratorProvider>
          </JudgeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
