'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';
import type { Profile } from '@/lib/accounts';

type AuthState = { user: User | null; profile: Profile | null; loading: boolean; logout: () => Promise<void> };
const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let disposed = false;
    let generation = 0;
    let cleanup = () => {};
    try {
      const supabase = getSupabase();
      const refresh = async () => {
        const request = ++generation;
        try {
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          if (sessionError) throw sessionError;
          let nextProfile: Profile | null = null;
          if (session) {
            const { data, error: profileError } = await supabase.rpc('current_profile');
            if (profileError) throw profileError;
            nextProfile = data;
          }
          if (!disposed && request === generation) {
            setProfile(previous => JSON.stringify(previous) === JSON.stringify(nextProfile) ? previous : nextProfile);
            setUser(nextProfile?.role === 'admin' ? session?.user ?? null : null);
            setError('');
          }
        } catch (cause) {
          if (!disposed && request === generation) {
            setProfile(null); setUser(null);
            setError(cause instanceof Error ? cause.message : 'No se pudo verificar la sesión.');
          }
        } finally { if (!disposed && request === generation) setLoading(false); }
      };
      const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') setLoading(true);
        setTimeout(() => { void refresh(); }, 0);
      });
      const timer = setInterval(() => { void refresh(); }, 15000);
      window.addEventListener('focus', refresh);
      void refresh();
      cleanup = () => { subscription.unsubscribe(); clearInterval(timer); window.removeEventListener('focus', refresh); };
    } catch (cause) { setError((cause as Error).message); setLoading(false); }
    return () => { disposed = true; cleanup(); };
  }, []);
  const logout = async () => {
    const { error } = await getSupabase().auth.signOut();
    if (error) throw error;
    setUser(null); setProfile(null);
  };
  return <AuthContext.Provider value={{ user, profile, loading, logout }}>
    {error && <div role="alert" className="border-b bg-destructive/10 p-3 text-center text-sm">{error}</div>}
    {children}
  </AuthContext.Provider>;
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
