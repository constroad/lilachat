import type { ContactNote, QuietHours } from '@lilachat/shared';

/** Pending 17: save my routines of a chat (`null` clears one). Says why on failure, never throws. */
export async function saveRoutines(jwt: string, chatId: string, body: { quietHours?: QuietHours | null; contactNote?: ContactNote | null }): Promise<string | null> {
  try {
    const response = await fetch(`/api/chats/${chatId}/routines`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` }, body: JSON.stringify(body) });
    if (response.ok) return null;
    const reply = (await response.json().catch(() => null)) as { message?: string } | null;
    return reply?.message ?? 'No se pudo guardar.';
  } catch {
    return 'Sin conexión. Prueba de nuevo.';
  }
}
