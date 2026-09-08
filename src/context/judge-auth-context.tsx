'use client';
import { useMemo, type ReactNode } from 'react';
import { useAuth } from './auth-context';
import { loginParticipant } from '@/lib/accounts';

export function JudgeProvider({ children }: { children: ReactNode }) { return children; }
export function useJudgeAuth() {
  const { profile, loading, logout } = useAuth();
  const judge = useMemo(() => profile?.role === 'judge' && profile.subject_id ? {
    id: profile.subject_id, name: profile.display_name, cedula: profile.identifier || '', status: 'active' as const,
  } : null, [profile]);
  return { judge, loading, logout, login: (cedula: string, token: string) => loginParticipant('judge', cedula, token) };
}
