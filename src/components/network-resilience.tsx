"use client";

import { useEffect, useState } from "react";
import { CloudOff, SignalLow } from "lucide-react";
import { getNetworkProfile, subscribeToNetworkProfile } from "@/lib/network-profile";

export function NetworkResilience() {
  const [online, setOnline] = useState(true);
  const [lowBandwidth, setLowBandwidth] = useState(false);

  useEffect(() => {
    setOnline(navigator.onLine);
    setLowBandwidth(getNetworkProfile().lowBandwidth);

    const unsubscribeNetwork = subscribeToNetworkProfile((profile) => {
      setOnline(navigator.onLine);
      setLowBandwidth(profile.lowBandwidth);
    });

    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error) => {
        console.error("Service worker registration failed:", error);
      });
    }

    return unsubscribeNetwork;
  }, []);

  if (online && !lowBandwidth) return null;

  return (
    <div className="fixed bottom-3 left-3 z-[100] flex items-center gap-2 rounded-full border bg-background/95 px-3 py-2 text-xs font-medium shadow-lg backdrop-blur">
      {!online ? (
        <>
          <CloudOff className="h-4 w-4 text-amber-600" />
          Sin conexión · trabajando con datos locales disponibles
        </>
      ) : (
        <>
          <SignalLow className="h-4 w-4 text-amber-600" />
          Conexión lenta · modo ahorro automático
        </>
      )}
    </div>
  );
}
