import { describe, expect, it } from 'vitest';
import { isWrongKeyError, messagesOfRows, rawKeyPragma, rowOfMessage, singleFlight } from './storedRows';

/**
 * Plan 1, F5b: the phone's message base moves to SQLCipher (the whole file
 * encrypted, in native code) with the message in clear inside it. Reading a
 * chat stops decrypting AES-GCM envelopes in JavaScript.
 */
describe('rawKeyPragma', () => {
  it('passes the 32 bytes as a raw hex key, so no passphrase derivation runs on open', () => {
    const key = Uint8Array.from({ length: 32 }, (_, index) => index);
    expect(rawKeyPragma(key)).toBe(`PRAGMA key = "x'${'000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f'}'";`);
  });

  it('refuses a key of another size instead of opening a base nobody can read again', () => {
    expect(() => rawKeyPragma(new Uint8Array(16))).toThrow('key_must_be_32_bytes');
  });
});

describe('rowOfMessage / messagesOfRows', () => {
  it('keeps the body in its own column for the local search, and the message whole in json', () => {
    const message = { seq: 7, body: 'hola', kind: 'text' };
    expect(rowOfMessage(message)).toEqual({ seq: 7, body: 'hola', json: JSON.stringify(message) });
  });

  it('leaves the body column empty for a message without text (a sealed one, a sticker)', () => {
    const sealed = { seq: 8, envelope: { nonce: 'n', ciphertext: 'c' } };
    expect(rowOfMessage(sealed).body).toBeNull();
  });

  it('reads the rows back in order and skips one that does not parse (the hydrator brings it again)', () => {
    const rows = [{ json: JSON.stringify({ seq: 1 }) }, { json: '{broken' }, { json: JSON.stringify({ seq: 3 }) }];
    expect(messagesOfRows(rows)).toEqual([{ seq: 1 }, { seq: 3 }]);
  });
});

describe('isWrongKeyError', () => {
  it('recognizes the base that this key cannot open', () => {
    expect(isWrongKeyError(new Error('Call to function NativeDatabase.execSync has been rejected. → Caused by: file is not a database'))).toBe(true);
  });

  it('does not take a full disk or a busy base for a wrong key: those must never delete the base', () => {
    expect(isWrongKeyError(new Error('database or disk is full'))).toBe(false);
    expect(isWrongKeyError(new Error('database is locked'))).toBe(false);
    expect(isWrongKeyError('file is not a database')).toBe(false);
  });
});

describe('singleFlight', () => {
  it('shares one run between callers of the same key while it is in flight', async () => {
    const once = singleFlight<string, number>();
    let runs = 0;
    const run = async () => {
      runs += 1;
      return runs;
    };
    const [first, second] = await Promise.all([once('chat-a', run), once('chat-a', run)]);
    expect([first, second, runs]).toEqual([1, 1, 1]);
  });

  it('runs again once the previous run settled, and keeps keys apart', async () => {
    const once = singleFlight<string, string>();
    expect(await once('chat-a', async () => 'a1')).toBe('a1');
    expect(await once('chat-a', async () => 'a2')).toBe('a2');
    expect(await once('chat-b', async () => 'b1')).toBe('b1');
  });

  it('lets the next caller retry after a failed run', async () => {
    const once = singleFlight<string, string>();
    await expect(once('chat-a', async () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    expect(await once('chat-a', async () => 'ok')).toBe('ok');
  });
});
