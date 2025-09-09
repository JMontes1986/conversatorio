

"use client";

import { useState, useEffect } from 'react';
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  Shuffle,
  Gavel,
  ClipboardCheck,
  Trophy,
  Loader2,
  Icon as LucideIcon,
  Home as HomeIcon,
  Monitor,
  Calendar,
  Shield,
  Star,
} from "lucide-react";
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

interface Feature {
  id: string;
  icon: string;
  title: string;
  description: string;
  link: string;
}

interface HomePageContent {
  hero: {
    title: string;
    subtitle: string;
  };
  features: Feature[];
  promoSection: {
    title: string;
    paragraph1: string;
    paragraph2: string;
  };
}

const iconMap: { [key: string]: LucideIcon } = {
  Users: Users,
  Shuffle: Shuffle,
  Gavel: Gavel,
  ClipboardCheck: ClipboardCheck,
  Trophy: Trophy,
  Home: HomeIcon,
  Monitor: Monitor,
  Calendar: Calendar,
  Shield: Shield,
  Star: Star,
  Default: HomeIcon,
};

const getIcon = (iconName: string) => {
    return iconMap[iconName] || iconMap.Default;
}

export default function Home() {
    const [content, setContent] = useState<HomePageContent | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const docRef = doc(db, 'siteContent', 'home');
        const unsubscribe = onSnapshot(docRef, (doc) => {
            if (doc.exists()) {
                setContent(doc.data() as HomePageContent);
            } else {
                // Set default content if nothing in DB
                setContent({
                    hero: { title: "Conversatorio Colgemelli", subtitle: "La plataforma definitiva para competencias de debate escolar." },
                    features: [],
                    promoSection: { title: "Listos para el Debate del Siglo", paragraph1: "Nuestra plataforma está diseñada para ser intuitiva.", paragraph2: "Garantizamos una competencia equitativa."}
                })
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    if (loading || !content) {
        return (
            <div className="flex justify-center items-center h-screen">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
            </div>
        );
    }

  return (
    <div className="flex flex-col">
      <section className="relative w-full py-20 md:py-32 lg:py-40 bg-card">
        <div className="container mx-auto px-4 md:px-6 text-center">
          <div className="max-w-3xl mx-auto">
            <h1 className="font-headline text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl">
              {content.hero.title}
            </h1>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              {content.hero.subtitle}
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Button asChild size="lg">
                <Link href="/register">Registrar Colegio</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/scoreboard">Ver Marcador</Link>
              </Button>
            </div>
          </div>
        </div>
        <div className="absolute inset-0 -z-10 h-full w-full bg-background [mask-image:radial-gradient(100%_100%_at_top_right,white,transparent)]"></div>
      </section>

      <section id="features" className="w-full py-20 md:py-24 lg:py-32">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="font-headline text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Características Principales
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Todo lo que necesita para una competencia de debate justa, transparente y emocionante.
            </p>
          </div>
          <div className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:mx-0 lg:max-w-none lg:grid-cols-3">
            {content.features.map((feature) => {
                const Icon = getIcon(feature.icon);
                return (
                    <Card key={feature.id} className="hover:shadow-lg transition-shadow duration-300">
                        <CardHeader className="flex flex-col items-center text-center">
                        <Icon className="h-8 w-8 text-primary" />
                        <CardTitle className="mt-4 font-headline">{feature.title}</CardTitle>
                        </CardHeader>
                        <CardContent className="text-center">
                        <p className="text-muted-foreground">{feature.description}</p>
                        <Button variant="link" asChild className="mt-4 text-primary">
                            <Link href={feature.link}>
                            Ir a {feature.title.split(' ')[0]}
                            </Link>
                        </Button>
                        </CardContent>
                    </Card>
                )
            })}
          </div>
        </div>
      </section>

      <section className="w-full py-20 md:py-24 lg:py-32 bg-card">
        <div className="container mx-auto grid items-center gap-8 px-4 md:px-6 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-4">
            <h2 className="font-headline text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {content.promoSection.title}
            </h2>
            <p className="text-muted-foreground md:text-xl/relaxed">
              {content.promoSection.paragraph1}
            </p>
            <p className="text-muted-foreground md:text-xl/relaxed">
              {content.promoSection.paragraph2}
            </p>
            <div className="flex flex-col gap-2 min-[400px]:flex-row">
              <Button asChild size="lg">
                <Link href="/register">Únete a la Competencia</Link>
              </Button>
            </div>
          </div>
          <div className="relative h-[300px] w-full md:h-[400px] lg:h-[500px]">
             <Image
              src="https://picsum.photos/600/500"
              alt="Estudiantes debatiendo"
              data-ai-hint="students debating"
              fill
              className="rounded-lg object-cover shadow-2xl"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
