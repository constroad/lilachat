/**
 * Data de QA para el E2E de F2: un segundo usuario y un chat con historial.
 * Marcador propio (`QA-F2`) para poder borrarlo sin tocar nada real.
 *
 *   npx tsx --env-file=.env scripts/seed-chat.ts 902049935            # dry-run
 *   npx tsx --env-file=.env scripts/seed-chat.ts --apply
 *   npx tsx --env-file=.env scripts/seed-chat.ts --limpiar
 */
import { connectDb } from '../server/src/db.js';
import { ChatModel, MessageModel, ReceiptModel } from '../server/src/chatModels.js';
import { UserModel } from '../server/src/models.js';
import { sendMessage } from '../server/src/chatService.js';

const QA_PHONE = '999000111';
const CHAT_NAME = 'QA-F2 — borrar';

const main = async () => {
  const apply = process.argv.includes('--apply');
  const limpiar = process.argv.includes('--limpiar');
  const owner = process.argv.find((arg) => /^\d{9}$/.test(arg));
  await connectDb();

  if (limpiar) {
    const chats = await ChatModel.find({ name: CHAT_NAME }).select('_id').lean();
    const ids = chats.map((chat) => chat._id);
    const [mensajes, acuses] = await Promise.all([
      MessageModel.deleteMany({ chatId: { $in: ids } }),
      ReceiptModel.deleteMany({ chatId: { $in: ids } }),
    ]);
    await ChatModel.deleteMany({ name: CHAT_NAME });
    await UserModel.deleteMany({ phone: QA_PHONE });
    const quedan = await ChatModel.countDocuments({ name: CHAT_NAME });
    console.log(
      `🧹 borrados ${chats.length} chats, ${mensajes.deletedCount} mensajes, ${acuses.deletedCount} acuses — quedan ${quedan}`
    );
    process.exit(quedan === 0 ? 0 : 1);
  }

  if (!owner) {
    console.error('Uso: seed-chat.ts <tu-celular> [--apply|--limpiar]');
    process.exit(1);
  }
  const me = await UserModel.findOne({ phone: owner }).lean();
  if (!me) {
    console.error(`❌ No existe el usuario ${owner}. Da de alta el teléfono primero.`);
    process.exit(1);
  }

  console.log(`Chat «${CHAT_NAME}» entre ${owner} y ${QA_PHONE}, con 2 mensajes de historial.`);
  if (!apply) {
    console.log('\n(dry-run) — volver a correr con --apply');
    process.exit(0);
  }

  const other =
    (await UserModel.findOne({ phone: QA_PHONE })) ??
    (await UserModel.create({ phone: QA_PHONE, name: 'Prueba QA' }));

  const existing = await ChatModel.findOne({ name: CHAT_NAME });
  const chat =
    existing ??
    (await ChatModel.create({
      kind: 'group',
      name: CHAT_NAME,
      members: [
        { userId: me._id, role: 'admin' },
        { userId: other._id, role: 'member' },
      ],
      lastSeq: 0,
    }));

  // Por el servicio, no por insert directo: así el `seq` y la idempotencia son
  // los REALES (un seed que escribe a mano no prueba el camino que usa la app).
  await sendMessage({
    chatId: String(chat._id),
    senderId: other._id,
    clientKey: 'qa-f2-1',
    body: 'Hola, este es el chat de prueba.',
  });
  await sendMessage({
    chatId: String(chat._id),
    senderId: other._id,
    clientKey: 'qa-f2-2',
    body: '¿Se ve el no leído?',
  });

  console.log(`✅ chat ${chat._id} listo (lastSeq=${(await ChatModel.findById(chat._id))?.lastSeq})`);
  process.exit(0);
};

void main();
