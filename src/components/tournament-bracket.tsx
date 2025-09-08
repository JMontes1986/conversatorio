
"use client";

import { cn } from "@/lib/utils";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
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
};

type Round = {
  title: string;
  matches: Match[];
};

type SchoolData = {
  id: string;
  teamName: string;
}

type RoundData = {
  id: string;
  name: string;
  phase: string;
}

type ScoreData = {
  matchId: string;
  teams: { name: string; total: number }[];
}

// UI COMPONENTS
const ParticipantCard = ({ participant }: { participant: Participant }) => {
    if (!participant.name) {
        return (
            <div className="flex flex-col items-center gap-2 w-32 text-center">
                 <div className="relative h-24 w-24 rounded-full overflow-hidden border-4 border-dashed border-gray-300 bg-secondary flex items-center justify-center">
                   <p className="text-xs text-muted-foreground">?</p>
                </div>
                <div className="w-full py-1.5 rounded-md text-sm bg-secondary text-secondary-foreground">
                    <p className="truncate px-1">???</p>
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


// CORE LOGIC
const getTopScoringTeamsFromPhase = (scores: ScoreData[], phaseRounds: RoundData[], limit: number): {name: string, score: number}[] => {
    const phaseRoundNames = phaseRounds.map(r => r.name);
    const phaseScores = scores.filter(s => phaseRoundNames.includes(s.matchId));

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
        .map(([name, score]) => ({ name, score }));
}

const getWinnerOfMatch = (scores: ScoreData[], matchId: string): string | null => {
    const matchScores = scores.filter(s => s.matchId === matchId);
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

    return entries.reduce((a, b) => a[1] > b[1] ? a : b)[0];
}


export function TournamentBracket() {
  const [bracketData, setBracketData] = useState<Round[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const roundsQuery = query(collection(db, "rounds"), orderBy("createdAt", "asc"));
    const scoresQuery = query(collection(db, "scores"), orderBy("createdAt", "desc"));
    const schoolsQuery = query(collection(db, "schools"));

    const unsubRounds = onSnapshot(roundsQuery, roundsSnap => {
        const allRounds = roundsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as RoundData));
        
        const unsubScores = onSnapshot(scoresQuery, scoresSnap => {
            const allScores = scoresSnap.docs.map(doc => doc.data() as ScoreData);

            const unsubSchools = onSnapshot(schoolsQuery, schoolsSnap => {
                const allSchools = schoolsSnap.docs.map(doc => doc.data() as SchoolData);
                
                // --- Build Bracket Logic ---
                const newBracketData: Round[] = [];
                const phases = ["Cuartos de Final", "Semifinal", "Final", "Ganador"];
                let previousPhaseWinners: Participant[] = [];

                phases.forEach((phaseName, index) => {
                    const phaseRounds = allRounds.filter(r => r.phase === phaseName);
                    if (phaseRounds.length === 0 && phaseName !== "Ganador") return;

                    const round: Round = { title: phaseName, matches: [] };
                    
                    if (phaseName === "Cuartos de Final") {
                         const groupStageRounds = allRounds.filter(r => r.phase === "Fase de Grupos");
                         const qualifiedTeams = getTopScoringTeamsFromPhase(allScores, groupStageRounds, 8);
                         
                         // Create pairs for matches
                         for(let i = 0; i < phaseRounds.length; i++) {
                            const matchTeams = qualifiedTeams.slice(i * 2, i * 2 + 2);
                             const participants: Participant[] = matchTeams.map((team, idx) => ({
                                 name: team.name,
                                 avatar: `https://picsum.photos/seed/${team.name}/200`,
                                 score: team.score,
                             }));

                            // Ensure there are always 2 participants for rendering
                            while(participants.length < 2) participants.push({name: '', avatar: ''});
                            
                            const winnerName = getWinnerOfMatch(allScores, phaseRounds[i].name);
                            if(winnerName) {
                                participants.forEach(p => { if (p.name === winnerName) p.winner = true; });
                            }

                             round.matches.push({ id: i, participants });
                         }
                         previousPhaseWinners = round.matches.flatMap(m => m.participants.filter(p => p.winner));
                    } else if (phaseName !== "Ganador") {
                        // For Semis and Finals
                         for (let i = 0; i < phaseRounds.length; i++) {
                             const matchTeams = previousPhaseWinners.slice(i * 2, i * 2 + 2);
                             const participants: Participant[] = matchTeams.map(team => ({
                                 name: team.name,
                                 avatar: team.avatar
                             }));

                             while(participants.length < 2) participants.push({name: '', avatar: ''});

                             const winnerName = getWinnerOfMatch(allScores, phaseRounds[i].name);
                             if(winnerName) {
                                 participants.forEach(p => { if (p.name === winnerName) p.winner = true; });
                             }
                             round.matches.push({ id: i, participants });
                         }
                          previousPhaseWinners = round.matches.flatMap(m => m.participants.filter(p => p.winner));
                    } else { // Ganador
                        if(previousPhaseWinners.length === 1) {
                            round.matches.push({ id: 0, participants: [{...previousPhaseWinners[0], winner: true}] })
                        }
                    }

                    if (round.matches.length > 0) {
                        newBracketData.push(round);
                    }
                });

                setBracketData(newBracketData);
                setLoading(false);

            }); // unsubSchools
            return () => unsubSchools();
        }); // unsubScores
        return () => unsubScores();
    }); // unsubRounds
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
                 <p className="text-lg text-muted-foreground mt-2">El bracket del torneo aparecerá aquí una vez comiencen las rondas eliminatorias.</p>
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
      <div className="flex justify-center items-start min-w-[1400px] gap-8">
        {bracketData.map((round, roundIndex) => (
          <div key={round.title} className="flex flex-col w-1/4 pt-10">
            <h3 className="text-center font-headline text-xl font-bold mb-8 text-primary uppercase">{round.title}</h3>
            <div className={cn("flex flex-col justify-around flex-grow", round.matches.length > 1 ? "space-y-20" : "")}>
              {round.matches.map((match, matchIndex) => (
                <div key={match.id} className="relative flex flex-col items-center justify-center gap-4">
                    <div className="flex justify-around w-full items-center">
                     {match.participants.map((p, pIndex) => (
                        <div key={p.name || pIndex} className="relative">
                           <ParticipantCard participant={p} />
                           {match.participants.length > 1 && pIndex === 0 && (
                                <div className="absolute top-1/2 -translate-y-1/2 -right-6 h-0.5 w-6 bg-gray-300 z-0"></div>
                           )}
                        </div>
                     ))}
                    </div>
                   
                    {/* Connecting Lines */}
                    {roundIndex < bracketData.length -1 && (
                      <>
                        <div className="absolute top-1/2 -translate-y-1/2 left-1/2 h-0.5 w-[calc(50%_+_2rem)] bg-gray-300 -ml-4 z-0"></div>
                        <div className="absolute top-1/2 -translate-y-1/2 -right-4 h-0.5 w-4 bg-gray-300 z-0"></div>

                        { match.id % 2 === 0 && (
                             <div className="absolute top-1/2 -right-4 h-[calc(100%_+_5rem)] w-0.5 bg-gray-300 z-0"></div>
                        )}
                         { match.id % 2 !== 0 && (
                             <div className="absolute bottom-1/2 -right-4 h-[calc(100%_+_5rem)] w-0.5 bg-gray-300 z-0"></div>
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

    