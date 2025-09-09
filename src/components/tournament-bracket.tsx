
"use client";

import { cn } from "@/lib/utils";
import Image from "next/image";
import { Loader2, Trophy, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy, doc, getDocs, where } from "firebase/firestore";

// --- TYPES ---
type Participant = {
  name: string;
  avatar: string;
  winner?: boolean;
  score?: number;
  participants?: { name: string }[];
};

type Match = {
  id: string;
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
    activeTab?: string;
}

type BracketSettings = {
    bracketTitle?: string;
    bracketSubtitle?: string;
    bracketTitleSize?: number;
    resultsPublished?: boolean;
}

type SchoolData = {
    id: string;
    teamName: string;
    participants: { name: string }[];
}


// --- UI COMPONENTS ---
const ParticipantCard = ({ participant, showScore }: { participant: Participant, showScore: boolean }) => {
    if (!participant.name) {
        return <div className="flex items-center gap-2 w-40 text-sm h-10 px-2 rounded-md bg-secondary/50 text-muted-foreground italic">Por definir</div>;
    }

    return (
        <div className={cn("flex items-center gap-2 w-40 text-sm h-10 px-2 rounded-md", 
            showScore && participant.winner ? "bg-primary text-primary-foreground font-bold" : "bg-secondary text-secondary-foreground", 
            showScore && participant.winner === false && "opacity-50")}>
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

const MatchCard = ({ match, showScore }: { match: Match, showScore: boolean }) => (
    <div className="flex flex-col gap-2">
        {match.participants.map((p, pIndex) => (
            <ParticipantCard key={p.name || `p-${pIndex}`} participant={p} showScore={showScore} />
        ))}
         {match.participants.length < 2 && <ParticipantCard participant={{name: '', avatar: ''}} showScore={false} />}
    </div>
);


const RoundColumn = ({ round, showScore }: { round: BracketRound, showScore: boolean }) => (
    <div className="flex flex-col justify-around flex-shrink-0 w-48">
        <h3 className="text-center font-headline text-lg font-bold mb-8 text-primary uppercase h-10 flex items-center justify-center">{round.title}</h3>
        <div className="flex flex-col justify-around gap-y-12 h-full">
            {round.matches.map((match, index) => (
                <MatchCard key={match.id || `m-${index}`} match={match} showScore={showScore && round.title !== 'Ganador'} />
            ))}
        </div>
    </div>
);

const ConnectorColumn = ({ numMatches, numPreviousMatches }: { numMatches: number, numPreviousMatches?: number }) => {
    return (
        <div className="flex flex-col justify-around w-12 flex-shrink-0">
             <div className="h-10 mb-8"></div>
             <div className="flex flex-col justify-around h-full">
                {Array.from({ length: numMatches }).map((_, i) => (
                    <div key={i} className="relative flex-grow" style={{ height: '116px' }}>
                       <>
                         <div className="absolute top-1/4 left-0 w-1/2 h-px bg-border"></div>
                         <div className="absolute bottom-1/4 left-0 w-1/2 h-px bg-border"></div>
                         <div className="absolute top-1/4 left-1/2 w-px h-1/2 bg-border"></div>
                         <div className="absolute top-1/2 left-1/2 w-1/2 h-px bg-border"></div>
                       </>
                    </div>
                ))}
            </div>
        </div>
    );
};


export function TournamentBracket() {
  const [bracketData, setBracketData] = useState<BracketRound[]>([]);
  const [loading, setLoading] = useState(true);
  const [champion, setChampion] = useState<Participant | null>(null);
  const [bracketSettings, setBracketSettings] = useState<BracketSettings>({});
  const [allSchools, setAllSchools] = useState<SchoolData[]>([]);

  useEffect(() => {
    const scoresQuery = query(collection(db, "scores"), orderBy("createdAt", "desc"));
    const roundsQuery = query(collection(db, "rounds"), orderBy("createdAt", "asc"));
    const settingsRef = doc(db, "settings", "competition");
    const schoolsQuery = query(collection(db, "schools"));

    let unsubScores: () => void, unsubRounds: () => void, unsubSettings: () => void, unsubSchools: () => void;

    unsubSchools = onSnapshot(schoolsQuery, schoolsSnap => {
        const schools = schoolsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SchoolData));
        setAllSchools(schools);

        unsubSettings = onSnapshot(settingsRef, (doc) => {
            if(doc.exists()) {
                const data = doc.data();
                setBracketSettings({
                    bracketTitle: data.bracketTitle,
                    bracketSubtitle: data.bracketSubtitle,
                    bracketTitleSize: data.bracketTitleSize,
                    resultsPublished: data.resultsPublished || false,
                });
            }
        });

        unsubRounds = onSnapshot(roundsQuery, roundsSnap => {
            const allRounds = roundsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as RoundData));

            unsubScores = onSnapshot(scoresQuery, scoresSnap => {
                const allScores = scoresSnap.docs.map(doc => doc.data() as ScoreData);

                const getMatchResult = (matchId: string): { winner: Participant | null, participants: Participant[], matchId: string } => {
                    const matchScores = allScores.filter(s => s.matchId === matchId || s.matchId.startsWith(`${matchId}-bye`));
                    if (matchScores.length === 0) return { winner: null, participants: [], matchId };

                    const teamTotals: Record<string, number> = {};
                    matchScores.forEach(score => {
                        score.teams.forEach(team => {
                            if (!teamTotals[team.name]) teamTotals[team.name] = 0;
                            teamTotals[team.name] += team.total;
                        });
                    });
                    
                    const entries = Object.entries(teamTotals);
                    if (entries.length === 0) return { winner: null, participants: [], matchId };

                    const winnerEntry = entries.length === 1 ? entries[0] : entries.reduce((a, b) => a[1] > b[1] ? a : b);
                    const winnerName = winnerEntry[0];
                    
                    const participants = entries.map(([name, total]) => {
                        const schoolData = schools.find(s => s.teamName === name);
                        return {
                            name: name,
                            avatar: `https://picsum.photos/seed/${encodeURIComponent(name)}/200`,
                            score: total,
                            winner: name === winnerName,
                            participants: schoolData?.participants
                        };
                    });

                    const winner = participants.find(p => p.winner);
                    participants.forEach(p => { if (p.name !== winnerName) p.winner = false; });

                    return { winner: winner || null, participants, matchId };
                };
                
                const finalBracketData: BracketRound[] = [];
                
                const getTop8FromGroups = (): Participant[] => {
                    const groupRounds = allRounds.filter(r => r.phase === "Fase de Grupos");
                    if (groupRounds.length === 0) return [];
                    const groupRoundNames = groupRounds.map(r => r.name);
                    const groupScores = allScores.filter(s => groupRoundNames.some(rn => s.matchId === rn || s.matchId.startsWith(rn + '-bye-')));
                    
                    const teamTotals: Record<string, number> = {};
                    groupScores.forEach(score => {
                        score.teams.forEach(team => {
                            if (!teamTotals[team.name]) teamTotals[team.name] = 0;
                            teamTotals[team.name] += team.total;
                        });
                    });
                    
                    const top8Names = Object.entries(teamTotals).sort((a,b) => b[1] - a[1]).slice(0, 8).map(e => e[0]);

                    return top8Names.map(name => {
                        const schoolData = schools.find(s => s.teamName === name);
                        return {
                            name, 
                            avatar: `https://picsum.photos/seed/${encodeURIComponent(name)}/200`, 
                            participants: schoolData?.participants
                        };
                    });
                };


                const quartersRound: BracketRound = { title: "Cuartos de Final", matches: [] };
                const top8 = getTop8FromGroups();
                if (top8.length > 0) {
                    for (let i = 0; i < 4; i++) {
                        const matchId = `Cuartos de Final-${i+1}`;
                        const p1 = top8[i*2];
                        const p2 = top8[i*2+1];
                        
                        const result = getMatchResult(matchId);

                        if(result.participants.length > 0) {
                            quartersRound.matches.push({ id: matchId, participants: result.participants });
                        } else {
                            const participants = [];
                            if (p1) participants.push(p1);
                            if (p2) participants.push(p2);
                            quartersRound.matches.push({ id: matchId, participants });
                        }
                    }
                    finalBracketData.push(quartersRound);
                }

                let lastRoundWinners: (Participant | null)[] = quartersRound.matches.map(m => getMatchResult(m.id).winner);

                const eliminationPhases = ["Semifinal", "Final"];
                
                for(const phase of eliminationPhases) {
                    if (lastRoundWinners.filter(Boolean).length < 2 && phase !== "Final") break;
                     if (lastRoundWinners.filter(Boolean).length === 0) break;
                    
                    const nextRound: BracketRound = { title: phase, matches: [] };
                    
                    if(lastRoundWinners.length === 3 && phase === "Semifinal"){
                        // Special case for 3 winners advancing
                        const matchId = `${phase}-1`;
                        const result = getMatchResult(matchId);
                         if(result.participants.length > 0){
                           nextRound.matches.push({ id: matchId, participants: result.participants });
                           lastRoundWinners = [result.winner];
                        } else {
                           nextRound.matches.push({ id: matchId, participants: lastRoundWinners.filter(p => p !== null) as Participant[] });
                           lastRoundWinners = [null];
                        }
                    } else {
                        const nextRoundWinners: (Participant | null)[] = [];
                        for(let i = 0; i < lastRoundWinners.length; i += 2) {
                            const p1 = lastRoundWinners[i];
                            const p2 = lastRoundWinners[i+1];
                            
                            const matchId = `${phase}-${Math.floor(i/2)+1}`;
                            const result = getMatchResult(matchId);

                            if(result.participants.length > 0){
                                nextRound.matches.push({ id: matchId, participants: result.participants });
                                nextRoundWinners.push(result.winner);
                            } else {
                                const participants: Participant[] = [];
                                if(p1) participants.push(p1);
                                if(p2) participants.push(p2);
                                nextRound.matches.push({ id: matchId, participants: participants });
                                nextRoundWinners.push(null);
                            }
                        }
                         lastRoundWinners = nextRoundWinners;
                    }
                    
                    if(nextRound.matches.length > 0){
                        finalBracketData.push(nextRound);
                    }
                }
                
                const finalRound = finalBracketData.find(r => r.title === "Final");
                if (finalRound && finalRound.matches.length > 0) {
                    const finalMatch = finalRound.matches[0];
                    const winner = getMatchResult(finalMatch.id).winner;
                    if (winner) {
                        setChampion(winner);
                    } else {
                        setChampion(null);
                    }
                } else {
                    setChampion(null);
                }

                setBracketData(finalBracketData);
                setLoading(false);
            });
        });
    });

    return () => {
        unsubScores && unsubScores();
        unsubRounds && unsubRounds();
        unsubSettings && unsubSettings();
        unsubSchools && unsubSchools();
    };
  }, []);

    const titleSizeMap: Record<number, string> = {
        1: "text-xl",
        2: "text-2xl",
        3: "text-3xl",
        4: "text-4xl",
        5: "text-5xl"
    };
    
    const showResults = bracketSettings.resultsPublished ?? false;

  if (loading) {
    return (
        <div className="bg-card p-4 md:p-8 rounded-lg w-full min-h-[400px] flex justify-center items-center">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="ml-4">Generando bracket del torneo...</p>
        </div>
    )
  }
  
  const bracketIsEmpty = bracketData.length === 0;

  if (bracketIsEmpty) {
    return (
        <div className="bg-card p-4 md:p-8 rounded-lg w-full min-h-[400px] flex justify-center items-center">
            <div className="text-center">
                 <h2 className={cn("font-bold text-foreground", titleSizeMap[bracketSettings.bracketTitleSize || 3])}>{bracketSettings.bracketTitle || '¿QUÉ SIGNIFICA SER JOVEN DEL SIGLO XXI?'}</h2>
                 <p className="text-lg text-muted-foreground mt-2">{bracketSettings.bracketSubtitle || 'Debate Intercolegial'}</p>
                 <p className="text-lg text-muted-foreground mt-8">El bracket de las fases eliminatorias aparecerá aquí una vez que los resultados de la fase de grupos sean publicados.</p>
            </div>
        </div>
    )
  }

  return (
    <div className="bg-card p-4 md:p-8 rounded-lg w-full">
        <div className="text-center mb-12">
            <h2 className={cn("font-bold text-foreground", titleSizeMap[bracketSettings.bracketTitleSize || 3])}>{bracketSettings.bracketTitle || '¿QUÉ SIGNIFICA SER JOVEN DEL SIGLO XXI?'}</h2>
            <p className="text-lg text-muted-foreground mt-2">{bracketSettings.bracketSubtitle || 'Debate Intercolegial'}</p>
        </div>
        
        {showResults && champion && (
          <div className="flex flex-col items-center mb-12 animate-in fade-in-50 duration-500">
            <Trophy className="h-16 w-16 text-amber-400"/>
            <h3 className="font-headline text-2xl font-bold mt-2">GANADOR</h3>
            <p className="text-xl font-semibold text-primary">{champion.name}</p>
            {champion.participants && champion.participants.length > 0 && (
                 <div className="mt-4 border-t pt-4 w-full max-w-sm">
                    <h4 className="font-semibold flex items-center justify-center gap-2 mb-2 text-md"><Users className="h-5 w-5 text-muted-foreground"/> Equipo Campeón</h4>
                    <ul className="text-sm text-muted-foreground text-center">
                        {champion.participants.map((p, i) => <li key={i}>{p.name}</li>)}
                    </ul>
                </div>
            )}
          </div>
        )}

      <div className="flex items-start min-w-max">
        {bracketData.map((round, roundIndex) => (
            <div key={round.title} className="flex items-start">
               <RoundColumn round={round} showScore={showResults} />
               {roundIndex < bracketData.length -1 && round.matches.length > 0 && (
                   <ConnectorColumn 
                        numMatches={bracketData[roundIndex+1].matches.length} 
                        numPreviousMatches={round.matches.length}
                   />
               )}
            </div>
        ))}
      </div>
    </div>
  );
}

    