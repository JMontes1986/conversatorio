

"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { Loader2, MessageSquare, QrCode, Zap } from 'lucide-react';
import { Timer } from '@/components/timer';
import { VideoEmbed } from '@/components/video-embed';
import { QRCodeSVG } from 'qrcode.react';

const DEBATE_STATE_DOC_ID = "current";

interface DebateState {
  question: string;
  questionId: string;
  videoUrl: string;
  timer: {
    duration: number;
    lastUpdated: number;
  };
  isQrEnabled: boolean;
  studentQuestionOverlay?: string;
}

export default function DebatePage() {
  const [debateState, setDebateState] = useState<DebateState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const docRef = doc(db, "debateState", DEBATE_STATE_DOC_ID);
    const unsubscribe = onSnapshot(docRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data() as DebateState;
        setDebateState(data);
      } else {
        // Set a default state if the document doesn't exist
        setDebateState({
          question: "Bienvenidas y bienvenidos al Conversatorio Colgemelli. Esperando el inicio del debate.",
          questionId: "",
          videoUrl: "",
          timer: { duration: 5 * 60, lastUpdated: Date.now() },
          isQrEnabled: false,
          studentQuestionOverlay: ""
        });
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const getLiveUrl = () => {
      if (typeof window !== "undefined" && debateState?.questionId) {
          const url = new URL("/live", window.location.origin);
          url.searchParams.set("q_id", debateState.questionId);
          return url.toString();
      }
      return "";
  }

  if (loading || !debateState) {
    return (
      <div className="flex justify-center items-center h-screen bg-secondary">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  const { question, questionId, videoUrl, timer, isQrEnabled, studentQuestionOverlay } = debateState;
  const showVideo = !!videoUrl;
  const showQr = isQrEnabled && !!questionId;

  return (
    <div className="relative flex flex-col h-screen bg-secondary text-foreground p-4 md:p-8 overflow-hidden">
        {/* Student Question Overlay */}
        {studentQuestionOverlay && (
             <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-20 flex items-center justify-center p-4">
                <div className="bg-background rounded-lg shadow-2xl p-8 max-w-3xl w-full text-center animate-in fade-in-50 zoom-in-95">
                    <Zap className="h-10 w-10 text-primary mx-auto mb-4" />
                    <h2 className="font-headline text-2xl font-bold mb-2">Pregunta del Público</h2>
                    <p className="text-3xl font-semibold whitespace-pre-wrap">
                        "{studentQuestionOverlay}"
                    </p>
                </div>
            </div>
        )}

        <div className="flex-grow grid grid-cols-1 lg:grid-cols-4 gap-6 h-full">
            
            {/* Main Content: Question or Video */}
            <div className="lg:col-span-3 bg-background rounded-lg shadow-2xl flex flex-col items-center justify-center p-6 md:p-12 text-center">
                 {showVideo ? (
                    <div className="w-full h-full flex items-center justify-center">
                        <VideoEmbed url={videoUrl} />
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full">
                        <MessageSquare className="h-12 w-12 md:h-20 md:w-20 text-primary mb-6" />
                        <h1 className="font-headline text-3xl md:text-5xl lg:text-7xl font-bold whitespace-pre-wrap">
                            {question}
                        </h1>
                    </div>
                )}
            </div>

            {/* Sidebar: Timer and QR Code */}
            <div className="flex flex-col gap-6">
                <div className="bg-background rounded-lg shadow-2xl p-4 flex-shrink-0">
                   <Timer
                        key={timer?.lastUpdated || 0}
                        initialTime={timer?.duration || 300}
                        title="Tiempo Restante"
                        showControls={false}
                        size="small"
                    />
                </div>
                 {showQr && (
                    <div className="bg-background rounded-lg shadow-2xl p-6 flex flex-col items-center justify-center flex-grow text-center">
                        <QrCode className="h-8 w-8 text-primary mb-2"/>
                        <h2 className="font-headline text-xl font-bold mb-3">¡Escanea y Pregunta!</h2>
                         <div className="bg-white p-2 rounded-md">
                            <QRCodeSVG value={getLiveUrl()} size={200} />
                        </div>
                    </div>
                )}
            </div>

        </div>
    </div>
  );
}
