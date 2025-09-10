

"use client";

import { cn } from "@/lib/utils";
import Image from "next/image";
import { Loader2, Trophy, ArrowDown, Users, Swords } from "lucide-react";
import React, { useEffect, useState, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, doc, orderBy, writeBatch, getDoc, setDoc, getDocs } from "firebase/firestore";

// --- TYPES ---
type Participant = {
  id: string | null;
  name: string;
};

type Match = {
  id: string;
  participants: (Participant | null)[];
  nextMatchId?: string | null;
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
const ParticipantCard = ({ participant, showScore, winner, isTripleThreatWinner }: { participant: Participant | null, showScore: boolean, winner?: string | null, isTripleThreatWinner?: boolean }) => {
    if (!participant || !participant.name) {
        return <div className="flex items-center justify-center w-40 text-sm h-10 px-2 rounded-md bg-secondary/50 text-muted-foreground italic">Por definir</div>;
    }

    const isWinner = showScore && (participant.name === winner || isTripleThreatWinner);
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

const MatchCard = ({ match, showScore, winners }: { match: Match, showScore: boolean, winners: (string | null)[] }) => {
    const isTripleThreat = match.participants.length === 3;

    if (isTripleThreat) {
         return (
            <div className="flex flex-col items-center gap-2 relative">
                {match.participants.map((p, i) => (
                    <React.Fragment key={p?.id || i}>
                        <ParticipantCard participant={p} showScore={showScore} isTripleThreatWinner={winners.includes(p?.name || '')} />
                        {i < match.participants.length - 1 && <span className="text-xs font-bold text-muted-foreground">VS</span>}
                    </React.Fragment>
                ))}
            </div>
         )
    }

    return (
        <div className="flex flex-col items-center gap-2 relative">
            <ParticipantCard participant={match.participants[0]} showScore={showScore} winner={winners[0]} />
            <span className="text-xs font-bold text-muted-foreground">VS</span>
            <ParticipantCard participant={match.participants[1]} showScore={showScore} winner={winners[0]} />
        </div>
    )
};


const RoundRow = ({ round, showScore, winners }: { round: BracketRound, showScore: boolean, winners: Record<string, (string | null)[]> }) => {
    
    // Determine the type of visual to show based on the title
    const isGroupStage = round.title.toLowerCase().includes('grupo');
    const Icon = isGroupStage ? Users : Swords;
    const title = isGroupStage ? round.title : round.title;

    return (
        <div className="flex flex-col items-center gap-8 w-full">
            <h3 className="text-center font-headline text-lg font-bold text-primary uppercase tracking-wider flex items-center gap-2">
                <Icon className="h-5 w-5" /> {title}
            </h3>
            <div className="flex flex-wrap justify-center gap-x-12 gap-y-8">
                {round.matches.map((match) => (
                    <MatchCard key={match.id} match={match} showScore={showScore} winners={winners[match.id] || []} />
                ))}
            </div>
        </div>
    );
};


export function TournamentBracket() {
  const [bracketData, setBracketData] = useState<BracketRound[]>([]);
  const [loading, setLoading] = useState(true);
  const [winners, setWinners] = useState<Record<string, (string | null)[]>>({});
  const [bracketSettings, setBracketSettings] = useState<BracketSettings>({});

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
    
    // 1. Group Stage
    const groupRounds = allRounds.filter(r => r.phase === "Fase de Grupos");
    groupRounds.forEach(round => {
        const teamsInRound = drawnTeams.filter(t => t.round === round.name);
        if (teamsInRound.length > 0) {
            newBracketData.push({
                id: round.id,
                title: round.name,
                matches: [{
                    id: round.name,
                    participants: teamsInRound.map(t => ({ id: t.id, name: t.name })),
                }]
            });
        }
    });

    // 2. Knockout Stages
    const knockoutPhases = ["Cuartos de Final", "Semifinal", "Final"];
    let previousRoundMatches: Match[] = [];

    knockoutPhases.forEach(phase => {
        const roundsInPhase = allRounds.filter(r => r.phase === phase);
        if (roundsInPhase.length > 0) {
            const currentPhaseMatches: Match[] = [];
            
            // For now, let's just create empty matches for the structure
            const numMatches = roundsInPhase.length; // Assume 1 round = 1 match for knockouts
            for (let i = 0; i < numMatches; i++) {
                 currentPhaseMatches.push({
                    id: roundsInPhase[i].name,
                    participants: [null, null], // Start empty
                 });
            }

            // Link previous round matches to current ones
            if (previousRoundMatches.length > 0) {
                for (let i = 0; i < previousRoundMatches.length; i++) {
                    const match = previousRoundMatches[i];
                    match.nextMatchId = currentPhaseMatches[Math.floor(i / 2)].id;
                }
            }

            newBracketData.push({
                id: phase,
                title: phase,
                matches: currentPhaseMatches,
            });

            previousRoundMatches = currentPhaseMatches;
        }
    });

    const bracketDocRef = doc(db, "bracketState", "liveBracket");
    await setDoc(bracketDocRef, { bracketRounds: newBracketData });

    setBracketData(newBracketData);
    setLoading(false);
  };


  useEffect(() => {
    const bracketDocRef = doc(db, "bracketState", "liveBracket");
    const unsubscribeBracket = onSnapshot(bracketDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.bracketRounds && data.bracketRounds.length > 0) {
              setBracketData(data.bracketRounds || []);
              setLoading(false);
            } else {
              generateBracketFromScratch();
            }
        } else {
            generateBracketFromScratch();
        }
    });

    const scoresQuery = query(collection(db, "scores"), orderBy("createdAt", "desc"));
    const unsubscribeScores = onSnapshot(scoresQuery, (snapshot) => {
        const allScores = snapshot.docs.map(doc => doc.data() as ScoreData);
        const winnersMap: Record<string, (string | null)[]> = {};
        
        const scoresByMatch = allScores.reduce((acc, score) => {
            const matchId = score.matchId.startsWith('Grupo') ? score.teams.map(t => t.name).sort().join(' vs ') : score.matchId;
            
            if (!acc[matchId]) acc[matchId] = [];
            acc[matchId].push(score);
            return acc;
        }, {} as Record<string, ScoreData[]>);


        for (const matchId in scoresByMatch) {
            const matchScores = scoresByMatch[matchId];
            const teamTotals: Record<string, number> = {};
            
            matchScores.forEach(score => {
                score.teams.forEach(team => {
                    if (!teamTotals[team.name]) teamTotals[team.name] = 0;
                    teamTotals[team.name] += team.total;
                });
            });

            const entries = Object.entries(teamTotals);
            if (entries.length > 0) {
                 if (matchId.includes('-bye-')) { // Handle Bye
                     winnersMap[matchId] = [entries[0][0]];
                 } else if (entries.length === 3) { // Triple threat
                     const sorted = entries.sort((a,b) => b[1] - a[1]);
                     winnersMap[matchId] = [sorted[0][0], sorted[1][0]]; // Top 2 win
                 } else { // Standard match
                     const winner = entries.reduce((a, b) => a[1] > b[1] ? a : b);
                     winnersMap[matchId] = [winner[0]];
                 }
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
        if (doc.exists()) {
            const data = doc.data();
            setBracketSettings(prev => ({
                ...prev,
                resultsPublished: data.resultsPublished || false,
            }));
        } else {
             setBracketSettings(prev => ({
                ...prev,
                resultsPublished: false,
            }));
        }
    });

    return () => {
        unsubscribeBracket();
        unsubscribeScores();
        unsubscribeDebateState();
        unsubscribeSettings();
    };
  }, []);

  const populatedBracket = useMemo(() => {
    if (!bracketData || bracketData.length === 0) return [];
    
    // Deep copy to avoid mutating state directly
    const newBracketData = JSON.parse(JSON.stringify(bracketData)) as BracketRound[];

    for (let i = 0; i < newBracketData.length - 1; i++) {
        const currentRound = newBracketData[i];
        const nextRound = newBracketData[i+1];

        currentRound.matches.forEach(match => {
            // Adjust matchId for group stages to match winner calculation
            const matchIdentifier = match.id.startsWith('Grupo') 
                ? match.participants.map(p => p?.name || '').sort().join(' vs ')
                : match.id;
            
            const matchWinners = winners[matchIdentifier] || [];
            if (matchWinners.length > 0 && match.nextMatchId) {
                const nextMatch = nextRound.matches.find(m => m.id === match.nextMatchId);
                if (nextMatch) {
                    matchWinners.forEach(winnerName => {
                        if (!winnerName) return;
                        const emptySlotIndex = nextMatch.participants.findIndex(p => p === null);
                        if (emptySlotIndex !== -1) {
                             const winnerParticipant = match.participants.find(p => p?.name === winnerName);
                             if(winnerParticipant) {
                                nextMatch.participants[emptySlotIndex] = winnerParticipant;
                             }
                        }
                    })
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
  const championName = finalRound.matches.length === 1 ? (winners[finalRound.matches[0].id] || [null])[0] : null;
  const champion = championName ? finalRound.matches[0].participants.find(p => p?.name === championName) : null;


  return (
    <div className="bg-card p-4 md:p-8 rounded-lg w-full overflow-x-auto">
        <div className="text-center mb-12">
            <h2 className={cn("font-bold text-foreground", titleSizeMap[bracketSettings.bracketTitleSize || 3])}>{bracketSettings.bracketTitle || '¿QUÉ SIGNIFICA SER JOVEN DEL SIGLO XXI?'}</h2>
            <p className="text-lg text-muted-foreground mt-2">{bracketSettings.bracketSubtitle || 'Debate Intercolegial'}</p>
        </div>
        
        <div className="flex flex-col items-center gap-8">
            {populatedBracket.map((round, roundIndex) => (
                <div key={round.id} className="flex flex-col items-center gap-8 w-full">
                    <RoundRow round={round} showScore={showResults} winners={winners} />
                    {roundIndex < populatedBracket.length - 1 && (
                         <ArrowDown className="h-8 w-8 text-border animate-bounce" />
                    )}
                </div>
            ))}
        </div>
        
        {showResults && champion && (
          <div className="flex flex-col items-center mt-12 animate-in fade-in-50 duration-500 border-t-2 border-dashed border-amber-400 pt-8">
            <Trophy className="h-16 w-16 text-amber-400"/>
            <h3 className="font-headline text-2xl font-bold mt-2">GANADOR DEL TORNEO</h3>
            <p className="text-xl font-semibold text-primary">{champion.name}</p>
          </div>
        )}
    </div>
  );
}
