import { useLayoutEffect } from 'react';
import { registrarPerf } from './diagnostico';
import { FrameWindows, framesEntry, type FrameReport } from './frames';

/**
 * The samplers behind `frames.ts` (plan 1, F0). While an interaction is open:
 * - the JS thread is sampled with `requestAnimationFrame` (a late callback is a
 *   frame the JS thread could not produce);
 * - the UI thread is sampled by `FrameMonitorHost` (Reanimated's frame
 *   callback, one `runOnJS` per frame, at most two seconds per window).
 * Nothing runs while no interaction is open: idle costs nothing.
 *
 * Every report lands in the diagnostics log as `cuadros:<interaction>`, which
 * already reaches LilaStore with the rest of the log.
 */
type UiSampler = { start: () => void; stop: () => void };

const windows = new FrameWindows((report: FrameReport) => {
  const entry = framesEntry(report, Date.now());
  void registrarPerf(entry.op, entry.ms, entry.extra);
});

let uiSampler: UiSampler | null = null;
let jsFrame: number | null = null;
let lastJsFrameAt = 0;

function sampleJs(frameAt: number): void {
  if (lastJsFrameAt > 0) windows.frame('js', frameAt - lastJsFrameAt, Date.now());
  lastJsFrameAt = frameAt;
  if (windows.sampling) jsFrame = requestAnimationFrame(sampleJs);
  else stopSampling();
}

function startSampling(): void {
  if (jsFrame !== null) return;
  lastJsFrameAt = 0;
  jsFrame = requestAnimationFrame(sampleJs);
  uiSampler?.start();
}

function stopSampling(): void {
  if (jsFrame !== null) cancelAnimationFrame(jsFrame);
  jsFrame = null;
  uiSampler?.stop();
}

/** `FrameMonitorHost` plugs the UI-thread sampler in; without a host only the JS thread is measured. */
export function setUiSampler(sampler: UiSampler | null): void {
  uiSampler?.stop();
  uiSampler = sampler;
  if (sampler && windows.sampling) sampler.start();
}

/** One UI frame, `deltaMs` after the previous one (called from the host's worklet through `runOnJS`). */
export function uiFrame(deltaMs: number): void {
  windows.frame('ui', deltaMs, Date.now());
  if (!windows.sampling) stopSampling();
}

/** Opens the window of an interaction. With `limitMs` it closes itself; otherwise `endInteraction` closes it. */
export function beginInteraction(name: string, limitMs?: number): void {
  windows.begin(name, Date.now(), limitMs);
  startSampling();
}

export function endInteraction(name: string): void {
  windows.end(name, Date.now());
  if (!windows.sampling) stopSampling();
}

/** Closes the window after the next frame: what we waited for is painted and that frame counts. */
export function endInteractionAfterPaint(name: string): void {
  requestAnimationFrame(() => endInteraction(name));
}

/** Labeled JS work (ms) inside the open interactions (F4: where the time of a send goes). Free when none is open. */
export function measureWork(label: string, ms: number): void {
  if (windows.sampling) windows.work(label, ms);
}

/**
 * The cost of a screen's render: from the start of its function to its layout
 * effects, so its subtree rendered and committed. Counted only inside an open
 * interaction; outside, two `performance.now()` per render.
 */
export function useRenderCost(label: string): void {
  const startedAt = performance.now();
  useLayoutEffect(() => {
    measureWork(label, performance.now() - startedAt);
  });
}
