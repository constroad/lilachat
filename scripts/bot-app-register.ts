/**
 * Registers an app of the bots API (`specs/BOTS-API.spec.md` §0), or rotates
 * its client secret. The client_id is printed (it is public); the client
 * secret is NEVER printed: it goes to a file only you can read, for José to
 * load in Torre and then delete.
 *
 *   npx tsx --env-file=.env scripts/bot-app-register.ts --name Lila \
 *     --redirect-uri https://agentes.constroad.com/canales/lilachat/vuelta \
 *     --webhook-url https://agentes.constroad.com/v1/channels/lilachat/events
 *
 * Only where «Instalar» goes, without rotating the secret:
 *   npx tsx --env-file=.env scripts/bot-app-register.ts --name Lila \
 *     --install-url https://agentes.constroad.com/canales/lilachat/instalar
 */
import { writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { connectDb } from '../server/src/db.js';
import { BotAppModel } from '../server/src/bots/botModels.js';
import { newSecret, sha256 } from '../server/src/bots/botSecrets.js';

const arg = (name: string): string | undefined => {
  const index = process.argv.indexOf(`--${name}`);
  return index > 0 ? process.argv[index + 1] : undefined;
};

/** https only; http just for a local agentes in development. */
const validUrl = (value: string | undefined): value is string => Boolean(value && (/^https:\/\//.test(value) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(value)));

async function main(): Promise<void> {
  const name = arg('name');
  const redirectUri = arg('redirect-uri');
  const webhookUrl = arg('webhook-url');
  const installUrl = arg('install-url');
  // Only the install address (agentes, 23/10): it does NOT rotate the secret already loaded in Torre.
  if (name && installUrl && !redirectUri && !webhookUrl) {
    if (!validUrl(installUrl)) throw new Error('--install-url va con https.');
    await connectDb();
    const result = await BotAppModel.updateOne({ name }, { $set: { installUrl } });
    console.log(result.matchedCount ? `${name}: «Instalar» lleva a ${installUrl}` : `No hay una app «${name}» registrada.`);
    process.exit(result.matchedCount ? 0 : 1);
  }
  if (!name || !validUrl(redirectUri) || !validUrl(webhookUrl)) throw new Error('Faltan --name, --redirect-uri y --webhook-url (https).');
  await connectDb();
  const clientSecret = newSecret('lcx_');
  const existing = await BotAppModel.findOne({ name }).lean();
  const clientId = existing?.clientId ?? newSecret('lca_').slice(0, 24);
  await BotAppModel.updateOne({ clientId }, { $set: { name, redirectUris: [redirectUri], webhookUrl, clientSecretHash: sha256(clientSecret) } }, { upsert: true });
  const file = join(homedir(), `lilachat-${name.toLowerCase()}-client-secret.txt`);
  writeFileSync(file, `${clientSecret}\n`, { mode: 0o600 });
  console.log(`${existing ? 'Rotado' : 'Registrado'}: ${name}`);
  console.log(`client_id: ${clientId}`);
  console.log(`client_secret: en ${file} (solo tu usuario lo lee). Cárgalo en Torre y borra el archivo.`);
  process.exit(0);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
