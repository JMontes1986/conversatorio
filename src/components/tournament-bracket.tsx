
"use client";

import { cn } from "@/lib/utils";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";

// TYPES
type Participant = {
  name: string;
  avatar: string;
  winner?: boolean;
  score?: number;
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


// CORE LOGIC
const getWinnerOfMatch = (scores: ScoreData[], matchName: string): string | null => {
    const matchScores = scores.filter(s => s.matchId === matchName);
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
    if (entries.length === 1) return entries[0][0];

    return entries.reduce((a, b) => a[1] > b[1] ? a : b)[0];
};

const getTopTeamsFromGroupPhase = (scores: ScoreData[], rounds: RoundData[], limit: number): Participant[] => {
    const groupPhaseRoundNames = rounds.filter(r => r.phase === "Fase de Grupos").map(r => r.name);
    const phaseScores = scores.filter(s => groupPhaseRoundNames.includes(s.matchId));

    const teamTotals: Record<string, number> = {};
    phaseScores.forEach(score => {
        score.teams.forEach(team => {
            if (!teamTotals[team.name]) teamTotals[team.name] = 0;
            teamTotals[team.name] += team.total;
        });
    });

    return Object.entries(teamTotals)
        .sort(([, scoreA], [, scoreB]) => scoreB - scoreA)
        .slice(0, limit)
        .map(([teamName, totalScore]) => ({
            name: teamName,
            avatar: `https://picsum.photos/seed/${encodeURIComponent(teamName)}/200`,
            score: totalScore
        }));
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
};


export function TournamentBracket() {
  const [bracketData, setBracketData] = useState<Round[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const roundsQuery = query(collection(db, "rounds"), orderBy("createdAt", "asc"));
    const scoresQuery = query(collection(db, "scores"), orderBy("createdAt", "desc"));
    
    const unsubRounds = onSnapshot(roundsQuery, roundsSnap => {
        const allRounds = roundsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as RoundData));
        
        const unsubScores = onSnapshot(scoresQuery, scoresSnap => {
            const allScores = scoresSnap.docs.map(doc => doc.data() as ScoreData);

            // --- Build Bracket Logic ---
            const newBracketData: Round[] = [];
            const knockoutPhases = ["Cuartos de Final", "Semifinal", "Final", "Ganador"];

            let previousPhaseWinners: Participant[] = getTopTeamsFromGroupPhase(allScores, allRounds, 8);
            
            if (previousPhaseWinners.length < 8) {
                // Pad with empty participants if not enough teams have qualified yet
                previousPhaseWinners = [...previousPhaseWinners, ...Array(8 - previousPhaseWinners.length).fill({name: '', avatar: ''})];
            }


            knockoutPhases.forEach((phaseName) => {
                const phaseRoundsData = allRounds.filter(r => r.phase === phaseName);
                const round: Round = { title: phaseName, matches: [] };
                
                if (phaseName === "Cuartos de Final") {
                    const pairings = [
                        [previousPhaseWinners[0], previousPhaseWinners[7]],
                        [previousPhaseWinners[3], previousPhaseWinners[4]],
                        [previousPhaseWinners[1], previousPhaseWinners[6]],
                        [previousPhaseWinners[2], previousPhaseWinners[5]],
                    ];

                    for (let i = 0; i < pairings.length; i++) {
                        const matchRoundName = phaseRoundsData[i]?.name || `${phaseName} ${i + 1}`;
                        const participants = pairings[i];
                        
                        const winnerName = getWinnerOfMatch(allScores, matchRoundName);
                        if(winnerName) {
                            participants.forEach(p => { if (p.name === winnerName) p.winner = true; });
                        }
                        round.matches.push({ id: i, participants, roundName: matchRoundName });
                    }
                } else if (phaseName === "Semifinal" || phaseName === "Final") {
                     const winnersFromPreviousRound = newBracketData[newBracketData.length - 1].matches
                        .map(m => m.participants.find(p => p.winner))
                        .filter((p): p is Participant => !!p?.name);

                     for (let i = 0; i < winnersFromPreviousRound.length / 2; i++) {
                         const matchRoundName = phaseRoundsData[i]?.name || `${phaseName} ${i + 1}`;
                         let participants = winnersFromPreviousRound.slice(i * 2, i * 2 + 2);
                         while(participants.length < 2) participants.push({name: '', avatar: ''});

                         const winnerName = getWinnerOfMatch(allScores, matchRoundName);
                         if(winnerName) {
                             participants.forEach(p => { if (p.name === winnerName) p.winner = true; });
                         }
                         round.matches.push({ id: i, participants, roundName: matchRoundName });
                     }
                } else { // Ganador
                    const finalWinner = newBracketData[newBracketData.length - 1]?.matches[0]?.participants.find(p => p.winner);
                    if(finalWinner) {
                        round.matches.push({ id: 0, participants: [{...finalWinner, winner: true}], roundName: "Ganador" })
                    }
                }

                if (round.matches.length > 0) {
                    newBracketData.push(round);
                }
            });

            setBracketData(newBracketData);
            setLoading(false);
        });
        return () => unsubScores();
    });
    return () => unsubRounds();
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
                 <p className="text-lg text-muted-foreground mt-2">El bracket aparecerá aquí una vez que los equipos clasifiquen de la fase de grupos.</p>
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
            <div className="flex flex-col justify-around flex-grow gap-y-12">
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
                    </div>
                   
                    {/* Connecting Lines */}
                    {roundIndex < bracketData.length -1 && match.participants.length > 1 && (
                      <>
                        {/* Horizontal line from match */}
                        <div className="absolute top-1/2 -translate-y-1/2 left-[calc(50%_-_1px)] w-1/2 h-0.5 bg-gray-300 z-0"></div>
                        
                        {/* Vertical line connecting pairs */}
                         <div className={cn(
                            "absolute left-1/2 w-0.5 bg-gray-300 z-0",
                            "h-[calc(50%_+1.5rem)]", // 1.5rem is gap-y-12 / 2
                            matchIndex % 2 === 0 ? "top-1/2" : "bottom-1/2"
                         )}></div>

                        {/* Horizontal line to next round */}
                        <div className={cn(
                            "absolute top-1/2 -translate-y-1/2 w-[calc(50%_+_1.5rem)] h-0.5 bg-gray-300 z-0",
                             matchIndex % 2 === 0 ? "left-[calc(50%_+_1px)]" : "right-[calc(50%_+_1px)]"
                        )}></div>
                      </>
                    )}
                     {roundIndex === 2 && ( // Final round
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
