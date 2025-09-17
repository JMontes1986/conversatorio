
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface LogEntry {
  id: string;
  action: string;
  timestamp: {
    seconds: number;
    nanoseconds: number;
  } | null;
  details?: Record<string, any>;
}

export function AuditLogViewer() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const logsQuery = query(collection(db, "audit-logs"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(logsQuery, (snapshot) => {
      const logsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as LogEntry));
      setLogs(logsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching audit logs:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const formatTimestamp = (timestamp: LogEntry['timestamp']) => {
    if (!timestamp) {
      return "Fecha no disponible";
    }
    const date = new Date(timestamp.seconds * 1000);
    return format(date, "PPP p", { locale: es });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-6 w-6"/>
            Registro de Auditoría
        </CardTitle>
        <CardDescription>
          Historial de acciones importantes realizadas en la plataforma.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center items-center py-10">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto">
            <Table>
                <TableHeader className="sticky top-0 bg-card">
                    <TableRow>
                    <TableHead className="w-[200px]">Fecha y Hora</TableHead>
                    <TableHead>Acción Realizada</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                {logs.length > 0 ? (
                    logs.map(log => (
                    <TableRow key={log.id}>
                        <TableCell className="text-xs text-muted-foreground">{formatTimestamp(log.timestamp)}</TableCell>
                        <TableCell className="font-medium">{log.action}</TableCell>
                    </TableRow>
                    ))
                ) : (
                    <TableRow>
                    <TableCell colSpan={2} className="text-center h-24 text-muted-foreground">
                        No hay registros de actividad todavía.
                    </TableCell>
                    </TableRow>
                )}
                </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
