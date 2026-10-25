import { describe, expect, it } from 'vitest';
import { NO_UPDATE_DIRECTIVE, assertBundleBakedUrl, assertRuntimeMatches, buildEnvOf, buildManifest, contentTypeOfExtension, countDevHosts, rollbackDirective, type ExportMetadata } from './otaPublish';

/**
 * What José's machine builds before publishing an OTA update (agentes 25/10/2026). Pure: the script reads files and
 * signs; the decisions live here so they run in a unit test.
 */
const metadata: ExportMetadata = {
  fileMetadata: {
    android: {
      bundle: '_expo/static/js/android/index-abc123.hbc',
      assets: [
        { path: 'assets/1f2e3d4c5b6a79881f2e3d4c5b6a7988', ext: 'png' },
        { path: 'assets/aabbccddeeff00112233445566778899', ext: 'ttf' },
      ],
    },
  },
};
const digests = {
  '_expo/static/js/android/index-abc123.hbc': { sha256: 'Bundle-hash_base64url-without-padding-0000', md5: 'ffffffffffffffffffffffffffffffff' },
  'assets/1f2e3d4c5b6a79881f2e3d4c5b6a7988': { sha256: 'Image-hash_base64url-without-padding-00000', md5: '1f2e3d4c5b6a79881f2e3d4c5b6a7988' },
  'assets/aabbccddeeff00112233445566778899': { sha256: 'Font-hash_base64url-without-padding-000000', md5: 'aabbccddeeff00112233445566778899' },
};
const base = {
  id: '3f1c2a9e-7d4b-4e5a-9a10-2c5b8f6d1e00',
  createdAt: '2026-10-25T17:00:00.000Z',
  runtimeVersion: 'dbf94293e1b28291cbb36e804ab7edfabab05f00',
  metadata,
  digests,
  baseUrl: 'https://lilachat.constroad.com',
  expoClient: { name: 'Lilachat', slug: 'lilachat' },
  gitSha: '0123456789abcdef0123456789abcdef01234567',
};

describe('buildManifest', () => {
  it('describes the bundle as the launch asset, named by the hash of its bytes', () => {
    // Act
    const manifest = buildManifest(base);
    // Assert
    expect(manifest.launchAsset).toEqual({
      hash: 'Bundle-hash_base64url-without-padding-0000',
      key: 'ffffffffffffffffffffffffffffffff',
      contentType: 'application/javascript',
      fileExtension: '.bundle',
      url: 'https://lilachat.constroad.com/api/ota/assets/Bundle-hash_base64url-without-padding-0000',
    });
  });

  it('lists every other file as an asset with its own type and extension', () => {
    const manifest = buildManifest(base);
    expect(manifest.assets).toEqual([
      { hash: 'Image-hash_base64url-without-padding-00000', key: '1f2e3d4c5b6a79881f2e3d4c5b6a7988', contentType: 'image/png', fileExtension: '.png', url: 'https://lilachat.constroad.com/api/ota/assets/Image-hash_base64url-without-padding-00000' },
      { hash: 'Font-hash_base64url-without-padding-000000', key: 'aabbccddeeff00112233445566778899', contentType: 'font/ttf', fileExtension: '.ttf', url: 'https://lilachat.constroad.com/api/ota/assets/Font-hash_base64url-without-padding-000000' },
    ]);
  });

  it('carries the id, the creation time, the runtime and where it came from', () => {
    const manifest = buildManifest(base);
    expect(manifest).toMatchObject({ id: base.id, createdAt: base.createdAt, runtimeVersion: base.runtimeVersion, metadata: {}, extra: { expoClient: base.expoClient, gitSha: base.gitSha } });
  });

  it('a server URL with a trailing slash does not double it', () => {
    const manifest = buildManifest({ ...base, baseUrl: 'https://lilachat.constroad.com/' });
    expect(manifest.launchAsset.url).toBe('https://lilachat.constroad.com/api/ota/assets/Bundle-hash_base64url-without-padding-0000');
  });

  it('an asset with no digest is an error, never a manifest that points to nothing', () => {
    const { 'assets/aabbccddeeff00112233445566778899': _missing, ...rest } = digests;
    expect(() => buildManifest({ ...base, digests: rest })).toThrow(/assets\/aabbccddeeff00112233445566778899/);
  });

  it('an export without an android bundle is an error', () => {
    expect(() => buildManifest({ ...base, metadata: { fileMetadata: {} } as unknown as ExportMetadata })).toThrow(/android/i);
  });
});

describe('contentTypeOfExtension', () => {
  it.each([
    ['png', 'image/png'],
    ['jpg', 'image/jpeg'],
    ['jpeg', 'image/jpeg'],
    ['webp', 'image/webp'],
    ['gif', 'image/gif'],
    ['svg', 'image/svg+xml'],
    ['ttf', 'font/ttf'],
    ['otf', 'font/otf'],
    ['json', 'application/json'],
    ['mp3', 'audio/mpeg'],
    ['wav', 'audio/wav'],
    ['mp4', 'video/mp4'],
    ['PNG', 'image/png'],
    ['.png', 'image/png'],
  ])('%s is %s', (extension, expected) => {
    expect(contentTypeOfExtension(extension)).toBe(expected);
  });

  it('an extension nobody knows is plain bytes, not a guess', () => {
    expect(contentTypeOfExtension('xyz')).toBe('application/octet-stream');
  });
});

describe('assertRuntimeMatches (an OTA update never carries native changes)', () => {
  const snapshot = { versionCode: 172, runtimeVersion: 'dbf94293e1b28291cbb36e804ab7edfabab05f00' };

  it('passes when the code to publish has the runtime of the APK that is out there', () => {
    expect(() => assertRuntimeMatches('dbf94293e1b28291cbb36e804ab7edfabab05f00', snapshot)).not.toThrow();
  });

  it('stops with the reason in plain words when something native changed since that APK', () => {
    expect(() => assertRuntimeMatches('e2af444e1bb1c7a30f71749d7c47598e7dc25f33', snapshot)).toThrow('Cambió algo nativo desde el APK 172: esto va en un APK, no por OTA');
  });
});

describe('rollbackDirective', () => {
  it('is the signed-as-is JSON that sends every phone of the runtime back to the code inside its APK', () => {
    expect(rollbackDirective(new Date('2026-10-25T18:30:00.000Z'))).toBe('{"type":"rollBackToEmbedded","parameters":{"commitTime":"2026-10-25T18:30:00.000Z"}}');
  });
});

describe('NO_UPDATE_DIRECTIVE', () => {
  it('is the literal the server verifies; changing it silently would make every «nothing newer» fail its signature', () => {
    expect(NO_UPDATE_DIRECTIVE).toBe('{"type":"noUpdateAvailable"}');
  });
});

/**
 * 25/10/2026: the first two OTA updates baked `EXPO_PUBLIC_API_URL=http://10.0.2.2:4003` (app/.env, the emulator's
 * address for the dev machine) because `expo export` read the local env instead of `app/lila.json` → `build.env`
 * like `apk build` does. Phones that applied it showed «Sin conexión». These tests are that incident.
 */
describe('buildEnvOf (the environment an OTA export must use: the APK build\'s, not the developer\'s)', () => {
  const lila = { build: { env: { EXPO_PUBLIC_API_URL: 'https://lilachat.constroad.com', EXPO_PUBLIC_FLAG: 'on' } } };

  it('returns every build.env entry', () => {
    expect(buildEnvOf(lila)).toEqual({ EXPO_PUBLIC_API_URL: 'https://lilachat.constroad.com', EXPO_PUBLIC_FLAG: 'on' });
  });

  it('refuses a config without the API url: an export without it would fall back to whatever the local .env says', () => {
    expect(() => buildEnvOf({ build: { env: {} } })).toThrow('EXPO_PUBLIC_API_URL');
    expect(() => buildEnvOf({})).toThrow('EXPO_PUBLIC_API_URL');
    expect(() => buildEnvOf(null)).toThrow('EXPO_PUBLIC_API_URL');
  });

  it.each([['http://10.0.2.2:4003'], ['http://lilachat.constroad.com'], ['lilachat.constroad.com'], [''], [42]])('refuses an API url that is not https (%j)', (url) => {
    expect(() => buildEnvOf({ build: { env: { EXPO_PUBLIC_API_URL: url } } })).toThrow('https');
  });

  it('ignores entries that are not text', () => {
    expect(buildEnvOf({ build: { env: { EXPO_PUBLIC_API_URL: 'https://lilachat.constroad.com', OTHER: 7 } } })).toEqual({ EXPO_PUBLIC_API_URL: 'https://lilachat.constroad.com' });
  });
});

describe('countDevHosts', () => {
  it('counts each development host that is baked into a bundle', () => {
    const bundle = 'aaa http://localhost:8081/api/vinculos/aprobar bbb localhost:8081 ccc http://10.0.2.2:4003 ddd 127.0.0.1';
    expect(countDevHosts(bundle)).toEqual({ '10.0.2.2': 1, '127.0.0.1': 1, localhost: 2 });
  });

  it('counts zero for a clean bundle', () => {
    expect(countDevHosts('https://lilachat.constroad.com')).toEqual({ '10.0.2.2': 0, '127.0.0.1': 0, localhost: 0 });
  });
});

describe('assertBundleBakedUrl (what the OTA bundle must carry before it is published)', () => {
  const apiUrl = 'https://lilachat.constroad.com';
  const baseline = { '10.0.2.2': 0, '127.0.0.1': 0, localhost: 2 };
  const clean = `xx ${apiUrl} yy http://localhost:8081/api/vinculos/aprobar zz localhost:8081`;

  it('accepts a bundle that has the production url and no more dev hosts than the APK that is out there', () => {
    expect(() => assertBundleBakedUrl(clean, { apiUrl, baseline })).not.toThrow();
  });

  it('stops when a development url slipped in (the 25/10 incident)', () => {
    expect(() => assertBundleBakedUrl(`${clean} http://10.0.2.2:4003`, { apiUrl, baseline })).toThrow('10.0.2.2');
  });

  it('stops when another dev host appears more often than in the APK', () => {
    expect(() => assertBundleBakedUrl(`${clean} http://localhost:4003`, { apiUrl, baseline })).toThrow('localhost');
    expect(() => assertBundleBakedUrl(`${clean} http://127.0.0.1:3000`, { apiUrl, baseline })).toThrow('127.0.0.1');
  });

  it('stops when the production url is missing', () => {
    expect(() => assertBundleBakedUrl('http://localhost:8081/api/vinculos/aprobar localhost:8081', { apiUrl, baseline })).toThrow(apiUrl);
  });

  it('allows fewer dev hosts than the APK (a library that dropped a string is not a risk)', () => {
    expect(() => assertBundleBakedUrl(`xx ${apiUrl}`, { apiUrl, baseline })).not.toThrow();
  });
});
