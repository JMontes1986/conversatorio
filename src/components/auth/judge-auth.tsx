
"use client";

import { useJudgeAuth } from '@/context/judge-auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export function JudgeAuth({ children }: { children: React.ReactNode }) {
  const { judge, loading } = useJudgeAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !judge) {
      router.push('/scoring/login');
    }
  }, [judge, loading, router]);

  if (loading || !judge) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}

    