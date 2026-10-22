import type { Express } from 'express';

/**
 * Android App Links (pending 47, José 22/10): a `lilachat.constroad.com/unirse/…`
 * link opens the app when it is installed, like WhatsApp's. Android verifies
 * it by reading this file: the package and the SHA-256 of the release key
 * (`lila keystore fingerprint lilachat`, checked against the published APK
 * with `apksigner` on 22/10). It is public on purpose. A new release key means
 * a new fingerprint here, or the links open the web again.
 */
const PACKAGE = 'com.lilachat.app';
const RELEASE_KEY_SHA256 = '82:C7:94:02:2A:D6:22:F6:FD:EE:04:F1:FA:B9:ED:49:8E:BB:5F:82:24:A1:74:DA:C4:29:36:62:D0:4A:24:C9';
const ONE_HOUR_S = 3600;

export const ASSET_LINKS = [
  { relation: ['delegate_permission/common.handle_all_urls'], target: { namespace: 'android_app', package_name: PACKAGE, sha256_cert_fingerprints: [RELEASE_KEY_SHA256] } },
];

export function mountAppLinks(app: Express): void {
  app.get('/.well-known/assetlinks.json', (_req, res) => {
    res.setHeader('Cache-Control', `public, max-age=${ONE_HOUR_S}`);
    res.json(ASSET_LINKS);
  });
}
