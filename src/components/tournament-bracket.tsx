
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { RefreshCw, Loader2 } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const DEBATE_STATE_DOC_ID = "current";

export function TournamentBracket() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [canvaUrl, setCanvaUrl] = useState("https://www.canva.com/design/DAGyhqwb22E/W2iKUebuBwmvLcRraqzKGg/view?embed");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const docRef = doc(db, "debateState", DEBATE_STATE_DOC_ID);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists() && docSnap.data().bracketCanvaUrl) {
        const rawUrl = docSnap.data().bracketCanvaUrl;
        const url = new URL(rawUrl);
        const embedUrl = `${url.origin}${url.pathname}/view?embed`;
        setCanvaUrl(embedUrl);
      }
      setLoading(false);
    });

    const interval = setInterval(() => {
      handleRefresh();
    }, 60000); // Auto-refresh every minute

    return () => {
        unsubscribe();
        clearInterval(interval);
    };
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    // This short timeout forces React to unmount and then remount the iframe,
    // which is a more aggressive way to clear the cache.
    setTimeout(() => setIsRefreshing(false), 100);
  };

  return (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle className="font-headline">Bracket del Torneo</CardTitle>
                <CardDescription>Visualización de las rondas eliminatorias.</CardDescription>
            </div>
            <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isRefreshing}>
                {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                <span className="sr-only">Actualizar Bracket</span>
            </Button>
        </CardHeader>
        <CardContent>
            {loading ? (
                <div className="flex justify-center items-center h-96">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            ) : (
                <div className="bg-card p-0 md:p-4 rounded-lg w-full">
                    <div
                        style={{
                        position: 'relative',
                        width: '100%',
                        height: '0',
                        paddingTop: '56.25%',
                        paddingBottom: '0',
                        boxShadow: '0 2px 8px 0 rgba(63,69,81,0.16)',
                        overflow: 'hidden',
                        borderRadius: '8px',
                        willChange: 'transform',
                        }}
                    >
                        {!isRefreshing && (
                            <iframe
                                loading="lazy"
                                style={{
                                    position: 'absolute',
                                    width: '100%',
                                    height: '100%',
                                    top: '0',
                                    left: '0',
                                    border: 'none',
                                    padding: '0',
                                    margin: '0',
                                }}
                                src={canvaUrl}
                                allowFullScreen
                                allow="fullscreen"
                            ></iframe>
                        )}
                    </div>
                </div>
            )}
        </CardContent>
    </Card>
  );
}
