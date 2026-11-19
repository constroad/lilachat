import { describe, expect, it } from 'vitest';
import type { CallState } from '@lilachat/shared';
import type { AccionDeAviso, CallNoticeTap } from '../../modules/llamada-entrante/src';
import { queHacerConElAviso } from './llamadaNativa';
import { createNoticeTapInbox } from './noticeTaps';

/**
 * The native bridge as it behaves (`Puente`, Piezas.kt): a tap is kept as «pending» for
 * 40 s AND delivered to the live listener. Before, the call provider read the pending
 * copy again on every render, so a «Colgar» tapped for one call could hang up the next
 * call to the same chat within those 40 s.
 */
function fakeBridge() {
  let pending: AccionDeAviso | null = null;
  let listener: ((tap: CallNoticeTap) => void) | null = null;
  return {
    takePending: (): AccionDeAviso | null => {
      const taken = pending;
      pending = null;
      return taken;
    },
    listen: (next: (tap: CallNoticeTap) => void) => (listener = next),
    emit: (tap: AccionDeAviso) => {
      pending = tap;
      listener?.(tap);
    },
    peek: () => pending,
  };
}

const CHAT = '6740a1b2c3d4e5f601234567';
const callA: CallState = { fase: 'activa', desde: 1_000, entrante: false, conectadaEn: 2_000 };
const callB: CallState = { fase: 'activa', desde: 20_000, entrante: true, conectadaEn: 21_000 };

describe('createNoticeTapInbox', () => {
  it('a «Colgar» tapped for one call never hangs up the next call to the same chat', () => {
    const bridge = fakeBridge();
    const inbox = createNoticeTapInbox(bridge.takePending);
    expect(inbox.coldStart()).toBeNull();
    const decisions: string[] = [];
    let current: CallState = callA;
    bridge.listen((tap) => decisions.push(queHacerConElAviso({ aviso: inbox.delivered(tap) as AccionDeAviso, estado: current, chatId: CHAT })));

    bridge.emit({ chatId: CHAT, accion: 'colgar' });
    current = callB;
    // The provider re-renders many times during call B, and may even mount again.
    const reads = [inbox.coldStart(), inbox.coldStart(), createNoticeTapInbox(bridge.takePending).coldStart()];

    expect(decisions).toEqual(['colgar']);
    expect(reads).toEqual([null, null, null]);
    expect(queHacerConElAviso({ aviso: { chatId: CHAT, accion: 'colgar' }, estado: current, chatId: CHAT })).toBe('colgar');
  });

  it('the tap that opened the app cold is read once', () => {
    const bridge = fakeBridge();
    bridge.emit({ chatId: CHAT, accion: 'contestar' });
    const inbox = createNoticeTapInbox(bridge.takePending);

    expect(inbox.coldStart()).toEqual({ chatId: CHAT, accion: 'contestar' });
    expect(inbox.coldStart()).toBeNull();
  });

  it('a delivered call tap consumes its pending copy; a message tap leaves a call tap alone', () => {
    const bridge = fakeBridge();
    const inbox = createNoticeTapInbox(bridge.takePending);
    bridge.emit({ chatId: CHAT, accion: 'rechazar' });
    expect(inbox.delivered({ chatId: CHAT, accion: 'rechazar' })).toEqual({ chatId: CHAT, accion: 'rechazar' });
    expect(bridge.peek()).toBeNull();

    bridge.emit({ chatId: CHAT, accion: 'abrir' });
    inbox.delivered({ chatId: 'otro', accion: 'chat' });
    expect(bridge.peek()).toEqual({ chatId: CHAT, accion: 'abrir' });
  });

  it('«answering» from the lock screen is consumed too', () => {
    const bridge = fakeBridge();
    const inbox = createNoticeTapInbox(bridge.takePending);
    bridge.emit({ chatId: CHAT, accion: 'contestar' });

    inbox.delivered({ chatId: CHAT, accion: 'answering' });

    expect(bridge.peek()).toBeNull();
  });
});
