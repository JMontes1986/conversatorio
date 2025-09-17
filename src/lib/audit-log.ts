
'use server';

import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Registra una acción en el log de auditoría de Firestore.
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
