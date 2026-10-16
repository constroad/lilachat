import { cubreHueco, huecosDelHistorial, siguienteHueco } from '@lilachat/shared';
import { listOlderMessages, type ChatSummary } from '../api/client';
import { guardarMensajes, seqsGuardados } from './mensajesGuardados';
import type { ChatMessage } from './useChat';

/**
 * El hidratador (F12.0b): completa el historial de cada chat en el teléfono.
 *
 * El almacén se llena con lo que LLEGA —socket, delta, páginas del scroll—, y
 * eso deja huecos: lo anterior a la instalación, lo que pasó mientras el
 * teléfono estuvo días sin red, lo que nunca se scrolleó. Para que el respaldo
 * (F12.1) sea la conversación ENTERA, alguien tiene que pedir lo que falta. Y
 * tiene que pasar mientras el server todavía guarda los chats en claro: con el
 * cifrado por defecto (F12.3), lo que no esté en el teléfono no se recupera.
 *
 * Se miran los NÚMEROS (`huecosDelHistorial`), no una bandera «completo»: un
 * hueco puede formarse después de haber estado completo.
 *
 * **Del más nuevo al más viejo.** El último hueco es el que rodea lo que la
 * persona está mirando; el principio de la conversación puede esperar.
 */

/** Lo máximo que el server acepta por página (`listMessages`: `min(limit, 100)`). */
const PAGINA_DE_HIDRATACION = 100;

/**
 * Tope de páginas por corrida. Un historial grande no se trae de un tirón al
 * arrancar —la lista de chats está cargando al mismo tiempo—; lo que falte lo
 * pide la próxima corrida, porque los huecos siguen ahí.
 */
const MAX_PAGINAS_POR_CORRIDA = 40;

export type ResultadoDeHidratacion = { chatId: string; paginas: number; completo: boolean };

export async function hidratarChat(params: {
  chatId: string;
  ultimoDelServer: number;
  token: string;
  /**
   * ¿Sigo? Se consulta antes de cada página. Al cerrar sesión el almacén se
   * vacía, y una corrida que siguiera escribiendo dejaría filas de quien ya se
   * fue — con el JWT viejo, además.
   */
  sigue?: () => boolean;
}): Promise<ResultadoDeHidratacion> {
  let paginas = 0;
  const sigue = params.sigue ?? (() => true);
  // Huecos que el server tampoco tiene: se saltean y se sigue con los anteriores.
  const sinRemedio = new Set<number>();

  while (paginas < MAX_PAGINAS_POR_CORRIDA && sigue()) {
    const seqs = await seqsGuardados(params.chatId);
    if (!seqs) return { chatId: params.chatId, paginas, completo: false };

    const huecos = huecosDelHistorial(seqs, params.ultimoDelServer);
    const hueco = siguienteHueco(huecos, sinRemedio);
    if (!hueco) return { chatId: params.chatId, paginas, completo: true };

    const respuesta = await listOlderMessages(
      {
        chatId: params.chatId,
        beforeSeq: hueco.hasta + 1,
        limit: Math.min(PAGINA_DE_HIDRATACION, hueco.hasta - hueco.desde + 1),
      },
      params.token
    );
    if (!respuesta.ok) return { chatId: params.chatId, paginas, completo: false };
    paginas += 1;

    const pagina = respuesta.data.messages as ChatMessage[];
    // El server tampoco los tiene (se borraron de la base): ese hueco no se
    // puede llenar, y seguir pidiéndolo sería un bucle. Se saltea y se sigue
    // con los más viejos: darlo por completo dejaba el resto sin pedir.
    if (!cubreHueco(pagina, hueco)) {
      sinRemedio.add(hueco.hasta);
      continue;
    }

    if (!sigue()) break;
    await guardarMensajes(params.chatId, pagina);
  }

  return { chatId: params.chatId, paginas, completo: false };
}

/**
 * Todos los chats, de a uno. Secuencial a propósito: es trabajo de fondo y no
 * puede competir con la pantalla por la red ni por el pool de la base.
 */
export async function hidratarTodo(
  chats: readonly Pick<ChatSummary, 'id' | 'lastSeq'>[],
  token: string,
  sigue: () => boolean = () => true
): Promise<ResultadoDeHidratacion[]> {
  const resultados: ResultadoDeHidratacion[] = [];
  for (const chat of chats) {
    if (!sigue()) break;
    if (chat.lastSeq <= 0) continue;
    resultados.push(await hidratarChat({ chatId: chat.id, ultimoDelServer: chat.lastSeq, token, sigue }));
  }
  return resultados;
}
