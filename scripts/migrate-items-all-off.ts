/**
 * Commands and schedules (agentes `specs/COMANDOS-Y-HORARIOS.spec.md` §2.1): every
 * installation from before gets every command and action of its app written
 * off, as José approved. Until this runs they keep the old defaults (actions
 * global, every channel, the 1:1, anyone). It writes production: only with
 * José's OK.
 *
 *   npx tsx --env-file=.env scripts/migrate-items-all-off.ts            # dry-run: how many
 *   npx tsx --env-file=.env scripts/migrate-items-all-off.ts --apply
 */
import { connectDb } from '../server/src/db.js';
import { BotInstallationModel } from '../server/src/bots/botModels.js';
import { migrateItemsToAllOff } from '../server/src/bots/botItems.js';

async function main(): Promise<void> {
  await connectDb();
  const pending = await BotInstallationModel.countDocuments({ itemsV2: { $ne: true } });
  console.log(`Instalaciones con los valores de antes: ${pending}`);
  if (!process.argv.includes('--apply')) {
    console.log('Dry-run: nada cambiado. Con --apply quedan todas apagadas.');
    process.exit(0);
  }
  const { installations } = await migrateItemsToAllOff();
  console.log(`Apagadas: ${installations}`);
  process.exit(0);
}

void main();
