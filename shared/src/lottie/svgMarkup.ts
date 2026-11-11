/**
 * A small reader for the SVG markup the wink art carries (no DOM in shared):
 * elements, their attributes (entities decoded) and children. Text, comments
 * and CDATA are dropped; a closing tag closes whatever it left open. PURE.
 */
export type SvgNode = { tag: string; attrs: Readonly<Record<string, string>>; children: SvgNode[] };

const TAG_PATTERN = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<[?!][^>]*>|<\/\s*([\w:.-]+)\s*>|<([\w:.-]+)((?:\s+[^\s=/>]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*(\/?)>/g;
const ATTRIBUTE_PATTERN = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
const ENTITY_PATTERN = /&(#x[0-9a-f]+|#\d+|quot|apos|amp|lt|gt);/gi;
const NAMED_ENTITIES: Readonly<Record<string, string>> = { quot: '"', apos: "'", amp: '&', lt: '<', gt: '>' };
const HEX_RADIX = 16;
const DECIMAL_RADIX = 10;

function decodeEntities(text: string): string {
  return text.replace(ENTITY_PATTERN, (entity, name: string) => {
    const lower = name.toLowerCase();
    if (lower.startsWith('#x')) return String.fromCodePoint(Number.parseInt(lower.slice(2), HEX_RADIX));
    if (lower.startsWith('#')) return String.fromCodePoint(Number.parseInt(lower.slice(1), DECIMAL_RADIX));
    return NAMED_ENTITIES[lower] ?? entity;
  });
}

function parseAttributes(source: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const [, name, doubleQuoted, singleQuoted, bare] of source.matchAll(ATTRIBUTE_PATTERN)) {
    if (name) attrs[name] = decodeEntities(doubleQuoted ?? singleQuoted ?? bare ?? '');
  }
  return attrs;
}

/** Closes the innermost open element with that tag (and what it left open); a stray closing tag changes nothing. */
function closeElement(open: SvgNode[], tag: string): void {
  for (let depth = open.length - 1; depth > 0; depth -= 1) {
    if (open[depth]?.tag === tag) {
      open.length = depth;
      return;
    }
  }
}

export function parseSvgMarkup(markup: string): SvgNode[] {
  const root: SvgNode = { tag: '#root', attrs: {}, children: [] };
  const open: SvgNode[] = [root];
  for (const [, closing, opening, attributes, selfClosing] of markup.matchAll(TAG_PATTERN)) {
    if (closing) closeElement(open, closing);
    if (!opening) continue;
    const node: SvgNode = { tag: opening, attrs: parseAttributes(attributes ?? ''), children: [] };
    (open.at(-1) ?? root).children.push(node);
    if (!selfClosing) open.push(node);
  }
  return root.children;
}
