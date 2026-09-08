import { getSupabase } from './supabase';

/** Upload directly to Storage, avoiding Vercel's function request body limit. */
export async function uploadVideo(file: File, onProgress: (percent: number) => void, signal: AbortSignal) {
  if (!file.type.startsWith('video/')) throw new Error('Selecciona un archivo de video.');
  if (file.size > 50 * 1024 * 1024) throw new Error('El video no debe superar 50 MB.');
  const supabase = getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Debes iniciar sesión.');
  const name = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `videos/${crypto.randomUUID()}_${name}`;
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/debate-media/${path}`;
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    if (signal.aborted) { reject(new DOMException('Aborted', 'AbortError')); return; }
    signal.addEventListener('abort', abort, { once: true });
    xhr.open('POST', url);
    xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
    xhr.setRequestHeader('apikey', process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '');
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.upload.onprogress = event => { if (event.lengthComputable) onProgress(event.loaded / event.total * 100); };
    xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('Storage rechazó el video. Revisa tu sesión y el tamaño del archivo.'));
    xhr.onerror = () => reject(new Error('No se pudo conectar con Storage.'));
    xhr.onabort = () => reject(new DOMException('Aborted', 'AbortError'));
    xhr.onloadend = () => signal.removeEventListener('abort', abort);
    xhr.send(file);
  });
  return supabase.storage.from('debate-media').getPublicUrl(path).data.publicUrl;
}
