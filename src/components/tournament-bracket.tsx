
"use client";

import { cn } from "@/lib/utils";
import Image from "next/image";
import { Loader2, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy, doc } from "firebase/firestore";

// --- TYPES ---
type Participant = {
  name: string;
  avatar: string;
  winner?: boolean;
  score?: number;
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
            {Array.from({ length: numMatches / 2 }).map((_, i) => (
                <div key={i} className="relative h-[116px] flex-grow">
                    <div className="absolute top-1/4 left-0 w-1/2 h-px bg-border"></div>
                    <div className="absolute bottom-1/4 left-0 w-1/2 h-px bg-border"></div>
                    <div className="absolute top-1/4 left-1/2 w-px h-1/2 bg-border"></div>
                    <div className="absolute top-1/2 left-1/2 w-1/2 h-px bg-border"></div>
                </div>
            ))}
        </div>
    </div>
);


export function TournamentBracket() {
  const [bracketData, setBracketData] = useState<BracketRound[]>([]);
  const [loading, setLoading] = useState(true);
  const [champion, setChampion] = useState<Participant | null>(null);

  useEffect(() => {
    const scoresQuery = query(collection(db, "scores"), orderBy("createdAt", "desc"));
    const drawStateRef = doc(db, "drawState", "liveDraw");

    const unsubScores = onSnapshot(scoresQuery, scoresSnap => {
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

            const winnerEntry = entries.reduce((a, b) => a[1] > b[1] ? a : b);
            const winnerName = winnerEntry[0];
            
            const participants = entries.map(([name, total]) => ({
                name: name,
                avatar: `https://picsum.photos/seed/${encodeURIComponent(name)}/200`,
                score: total,
                winner: name === winnerName
            }));

            const winner = participants.find(p => p.winner);

            participants.forEach(p => { if (p.name !== winnerName) p.winner = false; });

            return { winner: winner || null, participants };
        };

        const unsubDraw = onSnapshot(drawStateRef, drawSnap => {
            const drawData = drawSnap.exists() ? drawSnap.data() as DrawState : null;
            
            const finalBracketData: BracketRound[] = [];

            // --- Fase de Grupos / Octavos ---
            const groupStage: BracketRound = { title: "Fase de Grupos", matches: [] };
            const groupRounds = drawData?.rounds?.filter(r => r.phase === "Fase de Grupos") || [];
            
            groupRounds.forEach(round => {
                const teamsInDraw = drawData?.teams.filter(t => t.round === round.name) || [];
                const { participants } = getMatchResult(round.name);

                if (participants.length > 0) {
                    groupStage.matches.push({ id: round.name, participants });
                } else {
                    groupStage.matches.push({
                        id: round.name,
                        participants: teamsInDraw.map(t => ({ name: t.name, avatar: `https://picsum.photos/seed/${encodeURIComponent(t.name)}/200` }))
                    });
                }
            });
            if (groupStage.matches.length > 0) finalBracketData.push(groupStage);

            let lastRoundWinners = groupStage.matches.map(m => getMatchResult(m.id).winner).filter(Boolean) as Participant[];
            
            // --- Fases de Eliminación ---
            const phaseTitles = ["Cuartos de Final", "Semifinal", "Final"];
            
            for (const title of phaseTitles) {
                if (lastRoundWinners.length === 0) break;

                const currentRound: BracketRound = { title, matches: [] };
                
                for (let i = 0; i < lastRoundWinners.length; i += 2) {
                    const matchParticipants = lastRoundWinners.slice(i, i + 2);
                    const matchId = `${title.replace(/ /g, '-').toLowerCase()}-${(i/2)+1}`;
                    const { participants: resultParticipants, winner } = getMatchResult(matchId);
                    
                    if (resultParticipants.length > 0) {
                         currentRound.matches.push({ id: matchId, participants: resultParticipants });
                    } else {
                         currentRound.matches.push({ id: matchId, participants: matchParticipants });
                    }
                }
                finalBracketData.push(currentRound);
                lastRoundWinners = currentRound.matches.map(m => getMatchResult(m.id).winner).filter(Boolean) as Participant[];
            }
            
            const finalWinner = getMatchResult("Final-1").winner;
            setChampion(finalWinner || null);

            setBracketData(finalBracketData);
            setLoading(false);
        });

        return () => unsubDraw();
    });

    return () => unsubScores();
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

  return (
    <div className="bg-card p-4 md:p-8 rounded-lg w-full">
        <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground">"¿QUÉ SIGNIFICA SER JOVEN DEL SIGLO XXI?"</h2>
            <p className="text-lg text-muted-foreground">Debate Intercolegial</p>
        </div>
        
        {champion && (
          <div className="flex flex-col items-center mb-12 animate-in fade-in-50 duration-500">
            <Trophy className="h-16 w-16 text-amber-400"/>
            <h3 className="font-headline text-2xl font-bold mt-2">GANADOR</h3>
            <p className="text-xl font-semibold text-primary">{champion.name}</p>
          </div>
        )}

      <div className="flex items-start min-w-max">
        {bracketData.map((round, roundIndex) => (
            <div key={round.title} className="flex items-start">
               <RoundColumn round={round} />
               {roundIndex < bracketData.length -1 && <ConnectorColumn numMatches={round.matches.length} />}
            </div>
        ))}
      </div>
    </div>
  );
}
