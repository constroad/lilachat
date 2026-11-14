import type { BotBlock } from './botBlocks.js';

/**
 * The technical visit's card in the chat (Stitch lv01, agentes 14/11). Agentes sends generic blocks; Lilachat
 * draws them as the design, the same on the web and the APK. PURE.
 */
type TextBlock = Extract<BotBlock, { type: 'text' }>;
type MapBlock = Extract<BotBlock, { type: 'map' }>;

/** The visit map: 125 tall, 20 px points, and OpenStreetMap's closest zoom (a visit's points are meters apart). */
export const VISIT_MAP_LOOK = { height: 125, dot: 20, maxZoom: 19 } as const;

const isMissing = (block: BotBlock): block is TextBlock => block.type === 'text' && (block.tone === 'warn' || block.tone === 'error');

/** lv01 closes the card with what is missing, under the buttons: those lines leave the body. */
export function visitBlocksOf(blocks: readonly BotBlock[]): { body: BotBlock[]; missing: TextBlock[] } {
  return { body: blocks.filter((block) => !isMissing(block)), missing: blocks.filter(isMissing) };
}

/** «VISITA TÉCNICA ·» in the accent and the code in mono grey: split at the last « · ». */
export function visitKickerParts(kicker: string | undefined): { lead: string; code: string } {
  const value = kicker ?? '';
  const cut = value.lastIndexOf(' · ');
  return cut > 0 ? { lead: value.slice(0, cut + 3), code: value.slice(cut + 3) } : { lead: value, code: '' };
}

/** «6 de 10»: the count bold, «de 10» small and grey. */
export function figureParts(value: string): { count: string; rest: string } {
  const parts = /^(\S+)\s+(de\s+.+)$/.exec(value);
  return parts?.[1] && parts[2] ? { count: parts[1], rest: parts[2] } : { count: value, rest: '' };
}

export type VisitCardMapPoint = { lat: number; lng: number; n: number | string };

/**
 * The visit's map: each point with its label inside («1», «F») or its order; the place gets its pin only when
 * the map names it with `label` (agentes 14/11), and «GPS activo» with the precision when it came.
 */
export function visitMapOf(block: MapBlock): { points: VisitCardMapPoint[]; place?: { lat: number; lng: number }; badge?: string } {
  const points = (block.points ?? []).map((point, index) => ({ lat: point.lat, lng: point.lng, n: point.label || index + 1 }));
  return {
    points,
    ...(block.label ? { place: { lat: block.lat, lng: block.lng } } : {}),
    ...(block.precisionM !== undefined ? { badge: `GPS ACTIVO · ±${Math.round(block.precisionM)} m` } : {}),
  };
}
