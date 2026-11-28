import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * React Native gives every ScrollView `flexGrow: 1`. A horizontal chip row in a column next to a
 * `flex-1` sibling takes half the free height, and the sibling (a map) can end with none: José 28/11,
 * «Registrar avance de Imprimacion» showed an empty dark area (emulator dump: the chip row
 * [0,288][1080,1397], the record map absent). Rule for the client channel: such a row, and one a
 * component returns (its parent is out of sight), says
 * `flexGrow: 0` (style) or `flex-grow-0` / `grow-0` (class), or `flex-1` when filling is meant.
 */
const SOURCE = join(__dirname, '..');
const CHANNEL = join(SOURCE, 'spaces', 'clients');
/** Sized on purpose: no growth, or `flex-1` where filling is the point (a header's strip). */
const NO_GROW = /flexGrow:\s*0\b|\b(flex-)?grow-0\b|\bflex-1\b/;
const FILLS = /\bflex-1\b/;
const ROW = /\bflex-row\b/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx$/.test(entry.name) && !/\.test\.tsx$/.test(entry.name) ? [path] : [];
  });
}

const attributeText = (opening: ts.JsxOpeningLikeElement, name: string, file: ts.SourceFile): string => {
  const found = opening.attributes.properties.find((prop) => ts.isJsxAttribute(prop) && prop.name.getText(file) === name);
  return found && ts.isJsxAttribute(found) && found.initializer ? found.initializer.getText(file) : '';
};

const openingOf = (node: ts.Node): ts.JsxOpeningLikeElement | null =>
  ts.isJsxElement(node) ? node.openingElement : ts.isJsxSelfClosingElement(node) ? node : null;

const growingHorizontalScroll = (opening: ts.JsxOpeningLikeElement, file: ts.SourceFile): boolean =>
  opening.tagName.getText(file) === 'ScrollView'
  && opening.attributes.properties.some((prop) => ts.isJsxAttribute(prop) && prop.name.getText(file) === 'horizontal')
  && !NO_GROW.test(`${attributeText(opening, 'style', file)} ${attributeText(opening, 'className', file)}`);

/** A component's root: whoever places it (a column with a map) cannot be seen from here. */
const isReturned = (node: ts.Node): boolean => {
  const parent = ts.isParenthesizedExpression(node.parent) ? node.parent.parent : node.parent;
  return ts.isReturnStatement(parent) || ts.isArrowFunction(parent);
};

function rowsEatingTheFill(path: string): string[] {
  const file = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: string[] = [];
  const where = (opening: ts.JsxOpeningLikeElement) => `${path.replace(SOURCE, 'src')}:${file.getLineAndCharacterOfPosition(opening.getStart(file)).line + 1}`;
  const visit = (node: ts.Node) => {
    const own = openingOf(node);
    if (own && isReturned(node) && growingHorizontalScroll(own, file)) found.push(where(own));
    if (ts.isJsxElement(node) && !ROW.test(attributeText(node.openingElement, 'className', file))) {
      const children = node.children.map(openingOf).filter((opening): opening is ts.JsxOpeningLikeElement => opening !== null);
      const fills = children.some((opening) => FILLS.test(attributeText(opening, 'className', file)));
      children.filter((opening) => fills && growingHorizontalScroll(opening, file))
        .forEach((opening) => found.push(where(opening)));
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

describe('a chip row never takes the height of the map beside it', () => {
  it('every horizontal ScrollView beside a flex-1 sibling, or returned as a component root, declares flexGrow 0', () => {
    // Arrange
    const files = sourceFiles(CHANNEL);
    // Act
    const offenders = files.flatMap(rowsEatingTheFill);
    // Assert
    expect(files.length).toBeGreaterThan(20);
    expect(offenders).toEqual([]);
  });
});
