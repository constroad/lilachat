/**
 * The bots API's indexes (`specs/BOTS-API.spec.md`). The vault creates no
 * index by itself (`autoIndex: false`), so they are created here, with José's
 * OK. The collections start empty: each index takes milliseconds.
 *
 *   npx tsx --env-file=.env scripts/bot-indexes.ts            # dry-run: what is missing
 *   npx tsx --env-file=.env scripts/bot-indexes.ts --apply
 */
import { connectDb } from '../server/src/db.js';
import { BotAppModel, BotDeliveryModel, BotInstallationModel, OAuthCodeModel } from '../server/src/bots/botModels.js';
import { AppScheduleModel } from '../server/src/bots/scheduleModels.js';

const MODELS = [BotAppModel, BotInstallationModel, OAuthCodeModel, BotDeliveryModel, AppScheduleModel] as const;

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  await connectDb();
  for (const model of MODELS) {
    const declared = model.schema.indexes().map(([fields]) => JSON.stringify(fields));
    const existing = await model.collection.indexes().catch(() => []);
    const present = new Set(existing.map((index) => JSON.stringify(index.key)));
    const missing = declared.filter((fields) => !present.has(fields));
    console.log(`${model.collection.name}: ${missing.length ? `faltan ${missing.join(', ')}` : 'completos'}`);
    if (apply && missing.length) await model.createIndexes();
  }
  if (!apply) console.log('Dry-run: nada creado. Con --apply se crean.');
  process.exit(0);
}

void main();
