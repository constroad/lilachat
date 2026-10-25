/**
 * The pure half of publishing an OTA update (agentes 25/10/2026): from the files `expo export` produced to the
 * manifest José's machine signs. `scripts/ota-publish.mts` does the reading, signing and uploading; the decisions
 * live here so they run in a unit test. Not exported from the index: only the publisher uses it.
 */
export type ExportMetadata = {
  fileMetadata: { android: { bundle: string; assets: { path: string; ext: string }[] } };
};

/** SHA-256 (base64url, no padding) names the file on the server; MD5 (hex) is the key the phone caches it under. */
export type FileDigest = { sha256: string; md5: string };

export type ManifestAsset = { hash: string; key: string; contentType: string; fileExtension: string; url: string };

export type OtaManifest = {
  id: string;
  createdAt: string;
  runtimeVersion: string;
  launchAsset: ManifestAsset;
  assets: ManifestAsset[];
  metadata: Record<string, never>;
  extra: { expoClient: unknown; gitSha: string };
};

export type ManifestInput = {
  id: string;
  createdAt: string;
  runtimeVersion: string;
  metadata: ExportMetadata;
  /** By path inside the export folder. */
  digests: Record<string, FileDigest>;
  baseUrl: string;
  expoClient: unknown;
  gitSha: string;
};

const CONTENT_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  ttf: 'font/ttf',
  otf: 'font/otf',
  json: 'application/json',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  mp4: 'video/mp4',
};
const BUNDLE_CONTENT_TYPE = 'application/javascript';

export function contentTypeOfExtension(extension: string): string {
  return CONTENT_TYPES[extension.replace(/^\./, '').toLowerCase()] ?? 'application/octet-stream';
}

function assetOf(filePath: string, digests: Record<string, FileDigest>, baseUrl: string, kind: { contentType: string; extension: string }): ManifestAsset {
  const digest = digests[filePath];
  if (!digest) throw new Error(`Falta el hash del archivo ${filePath}`);
  return {
    hash: digest.sha256,
    key: digest.md5,
    contentType: kind.contentType,
    fileExtension: `.${kind.extension}`,
    url: `${baseUrl.replace(/\/+$/, '')}/api/ota/assets/${digest.sha256}`,
  };
}

export function buildManifest(input: ManifestInput): OtaManifest {
  const android = input.metadata.fileMetadata?.android;
  if (!android?.bundle) throw new Error('El export no trae un bundle de android');
  return {
    id: input.id,
    createdAt: input.createdAt,
    runtimeVersion: input.runtimeVersion,
    launchAsset: assetOf(android.bundle, input.digests, input.baseUrl, { contentType: BUNDLE_CONTENT_TYPE, extension: 'bundle' }),
    assets: android.assets.map((asset) => assetOf(asset.path, input.digests, input.baseUrl, { contentType: contentTypeOfExtension(asset.ext), extension: asset.ext.replace(/^\./, '') })),
    metadata: {},
    extra: { expoClient: input.expoClient, gitSha: input.gitSha },
  };
}

/** The exact bytes the publisher signs for «nothing newer». The server verifies the same string (`server/src/ota/otaProtocol.ts`). */
export const NO_UPDATE_DIRECTIVE = '{"type":"noUpdateAvailable"}';

/** Development addresses that must not be baked into a bundle that reaches phones. */
export const DEV_HOSTS = ['10.0.2.2', '127.0.0.1', 'localhost'] as const;
export type DevHostCounts = Record<string, number>;

/**
 * What `app/ota-runtime.json` remembers of the APK that is out there: its build, the runtime it was built with and
 * how many development hosts its own bundle carries (the baseline an OTA bundle must not exceed).
 */
export type RuntimeSnapshot = { versionCode: number; runtimeVersion: string; devHosts?: DevHostCounts };

export function assertRuntimeMatches(currentRuntime: string, snapshot: RuntimeSnapshot): void {
  if (currentRuntime !== snapshot.runtimeVersion) {
    throw new Error(`Cambió algo nativo desde el APK ${snapshot.versionCode}: esto va en un APK, no por OTA`);
  }
}

/** Sends every phone of the runtime back to the JavaScript inside its APK. The signature covers these exact bytes. */
export function rollbackDirective(now: Date): string {
  return JSON.stringify({ type: 'rollBackToEmbedded', parameters: { commitTime: now.toISOString() } });
}

const PRODUCTION_URL = /^https:\/\/[^\s/]+/;

/**
 * The environment an OTA export runs with: the APK build's (`app/lila.json` → `build.env`), never the developer's
 * `.env` (25/10/2026: that one baked `http://10.0.2.2:4003` into two updates). Refuses a config that would let the
 * export fall back to local files: without an https `EXPO_PUBLIC_API_URL` there is nothing safe to publish.
 */
export function buildEnvOf(lilaConfig: unknown): Record<string, string> {
  const env = (lilaConfig as { build?: { env?: Record<string, unknown> } } | null)?.build?.env ?? {};
  const apiUrl = env.EXPO_PUBLIC_API_URL;
  if (typeof apiUrl !== 'string' || !PRODUCTION_URL.test(apiUrl)) {
    throw new Error('app/lila.json necesita build.env.EXPO_PUBLIC_API_URL con una URL https: sin ella la OTA heredaría el .env local');
  }
  return Object.fromEntries(Object.entries(env).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
}

/** How many times each development host appears in a bundle (the strings of a Hermes bundle are plain ASCII). */
export function countDevHosts(bundle: string): DevHostCounts {
  return Object.fromEntries(DEV_HOSTS.map((host) => [host, bundle.split(host).length - 1]));
}

/**
 * Stops an OTA bundle that does not point at production: it must carry the production url and no more development
 * hosts than the bundle of the APK that is out there (which has a few of its own, e.g. the link-approval endpoint).
 */
export function assertBundleBakedUrl(bundle: string, input: { apiUrl: string; baseline: DevHostCounts }): void {
  if (!bundle.includes(input.apiUrl)) throw new Error(`El bundle no trae ${input.apiUrl}: los teléfonos no sabrían a qué server hablar`);
  const found = countDevHosts(bundle);
  for (const host of DEV_HOSTS) {
    const allowed = input.baseline[host] ?? 0;
    if (found[host]! > allowed) {
      throw new Error(`El bundle trae ${found[host]} veces ${host} y el APK solo ${allowed}: se coló una URL de desarrollo (revisa los .env)`);
    }
  }
}
