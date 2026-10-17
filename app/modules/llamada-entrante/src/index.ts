import { requireOptionalNativeModule } from 'expo';

/**
 * La llamada entrante NATIVA (FL8.1): pantalla completa sobre el bloqueo, tono
 * del teléfono y Contestar/Rechazar en la notificación, aun con la app cerrada.
 *
 * `requireOptionalNativeModule`: en una build sin el módulo (o en la web) todo
 * esto no hace nada, y la llamada sigue funcionando como antes de FL8.1.
 */
export type AccionDeAviso = { chatId: string; accion: 'abrir' | 'contestar' | 'rechazar' };

type Suscripcion = { remove(): void };

type LlamadaNativa = {
  configurar(servidor: string): void;
  mostrar(chatId: string, nombre: string, video: boolean): void;
  quitar(chatId: string): void;
  iniciarTono(): void;
  detenerTono(): void;
  accionPendiente(): AccionDeAviso | null;
  soltarBloqueo(): void;
  puedePantallaCompleta(): boolean;
  abrirAjustesPantallaCompleta(): void;
  addListener(evento: 'onAccion', oyente: (accion: AccionDeAviso) => void): Suscripcion;
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
  puedePantallaCompleta: (): boolean => seguro(() => nativo?.puedePantallaCompleta() ?? true, true),
  abrirAjustesPantallaCompleta: (): void => seguro(() => nativo?.abrirAjustesPantallaCompleta(), undefined),
  alTocar: (oyente: (accion: AccionDeAviso) => void): Suscripcion =>
    seguro(() => nativo?.addListener('onAccion', oyente), undefined) ?? { remove: () => undefined },
};
