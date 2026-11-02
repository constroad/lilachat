import { describe, expect, it, vi } from 'vitest';
import { frameStats, FrameWindows, framesEntry, MAX_WINDOW_MS, summarizeFrames, type FrameReport } from './frames';
import type { EntradaDiagnostico } from './motor';

/**
 * Plan 1, F0 (PLANES-FLUIDEZ-IOS-PWA §1.3): dropped frames per interaction,
 * on the JS and the UI thread. The engine is pure; the samplers (rAF and
 * Reanimated's frame callback) live in `frameMonitor.ts`.
 */
const AT_60HZ = 1000 / 60;
const AT_120HZ = 1000 / 120;
const steady = (interval: number, count: number) => Array.from({ length: count }, () => interval);

describe('frameStats', () => {
  it('no deltas: nothing painted, nothing dropped', () => {
    expect(frameStats([])).toEqual({ frames: 0, dropped: 0, worstMs: 0 });
  });

  it('a steady 60 Hz window drops nothing', () => {
    const stats = frameStats(steady(AT_60HZ, 30));
    expect(stats).toEqual({ frames: 30, dropped: 0, worstMs: Math.round(AT_60HZ) });
  });

  it('a 50 ms gap at 60 Hz is two frames that never came', () => {
    const stats = frameStats([...steady(AT_60HZ, 10), 50, ...steady(AT_60HZ, 10)]);
    expect(stats.dropped).toBe(2);
    expect(stats.worstMs).toBe(50);
    expect(stats.frames).toBe(21);
  });

  it('infers the vsync interval: the same 25 ms gap is two drops at 120 Hz and none at 60 Hz', () => {
    expect(frameStats([...steady(AT_120HZ, 10), 25]).dropped).toBe(2);
    expect(frameStats([...steady(AT_60HZ, 10), 25]).dropped).toBe(0);
  });

  it('vsync jitter (a frame 1 ms late) is not a drop', () => {
    expect(frameStats([16, 17, 18, 16, 17]).dropped).toBe(0);
  });

  it('a window where every frame is late still counts drops (interval clamped to 50 Hz)', () => {
    expect(frameStats(steady(40, 5)).dropped).toBe(5);
  });
});

describe('FrameWindows (one window per interaction)', () => {
  const windows = () => {
    const onReport = vi.fn<(report: FrameReport) => void>();
    return { onReport, windows: new FrameWindows(onReport) };
  };

  it('reports the interaction with its duration and the drops of each thread', () => {
    const { onReport, windows: w } = windows();
    w.begin('abrir-chat', 1000);
    w.frame('js', AT_60HZ, 1017);
    w.frame('js', 50, 1067);
    w.frame('ui', AT_60HZ, 1017);
    w.frame('ui', AT_60HZ, 1033);
    w.end('abrir-chat', 1100);

    expect(onReport).toHaveBeenCalledTimes(1);
    const report = onReport.mock.calls[0][0];
    expect(report.name).toBe('abrir-chat');
    expect(report.durationMs).toBe(100);
    expect(report.js).toEqual({ frames: 2, dropped: 2, worstMs: 50 });
    expect(report.ui).toEqual({ frames: 2, dropped: 0, worstMs: Math.round(AT_60HZ) });
  });

  it('samples only while a window is open', () => {
    const { onReport, windows: w } = windows();
    expect(w.sampling).toBe(false);
    w.frame('js', 50, 1);
    w.begin('enviar', 10);
    expect(w.sampling).toBe(true);
    w.end('enviar', 20);
    expect(w.sampling).toBe(false);
    expect(onReport.mock.calls[0][0].js.frames).toBe(0);
  });

  it('ending an interaction that never began reports nothing', () => {
    const { onReport, windows: w } = windows();
    w.end('abrir-foto', 5);
    expect(onReport).not.toHaveBeenCalled();
  });

  it('two interactions at once (keyboard during a chat open) each count the frames', () => {
    const { onReport, windows: w } = windows();
    w.begin('abrir-chat', 0);
    w.begin('teclado-abrir', 10);
    w.frame('ui', 40, 50);
    w.end('teclado-abrir', 60);
    w.end('abrir-chat', 70);

    expect(onReport.mock.calls.map((call) => [call[0].name, call[0].ui.dropped])).toEqual([
      ['teclado-abrir', 1],
      ['abrir-chat', 1],
    ]);
  });

  it('beginning the same interaction again restarts it', () => {
    const { onReport, windows: w } = windows();
    w.begin('enviar', 0);
    w.frame('js', 60, 60);
    w.begin('enviar', 100);
    w.frame('js', AT_60HZ, 117);
    w.end('enviar', 120);

    const report = onReport.mock.calls[0][0];
    expect(report.durationMs).toBe(20);
    expect(report.js.dropped).toBe(0);
  });

  it('a window nobody ends closes itself after MAX_WINDOW_MS, on the next frame', () => {
    const { onReport, windows: w } = windows();
    w.begin('enviar', 0);
    w.frame('js', AT_60HZ, MAX_WINDOW_MS - 1);
    expect(onReport).not.toHaveBeenCalled();
    w.frame('js', AT_60HZ, MAX_WINDOW_MS + 5);
    expect(onReport).toHaveBeenCalledTimes(1);
    expect(onReport.mock.calls[0][0].durationMs).toBe(MAX_WINDOW_MS + 5);
    expect(w.sampling).toBe(false);
  });

  it('a window with its own limit closes at that limit', () => {
    const { onReport, windows: w } = windows();
    w.begin('enviar', 0, 500);
    w.frame('ui', AT_60HZ, 400);
    w.frame('ui', AT_60HZ, 600);
    expect(onReport.mock.calls[0][0].durationMs).toBe(600);
  });
});

describe('framesEntry (what goes to the diagnostics log)', () => {
  it('is a perf entry named after the interaction, with the drops as numbers', () => {
    const report: FrameReport = {
      name: 'abrir-foto',
      durationMs: 320,
      js: { frames: 18, dropped: 3, worstMs: 70 },
      ui: { frames: 19, dropped: 1, worstMs: 33 },
    };
    expect(framesEntry(report, 5000)).toEqual({
      tipo: 'perf',
      cuando: 5000,
      op: 'cuadros:abrir-foto',
      ms: 320,
      extra: { js: 3, ui: 1, jsWorst: 70, uiWorst: 33, frames: 19 },
    });
  });
});

describe('summarizeFrames (the «Fluidez» block in Diagnóstico)', () => {
  const frames = (name: string, js: number, ui: number, cuando = 1): EntradaDiagnostico => ({
    tipo: 'perf',
    cuando,
    op: `cuadros:${name}`,
    ms: 100,
    extra: { js, ui, jsWorst: js * 10, uiWorst: ui * 10, frames: 12 },
  });

  it('groups by interaction with count, median and worst per thread, sorted by name', () => {
    const summary = summarizeFrames([
      frames('teclado-abrir', 1, 0),
      frames('abrir-chat', 4, 1),
      frames('abrir-chat', 2, 0),
      frames('abrir-chat', 9, 3),
      { tipo: 'perf', cuando: 1, op: 'abrir-chat', ms: 400 },
      { tipo: 'error', cuando: 1, mensaje: 'x' },
    ]);

    expect(summary).toEqual([
      { name: 'abrir-chat', count: 3, jsMedian: 4, jsWorst: 9, uiMedian: 1, uiWorst: 3 },
      { name: 'teclado-abrir', count: 1, jsMedian: 1, jsWorst: 1, uiMedian: 0, uiWorst: 0 },
    ]);
  });

  it('an even count takes the upper median', () => {
    const [summary] = summarizeFrames([frames('enviar', 1, 0), frames('enviar', 5, 2)]);
    expect(summary.jsMedian).toBe(5);
    expect(summary.uiMedian).toBe(2);
  });

  it('nothing measured: empty', () => {
    expect(summarizeFrames([])).toEqual([]);
  });
});
