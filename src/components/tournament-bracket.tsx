
"use client";

import { cn } from "@/lib/utils";
import Image from "next/image";

type Participant = {
  name: string;
  grade: string;
  avatar: string;
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

const bracketData: Round[] = [
  {
    title: "Ronda 1",
    matches: [
      {
        id: 1,
        participants: [
          { name: "Violeta Londoño", grade: "Noveno", avatar: "https://picsum.photos/id/1027/100/100", winner: false },
          { name: "Mariana Cuartas", grade: "Noveno", avatar: "https://picsum.photos/id/1011/100/100", winner: true },
        ],
      },
       {
        id: 2,
        participants: [
            { name: "Miguel Ángel Sánchez", grade: "Undécimo", avatar: "https://picsum.photos/id/1005/100/100", winner: true },
            { name: "Juan Felipe Parra", grade: "Undécimo", avatar: "https://picsum.photos/id/1025/100/100", winner: false },
        ]
      },
      {
        id: 3,
        participants: [
           { name: "María Paula Sánchez", grade: "Décimo", avatar: "https://picsum.photos/id/1012/100/100", winner: false },
           { name: "Isabella Duque", grade: "Décimo", avatar: "https://picsum.photos/id/1013/100/100", winner: true },
        ],
      },
       {
        id: 4,
        participants: [
           { name: "Ilana Ríos", grade: "Noveno", avatar: "https://picsum.photos/id/1014/100/100", winner: true },
           { name: "Natalia Sepulveda", grade: "Noveno", avatar: "https://picsum.photos/id/1015/100/100", winner: false },
        ]
      },
       {
        id: 5,
        participants: [
          { name: "Simón Mendieta", grade: "Décimo", avatar: "https://picsum.photos/id/1016/100/100", winner: true },
          { name: "Daniel A. Cuellar", grade: "Décimo", avatar: "https://picsum.photos/id/1018/100/100", winner: false },
          { name: "Juan A. Naranjo", grade: "Décimo", avatar: "https://picsum.photos/id/1019/100/100", winner: false },
        ],
      },
    ],
  },
  {
    title: "Ronda 2",
    matches: [
      { id: 6, participants: [
        { name: "Mariana Cuartas", grade: "Noveno", avatar: "https://picsum.photos/id/1011/100/100", winner: false },
        { name: "Miguel Ángel Sánchez", grade: "Undécimo", avatar: "https://picsum.photos/id/1005/100/100", winner: true },
      ]},
      { id: 7, participants: [
        { name: "Isabella Duque", grade: "Décimo", avatar: "https://picsum.photos/id/1013/100/100", winner: false },
        { name: "Ilana Ríos", grade: "Noveno", avatar: "https://picsum.photos/id/1014/100/100", winner: true },
      ]},
      { id: 8, participants: [
        { name: "Simón Mendieta", grade: "Décimo", avatar: "https://picsum.photos/id/1016/100/100", winner: true },
        { name: "Daniel A. Cuellar", grade: "Décimo", avatar: "https://picsum.photos/id/1018/100/100", winner: false,  },
        { name: "Juan A. Naranjo", grade: "Décimo", avatar: "https://picsum.photos/id/1019/100/100", winner: false,  },
      ]},
    ],
  },
  {
    title: "Semifinal",
    matches: [
      { id: 9, participants: [
        { name: "Miguel Ángel Sánchez", grade: "Undécimo", avatar: "https://picsum.photos/id/1005/100/100", winner: true },
        { name: "Ilana Ríos", grade: "Noveno", avatar: "https://picsum.photos/id/1014/100/100", winner: false },
      ]},
      { id: 10, participants: [
        { name: "Simón Mendieta", grade: "Décimo", avatar: "https://picsum.photos/id/1016/100/100", winner: true },
      ]
      }
    ],
  },
   {
    title: "Final",
    matches: [
      { id: 11, participants: [
        { name: "Miguel Ángel Sánchez", grade: "Undécimo", avatar: "https://picsum.photos/id/1005/100/100", winner: false },
        { name: "Simón Mendieta", grade: "Décimo", avatar: "https://picsum.photos/id/1016/100/100", winner: true },
      ]},
    ],
  },
];

const ParticipantCard = ({ participant }: { participant: Participant }) => (
    <div className={cn("flex flex-col items-center gap-1 w-28 text-center", !participant.winner && "opacity-60")}>
        <div className="relative h-20 w-20 rounded-full overflow-hidden border-4 border-transparent ring-2 ring-primary">
            <Image
                src={participant.avatar}
                alt={participant.name}
                data-ai-hint="student portrait"
                fill
                className="object-cover"
            />
        </div>
        <div className={cn("w-full py-1 rounded-full text-xs", participant.winner ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground")}>
            <p className="font-bold truncate px-1">{participant.name}</p>
        </div>
        <p className={cn("text-xs font-medium px-2 py-0.5 rounded-full", participant.winner ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground")}>{participant.grade}</p>
    </div>
);


const Connector = ({ from, to }: { from: string, to: string }) => {
  return (
    <svg className="absolute top-0 left-0 w-full h-full pointer-events-none">
      <line x1="0" y1="50%" x2="100%" y2="50%" stroke="#D1D5DB" strokeWidth="2" />
    </svg>
  )
}

export function TournamentBracket() {
  return (
    <div className="bg-card p-4 md:p-8 rounded-lg w-full overflow-x-auto">
        <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground">"¿QUÉ SIGNIFICA SER JOVEN DEL SIGLO XXI?"</h2>
            <p className="text-lg text-muted-foreground">Debate</p>
        </div>
      <div className="flex justify-between items-start min-w-[1200px] gap-8">
        {bracketData.map((round, roundIndex) => (
          <div key={round.title} className="flex flex-col justify-around h-full w-1/4">
            <div className="space-y-16">
              {round.matches.map((match, matchIndex) => (
                <div key={match.id} className="relative flex items-center">
                    <div className="flex flex-col items-center w-full gap-8">
                        <div className="flex justify-around w-full">
                         {match.participants.map((p, pIndex) => (
                            <div key={p.name} className="relative">
                               <ParticipantCard participant={p} />
                            </div>
                         ))}
                        </div>
                    </div>
                   
                    {roundIndex < bracketData.length -1 && (
                      <>
                        {/* Horizontal Line out of the Match */}
                        <div className="absolute top-1/2 -translate-y-1/2 -right-4 h-0.5 w-4 bg-gray-300"></div>

                        {/* Vertical line connecting to next round */}
                        { match.id % 2 !== 0 && (
                             <div 
                                className="absolute top-1/2 -right-4 h-[135%] w-0.5 bg-gray-300" 
                                style={{ 
                                  height: match.participants.length > 2 ? '130%' : '135%'
                                }}
                              ></div>
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

    