
"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Loader2 } from 'lucide-react';

interface Judge {
  name: string;
  cedula: string;
}

interface JudgeAuthContextType {
  judge: Judge | null;
  loading: boolean;
  login: (cedula: string) => Promise<boolean>;
  logout: () => void;
}

const JudgeAuthContext = createContext<JudgeAuthContextType | undefined>(undefined);

const JUDGE_STORAGE_KEY = 'judge-auth';

export function JudgeProvider({ children }: { children: ReactNode }) {
  const [judge, setJudge] = useState<Judge | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
        const storedJudge = localStorage.getItem(JUDGE_STORAGE_KEY);
        if (storedJudge) {
            setJudge(JSON.parse(storedJudge));
        }
    } catch (error) {
        console.error("Could not parse judge from localStorage", error);
        localStorage.removeItem(JUDGE_STORAGE_KEY);
    } finally {
        setLoading(false);
    }
  }, []);

  const login = async (cedula: string): Promise<boolean> => {
    setLoading(true);
    try {
      const q = query(
        collection(db, "judges"),
        where("cedula", "==", cedula)
      );
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const judgeDoc = querySnapshot.docs[0];
        const judgeData: Judge = { 
            cedula: judgeDoc.data().cedula,
            name: judgeDoc.data().name
        };
        localStorage.setItem(JUDGE_STORAGE_KEY, JSON.stringify(judgeData));
        setJudge(judgeData);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Judge login failed:", error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem(JUDGE_STORAGE_KEY);
    setJudge(null);
  };
  
  if (loading) {
    return (
        <div className="flex justify-center items-center h-screen">
            <Loader2 className="h-8 w-8 animate-spin" />
        </div>
    )
  }

  return (
    <JudgeAuthContext.Provider value={{ judge, loading, login, logout }}>
      {children}
    </JudgeAuthContext.Provider>
  );
}

export function useJudgeAuth() {
  const context = useContext(JudgeAuthContext);
  if (context === undefined) {
    throw new Error('useJudgeAuth must be used within a JudgeProvider');
  }
  return context;
}

    