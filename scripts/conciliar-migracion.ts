/**
 * Conciliar la migración de `lilachat_db` de Atlas a bóveda (16/10/2026).
 *
 * El volcado (`mongodump` → `mongorestore`) se hace con el server todavía en
 * Atlas; entre ese momento y el reinicio contra bóveda pueden entrar mensajes a
 * Atlas. Este script los trae sin pisar lo que el server ya escribió en bóveda:
 *
 * - todo documento de Atlas que falte en bóveda (por `_id`) se inserta;
 * - un mensaje cuyo `(chatId, seq)` ya está ocupado en bóveda NO se inserta y
 *   se informa: es un choque real que hay que mirar, no algo a resolver solo;
 * - `chats.lastSeq` y los acuses (`readSeq`, `deliveredSeq`) quedan en el
 *   MÁXIMO de los dos lados: nunca retroceden.
 *
 * Uso (las URIs van en archivos, nunca en la línea de comandos):
 *   ORIGEN_URI_FILE=~/atlas.uri DESTINO_URI_FILE=~/boveda.uri \
 *     npx tsx scripts/conciliar-migracion.ts [--contar] [--aplicar]
 * Sin `--aplicar` solo dice qué haría.
 */
import { readFileSync } from 'node:fs';
import { MongoClient, type Db, type Document } from 'mongodb';

const TIMEOUT_DEL_TUNEL_MS = 20_000;

function uriDe(variable: string): string {
  const ruta = process.env[variable];
  if (!ruta) throw new Error(`Falta ${variable} (ruta a un archivo con la URI)`);
  const contenido = readFileSync(ruta.replace(/^~/, process.env.HOME ?? ''), 'utf8').trim();
  // Acepta el archivo de `boveda … --archivo` (`MONGODB_URI=…`) o la URI sola.
  return contenido.replace(/^[A-Z_]+=/, '');
}

async function contar(db: Db): Promise<Record<string, number>> {
  const colecciones = (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name).sort();
  const cuentas: Record<string, number> = {};
  for (const nombre of colecciones) cuentas[nombre] = await db.collection(nombre).countDocuments();
  return cuentas;
}

async function faltantes(origen: Db, destino: Db, coleccion: string): Promise<Document[]> {
  const enDestino = new Set(
    (await destino.collection(coleccion).find({}, { projection: { _id: 1 } }).toArray()).map((d) => String(d._id))
  );
  const todos = await origen.collection(coleccion).find({}).toArray();
  return todos.filter((doc) => !enDestino.has(String(doc._id)));
}

async function conciliarMensajes(origen: Db, destino: Db, aplicar: boolean): Promise<void> {
  const nuevos = await faltantes(origen, destino, 'messages');
  let insertados = 0;
  for (const mensaje of nuevos) {
    const ocupado = await destino.collection('messages').findOne({ chatId: mensaje.chatId, seq: mensaje.seq });
    if (ocupado) {
      console.log(`  ⚠ choque: chat ${String(mensaje.chatId)} seq ${mensaje.seq} ya existe en bóveda — revisar a mano`);
      continue;
    }
    if (aplicar) await destino.collection('messages').insertOne(mensaje);
    insertados += 1;
  }
  console.log(`messages: ${insertados} a insertar de ${nuevos.length} faltantes`);
}

async function conciliarMaximos(origen: Db, destino: Db, aplicar: boolean): Promise<void> {
  let chats = 0;
  for await (const chat of origen.collection('chats').find({}, { projection: { lastSeq: 1 } })) {
    const r = aplicar
      ? await destino.collection('chats').updateOne({ _id: chat._id }, { $max: { lastSeq: chat.lastSeq ?? 0 } })
      : { modifiedCount: 0 };
    chats += r.modifiedCount;
  }
  let acuses = 0;
  for await (const acuse of origen.collection('receipts').find({})) {
    const r = aplicar
      ? await destino
          .collection('receipts')
          .updateOne(
            { chatId: acuse.chatId, userId: acuse.userId },
            { $max: { readSeq: acuse.readSeq ?? 0, deliveredSeq: acuse.deliveredSeq ?? 0 } }
          )
      : { modifiedCount: 0 };
    acuses += r.modifiedCount;
  }
  console.log(`chats.lastSeq subidos: ${chats} · acuses subidos: ${acuses}`);
}

async function main(): Promise<void> {
  const aplicar = process.argv.includes('--aplicar');
  const soloContar = process.argv.includes('--contar');
  const origen = new MongoClient(uriDe('ORIGEN_URI_FILE'), { serverSelectionTimeoutMS: TIMEOUT_DEL_TUNEL_MS });
  const destino = new MongoClient(uriDe('DESTINO_URI_FILE'), { serverSelectionTimeoutMS: TIMEOUT_DEL_TUNEL_MS });
  await Promise.all([origen.connect(), destino.connect()]);
  try {
    const [dbOrigen, dbDestino] = [origen.db('lilachat_db'), destino.db('lilachat_db')];
    const [cOrigen, cDestino] = await Promise.all([contar(dbOrigen), contar(dbDestino)]);
    for (const nombre of [...new Set([...Object.keys(cOrigen), ...Object.keys(cDestino)])].sort()) {
      const marca = cOrigen[nombre] === cDestino[nombre] ? '=' : '≠';
      console.log(`${marca} ${nombre}: atlas ${cOrigen[nombre] ?? 0} · bóveda ${cDestino[nombre] ?? 0}`);
    }
    if (soloContar) return;

    for (const coleccion of Object.keys(cOrigen).filter((c) => c !== 'messages')) {
      const nuevos = await faltantes(dbOrigen, dbDestino, coleccion);
      if (nuevos.length === 0) continue;
      if (aplicar) await dbDestino.collection(coleccion).insertMany(nuevos, { ordered: false });
      console.log(`${coleccion}: ${nuevos.length} faltantes ${aplicar ? 'insertados' : 'a insertar'}`);
    }
    await conciliarMensajes(dbOrigen, dbDestino, aplicar);
    await conciliarMaximos(dbOrigen, dbDestino, aplicar);
    if (!aplicar) console.log('\n(sin --aplicar: no se escribió nada)');
  } finally {
    await Promise.all([origen.close(), destino.close()]);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
