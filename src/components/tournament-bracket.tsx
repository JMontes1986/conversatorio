
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
        return (
            <div className="flex items-center gap-2 w-40 text-sm h-10 px-2 bg-secondary rounded-md text-muted-foreground">
                <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs shrink-0">?</div>
                <p className="truncate">Por definir</p>
            </div>
        );
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
    const isConnectingToOne = numMatches === 1 && (numPreviousMatches && numPreviousMatches > 1);

    return (
        <div className="flex flex-col justify-around w-12 flex-shrink-0">
             <div className="h-10 mb-8"></div>
             <div className="flex flex-col justify-around h-full">
                {Array.from({ length: numMatches }).map((_, i) => (
                    <div key={i} className="relative flex-grow" style={{ height: isConnectingToOne ? `${116 * (numPreviousMatches! / 2)}px` : '116px' }}>
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
    const drawStateRef = doc(db, "drawState", "liveDraw");
    const settingsRef = doc(db, "settings", "competition");
    const schoolsQuery = query(collection(db, "schools"));

    let unsubScores: () => void, unsubDraw: () => void, unsubSettings: () => void, unsubSchools: () => void;

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

            unsubDraw = onSnapshot(drawStateRef, async (drawSnap) => {
                const drawData = drawSnap.exists() ? drawSnap.data() as DrawState : null;
                const finalBracketData: BracketRound[] = [];

                const getWinnersOfPhase = async (phase: string): Promise<Participant[]> => {
                    const roundNames = (await getDocs(query(collection(db, "rounds"), where("phase", "==", phase)))).docs.map(d => d.data().name);
                    const winners = new Set<string>();
                    roundNames.forEach(rn => {
                        const result = getMatchResult(rn);
                        if(result.winner) winners.add(result.winner.name);
                    });
                     const winnersFromBye = allScores
                        .filter(s => s.matchId.includes('-bye-') && s.matchId.startsWith(phase))
                        .map(s => s.teams[0].name);

                    [...winnersFromBye].forEach(w => winners.add(w));

                    return Array.from(winners).map(name => {
                        const schoolData = schools.find(s => s.teamName === name);
                        return { name, avatar: `https://picsum.photos/seed/${encodeURIComponent(name)}/200`, participants: schoolData?.participants };
                    });
                };
                
                let lastRoundWinners: Participant[] = [];
                const groupStageRound: BracketRound = { title: "Fase de Grupos", matches: [] };
                const groupRoundsFromDraw = drawData?.rounds.filter(r => r.phase === "Fase de Grupos") || [];
                
                groupRoundsFromDraw.forEach(round => {
                    const teamsInDraw = drawData?.teams.filter(t => t.round === round.name) || [];
                    const result = getMatchResult(round.name);

                    if (result.participants.length > 0) {
                        groupStageRound.matches.push({ id: round.name, participants: result.participants });
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

                lastRoundWinners = await getWinnersOfPhase("Fase de Grupos");
                if (lastRoundWinners.length === 0) {
                    const groupScores = allScores.filter(s => groupRoundsFromDraw.some(r => r.name === s.matchId));
                     const teamTotals: Record<string, number> = {};
                    groupScores.forEach(score => {
                        score.teams.forEach(team => {
                            if (!teamTotals[team.name]) teamTotals[team.name] = 0;
                            teamTotals[team.name] += team.total;
                        });
                    });
                    const top8 = Object.entries(teamTotals).sort((a,b) => b[1] - a[1]).slice(0, 8).map(e => e[0]);
                    lastRoundWinners = top8.map(name => ({name, avatar: `https://picsum.photos/seed/${encodeURIComponent(name)}/200`}));
                }
                
                const eliminationPhases = ["Cuartos de Final", "Semifinal", "Final"];
                
                for(const phase of eliminationPhases) {
                     if (lastRoundWinners.length === 0 && finalBracketData.length === 0) break;
                     
                     const currentRound: BracketRound = { title: phase, matches: [] };
                     let nextRoundWinners: Participant[] = [];
                     
                     let teamsForThisPhase = lastRoundWinners;
                     
                     const quartersDrawRounds = drawData?.rounds.filter(r => r.phase === "Cuartos de Final") || [];

                     if (phase === "Cuartos de Final" && quartersDrawRounds.length > 0) {
                        quartersDrawRounds.forEach(round => {
                             const result = getMatchResult(round.name);
                             if (result.participants.length > 0) {
                                currentRound.matches.push({ id: round.name, participants: result.participants });
                                if (result.winner) nextRoundWinners.push(result.winner);
                             } else {
                                const teamsInDraw = drawData?.teams.filter(t => t.round === round.name) || [];
                                const participants = teamsInDraw.map(t => ({ name: t.name, avatar: `https://picsum.photos/seed/${encodeURIComponent(t.name)}/200`}));
                                currentRound.matches.push({ id: round.name, participants });
                             }
                         });
                     } else if (teamsForThisPhase.length === 3) {
                        teamsForThisPhase.forEach((team, index) => {
                            const matchId = `${phase}-trio-${index + 1}`;
                            const result = getMatchResult(matchId);
                            if (result.participants.length > 0) {
                                if (!currentRound.matches.find(m => m.id === result.matchId)) {
                                    currentRound.matches.push({ id: result.matchId, participants: result.participants });
                                }
                                if(result.winner) nextRoundWinners.push(result.winner);
                            } else {
                                currentRound.matches.push({ id: matchId, participants: [team] });
                            }
                        });
                        const trioMatchResult = getMatchResult(`${phase}-1`);
                        if(trioMatchResult.winner) {
                           nextRoundWinners = [trioMatchResult.winner];
                        }
                     } else {
                         for (let i = 0; i < teamsForThisPhase.length; i += 2) {
                             const matchId = `${phase}-${(i/2) + 1}`;
                             const p1 = teamsForThisPhase[i];
                             const p2 = teamsForThisPhase[i+1];
                             
                             if (!p2) { // Handle BYE
                                p1.winner = true; 
                                nextRoundWinners.push(p1);
                                currentRound.matches.push({ id: matchId, participants: [p1] });
                                continue;
                             }

                             const result = getMatchResult(matchId);

                             if(result.participants.length > 0) {
                                currentRound.matches.push({ id: matchId, participants: result.participants });
                                if(result.winner) nextRoundWinners.push(result.winner);
                             } else {
                                currentRound.matches.push({ id: matchId, participants: [p1, p2] });
                             }
                         }
                     }

                     if(currentRound.matches.length > 0) {
                        finalBracketData.push(currentRound);
                        lastRoundWinners = await getWinnersOfPhase(phase);
                     } else if (phase === 'Cuartos de Final' && teamsForThisPhase.length > 0) {
                        for (let i = 0; i < Math.ceil(teamsForThisPhase.length / 2); i++) {
                            currentRound.matches.push({id: `${phase}-m${i}`, participants: []});
                        }
                        finalBracketData.push(currentRound);
                     }
                }
                
                const finalRound = finalBracketData.find(r => r.title === "Final");
                if (finalRound && finalRound.matches.length > 0) {
                    const finalMatch = finalRound.matches[0];
                    const winner = finalMatch.participants.find(p => p.winner);
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

  if (!showResults && bracketIsEmpty) {
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

    