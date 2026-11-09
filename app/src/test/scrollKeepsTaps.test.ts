import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * A list without `keyboardShouldPersistTaps` spends the first tap on letting go
 * of a focused field, even with the keyboard already hidden. José 09/11: «tengo
 * que darle dos veces clic a la lupa», and «Registrar avance» did nothing twice
 * after searching for the service (the search field kept its focus behind the
 * service screen; emulator, OTA 5656fea2). Rule for the client channel, the work
 * map and the reports: every scroll container lets its children take the tap.
 */
const SOURCE = join(__dirname, '..');
const CHANNEL = join(SOURCE, 'spaces', 'clients');
const SCROLLERS = /^(ScrollView|FlatList|SectionList|FlashList|Animated\.ScrollView|Animated\.FlatList)$/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx$/.test(entry.name) && !/\.test\.tsx$/.test(entry.name) ? [path] : [];
  });
}

function scrollersEatingTaps(path: string): string[] {
  const file = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    const opening = ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node) ? node : null;
    if (opening && SCROLLERS.test(opening.tagName.getText(file))) {
      const keepsTaps = opening.attributes.properties.some((prop) => ts.isJsxAttribute(prop) && prop.name.getText(file) === 'keyboardShouldPersistTaps');
      if (!keepsTaps) found.push(`${path.replace(SOURCE, 'src')}:${file.getLineAndCharacterOfPosition(opening.getStart(file)).line + 1}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

describe('lists of the client channel take the first tap', () => {
  it('every scroll container under spaces/clients declares keyboardShouldPersistTaps', () => {
    // Arrange
    const files = sourceFiles(CHANNEL);
    // Act
    const offenders = files.flatMap(scrollersEatingTaps);
    // Assert
    expect(files.length).toBeGreaterThan(20);
    expect(offenders).toEqual([]);
  });
});
