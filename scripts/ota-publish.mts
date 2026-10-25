/**
 * Publishes an OTA update of the app's JavaScript (agentes 25/10/2026). Runs on José's machine: it is the only
 * place that holds the private signing key; the server only stores and serves what this signs.
 *
 *   npx tsx scripts/ota-publish.mts                 # export, sign and publish what is on main
 *   npx tsx scripts/ota-publish.mts --embedded      # roll every phone back to the code inside its APK
 *   npx tsx scripts/ota-publish.mts --dry-run       # everything but the upload
 *   npx tsx scripts/ota-publish.mts --record-apk=app/dist/<apk>   # after each `apk build`: runtime + baseline of that APK
 *
 * The export runs with the APK build's environment (`app/lila.json` → `build.env`), never the developer's `.env`:
 * on 25/10/2026 the local one baked `http://10.0.2.2:4003` into two updates. The bundle is then checked, before the
 * upload and again as the server serves it, for the production url and for no extra development hosts. The
 * `urls-locales.sh` gate of constroad-gates (>= 1.9.0) then scans the same bundle for any local or test address.
 *
 * Needs `OTA_PUBLISH_TOKEN` (env or `app/.env`) and the private key (`OTA_PRIVATE_KEY_PATH`, default
 * `~/.config/lilachat-ota/private-key.pem`). Neither is ever printed. Spec: `specs/DEPLOY.spec.md` §OTA.
 */
import { createHash, createSign, randomUUID } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NO_UPDATE_DIRECTIVE, assertBundleBakedUrl, assertRuntimeMatches, buildEnvOf, buildManifest, countDevHosts, rollbackDirective, type ExportMetadata, type FileDigest, type RuntimeSnapshot } from '../shared/src/otaPublish.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP = path.join(ROOT, 'app');
const EXPORT_DIR = 'dist-ota';
const DEFAULT_SERVER = 'https://lilachat.constroad.com';
const UPLOAD_PARALLELISM = 4;

const args = new Set(process.argv.slice(2));
const serverFlag = process.argv.find((arg) => arg.startsWith('--server='))?.slice('--server='.length);
const server = (serverFlag ?? DEFAULT_SERVER).replace(/\/+$/, '');
const embedded = args.has('--embedded');
const dryRun = args.has('--dry-run');
const skipGitChecks = args.has('--no-git-checks');
const recordApk = process.argv.find((arg) => arg.startsWith('--record-apk='))?.slice('--record-apk='.length);
const MAX_BUNDLE_BYTES = 128 * 1024 * 1024;
const ROLLBACK_NOW = 'Corre `npx tsx scripts/ota-publish.mts --embedded` YA.';

function fail(message: string): never {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

function run(command: string, commandArgs: string[], cwd: string, env?: NodeJS.ProcessEnv): string {
  return execFileSync(command, commandArgs, { cwd, env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'] }).trim();
}

const GATES_PLUGIN_DIR = path.join(homedir(), '.claude/plugins/cache/constroad-skills/constroad-gates');
const GATES_CHECKOUT_SCRIPT = path.join(homedir(), 'projects/constroad-skills/plugins/constroad-gates/scripts/urls-locales.sh');

/** `1.10.0` > `1.9.0`: compared by number, not as text. */
const byVersionDescending = (a: string, b: string): number => b.localeCompare(a, undefined, { numeric: true });

/** The gate script: `URLS_LOCALES_GATE`, the newest installed plugin that has it, or the skills repo checkout. */
function findUrlsGate(): string {
  const installed = existsSync(GATES_PLUGIN_DIR) ? readdirSync(GATES_PLUGIN_DIR).sort(byVersionDescending).map((version) => path.join(GATES_PLUGIN_DIR, version, 'scripts/urls-locales.sh')) : [];
  const found = [process.env.URLS_LOCALES_GATE, ...installed, GATES_CHECKOUT_SCRIPT].find((candidate) => candidate && existsSync(candidate));
  // A gate that is silently skipped is not a gate: without the script nothing is published.
  return found ?? fail('No encuentro urls-locales.sh (constroad-gates >= 1.9.0): corre /plugin marketplace update constroad-skills');
}

/** Scans what is about to reach production for local or test addresses; the allowlist is `.gates/urls-permitidas`. */
function assertNoLocalUrls(file: string, label: string, whatToDo = 'No se publicó nada.'): void {
  const result = spawnSync('bash', [findUrlsGate(), file], { cwd: ROOT, encoding: 'utf8' });
  if (result.status !== 0) fail(`${label} trae direcciones locales o de prueba:\n${result.stdout}${result.stderr}\n${whatToDo}`);
  console.log(`✓ ${label}: sin direcciones locales ni de prueba`);
}

/** The same scan for bytes that only exist in memory (the APK's bundle, the one the server serves). */
function assertNoLocalUrlsIn(content: Buffer | string, label: string, whatToDo?: string): void {
  const folder = mkdtempSync(path.join(tmpdir(), 'lilachat-urls-'));
  try {
    const file = path.join(folder, 'bundle');
    writeFileSync(file, content, typeof content === 'string' ? 'latin1' : undefined);
    assertNoLocalUrls(file, label, whatToDo);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

/** The variables the APK build bakes in (`app/lila.json`); the export must see exactly these. */
function readBuildEnv(): Record<string, string> {
  const file = path.join(APP, 'lila.json');
  if (!existsSync(file)) return fail('Falta app/lila.json: de ahí sale la URL del server que se hornea en el bundle');
  try {
    return buildEnvOf(JSON.parse(readFileSync(file, 'utf8')));
  } catch (error) {
    return fail((error as Error).message);
  }
}

/** The shell's environment without any `EXPO_PUBLIC_*` of its own, plus the APK build's. Expo does not override what is already set. */
function exportEnv(): NodeJS.ProcessEnv {
  const inherited = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('EXPO_PUBLIC_')));
  return { ...inherited, ...readBuildEnv() };
}

function readToken(): string {
  if (process.env.OTA_PUBLISH_TOKEN) return process.env.OTA_PUBLISH_TOKEN;
  const envFile = path.join(APP, '.env');
  const line = existsSync(envFile) ? readFileSync(envFile, 'utf8').split('\n').find((candidate) => candidate.startsWith('OTA_PUBLISH_TOKEN=')) : undefined;
  const token = line?.slice('OTA_PUBLISH_TOKEN='.length).trim().replace(/^["']|["']$/g, '');
  return token || fail('Falta OTA_PUBLISH_TOKEN (variable de entorno o app/.env)');
}

function readPrivateKey(): string {
  const keyPath = process.env.OTA_PRIVATE_KEY_PATH ?? path.join(homedir(), '.config', 'lilachat-ota', 'private-key.pem');
  return existsSync(keyPath) ? readFileSync(keyPath, 'utf8') : fail(`No encuentro la llave privada en ${keyPath}`);
}

const sign = (payload: string, privateKey: string) => createSign('RSA-SHA256').update(payload, 'utf8').sign(privateKey, 'base64');

function checkGit(): string {
  const sha = run('git', ['rev-parse', 'HEAD'], ROOT);
  if (skipGitChecks && dryRun) return sha;
  if (skipGitChecks) fail('--no-git-checks solo se combina con --dry-run: una publicación real sale de main, limpio y empujado');
  // Only what feeds the bundle has to be clean (a stray note in another folder does not change the code).
  const dirty = run('git', ['status', '--porcelain', '--', 'app', 'shared', 'package.json', 'package-lock.json'], ROOT);
  if (dirty) fail(`Hay cambios sin commitear que entran al bundle:\n${dirty}`);
  const branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD'], ROOT);
  if (branch !== 'main') fail(`Hay que publicar desde main (estás en ${branch})`);
  run('git', ['fetch', 'origin', 'main', '--quiet'], ROOT);
  if (sha !== run('git', ['rev-parse', 'origin/main'], ROOT)) fail('HEAD no es origin/main: empuja (o trae) antes de publicar, para que el código publicado sea el que está en el repo');
  return sha;
}

function readSnapshot(): RuntimeSnapshot {
  const file = path.join(APP, 'ota-runtime.json');
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as RuntimeSnapshot) : fail('Falta app/ota-runtime.json: se escribe después de cada `apk build` con --record-apk (specs/DEPLOY.spec.md)');
}

const resolveRuntime = (): string => (JSON.parse(run('npx', ['expo-updates', 'runtimeversion:resolve', '--platform', 'android'], APP)) as { runtimeVersion: string }).runtimeVersion;

/**
 * After each `apk build`: writes `app/ota-runtime.json` with the build, the runtime and the development hosts the
 * APK's own bundle carries. That bundle is the baseline an OTA bundle is held to.
 */
function recordApkSnapshot(apkPath: string): void {
  const apk = path.resolve(ROOT, apkPath);
  if (!existsSync(apk)) fail(`No encuentro el APK en ${apk}`);
  const bundle = execFileSync('unzip', ['-p', apk, 'assets/index.android.bundle'], { encoding: 'latin1', maxBuffer: MAX_BUNDLE_BYTES });
  const apiUrl = readBuildEnv().EXPO_PUBLIC_API_URL!;
  const devHosts = countDevHosts(bundle);
  if (!bundle.includes(apiUrl)) fail(`El APK no trae ${apiUrl} en su bundle: no lo publiques`);
  if (devHosts['10.0.2.2']) fail('El bundle del APK trae 10.0.2.2: tiene URL de desarrollo horneada, no lo publiques');
  assertNoLocalUrlsIn(bundle, 'El bundle del APK');
  const versionCode = (JSON.parse(readFileSync(path.join(APP, 'app.json'), 'utf8')) as { expo: { android: { versionCode: number } } }).expo.android.versionCode;
  const snapshot: RuntimeSnapshot = { versionCode, runtimeVersion: resolveRuntime(), devHosts };
  writeFileSync(path.join(APP, 'ota-runtime.json'), `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(`✓ Anotado el APK ${versionCode}: runtime ${snapshot.runtimeVersion.slice(0, 8)}, hosts de desarrollo ${JSON.stringify(devHosts)}`);
}

async function api(token: string, method: string, route: string, init: { body?: BodyInit; headers?: Record<string, string> } = {}) {
  return fetch(`${server}${route}`, { method, headers: { Authorization: `Bearer ${token}`, ...init.headers }, body: init.body });
}

async function readMessage(response: Response): Promise<string> {
  const text = await response.text();
  try {
    return (JSON.parse(text) as { message?: string }).message ?? text.slice(0, 200);
  } catch {
    return text.slice(0, 200);
  }
}

async function postUpdate(token: string, body: Record<string, string>): Promise<{ id: string }> {
  const response = await api(token, 'POST', '/api/ota/updates', { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
  if (response.status !== 201) fail(`El server rechazó la publicación (${response.status}): ${await readMessage(response)}`);
  return (await response.json()) as { id: string };
}

async function uploadAssets(token: string, files: { path: string; digest: FileDigest; contentType: string }[]): Promise<number> {
  let uploaded = 0;
  const queue = [...files];
  async function worker(): Promise<void> {
    for (let file = queue.shift(); file; file = queue.shift()) {
      const head = await api(token, 'HEAD', `/api/ota/assets/${file.digest.sha256}`);
      if (head.status === 200) continue;
      if (head.status !== 404) fail(`HEAD ${file.path} respondió ${head.status}`);
      const response = await api(token, 'PUT', `/api/ota/assets/${file.digest.sha256}`, {
        body: readFileSync(path.join(APP, EXPORT_DIR, file.path)),
        headers: { 'Content-Type': 'application/octet-stream', 'x-ota-content-type': file.contentType },
      });
      if (response.status !== 200 && response.status !== 201) fail(`PUT ${file.path} respondió ${response.status}: ${await readMessage(response)}`);
      uploaded += 1;
    }
  }
  await Promise.all(Array.from({ length: UPLOAD_PARALLELISM }, worker));
  return uploaded;
}

async function publishEmbeddedRollback(token: string, privateKey: string): Promise<void> {
  const snapshot = readSnapshot();
  const directive = rollbackDirective(new Date());
  console.log(`Rollback al código del APK ${snapshot.versionCode} (runtime ${snapshot.runtimeVersion.slice(0, 8)})`);
  if (dryRun) return console.log('--dry-run: no se sube nada');
  const { id } = await postUpdate(token, { runtimeVersion: snapshot.runtimeVersion, directive, signature: sign(directive, privateKey), noUpdateSignature: sign(NO_UPDATE_DIRECTIVE, privateKey) });
  console.log(`✓ Publicado el rollback (${id.slice(0, 8)}): los teléfonos vuelven al código de su APK en su próxima revisión`);
}

async function publishUpdate(token: string, privateKey: string, gitSha: string): Promise<void> {
  const runtimeVersion = resolveRuntime();
  const snapshot = readSnapshot();
  try {
    assertRuntimeMatches(runtimeVersion, snapshot);
  } catch (error) {
    fail((error as Error).message);
  }
  if (!snapshot.devHosts) fail('Falta devHosts en app/ota-runtime.json (la línea base del bundle del APK): corre --record-apk=app/dist/<apk>');
  const env = exportEnv();
  const apiUrl = env.EXPO_PUBLIC_API_URL!;
  rmSync(path.join(APP, EXPORT_DIR), { recursive: true, force: true });
  console.log('Exportando el bundle de android…');
  // `--clear`: Metro's transform cache does not key on `EXPO_PUBLIC_*`, so a module cached while `app/.env` was in play kept
  // `http://10.0.2.2:4003` even with the right environment (25/10/2026, third attempt).
  run('npx', ['expo', 'export', '--platform', 'android', '--output-dir', EXPORT_DIR, '--clear'], APP, env);
  const metadataFile = path.join(APP, EXPORT_DIR, 'metadata.json');
  if (!existsSync(metadataFile)) fail(`expo export no dejó ${EXPORT_DIR}/metadata.json`);
  const metadata = JSON.parse(readFileSync(metadataFile, 'utf8')) as ExportMetadata;
  const android = metadata.fileMetadata.android;
  try {
    assertBundleBakedUrl(readFileSync(path.join(APP, EXPORT_DIR, android.bundle), 'latin1'), { apiUrl, baseline: snapshot.devHosts });
  } catch (error) {
    fail(`${(error as Error).message}. No se publicó nada.`);
  }
  assertNoLocalUrls(path.join(APP, EXPORT_DIR, android.bundle), 'El bundle exportado');
  const paths = [android.bundle, ...android.assets.map((asset) => asset.path)];
  const digests: Record<string, FileDigest> = {};
  for (const file of paths) {
    const bytes = readFileSync(path.join(APP, EXPORT_DIR, file));
    digests[file] = { sha256: createHash('sha256').update(bytes).digest('base64url'), md5: createHash('md5').update(bytes).digest('hex') };
  }
  const expoClient = JSON.parse(run('npx', ['expo', 'config', '--type', 'public', '--json'], APP, env)) as unknown;
  const manifest = buildManifest({ id: randomUUID(), createdAt: new Date().toISOString(), runtimeVersion, metadata, digests, baseUrl: server, expoClient, gitSha });
  const manifestText = JSON.stringify(manifest);
  const bundleBytes = readFileSync(path.join(APP, EXPORT_DIR, android.bundle)).length;
  const summary = `${manifest.id}  runtime ${runtimeVersion.slice(0, 8)}  git ${gitSha.slice(0, 7)}  bundle ${(bundleBytes / 1_048_576).toFixed(1)} MB  ${android.assets.length} assets`;
  if (dryRun) return console.log(`--dry-run: no se sube nada\n${summary}`);
  const typed = [manifest.launchAsset, ...manifest.assets].map((asset, index) => ({ path: paths[index]!, digest: digests[paths[index]!]!, contentType: asset.contentType }));
  console.log(`Subiendo ${typed.length} archivos a ${server}…`);
  const uploaded = await uploadAssets(token, typed);
  await postUpdate(token, { runtimeVersion, manifest: manifestText, signature: sign(manifestText, privateKey), noUpdateSignature: sign(NO_UPDATE_DIRECTIVE, privateKey) });
  const check = await fetch(`${server}/api/ota/manifest`, { headers: { 'expo-protocol-version': '1', 'expo-platform': 'android', 'expo-runtime-version': runtimeVersion } });
  const served = await check.text();
  if (check.status !== 200 || !served.includes(manifest.id)) fail(`Publicado, pero el server no sirve este manifest (${check.status}). Revisa antes de decir que está en vivo.`);
  // What phones will download, not what was exported: the bundle as the server serves it.
  const servedBundle = Buffer.from(await (await fetch(`${server}/api/ota/assets/${digests[android.bundle]!.sha256}`)).arrayBuffer());
  try {
    assertBundleBakedUrl(servedBundle.toString('latin1'), { apiUrl, baseline: snapshot.devHosts });
  } catch (error) {
    fail(`El bundle que sirve el server NO pasa la guardia: ${(error as Error).message}. ${ROLLBACK_NOW}`);
  }
  assertNoLocalUrlsIn(servedBundle, 'El bundle que sirve el server', ROLLBACK_NOW);
  console.log(`✓ Publicado y verificado en vivo (${uploaded} archivos nuevos)\n${summary}`);
}

if (recordApk) {
  recordApkSnapshot(recordApk);
  process.exit(0);
}
const gitSha = embedded ? run('git', ['rev-parse', 'HEAD'], ROOT) : checkGit();
const token = dryRun ? (process.env.OTA_PUBLISH_TOKEN ?? '') : readToken();
const privateKey = readPrivateKey();
await (embedded ? publishEmbeddedRollback(token, privateKey) : publishUpdate(token, privateKey, gitSha));
