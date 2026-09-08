import { getSupabase, db } from './supabase';

/** Document-shaped records stored in separate Postgres tables; all access uses RLS. */
export const tables: Record<string, string> = {
  schools: 'schools', judges: 'judges', moderators: 'moderators', scores: 'scores',
  rounds: 'rounds', rubric: 'rubric', questions: 'questions',
  studentQuestions: 'student_questions', surveyResponses: 'survey_responses',
  siteContent: 'site_content', settings: 'settings', debateState: 'debate_state',
  drawState: 'draw_state', tiebreak: 'tiebreak', 'audit-logs': 'audit_logs',
};
type Data = Record<string, any>;
type Constraint = { kind: 'where'; field: string; value: unknown } | { kind: 'order'; field: string; direction: 'asc' | 'desc' };
type CollectionRef = { kind: 'collection'; table: string; constraints: Constraint[] };
type DocumentRef = { kind: 'document'; table: string; id: string };
type Row = { id: string; data: Data };
type Mutation = { table: string; id: string; operation: 'insert' | 'set' | 'merge' | 'update' | 'delete'; data?: Data };

export function collection(_db: typeof db, name: string): CollectionRef {
  if (!tables[name]) throw new Error(`Colección desconocida: ${name}`);
  return { kind: 'collection', table: tables[name], constraints: [] };
}
export function doc(_db: typeof db, name: string, id: string): DocumentRef {
  return { kind: 'document', table: collection(_db, name).table, id };
}
export function where(field: string, operator: '==', value: unknown): Constraint {
  if (operator !== '==') throw new Error('Operador no soportado');
  return { kind: 'where', field, value };
}
export function orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): Constraint {
  return { kind: 'order', field, direction };
}
export function query(ref: CollectionRef, ...constraints: Constraint[]): CollectionRef {
  return { ...ref, constraints: [...ref.constraints, ...constraints] };
}
export const serverTimestamp = () => ({ __serverTimestamp: true });

function encode(value: any): any {
  if (value instanceof Date) return { seconds: Math.floor(value.getTime() / 1000), nanoseconds: (value.getTime() % 1000) * 1e6 };
  if (Array.isArray(value)) return value.map(encode);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined).map(([k, v]) => [k, encode(v)]));
  return value;
}
function decode(value: any): any {
  if (Array.isArray(value)) return value.map(decode);
  if (value && typeof value === 'object') {
    if (typeof value.seconds === 'number') return { ...value, toDate: () => new Date(value.seconds * 1000 + (value.nanoseconds || 0) / 1e6) };
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, decode(v)]));
  }
  return value;
}
function snapshot(ref: DocumentRef, data?: Data) {
  return { id: ref.id, ref, exists: () => data !== undefined, data: (): Data => decode(data ?? {}) };
}
type DocumentSnapshot = ReturnType<typeof snapshot>;
type QuerySnapshot = { docs: DocumentSnapshot[]; empty: boolean; size: number; forEach: (callback: (doc: DocumentSnapshot) => void) => void };

export async function getDoc(ref: DocumentRef): Promise<DocumentSnapshot> {
  const { data, error } = await getSupabase().from(ref.table).select('id,data').eq('id', ref.id).maybeSingle();
  if (error) throw error;
  return snapshot(ref, data?.data);
}
export async function getDocs(ref: CollectionRef): Promise<QuerySnapshot> {
  const rows: Row[] = [];
  // Page explicitly: Supabase returns at most 1000 rows per request by default.
  for (let offset = 0; ; offset += 500) {
    let request = getSupabase().from(ref.table).select('id,data');
    for (const c of ref.constraints) {
      if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(c.field)) throw new Error('Campo no válido');
      if (c.kind === 'where') request = request.eq(`data->>${c.field}`, String(c.value));
      else request = request.order(['createdAt', 'timestamp'].includes(c.field) ? 'created_at' : `data->>${c.field}`, { ascending: c.direction === 'asc' });
    }
    const { data, error } = await request.order('id').range(offset, offset + 499);
    if (error) throw error;
    rows.push(...(data as Row[]));
    if (data.length < 500) break;
  }
  const docs = rows.map(row => snapshot({ kind: 'document', table: ref.table, id: row.id }, row.data));
  return { docs, empty: !docs.length, size: docs.length, forEach: callback => docs.forEach(callback) };
}

export function onSnapshot(ref: DocumentRef, callback: (value: DocumentSnapshot) => void, onError?: (error: Error) => void): () => void;
export function onSnapshot(ref: CollectionRef, callback: (value: QuerySnapshot) => void, onError?: (error: Error) => void): () => void;
export function onSnapshot(ref: DocumentRef | CollectionRef, callback: (value: any) => void, onError: (error: Error) => void = console.error): () => void {
  let stopped = false;
  let running = false;
  let pending = false;
  let previous: string | undefined;
  const refresh = async () => {
    if (stopped) return;
    if (running) { pending = true; return; }
    running = true;
    try {
      const value = ref.kind === 'document' ? await getDoc(ref) : await getDocs(ref);
      const fingerprint = JSON.stringify(ref.kind === 'document'
        ? { exists: (value as DocumentSnapshot).exists(), data: (value as DocumentSnapshot).data() }
        : (value as QuerySnapshot).docs.map(doc => ({ id: doc.id, data: doc.data() })));
      if (!stopped && fingerprint !== previous) { previous = fingerprint; callback(value); }
    } catch (error) { if (!stopped) onError(error as Error); }
    finally { running = false; if (pending) { pending = false; void refresh(); } }
  };
  let cleanup = () => {};
  try {
    const supabase = getSupabase();
    // Subscribe to the whole table so DELETE events also refresh filtered queries.
    const channel = supabase.channel(`documents:${ref.table}:${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: ref.table }, () => { void refresh(); })
      .subscribe(status => { if (status === 'SUBSCRIBED') void refresh(); });
    const auth = supabase.auth.onAuthStateChange(() => { setTimeout(() => { void refresh(); }, 0); });
    // Reconcile deletions, reconnects and changes in RLS permissions.
    const interval = setInterval(() => { void refresh(); }, 15000);
    window.addEventListener('focus', refresh);
    cleanup = () => { clearInterval(interval); window.removeEventListener('focus', refresh); auth.data.subscription.unsubscribe(); void supabase.removeChannel(channel); };
    void refresh();
  } catch (error) { queueMicrotask(() => { if (!stopped) onError(error as Error); }); }
  return () => { stopped = true; cleanup(); };
}

async function commit(operations: Mutation[]) {
  if (!operations.length) return;
  const { error } = await getSupabase().rpc('write_documents', { operations: encode(operations) });
  if (error) throw error;
}
export async function addDoc(ref: CollectionRef, data: Data): Promise<DocumentRef> {
  const target: DocumentRef = { kind: 'document', table: ref.table, id: crypto.randomUUID() };
  await commit([{ ...target, operation: 'insert', data }]);
  return target;
}
export async function setDoc(ref: DocumentRef, data: Data, options?: { merge: boolean }) {
  await commit([{ ...ref, operation: options?.merge ? 'merge' : 'set', data }]);
}
export async function updateDoc(ref: DocumentRef, data: Data) {
  await commit([{ ...ref, operation: 'update', data }]);
}
export async function deleteDoc(ref: DocumentRef) { await commit([{ ...ref, operation: 'delete' }]); }
export function writeBatch(_db: typeof db) {
  const operations: Mutation[] = [];
  return {
    delete: (ref: DocumentRef) => { operations.push({ ...ref, operation: 'delete' }); },
    commit: () => commit(operations),
  };
}
