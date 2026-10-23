import type { Credential } from '../auth/credentialStore';

/** Lo que recibe la conversación (salió de `ChatScreen`, que llegaba a 600 líneas). */
export type PropsDelChat = {
  chatId: string;
  chatName: string;
  /** La foto del grupo, si tiene. Sin ella se dibuja la inicial. */
  chatAvatarUrl?: string;
  credential: Credential;
  othersReadSeq: number;
  /** Quiénes cuentan para el check azul (FL8): en un grupo, todos menos yo y Lila. */
  acuseDe?: readonly string[];
  othersDeliveredSeq: number;
  /** Cuántos sin leer traía la lista: decide si la banda de Lila aparece. */
  unread: number;
  /** Hasta dónde leí al abrir (19/10): el divisor de no leídos va justo después. */
  readSeq?: number;
  /**
   * El `lastSeq` que el server reportó al abrir. Se marca leído HASTA acá, no
   * solo hasta el último mensaje cargado: si un mensaje del final se borró en
   * duro, `lastSeq` queda por delante y el cliente nunca llegaria a marcarlo
   * —dejando un «sin leer» fantasma que no baja (José, 31/08/2026)—. Abrir el
   * chat es haberlo visto todo lo que el server dice que hay.
   */
  lastSeqInicial?: number;
  /** Abrir en este mensaje: viene de un resultado de la búsqueda general (FL9d). */
  irASeq?: number;
  /** Chat secreto (F9): cifra, y apaga a Lila. */
  encrypted?: boolean;
  otherUserId?: string | null;
  /** Un chat solo contigo (`notas`, 19/10): ni grupo ni 1:1. */
  esBorrador?: boolean;
  /** A chat of a company space (E1): its groups and channels always read in the Slack format. */
  workspaceId?: string;
  /** A 1:1 with an app (design e-26): the head is the app's. */
  appId?: string;
  onBack: () => void;
};
