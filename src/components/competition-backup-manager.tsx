"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArchiveRestore, DatabaseBackup, History, Loader2, LockKeyhole, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { getSupabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

type BackupMetadata = {
  id: string;
  createdAt: string;
  hash: string;
  reason: "before_reset" | "before_restore" | "manual";
  encryption: "AES-256-GCM";
  keyId: string;
  compressedBytes: number;
  plainBytes: number;
};

type ActiveVersion = {
  kind?: "current" | "backup";
  createdAt?: string;
  backupId?: string;
  backupCreatedAt?: string;
  restoredAt?: string;
  hash?: string;
  previousBackupId?: string;
  previousBackupHash?: string;
  automaticRollback?: boolean;
};

function formatDate(value?: string) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "America/Bogota",
  }).format(date);
}

function shortHash(hash?: string) {
  if (!hash) return "Sin hash";
  if (hash.length <= 24) return hash;
  return `${hash.slice(0, 12)}…${hash.slice(-12)}`;
}

function sizeLabel(bytes: number) {
  if (!bytes) return "0 KB";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function CompetitionBackupManager() {
  const { toast } = useToast();
  const [backups, setBackups] = useState<BackupMetadata[]>([]);
  const [currentHash, setCurrentHash] = useState("");
  const [activeVersion, setActiveVersion] = useState<ActiveVersion | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);

  const request = useCallback(async (method: "GET" | "POST" | "PUT", body?: unknown) => {
    const { data: { session } } = await getSupabase().auth.getSession();
    if (!session) throw new Error("La sesión de administrador expiró.");

    const response = await fetch("/api/admin/backups", {
      method,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: "no-store",
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "La operación de backup falló.");
    return result;
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await request("GET");
      setBackups(result.backups || []);
      setCurrentHash(result.currentHash || "");
      setActiveVersion(result.activeVersion || null);
    } catch (error) {
      console.error("Error loading backups:", error);
      toast({
        variant: "destructive",
        title: "No se pudieron cargar las versiones",
        description: error instanceof Error ? error.message : "Error desconocido.",
      });
    } finally {
      setLoading(false);
    }
  }, [request, toast]);

  useEffect(() => {
    void refresh();
    const handler = () => void refresh();
    window.addEventListener("competition-version-changed", handler);
    return () => window.removeEventListener("competition-version-changed", handler);
  }, [refresh]);

  const createManualBackup = async () => {
    setWorking("create");
    try {
      const result = await request("POST");
      toast({
        title: "Backup cifrado creado",
        description: `SHA-256: ${shortHash(result.backup?.hash)}`,
      });
      await refresh();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "No se pudo crear el backup",
        description: error instanceof Error ? error.message : "Error desconocido.",
      });
    } finally {
      setWorking(null);
    }
  };

  const restoreBackup = async (backup: BackupMetadata) => {
    setWorking(backup.id);
    try {
      const result = await request("PUT", { backupId: backup.id });
      toast({
        title: "Versión restaurada",
        description: `La versión del ${formatDate(backup.createdAt)} fue restaurada y verificada con SHA-256.`,
      });
      setCurrentHash(result.currentHash || backup.hash);
      window.dispatchEvent(new Event("competition-version-changed"));
      await refresh();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "No se pudo restaurar",
        description: error instanceof Error ? error.message : "Error desconocido.",
      });
    } finally {
      setWorking(null);
    }
  };

  const activeBackup = useMemo(
    () => activeVersion?.backupId
      ? backups.find((backup) => backup.id === activeVersion.backupId) || null
      : null,
    [activeVersion, backups],
  );

  const isExactActiveHash = Boolean(activeVersion?.hash && currentHash === activeVersion.hash);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <DatabaseBackup className="h-5 w-5" />
              Versiones y Copias de Seguridad
            </CardTitle>
            <CardDescription className="mt-1">
              Antes de reiniciar resultados se crea automáticamente una copia cifrada del conversatorio. Puede restaurar una versión anterior cuando sea necesario.
            </CardDescription>
          </div>
          <Button type="button" variant="outline" onClick={createManualBackup} disabled={working !== null || loading}>
            {working === "create"
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <DatabaseBackup className="mr-2 h-4 w-4" />}
            Crear backup ahora
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lg font-bold">Versión activa</span>
                <Badge>
                  {activeVersion?.kind === "backup" ? "Restaurada desde backup" : "Versión actual"}
                </Badge>
                {isExactActiveHash && (
                  <Badge variant="secondary" className="gap-1">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Hash verificado
                  </Badge>
                )}
              </div>

              <p className="mt-2 text-sm text-muted-foreground">
                {activeVersion?.kind === "backup"
                  ? `Backup del ${formatDate(activeVersion.backupCreatedAt || activeBackup?.createdAt)} · restaurado el ${formatDate(activeVersion.restoredAt)}`
                  : `Estado actual${activeVersion?.createdAt ? ` · iniciado el ${formatDate(activeVersion.createdAt)}` : ""}`}
              </p>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <LockKeyhole className="h-4 w-4 text-primary" />
              <span>Backups AES-256-GCM</span>
            </div>
          </div>

          <div className="mt-4 rounded-lg bg-background p-3">
            <p className="mb-1 text-xs font-medium text-muted-foreground">SHA-256 del estado actual</p>
            <code className="block break-all text-xs">{currentHash || "Calculando..."}</code>
          </div>

          {activeVersion?.hash && !isExactActiveHash && (
            <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">
              El estado fue modificado después de activar esta versión. El hash mostrado arriba corresponde al estado actual.
            </p>
          )}
        </div>

        <div>
          <div className="mb-3 flex items-center gap-2">
            <History className="h-5 w-5" />
            <h3 className="font-semibold">Historial de versiones</h3>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Verificando copias...
            </div>
          ) : backups.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Aún no hay backups. El primero se generará automáticamente antes de reiniciar resultados.
            </div>
          ) : (
            <div className="space-y-3">
              {backups.map((backup) => {
                const isActive = activeVersion?.kind === "backup" && activeVersion.backupId === backup.id;
                return (
                  <div
                    key={backup.id}
                    className={`rounded-lg border p-4 ${isActive ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20" : ""}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{formatDate(backup.createdAt)}</span>
                          {isActive && <Badge className="bg-emerald-600">Versión activa</Badge>}
                          <Badge variant="outline">
                            {backup.reason === "before_restore"
  ? "Antes de restaurar"
  : backup.reason === "manual"
    ? "Backup manual"
    : "Antes de reiniciar"}
                          </Badge>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span>Cifrado: {backup.encryption}</span>
                          <span>Tamaño cifrado: {sizeLabel(backup.compressedBytes)}</span>
                          <span>Key ID: {backup.keyId}</span>
                        </div>

                        <div className="mt-3 rounded bg-muted px-3 py-2">
                          <p className="mb-1 text-[11px] font-medium text-muted-foreground">SHA-256 de esta versión</p>
                          <code className="block break-all text-[11px]">{backup.hash}</code>
                        </div>
                      </div>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={working !== null || isActive}
                          >
                            {working === backup.id
                              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              : <ArchiveRestore className="mr-2 h-4 w-4" />}
                            {isActive ? "Versión activa" : "Restaurar esta versión"}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Restaurar esta versión del conversatorio?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Se restaurará el estado guardado el {formatDate(backup.createdAt)}. Antes de hacerlo, el sistema creará automáticamente otro backup cifrado del estado actual para poder recuperarlo si es necesario.
                            </AlertDialogDescription>
                          </AlertDialogHeader>

                          <div className="rounded-lg border bg-muted/40 p-3">
                            <p className="text-xs font-medium">SHA-256 de la versión a restaurar</p>
                            <code className="mt-1 block break-all text-[11px]">{backup.hash}</code>
                          </div>

                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => restoreBackup(backup)}>
                              Restaurar y verificar hash
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
