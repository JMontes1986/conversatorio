
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { Loader2, QrCode, Zap, XCircle, Image as ImageIcon, Expand, Minimize } from 'lucide-react';
import { Timer } from '@/components/timer';
import { VideoEmbed } from '@/components/video-embed';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { cn } from '@/lib/utils';

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
  sidebarImageUrl?: string;
  studentQuestionOverlay?: string;
}

export default function DebatePage() {
  const [debateState, setDebateState] = useState<DebateState | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);

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
          sidebarImageUrl: "",
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
  
    const handleClearStudentQuestion = async () => {
        try {
            const docRef = doc(db, "debateState", DEBATE_STATE_DOC_ID);
            await setDoc(docRef, { 
                studentQuestionOverlay: ""
            }, { merge: true });
        } catch (error) {
            console.error("Error clearing student question:", error);
        }
    };


  if (loading || !debateState) {
    return (
      <div className="flex justify-center items-center h-screen bg-secondary">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  const { question, questionId, videoUrl, timer, isQrEnabled, sidebarImageUrl, studentQuestionOverlay } = debateState;
  const showVideo = !!videoUrl;
  const showQr = isQrEnabled && !!questionId;

  return (
    <div className="relative flex flex-col h-screen bg-secondary text-foreground p-4 md:p-8 overflow-hidden">
        {/* Student Question Overlay */}
        {studentQuestionOverlay && (
             <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-20 flex items-center justify-center p-4">
                <div className="bg-background rounded-lg shadow-2xl p-8 max-w-3xl w-full text-center animate-in fade-in-50 zoom-in-95 relative">
                     <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-8 w-8 text-muted-foreground" onClick={handleClearStudentQuestion}>
                        <XCircle className="h-5 w-5" />
                        <span className="sr-only">Cerrar</span>
                    </Button>
                    <Zap className="h-10 w-10 text-primary mx-auto mb-4" />
                    <h2 className="font-headline text-2xl font-bold mb-2">Pregunta del Público</h2>
                    <p className="text-3xl font-semibold whitespace-pre-wrap">
                        "{studentQuestionOverlay}"
                    </p>
                </div>
            </div>
        )}

        <div className={cn("flex-grow grid grid-cols-1 gap-6 h-full", !isFullScreen && "lg:grid-cols-4")}>
            
            {/* Main Content: Question or Video */}
            <div className={cn(
                "relative bg-background rounded-lg shadow-2xl flex flex-col items-center justify-center p-6 md:p-12 text-center",
                !isFullScreen && "lg:col-span-3",
                isFullScreen && "fixed inset-0 z-10 p-12 md:p-20"
            )}>
                 <Button variant="ghost" size="icon" className="absolute top-4 right-4 h-10 w-10 text-muted-foreground z-20" onClick={() => setIsFullScreen(!isFullScreen)}>
                    {isFullScreen ? <Minimize className="h-6 w-6" /> : <Expand className="h-6 w-6" />}
                    <span className="sr-only">{isFullScreen ? "Minimizar" : "Expandir"}</span>
                </Button>

                 {showVideo ? (
                    <div className="w-full h-full flex items-center justify-center">
                        <VideoEmbed url={videoUrl} />
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full">
                        <h1 className="font-headline text-4xl md:text-5xl lg:text-7xl font-bold whitespace-pre-wrap">
                            {question}
                        </h1>
                    </div>
                )}
            </div>

            {/* Sidebar: QR Code and Timer */}
            {!isFullScreen && (
              <div className="flex flex-col gap-6">
                 <div className="bg-background rounded-lg shadow-2xl p-6 flex flex-col items-center justify-center flex-grow text-center">
                    {showQr ? (
                        <>
                            <QrCode className="h-8 w-8 text-primary mb-2"/>
                            <h2 className="font-headline text-xl font-bold mb-3">¡Escanea y Pregunta!</h2>
                            <div className="bg-white p-2 rounded-md">
                                <QRCodeSVG value={getLiveUrl()} size={200} />
                            </div>
                        </>
                    ) : sidebarImageUrl ? (
                        <div className="relative w-full h-full">
                            <Image
                                src={sidebarImageUrl}
                                alt="Imagen de barra lateral"
                                fill
                                className="object-contain"
                            />
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                            <ImageIcon className="h-8 w-8 mb-2"/>
                            <p className="text-sm">Espacio de imagen</p>
                        </div>
                    )}
                 </div>
                 <div className="bg-background rounded-lg shadow-2xl p-4 flex-shrink-0">
                   <Timer
                        key={timer?.lastUpdated || 0}
                        initialTime={timer?.duration || 300}
                        title="Tiempo Restante"
                        showControls={false}
                        size="small"
                    />
                </div>
              </div>
            )}
        </div>
        
        {/* Floating elements for fullscreen mode */}
        {isFullScreen && (
            <>
                {showQr && (
                     <div className="fixed bottom-4 left-4 z-20 bg-background/80 backdrop-blur-sm rounded-lg shadow-2xl p-4 flex flex-col items-center text-center animate-in fade-in-50">
                        <QrCode className="h-6 w-6 text-primary mb-1"/>
                        <h2 className="font-headline text-md font-bold mb-2">¡Escanea y Pregunta!</h2>
                         <div className="bg-white p-1 rounded-md">
                            <QRCodeSVG value={getLiveUrl()} size={128} />
                        </div>
                    </div>
                )}
                 <div className="fixed bottom-4 right-4 z-20">
                   <Timer
                        key={`fs-${timer?.lastUpdated || 0}`}
                        initialTime={timer?.duration || 300}
                        title="Tiempo Restante"
                        showControls={false}
                        size="small"
                    />
                </div>
            </>
        )}

    </div>
  );
}
