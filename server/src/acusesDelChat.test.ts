import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import { unreadCount } from '@lilachat/shared';
import { startTestMongo } from './testMongo.js';
import { ChatModel, MessageModel, ReceiptModel } from './chatModels.js';
import { markRead } from './acusesDelChat.js';

/**
 * Pending 108 (José, 28/10): groups and channels stayed unread after reading
 * them. A thread reply takes the chat's next `seq` but the main chat hides it,
 * so a client acknowledges the last VISIBLE message and the cursor stopped
 * short of `lastSeq`: the next list reload brought the count back.
 */
let mongo: MongoMemoryServer;
let jose: Types.ObjectId;
let ana: Types.ObjectId;
let chatId: Types.ObjectId;

beforeAll(async () => {
  mongo = await startTestMongo();
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

const message = (seq: number, extra: { hiloDe?: number; enElChat?: boolean } = {}) => ({ chatId, seq, senderId: ana, clientKey: `k${seq}`, kind: 'text' as const, body: `m${seq}`, at: new Date(), ...extra });
const readSeqOfJose = async () => (await ReceiptModel.findOne({ chatId, userId: jose }).lean())?.readSeq ?? 0;

beforeEach(async () => {
  await Promise.all([ChatModel.deleteMany({}), MessageModel.deleteMany({}), ReceiptModel.deleteMany({})]);
  jose = new Types.ObjectId();
  ana = new Types.ObjectId();
  chatId = (await ChatModel.create({ kind: 'group', name: 'Lokillos', members: [{ userId: jose }, { userId: ana }], lastSeq: 5 }))._id;
});

describe('markRead past what the main chat hides (pending 108)', () => {
  it('reading the last visible message also reads the thread replies after it', async () => {
    // Arrange: 3 is the last message in the main chat; 4 and 5 are replies in its thread.
    await MessageModel.create([message(1), message(2), message(3), message(4, { hiloDe: 3 }), message(5, { hiloDe: 3 })]);
    // Act
    const read = await markRead({ chatId: String(chatId), userId: jose, seq: 3 });
    // Assert
    expect(read).toBe(5);
    expect(unreadCount({ lastSeq: 5, readSeq: await readSeqOfJose() })).toBe(0);
  });

  it('a visible message still unread keeps the cursor where the client said', async () => {
    // Arrange: 4 is a reply, but 5 is a new message in the main chat.
    await MessageModel.create([message(1), message(2), message(3), message(4, { hiloDe: 3 }), message(5)]);
    // Act
    const read = await markRead({ chatId: String(chatId), userId: jose, seq: 3 });
    // Assert
    expect(read).toBe(3);
    expect(await readSeqOfJose()).toBe(3);
  });

  it('a reply also sent to the chat («enElChat») is visible: it is not skipped', async () => {
    await MessageModel.create([message(1), message(2), message(3), message(4, { hiloDe: 3, enElChat: true }), message(5, { hiloDe: 3 })]);
    expect(await markRead({ chatId: String(chatId), userId: jose, seq: 3 })).toBe(3);
  });

  it('reading in the middle of the chat never jumps over visible messages', async () => {
    await MessageModel.create([message(1), message(2), message(3), message(4, { hiloDe: 3 }), message(5, { hiloDe: 3 })]);
    expect(await markRead({ chatId: String(chatId), userId: jose, seq: 1 })).toBe(1);
  });
});
