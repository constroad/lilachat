import { describe, expect, it } from 'vitest';
import { remoteThreadOf } from './remoteThread';

/** José 27/11 (lilachat 0.1.190, «Cannot convert undefined value to object» in useHilosEnElChat): a 200 without the list. */
describe('remoteThreadOf', () => {
  it('keeps the replies and the root the server sent', () => {
    const reply = { seq: 5, hiloDe: 2 };
    expect(remoteThreadOf({ raiz: { seq: 2 }, respuestas: [reply] })).toEqual({ raiz: { seq: 2 }, respuestas: [reply] });
  });

  it('a body without the list, or not an object, is an empty thread instead of a crash', () => {
    expect(remoteThreadOf({})).toEqual({ raiz: null, respuestas: [] });
    expect(remoteThreadOf({ raiz: { seq: 2 }, respuestas: null })).toEqual({ raiz: { seq: 2 }, respuestas: [] });
    expect(remoteThreadOf(undefined)).toEqual({ raiz: null, respuestas: [] });
    expect(remoteThreadOf('<html>')).toEqual({ raiz: null, respuestas: [] });
  });
});
