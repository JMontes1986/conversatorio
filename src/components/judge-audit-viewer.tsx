"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "@/lib/documents";
import { db } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { KeyRound, Loader2, ShieldCheck, ShieldX, Vote } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

type Timestamp = { seconds: number; nanoseconds?: number } | null;

type JudgeAuditLog = {
  id: string;
  category?: string;
  action: string;
  subjectId?: string;
  subjectName?: string;
  identifier?: string;
  actorRole?: string;
  timestamp: Timestamp;
  details?: {
    round?: string;
    teams?: Array<{ name: string; total: number }>;
    scoreRecordId?: string;
    reason?: string;
    ip?: string | null;
    userAgent?: string | null;
    identifier?: string;
  };
};

function actionLabel(action: string) {
  switch (action) {
    case "judge_login_success": return "Inicio de sesión correcto";
    case "judge_login_failed": return "Intento de acceso fallido";
    case "judge_logout": return "Cierre de sesión";
    case "judge_score_submitted": return "Votación enviada";
    case "judge_password_changed": return "Contraseña cambiada";
    case "judge_identifier_changed": return "Cédula actualizada";
    case "judge_account_created": return "Cuenta de jurado creada";
    default: return action;
  }
}

function ActionIcon({ action }: { action: string }) {
  if (action === "judge_login_success") return <ShieldCheck className="h-4 w-4 text-emerald-600" />;
  if (action === "judge_login_failed") return <ShieldX className="h-4 w-4 text-destructive" />;
  if (action === "judge_score_submitted") return <Vote className="h-4 w-4 text-primary" />;
  return <KeyRound className="h-4 w-4 text-muted-foreground" />;
}

export function JudgeAuditViewer() {
  const [logs, setLogs] = useState<JudgeAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "audit-logs"), orderBy("timestamp", "desc")),
      (snapshot) => {
        const judgeLogs = snapshot.docs
          .map((entry) => ({ id: entry.id, ...entry.data() } as JudgeAuditLog))
          .filter((entry) => entry.category === "judge_access"
            || entry.category === "judge_action"
            || entry.category === "judge_security");
        setLogs(judgeLogs);
        setLoading(false);
      },
      (error) => {
        console.error("Error loading judge audit:", error);
        setLoading(false);
      },
    );
    return unsubscribe;
  }, []);

  const filteredLogs = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("es");
    if (!term) return logs;
    return logs.filter((entry) => [
      entry.subjectName,
      entry.identifier,
      entry.action,
      entry.details?.round,
      entry.details?.reason,
    ].some((value) => typeof value === "string" && value.toLocaleLowerCase("es").includes(term)));
  }, [logs, search]);

  const formatTimestamp = (timestamp: Timestamp) => {
    if (!timestamp?.seconds) return "Fecha no disponible";
    return format(new Date(timestamp.seconds * 1000), "dd MMM yyyy · HH:mm:ss", { locale: es });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Auditoría de Jurados</CardTitle>
        <CardDescription>
          Registro administrativo de accesos, intentos fallidos, cambios de contraseña y votaciones enviadas por los jurados.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por jurado, cédula, ronda o evento..."
          className="max-w-md"
        />

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="max-h-[65vh] overflow-auto rounded-lg border">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead className="min-w-[170px]">Fecha y hora</TableHead>
                  <TableHead className="min-w-[190px]">Jurado</TableHead>
                  <TableHead className="min-w-[220px]">Evento</TableHead>
                  <TableHead>Detalle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                      No hay eventos de jurados para mostrar.
                    </TableCell>
                  </TableRow>
                ) : filteredLogs.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatTimestamp(entry.timestamp)}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{entry.subjectName || "Jurado no identificado"}</div>
                      {entry.identifier && <div className="text-xs text-muted-foreground">CC {entry.identifier}</div>}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <ActionIcon action={entry.action} />
                        <span>{actionLabel(entry.action)}</span>
                      </div>
                      {entry.action === "judge_login_failed" && (
                        <Badge variant="destructive" className="mt-1">Acceso rechazado</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {entry.action === "judge_score_submitted" ? (
                        <div className="space-y-1 text-sm">
                          <div><strong>Ronda:</strong> {entry.details?.round || "N/D"}</div>
                          {entry.details?.teams?.map((team) => (
                            <div key={team.name} className="text-muted-foreground">
                              {team.name}: <strong>{team.total}</strong> puntos
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-1 text-xs text-muted-foreground">
                          {entry.details?.reason && <div>Motivo: {entry.details.reason}</div>}
                          {entry.details?.ip && <div>IP: {entry.details.ip}</div>}
                          {entry.details?.userAgent && (
                            <div className="max-w-[420px] truncate" title={entry.details.userAgent}>
                              Dispositivo: {entry.details.userAgent}
                            </div>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
