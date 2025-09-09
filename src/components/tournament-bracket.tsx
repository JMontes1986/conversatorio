
"use client";

import { cn } from "@/lib/utils";
import Image from "next/image";
import { Loader2, Trophy, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy, doc } from "firebase/firestore";

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
}

type SchoolData = {
    id: string;
    teamName: string;
    participants: { name: string }[];
}


// --- UI COMPONENTS ---
const ParticipantCard = ({ participant, showScore }: { participant: Participant, showScore: boolean }) => {
    if (!participant.name) {
        return (
            <div className="flex items-center gap-2 w-40 text-sm h-10 px-2 bg-secondary rounded-md text-muted-foreground">
                <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs shrink-0">?</div>
                <p className="truncate">Por definir</p>
            </div>
        );
    }

    return (
        <div className={cn("flex items-center gap-2 w-40 text-sm h-10 px-2 rounded-md", 
            participant.winner ? "bg-primary text-primary-foreground font-bold" : "bg-secondary text-secondary-foreground", 
            participant.winner === false && "opacity-50")}>
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
         {match.participants.length < 2 && (
            <ParticipantCard participant={{ name: '', avatar: '' }} showScore={false} />
        )}
    </div>
);

const RoundColumn = ({ round }: { round: BracketRound }) => (
    <div className="flex flex-col justify-around flex-shrink-0 w-48">
        <h3 className="text-center font-headline text-lg font-bold mb-8 text-primary uppercase h-10 flex items-center justify-center">{round.title}</h3>
        <div className="flex flex-col justify-around gap-y-12 h-full">
            {round.matches.map((match, index) => (
                <MatchCard key={match.id || `m-${index}`} match={match} showScore={round.title !== 'Ganador'} />
            ))}
        </div>
    </div>
);

const ConnectorColumn = ({ numMatches }: { numMatches: number }) => (
    <div className="flex flex-col justify-around w-12 flex-shrink-0">
         <div className="h-10 mb-8"></div>
         <div className="flex flex-col justify-around h-full">
            {Array.from({ length: Math.ceil(numMatches / 2) }).map((_, i) => (
                <div key={i} className="relative h-[116px] flex-grow">
                    { numMatches > 1 &&
                       <>
                         <div className="absolute top-1/4 left-0 w-1/2 h-px bg-border"></div>
                         <div className="absolute bottom-1/4 left-0 w-1/2 h-px bg-border"></div>
                         <div className="absolute top-1/4 left-1/2 w-px h-1/2 bg-border"></div>
                         <div className="absolute top-1/2 left-1/2 w-1/2 h-px bg-border"></div>
                       </>
                    }
                </div>
            ))}
        </div>
    </div>
);


export function TournamentBracket() {
  const [bracketData, setBracketData] = useState<BracketRound[]>([]);
  const [loading, setLoading] = useState(true);
  const [champion, setChampion] = useState<Participant | null>(null);
  const [bracketSettings, setBracketSettings] = useState<BracketSettings>({});
  const [allSchools, setAllSchools] = useState<SchoolData[]>([]);

  useEffect(() => {
    const scoresQuery = query(collection(db, "scores"), orderBy("createdAt", "desc"));
    const drawStateRef = doc(db, "drawState", "liveDraw");
    const debateStateRef = doc(db, "debateState", "current");
    const schoolsQuery = query(collection(db, "schools"));

    let unsubScores: () => void, unsubDraw: () => void, unsubSettings: () => void, unsubSchools: () => void;

    unsubSchools = onSnapshot(schoolsQuery, schoolsSnap => {
        const schools = schoolsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SchoolData));
        setAllSchools(schools);

        unsubSettings = onSnapshot(debateStateRef, (doc) => {
            if(doc.exists()) {
                const data = doc.data();
                setBracketSettings({
                    bracketTitle: data.bracketTitle,
                    bracketSubtitle: data.bracketSubtitle,
                    bracketTitleSize: data.bracketTitleSize
                });
            }
        });

        unsubScores = onSnapshot(scoresQuery, scoresSnap => {
            const allScores = scoresSnap.docs.map(doc => doc.data() as ScoreData);

            const getMatchResult = (matchId: string): { winner: Participant | null, participants: Participant[] } => {
                const matchScores = allScores.filter(s => s.matchId === matchId);
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

                return { winner: winner || null, participants };
            };

            unsubDraw = onSnapshot(drawStateRef, drawSnap => {
                const drawData = drawSnap.exists() ? drawSnap.data() as DrawState : null;
                const finalBracketData: BracketRound[] = [];
                
                const groupRoundsDraw = drawData?.rounds.filter(r => r.phase === "Fase de Grupos") || [];
                const quarterFinalists: Participant[] = [];
                
                const groupStageRound: BracketRound = { title: "Fase de Grupos", matches: [] };
                groupRoundsDraw.forEach(round => {
                    const teamsInDraw = drawData?.teams.filter(t => t.round === round.name) || [];
                    const result = getMatchResult(round.name);

                    if (result.participants.length > 0) {
                        groupStageRound.matches.push({ id: round.name, participants: result.participants });
                        if(result.winner) quarterFinalists.push(result.winner);
                    } else if (teamsInDraw.length > 0) {
                        const participants = teamsInDraw.map(t => {
                            const schoolData = schools.find(s => s.teamName === t.name);
                             return {
                                name: t.name,
                                avatar: `https://picsum.photos/seed/${encodeURIComponent(t.name)}/200`,
                                participants: schoolData?.participants
                             };
                        });
                        groupStageRound.matches.push({ id: round.name, participants });
                    }
                });
                
                if (groupStageRound.matches.length > 0) {
                    finalBracketData.push(groupStageRound);
                }

                // If we have group stage winners, we proceed to build the quarters
                const quarterFinalistsFromScores = quarterFinalists.length > 0
                    ? quarterFinalists
                    : (drawData?.activeTab === 'quarters' ? (drawData.teams.map(t => ({...t, avatar: `https://picsum.photos/seed/${encodeURIComponent(t.name)}/200`}))) : []);
                
                let lastRoundWinners: Participant[] = quarterFinalistsFromScores;
                const eliminationPhases = ["Cuartos de Final", "Semifinal", "Final"];
                
                for(const phase of eliminationPhases) {
                     if (lastRoundWinners.length === 0) break;
                     const currentRound: BracketRound = { title: phase, matches: [] };
                     const nextRoundWinners: Participant[] = [];
                     
                     // If this is the quarters, use the draw if available
                     const quartersDraw = drawData?.rounds.filter(r => r.phase === "Cuartos de Final") || [];
                     if(phase === "Cuartos de Final" && quartersDraw.length > 0) {
                         quartersDraw.forEach(round => {
                            const result = getMatchResult(round.name);
                            if (result.participants.length > 0) {
                                currentRound.matches.push({ id: round.name, participants: result.participants });
                                if (result.winner) nextRoundWinners.push(result.winner);
                            } else {
                                const teamsInDraw = drawData?.teams.filter(t => t.round === round.name) || [];
                                const participants = teamsInDraw.map(t => ({
                                    name: t.name,
                                    avatar: `https://picsum.photos/seed/${encodeURIComponent(t.name)}/200`,
                                }));
                                currentRound.matches.push({ id: round.name, participants });
                            }
                        });
                     } else {
                        // Logic for Semis and Final (and Quarters if no draw yet)
                         for (let i = 0; i < lastRoundWinners.length; i += 2) {
                             const matchId = `${phase}-${(i/2) + 1}`;
                             const p1 = lastRoundWinners[i];
                             const p2 = lastRoundWinners[i+1];
                             
                             if (!p2) {
                                nextRoundWinners.push(p1);
                                currentRound.matches.push({ id: matchId, participants: [p1] });
                                continue;
                             }

                             const result = getMatchResult(matchId);

                             if(result.participants.length > 0) {
                                currentRound.matches.push({ id: matchId, participants: result.participants });
                                if(result.winner) nextRoundWinners.push(result.winner);
                             } else {
                                currentRound.matches.push({ id: matchId, participants: p1 && p2 ? [p1, p2] : (p1 ? [p1] : []) });
                             }
                         }
                     }
                     
                     if(currentRound.matches.length > 0) finalBracketData.push(currentRound);
                     lastRoundWinners = nextRoundWinners.length > 0 ? nextRoundWinners : lastRoundWinners;
                }
                
                const finalWinner = lastRoundWinners.length === 1 ? lastRoundWinners[0] : null;
                if(finalWinner) {
                    setChampion(finalWinner);
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
        unsubDraw && unsubDraw();
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
                 <h2 className={cn("font-bold text-foreground", titleSizeMap[bracketSettings.bracketTitleSize || 3])}>{bracketSettings.bracketTitle || '¿QUÉ SIGNIFICA SER JOVEN DEL SIGLO XXI?'}</h2>
                 <p className="text-lg text-muted-foreground mt-2">{bracketSettings.bracketSubtitle || 'Debate Intercolegial'}</p>
                 <p className="text-lg text-muted-foreground mt-8">El bracket aparecerá aquí una vez que se realice el sorteo de la Fase de Grupos.</p>
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
        
        {champion && (
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
               <RoundColumn round={round} />
               {roundIndex < bracketData.length && round.matches.length > 0 && round.title !== 'Final' && <ConnectorColumn numMatches={round.matches.length} />}
            </div>
        ))}
      </div>
    </div>
  );
}
