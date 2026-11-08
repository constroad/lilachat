import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE = join(__dirname, '..');
const BARE_LAZY = /\blazy\(\s*\(\)\s*=>\s*import\(/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('on-demand pieces', () => {
  it('load through lazyChunk, so a tab opened before a deploy reloads instead of breaking (map 08/11)', () => {
    const bare = sourceFiles(SOURCE).filter((file) => !file.endsWith('lazyChunk.ts') && BARE_LAZY.test(readFileSync(file, 'utf8')));
    expect(bare.map((file) => file.slice(SOURCE.length + 1))).toEqual([]);
  });
});
