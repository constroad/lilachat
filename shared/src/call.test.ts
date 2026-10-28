import { describe, expect, it } from 'vitest';
import {
  CALL_CONNECT_TIMEOUT_MS,
  CALL_TIMEOUT_MS,
  formatCallDuration,
  ringDeadline,
  nextCallState,
  summarizeEndedCall,
  type CallState,
} from './call.js';

/**
 * La máquina de estados de una llamada (F10).
 *
 * Una llamada es la parte de una app de mensajería donde más se nota un estado
 * mal resuelto: un teléfono que sigue sonando después de colgar, dos personas
 * que se creen conectadas mientras el audio no fluye, o una llamada perdida que
 * nunca aparece en el chat. Todo eso se decide acá, sin WebRTC y sin red.
 */
const sonando: CallState = { fase: 'sonando', desde: 1000, entrante: true };
const activa: CallState = { fase: 'activa', desde: 1000, entrante: true, conectadaEn: 5000 };

describe('nextCallState', () => {
  it('quien llama pasa de llamando a activa cuando el otro contesta', () => {
    const estado = nextCallState(
      { fase: 'llamando', desde: 1000, entrante: false },
      { tipo: 'contestada', at: 4000 }
    );

    expect(estado.fase).toBe('activa');
    expect(estado.fase === 'activa' && estado.conectadaEn).toBe(4000);
  });

  it('colgar termina la llamada y guarda quién colgó', () => {
    const estado = nextCallState(activa, { tipo: 'colgada', at: 9000, porMi: true });

    expect(estado).toMatchObject({ fase: 'terminada', motivo: 'colgada', porMi: true });
  });

  /**
   * Rechazar una entrante y colgar una activa **no son lo mismo**: la primera
   * es una llamada perdida que tiene que aparecer en el chat, la segunda no.
   * Confundirlas deja al otro sin saber que lo llamaron.
   */
  it('rechazar una entrante la marca como perdida', () => {
    const estado = nextCallState(sonando, { tipo: 'rechazada', at: 3000 });

    expect(estado).toMatchObject({ fase: 'terminada', motivo: 'rechazada' });
    expect(summarizeEndedCall(estado).perdida).toBe(true);
  });

  it('una llamada que se contestó no cuenta como perdida', () => {
    const estado = nextCallState(activa, { tipo: 'colgada', at: 9000, porMi: false });

    expect(summarizeEndedCall(estado).perdida).toBe(false);
  });

  /**
   * Si nadie contesta, la llamada se corta SOLA. Sin esto el teléfono suena
   * indefinidamente y quien llama se queda mirando «llamando…» sin saber si el
   * otro lo está ignorando o si nunca le llegó.
   */
  it('sin respuesta se corta al vencer el tiempo', () => {
    const estado = nextCallState(sonando, { tipo: 'tiempo', at: 1000 + CALL_TIMEOUT_MS });

    expect(estado).toMatchObject({ fase: 'terminada', motivo: 'sin-respuesta' });
    expect(summarizeEndedCall(estado).perdida).toBe(true);
  });

  it('el tiempo NO corta una llamada ya activa', () => {
    const estado = nextCallState(activa, { tipo: 'tiempo', at: 1000 + CALL_TIMEOUT_MS });

    expect(estado.fase).toBe('activa');
  });

  /**
   * Una llamada terminada NO vuelve a ninguna parte. Un evento tardío —el
   * `colgada` del otro que llega después de que yo colgué— no puede
   * resucitarla: la pantalla se reabriría sola.
   */
  it('lo que llega después de terminar no la revive', () => {
    const terminada = nextCallState(activa, { tipo: 'colgada', at: 9000, porMi: true });

    expect(nextCallState(terminada, { tipo: 'contestada', at: 9500 })).toEqual(terminada);
    expect(nextCallState(terminada, { tipo: 'colgada', at: 9600, porMi: false })).toEqual(terminada);
  });

  /** Perder la red durante la llamada la corta, y lo DICE. */
  it('la desconexión termina con su propio motivo', () => {
    const estado = nextCallState(activa, { tipo: 'desconectada', at: 9000 });

    expect(estado).toMatchObject({ fase: 'terminada', motivo: 'desconectada' });
  });
});

describe('formatCallDuration', () => {
  it('cuenta desde que se CONECTÓ, no desde que empezó a sonar', () => {
    // Sonó a los 1000, contestaron a los 5000, ahora son 65000.
    expect(formatCallDuration(activa, 65000)).toBe('01:00');
  });

  it('mientras suena no muestra reloj', () => {
    expect(formatCallDuration(sonando, 65000)).toBe('');
  });

  it('pasa a horas cuando hace falta', () => {
    expect(formatCallDuration(activa, 5000 + 3_725_000)).toBe('1:02:05');
  });
});

describe('summarizeEndedCall', () => {
  it('la línea que queda en el chat dice qué pasó', () => {
    const colgada = nextCallState(activa, { tipo: 'colgada', at: 65_000, porMi: false });

    expect(summarizeEndedCall(colgada)).toMatchObject({ perdida: false, duracion: '01:00' });
  });

  it('una perdida no tiene duración que mostrar', () => {
    const perdida = nextCallState(sonando, { tipo: 'rechazada', at: 3000 });

    expect(summarizeEndedCall(perdida).duracion).toBe('');
  });
});

/**
 * Backlog 114 (José, 28/10): the callee taps «Contestar» on the locked phone,
 * types the code, and meanwhile the caller's ring ran out and the call died.
 * «Answering» stops the ring clock on both sides and gives the media its own,
 * longer window; the caller waits in «Conectando…».
 */
describe('answering', () => {
  const llamando: CallState = { fase: 'llamando', desde: 1000, entrante: false };

  it('the ring deadline is the 30 s ring, or the connect window once answering', () => {
    expect(ringDeadline(sonando)).toBe(1000 + CALL_TIMEOUT_MS);
    const answering = nextCallState(llamando, { tipo: 'answering', at: 25_000 });

    expect(answering).toMatchObject({ fase: 'llamando', answeringAt: 25_000 });
    expect(ringDeadline(answering)).toBe(25_000 + CALL_CONNECT_TIMEOUT_MS);
    expect(ringDeadline(activa)).toBeNull();
  });

  it('the old ring timer does not end a call that is being answered', () => {
    const answering = nextCallState(llamando, { tipo: 'answering', at: 25_000 });

    expect(nextCallState(answering, { tipo: 'tiempo', at: 1000 + CALL_TIMEOUT_MS }).fase).toBe('llamando');
  });

  it('answering that never connects still ends, without answer, at its own deadline', () => {
    const answering = nextCallState(sonando, { tipo: 'answering', at: 25_000 });
    const ended = nextCallState(answering, { tipo: 'tiempo', at: 25_000 + CALL_CONNECT_TIMEOUT_MS });

    expect(ended).toMatchObject({ fase: 'terminada', motivo: 'sin-respuesta' });
  });

  it('a second answering keeps the first time; an answered or ended call ignores it', () => {
    const first = nextCallState(llamando, { tipo: 'answering', at: 25_000 });

    expect(nextCallState(first, { tipo: 'answering', at: 40_000 })).toBe(first);
    expect(nextCallState(activa, { tipo: 'answering', at: 6000 })).toBe(activa);
    const ended = nextCallState(sonando, { tipo: 'rechazada', at: 2000 });
    expect(nextCallState(ended, { tipo: 'answering', at: 3000 })).toBe(ended);
  });

  it('a timer that fires a hair early does not end the ring', () => {
    expect(nextCallState(sonando, { tipo: 'tiempo', at: 1000 + CALL_TIMEOUT_MS - 1 }).fase).toBe('sonando');
  });

  it('answered after answering connects as usual', () => {
    const answering = nextCallState(llamando, { tipo: 'answering', at: 25_000 });

    expect(nextCallState(answering, { tipo: 'contestada', at: 31_000 })).toMatchObject({ fase: 'activa', conectadaEn: 31_000 });
  });
});
