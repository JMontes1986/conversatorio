
"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

export function TournamentBracket() {
  const canvaEmbedUrl = "https://www.canva.com/design/DAGyhqwb22E/5zgo2W1ijIy-JKdmJspVsw/view?embed";

  return (
    <div className="bg-card p-4 md:p-8 rounded-lg w-full">
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '0',
          paddingTop: '56.25%', // Adjust this percentage for different aspect ratios (e.g., 75% for 4:3)
          paddingBottom: '0',
          boxShadow: '0 2px 8px 0 rgba(63,69,81,0.16)',
          marginTop: '1.6em',
          marginBottom: '0.9em',
          overflow: 'hidden',
          borderRadius: '8px',
          willChange: 'transform',
        }}
      >
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
          src={canvaEmbedUrl}
          allowFullScreen
          allow="fullscreen"
        ></iframe>
      </div>
    </div>
  );
}
