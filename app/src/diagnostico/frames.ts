import type { EntradaDiagnostico, EntradaPerf } from './motor';

/**
 * Dropped frames per interaction (plan 1, F0: `specs/PLANES-FLUIDEZ-IOS-PWA.spec.md`
 * §1.3). PURE engine: no React Native, so it runs in vitest.
 *
 * An interaction («abrir-chat», «teclado-abrir», «abrir-foto», «enviar»…) opens
 * a window. While any window is open, the samplers in `frameMonitor.ts` feed
 * the delta between consecutive frames of each thread: JS (requestAnimationFrame)
 * and UI (Reanimated's frame callback). Closing the window reports how many
 * frames should have been painted and were not. «Se siente lento» becomes a
 * number that can be compared before and after each phase of the plan.
 */
export type Thread = 'js' | 'ui';
export type FrameStats = { frames: number; dropped: number; worstMs: number };
/** Labeled JS work inside a window (a screen's render, the queue, the disk): total ms and how many times. */
export type WorkTotals = Record<string, { ms: number; count: number }>;
export type FrameReport = { name: string; durationMs: number; js: FrameStats; ui: FrameStats; work?: WorkTotals };
export type WorkSummary = { label: string; ms: number; count: number };
export type FrameSummary = { name: string; count: number; jsMedian: number; jsWorst: number; uiMedian: number; uiWorst: number; work: WorkSummary[] };

/** A window nobody closes (the screen never painted what we waited for) still reports. */
export const MAX_WINDOW_MS = 2_000;
/** Prefix of the perf entries this engine writes; the summary reads it back. */
export const FRAMES_OP_PREFIX = 'cuadros:';
/** In a perf entry's `extra`: the ms (`w:`) and the times (`n:`) of each work label. */
const WORK_MS_PREFIX = 'w:';
const WORK_COUNT_PREFIX = 'n:';
/** The summary shows only the costliest labels of each interaction. */
const WORK_IN_SUMMARY = 3;
const DEFAULT_INTERVAL_MS = 1000 / 60;
/** The vsync interval is inferred from the window itself, between 165 Hz and 50 Hz. */
const MIN_INTERVAL_MS = 6;
const MAX_INTERVAL_MS = 20;
/** A frame later than this many intervals missed at least one vsync; below it is jitter. */
const DROP_FACTOR = 1.5;

/** The shortest delta is a frame that made its vsync: that is the display's interval. */
function inferInterval(deltas: readonly number[]): number {
  if (deltas.length === 0) return DEFAULT_INTERVAL_MS;
  const shortest = Math.min(...deltas);
  return Math.min(MAX_INTERVAL_MS, Math.max(MIN_INTERVAL_MS, shortest));
}

/** Frames painted, frames that never came, and the longest wait, from the deltas (ms) between frames. */
export function frameStats(deltas: readonly number[]): FrameStats {
  const interval = inferInterval(deltas);
  let dropped = 0;
  let worstMs = 0;
  for (const delta of deltas) {
    worstMs = Math.max(worstMs, delta);
    if (delta > interval * DROP_FACTOR) dropped += Math.round(delta / interval) - 1;
  }
  return { frames: deltas.length, dropped, worstMs: Math.round(worstMs) };
}

type OpenWindow = { startedAt: number; limitMs: number; js: number[]; ui: number[]; work: WorkTotals };

/** The open interactions. Time is injected: the monitor passes `Date.now()`, the tests pass what they want. */
export class FrameWindows {
  private readonly open = new Map<string, OpenWindow>();

  constructor(private readonly onReport: (report: FrameReport) => void) {}

  /** Any window open: the samplers must run. Off otherwise, so idle costs nothing. */
  get sampling(): boolean {
    return this.open.size > 0;
  }

  /** Opens (or restarts) the window of an interaction. */
  begin(name: string, now: number, limitMs = MAX_WINDOW_MS): void {
    this.open.set(name, { startedAt: now, limitMs, js: [], ui: [], work: {} });
  }

  /** Labeled JS work, added to every open window. Nothing open: it belongs to no interaction. */
  work(label: string, ms: number): void {
    if (!(ms >= 0)) return;
    for (const window of this.open.values()) {
      const total = window.work[label] ?? { ms: 0, count: 0 };
      window.work[label] = { ms: total.ms + ms, count: total.count + 1 };
    }
  }

  /** One frame of a thread, `deltaMs` after the previous one. Windows past their limit close here. */
  frame(thread: Thread, deltaMs: number, now: number): void {
    for (const [name, window] of this.open) {
      window[thread].push(deltaMs);
      if (now - window.startedAt >= window.limitMs) this.end(name, now);
    }
  }

  /** Closes the window and reports it. Nothing began: nothing to report. */
  end(name: string, now: number): void {
    const window = this.open.get(name);
    if (!window) return;
    this.open.delete(name);
    this.onReport({ name, durationMs: now - window.startedAt, js: frameStats(window.js), ui: frameStats(window.ui), work: window.work });
  }
}

/** The report as a perf entry of the diagnostics log, which already reaches LilaStore. */
export function framesEntry(report: FrameReport, cuando: number): EntradaPerf {
  return {
    tipo: 'perf',
    cuando,
    op: `${FRAMES_OP_PREFIX}${report.name}`,
    ms: report.durationMs,
    extra: { js: report.js.dropped, ui: report.ui.dropped, jsWorst: report.js.worstMs, uiWorst: report.ui.worstMs, frames: report.ui.frames, ...workExtra(report.work) },
  };
}

function workExtra(work: WorkTotals = {}): Record<string, number> {
  const extra: Record<string, number> = {};
  for (const [label, total] of Object.entries(work)) {
    extra[`${WORK_MS_PREFIX}${label}`] = Math.round(total.ms);
    extra[`${WORK_COUNT_PREFIX}${label}`] = total.count;
  }
  return extra;
}

/** Upper median: the middle element of the sorted values (for an even count, the higher one). */
function upperMedian(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

/** Per interaction: how many times it was measured, and the median and worst drops of each thread. */
export function summarizeFrames(entries: readonly EntradaDiagnostico[]): FrameSummary[] {
  const byName = new Map<string, { js: number[]; ui: number[]; extras: Record<string, number>[] }>();
  for (const entry of entries) {
    if (entry.tipo !== 'perf' || !entry.op.startsWith(FRAMES_OP_PREFIX)) continue;
    const name = entry.op.slice(FRAMES_OP_PREFIX.length);
    const group = byName.get(name) ?? { js: [], ui: [], extras: [] };
    group.js.push(entry.extra?.js ?? 0);
    group.ui.push(entry.extra?.ui ?? 0);
    group.extras.push(entry.extra ?? {});
    byName.set(name, group);
  }
  return [...byName.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([name, group]) => ({
      name,
      count: group.js.length,
      jsMedian: upperMedian(group.js),
      jsWorst: Math.max(...group.js),
      uiMedian: upperMedian(group.ui),
      uiWorst: Math.max(...group.ui),
      work: summarizeWork(group.extras),
    }));
}

/** Per label, the median ms and times across the measurements (absent counts 0); the costliest first. */
function summarizeWork(extras: readonly Record<string, number>[]): WorkSummary[] {
  const labels = new Set(extras.flatMap((extra) => Object.keys(extra).filter((key) => key.startsWith(WORK_MS_PREFIX)).map((key) => key.slice(WORK_MS_PREFIX.length))));
  return [...labels]
    .map((label) => ({
      label,
      ms: upperMedian(extras.map((extra) => extra[`${WORK_MS_PREFIX}${label}`] ?? 0)),
      count: upperMedian(extras.map((extra) => extra[`${WORK_COUNT_PREFIX}${label}`] ?? 0)),
    }))
    .filter((work) => work.ms > 0)
    .sort((a, b) => b.ms - a.ms)
    .slice(0, WORK_IN_SUMMARY);
}
