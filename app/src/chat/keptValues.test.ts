import { describe, expect, it } from 'vitest';
import { keepUnchanged, shallowEqual } from './keptValues';

describe('shallowEqual', () => {
  it('two arrays with the same items in the same order are equal', () => {
    const photo = { seq: 1 };
    expect(shallowEqual([photo, { seq: 2 }].slice(0, 1), [photo])).toBe(true);
  });

  it('an item that is another object (a message edited) is a change', () => {
    expect(shallowEqual([{ seq: 1 }], [{ seq: 1 }])).toBe(false);
  });

  it('two plain objects with the same fields and values are equal', () => {
    expect(shallowEqual({ seq: 4, autor: 'Ana', texto: 'hola' }, { seq: 4, autor: 'Ana', texto: 'hola' })).toBe(true);
  });

  it('a field more, a field less or a field changed is a change', () => {
    expect(shallowEqual({ seq: 4, texto: 'hola' }, { seq: 4, texto: 'hola', mio: true })).toBe(false);
    expect(shallowEqual({ seq: 4, texto: 'hola' }, { seq: 4 })).toBe(false);
    expect(shallowEqual({ seq: 4, texto: 'hola' }, { seq: 4, texto: 'chau' })).toBe(false);
  });

  it('an array is never equal to an object, nor null to an object', () => {
    expect(shallowEqual([], {})).toBe(false);
    expect(shallowEqual(null, {})).toBe(false);
    expect(shallowEqual(null, null)).toBe(true);
  });
});

/**
 * A new message rebuilt every album and every quote, and the memoized row of
 * each one redrew with it (F4, 02/11): what did not change keeps last render's
 * object, so its row bails out.
 */
describe('keepUnchanged', () => {
  it('a value equal to last render keeps the previous object', () => {
    const [a, b] = [{ seq: 1 }, { seq: 2 }];
    const previous = new Map([[1, [a, b]]]);
    const kept = keepUnchanged(previous, new Map([[1, [a, b]]]));

    expect(kept.get(1)).toBe(previous.get(1));
  });

  it('a value that changed is the new one', () => {
    const [a, b, c] = [{ seq: 1 }, { seq: 2 }, { seq: 3 }];
    const next = new Map([[1, [a, b, c]]]);
    const kept = keepUnchanged(new Map([[1, [a, b]]]), next);

    expect(kept.get(1)).toBe(next.get(1));
  });

  it('a key that is new comes in, and a key that left does not stay', () => {
    const quote = { seq: 9, texto: 'hola' };
    const kept = keepUnchanged(new Map([[3, { seq: 3, texto: 'vieja' }]]), new Map([[9, quote]]));

    expect([...kept.keys()]).toEqual([9]);
    expect(kept.get(9)).toBe(quote);
  });

  it('with nothing before, it is the new map as it came', () => {
    const next = new Map([[1, { seq: 1 }]]);
    expect(keepUnchanged(undefined, next)).toBe(next);
  });

  it('when nothing changed at all, the previous map itself comes back', () => {
    const previous = new Map([[1, { seq: 1, texto: 'hola' }]]);
    expect(keepUnchanged(previous, new Map([[1, { seq: 1, texto: 'hola' }]]))).toBe(previous);
  });
});
