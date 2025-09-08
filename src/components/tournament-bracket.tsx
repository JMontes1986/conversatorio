
"use client";

import { cn } from "@/lib/utils";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";

type Participant = {
  name: string; // School Name
  avatar: string; // School Logo placeholder
  winner?: boolean;
};

type Match = {
  id: number;
  participants: Participant[];
};

type Round = {
  title: string;
  matches: Match[];
};


const ParticipantCard = ({ participant }: { participant: Participant }) => (
    <div className={cn("flex flex-col items-center gap-2 w-32 text-center", !participant.winner && "opacity-50")}>
        <div className="relative h-24 w-24 rounded-full overflow-hidden border-4 border-transparent ring-2 ring-primary bg-secondary">
            <Image
                src={participant.avatar}
                alt={participant.name}
                data-ai-hint="school logo"
                fill
                className="object-cover"
            />
        </div>
        <div className={cn("w-full py-1.5 rounded-md text-sm", participant.winner ? "bg-primary text-primary-foreground font-bold" : "bg-secondary text-secondary-foreground")}>
            <p className="truncate px-1">{participant.name}</p>
        </div>
    </div>
);


export function TournamentBracket() {
  const [bracketData, setBracketData] = useState<Round[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // This is a placeholder for fetching and processing real tournament data.
    // For now, it just shows a loading state.
    // In a real implementation, you would fetch rounds, teams, and scores from Firestore
    // and build the bracket structure.
    
    // Simulating loading
    setTimeout(() => {
        // You would replace this with your data fetching and processing logic
        setBracketData([]); // Start with empty data
        setLoading(false);
    }, 1500);

  }, []);

  if (loading) {
    return (
        <div className="bg-card p-4 md:p-8 rounded-lg w-full min-h-[400px] flex justify-center items-center">
            <Loader2 className="h-8 w-8 animate-spin" />
        </div>
    )
  }
  
  if (bracketData.length === 0) {
      return (
        <div className="bg-card p-4 md:p-8 rounded-lg w-full min-h-[400px] flex justify-center items-center">
            <div className="text-center">
                 <h2 className="text-2xl font-bold text-foreground">"¿QUÉ SIGNIFICA SER JOVEN DEL SIGLO XXI?"</h2>
                 <p className="text-lg text-muted-foreground mt-2">El bracket del torneo aparecerá aquí una vez que comiencen las rondas.</p>
            </div>
        </div>
      )
  }

  return (
    <div className="bg-card p-4 md:p-8 rounded-lg w-full overflow-x-auto">
        <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground">"¿QUÉ SIGNIFICA SER JOVEN DEL SIGLO XXI?"</h2>
            <p className="text-lg text-muted-foreground">Debate Intercolegial</p>
        </div>
      <div className="flex justify-between items-stretch min-w-[1400px] gap-8">
        {bracketData.map((round, roundIndex) => (
          <div key={round.title} className="flex flex-col w-1/4">
            <h3 className="text-center font-headline text-xl font-bold mb-8 text-primary uppercase">{round.title}</h3>
            <div className="flex flex-col justify-around flex-grow space-y-20">
              {round.matches.map((match, matchIndex) => (
                <div key={match.id} className="relative flex items-center justify-center">
                    <div className="flex flex-col items-center w-full gap-12">
                        <div className="flex justify-around w-full items-center">
                         {match.participants.map((p, pIndex) => (
                            <div key={p.name} className="relative">
                               <ParticipantCard participant={p} />
                               {pIndex < match.participants.length -1 && (
                                   <div className="absolute top-1/2 -translate-y-1/2 -right-6 h-0.5 w-6 bg-gray-300"></div>
                               )}
                            </div>
                         ))}
                        </div>
                    </div>
                   
                    {roundIndex < bracketData.length -1 && (
                      <>
                        <div className="absolute top-1/2 -translate-y-1/2 left-1/2 h-0.5 w-[calc(50%_+_2rem)] bg-gray-300 -ml-4"></div>
                        <div className="absolute top-1/2 -translate-y-1/2 -right-4 h-0.5 w-4 bg-gray-300"></div>

                        { match.id % 2 !== 0 && (
                             <div className="absolute top-1/2 -right-4 h-[calc(100%_+_5rem)] w-0.5 bg-gray-300"></div>
                        )}
                      </>
                    )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
