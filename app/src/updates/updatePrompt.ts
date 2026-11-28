/**
 * The update prompt over ANY screen (José 28/11: he saw «actualizar» in the personal list
 * but never in Spaces). The APK band lives on top of the Chats list, so a person who works
 * inside a channel (a field engineer in the client channel all day) never saw it; and a
 * downloaded OTA waited for a 10-minute absence with nothing in flight, which a phone that
 * keeps uploading photos may never have. PURE: the decision and a tiny store; no new checks,
 * the existing cadence (`useActualizacionesDeLaApp`, `useActualizacionSilenciosa`) feeds it.
 */

export type ApkNotice = { version: string; mandatory: boolean; update: () => void; dismiss: () => void };
export type UpdatePrompt = { kind: 'restart' } | { kind: 'apk'; version: string; mandatory: boolean } | null;

export const RESTART_PROMPT = { text: 'Hay una actualización', action: 'Reiniciar' } as const;
export const APK_PROMPT = { suggested: (version: string) => `Lilachat ${version}`, mandatory: 'Tienes que actualizar', action: 'Actualizar' } as const;
export const RESTART_BLOCKED = 'Todavía se están enviando mensajes o fotos. Reinicia cuando terminen.';
export const DISMISS_LABEL = 'Ahora no';

/**
 * Which prompt shows. A downloaded OTA first: one restart brings the fixes, and it shows on
 * any screen, never during a call. The APK prompt only where the list's band is not on screen.
 */
export function updatePromptOf(input: { otaPending: boolean; restartDismissed: boolean; inCall: boolean; apk: Pick<ApkNotice, 'version' | 'mandatory'> | null; bandOnScreen: boolean }): UpdatePrompt {
  if (input.inCall) return null;
  if (input.otaPending && !input.restartDismissed) return { kind: 'restart' };
  if (input.apk && !input.bandOnScreen) return { kind: 'apk', version: input.apk.version, mandatory: input.apk.mandatory };
  return null;
}

let current: ApkNotice | null = null;
const listeners = new Set<() => void>();

/** The list publishes its notice; listeners hear only a change of version or force, the actions just follow. */
export function publishApkNotice(next: ApkNotice | null): void {
  const changed = current?.version !== next?.version || current?.mandatory !== next?.mandatory;
  if (!changed && current && next) {
    current.update = next.update;
    current.dismiss = next.dismiss;
    return;
  }
  current = next;
  listeners.forEach((listener) => listener());
}

export const apkNoticeNow = (): ApkNotice | null => current;

export function subscribeApkNotice(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
