/**
 * The demo space for the store screenshots (José, 29/10: «sí»). A building
 * company with five made-up people, three channels with real-looking talk and
 * a secret chat with «Lucía», whose key lives only on this Mac
 * (`~/.lilachat-demo/lucia.json`) so `demo-secret-peer.ts` can answer from it.
 *
 * The made-up people have phones `demo-01`…: not numbers, so nobody can ever
 * sign in as them and no real person is written to.
 *
 *   npx tsx --env-file=.env scripts/seed-demo-space.ts            # dry-run
 *   npx tsx --env-file=.env scripts/seed-demo-space.ts --apply
 *   npx tsx --env-file=.env scripts/seed-demo-space.ts --clean
 */
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Types } from 'mongoose';
import { bytesToBase64, generateIdentity } from '@lilachat/shared';
import { connectDb } from '../server/src/db.js';
import { ChatModel, MessageModel, ReceiptModel } from '../server/src/chatModels.js';
import { DeviceModel, UserModel } from '../server/src/models.js';
import { WorkspaceMemberModel, WorkspaceModel } from '../server/src/workspaceModels.js';
import { sendMessage } from '../server/src/chatService.js';
import { createWorkspace } from '../server/src/workspaces.js';
import { createChannel } from '../server/src/workspaceChannels.js';
import { ensureGeneralChannel, welcomeToGeneral } from '../server/src/workspaceGeneral.js';
import { DEMO_IDENTITY_FILE, LUCIA_DEVICE, LUCIA_PHONE } from './demo-identity.js';

const OWNER_PHONE = '902049935';
const SPACE_NAME = 'Constructora Andes';

const PEOPLE = [
  { phone: LUCIA_PHONE, name: 'Lucía Paredes', title: 'Residente de obra' },
  { phone: 'demo-02', name: 'Marco Rivas', title: 'Logística' },
  { phone: 'demo-03', name: 'Rosa Quispe', title: 'Administración' },
  { phone: 'demo-04', name: 'Diego Salazar', title: 'Topografía' },
  { phone: 'demo-05', name: 'Ana Torres', title: 'Seguridad' },
] as const;

type Line = [who: number | 'me', text: string];
const CHANNELS: { name: string; descripcion: string; lines: Line[] }[] = [
  {
    name: 'obra-carretera-km-12',
    descripcion: 'Avance diario del tramo km 12 – km 18',
    lines: [
      [0, 'Buenos días. Hoy terminamos la base granular del km 12+400 al 12+900.'],
      [3, 'Replanteo listo hasta el 13+200. Les dejo las cotas en la carpeta del Drive.'],
      ['me', 'Excelente. ¿Cuántos m³ de afirmado necesitamos para mañana?'],
      [1, 'Unos 180 m³. Ya coordiné tres volquetes para las 7:00.'],
      [0, 'Perfecto. La compactación salió al 98 % en el ensayo de esta mañana.'],
    ],
  },
  {
    name: 'compras',
    descripcion: 'Pedidos de materiales y cotizaciones',
    lines: [
      [1, 'Llegó la cotización de cemento: 450 bolsas a S/ 28.50 la bolsa.'],
      [2, 'La orden de compra ya está aprobada. Pago a 30 días.'],
      ['me', 'Gracias, Rosa. Que entreguen el jueves en el almacén de obra.'],
    ],
  },
  {
    name: 'seguridad',
    descripcion: 'Charlas de 5 minutos e incidencias',
    lines: [
      [4, 'Charla de hoy: trabajo cerca de maquinaria pesada. Asistieron 24 personas.'],
      [4, 'Recuerden: chaleco, casco y botas en todo el frente de trabajo.'],
      [0, 'Anotado. Mañana reforzamos la señalización del desvío.'],
    ],
  },
];
const GENERAL_LINES: Line[] = [
  ['me', 'Bienvenidos a Lilachat. Aquí coordinamos todo lo de la obra.'],
  [2, 'El viernes se paga la quincena. Revisen que su número de cuenta esté al día.'],
];

let sent = 0;
async function say(chatId: Types.ObjectId, senderId: Types.ObjectId, body: string): Promise<void> {
  sent += 1;
  await sendMessage({ chatId: String(chatId), senderId, clientKey: `demo-seed-${String(chatId)}-${sent}`, body });
}

async function ensurePeople(): Promise<Types.ObjectId[]> {
  const ids: Types.ObjectId[] = [];
  for (const person of PEOPLE) {
    const found = await UserModel.findOne({ phone: person.phone }).select('_id').lean();
    ids.push(found?._id ?? (await UserModel.create({ phone: person.phone, name: person.name }))._id);
  }
  return ids;
}

async function ensureSpace(ownerId: Types.ObjectId, people: Types.ObjectId[]): Promise<Types.ObjectId> {
  const existing = await WorkspaceModel.findOne({ ownerId, name: SPACE_NAME }).select('_id').lean();
  const spaceId = existing?._id ?? new Types.ObjectId((await createWorkspace(ownerId, { name: SPACE_NAME, rubro: 'Construcción' })).id);
  for (const [index, person] of PEOPLE.entries()) {
    await WorkspaceMemberModel.updateOne(
      { workspaceId: spaceId, phone: person.phone },
      { $setOnInsert: { userId: people[index], role: index === 0 ? 'admin' : 'member', status: 'active', title: person.title, addedBy: ownerId, joinedAt: new Date() } },
      { upsert: true }
    );
    await welcomeToGeneral(spaceId, people[index]!);
  }
  return spaceId;
}

async function fillChannels(spaceId: Types.ObjectId, ownerId: Types.ObjectId, people: Types.ObjectId[]): Promise<void> {
  const senderOf = (who: number | 'me') => (who === 'me' ? ownerId : people[who]!);
  const general = await ensureGeneralChannel(spaceId);
  if (general && !(await MessageModel.exists({ chatId: general, clientKey: /^demo-seed-/ }))) for (const [who, text] of GENERAL_LINES) await say(general, senderOf(who), text);
  for (const channel of CHANNELS) {
    if (await ChatModel.exists({ workspaceId: spaceId, name: channel.name })) continue;
    const created = await createChannel(String(spaceId), ownerId, { name: channel.name, descripcion: channel.descripcion, visibility: 'public' });
    const chatId = new Types.ObjectId(created.id);
    await ChatModel.updateOne({ _id: chatId }, { $push: { members: { $each: people.map((userId) => ({ userId, role: 'member' })) } } });
    for (const [who, text] of channel.lines) await say(chatId, senderOf(who), text);
  }
}

/** Lucía's identity: made once, kept on this Mac only, its public half published as her phone's. */
async function ensureLuciaKey(luciaId: Types.ObjectId): Promise<void> {
  if (!existsSync(DEMO_IDENTITY_FILE)) {
    const identity = generateIdentity();
    mkdirSync(path.dirname(DEMO_IDENTITY_FILE), { recursive: true });
    writeFileSync(DEMO_IDENTITY_FILE, JSON.stringify({ privateKey: bytesToBase64(identity.privateKey), publicKey: bytesToBase64(identity.publicKey) }));
    chmodSync(DEMO_IDENTITY_FILE, 0o600);
  }
  const { publicKey } = JSON.parse(readFileSync(DEMO_IDENTITY_FILE, 'utf8')) as { publicKey: string };
  await DeviceModel.updateOne({ deviceId: LUCIA_DEVICE }, { $set: { userId: luciaId, publicKey } }, { upsert: true });
}

async function ensureSecretChat(ownerId: Types.ObjectId, luciaId: Types.ObjectId): Promise<Types.ObjectId> {
  const existing = await ChatModel.findOne({ kind: 'direct', encrypted: true, 'members.userId': { $all: [ownerId, luciaId] }, members: { $size: 2 } }).select('_id').lean();
  if (existing) return existing._id;
  const chat = await ChatModel.create({ kind: 'direct', encrypted: true, members: [{ userId: ownerId, role: 'admin' }, { userId: luciaId, role: 'member' }], lastSeq: 0 });
  return chat._id;
}

async function clean(ownerId: Types.ObjectId | undefined): Promise<void> {
  const people = await UserModel.find({ phone: { $in: PEOPLE.map((person) => person.phone) } }).select('_id').lean();
  const peopleIds = people.map((person) => person._id);
  const spaces = ownerId ? await WorkspaceModel.find({ ownerId, name: SPACE_NAME }).select('_id').lean() : [];
  const spaceIds = spaces.map((space) => space._id);
  const chats = await ChatModel.find({ $or: [{ workspaceId: { $in: spaceIds } }, { 'members.userId': { $in: peopleIds }, kind: 'direct' }] }).select('_id').lean();
  const chatIds = chats.map((chat) => chat._id);
  await Promise.all([MessageModel.deleteMany({ chatId: { $in: chatIds } }), ReceiptModel.deleteMany({ chatId: { $in: chatIds } })]);
  await ChatModel.deleteMany({ _id: { $in: chatIds } });
  await WorkspaceMemberModel.deleteMany({ workspaceId: { $in: spaceIds } });
  await WorkspaceModel.deleteMany({ _id: { $in: spaceIds } });
  await DeviceModel.deleteMany({ deviceId: LUCIA_DEVICE });
  await UserModel.deleteMany({ _id: { $in: peopleIds } });
  const left = (await UserModel.countDocuments({ _id: { $in: peopleIds } })) + (await WorkspaceModel.countDocuments({ _id: { $in: spaceIds } })) + (await ChatModel.countDocuments({ _id: { $in: chatIds } }));
  console.log(`🧹 ${spaceIds.length} espacio(s), ${chatIds.length} chats y ${peopleIds.length} personas demo borrados — quedan ${left}`);
  process.exit(left === 0 ? 0 : 1);
}

const main = async () => {
  await connectDb();
  const owner = await UserModel.findOne({ phone: OWNER_PHONE }).select('_id').lean();
  if (process.argv.includes('--clean')) return clean(owner?._id);
  if (!owner) throw new Error(`No existe el usuario ${OWNER_PHONE}.`);
  console.log(`Espacio «${SPACE_NAME}» de ${OWNER_PHONE}: ${PEOPLE.length} personas demo, #general + ${CHANNELS.length} canales y un chat secreto con Lucía.`);
  if (!process.argv.includes('--apply')) {
    console.log('\n(dry-run) — volver a correr con --apply');
    process.exit(0);
  }
  const people = await ensurePeople();
  const spaceId = await ensureSpace(owner._id, people);
  await fillChannels(spaceId, owner._id, people);
  await ensureLuciaKey(people[0]!);
  const secretId = await ensureSecretChat(owner._id, people[0]!);
  console.log(`✅ espacio ${String(spaceId)} · chat secreto ${String(secretId)} · ${sent} mensajes nuevos`);
  process.exit(0);
};

void main().catch((error: unknown) => {
  console.error('❌', error instanceof Error ? error.message : error);
  process.exit(1);
});
