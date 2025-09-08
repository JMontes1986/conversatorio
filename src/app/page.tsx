import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  Shuffle,
  UploadCloud,
  Gavel,
  ClipboardCheck,
  Trophy,
  Shield,
} from "lucide-react";

const features = [
  {
    icon: <Users className="h-8 w-8 text-primary" />,
    title: "Registro de Escuelas",
    description: "Inscriba a su escuela en la competencia de manera rápida y sencilla.",
    link: "/register",
  },
  {
    icon: <Shuffle className="h-8 w-8 text-primary" />,
    title: "Sorteo Automático",
    description: "Visualice el sorteo de grupos y eliminatorias con animaciones y aleatoriedad verificable.",
    link: "/draw",
  },
  {
    icon: <UploadCloud className="h-8 w-8 text-primary" />,
    title: "Envío de Video",
    description: "Suba de forma segura las presentaciones de video de su equipo para cada ronda.",
    link: "/upload",
  },
  {
    icon: <Gavel className="h-8 w-8 text-primary" />,
    title: "Panel de Moderador",
    description: "Gestione los debates con controles de video, preguntas y temporizadores.",
    link: "/moderator",
  },
  {
    icon: <ClipboardCheck className="h-8 w-8 text-primary" />,
    title: "Puntuación por Rúbrica",
    description: "Jueces calificarán a los equipos con una rúbrica detallada y configurable.",
    link: "/scoring",
  },
  {
    icon: <Trophy className="h-8 w-8 text-primary" />,
    title: "Marcador en Tiempo Real",
    description: "Siga el progreso de la competencia con un marcador en vivo y brackets actualizados.",
    link: "/scoreboard",
  },
  {
    icon: <Shield className="h-8 w-8 text-primary" />,
    title: "Panel de Administrador",
    description: "Administre todos los aspectos de la competencia, desde escuelas hasta criterios de evaluación.",
    link: "/admin",
  },
];

export default function Home() {
  return (
    <div className="flex flex-col">
      <section className="relative w-full py-20 md:py-32 lg:py-40 bg-card">
        <div className="container mx-auto px-4 md:px-6 text-center">
          <div className="max-w-3xl mx-auto">
            <h1 className="font-headline text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl">
              Conversatorio Colgemelli
            </h1>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              La plataforma definitiva para competencias de debate escolar. Fomentando el pensamiento crítico y la oratoria en la próxima generación de líderes.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Button asChild size="lg">
                <Link href="/register">Registrar Escuela</Link>
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
          <div className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:mx-0 lg:max-w-none lg:grid-cols-3 xl:grid-cols-4">
            {features.map((feature) => (
              <Card key={feature.title} className="hover:shadow-lg transition-shadow duration-300">
                <CardHeader className="flex flex-col items-center text-center">
                  {feature.icon}
                  <CardTitle className="mt-4 font-headline">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                  <p className="text-muted-foreground">{feature.description}</p>
                   <Button variant="link" asChild className="mt-4 text-accent-foreground hover:text-primary">
                    <Link href={feature.link}>
                      Ir a {feature.title.split(' ')[0]}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="w-full py-20 md:py-24 lg:py-32 bg-card">
        <div className="container mx-auto grid items-center gap-8 px-4 md:px-6 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-4">
            <h2 className="font-headline text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Listos para el Debate del Siglo
            </h2>
            <p className="text-muted-foreground md:text-xl/relaxed">
              Nuestra plataforma está diseñada para ser intuitiva para estudiantes, jueces y administradores, permitiendo que todos se concentren en lo que realmente importa: el poder de las ideas.
            </p>
            <p className="text-muted-foreground md:text-xl/relaxed">
              Con características como sorteos auditables y puntuación transparente, garantizamos una competencia equitativa y emocionante para todos los participantes.
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
