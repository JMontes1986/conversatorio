'use client';
import { useMemo, type ReactNode } from 'react';
import { useAuth } from './auth-context';
import { loginJudge, logoutJudge } from '@/lib/accounts';

export function JudgeProvider({ children }: { children: ReactNode }) { return children; }
export function useJudgeAuth() {
  const { profile, loading } = useAuth();
  const judge = useMemo(() => profile?.role === 'judge' && profile.subject_id ? {
    id: profile.subject_id, name: profile.display_name, cedula: profile.identifier || '', status: 'active' as const,
  } : null, [profile]);
  return { judge, loading, logout: logoutJudge, login: (cedula: string, password: string) => loginJudge(cedula, password) };
}
