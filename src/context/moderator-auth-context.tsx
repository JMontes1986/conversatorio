
"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Loader2 } from 'lucide-react';

interface Moderator {
  id: string;
  username: string;
}

interface ModeratorAuthContextType {
  moderator: Moderator | null;
  loading: boolean;
  login: (username: string, token: string) => Promise<boolean>;
  logout: () => void;
}

const ModeratorAuthContext = createContext<ModeratorAuthContextType | undefined>(undefined);

const MODERATOR_STORAGE_KEY = 'moderator-auth';

export function ModeratorProvider({ children }: { children: ReactNode }) {
  const [moderator, setModerator] = useState<Moderator | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
     const storedModerator = localStorage.getItem(MODERATOR_STORAGE_KEY);
      if (storedModerator) {
          try {
              setModerator(JSON.parse(storedModerator));
          } catch(e) {
              localStorage.removeItem(MODERATOR_STORAGE_KEY);
          }
      }
      setLoading(false);
  }, []);

  const login = async (username: string, token: string): Promise<boolean> => {
    setLoading(true);
    try {
      const q = query(
        collection(db, "moderators"),
        where("username", "==", username),
        where("token", "==", token),
        where("status", "==", "active")
      );
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const modDoc = querySnapshot.docs[0];
        const moderatorData: Moderator = { 
            id: modDoc.id,
            username: modDoc.data().username,
        };
        localStorage.setItem(MODERATOR_STORAGE_KEY, JSON.stringify(moderatorData));
        setModerator(moderatorData);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Moderator login failed:", error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem(MODERATOR_STORAGE_KEY);
    setModerator(null);
  };
  
  if (loading && typeof window !== 'undefined') {
    return (
        <div className="flex justify-center items-center h-screen">
            <Loader2 className="h-8 w-8 animate-spin" />
        </div>
    )
  }

  return (
    <ModeratorAuthContext.Provider value={{ moderator, loading, login, logout }}>
      {children}
    </ModeratorAuthContext.Provider>
  );
}

export function useModeratorAuth() {
  const context = useContext(ModeratorAuthContext);
  if (context === undefined) {
    throw new Error('useModeratorAuth must be used within a ModeratorProvider');
  }
  return context;
}

    