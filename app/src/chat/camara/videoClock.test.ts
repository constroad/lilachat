import { describe, expect, it } from 'vitest';
import { MAX_VIDEO_SECONDS, recordingLabel } from './videoClock';

/** Design cam-05: «● 00:42 · máx. 3:00» while the chat camera records. */
describe('recordingLabel', () => {
  it('counts the seconds recorded against the 3-minute ceiling', () => {
    // Act
    const labels = [recordingLabel(0), recordingLabel(42_400), recordingLabel(125_000)];
    // Assert
    expect(labels).toEqual(['00:00 · máx. 3:00', '00:42 · máx. 3:00', '02:05 · máx. 3:00']);
  });

  it('never shows more than the ceiling, nor less than zero', () => {
    // Act
    const labels = [recordingLabel(MAX_VIDEO_SECONDS * 1000 + 900), recordingLabel(-5)];
    // Assert
    expect(labels).toEqual(['03:00 · máx. 3:00', '00:00 · máx. 3:00']);
  });
});
