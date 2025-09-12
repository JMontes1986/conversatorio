
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

const getOneDriveEmbedUrl = (url: string): string | null => {
    try {
        const urlObj = new URL(url);
        if (urlObj.hostname.endsWith('.sharepoint.com') || urlObj.hostname.endsWith('1drv.ms')) {
            let embedUrl = url.replace("/view.aspx?", "/embed.aspx?");
            embedUrl = embedUrl.replace("/v.aspx?", "/embed.aspx?"); // Handle other sharepoint variations
            
            // Add autoplay and make it chromeless
            const embedUrlObj = new URL(embedUrl);
            embedUrlObj.searchParams.set('wdAr', '1.77'); // 16:9 aspect ratio
            embedUrlObj.searchParams.set('autoplay', 'true');
            embedUrlObj.searchParams.set('wdEaa', '1'); // Enable autoplay
            
            return embedUrlObj.toString();
        }
    } catch(error) {
        // Not a valid URL
    }
    return null;
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
  
  const oneDriveEmbedUrl = getOneDriveEmbedUrl(url);

  if (oneDriveEmbedUrl) {
    return (
         <div className="aspect-video w-full">
            <iframe
            src={oneDriveEmbedUrl}
            width="962"
            height="541"
            frameBorder="0"
            scrolling="no"
            allowFullScreen
            title="OneDrive Video"
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
