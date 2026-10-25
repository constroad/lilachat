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

/** What `app/ota-runtime.json` remembers of the APK that is out there: its build and the runtime it was built with. */
export type RuntimeSnapshot = { versionCode: number; runtimeVersion: string };

export function assertRuntimeMatches(currentRuntime: string, snapshot: RuntimeSnapshot): void {
  if (currentRuntime !== snapshot.runtimeVersion) {
    throw new Error(`Cambió algo nativo desde el APK ${snapshot.versionCode}: esto va en un APK, no por OTA`);
  }
}

/** Sends every phone of the runtime back to the JavaScript inside its APK. The signature covers these exact bytes. */
export function rollbackDirective(now: Date): string {
  return JSON.stringify({ type: 'rollBackToEmbedded', parameters: { commitTime: now.toISOString() } });
}
