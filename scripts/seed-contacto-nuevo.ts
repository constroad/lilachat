/**
 * Data de QA para probar «sumar al grupo a un contacto NUEVO».
 *
 * El caso que hay que reproducir es incómodo de conseguir a mano: alguien que
 * **está registrado en Lilachat, está en la agenda del teléfono y NO tiene
 * ninguna conversación conmigo**. Es justo el que la hoja vieja no mostraba —
 * listaba solo con quien ya había chat abierto—, así que sin este usuario la
 * prueba no toca el camino nuevo.
 *
 * El número es el que YA está en la agenda del emulador (`999888777`): así el
 * cruce `POST /contacts/match` lo encuentra sin tocar los contactos del aparato.
 * No se le manda ningún código ni mensaje: se crea el usuario y nada más.
 *
 *   npx tsx --env-file=.env scripts/seed-contacto-nuevo.ts            # dry-run
 *   npx tsx --env-file=.env scripts/seed-contacto-nuevo.ts --apply
 *   npx tsx --env-file=.env scripts/seed-contacto-nuevo.ts --limpiar  # y verifica en cero
 */
import { connectDb } from '../server/src/db.js';
import { ChatModel } from '../server/src/chatModels.js';
import { UserModel } from '../server/src/models.js';

/** El de la agenda del emulador. No es de nadie: nunca se le escribe. */
const QA_PHONE = '999888777';
const QA_NAME = 'QA-SUMAR — borrar';

const main = async () => {
  await connectDb();

  if (process.argv.includes('--limpiar')) {
    const usuario = await UserModel.findOne({ phone: QA_PHONE }).select('_id').lean();
    if (usuario) {
      // **Primero se lo saca de los chats.** Borrar al usuario dejando su id en
      // `members` deja un miembro fantasma: aparece en la lista y no es nadie.
      const sacado = await ChatModel.updateMany(
        { 'members.userId': usuario._id },
        { $pull: { members: { userId: usuario._id } } }
      );
      await UserModel.deleteOne({ _id: usuario._id });
      console.log(`🧹 sacado de ${sacado.modifiedCount} chats y borrado`);
    }

    const quedan = await UserModel.countDocuments({ phone: QA_PHONE });
    const enChats = await ChatModel.countDocuments({ 'members.userId': usuario?._id });
    console.log(`verificación → usuarios: ${quedan}, chats con él: ${enChats}`);
    process.exit(quedan === 0 && enChats === 0 ? 0 : 1);
  }

  const existente = await UserModel.findOne({ phone: QA_PHONE }).lean();
  console.log(
    existente
      ? `Ya existe ${QA_PHONE} (${existente._id}).`
      : `Se crea el usuario ${QA_PHONE} «${QA_NAME}», sin chats.`
  );

  if (!process.argv.includes('--apply')) {
    console.log('\n(dry-run) — volver a correr con --apply');
    process.exit(0);
  }

  const usuario = existente ?? (await UserModel.create({ phone: QA_PHONE, name: QA_NAME })).toObject();
  console.log(`✅ ${usuario._id} — ahora aparece en «Sumar al grupo» y no antes.`);
  process.exit(0);
};

void main();
