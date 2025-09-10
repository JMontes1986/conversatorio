

"use client";

import { cn } from "@/lib/utils";
import Image from "next/image";
import { Loader2, Trophy, Users, Swords } from "lucide-react";
import React, { useEffect, useState, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, doc, orderBy, getDocs, setDoc } from "firebase/firestore";

// --- TYPES ---
type Participant = {
  id: string | null;
  name: string;
};

type Match = {
  id: string;
  participants: (Participant | null)[];
  nextMatchId?: string | null;
  matchNumber: number;
  roundNumber: number;
};

type BracketRound = {
  id: string;
  title: string;
  matches: Match[];
};

type RoundData = {
    id: string;
    name: string;
    phase: string;
};

type DrawnTeam = {
  id: string;
  name: string;
  round: string | null;
};

type ScoreData = {
    matchId: string;
    teams: { name: string; total: number }[];
};

type BracketSettings = {
    bracketTitle?: string;
    bracketSubtitle?: string;
    bracketTitleSize?: number;
    resultsPublished?: boolean;
};

// --- UI COMPONENTS ---
const ParticipantCard = ({ participant, showScore, winner }: { participant: Participant | null, showScore: boolean, winner?: string | null }) => {
    if (!participant || !participant.name) {
        return <div className="flex items-center justify-center w-40 text-sm h-10 px-2 rounded-md bg-secondary/50 text-muted-foreground italic">Por definir</div>;
    }

    const isWinner = showScore && participant.name === winner;
    const hasLost = showScore && winner && !isWinner;

    return (
        <div className={cn("flex items-center gap-2 w-40 text-sm h-10 px-2 rounded-md", 
            isWinner ? "bg-primary text-primary-foreground font-bold ring-2 ring-amber-400" : "bg-secondary text-secondary-foreground", 
            hasLost && "opacity-50")}>
            <div className="relative h-6 w-6 rounded-full overflow-hidden bg-muted shrink-0">
                <Image
                    src={`https://picsum.photos/seed/${encodeURIComponent(participant.name)}/200`}
                    alt={participant.name}
                    data-ai-hint="school logo"
                    fill
                    className="object-cover"
                />
            </div>
            <p className="truncate flex-1 text-left">{participant.name}</p>
             {showScore && isWinner && (
                 <Trophy className="h-4 w-4 text-amber-300" />
            )}
        </div>
    );
};

const MatchCard = ({ match, showScore, winner }: { match: Match, showScore: boolean, winner: string | null }) => {
    return (
        <div className="flex flex-col items-center gap-2 relative">
            <ParticipantCard participant={match.participants[0]} showScore={showScore} winner={winner} />
            <span className="text-xs font-bold text-muted-foreground">VS</span>
            <ParticipantCard participant={match.participants[1]} showScore={showScore} winner={winner} />
        </div>
    )
};

const RoundColumn = ({ round, showScore, winners, isFinalRound }: { round: BracketRound, showScore: boolean, winners: Record<string, string | null>, isFinalRound: boolean }) => {
    const Icon = round.id.toLowerCase().includes('grupo') ? Users : Swords;
    
    return (
        <div className="flex flex-col items-center gap-8 w-64 shrink-0">
            <h3 className="text-center font-headline text-lg font-bold text-primary uppercase tracking-wider flex items-center gap-2">
                <Icon className="h-5 w-5" /> {round.title}
            </h3>
            <div className="flex flex-col justify-around gap-y-12 w-full h-full">
                {round.matches.map((match) => (
                    <div key={match.id} className="relative">
                        <MatchCard match={match} showScore={showScore} winner={winners[match.id] || null} />
                    </div>
                ))}
            </div>
        </div>
    );
};

const ConnectorLines = ({ rounds, populatedBracket }: { rounds: BracketRound[], populatedBracket: BracketRound[] }) => {
    return (
        <svg className="absolute top-0 left-0 w-full h-full pointer-events-none">
            <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="3" markerHeight="3" orient="auto-start-reverse">
                    <path d="M 0 0 L 5 5 L 0 10 z" fill="hsl(var(--border))" />
                </marker>
            </defs>
            {populatedBracket.flatMap((round, roundIndex) => {
                if (roundIndex === rounds.length - 1) return []; // No connectors from the last round

                return round.matches.map((match, matchIndex) => {
                    const nextMatchIndex = Math.floor(matchIndex / 2);
                    const nextMatch = rounds[roundIndex + 1]?.matches[nextMatchIndex];
                    if (!nextMatch) return null;
                    
                    const startEl = document.getElementById(`match-${match.id}`);
                    const endEl = document.getElementById(`match-${nextMatch.id}`);

                    if (!startEl || !endEl) return null;

                    const startRect = startEl.getBoundingClientRect();
                    const endRect = endEl.getBoundingClientRect();
                    const containerRect = startEl.closest('.bracket-container')?.getBoundingClientRect();

                    if (!containerRect) return null;

                    const startX = startRect.right - containerRect.left;
                    const startY = startRect.top + startRect.height / 2 - containerRect.top;

                    const endX = endRect.left - containerRect.left;
                    const endY = endRect.top + endRect.height / 2 - containerRect.top;
                    
                    const midX = startX + (endX - startX) / 2;

                    return (
                        <React.Fragment key={`${match.id}-${nextMatch.id}`}>
                            <line x1={startX} y1={startY} x2={midX} y2={startY} stroke="hsl(var(--border))" strokeWidth="2" />
                            <line x1={midX} y1={startY} x2={midX} y2={endY} stroke="hsl(var(--border))" strokeWidth="2" />
                            <line x1={midX} y1={endY} x2={endX} y2={endY} stroke="hsl(var(--border))" strokeWidth="2" />
                        </React.Fragment>
                    );
                });
            })}
        </svg>
    );
};


export function TournamentBracket() {
  const [bracketData, setBracketData] = useState<BracketRound[]>([]);
  const [loading, setLoading] = useState(true);
  const [winners, setWinners] = useState<Record<string, string | null>>({});
  const [bracketSettings, setBracketSettings] = useState<BracketSettings>({});
  const [_, forceRender] = useState(0); // For forcing re-render to draw connectors

   const generateBracketFromScratch = async () => {
    const roundsQuery = query(collection(db, "rounds"), orderBy("createdAt", "asc"));
    const drawStateRef = doc(db, "drawState", "liveDraw");
    
    const [roundsSnapshot, drawStateSnap] = await Promise.all([
      getDocs(roundsQuery),
      getDoc(drawStateRef)
    ]);

    const allRounds = roundsSnapshot.docs.map(d => ({id: d.id, ...d.data()}) as RoundData);
    const drawnTeams = drawStateSnap.exists() ? drawStateSnap.data().teams as DrawnTeam[] : [];
    
    if (allRounds.length === 0 || drawnTeams.length === 0) {
        setLoading(false);
        return;
    }

    let newBracketData: BracketRound[] = [];
    
    const knockoutPhases = ["Cuartos de Final", "Semifinal", "Final"];
    const phaseOrder = ["Fase de Grupos", ...knockoutPhases];

    let matchCounter = 0;
    
    phaseOrder.forEach((phase, phaseIndex) => {
        const roundsInPhase = allRounds.filter(r => r.phase === phase);
        if (roundsInPhase.length > 0) {
            const matches: Match[] = [];
            
            if (phase === "Fase de Grupos") {
                roundsInPhase.forEach(round => {
                    const teamsInRound = drawnTeams.filter(t => t.round === round.name);
                     if(teamsInRound.length >= 2) {
                        matches.push({
                            id: round.id,
                            participants: [
                                {id: teamsInRound[0].id, name: teamsInRound[0].name},
                                {id: teamsInRound[1].id, name: teamsInRound[1].name}
                            ],
                            matchNumber: matchCounter++,
                            roundNumber: phaseIndex,
                        });
                    }
                });
            } else {
                 const numMatches = roundsInPhase.length;
                 for (let i = 0; i < numMatches; i++) {
                     matches.push({
                        id: roundsInPhase[i].name,
                        participants: [null, null], // Start empty
                        matchNumber: matchCounter++,
                        roundNumber: phaseIndex,
                     });
                 }
            }
            
            newBracketData.push({
                id: phase,
                title: phase,
                matches: matches,
            });
        }
    });

    // Link matches
     for (let i = 0; i < newBracketData.length - 1; i++) {
        const currentRound = newBracketData[i];
        const nextRound = newBracketData[i+1];
        currentRound.matches.forEach((match, index) => {
            match.nextMatchId = nextRound.matches[Math.floor(index/2)]?.id;
        });
     }

    const bracketDocRef = doc(db, "bracketState", "liveBracket");
    await setDoc(bracketDocRef, { bracketRounds: newBracketData });

    setBracketData(newBracketData);
    setLoading(false);
  };


  useEffect(() => {
    const bracketDocRef = doc(db, "bracketState", "liveBracket");
    const unsubscribeBracket = onSnapshot(bracketDocRef, (docSnap) => {
        if (docSnap.exists() && docSnap.data().bracketRounds?.length > 0) {
            setBracketData(docSnap.data().bracketRounds || []);
        } else {
            generateBracketFromScratch();
        }
        setLoading(false);
    }, () => setLoading(false));

    const scoresQuery = query(collection(db, "scores"), orderBy("createdAt", "desc"));
    const unsubscribeScores = onSnapshot(scoresQuery, (snapshot) => {
        const allScores = snapshot.docs.map(doc => doc.data() as ScoreData);
        const winnersMap: Record<string, string | null> = {};
        
        const scoresByMatchId: Record<string, ScoreData[]> = {};
        allScores.forEach(score => {
             // Handle bye rounds
            if (score.matchId.includes('-bye-')) {
                const roundName = score.matchId.split('-bye-')[0];
                const teamName = score.matchId.split('-bye-')[1];
                 // Find the corresponding group stage round ID
                const roundDoc = bracketData.find(r => r.id === "Fase de Grupos")?.matches.find(m => m.id === roundName);
                if(roundDoc) {
                    winnersMap[roundDoc.id] = teamName;
                }
                return;
            }
            
            if (!scoresByMatchId[score.matchId]) {
                scoresByMatchId[score.matchId] = [];
            }
            scoresByMatchId[score.matchId].push(score);
        });

        for (const matchId in scoresByMatchId) {
            const matchScores = scoresByMatchId[matchId];
            const teamTotals: Record<string, number> = {};
            
            matchScores.forEach(score => {
                score.teams.forEach(team => {
                    if (!teamTotals[team.name]) teamTotals[team.name] = 0;
                    teamTotals[team.name] += team.total;
                });
            });

            const entries = Object.entries(teamTotals);
            if (entries.length > 0) {
                 const winner = entries.reduce((a, b) => a[1] > b[1] ? a : b);
                 winnersMap[matchId] = winner[0];
            }
        }
        setWinners(winnersMap);
    });

    const debateStateRef = doc(db, "debateState", "current");
    const unsubscribeDebateState = onSnapshot(debateStateRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            setBracketSettings(prev => ({
                ...prev,
                bracketTitle: data.bracketTitle,
                bracketSubtitle: data.bracketSubtitle,
                bracketTitleSize: data.bracketTitleSize,
            }));
        }
    });

    const settingsRef = doc(db, "settings", "competition");
    const unsubscribeSettings = onSnapshot(settingsRef, (doc) => {
        setBracketSettings(prev => ({
            ...prev,
            resultsPublished: doc.exists() ? (doc.data().resultsPublished || false) : false,
        }));
    });
    
    // Force re-render after mount to ensure connectors can be drawn
    setTimeout(() => forceRender(c => c + 1), 500);

    return () => {
        unsubscribeBracket();
        unsubscribeScores();
        unsubscribeDebateState();
        unsubscribeSettings();
    };
  }, []);

  const populatedBracket = useMemo(() => {
    if (!bracketData || bracketData.length === 0) return [];
    
    const newBracketData = JSON.parse(JSON.stringify(bracketData)) as BracketRound[];

    for (let i = 0; i < newBracketData.length - 1; i++) {
        const currentRound = newBracketData[i];
        const nextRound = newBracketData[i+1];

        currentRound.matches.forEach(match => {
            const winnerName = winners[match.id];
            if (winnerName && match.nextMatchId) {
                const nextMatch = nextRound.matches.find(m => m.id === match.nextMatchId);
                if (nextMatch) {
                    const emptySlotIndex = nextMatch.participants.findIndex(p => p === null);
                    if (emptySlotIndex !== -1) {
                         const winnerParticipant = match.participants.find(p => p?.name === winnerName);
                         if(winnerParticipant) {
                            nextMatch.participants[emptySlotIndex] = winnerParticipant;
                         } else { // Winner might be a bye, find them in all teams
                             // This part might need better logic if byes are more complex
                         }
                    }
                }
            }
        });
    }
    return newBracketData;
  }, [bracketData, winners]);

  const titleSizeMap: Record<number, string> = {
    1: "text-xl", 2: "text-2xl", 3: "text-3xl", 4: "text-4xl", 5: "text-5xl"
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
  
  if (populatedBracket.length === 0) {
    return (
        <div className="bg-card p-4 md:p-8 rounded-lg w-full min-h-[400px] flex justify-center items-center">
            <div className="text-center">
                 <h2 className={cn("font-bold text-foreground", titleSizeMap[bracketSettings.bracketTitleSize || 3])}>{bracketSettings.bracketTitle || '¿QUÉ SIGNIFICA SER JOVEN DEL SIGLO XXI?'}</h2>
                 <p className="text-lg text-muted-foreground mt-2">{bracketSettings.bracketSubtitle || 'Debate Intercolegial'}</p>
                 <p className="text-lg text-muted-foreground mt-8">Esperando el sorteo para generar el bracket.</p>
            </div>
        </div>
    )
  }

  const finalRound = populatedBracket[populatedBracket.length - 1];
  const championName = finalRound.matches.length === 1 ? (winners[finalRound.matches[0].id] || null) : null;
  const champion = championName ? finalRound.matches[0].participants.find(p => p?.name === championName) : null;


  return (
    <div className="bg-card p-4 md:p-8 rounded-lg w-full">
        <div className="text-center mb-12">
            <h2 className={cn("font-bold text-foreground", titleSizeMap[bracketSettings.bracketTitleSize || 3])}>{bracketSettings.bracketTitle || '¿QUÉ SIGNIFICA SER JOVEN DEL SIGLO XXI?'}</h2>
            <p className="text-lg text-muted-foreground mt-2">{bracketSettings.bracketSubtitle || 'Debate Intercolegial'}</p>
        </div>
        
        <div className="overflow-x-auto pb-8">
            <div className="relative inline-flex flex-nowrap items-start space-x-12 px-4 bracket-container">
                {populatedBracket.map((round, index) => (
                    <RoundColumn 
                        key={round.id} 
                        round={round} 
                        showScore={showResults} 
                        winners={winners} 
                        isFinalRound={index === populatedBracket.length - 1} 
                    />
                ))}
                {/* Connector lines are now absolutely positioned and will be implemented later if needed */}
            </div>
        </div>
        
        {showResults && championName && (
          <div className="flex flex-col items-center mt-12 animate-in fade-in-50 duration-500 border-t-2 border-dashed border-amber-400 pt-8">
            <Trophy className="h-16 w-16 text-amber-400"/>
            <h3 className="font-headline text-2xl font-bold mt-2">GANADOR DEL TORNEO</h3>
            <p className="text-xl font-semibold text-primary">{championName}</p>
          </div>
        )}
    </div>
  );
}

    