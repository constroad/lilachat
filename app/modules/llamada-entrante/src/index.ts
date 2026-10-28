import { requireOptionalNativeModule } from 'expo';

/**
 * La llamada entrante NATIVA (FL8.1): pantalla completa sobre el bloqueo, tono
 * del teléfono y Contestar/Rechazar en la notificación, aun con la app cerrada.
 *
 * `requireOptionalNativeModule`: en una build sin el módulo (o en la web) todo
 * esto no hace nada, y la llamada sigue funcionando como antes de FL8.1.
 */
/**
 * `chat`: se tocó el aviso de un MENSAJE (FL8.2). `colgar`: el botón de la
 * notificación «Llamada en curso» (FL11). `answering`: «Contestar» tapped on
 * the lock screen, before the app comes up (backlog 114). Lo demás es de la
 * llamada entrante.
 */
export type AccionDeAviso = { chatId: string; accion: 'abrir' | 'contestar' | 'rechazar' | 'chat' | 'colgar' | 'answering' };
/**
 * A tapped message notice with where it leads (agentes 25/10/2026): the message, its thread and its space, as
 * the push said them. Strings, empty when missing; builds before this one send none. UNTRUSTED text from the
 * notice: `destinoDeAviso` validates it.
 */
export type TappedNotice = { chatId: string; seq: string; hiloDe: string; workspaceId: string };
export type NoticeTap = AccionDeAviso & Partial<Omit<TappedNotice, 'chatId'>>;
/** What a notice tap tells JS, now with a reminder's full screen (pending 63). */
export type NoticeAction = AccionDeAviso | { chatId: string; accion: 'recordatorio' };
/** A reminder that rang full screen (pending 63). */
export type ReminderAlarm = { id: string; title: string; note: string; chat: string; chatId: string };

type Suscripcion = { remove(): void };

type LlamadaNativa = {
  configurar(servidor: string): void;
  mostrar(chatId: string, nombre: string, video: boolean): void;
  quitar(chatId: string): void;
  iniciarTono(): void;
  detenerTono(): void;
  accionPendiente(): AccionDeAviso | null;
  soltarBloqueo(): void;
  reminderPending?(): ReminderAlarm | null;
  snoozeReminder?(alarm: ReminderAlarm): void;
  chatPendiente(): string | null;
  avisoPendiente?(): TappedNotice | null;
  limpiarChat(chatId: string): void;
  playInAppAlert?(): void;
  puedePantallaCompleta(): boolean;
  abrirAjustesPantallaCompleta(): void;
  enCurso(chatId: string, nombre: string, video: boolean, desdeMs: number): void;
  finDeEnCurso(): void;
  addListener(evento: 'onAccion', oyente: (accion: NoticeAction) => void): Suscripcion;
};

const nativo = requireOptionalNativeModule<LlamadaNativa>('LlamadaEntrante');

/** Un fallo nativo nunca tumba la llamada: se pierde el adorno, no la llamada. */
function seguro<T>(tarea: () => T, siFalla: T): T {
  try {
    return tarea();
  } catch {
    return siFalla;
  }
}

export const llamadaNativa = {
  disponible: (): boolean => nativo !== null,
  configurar: (servidor: string): void => seguro(() => nativo?.configurar(servidor), undefined),
  mostrar: (chatId: string, nombre: string, video: boolean): void =>
    seguro(() => nativo?.mostrar(chatId, nombre, video), undefined),
  quitar: (chatId: string): void => seguro(() => nativo?.quitar(chatId), undefined),
  iniciarTono: (): void => seguro(() => nativo?.iniciarTono(), undefined),
  detenerTono: (): void => seguro(() => nativo?.detenerTono(), undefined),
  accionPendiente: (): AccionDeAviso | null => seguro(() => nativo?.accionPendiente() ?? null, null),
  soltarBloqueo: (): void => seguro(() => nativo?.soltarBloqueo(), undefined),
  /** The reminder whose full screen opened the app (pending 63); null in a build without it. */
  reminderPending: (): ReminderAlarm | null => seguro(() => nativo?.reminderPending?.() ?? null, null),
  /** «Posponer 10 min» from the app's screen: the phone shows it again by itself. */
  snoozeReminder: (alarm: ReminderAlarm): void => seguro(() => nativo?.snoozeReminder?.(alarm), undefined),
  /** Whether this build draws reminders full screen (it declares so to the server). */
  canRingReminders: (): boolean => typeof nativo?.reminderPending === 'function',
  /** El chat del aviso de mensaje con el que se abrió la app (FL8.2). */
  chatPendiente: (): string | null => seguro(() => nativo?.chatPendiente() ?? null, null),
  /** The same tap with its destination (space, thread, message); builds before it give only the chat. */
  avisoPendiente: (): TappedNotice | null =>
    seguro(() => {
      if (typeof nativo?.avisoPendiente === 'function') return nativo.avisoPendiente();
      const chatId = nativo?.chatPendiente() ?? null;
      return chatId ? { chatId, seq: '', hiloDe: '', workspaceId: '' } : null;
    }, null),
  /** Al abrir un chat: se va su aviso nativo. */
  limpiarChat: (chatId: string): void => seguro(() => nativo?.limpiarChat(chatId), undefined),
  /** Whether this build plays the in-app alert itself (older ones post a notice instead). */
  canPlayInAppAlert: (): boolean => typeof nativo?.playInAppAlert === 'function',
  /** A message with the app in front: the phone's notification sound (or a buzz in vibrate mode), nothing in the tray. */
  playInAppAlert: (): void => seguro(() => nativo?.playInAppAlert?.(), undefined),
  puedePantallaCompleta: (): boolean => seguro(() => nativo?.puedePantallaCompleta() ?? true, true),
  abrirAjustesPantallaCompleta: (): void => seguro(() => nativo?.abrirAjustesPantallaCompleta(), undefined),
  /**
   * El servicio «Llamada en curso» (FL11): sin él Android congela la app de
   * fondo y el audio se corta. En una build sin la función, no hace nada.
   */
  enCurso: (chatId: string, nombre: string, video: boolean, desdeMs: number): void =>
    seguro(() => nativo?.enCurso(chatId, nombre, video, desdeMs), undefined),
  finDeEnCurso: (): void => seguro(() => nativo?.finDeEnCurso(), undefined),
  alTocar: (oyente: (accion: NoticeTap) => void): Suscripcion =>
    seguro(() => nativo?.addListener('onAccion', (accion) => accion.accion !== 'recordatorio' && oyente(accion)), undefined) ?? { remove: () => undefined },
  /** A reminder's full screen opened the app while it was alive (pending 63). */
  onReminder: (listener: () => void): Suscripcion =>
    seguro(() => nativo?.addListener('onAccion', (action) => action.accion === 'recordatorio' && listener()), undefined) ?? { remove: () => undefined },
};
