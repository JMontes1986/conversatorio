

"use client";

import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Dices, Loader2, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { addDoc, collection, doc, setDoc, deleteDoc } from 'firebase/firestore';

interface TieBreakerProps {
  roundName: string;
  team1: string;
  team2: string;
}

const TIEBREAK_DOC_ID = "current";
const tiebreakRef = doc(db, "tiebreak", TIEBREAK_DOC_ID);

export const TieBreaker: React.FC<TieBreakerProps> = ({ roundName, team1, team2 }) => {
  const { toast } = useToast();
  const [isRolling, setIsRolling] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [results, setResults] = useState<{ team1: number; team2: number } | null>(null);
  const [winner, setWinner] = useState<string | null>(null);

  useEffect(() => {
    // Set initial state for public view
    setDoc(tiebreakRef, {
        isActive: true,
        roundName,
        team1,
        team2,
        results: null,
        winner: null,
        isRolling: false,
    });
    // Cleanup on component unmount
    return () => {
        deleteDoc(tiebreakRef);
    }
  }, [roundName, team1, team2]);


  useEffect(() => {
    if (results) {
      if (results.team1 > results.team2) {
        setWinner(team1);
        setDoc(tiebreakRef, { winner: team1 }, { merge: true });
      } else if (results.team2 > results.team1) {
        setWinner(team2);
        setDoc(tiebreakRef, { winner: team2 }, { merge: true });
      } else {
        setWinner(null); // Tie, prompt for re-roll
        setDoc(tiebreakRef, { winner: null }, { merge: true });
      }
    }
  }, [results, team1, team2]);

  const rollDice = async () => {
    setIsRolling(true);
    setResults(null);
    setWinner(null);
    await setDoc(tiebreakRef, { isRolling: true, results: null, winner: null }, { merge: true });

    setTimeout(async () => {
        const newResults = {
            team1: Math.floor(Math.random() * 6) + 1,
            team2: Math.floor(Math.random() * 6) + 1,
        };
      setResults(newResults);
      await setDoc(tiebreakRef, { isRolling: false, results: newResults }, { merge: true });
      setIsRolling(false);
    }, 2000);
  };

  const confirmWinner = async () => {
    if (!winner) return;

    setIsSaving(true);
    try {
      const tieBreakerScore = {
        matchId: roundName,
        judgeId: 'system',
        judgeName: 'Desempate por Dado',
        judgeCedula: 'N/A',
        teams: [
          { name: winner, total: 1 }, // Add 1 point to the winner
          { name: winner === team1 ? team2 : team1, total: 0 },
        ],
        fullScores: [{
            name: winner,
            total: 1,
            scores: { tiebreaker: 1 },
            checksum: 'TIEBREAK'
        }],
        createdAt: new Date(),
      };
      await addDoc(collection(db, 'scores'), tieBreakerScore);
      
      // Clean up tiebreak state
      await deleteDoc(tiebreakRef);

      toast({
        title: '¡Ganador Confirmado!',
        description: `${winner} avanza a la siguiente ronda.`,
      });
    } catch (error) {
      console.error('Error saving tie-breaker score:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo guardar el resultado del desempate.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4 text-center">
      <div className="grid grid-cols-2 gap-4 items-center">
        <div className={cn("p-3 rounded-lg", winner === team1 && 'bg-green-200 dark:bg-green-800')}>
          <p className="font-bold">{team1}</p>
          {isRolling && <Dices className="h-10 w-10 mx-auto my-2 animate-spin" />}
          {results && <p className="text-4xl font-bold my-2">{results.team1}</p>}
        </div>
        <div className={cn("p-3 rounded-lg", winner === team2 && 'bg-green-200 dark:bg-green-800')}>
          <p className="font-bold">{team2}</p>
          {isRolling && <Dices className="h-10 w-10 mx-auto my-2 animate-spin" />}
          {results && <p className="text-4xl font-bold my-2">{results.team2}</p>}
        </div>
      </div>
      
      {!results && (
        <Button onClick={rollDice} disabled={isRolling}>
          <Dices className="mr-2 h-4 w-4" />
          Lanzar Dados
        </Button>
      )}

      {results && !winner && (
        <div className='text-center space-y-2'>
            <p className='font-bold text-lg text-amber-600'>¡Otro Empate!</p>
            <Button onClick={rollDice} disabled={isRolling}>
             <Dices className="mr-2 h-4 w-4" />
             Lanzar de Nuevo
            </Button>
        </div>
      )}

      {winner && (
        <div className="text-center space-y-3 pt-2">
          <p className="text-lg font-bold">Ganador: <span className="text-green-600">{winner}</span></p>
          <Button onClick={confirmWinner} disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Crown className="mr-2 h-4 w-4" />}
            Confirmar Ganador y Avanzar
          </Button>
        </div>
      )}
    </div>
  );
};
