import type { Programado } from '../api/client';

/**
 * Lo puro de ver los programados de un chat (FL9d; auditoría §46.2: se podían
 * programar y no ver ni cancelar, aunque el server ya lo permitía).
 */
export function programadosDelChat(lista: readonly Programado[], chatId: string): Programado[] {
  return lista.filter((uno) => uno.chatId === chatId).sort((a, b) => a.sendAt.localeCompare(b.sendAt));
}

export function textoDeProgramados(cantidad: number): string {
  return cantidad === 1 ? '1 mensaje programado' : `${cantidad} mensajes programados`;
}
