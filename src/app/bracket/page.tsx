import type { Metadata } from "next";
import { TournamentBracket } from "@/components/tournament-bracket";

export const metadata: Metadata = {
  title: "Bracket en vivo | Conversatorio Colgemelli",
  description: "Consulta las llaves y el avance de los equipos del torneo en tiempo real.",
};

export default function BracketPage() {
  return (
    <div className="mx-auto w-full max-w-[1920px] px-3 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight md:text-4xl">
          Bracket en vivo
        </h1>
        <p className="mt-2 text-muted-foreground">
          Sigue las llaves y el avance de cada equipo. Los resultados se actualizan automáticamente.
        </p>
      </div>
      <TournamentBracket />
    </div>
  );
}
