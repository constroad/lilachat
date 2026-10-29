/**
 * «Lucía» of the demo space starts a group call in #obra-carretera-km-12 and
 * stays in it (pending 56 E2E): the phone must ring, show the strip «Unirse»
 * and, on joining, send her an offer. Signals only — no media from here.
 *
 *   npx tsx --env-file=.env scripts/demo-group-call.ts [seconds]
 */
import { io } from 'socket.io-client';
import { connectDb } from '../server/src/db.js';
import { ChatModel } from '../server/src/chatModels.js';
import { UserModel } from '../server/src/models.js';
import { WorkspaceModel } from '../server/src/workspaceModels.js';
import { signSession } from '../server/src/sessions.js';
import { LUCIA_DEVICE, LUCIA_PHONE } from './demo-identity.js';

const API = process.env.LILACHAT_API_URL ?? 'https://lilachat.constroad.com';
const CHANNEL = 'obra-carretera-km-12';
const SPACE_NAME = 'Constructora Andes';
const DEFAULT_SECONDS = 90;

const main = async () => {
  await connectDb();
  const seconds = Number(process.argv[2]) || DEFAULT_SECONDS;
  const lucia = await UserModel.findOne({ phone: LUCIA_PHONE }).select('_id').lean();
  const space = await WorkspaceModel.findOne({ name: SPACE_NAME }).select('_id').lean();
  const chat = space ? await ChatModel.findOne({ workspaceId: space._id, name: CHANNEL }).select('_id').lean() : null;
  if (!lucia || !chat) throw new Error('Falta el espacio demo: corre seed-demo-space.ts --apply.');
  const chatId = String(chat._id);
  const socket = io(API, { auth: { token: signSession({ userId: String(lucia._id), deviceId: LUCIA_DEVICE, email: '' }) }, transports: ['websocket'] });
  socket.on('groupcall.state', (frame: { room: { participants: string[] } | null; names?: Record<string, string> }) => console.log('state →', frame.room ? `${frame.room.participants.length} personas: ${frame.room.participants.map((id) => frame.names?.[id] || id.slice(-4)).join(', ')}` : 'terminó'));
  socket.on('groupcall.signal', (frame: { from: string; kind: string; data: { sdp?: string } }) => console.log(`signal ← ${frame.kind} de …${frame.from.slice(-4)}${frame.data?.sdp ? ` (sdp ${frame.data.sdp.length} B, ${(frame.data.sdp.match(/^m=/gm) ?? []).length} pistas)` : ''}`));
  socket.on('groupcall.left', (frame: { userId: string }) => console.log(`left ← …${frame.userId.slice(-4)}`));
  await new Promise<void>((resolve, reject) => {
    socket.on('connect_error', reject);
    socket.on('connect', () => resolve());
  });
  const answer = await new Promise<unknown>((resolve) => socket.emit('groupcall.join', { chatId, video: true }, resolve));
  console.log('join →', JSON.stringify(answer).slice(0, 160));
  await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  await new Promise((resolve) => socket.emit('groupcall.leave', { chatId }, resolve));
  console.log('Lucía salió de la llamada');
  socket.close();
  process.exit(0);
};

void main().catch((error: unknown) => {
  console.error('❌', error instanceof Error ? error.message : error);
  process.exit(1);
});
