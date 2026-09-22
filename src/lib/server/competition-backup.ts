import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";

type SupabaseAdmin = any;

export type BackupReason = "before_reset" | "before_restore";

export type SnapshotRow = {
  id: string;
  data: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
};

export type CompetitionSnapshot = {
  formatVersion: 1;
  capturedAt: string;
  tables: Record<string, SnapshotRow[]>;
};

export type BackupMetadata = {
  id: string;
  createdAt: string;
  hash: string;
  reason: BackupReason;
  encryption: "AES-256-GCM";
  keyId: string;
  compressedBytes: number;
  plainBytes: number;
};

const SNAPSHOT_TABLES = [
  "schools",
  "judges",
  "moderators",
  "scores",
  "rounds",
  "rubric",
  "questions",
  "student_questions",
  "survey_responses",
  "site_content",
  "settings",
  "debate_state",
  "draw_state",
  "tiebreak",
  "audit_logs",
] as const;

const RESTORE_TABLE_ORDER = [
  "schools",
  "judges",
  "moderators",
  "rounds",
  "rubric",
  "questions",
  "student_questions",
  "survey_responses",
  "site_content",
  "settings",
  "debate_state",
  "draw_state",
  "scores",
  "tiebreak",
] as const;

function stableValue(value: any): any {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = stableValue(value[key]);
        return acc;
      }, {} as Record<string, unknown>);
  }
  return value;
}

function stableStringify(value: unknown) {
  return JSON.stringify(stableValue(value));
}

function encryptionSecret() {
  const configured = process.env.BACKUP_ENCRYPTION_KEY?.trim();
  if (configured) return configured;

  const fallback = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!fallback) {
    throw new Error("Falta BACKUP_ENCRYPTION_KEY o una clave de servicio de Supabase.");
  }

  // Compatibilidad para no bloquear producción. Se recomienda configurar una clave dedicada.
  return `conversatorio-backups:v1:${fallback}`;
}

function encryptionKey() {
  const secret = encryptionSecret();
  return createHash("sha256").update(secret, "utf8").digest();
}

function encryptionKeyId() {
  return createHash("sha256").update(encryptionKey()).digest("hex").slice(0, 16);
}

function normalizeSnapshot(snapshot: CompetitionSnapshot): CompetitionSnapshot {
  const tables = Object.fromEntries(
    Object.entries(snapshot.tables)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([table, rows]) => [
        table,
        [...rows]
          .sort((a, b) => a.id.localeCompare(b.id))
          .map((row) => {
            const data = { ...(row.data || {}) } as Record<string, unknown>;

            if (table === "settings" && row.id === "competition") {
              delete data.activeVersion;
            }

            return {
              id: row.id,
              data: stableValue(data),
              ...(row.created_at ? { created_at: row.created_at } : {}),
              ...(row.updated_at ? { updated_at: row.updated_at } : {}),
            };
          }),
      ]),
  );

  return {
    formatVersion: 1,
    capturedAt: snapshot.capturedAt,
    tables,
  };
}

function hashSnapshot(snapshot: CompetitionSnapshot) {
  const forHash = {
    formatVersion: snapshot.formatVersion,
    tables: snapshot.tables,
  };
  return createHash("sha256").update(stableStringify(forHash), "utf8").digest("hex");
}

function isVersionSystemAudit(row: SnapshotRow) {
  const category = String(row.data?.category || "");
  return category === "competition_backup" || category === "competition_restore";
}

export async function captureCompetitionSnapshot(supabase: SupabaseAdmin): Promise<CompetitionSnapshot> {
  const tableEntries = await Promise.all(
    SNAPSHOT_TABLES.map(async (table) => {
      const { data, error } = await supabase
        .from(table)
        .select("id,data,created_at,updated_at");
      if (error) throw error;

      const rows = (data || [])
        .map((row: any) => ({
          id: String(row.id),
          data: row.data || {},
          created_at: row.created_at || undefined,
          updated_at: row.updated_at || undefined,
        }))
        .filter((row: SnapshotRow) => table !== "audit_logs" || !isVersionSystemAudit(row));

      return [table, rows] as const;
    }),
  );

  return normalizeSnapshot({
    formatVersion: 1,
    capturedAt: new Date().toISOString(),
    tables: Object.fromEntries(tableEntries),
  });
}

export async function currentCompetitionHash(supabase: SupabaseAdmin) {
  return hashSnapshot(await captureCompetitionSnapshot(supabase));
}

function encryptSnapshot(snapshot: CompetitionSnapshot) {
  const plaintext = Buffer.from(stableStringify(snapshot), "utf8");
  const compressed = gzipSync(plaintext, { level: 9 });
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(compressed), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encrypted: {
      algorithm: "AES-256-GCM",
      keyId: encryptionKeyId(),
      iv: iv.toString("base64"),
      authTag: authTag.toString("base64"),
      ciphertext: ciphertext.toString("base64"),
      compression: "gzip",
    },
    plainBytes: plaintext.byteLength,
    compressedBytes: compressed.byteLength,
  };
}

function decryptSnapshot(payload: any): CompetitionSnapshot {
  if (payload?.algorithm !== "AES-256-GCM" || payload?.compression !== "gzip") {
    throw new Error("Formato de backup no compatible.");
  }
  if (payload.keyId !== encryptionKeyId()) {
    throw new Error("La clave de cifrado actual no corresponde con la usada para crear este backup.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(payload.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));

  const compressed = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64")),
    decipher.final(),
  ]);
  const plaintext = gunzipSync(compressed).toString("utf8");
  return JSON.parse(plaintext) as CompetitionSnapshot;
}

export async function createCompetitionBackup(
  supabase: SupabaseAdmin,
  reason: BackupReason,
): Promise<BackupMetadata> {
  const snapshot = await captureCompetitionSnapshot(supabase);
  const hash = hashSnapshot(snapshot);
  const encrypted = encryptSnapshot(snapshot);
  const id = randomUUID();
  const createdAt = new Date().toISOString();

  const data = {
    category: "competition_backup",
    action: "encrypted_backup_created",
    actorRole: "admin",
    createdAt,
    details: {
      reason,
      hash,
      encryption: "AES-256-GCM",
      keyId: encrypted.encrypted.keyId,
      plainBytes: encrypted.plainBytes,
      compressedBytes: encrypted.compressedBytes,
      snapshotCapturedAt: snapshot.capturedAt,
    },
    encryptedBackup: encrypted.encrypted,
  };

  const { error } = await supabase.from("audit_logs").insert({ id, data });
  if (error) throw error;

  return {
    id,
    createdAt,
    hash,
    reason,
    encryption: "AES-256-GCM",
    keyId: encrypted.encrypted.keyId,
    compressedBytes: encrypted.compressedBytes,
    plainBytes: encrypted.plainBytes,
  };
}

export async function listCompetitionBackups(supabase: SupabaseAdmin): Promise<BackupMetadata[]> {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("id,data")
    .eq("data->>category", "competition_backup")
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data || []).map((row: any) => ({
    id: String(row.id),
    createdAt: String(row.data?.createdAt || row.data?.details?.snapshotCapturedAt || ""),
    hash: String(row.data?.details?.hash || ""),
    reason: (row.data?.details?.reason || "before_reset") as BackupReason,
    encryption: "AES-256-GCM" as const,
    keyId: String(row.data?.details?.keyId || ""),
    compressedBytes: Number(row.data?.details?.compressedBytes || 0),
    plainBytes: Number(row.data?.details?.plainBytes || 0),
  }));
}

export async function loadCompetitionBackup(
  supabase: SupabaseAdmin,
  backupId: string,
): Promise<{ metadata: BackupMetadata; snapshot: CompetitionSnapshot }> {
  const { data: row, error } = await supabase
    .from("audit_logs")
    .select("id,data")
    .eq("id", backupId)
    .eq("data->>category", "competition_backup")
    .maybeSingle();
  if (error) throw error;
  if (!row) throw new Error("Backup no encontrado.");

  const snapshot = normalizeSnapshot(decryptSnapshot(row.data?.encryptedBackup));
  const calculatedHash = hashSnapshot(snapshot);
  const expectedHash = String(row.data?.details?.hash || "");

  if (!expectedHash || calculatedHash !== expectedHash) {
    throw new Error("La verificación SHA-256 del backup falló. No se restaurará.");
  }

  return {
    metadata: {
      id: String(row.id),
      createdAt: String(row.data?.createdAt || row.data?.details?.snapshotCapturedAt || ""),
      hash: expectedHash,
      reason: (row.data?.details?.reason || "before_reset") as BackupReason,
      encryption: "AES-256-GCM",
      keyId: String(row.data?.details?.keyId || ""),
      compressedBytes: Number(row.data?.details?.compressedBytes || 0),
      plainBytes: Number(row.data?.details?.plainBytes || 0),
    },
    snapshot,
  };
}

async function deleteAllRows(supabase: SupabaseAdmin, table: string) {
  const { error } = await supabase.from(table).delete().neq("id", "__never__");
  if (error) throw error;
}

async function insertRows(supabase: SupabaseAdmin, table: string, rows: SnapshotRow[]) {
  if (rows.length === 0) return;

  for (let index = 0; index < rows.length; index += 250) {
    const chunk = rows.slice(index, index + 250).map((row) => ({
      id: row.id,
      data: row.data,
      ...(row.created_at ? { created_at: row.created_at } : {}),
      ...(row.updated_at ? { updated_at: row.updated_at } : {}),
    }));
    const { error } = await supabase.from(table).insert(chunk);
    if (error) throw error;
  }
}

async function resetProtectedResults(supabase: SupabaseAdmin) {
  const rpc = await supabase.rpc("reset_competition_results");
  if (!rpc.error) return;

  const missingRpc = rpc.error.code === "PGRST202"
    || /reset_competition_results/i.test(rpc.error.message || "");
  if (!missingRpc) throw rpc.error;

  // Compatibilidad con instalaciones anteriores al trigger de inmutabilidad.
  const tiebreakDelete = await supabase.from("tiebreak").delete().neq("id", "__never__");
  if (tiebreakDelete.error) throw tiebreakDelete.error;
  const scoresDelete = await supabase.from("scores").delete().neq("id", "__never__");
  if (scoresDelete.error) throw scoresDelete.error;
}

async function restoreAuditLogs(
  supabase: SupabaseAdmin,
  snapshotRows: SnapshotRow[],
) {
  const { data: currentRows, error } = await supabase
    .from("audit_logs")
    .select("id,data");
  if (error) throw error;

  const removableIds = (currentRows || [])
    .filter((row: any) => !isVersionSystemAudit({ id: String(row.id), data: row.data || {} }))
    .map((row: any) => String(row.id));

  for (let index = 0; index < removableIds.length; index += 250) {
    const chunk = removableIds.slice(index, index + 250);
    const result = await supabase.from("audit_logs").delete().in("id", chunk);
    if (result.error) throw result.error;
  }

  await insertRows(supabase, "audit_logs", snapshotRows);
}

export async function restoreCompetitionSnapshot(
  supabase: SupabaseAdmin,
  snapshot: CompetitionSnapshot,
) {
  await resetProtectedResults(supabase);

  for (const table of RESTORE_TABLE_ORDER) {
    if (table === "scores" || table === "tiebreak") {
      // Ya fueron limpiadas por resetProtectedResults.
    } else {
      await deleteAllRows(supabase, table);
    }
    await insertRows(supabase, table, snapshot.tables[table] || []);
  }

  await restoreAuditLogs(supabase, snapshot.tables.audit_logs || []);
}

export function backupReasonLabel(reason: BackupReason) {
  return reason === "before_restore"
    ? "Antes de restaurar una versión"
    : "Antes de reiniciar resultados";
}
