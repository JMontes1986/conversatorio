
'use client';

import { collection, addDoc, serverTimestamp } from '@/lib/documents';
import { db } from './supabase';

/**
 * Registra una acción en el log de auditoría de Supabase.
 * @param actionDescription - Una descripción clara de la acción realizada.
 * @param details - Un objeto opcional con detalles adicionales sobre la acción.
 */
export async function logActivity(
  actionDescription: string,
  details?: Record<string, any>
): Promise<void> {
  try {
    await addDoc(collection(db, 'audit-logs'), {
      action: actionDescription,
      details: details || null,
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error logging activity:', error);
    // En un caso de uso real, podrías querer manejar este error de forma más robusta.
  }
}
