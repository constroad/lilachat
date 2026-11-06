import { describe, expect, it } from 'vitest';
// @ts-expect-error a plain build script, without types
import { findCycle, importsOf } from './check-chunk-cycles.mjs';

describe('check-chunk-cycles', () => {
  it('reads the static imports and leaves the lazy ones out', () => {
    const code = 'import{R as ro}from"./interfaz-1.js";import"./side-2.js";const page=()=>import("./lazy-3.js");export{a}from"./again-4.js";';
    expect(importsOf(code)).toEqual(['interfaz-1.js', 'side-2.js', 'again-4.js']);
  });

  it('finds two chunks that import each other', () => {
    const graph = new Map([['index.js', ['datos.js']], ['datos.js', ['interfaz.js']], ['interfaz.js', ['datos.js']]]);
    expect(findCycle(graph)).toEqual(['datos.js', 'interfaz.js', 'datos.js']);
  });

  it('passes a graph that only points one way', () => {
    const graph = new Map([['index.js', ['vendor.js']], ['lazy.js', ['index.js', 'vendor.js']], ['vendor.js', []]]);
    expect(findCycle(graph)).toBeNull();
  });
});
