/**
 * Bootstrap del gate (spec §5.1): siembra las primeras invitaciones.
 * Sin esto no entra NADIE — constroad-auth manda códigos a cualquiera, pero el
 * server solo se los pide a quien esté acá.
 *
 *   npx tsx --env-file=.env scripts/seed-invitations.ts 902049935:jose@x.com   # dry-run
 *   npx tsx --env-file=.env scripts/seed-invitations.ts 902049935 --apply
 *
 * Idempotente: re-sembrar un correo existente no duplica ni pisa nada.
 */
import { connectDb } from '../server/src/db.js';
import { InvitationModel } from '../server/src/models.js';
import { normalizePeruPhone } from '@lilachat/shared';

const main = async () => {
  const apply = process.argv.includes('--apply');
  // Formato: `celular` o `celular:correo`. El correo es el canal de RESPALDO —
  // sin él, una caída de WhatsApp deja a esa persona sin poder enrolar.
  const args = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
  const parsed = args.map((arg) => {
    const [rawPhone, email] = arg.split(':');
    return { phone: normalizePeruPhone(rawPhone), email: email?.trim().toLowerCase() };
  });
  const valid = parsed.filter((entry) => entry.phone);
  const invalid = parsed.length - valid.length;

  if (valid.length === 0) {
    console.error('Uso: seed-invitations.ts <celular[:correo]> […] [--apply]');
    process.exit(1);
  }
  if (invalid > 0) console.warn(`⚠️  ${invalid} argumento(s) sin forma de celular, ignorados`);

  console.log(`Invitaciones a sembrar (${valid.length}) — celulares:`);
  valid.forEach((entry) =>
    console.log(`  ${entry.phone}${entry.email ? ` (respaldo: ${entry.email})` : ' — SIN respaldo'}`)
  );
  if (!apply) {
    console.log('\n(dry-run) — volver a correr con --apply');
    process.exit(0);
  }

  await connectDb();
  for (const entry of valid) {
    await InvitationModel.updateOne(
      { phone: entry.phone },
      {
        $setOnInsert: { phone: entry.phone, invitedBy: 'seed', status: 'invited' },
        // El correo SÍ se actualiza si viene: agregar el respaldo a alguien que
        // ya estaba invitado tiene que funcionar sin borrar y volver a crear.
        ...(entry.email ? { $set: { email: entry.email } } : {}),
      },
      { upsert: true }
    );
  }
  const total = await InvitationModel.countDocuments({ status: 'invited' });
  console.log(`✅ sembradas. Invitaciones activas en total: ${total}`);
  process.exit(0);
};

void main();
