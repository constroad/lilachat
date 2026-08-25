import { execFile } from 'node:child_process';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import { formatBytes } from '@lilachat/shared';
import { backupDir, listBackups, runBackup } from '../server/src/backupRunner.js';
import { ChatModel, MessageModel } from '../server/src/chatModels.js';
import { latestBackup } from './restore.js';

const run = promisify(execFile);

/**
 * El E2E de F7: respaldar de verdad y RESTAURAR de verdad.
 *
 * El criterio del spec es «restore probado contra DB efímera», y la razón es
 * que un respaldo que nadie restauró es una carpeta con archivos, no un
 * respaldo. Acá el ciclo se cierra entero:
 *
 *   sembrar → mongodump real → tar → restaurar en un mongod efímero →
 *   comparar documento por documento → limpiar
 *
 * La comparación es lo que le da valor: que el tar exista no prueba nada. Lo
 * que se verifica es que **los mensajes vuelven con el mismo contenido**.
 */
const MARCADOR = 'QA-F7 — borrar';

async function main(): Promise<void> {
  const url = process.env.MONGO_URL;
  if (!url) throw new Error('Falta MONGO_URL (corré con --env-file=.env).');

  await mongoose.connect(url);
  let efimero: MongoMemoryServer | null = null;
  let creado: string | null = null;

  try {
    // ── 1. Sembrar algo reconocible ──────────────────────────────────────
    const yo = new Types.ObjectId();
    const chat = await ChatModel.create({
      kind: 'group',
      name: MARCADOR,
      lastSeq: 2,
      members: [{ userId: yo }],
    });
    await MessageModel.create([
      { chatId: chat._id, seq: 1, senderId: yo, kind: 'text', body: 'Primero de F7', clientKey: 'qa-f7-1' },
      { chatId: chat._id, seq: 2, senderId: yo, kind: 'text', body: 'Segundo de F7', clientKey: 'qa-f7-2' },
      // Con media DE VERDAD: el manifiesto decía «0 archivos» durante toda la
      // fase porque la consulta miraba un campo inexistente, y un cero es
      // perfectamente creíble. Sin un mensaje con foto acá, seguiría mintiendo.
      {
        chatId: chat._id,
        seq: 3,
        senderId: yo,
        kind: 'image',
        clientKey: 'qa-f7-3',
        media: { mediaId: 'qa-f7-media', url: '/files/companies/constroad/apps/lilachat/qa.jpg' },
      },
    ]);
    console.log(`1. Sembrado chat ${chat._id} con 3 mensajes (uno con foto)`);

    // ── 2. Respaldo REAL ─────────────────────────────────────────────────
    const resultado = await runBackup();
    creado = resultado.name;
    console.log(
      `2. Respaldo ${resultado.name} — ${formatBytes(resultado.sizeBytes)}, ` +
        `media referenciada: ${resultado.mediaCount}, purgados: ${resultado.removed.length}`
    );

    const enDisco = await latestBackup(backupDir());
    if (enDisco !== resultado.name) throw new Error('El respaldo no quedó en la carpeta.');
    if (resultado.mediaCount < 1) {
      throw new Error('El manifiesto no registró la foto sembrada: la consulta de media está mal.');
    }

    // ── 3. Restaurar en una base EFÍMERA ─────────────────────────────────
    //
    // Nunca sobre la base viva: el sentido de la prueba es comprobar el camino
    // de vuelta, no pisar producción con un dump.
    efimero = await MongoMemoryServer.create();
    const destino = efimero.getUri();
    await run(
      'npx',
      ['tsx', 'scripts/restore.ts', '--a', destino, '--archivo', resultado.name],
      { cwd: path.resolve(import.meta.dirname, '..'), timeout: 10 * 60_000 }
    );
    console.log('3. Restaurado en la base efímera');

    // ── 4. Comparar: lo que importa ──────────────────────────────────────
    // SE MIRA LA BASE CON EL NOMBRE ORIGINAL, no la que nombre la URI destino.
    //
    // `mongorestore` restaura cada colección en la base de la que salió: el
    // dump de `lilachat_db` vuelve a `lilachat_db`, sin importar a qué base
    // apunte la URI. La URI efímera no nombra ninguna, así que mongoose se
    // conectaba a `test` —vacía— y la verificación daba «no coincide» con el
    // respaldo perfectamente restaurado al lado.
    const nombreDb = mongoose.connection.db!.databaseName;
    const verificador = await mongoose.createConnection(destino, { dbName: nombreDb }).asPromise();
    const db = verificador.db!;

    const chatsRestaurados = await db
      .collection('chats')
      .find({ name: MARCADOR })
      .toArray();
    const mensajesRestaurados = await db
      .collection('messages')
      .find({ chatId: chat._id })
      .sort({ seq: 1 })
      .toArray();

    const textos = mensajesRestaurados.filter((m) => m.kind === 'text').map((m) => m.body);
    const foto = mensajesRestaurados.find((m) => m.kind === 'image');
    const ok =
      chatsRestaurados.length === 1 &&
      JSON.stringify(textos) === JSON.stringify(['Primero de F7', 'Segundo de F7']) &&
      // La media viaja como REFERENCIA: el binario vive en lila, pero el
      // mensaje que lo apunta tiene que volver con su URL intacta. Sin esto,
      // una conversación restaurada tendría las fotos en la nada.
      foto?.media?.url === '/files/companies/constroad/apps/lilachat/qa.jpg';

    console.log(
      `4. Verificación (base "${nombreDb}"): chats=${chatsRestaurados.length} ` +
        `textos=[${textos.join(', ')}] foto=${foto?.media?.url ?? 'NO VOLVIÓ'}`
    );
    await verificador.close();

    if (!ok) throw new Error('❌ Lo restaurado NO coincide con lo respaldado.');
    console.log('✅ El respaldo se restauró y coincide documento por documento.');
  } finally {
    // ── 5. Limpieza verificada ───────────────────────────────────────────
    const chats = await ChatModel.find({ name: MARCADOR }).select('_id').lean();
    await MessageModel.deleteMany({ chatId: { $in: chats.map((c) => c._id) } });
    await ChatModel.deleteMany({ name: MARCADOR });
    if (creado) await rm(path.join(backupDir(), creado), { force: true }).catch(() => undefined);

    const quedan = await ChatModel.countDocuments({ name: MARCADOR });
    const archivos = (await listBackups()).filter((file) => file.name === creado).length;
    console.log(`🧹 Limpieza: chatsQA=${quedan} archivoQA=${archivos}`);

    await efimero?.stop();
    await mongoose.disconnect();
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
