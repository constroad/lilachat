/**
 * Arregla índices que quedaron de un esquema anterior.
 *
 * Mongoose crea los índices que declara pero **nunca borra los que dejó de
 * declarar**. Al mover la identidad de email a teléfono, el `email_1` único
 * siguió vivo y hacía fallar al segundo usuario sin correo con
 * `dup key: { email: null }` — un fallo que los tests con base en memoria no
 * pueden ver, porque arrancan sin índices previos.
 *
 * Le volvió a pasar a `invitations` (José, 18/10/2026): «Invitar» contestaba
 * «Algo falló de nuestro lado» porque ya había UNA invitación sin correo. Y en
 * la bóveda las apps no crean índices solas (`autoIndex: false`), así que el
 * reemplazo `sparse` se crea acá mismo, no «al arrancar».
 *
 *   npx tsx --env-file=.env scripts/fix-indexes.ts            # dry-run
 *   npx tsx --env-file=.env scripts/fix-indexes.ts --apply
 */
import mongoose from 'mongoose';
import { connectDb } from '../server/src/db.js';

/** Las colecciones cuyo `email` es opcional y único: el índice tiene que ser `sparse`. */
const CON_EMAIL_OPCIONAL = ['users', 'invitations'];

type Indice = { name?: string; unique?: boolean; sparse?: boolean };

const arreglar = async (nombre: string, apply: boolean): Promise<void> => {
  const coleccion = mongoose.connection.collection(nombre);
  const indices = (await coleccion.indexes()) as Indice[];
  console.log(`índices de ${nombre}:`, indices.map((indice) => indice.name).join(', '));
  const viejo = indices.find((indice) => indice.name === 'email_1' && indice.unique && !indice.sparse);
  if (!viejo) return console.log(`✅ ${nombre}: sin índices obsoletos`);
  console.log(`⚠️  ${nombre}: email_1 es unique sin sparse`);
  if (!apply) return;
  await coleccion.dropIndex('email_1');
  await coleccion.createIndex({ email: 1 }, { name: 'email_1', unique: true, sparse: true });
  console.log(`✅ ${nombre}: email_1 recreado con sparse`);
};

const main = async () => {
  const apply = process.argv.includes('--apply');
  await connectDb();
  for (const nombre of CON_EMAIL_OPCIONAL) await arreglar(nombre, apply);
  if (!apply) console.log('\n(dry-run) — volver a correr con --apply');
  process.exit(0);
};

void main();
