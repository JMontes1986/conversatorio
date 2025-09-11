
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { RefreshCw } from 'lucide-react';

export function TournamentBracket() {
  const [refreshKey, setRefreshKey] = useState(Date.now());
  
  const canvaBaseUrl = "https://www.canva.com/design/DAGyhqwb22E/5zgo2W1ijIy-JKdmJspVsw/view?embed";

  const handleRefresh = () => {
    setRefreshKey(Date.now());
  };

  useEffect(() => {
    const interval = setInterval(() => {
      handleRefresh();
    }, 60000); // 60000 ms = 1 minuto

    return () => clearInterval(interval); // Limpiar el intervalo al desmontar el componente
  }, []);

  return (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle className="font-headline">Bracket del Torneo</CardTitle>
                <CardDescription>Visualización de las rondas eliminatorias.</CardDescription>
            </div>
            <Button variant="outline" size="icon" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4" />
                <span className="sr-only">Actualizar Bracket</span>
            </Button>
        </CardHeader>
        <CardContent>
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
                    <iframe
                    key={refreshKey}
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
                    src={`${canvaBaseUrl}&r=${refreshKey}`}
                    allowFullScreen
                    allow="fullscreen"
                    ></iframe>
                </div>
            </div>
        </CardContent>
    </Card>
  );
}
