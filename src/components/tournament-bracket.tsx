
"use client";

import { cn } from "@/lib/utils";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy, doc } from "firebase/firestore";

// TYPES
type Participant = {
  name: string;
  avatar: string;
  winner?: boolean;
};

type Match = {
  id: number;
  participants: Participant[];
  roundName: string;
};

type Round = {
  title: string;
  matches: Match[];
};

type RoundData = {
  id: string;
  name: string;
  phase: string;
}

type ScoreData = {
  matchId: string;
  teams: { name: string; total: number }[];
}

type DrawState = {
    activeTab: 'groups' | 'quarters';
    teams: { id: string, name: string, round: string | null }[];
    rounds: RoundData[];
    isFinished?: boolean;
}

// CORE LOGIC
const getWinnerOfMatch = (scores: ScoreData[], roundName: string): Participant | null => {
    const matchScores = scores.filter(s => s.matchId === roundName);
    if (matchScores.length === 0) return null;

    const teamTotals: Record<string, number> = {};
    matchScores.forEach(score => {
        score.teams.forEach(team => {
            if (!teamTotals[team.name]) teamTotals[team.name] = 0;
            teamTotals[team.name] += team.total;
        });
    });
    
    const entries = Object.entries(teamTotals);
    if (entries.length === 0) return null;

    const winnerName = entries.reduce((a, b) => a[1] > b[1] ? a : b)[0];
    
    return { name: winnerName, avatar: `https://picsum.photos/seed/${encodeURIComponent(winnerName)}/200`, winner: true };
};


// UI COMPONENTS
const ParticipantCard = ({ participant }: { participant: Participant }) => {
    if (!participant.name) {
        return (
            <div className="flex flex-col items-center gap-2 w-32 text-center">
                 <div className="relative h-24 w-24 rounded-full overflow-hidden border-4 border-dashed border-gray-300 bg-secondary flex items-center justify-center">
                   <p className="text-xs text-muted-foreground">?</p>
                </div>
                <div className="w-full py-1.5 rounded-md text-sm bg-secondary text-secondary-foreground">
                    <p className="truncate px-1">Por definir</p>
                </div>
            </div>
        );
    }

    return (
        <div className={cn("flex flex-col items-center gap-2 w-32 text-center", participant.winner === false && "opacity-50")}>
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
};


export function TournamentBracket() {
  const [bracketData, setBracketData] = useState<Round[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const scoresQuery = query(collection(db, "scores"), orderBy("createdAt", "desc"));
    const drawStateRef = doc(db, "drawState", "liveDraw");
    
    const unsubDraw = onSnapshot(drawStateRef, drawSnap => {
        const drawData = drawSnap.exists() ? drawSnap.data() as DrawState : null;

        const unsubScores = onSnapshot(scoresQuery, scoresSnap => {
            const allScores = scoresSnap.docs.map(doc => doc.data() as ScoreData);

            // --- Build Bracket Logic ---
            const newBracketData: Round[] = [];
            
            if (drawData && drawData.activeTab === 'quarters' && drawData.teams.every(t => t.round)) {
                
                const quarterFinals: Round = { title: "Cuartos de Final", matches: [] };
                drawData.rounds.forEach((roundInfo, index) => {
                    const participantsInDraw = drawData.teams
                        .filter(t => t.round === roundInfo.name)
                        .map(t => ({ 
                            name: t.name, 
                            avatar: `https://picsum.photos/seed/${encodeURIComponent(t.name)}/200`
                        }));
                    
                    const winner = getWinnerOfMatch(allScores, roundInfo.name);

                    const participantsWithStatus = participantsInDraw.map(p => ({
                        ...p,
                        winner: winner ? p.name === winner.name : undefined,
                    }));

                    quarterFinals.matches.push({
                        id: index,
                        participants: participantsWithStatus,
                        roundName: roundInfo.name
                    });
                });
                newBracketData.push(quarterFinals);
                
                // Build Semifinals
                const semiFinals: Round = { title: "Semifinal", matches: [] };
                const qfWinners = quarterFinals.matches.map(m => getWinnerOfMatch(allScores, m.roundName)).filter(Boolean) as Participant[];
                
                if(qfWinners.length > 0) {
                    for (let i = 0; i < Math.ceil(qfWinners.length / 2); i++) {
                        const matchParticipants = qfWinners.slice(i * 2, i * 2 + 2);
                        const matchRoundName = `Semifinal ${i + 1}`; // Placeholder name
                        
                        const winner = getWinnerOfMatch(allScores, matchRoundName);
                        const participantsWithStatus = matchParticipants.map(p => ({
                            ...p,
                            winner: winner ? p.name === winner.name : undefined,
                        }));

                        semiFinals.matches.push({
                            id: i,
                            participants: participantsWithStatus,
                            roundName: matchRoundName
                        });
                    }
                    newBracketData.push(semiFinals);

                    // Build Final
                    const final: Round = { title: "Final", matches: [] };
                    const semiWinners = semiFinals.matches.map(m => getWinnerOfMatch(allScores, m.roundName)).filter(Boolean) as Participant[];
                    if(semiWinners.length > 0) {
                       const matchRoundName = "Final";
                       const winner = getWinnerOfMatch(allScores, matchRoundName);
                       const participantsWithStatus = semiWinners.map(p => ({
                           ...p,
                           winner: winner ? p.name === winner.name : undefined,
                       }));
                       final.matches.push({ id: 0, participants: participantsWithStatus, roundName: matchRoundName });
                       newBracketData.push(final);
                       
                       // Grand Winner
                       const grandWinnerRound: Round = { title: "Ganador", matches: [] };
                       const grandWinner = getWinnerOfMatch(allScores, "Final");
                       if(grandWinner) {
                           grandWinnerRound.matches.push({
                               id: 0,
                               participants: [grandWinner],
                               roundName: "Ganador"
                           })
                           newBracketData.push(grandWinnerRound);
                       }
                    }
                }
            }

            newBracketData.forEach(round => {
                round.matches.forEach(match => {
                    const hasWinner = match.participants.some(p => p.winner === true);
                    if (hasWinner) {
                        match.participants.forEach(p => {
                            if (p.winner !== true) p.winner = false;
                        });
                    }
                });
            });

            setBracketData(newBracketData);
            setLoading(false);
        });
        return () => unsubScores();
    });
    return () => unsubDraw();
  }, []);


  if (loading) {
    return (
        <div className="bg-card p-4 md:p-8 rounded-lg w-full min-h-[400px] flex justify-center items-center">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="ml-4">Generando bracket del torneo...</p>
        </div>
    )
  }
  
  if (bracketData.length === 0) {
      return (
        <div className="bg-card p-4 md:p-8 rounded-lg w-full min-h-[400px] flex justify-center items-center">
            <div className="text-center">
                 <h2 className="text-2xl font-bold text-foreground">"¿QUÉ SIGNIFICA SER JOVEN DEL SIGLO XXI?"</h2>
                 <p className="text-lg text-muted-foreground mt-2">El bracket aparecerá aquí una vez que se realice el sorteo de Cuartos de Final.</p>
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
      <div className="flex justify-center items-start min-w-[1400px]">
        {bracketData.map((round, roundIndex) => (
          <div key={round.title} className="flex flex-col flex-1">
            <h3 className="text-center font-headline text-xl font-bold mb-8 text-primary uppercase h-10 flex items-center justify-center">{round.title}</h3>
            <div className={cn(
                "flex flex-col flex-grow gap-y-12",
                round.title === "Semifinal" && "justify-around py-20",
                round.title === "Final" && "justify-around py-48",
                round.title === "Ganador" && "justify-around py-48"
            )}>
              {round.matches.map((match, matchIndex) => (
                <div key={match.id} className="relative flex flex-col items-center justify-center">
                    <div className={cn(
                        "flex flex-col items-center w-full gap-4",
                        roundIndex > 0 && "justify-center"
                    )}>
                     {match.participants.map((p, pIndex) => (
                        <div key={p.name || pIndex} className="relative z-10">
                           <ParticipantCard participant={p} />
                        </div>
                     ))}
                     {match.participants.length < 2 && round.title !== 'Ganador' && (
                          <div className="relative z-10">
                           <ParticipantCard participant={{name: '', avatar: ''}} />
                        </div>
                     )}
                    </div>
                   
                    {/* Connecting Lines */}
                    {roundIndex < bracketData.length -1 && round.title !== 'Final' && match.participants.length > 1 && (
                      <>
                        {/* Vertical line connecting pairs */}
                         <div className={cn(
                            "absolute left-1/2 w-0.5 bg-gray-300 z-0",
                            "h-[calc(50%_+_1.5rem)]", // 1.5rem is half of gap-y-12 (3rem)
                            matchIndex % 2 === 0 ? "top-1/2" : "bottom-1/2"
                         )}></div>

                        {/* Horizontal line to next round */}
                        <div className={cn(
                            "absolute top-1/2 -translate-y-1/2 w-[calc(50%_+_1.5rem)] h-0.5 bg-gray-300 z-0",
                             matchIndex % 2 === 0 ? "left-[calc(50%_+_1px)]" : "right-[calc(50%_+_1px)]"
                        )}></div>
                      </>
                    )}
                     {round.title === 'Final' && (
                         <div className="absolute top-1/2 -translate-y-1/2 left-1/2 w-1/2 h-0.5 bg-gray-300 z-0"></div>
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

    