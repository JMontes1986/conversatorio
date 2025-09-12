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

const isSharePointEmbedUrl = (url: string): boolean => {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname.endsWith('.sharepoint.com') && urlObj.pathname.includes('/embed.aspx');
    } catch (e) {
        return false;
    }
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
  
  if (isSharePointEmbedUrl(url)) {
    return (
         <div className="aspect-video w-full">
            <iframe
            src={url}
            width="962"
            height="541"
            frameBorder="0"
            scrolling="no"
            allowFullScreen
            title="OneDrive/SharePoint Video"
            className="w-full h-full rounded-lg"
            ></iframe>
        </div>
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
