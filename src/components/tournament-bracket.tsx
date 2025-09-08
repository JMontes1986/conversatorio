
"use client";

import { cn } from "@/lib/utils";
import Image from "next/image";
import { Loader2, Swords, Trophy } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy, doc } from "firebase/firestore";

// TYPES
type Participant = {
  name: string;
  avatar: string;
  winner?: boolean;
  score?: number;
};

type Match = {
  id: string; // Use round name as ID
  participants: Participant[];
};

type BracketRound = {
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
    teams: { id: string, name: string, round: string | null }[];
    rounds: RoundData[];
}

// CORE LOGIC
const getMatchResult = (scores: ScoreData[], matchId: string): { winner: Participant | null, participants: Participant[] } => {
    const matchScores = scores.filter(s => s.matchId === matchId);
    if (matchScores.length === 0) return { winner: null, participants: [] };

    const teamTotals: Record<string, number> = {};
    matchScores.forEach(score => {
        score.teams.forEach(team => {
            if (!teamTotals[team.name]) teamTotals[team.name] = 0;
            teamTotals[team.name] += team.total;
        });
    });
    
    const entries = Object.entries(teamTotals);
    if (entries.length === 0) return { winner: null, participants: [] };

    const winnerEntry = entries.reduce((a, b) => a[1] > b[1] ? a : b);
    const winnerName = winnerEntry[0];
    
    const participants = entries.map(([name, total]) => ({
        name: name,
        avatar: `https://picsum.photos/seed/${encodeURIComponent(name)}/200`,
        score: total,
        winner: name === winnerName
    }));

    const winner = participants.find(p => p.winner);

    // Mark loser
    participants.forEach(p => {
      if (p.name !== winnerName) p.winner = false;
    });

    return { winner: winner || null, participants };
};


// UI COMPONENTS
const ParticipantCard = ({ participant, showScore }: { participant: Participant, showScore: boolean }) => {
    if (!participant.name) {
        return (
            <div className="flex items-center gap-2 w-40 text-sm h-10 px-2 bg-secondary rounded-md">
                <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs">?</div>
                <p className="truncate text-muted-foreground">Por definir</p>
            </div>
        );
    }

    return (
        <div className={cn("flex items-center gap-2 w-40 text-sm h-10 px-2 rounded-md", participant.winner ? "bg-primary text-primary-foreground font-bold" : "bg-secondary text-secondary-foreground", participant.winner === false && "opacity-50")}>
            <div className="relative h-6 w-6 rounded-full overflow-hidden bg-muted shrink-0">
                <Image
                    src={participant.avatar}
                    alt={participant.name}
                    data-ai-hint="school logo"
                    fill
                    className="object-cover"
                />
            </div>
            <p className="truncate flex-1 text-left">{participant.name}</p>
            {showScore && participant.score !== undefined && (
                 <span className={cn("font-mono text-xs px-1.5 py-0.5 rounded", participant.winner ? "bg-primary-foreground text-primary" : "bg-muted-foreground text-muted")}>{participant.score}</span>
            )}
        </div>
    );
};

const MatchConnector = ({ numMatches }: { numMatches: number }) => {
    return (
        <div className="flex-1 flex flex-col items-center justify-around">
            {Array.from({ length: numMatches / 2 }).map((_, i) => (
                <div key={i} className="w-full flex-1 flex items-center justify-center">
                    <div className="w-full h-full relative">
                        <div className="absolute top-1/4 left-0 h-1/2 w-1/2 border-r border-b border-gray-300 rounded-br-lg"></div>
                        <div className="absolute bottom-1/4 left-0 h-1/2 w-1/2 border-r border-t border-gray-300 rounded-tr-lg"></div>
                        <div className="absolute top-1/2 left-1/2 w-1/2 h-px bg-gray-300"></div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export function TournamentBracket() {
  const [bracketData, setBracketData] = useState<BracketRound[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const scoresQuery = query(collection(db, "scores"), orderBy("createdAt", "desc"));
    const drawStateQuery = query(collection(db, "drawState"));

    const unsubDraw = onSnapshot(drawStateQuery, drawSnap => {
        const drawData = !drawSnap.empty ? drawSnap.docs.find(d => d.id === 'liveDraw')?.data() as DrawState : null;

        const unsubScores = onSnapshot(scoresQuery, scoresSnap => {
            const allScores = scoresSnap.docs.map(doc => doc.data() as ScoreData);

            const newBracketData: BracketRound[] = [];
            
            // --- Build Bracket Logic ---
            if (drawData && drawData.rounds.length > 0) {

                // PHASE 1: Group Stage
                const groupStageMatches: Match[] = [];
                const groupRounds = drawData.rounds;

                groupRounds.forEach(round => {
                    const participantsInDraw = drawData.teams
                        .filter(t => t.round === round.name)
                        .map(t => ({ 
                            name: t.name, 
                            avatar: `https://picsum.photos/seed/${encodeURIComponent(t.name)}/200`
                        }));

                    const { winner, participants: scoredParticipants } = getMatchResult(allScores, round.name);

                    if (scoredParticipants.length > 0) {
                         groupStageMatches.push({ id: round.name, participants: scoredParticipants });
                    } else {
                         groupStageMatches.push({ id: round.name, participants: participantsInDraw });
                    }
                });
                
                if (groupStageMatches.length > 0) {
                  newBracketData.push({ title: "Fase de Grupos", matches: groupStageMatches });
                }
                
                // PHASE 2: Quarter Finals
                const qfWinners = groupStageMatches
                    .map(m => getMatchResult(allScores, m.id).winner)
                    .filter(Boolean) as Participant[];
                
                if (qfWinners.length > 0) {
                    const quarterFinals: BracketRound = { title: "Cuartos de Final", matches: [] };
                    for (let i = 0; i < Math.ceil(qfWinners.length / 2); i++) {
                        const matchParticipants = qfWinners.slice(i * 2, i * 2 + 2);
                        if (matchParticipants.length > 0) {
                            const matchRoundName = `Cuartos de Final ${i + 1}`;
                            const { winner, participants: scoredParticipants } = getMatchResult(allScores, matchRoundName);
                            if (scoredParticipants.length > 0) {
                                quarterFinals.matches.push({ id: matchRoundName, participants: scoredParticipants });
                            } else {
                                quarterFinals.matches.push({ id: matchRoundName, participants: matchParticipants });
                            }
                        }
                    }
                     if(quarterFinals.matches.length > 0) newBracketData.push(quarterFinals);
                }
                
                // PHASE 3 & 4: Semifinals & Final
                let previousRoundWinners = qfWinners;
                const roundTitles = ["Semifinal", "Final"];
                
                roundTitles.forEach(title => {
                    const currentRoundWinners = newBracketData.find(r => r.title === title)?.matches
                        .map(m => getMatchResult(allScores, m.id).winner)
                        .filter(Boolean) as Participant[];
                        
                    if (currentRoundWinners && currentRoundWinners.length > 0) {
                        previousRoundWinners = currentRoundWinners;
                    } else if (previousRoundWinners.length > 0) {
                         const currentRound: BracketRound = { title, matches: [] };
                         for (let i = 0; i < Math.ceil(previousRoundWinners.length / 2); i++) {
                            const matchParticipants = previousRoundWinners.slice(i * 2, i * 2 + 2);
                            if(matchParticipants.length > 0) {
                                const matchRoundName = `${title} ${i + 1}`.replace(' 1','');
                                const { winner, participants: scoredParticipants } = getMatchResult(allScores, matchRoundName);
                                if (scoredParticipants.length > 0) {
                                    currentRound.matches.push({ id: matchRoundName, participants: scoredParticipants });
                                } else {
                                    currentRound.matches.push({ id: matchRoundName, participants: matchParticipants });
                                }
                            }
                        }
                        if (currentRound.matches.length > 0) {
                            newBracketData.push(currentRound);
                            previousRoundWinners = currentRound.matches.map(m => getMatchResult(allScores, m.id).winner).filter(Boolean) as Participant[];
                        }
                    }
                });
                
                // PHASE 5: Winner
                const finalWinner = getMatchResult(allScores, "Final").winner;
                if(finalWinner) {
                    newBracketData.push({ title: "Ganador", matches: [{id: "Ganador", participants: [finalWinner]}]});
                }
            }

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
                 <p className="text-lg text-muted-foreground mt-2">El bracket aparecerá aquí una vez que se realice el sorteo de la Fase de Grupos.</p>
            </div>
        </div>
      )
  }

  const getRoundColumn = (round: BracketRound) => {
    let justify = 'justify-around';
    // Dynamically adjust justification based on the number of matches
    if(round.matches.length > 4) justify = 'justify-between';

    return (
      <div key={round.title} className="flex flex-col flex-1">
        <h3 className="text-center font-headline text-lg font-bold mb-8 text-primary uppercase h-10 flex items-center justify-center">{round.title}</h3>
        <div className={cn("flex flex-col flex-grow gap-y-6", justify)}>
          {round.matches.map(match => (
            <div key={match.id} className="flex flex-col items-center justify-center gap-2">
              {match.participants.map((p, pIndex) => (
                <ParticipantCard key={p.name || pIndex} participant={p} showScore={true} />
              ))}
              {match.participants.length < 2 && round.title !== 'Ganador' && (
                <ParticipantCard participant={{name: '', avatar: ''}} showScore={false} />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const grandWinner = bracketData.find(r => r.title === 'Ganador')?.matches[0]?.participants[0];

  return (
    <div className="bg-card p-4 md:p-8 rounded-lg w-full">
        <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground">"¿QUÉ SIGNIFICA SER JOVEN DEL SIGLO XXI?"</h2>
            <p className="text-lg text-muted-foreground">Debate Intercolegial</p>
        </div>
        
        {grandWinner && (
          <div className="flex flex-col items-center mb-12 animate-in fade-in-50 duration-500">
            <Trophy className="h-16 w-16 text-amber-400"/>
            <h3 className="font-headline text-2xl font-bold mt-2">GANADOR</h3>
            <p className="text-xl font-semibold text-primary">{grandWinner.name}</p>
          </div>
        )}

      <div className="flex justify-center items-stretch min-w-[1200px] overflow-x-auto pb-4">
        {bracketData.map((round, roundIndex) => {
          if (round.title === 'Ganador') return null;
          const nextRound = bracketData[roundIndex + 1];
          return (
            <div key={round.title} className="flex">
              {getRoundColumn(round)}
              {nextRound && nextRound.matches.length > 0 && <MatchConnector numMatches={round.matches.length} />}
            </div>
          )
        })}
      </div>
    </div>
  );
}

    