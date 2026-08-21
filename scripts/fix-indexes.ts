/**
 * Borra índices que quedaron de un esquema anterior.
 *
 * Mongoose crea los índices que declara pero **nunca borra los que dejó de
 * declarar**. Al mover la identidad de email a teléfono, el `email_1` único
 * siguió vivo y hacía fallar al segundo usuario sin correo con
 * `dup key: { email: null }` — un fallo que los tests con base en memoria no
 * pueden ver, porque arrancan sin índices previos.
 *
 *   npx tsx --env-file=.env scripts/fix-indexes.ts            # dry-run
 *   npx tsx --env-file=.env scripts/fix-indexes.ts --apply
 */
import mongoose from 'mongoose';
import { connectDb } from '../server/src/db.js';

const main = async () => {
  const apply = process.argv.includes('--apply');
  await connectDb();
  const users = mongoose.connection.collection('users');
  const indexes = (await users.indexes()) as { name?: string; unique?: boolean; sparse?: boolean }[];

  const stale = indexes.filter(
    (index) => index.name === 'email_1' && index.unique && !index.sparse
  );
  console.log('índices de users:', indexes.map((index) => index.name).join(', '));
  if (stale.length === 0) {
    console.log('✅ no hay índices obsoletos');
    process.exit(0);
  }
  console.log(`⚠️  obsoleto: ${stale.map((index) => index.name).join(', ')} (unique sin sparse)`);
  if (!apply) {
    console.log('\n(dry-run) — volver a correr con --apply');
    process.exit(0);
  }
  for (const index of stale) await users.dropIndex(index.name!);
  console.log('✅ borrado. El esquema lo vuelve a crear con sparse al arrancar.');
  process.exit(0);
};

void main();
