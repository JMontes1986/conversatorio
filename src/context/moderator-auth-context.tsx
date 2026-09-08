'use client';
import { useMemo, type ReactNode } from 'react';
import { useAuth } from './auth-context';
import { loginParticipant } from '@/lib/accounts';

export function ModeratorProvider({ children }: { children: ReactNode }) { return children; }
export function useModeratorAuth() {
  const { profile, loading, logout } = useAuth();
  const moderator = useMemo(() => profile?.role === 'moderator' && profile.subject_id ? {
    id: profile.subject_id, username: profile.identifier || profile.display_name,
  } : null, [profile]);
  return { moderator, loading, logout, login: (username: string, token: string) => loginParticipant('moderator', username, token) };
}
