import { describe, expect, it } from 'vitest';
import { callJoinState, callLinkTokenOf, callLinkUrl, msUntilJoinChange, scheduledCallText, scheduledCallTitle } from './scheduledCall.js';

const start = Date.parse('2026-10-23T15:00:00.000Z');
const minutes = (count: number) => count * 60_000;

describe('callJoinState', () => {
  it('opens 10 minutes before the time', () => {
    // Arrange / Act / Assert
    expect(callJoinState(new Date(start).toISOString(), start - minutes(11))).toBe('early');
    expect(callJoinState(new Date(start).toISOString(), start - minutes(10))).toBe('open');
  });

  it('stays open an hour after it starts, or until it ends if it says so', () => {
    expect(callJoinState(new Date(start).toISOString(), start + minutes(59))).toBe('open');
    expect(callJoinState(new Date(start).toISOString(), start + minutes(61))).toBe('over');
    expect(callJoinState(new Date(start).toISOString(), start + minutes(100), new Date(start + minutes(120)).toISOString())).toBe('open');
  });

  it('a date it cannot read is never joinable', () => {
    expect(callJoinState('not a date', start)).toBe('over');
  });
});

describe('scheduled call texts', () => {
  it('the title says voice or video and with whom', () => {
    expect(scheduledCallTitle('Ana', false)).toBe('Llamada con Ana');
    expect(scheduledCallTitle(' Ana ', true)).toBe('Videollamada con Ana');
  });

  it('the line in the chat and the list says it is a scheduled call', () => {
    expect(scheduledCallText('Llamada con Ana')).toBe('Llamada programada: Llamada con Ana');
  });
});

describe('call links', () => {
  it('a call link is on the web address and its token reads back', () => {
    const url = callLinkUrl('6ad8b0cf30ce97957f4acc0c-v-AbC_123-xyz');
    expect(url).toBe('https://lilachat.constroad.com/llamada/6ad8b0cf30ce97957f4acc0c-v-AbC_123-xyz');
    expect(callLinkTokenOf(url)).toBe('6ad8b0cf30ce97957f4acc0c-v-AbC_123-xyz');
  });

  it('any other address is not a call link', () => {
    expect(callLinkTokenOf('https://lilachat.constroad.com/unirse/abc')).toBeNull();
    expect(callLinkTokenOf('https://otro.com/llamada/abc')).toBeNull();
    expect(callLinkTokenOf(null)).toBeNull();
  });
});

describe('msUntilJoinChange', () => {
  it('before: until the join opens; open: until it closes; over: never', () => {
    const at = new Date(start).toISOString();
    expect(msUntilJoinChange(at, start - minutes(30))).toBe(minutes(20));
    expect(msUntilJoinChange(at, start)).toBe(minutes(60) + 1);
    expect(msUntilJoinChange(at, start + minutes(90))).toBeNull();
  });
});
