import { randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Readable } from 'node:stream';
import type { Disco } from '../disco.js';
import { ASSET_HASH, isUpdateId, summarizeManifest } from './otaProtocol.js';

/**
 * What the server keeps of the OTA updates (agentes 25/10/2026), under `ota/` of the media disk — never
 * inside a release (a deploy would wipe it). It stores and serves; it never signs.
 *
 *   ota/assets/<hash>                        the bytes, named by their SHA-256 (base64url)
 *   ota/assets/<hash>.json                   {contentType}
 *   ota/updates/<runtime>/<id>/manifest.json the EXACT signed string (or directive.json)
 *   ota/updates/<runtime>/<id>/manifest.sig  its signature
 *   ota/updates/<runtime>/latest.json        {kind, id}: what the phones of that runtime get
 *   ota/no-update.json / .sig                the signed «nothing newer»
 */
export type UpdateKind = 'manifest' | 'directive';
export type StoredUpdate = { kind: UpdateKind; id: string; payload: string; signature: string };
export type StoredAsset = { path: string; bytes: number; contentType: string };
export type PublishReport = { updatesRemoved: number; assetsRemoved: number };

export type OtaStoreOptions = { keep: number; orphanGraceMs: number };

const DEFAULT_CONTENT_TYPE = 'application/octet-stream';

export class OtaStore {
  constructor(
    private readonly disk: Disco,
    private readonly options: OtaStoreOptions
  ) {}

  private absolute(relative: string): string {
    return this.disk.absoluta(`ota/${relative}`);
  }

  async hasAsset(hash: string): Promise<boolean> {
    return stat(this.absolute(`assets/${hash}`)).then(() => true, () => false);
  }

  /** Streams to a temp in the same volume, hashing on the way; only bytes that match their name are kept. */
  async receiveAsset(hash: string, source: Readable, contentType: string, maxBytes: number): Promise<'stored' | 'mismatch'> {
    const { temporal, huella } = await this.disk.recibir(source, { maxBytes });
    if (Buffer.from(huella, 'hex').toString('base64url') !== hash) {
      await this.disk.descartar(temporal);
      return 'mismatch';
    }
    await mkdir(this.absolute('assets'), { recursive: true });
    await writeFile(this.absolute(`assets/${hash}.json`), JSON.stringify({ contentType }));
    await this.disk.mover(temporal, `ota/assets/${hash}`);
    return 'stored';
  }

  async openAsset(hash: string): Promise<StoredAsset | null> {
    const file = this.absolute(`assets/${hash}`);
    const info = await stat(file).catch(() => null);
    if (!info) return null;
    const meta = await readFile(this.absolute(`assets/${hash}.json`), 'utf8').then(
      (text) => JSON.parse(text) as { contentType?: string },
      () => ({}) as { contentType?: string }
    );
    return { path: file, bytes: info.size, contentType: meta.contentType ?? DEFAULT_CONTENT_TYPE };
  }

  async missingAssets(hashes: string[]): Promise<string[]> {
    const present = await Promise.all(hashes.map((hash) => this.hasAsset(hash)));
    return hashes.filter((_hash, index) => !present[index]);
  }

  async latest(runtime: string): Promise<StoredUpdate | null> {
    const pointer = await this.readJson<{ kind?: string; id?: string }>(this.absolute(`updates/${runtime}/latest.json`));
    if (!pointer || (pointer.kind !== 'manifest' && pointer.kind !== 'directive') || !isUpdateId(pointer.id)) return null;
    const dir = this.absolute(`updates/${runtime}/${pointer.id}`);
    const [payload, signature] = await Promise.all([this.readText(path.join(dir, `${pointer.kind}.json`)), this.readText(path.join(dir, `${pointer.kind}.sig`))]);
    return payload !== null && signature !== null ? { kind: pointer.kind, id: pointer.id, payload, signature } : null;
  }

  async noUpdate(): Promise<{ payload: string; signature: string } | null> {
    const [payload, signature] = await Promise.all([this.readText(this.absolute('no-update.json')), this.readText(this.absolute('no-update.sig'))]);
    return payload !== null && signature !== null ? { payload, signature } : null;
  }

  /**
   * Writes the update, then flips `latest.json` atomically (temp + rename): a phone asking in between sees
   * the previous complete update or the new complete one, never half of one.
   */
  async publish(runtime: string, update: StoredUpdate, noUpdate?: { payload: string; signature: string }): Promise<PublishReport> {
    const dir = this.absolute(`updates/${runtime}/${update.id}`);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, `${update.kind}.json`), update.payload);
    await writeFile(path.join(dir, `${update.kind}.sig`), update.signature);
    if (noUpdate) {
      await this.writeAtomic(this.absolute('no-update.json'), noUpdate.payload);
      await this.writeAtomic(this.absolute('no-update.sig'), noUpdate.signature);
    }
    await this.writeAtomic(this.absolute(`updates/${runtime}/latest.json`), JSON.stringify({ kind: update.kind, id: update.id }));
    const updatesRemoved = await this.pruneUpdates(runtime, update.id);
    return { updatesRemoved, assetsRemoved: await this.removeOrphanAssets() };
  }

  private async pruneUpdates(runtime: string, keepId: string): Promise<number> {
    const runtimeDir = this.absolute(`updates/${runtime}`);
    const entries = await readdir(runtimeDir, { withFileTypes: true });
    const dated = await Promise.all(
      entries.filter((entry) => entry.isDirectory()).map(async (entry) => ({ name: entry.name, at: (await stat(path.join(runtimeDir, entry.name))).mtimeMs }))
    );
    const newest = dated.sort((a, b) => b.at - a.at).slice(0, this.options.keep).map((entry) => entry.name);
    const doomed = dated.filter((entry) => entry.name !== keepId && !newest.includes(entry.name));
    await Promise.all(doomed.map((entry) => rm(path.join(runtimeDir, entry.name), { recursive: true, force: true })));
    return doomed.length;
  }

  /** An asset no stored manifest names and that is older than the grace period (a publication in flight has fresh ones). */
  private async removeOrphanAssets(): Promise<number> {
    const referenced = await this.referencedAssets();
    const assetsDir = this.absolute('assets');
    const names = (await readdir(assetsDir).catch(() => [] as string[])).filter((name) => ASSET_HASH.test(name));
    let removed = 0;
    for (const name of names) {
      if (referenced.has(name)) continue;
      const info = await stat(path.join(assetsDir, name)).catch(() => null);
      if (!info || Date.now() - info.mtimeMs < this.options.orphanGraceMs) continue;
      await rm(path.join(assetsDir, name), { force: true });
      await rm(path.join(assetsDir, `${name}.json`), { force: true });
      removed += 1;
    }
    return removed;
  }

  private async referencedAssets(): Promise<Set<string>> {
    const referenced = new Set<string>();
    const updatesDir = this.absolute('updates');
    for (const runtime of await readdir(updatesDir).catch(() => [] as string[])) {
      const runtimeDir = path.join(updatesDir, runtime);
      for (const entry of await readdir(runtimeDir, { withFileTypes: true }).catch(() => [])) {
        if (!entry.isDirectory()) continue;
        const text = await this.readText(path.join(runtimeDir, entry.name, 'manifest.json'));
        summarizeManifest(text ?? '')?.assetHashes.forEach((hash) => referenced.add(hash));
      }
    }
    return referenced;
  }

  private async writeAtomic(file: string, content: string): Promise<void> {
    const temporary = `${file}.tmp-${randomUUID()}`;
    await writeFile(temporary, content);
    await rename(temporary, file);
  }

  private async readText(file: string): Promise<string | null> {
    try {
      return await readFile(file, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  private async readJson<T>(file: string): Promise<T | null> {
    const text = await this.readText(file);
    return text === null ? null : (JSON.parse(text) as T);
  }
}
