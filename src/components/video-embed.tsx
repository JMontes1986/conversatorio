"use client";

import React, { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { normalizeVideoSource } from "@/lib/external-video";

interface VideoEmbedProps {
  url: string;
}

export const VideoEmbed: React.FC<VideoEmbedProps> = ({ url }) => {
  const [failed, setFailed] = useState(false);

  const source = useMemo(() => {
    try {
      return normalizeVideoSource(url);
    } catch {
      return null;
    }
  }, [url]);

  if (!source) {
    return (
      <div className="flex min-h-[300px] w-full items-center justify-center rounded-lg border border-dashed p-6 text-center text-muted-foreground">
        <div>
          <AlertTriangle className="mx-auto mb-2 h-6 w-6" />
          <p>No se pudo interpretar el enlace o código de video.</p>
        </div>
      </div>
    );
  }

  if (source.kind === "youtube") {
    return (
      <div className="aspect-video w-full">
        <iframe
          src={`https://www.youtube.com/embed/${source.id}?autoplay=1`}
          title="YouTube video player"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="h-full w-full rounded-lg"
        />
      </div>
    );
  }

  if (source.kind === "iframe") {
    return (
      <div className="aspect-video w-full">
        <iframe
          src={source.url}
          title="Video embebido"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          className="h-full w-full rounded-lg border-0"
          onError={() => setFailed(true)}
        />
      </div>
    );
  }

  if (failed) {
    return (
      <div className="flex min-h-[300px] w-full items-center justify-center rounded-lg border border-dashed p-6 text-center text-muted-foreground">
        <div>
          <AlertTriangle className="mx-auto mb-2 h-6 w-6" />
          <p>
            No se pudo reproducir el video. Si está en OneDrive/SharePoint, asegúrese de compartirlo para acceso público mediante vínculo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="aspect-video w-full">
      <video
        src={source.url}
        controls
        autoPlay
        playsInline
        preload="metadata"
        className="h-full w-full rounded-lg bg-black object-contain"
        onError={() => setFailed(true)}
      >
        Tu navegador no soporta la reproducción de video.
      </video>
    </div>
  );
};
