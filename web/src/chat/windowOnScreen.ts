import { mergeIntoLive, visibleEnElChat, type MessageWindow } from '@lilachat/shared';
import type { ChatMessage, MensajeEnPantalla } from './types';

/**
 * What the conversation shows while a window is open (pending 44): the window,
 * without thread replies that live only in their thread. Once it reached the
 * end (`hasNewer` false) the live list is joined below it, so what arrives keeps
 * showing.
 */
export function windowOnScreen(opened: MessageWindow<ChatMessage>, live: MensajeEnPantalla[]): MensajeEnPantalla[] {
  const shown = opened.hasNewer ? opened.messages : mergeIntoLive<MensajeEnPantalla>(live, opened);
  return shown.filter(visibleEnElChat);
}
