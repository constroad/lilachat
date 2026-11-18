/**
 * Local E2E of the Dali space (BOTS-API fase 2): an in-memory MongoDB, the real Lilachat server on :4003, a stub of
 * agentes' webhook and of constroad-auth on :4013, and QA data put through the real bots API. Nothing touches
 * production: the database lives in memory and dies with the process.
 *
 *   npx tsx scripts/e2e-dali.ts                     # from lilachat/; Ctrl-C stops the server and the database
 *
 * The APK (debug, `EXPO_PUBLIC_API_URL=http://10.0.2.2:4003`) signs in with 900000099 and the QA code 424242, the
 * web reads its session from `GET http://127.0.0.1:4013/session`. Then:
 *
 *   maestro --device "$ANDROID_SERIAL" test app/.maestro/dali.yaml
 *
 * Every write the seller makes reaches the stub: `<tmp>/lilachat-e2e-dali/events.json` lists them in order. The flow
 * changes the data, so each run starts from a fresh harness.
 */
import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { startTestMongo } from '../server/src/testMongo.js';
import { DeviceModel, UserModel } from '../server/src/models.js';
import { WorkspaceMemberModel, WorkspaceModel } from '../server/src/workspaceModels.js';
import { BotAppModel, BotInstallationModel } from '../server/src/bots/botModels.js';
import { ProspectChannelModel } from '../server/src/bots/botProspects.js';

const SERVER_DIR = fileURLToPath(new URL('../server', import.meta.url));
/** The QA session (a device secret of the in-memory database) and the events stay outside the repo. */
const OUT_DIR = process.env.E2E_OUT_DIR || path.join(tmpdir(), 'lilachat-e2e-dali');
/** QA's own media disk (with its marker): an upload never falls back to lila. */
const MEDIA_ROOT = path.join(OUT_DIR, 'media');
const API = 'http://127.0.0.1:4003/api';
/** Overridable so two E2E runs (web and APK) can share the Mac: `E2E_HOOK_PORT=4023 E2E_OUT_DIR=… npx tsx …`. */
const HOOK_PORT = Number(process.env.E2E_HOOK_PORT) || 4013;
const JWT_SECRET = randomBytes(24).toString('hex');
const TOKEN = `lcb_e2e_${randomBytes(12).toString('hex')}`;
const QA_CODE = '424242';
const QA_PHONE = '900000099';
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const BOOT_TRIES = 120;
const BOOT_PAUSE_MS = 500;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
/** José 17/11: a KML in a chat, served as the real one came (`application/octet-stream`), to open or download. */
const KML_PATH = '/media/qa/metrados-161126.kml';

/** A made-up report PDF drawn with shapes only (header band, table rows), so it renders without fonts. */
function syntheticReportPdf(pages: number): Buffer {
  const rows = Array.from({ length: 14 }, (_, index) => `0.85 0.87 0.9 rg 48 ${600 - index * 32} 499 1 re f`).join(' ');
  const content = `0.12 0.2 0.45 rg 0 762 595 80 re f 0.95 0.6 0.1 rg 48 700 160 24 re f ${rows} 0.12 0.2 0.45 rg 48 120 200 40 re f`;
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', `<< /Type /Pages /Kids [${Array.from({ length: pages }, (_, index) => `${3 + index * 2} 0 R`).join(' ')}] /Count ${pages} >>`];
  for (let index = 0; index < pages; index += 1) {
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${4 + index * 2} 0 R >>`);
    objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  }
  let body = '%PDF-1.4\n';
  const offsets = objects.map((object, index) => {
    const at = body.length;
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return at;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((at) => `${String(at).padStart(10, '0')} 00000 n \n`).join('')}`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, 'latin1');
}
const KML = '<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><Placemark><name>Parche 1</name><Point><coordinates>-77.03,-12.05,0</coordinates></Point></Placemark></Document></kml>';

/** What agentes answers to «Lo que Dali sabe»: Constroad's services, catalog, FAQ, zone and hours. */
const knowledge = {
  services: [
    { key: 'venta_mezcla', name: 'Venta de mezcla', questions: [{ key: 'cantidad', label: 'Cantidad', required: true, common: true }, { key: 'fecha', label: 'Fecha', required: true, common: true }, { key: 'recojo', label: 'Recojo o entrega', required: false, common: false }] },
    { key: 'asfaltado', name: 'Asfaltado', questions: [{ key: 'cantidad', label: 'Cantidad', required: true, common: true }, { key: 'fecha', label: 'Fecha', required: true, common: true }, { key: 'lugar', label: 'Lugar', required: true, common: false }, { key: 'espesor', label: 'Espesor', required: false, common: false }] },
    { key: 'emulsiones', name: 'Asfaltos líquidos y emulsiones', questions: [{ key: 'cantidad', label: 'Cantidad', required: true, common: true }] },
  ],
  catalog: [
    { service_key: 'venta_mezcla', name: 'Mezcla asfáltica en caliente MAC-2', unit: 'm³', price: 580 },
    { service_key: 'venta_mezcla', name: 'Mezcla asfáltica en frío', unit: 'm³', price: 350 },
    { service_key: 'asfaltado', name: 'Asfaltado E=2" puesto en obra', unit: 'm³', price: 750 },
    { service_key: 'emulsiones', name: 'Emulsión asfáltica CSS-1H', unit: 'galón', price: 12 },
    { service_key: 'transporte', name: 'Transporte de mezcla en Lima', unit: 'm³', price: 35 },
  ],
  faqs: [{ id: 'faq-1', question: '¿Dónde está la planta?', answer: 'En Cajamarquilla, Lurigancho.' }],
  zone: 'Lima y alrededores (planta en Cajamarquilla, Lurigancho)',
  hours: 'Lunes a viernes 8:00–18:00 · sábado 8:00–13:00',
  edit_url: 'https://agentes.constroad.com/dali/',
};

const events: { type?: string; data?: unknown }[] = [];
const deviceSecrets = new Map<string, string>();
let session = '{}';

/** constroad-auth for the APK's real code screen: any phone gets «sent», only 424242 verifies. */
function fakeAuth(url: string, body: Record<string, string>): [number, Record<string, string>] {
  if (url === '/auth/v1/codigo') return [200, { canal: 'whatsapp' }];
  if (url === '/auth/v1/verificar') {
    if (body.codigo !== QA_CODE) return [400, { codigo: 'codigo_invalido' }];
    const secreto = randomBytes(24).toString('base64url');
    deviceSecrets.set(body.deviceId ?? '', secreto);
    return [200, { secreto }];
  }
  const device = /^\/auth\/v1\/dispositivos\/([^/]+)\/validar$/.exec(url)?.[1];
  if (device && deviceSecrets.get(decodeURIComponent(device)) === body.secreto) return [200, { companyId: 'constroad', identidad: QA_PHONE, app: 'lilachat' }];
  return [401, { codigo: 'dispositivo_invalido' }];
}

/** agentes' webhook: it records every event and answers what Dali knows and the FAQ it adds. */
function answerEvent(raw: string): Record<string, unknown> {
  const event = JSON.parse(raw || '{}') as { type?: string; data?: unknown };
  events.push(event);
  writeFileSync(path.join(OUT_DIR, 'events.json'), JSON.stringify(events, null, 1));
  if (event.type === 'dali.knowledge.requested') return knowledge;
  if (event.type === 'dali.faq.add') return { faq: { id: `faq-${events.length}` } };
  return {};
}

function startHook() {
  createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk: Buffer) => (raw += chunk.toString()));
    req.on('end', () => {
      // The browser of the E2E reads its QA session here, so the values never travel through a chat.
      if (req.method === 'GET' && req.url === '/session') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }).end(session);
        return;
      }
      // Our media as the real server serves it: `?download=<name>` makes it a download of that name.
      const asked = new URL(req.url ?? '/', 'http://stub');
      if (req.method === 'GET' && asked.pathname === KML_PATH) {
        const name = asked.searchParams.get('download');
        res.writeHead(200, { 'Content-Type': 'application/octet-stream', ...(name ? { 'Content-Disposition': `attachment; filename="${name}"` } : {}) }).end(KML);
        return;
      }
      // Everything else under /media/ is the server's own disk (the client's uploaded documents).
      if (req.method === 'GET' && asked.pathname.startsWith('/media/')) {
        void fetch(`http://127.0.0.1:4003${req.url}`).then(async (upstream) => {
          res.writeHead(upstream.status, Object.fromEntries(['content-type', 'content-disposition'].flatMap((name) => (upstream.headers.get(name) ? [[name, upstream.headers.get(name)!]] : []))));
          res.end(Buffer.from(await upstream.arrayBuffer()));
        }, () => res.writeHead(502).end());
        return;
      }
      if (req.url?.startsWith('/auth/')) {
        const [status, answer] = fakeAuth(req.url, JSON.parse(raw || '{}') as Record<string, string>);
        res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(answer));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(answerEvent(raw)));
    });
  }).listen(HOOK_PORT, '127.0.0.1');
}

async function call(urlPath: string, init: { method?: string; body?: unknown; auth: string }) {
  const method = init.method ?? (init.body ? 'POST' : 'GET');
  const response = await fetch(`${API}${urlPath}`, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${init.auth}` }, body: init.body ? JSON.stringify(init.body) : undefined });
  const text = await response.text();
  if (response.status >= 300) throw new Error(`${method} ${urlPath} → ${response.status} ${text}`);
  return JSON.parse(text || '{}') as unknown;
}

async function waitForServer() {
  for (let tries = 0; tries < BOOT_TRIES; tries += 1) {
    try {
      const response = await fetch(`${API}/health`);
      if (response.ok) return;
    } catch {
      // Still booting: the next try asks again.
    }
    await new Promise((resolve) => setTimeout(resolve, BOOT_PAUSE_MS));
  }
  throw new Error('El server local no arrancó');
}

type Seed = { id: string; body: Record<string, unknown>; said?: { text: string; at: string }[]; dali?: string[] };
const P = (n: number) => `dali:qa:${n}`;
const ad = (title: string) => ({ kind: 'ctwa', ad_title: title });

/** Twelve prospects that fill every section of the inbox, the funnel, the panel and last week's review. */
function seeds(): Seed[] {
  return [
    { id: P(1), body: { phone: '51987100001', name: 'Ricardo Huamán', last_activity_at: ago(6 * MIN), source: ad('Mezcla en planta'), stage: 'to_quote', score: 81, intent: 'purchase', service: { key: 'venta_mezcla', name: 'Venta de mezcla' }, summary: 'Mezcla 18 m³ · recojo en planta · esta semana', ready_at: ago(6 * MIN), score_reasons: ['18 m³', 'Recoge en planta', 'Esta semana'], fields: [{ key: 'cantidad', label: 'Cantidad', value: '18 m³' }, { key: 'recojo', label: 'Recojo o entrega', value: 'Recojo en planta' }, { key: 'fecha', label: 'Fecha', value: 'Esta semana' }] }, said: [{ text: 'Hola, necesito 18 m³ de mezcla para recoger en planta esta semana', at: ago(12 * MIN) }], dali: ['¡Hola Ricardo! Con gusto. ¿Qué día pasarías por la planta?'] },
    { id: P(2), body: { phone: '51949123824', name: 'Carmen Villanueva', last_activity_at: ago(40 * MIN), source: ad('Asfalto para condominios'), stage: 'visit', score: 86, intent: 'quote', service: { key: 'asfaltado', name: 'Asfaltado' }, summary: 'Asfalto en caliente 450 m² · Santa Clara · visita técnica', ready_at: ago(3 * HOUR), kind: 'company', score_reasons: ['450 m²', 'Ate', 'Antes de fin de mes', 'Pidió visita técnica'], fields: [{ key: 'servicio', label: 'Servicio', value: 'Pavimentación de estacionamiento' }, { key: 'proyecto', label: 'Proyecto', value: 'Condominio Los Álamos' }, { key: 'cantidad', label: 'Cantidad', value: '450 m²' }, { key: 'lugar', label: 'Lugar', value: 'Ate, Santa Clara' }, { key: 'fecha', label: 'Fecha', value: 'Antes del 30 de noviembre' }], unanswered: [{ question: '¿Trabajan en Huaral?', at: ago(8 * DAY) }] }, said: [{ text: 'Hola, vi su anuncio. Necesito asfaltar el estacionamiento del condominio, son como 450 m²', at: ago(3 * HOUR + 10 * MIN) }, { text: 'Ate, Santa Clara. Antes de fin de mes si se puede', at: ago(3 * HOUR) }], dali: ['¡Hola Carmen! Con gusto. ¿En qué distrito está el condominio y para cuándo lo necesitan?'] },
    { id: P(3), body: { phone: '51987100003', name: 'Luis Mendoza', last_activity_at: ago(4 * DAY), source: ad('Patios de maniobra'), stage: 'quoted', score: 78, intent: 'quote', service: { key: 'asfaltado', name: 'Asfaltado' }, summary: 'Patio 1,200 m² Lurín · cotización enviada', quote: { code: 'COT-2026-0233', amount: 96000, currency: 'PEN', sent_at: ago(4 * DAY) }, follow_up_draft: { text: 'Luis, buen día. ¿Tiene alguna duda sobre la cotización COT-2026-0233 del patio de maniobras?', for_at: ago(2 * HOUR) } }, said: [{ text: 'Necesito cotización para un patio de 1,200 m² en Lurín', at: ago(5 * DAY) }] },
    { id: P(4), body: { phone: '51987100004', name: 'Elena Rojas', last_activity_at: ago(3 * DAY), stage: 'missing_info', score: 64, intent: 'quote', service: { key: 'asfaltado', name: 'Asfaltado' }, summary: 'Losa deportiva 800 m² · SJL', missing: ['fecha'], fields: [{ key: 'cantidad', label: 'Cantidad', value: '800 m²' }, { key: 'lugar', label: 'Lugar', value: 'San Juan de Lurigancho' }], follow_up_draft: { text: 'Hola Elena, ¿para cuándo necesitarían la losa deportiva?', for_at: ago(30 * MIN) } }, said: [{ text: 'Quiero asfaltar una losa deportiva de 800 m² en SJL', at: ago(3 * DAY) }] },
    { id: P(5), body: { phone: '51912554018', last_activity_at: ago(20 * MIN), source: ad('Mezcla en planta'), stage: 'missing_info', score: 22, intent: 'information', summary: 'Solo preguntó «¿cuánto cuesta el metro?»' }, said: [{ text: '¿Cuánto cuesta el metro?', at: ago(25 * MIN) }], dali: ['¡Hola! Depende del servicio. ¿Necesitas mezcla o el asfaltado puesto en obra?'] },
    { id: P(6), body: { phone: '51987100006', name: 'Jorge Paredes', last_activity_at: ago(2 * HOUR), stage: 'missing_info', score: 31, intent: 'quote', service: { key: 'venta_mezcla', name: 'Venta de mezcla' }, summary: 'Bacheo 12 m² · Callao', missing: ['cantidad', 'fecha'], unanswered: [{ question: '¿Emiten factura con detracción?', at: ago(9 * DAY) }, { question: '¿trabajan en huaral', at: ago(10 * DAY) }] }, said: [{ text: 'Buenas, para un bacheo en el Callao', at: ago(2 * HOUR) }] },
    { id: P(7), body: { phone: '51987100007', name: 'Víctor Soto', last_activity_at: ago(27 * HOUR), source: ad('Mezcla en planta'), stage: 'to_quote', score: 69, intent: 'purchase', service: { key: 'venta_mezcla', name: 'Venta de mezcla' }, summary: '4 m³ de mezcla · listo para cotizar', ready_at: ago(27 * HOUR) }, said: [{ text: 'Necesito 4 m³ para el sábado', at: ago(27 * HOUR) }] },
    { id: P(8), body: { phone: '51987100008', name: 'Paola Ríos', attended_by: 'human', last_activity_at: ago(5 * HOUR), source: ad('Asfalto para condominios'), stage: 'negotiation', score: 74, intent: 'purchase', service: { key: 'asfaltado', name: 'Asfaltado' }, summary: 'Pide 5 % de descuento sobre COT-2026-0236', quote: { code: 'COT-2026-0236', amount: 168500, currency: 'PEN', sent_at: ago(2 * DAY) } }, said: [{ text: '¿Pueden hacer un 5 % de descuento?', at: ago(5 * HOUR) }] },
    { id: P(9), body: { phone: '51987100009', name: 'Gabriel Núñez', last_activity_at: ago(8 * DAY), stage: 'quoted', score: 80, intent: 'purchase', service: { key: 'venta_mezcla', name: 'Venta de mezcla' }, quote: { code: 'COT-2026-0219', amount: 8900, currency: 'PEN', sent_at: ago(10 * DAY) } } },
    { id: P(10), body: { phone: '51987100010', name: 'Sofía Paz', last_activity_at: ago(9 * DAY), stage: 'quoted', score: 55, intent: 'quote', service: { key: 'asfaltado', name: 'Asfaltado' } } },
    { id: P(11), body: { phone: '51987100011', name: 'Hugo Ramos', last_activity_at: ago(9 * DAY), stage: 'quoted', score: 48, intent: 'quote', service: { key: 'asfaltado', name: 'Asfaltado' } } },
    { id: P(12), body: { phone: '51987100012', name: 'Lucía Vega', last_activity_at: ago(8 * DAY), stage: 'quoted', score: 60, intent: 'quote', service: { key: 'venta_mezcla', name: 'Venta de mezcla' } } },
  ];
}

/** The space «Dali · Constroad QA»: José QA (owner, 900000099), Rosa and Marco, and Dali installed with its token. */
async function seedSpace() {
  const [jose, rosa, marco, bot] = await UserModel.create([{ phone: QA_PHONE, name: 'José QA', birthday: { day: 17, month: 3 } }, { phone: '900000011', name: 'Rosa Quispe' }, { phone: '900000012', name: 'Marco Salas' }, { phone: 'bot-dali-qa', name: 'Dali' }]);
  const space = await WorkspaceModel.create({ name: 'Dali · Constroad QA', ownerId: jose!._id, joinCode: 'DALI-QA01' });
  await WorkspaceMemberModel.create([
    { workspaceId: space._id, userId: jose!._id, phone: QA_PHONE, role: 'owner', status: 'active' },
    { workspaceId: space._id, userId: rosa!._id, phone: '900000011', role: 'member', status: 'active' },
    { workspaceId: space._id, userId: marco!._id, phone: '900000012', role: 'member', status: 'active' },
  ]);
  const app = await BotAppModel.create({ clientId: 'lca_dali_qa', clientSecretHash: 'x', name: 'Dali', redirectUris: ['https://agentes.example.com/cb'], webhookUrl: `http://127.0.0.1:${HOOK_PORT}/v1/channels/lilachat/events` });
  await BotInstallationModel.create({ appId: app._id, workspaceId: space._id, botUserId: bot!._id, tokenHash: sha256(TOKEN), signingSecret: 'qa-secret', installedBy: jose!._id, grantedScopes: ['prospects:write', 'channels:history'] });
  const secret = randomBytes(24).toString('base64url');
  const deviceId = `vinculado-${randomBytes(8).toString('hex')}`;
  await DeviceModel.create({ deviceId, userId: jose!._id, platform: 'web', vinculadoPor: 'e2e', secretoHash: sha256(secret), nombre: 'E2E Dali', sesionTemporal: false, lastSeenAt: new Date() });
  return { jose: jose!, rosa: rosa!, marco: marco!, space, deviceId, secret };
}

type Seeded = Awaited<ReturnType<typeof seedSpace>>;

/** Each prospect and its messages enter as agentes sends them: through the bots API with Dali's token. */
async function putProspects() {
  let key = 0;
  for (const seed of seeds()) {
    await call(`/bots/prospects/${encodeURIComponent(seed.id)}`, { method: 'PUT', body: seed.body, auth: TOKEN });
    for (const said of seed.said ?? []) await call('/bots/messages', { body: { prospect: seed.id, as_contact: true, sent_at: said.at, text: said.text, idempotency_key: `qa-${(key += 1)}` }, auth: TOKEN });
    for (const text of seed.dali ?? []) await call('/bots/messages', { body: { prospect: seed.id, text, idempotency_key: `qa-${(key += 1)}` }, auth: TOKEN });
  }
}

/** The sellers' own decisions (taken, scheduled, won or lost) go through the space's real routes. */
async function sellerDecisions(ids: Seeded) {
  // Imported here: the session module reads JWT_SECRET, which `main` sets first.
  const { signSession } = await import('../server/src/sessions.js');
  const as = (user: { _id: unknown }) => signSession({ userId: String(user._id), deviceId: `d-${String(user._id)}`, email: 'qa@example.com' });
  const space = String(ids.space._id);
  const versionOf = async (id: string) => ((await ProspectChannelModel.findOne({ prospectId: id }).lean()) as { version: number }).version;
  const patch = async (id: string, who: { _id: unknown }, body: Record<string, unknown>) => call(`/workspaces/${space}/prospects/${encodeURIComponent(id)}`, { method: 'PATCH', body: { version: await versionOf(id), ...body }, auth: as(who) });
  await patch(P(2), ids.rosa, { assignee: 'me' });
  await patch(P(2), ids.rosa, { next_action: { kind: 'visit', at: new Date(Date.now() + 2 * DAY).toISOString(), remind: true } });
  await patch(P(3), ids.marco, { assignee: 'me' });
  await patch(P(4), ids.jose, { assignee: 'me' });
  await patch(P(8), ids.jose, { assignee: 'me' });
  await patch(P(8), ids.jose, { next_action: { kind: 'call', at: new Date(Date.now() + 3 * HOUR).toISOString(), remind: true, note: 'Consultar a José el 3 %' } });
  await patch(P(9), ids.rosa, { assignee: 'me' });
  await patch(P(9), ids.rosa, { result: { outcome: 'won' } });
  await patch(P(10), ids.rosa, { result: { outcome: 'lost', reason: 'no_answer' } });
  await patch(P(11), ids.marco, { result: { outcome: 'lost', reason: 'no_answer' } });
  await patch(P(12), ids.marco, { result: { outcome: 'lost', reason: 'price' } });
  // The closed ones happened last week (the review shows the last whole week, Monday to Sunday in Lima).
  for (const [id, days] of [[P(9), 7], [P(10), 7], [P(11), 6], [P(12), 6]] as const) {
    await ProspectChannelModel.updateOne({ prospectId: id }, { $set: { 'result.at': new Date(Date.now() - days * DAY), createdAt: new Date(Date.now() - (days + 2) * DAY) } });
  }
}

/** The KML lands in Paola Ríos's chat as a message of José; CHAT_PUBLIC_URL makes its link reach this stub from the emulator. */
async function fileInChat(ids: Seeded) {
  const { sendMessage } = await import('../server/src/chatService.js');
  const channel = (await ProspectChannelModel.findOne({ prospectId: P(8) }).lean()) as { chatId: unknown } | null;
  if (!channel) throw new Error('Paola Ríos has no channel');
  await sendMessage({ chatId: String(channel.chatId), senderId: ids.jose._id, clientKey: 'qa-kml', media: { mediaId: 'qa-kml', url: KML_PATH, mime: 'application/octet-stream', fileName: 'METRADOS 161126.kml' } });
}

/** Paola Ríos sends her metrado (José 17/11): agentes uploads it and posts it as hers, and Dali reads the area from it. */
async function clientDocument() {
  const form = new FormData();
  form.append('file', new Blob([KML], { type: 'application/octet-stream' }), 'Metrado Paola Ríos.kml');
  const response = await fetch(`${API}/bots/files`, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}` }, body: form });
  if (response.status !== 201) throw new Error(`POST /bots/files → ${response.status} ${await response.text()}`);
  const { file_id: fileId } = (await response.json()) as { file_id: string };
  await call('/bots/messages', { body: { prospect: P(8), as_contact: true, sent_at: ago(4 * HOUR), text: 'Les paso el metrado del estacionamiento', files: [{ file_id: fileId }], idempotency_key: 'qa-doc-1' }, auth: TOKEN });
  // José 17/11: a PDF shows its first page in the chat, like WhatsApp (the server draws it on upload).
  const pdf = new FormData();
  pdf.append('file', new Blob([syntheticReportPdf(4)], { type: 'application/pdf' }), 'Cotización estacionamiento.pdf');
  const pdfAnswer = await fetch(`${API}/bots/files`, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}` }, body: pdf });
  if (pdfAnswer.status !== 201) throw new Error(`POST /bots/files (pdf) → ${pdfAnswer.status} ${await pdfAnswer.text()}`);
  const { file_id: pdfId } = (await pdfAnswer.json()) as { file_id: string };
  await call('/bots/messages', { body: { prospect: P(8), as_contact: true, sent_at: ago(3 * HOUR), files: [{ file_id: pdfId }], idempotency_key: 'qa-doc-2' }, auth: TOKEN });
  const paola = seeds().find((seed) => seed.id === P(8))!;
  // Fase 3: the lot's outline read from the KML, drawn in the ficha; the seller confirms or corrects each one.
  const lot = [{ lat: -12.0496, lng: -77.0306 }, { lat: -12.0496, lng: -77.0294 }, { lat: -12.0505, lng: -77.0294 }, { lat: -12.0505, lng: -77.0306 }];
  const fields = [
    { key: 'cantidad', label: 'Cantidad', value: '1 240 m²', source: 'document', file_id: fileId },
    { key: 'area', label: 'Área del lote', value: '1 300 m² según el KML', source: 'document', file_id: fileId, geo: { polygon: lot, points: [{ lat: -12.05, lng: -77.03, label: 'Ingreso' }] } },
  ];
  await call(`/bots/prospects/${encodeURIComponent(P(8))}`, { method: 'PUT', body: { ...paola.body, last_activity_at: ago(4 * HOUR), fields }, auth: TOKEN });
}

async function main() {
  process.env.JWT_SECRET = JWT_SECRET;
  mkdirSync(MEDIA_ROOT, { recursive: true });
  writeFileSync(path.join(MEDIA_ROOT, '.lilachat-medios'), 'qa');
  const mongo = await startTestMongo();
  const uri = mongo.getUri('lilachat_e2e_dali');
  startHook();
  const server = spawn('npx', ['tsx', 'src/index.ts'], { cwd: SERVER_DIR, env: { ...process.env, MONGO_URL: uri, JWT_SECRET, PORT: '4003', NODE_ENV: 'development', CONSTROAD_AUTH_URL: `http://127.0.0.1:${HOOK_PORT}/auth`, CONSTROAD_AUTH_KEY: 'qa-local', CHAT_PUBLIC_URL: `http://10.0.2.2:${HOOK_PORT}`, CHAT_STORAGE_ROOT: MEDIA_ROOT }, stdio: ['ignore', 'inherit', 'inherit'] });
  const stop = async () => {
    server.kill('SIGTERM');
    await mongoose.disconnect().catch(() => undefined);
    await mongo.stop();
    process.exit(0);
  };
  process.on('SIGTERM', () => void stop());
  process.on('SIGINT', () => void stop());
  await mongoose.connect(uri);
  await waitForServer();
  const ids = await seedSpace();
  await putProspects();
  await sellerDecisions(ids);
  await fileInChat(ids);
  await clientDocument();
  session = JSON.stringify({ perfil: { userId: String(ids.jose._id), phone: `51${QA_PHONE}`, name: 'José QA', deviceId: ids.deviceId }, credential: { deviceId: ids.deviceId, deviceSecret: ids.secret }, spaceId: String(ids.space._id) });
  writeFileSync(path.join(OUT_DIR, 'session.json'), session);
  console.log(`[e2e-dali] listo: datos sembrados; sesión y eventos en ${OUT_DIR}`);
}

void main().catch((error: unknown) => {
  console.error('[e2e-dali] falló:', error);
  process.exit(1);
});
