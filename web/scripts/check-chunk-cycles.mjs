import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Fails the build when two chunks import each other statically (José 05/11: the
 * build was green and the web loaded blank, «Cannot access 'ro' before
 * initialization»). A cycle only breaks when the browser evaluates it.
 */
const STATIC_IMPORT = /(?:\bimport|\bfrom)\s*"\.\/([^"]+\.js)"/g;

export function importsOf(code) {
  return [...code.matchAll(STATIC_IMPORT)].map((match) => match[1]);
}

export function findCycle(graph) {
  const done = new Set();
  const visit = (chunk, path) => {
    if (path.includes(chunk)) return [...path.slice(path.indexOf(chunk)), chunk];
    if (done.has(chunk)) return null;
    for (const next of graph.get(chunk) ?? []) {
      const cycle = visit(next, [...path, chunk]);
      if (cycle) return cycle;
    }
    done.add(chunk);
    return null;
  };
  for (const chunk of graph.keys()) {
    const cycle = visit(chunk, []);
    if (cycle) return cycle;
  }
  return null;
}

function checkFolder(folder) {
  const chunks = readdirSync(folder).filter((name) => name.endsWith('.js'));
  const cycle = findCycle(new Map(chunks.map((name) => [name, importsOf(readFileSync(join(folder, name), 'utf8'))])));
  if (cycle) {
    console.error(`Chunks that import each other: ${cycle.join(' -> ')}`);
    process.exit(1);
  }
  console.log(`check-chunk-cycles: ${chunks.length} chunks, no cycle.`);
}

if (process.argv[1]?.endsWith('check-chunk-cycles.mjs')) checkFolder(process.argv[2] ?? 'dist/assets');
