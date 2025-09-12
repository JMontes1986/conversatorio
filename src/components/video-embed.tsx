"use client";

import React from 'react';

interface VideoEmbedProps {
  url: string;
}

const getYouTubeId = (url: string): string | null => {
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname === 'youtu.be') {
      return urlObj.pathname.slice(1);
    }
    if (urlObj.hostname.includes('youtube.com')) {
      const videoId = urlObj.searchParams.get('v');
      if (videoId) return videoId;
    }
  } catch (error) {
    // Not a valid URL, probably not a youtube link
  }
  return null;
};

const isIframeString = (str: string): boolean => {
    return str.trim().startsWith('<iframe');
}


export const VideoEmbed: React.FC<VideoEmbedProps> = ({ url }) => {
  const youTubeId = getYouTubeId(url);

  if (youTubeId) {
    return (
      <div className="aspect-video w-full">
        <iframe
          src={`https://www.youtube.com/embed/${youTubeId}?autoplay=1`}
          title="YouTube video player"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="w-full h-full rounded-lg"
        ></iframe>
      </div>
    );
  }
  
  if (isIframeString(url)) {
    return (
         <div className="aspect-video w-full" dangerouslySetInnerHTML={{ __html: url }} />
    )
  }

  // Fallback to a standard video tag for direct links (e.g., from Firebase Storage)
  return (
    <div className="aspect-video w-full">
        <video
            src={url}
            controls
            autoPlay
            className="w-full h-full rounded-lg bg-black"
        >
            Tu navegador no soporta el tag de video.
        </video>
    </div>
  );
};