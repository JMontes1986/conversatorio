
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Dices, Loader2, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { addDoc, collection } from 'firebase/firestore';

interface TieBreakerProps {
  roundName: string;
  team1: string;
  team2: string;
}

const Dice = ({ value }: { value: number }) => {
  const dots = [];
  const dotPositions: { [key: number]: number[][] } = {
    1: [[4]],
    2: [[0, 8], [2, 6]],
    3: [[0, 4, 8], [2, 4, 6]],
    4: [[0, 2, 6, 8]],
    5: [[0, 2, 4, 6, 8]],
    6: [[0, 3, 6, 2, 5, 8]],
  };
  const positions = dotPositions[value][Math.floor(Math.random() * dotPositions[value].length)];
  for (let i = 0; i < 9; i++) {
    dots.push(
      <div
        key={i}
        className={cn(
          'w-2 h-2 rounded-full',
          positions.includes(i) ? 'bg-foreground' : 'bg-transparent'
        )}
      />
    );
  }
  return <div className="w-10 h-10 border-2 rounded-md p-1 grid grid-cols-3 gap-0.5">{dots}</div>;
};

export const TieBreaker: React.FC<TieBreakerProps> = ({ roundName, team1, team2 }) => {
  const { toast } = useToast();
  const [isRolling, setIsRolling] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [results, setResults] = useState<{ team1: number; team2: number } | null>(null);
  const [winner, setWinner] = useState<string | null>(null);

  useEffect(() => {
    if (results) {
      if (results.team1 > results.team2) {
        setWinner(team1);
      } else if (results.team2 > results.team1) {
        setWinner(team2);
      } else {
        setWinner(null); // Tie
      }
    }
  }, [results, team1, team2]);

  const rollDice = () => {
    setIsRolling(true);
    setResults(null);
    setWinner(null);
    setTimeout(() => {
      setResults({
        team1: Math.floor(Math.random() * 6) + 1,
        team2: Math.floor(Math.random() * 6) + 1,
      });
      setIsRolling(false);
    }, 1500);
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
          {results && <div className="flex justify-center my-2"><Dice value={results.team1} /></div>}
        </div>
        <div className={cn("p-3 rounded-lg", winner === team2 && 'bg-green-200 dark:bg-green-800')}>
          <p className="font-bold">{team2}</p>
          {isRolling && <Dices className="h-10 w-10 mx-auto my-2 animate-spin" />}
          {results && <div className="flex justify-center my-2"><Dice value={results.team2} /></div>}
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
