
"use client";

import { useModeratorAuth } from '@/context/moderator-auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export function ModeratorAuth({ children }: { children: React.ReactNode }) {
  const { moderator, loading } = useModeratorAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !moderator) {
      router.push('/moderator/login');
    }
  }, [moderator, loading, router]);

  if (loading || !moderator) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
