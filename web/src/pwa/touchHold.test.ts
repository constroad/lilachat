import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { followTouchHold, HOLD_MS } from './touchHold';

/** Spec §3.3: the message's actions only appeared on hover; a phone has no mouse. */
function touch(target: Element, type: string, point = { clientX: 10, clientY: 10 }) {
  const event = new Event(type, { bubbles: true });
  Object.defineProperty(event, 'touches', { value: [point] });
  target.dispatchEvent(event);
}

let stop: () => void;
let row: HTMLElement;
let other: HTMLElement;

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '<div class="group" id="a"><p id="in-a">hola</p></div><div class="group" id="b"></div><p id="out">fuera</p>';
  row = document.getElementById('a')!;
  other = document.getElementById('b')!;
  stop = followTouchHold();
});

afterEach(() => {
  stop();
  vi.useRealTimers();
});

describe('followTouchHold', () => {
  it('holding a row opens its actions', () => {
    touch(document.getElementById('in-a')!, 'touchstart');
    vi.advanceTimersByTime(HOLD_MS);
    expect(row.hasAttribute('data-touch-open')).toBe(true);
  });

  it('a quick tap opens nothing', () => {
    touch(row, 'touchstart');
    touch(row, 'touchend');
    vi.advanceTimersByTime(HOLD_MS);
    expect(row.hasAttribute('data-touch-open')).toBe(false);
  });

  it('scrolling the list opens nothing', () => {
    touch(row, 'touchstart');
    touch(row, 'touchmove', { clientX: 10, clientY: 60 });
    vi.advanceTimersByTime(HOLD_MS);
    expect(row.hasAttribute('data-touch-open')).toBe(false);
  });

  it('a finger that barely moves still holds', () => {
    touch(row, 'touchstart');
    touch(row, 'touchmove', { clientX: 12, clientY: 13 });
    vi.advanceTimersByTime(HOLD_MS);
    expect(row.hasAttribute('data-touch-open')).toBe(true);
  });

  it('one row at a time', () => {
    touch(row, 'touchstart');
    vi.advanceTimersByTime(HOLD_MS);
    touch(other, 'touchstart');
    vi.advanceTimersByTime(HOLD_MS);
    expect(row.hasAttribute('data-touch-open')).toBe(false);
    expect(other.hasAttribute('data-touch-open')).toBe(true);
  });

  it('touching anywhere else closes it; touching the row itself leaves its buttons alive', () => {
    touch(row, 'touchstart');
    vi.advanceTimersByTime(HOLD_MS);
    touch(row, 'touchstart');
    expect(row.hasAttribute('data-touch-open')).toBe(true);
    touch(document.getElementById('out')!, 'touchstart');
    expect(row.hasAttribute('data-touch-open')).toBe(false);
  });
});
