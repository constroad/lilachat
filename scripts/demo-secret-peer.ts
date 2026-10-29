/**
 * «Lucía» of the demo space answers in her secret chat (pending 67 E2E): it
 * opens what the phone sent — text, and photos or videos downloaded and
 * decrypted — and sends a sealed photo back through the real upload route.
 *
 *   npx tsx --env-file=.env scripts/demo-secret-peer.ts read
 *   npx tsx --env-file=.env scripts/demo-secret-peer.ts send-photo <file.jpg> [caption]
 *   npx tsx --env-file=.env scripts/demo-secret-peer.ts send-text <text> | delete <seq>
 *
 * The phone's key is the one that opens the last thing it sent: the account
 * has several devices and only that one holds the private half.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Types } from 'mongoose';
import { io } from 'socket.io-client';
import { advanceChain, base64ToBytes, createMediaKey, decryptMessage, deriveSessionRoot, encryptMessage, openMediaFile, parseMediaSecret, sealMediaFile, serializeMediaSecret, type Envelope } from '@lilachat/shared';
import { connectDb } from '../server/src/db.js';
import { ChatModel, MessageModel } from '../server/src/chatModels.js';
import { DeviceModel, UserModel } from '../server/src/models.js';
import { signSession } from '../server/src/sessions.js';
import { toAbsoluteMediaUrl } from '../server/src/mediaClient.js';
import { DEMO_IDENTITY_FILE, LUCIA_DEVICE, LUCIA_PHONE } from './demo-identity.js';

const OWNER_PHONE = '902049935';
const API = process.env.LILACHAT_API_URL ?? 'https://lilachat.constroad.com';
const OUT_DIR = process.env.DEMO_OUT_DIR ?? '/tmp';

const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex').slice(0, 16);

async function context() {
  const identity = JSON.parse(readFileSync(DEMO_IDENTITY_FILE, 'utf8')) as { privateKey: string };
  const privateKey = base64ToBytes(identity.privateKey);
  const [owner, lucia] = await Promise.all([UserModel.findOne({ phone: OWNER_PHONE }).select('_id').lean(), UserModel.findOne({ phone: LUCIA_PHONE }).select('_id').lean()]);
  if (!owner || !lucia) throw new Error('Falta el espacio demo: corre seed-demo-space.ts --apply.');
  const chat = await ChatModel.findOne({ kind: 'direct', encrypted: true, 'members.userId': { $all: [owner._id, lucia._id] } }).select('_id').lean();
  const devices = await DeviceModel.find({ userId: owner._id, publicKey: { $exists: true, $ne: '' } }).select('deviceId publicKey').lean();
  const keys = devices.map((device) => ({ deviceId: device.deviceId, key: advanceChain(deriveSessionRoot({ myPrivateKey: privateKey, theirPublicKey: base64ToBytes(device.publicKey!) })).messageKey }));
  return { ownerId: owner._id, luciaId: lucia._id, chatId: chat!._id as Types.ObjectId, keys };
}

type Keys = Awaited<ReturnType<typeof context>>['keys'];
function openAny(envelope: Envelope, keys: Keys): { text: string; deviceId: string; key: Uint8Array } | null {
  for (const candidate of keys) {
    try {
      return { text: decryptMessage(candidate.key, envelope), deviceId: candidate.deviceId, key: candidate.key };
    } catch {
      // Not this device's key: the next one.
    }
  }
  return null;
}

async function read(): Promise<void> {
  const { chatId, keys, ownerId } = await context();
  const messages = await MessageModel.find({ chatId, deletedAt: { $exists: false } }).sort({ seq: -1 }).limit(8).lean();
  for (const message of messages.reverse()) {
    const who = String(message.senderId) === String(ownerId) ? 'teléfono' : 'Lucía';
    if (!message.envelope) {
      console.log(`#${message.seq} ${who} · sin sobre (${message.kind})`);
      continue;
    }
    const opened = openAny(message.envelope as Envelope, keys);
    if (!opened) {
      console.log(`#${message.seq} ${who} · 🔒 no abre con ninguna clave del teléfono`);
      continue;
    }
    const secret = parseMediaSecret(opened.text);
    if (!secret || !message.media?.url) {
      console.log(`#${message.seq} ${who} · texto «${opened.text}» (clave del dispositivo ${opened.deviceId.slice(0, 8)}…)`);
      continue;
    }
    const sealed = new Uint8Array(await (await fetch(toAbsoluteMediaUrl(message.media.url))).arrayBuffer());
    const plain = openMediaFile(sealed, secret.key);
    const target = path.join(OUT_DIR, `demo-secreto-${message.seq}-${secret.fileName}`);
    writeFileSync(target, plain);
    console.log(`#${message.seq} ${who} · ${secret.mime} ${plain.length} B (sellado ${sealed.length} B, server guardó ${message.media.mime}) sha ${sha(plain)} pie «${secret.caption ?? ''}» → ${target}`);
  }
}

async function phoneKey(chatId: Types.ObjectId, ownerId: Types.ObjectId, keys: Keys) {
  const last = await MessageModel.findOne({ chatId, senderId: ownerId, envelope: { $exists: true }, deletedAt: { $exists: false } }).sort({ seq: -1 }).lean();
  const phone = last ? openAny(last.envelope as Envelope, keys) : null;
  if (phone) return phone;
  // Nothing of the phone's left in the chat (cleaned): the device that opened it last time.
  const known = keys.find((candidate) => candidate.deviceId === process.env.DEMO_PHONE_DEVICE);
  if (!known) throw new Error('Primero escribe algo desde el teléfono en el chat secreto, o pasa DEMO_PHONE_DEVICE.');
  return { text: '', deviceId: known.deviceId, key: known.key };
}

/** As Lucía, over the real socket: the phone hears it live, like any message. */
async function asLucia<T>(luciaId: Types.ObjectId, event: string, frame: Record<string, unknown>): Promise<T> {
  const socket = io(API, { auth: { token: signSession({ userId: String(luciaId), deviceId: LUCIA_DEVICE, email: '' }) }, transports: ['websocket'] });
  try {
    return await new Promise<T>((resolve, reject) => {
      socket.on('connect_error', reject);
      socket.on('connect', () => socket.emit(event, frame, (answer: T) => resolve(answer)));
    });
  } finally {
    socket.close();
  }
}

async function sendText(text: string): Promise<void> {
  const { chatId, keys, ownerId, luciaId } = await context();
  const phone = await phoneKey(chatId, ownerId, keys);
  const answer = await asLucia<unknown>(luciaId, 'msg.send', { chatId: String(chatId), clientKey: `demo-peer-${Date.now()}`, envelope: encryptMessage(phone.key, text) });
  console.log('msg.send →', JSON.stringify(answer).slice(0, 120));
}

async function remove(seq: number): Promise<void> {
  const { chatId, luciaId } = await context();
  console.log('msg.delete →', JSON.stringify(await asLucia<unknown>(luciaId, 'msg.delete', { chatId: String(chatId), seq })));
}

async function sendPhoto(file: string, caption: string): Promise<void> {
  const { chatId, keys, ownerId, luciaId } = await context();
  const phone = await phoneKey(chatId, ownerId, keys);
  const photo = new Uint8Array(readFileSync(file));
  const fileKey = createMediaKey();
  const envelope = encryptMessage(phone.key, serializeMediaSecret({ key: fileKey, mime: 'image/jpeg', fileName: path.basename(file), sizeBytes: photo.length, caption }));
  const form = new FormData();
  form.append('chatId', String(chatId));
  form.append('clientKey', `demo-peer-${Date.now()}`);
  form.append('envelope', JSON.stringify(envelope));
  form.append('sealedKind', 'image');
  form.append('file', new Blob([sealMediaFile(photo, fileKey)], { type: 'application/octet-stream' }), 'sellado');
  const token = signSession({ userId: String(luciaId), deviceId: LUCIA_DEVICE, email: '' });
  const response = await fetch(`${API}/api/media`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  const body = (await response.json()) as { message?: { seq?: number } | string };
  console.log(`HTTP ${response.status} · ${typeof body.message === 'string' ? body.message : `seq ${body.message?.seq ?? '-'}`} · foto ${photo.length} B sha ${sha(photo)} para el dispositivo ${phone.deviceId.slice(0, 8)}…`);
}

const main = async () => {
  await connectDb();
  const [command, argument, extra] = process.argv.slice(2);
  if (command === 'read') await read();
  else if (command === 'send-photo' && argument) await sendPhoto(argument, extra ?? '');
  else if (command === 'send-text' && argument) await sendText(argument);
  else if (command === 'delete' && argument) await remove(Number(argument));
  else console.log('Uso: demo-secret-peer.ts read | send-text <texto> | send-photo <archivo.jpg> [pie] | delete <seq>');
  process.exit(0);
};

void main().catch((error: unknown) => {
  console.error('❌', error instanceof Error ? error.message : error);
  process.exit(1);
});
