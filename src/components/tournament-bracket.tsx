
"use client";

import { cn } from "@/lib/utils";
import Image from "next/image";

type Participant = {
  name: string; // School Name
  avatar: string; // School Logo
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

// MOCK DATA: Represents schools instead of students
const bracketData: Round[] = [
  {
    title: "Ronda 1",
    matches: [
      {
        id: 1,
        participants: [
          { name: "Colegio Isaac Newton", avatar: "https://picsum.photos/id/10/100/100", winner: false },
          { name: "Colegio Albert Einstein", avatar: "https://picsum.photos/id/20/100/100", winner: true },
        ],
      },
       {
        id: 2,
        participants: [
            { name: "Instituto Marie Curie", avatar: "https://picsum.photos/id/30/100/100", winner: true },
            { name: "Academia Galileo Galilei", avatar: "https://picsum.photos/id/40/100/100", winner: false },
        ]
      },
      {
        id: 3,
        participants: [
           { name: "Liceo Leonardo da Vinci", avatar: "https://picsum.photos/id/50/100/100", winner: false },
           { name: "Centro Educativo Copérnico", avatar: "https://picsum.photos/id/60/100/100", winner: true },
        ],
      },
       {
        id: 4,
        participants: [
           { name: "Colegio Pitágoras", avatar: "https://picsum.photos/id/70/100/100", winner: true },
           { name: "Colegio Arquímedes", avatar: "https://picsum.photos/id/80/100/100", winner: false },
        ]
      },
    ],
  },
  {
    title: "Semifinal",
    matches: [
      { id: 5, participants: [
        { name: "Colegio Albert Einstein", avatar: "https://picsum.photos/id/20/100/100", winner: false },
        { name: "Instituto Marie Curie", avatar: "https://picsum.photos/id/30/100/100", winner: true },
      ]},
      { id: 6, participants: [
        { name: "Centro Educativo Copérnico", avatar: "https://picsum.photos/id/60/100/100", winner: false },
        { name: "Colegio Pitágoras", avatar: "https://picsum.photos/id/70/100/100", winner: true },
      ]},
    ],
  },
   {
    title: "Final",
    matches: [
      { id: 7, participants: [
        { name: "Instituto Marie Curie", avatar: "https://picsum.photos/id/30/100/100", winner: true },
        { name: "Colegio Pitágoras", avatar: "https://picsum.photos/id/70/100/100", winner: false },
      ]},
    ],
  },
];

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
