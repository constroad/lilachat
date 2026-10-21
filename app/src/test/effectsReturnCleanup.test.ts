import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * An effect written as `useEffect(() => call())` returns what `call` returns,
 * and React keeps it as the cleanup. In recent Chrome `scrollIntoView` started
 * returning a Promise: closing a thread called it and the web went white
 * (web backlog 4, 20/10; the same rule here). TypeScript cannot see it (lib.dom still says `void`).
 * Rule: an effect with an expression body may only return a cleanup — a
 * variable, an arrow, or a `suscribir…`/`subscribe…` call.
 */
const SOURCE = join(__dirname, '..');
const RETURNS_CLEANUP = /^(suscribir|subscribe)/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

function expressionEffects(path: string): string[] {
  const file = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && /^(useEffect|useLayoutEffect)$/.test(node.expression.getText(file))) {
      const effect = node.arguments[0];
      if (effect && ts.isArrowFunction(effect) && !ts.isBlock(effect.body)) {
        const body = effect.body;
        const callee = ts.isCallExpression(body) ? body.expression.getText(file) : '';
        const allowed = ts.isIdentifier(body) || ts.isArrowFunction(body) || RETURNS_CLEANUP.test(callee);
        if (!allowed) found.push(`${path.replace(SOURCE, 'src')}:${file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1}`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

describe('effects return only cleanups', () => {
  it('no effect returns the value of an arbitrary call', () => {
    expect(sourceFiles(SOURCE).flatMap(expressionEffects)).toEqual([]);
  });
});
