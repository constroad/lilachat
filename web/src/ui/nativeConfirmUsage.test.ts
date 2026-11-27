import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE = join(__dirname, '..');
/** A call to the browser's confirm, in code (not a mention inside a comment). */
const NATIVE_CONFIRM = /^(?!\s*(\*|\/\/)).*\bwindow\.confirm\(/m;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('questions before something that cannot be undone', () => {
  it('use the app own dialog (useConfirm), never window.confirm: it froze the tab (José 27/11)', () => {
    const native = sourceFiles(SOURCE).filter((file) => NATIVE_CONFIRM.test(readFileSync(file, 'utf8')));
    expect(native.map((file) => file.slice(SOURCE.length + 1))).toEqual([]);
  });
});
