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

  it('counts against a shorter ceiling when the ticket asks for one (an observation: 30 s)', () => {
    // Act
    const labels = [recordingLabel(12_000, 30), recordingLabel(45_000, 30), recordingLabel(10_000, 60)];
    // Assert
    expect(labels).toEqual(['00:12 · máx. 0:30', '00:30 · máx. 0:30', '00:10 · máx. 1:00']);
  });

  it('never shows more than the ceiling, nor less than zero', () => {
    // Act
    const labels = [recordingLabel(MAX_VIDEO_SECONDS * 1000 + 900), recordingLabel(-5)];
    // Assert
    expect(labels).toEqual(['03:00 · máx. 3:00', '00:00 · máx. 3:00']);
  });
});
