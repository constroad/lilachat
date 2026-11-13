import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { displaySizeOf, stampVideo } from './videoStamp.js';

const run = promisify(execFile);

/**
 * José 12/11: a video from the chat's camera carries the same stamp as a photo (design cam-05):
 * the hour, the date, the address and the logo, burned in once while it is compressed.
 */
describe('displaySizeOf', () => {
  it('turns the size a phone records sideways into the size it is seen', () => {
    // Arrange
    const upright = { streams: [{ width: 1280, height: 720, side_data_list: [{ rotation: -90 }] }] };
    const tagged = { streams: [{ width: 1280, height: 720, tags: { rotate: '270' } }] };
    const flat = { streams: [{ width: 1280, height: 720 }] };
    // Act
    const sizes = [displaySizeOf(upright), displaySizeOf(tagged), displaySizeOf(flat)];
    // Assert
    expect(sizes).toEqual([{ width: 720, height: 1280 }, { width: 720, height: 1280 }, { width: 1280, height: 720 }]);
  });

  it('knows nothing from an answer without a video', () => {
    // Act
    const sizes = [displaySizeOf({ streams: [] }), displaySizeOf(null), displaySizeOf({ streams: [{ width: 0, height: 720 }] })];
    // Assert
    expect(sizes).toEqual([null, null, null]);
  });
});

describe('stampVideo', () => {
  const stamp = { hour: '07:42', date: '12/11/2026', weekday: 'jueves', address: 'Av. Los Incas 1240, Ate, Lima', coords: null };

  it('burns the stamp at the bottom and leaves the top as it was', async () => {
    // Arrange: two seconds of white, 640×360, with sound.
    const folder = await mkdtemp(join(tmpdir(), 'video-stamp-test-'));
    const source = join(folder, 'in.mp4');
    await run('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=white:s=640x360:d=2', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', source]);
    // Act
    const stamped = await stampVideo(await readFile(source), stamp, null);
    // Assert
    expect(stamped).not.toBeNull();
    const out = join(folder, 'out.mp4');
    const frame = join(folder, 'frame.png');
    await import('node:fs/promises').then((fs) => fs.writeFile(out, stamped!));
    await run('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '1', '-i', out, '-frames:v', '1', frame]);
    const { data, info } = await sharp(frame).raw().toBuffer({ resolveWithObject: true });
    expect([info.width, info.height]).toEqual([640, 360]);
    expect(data[(4 * info.width + 4) * info.channels]!).toBeGreaterThan(230);
    expect(data[((info.height - 3) * info.width + info.width - 6) * info.channels]!).toBeLessThan(200);
    await rm(folder, { recursive: true, force: true });
  }, 60_000);

  it('a phone video held sideways, with an odd side and Opus sound, comes out upright, stamped and playable', async () => {
    // Arrange: 640×361 recorded sideways (rotation 90) with Opus, as some phones save it.
    const folder = await mkdtemp(join(tmpdir(), 'video-stamp-test-'));
    const [flat, sideways] = [join(folder, 'flat.mp4'), join(folder, 'side.mp4')];
    await run('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=white:s=640x361:d=1', '-f', 'lavfi', '-i', 'sine=duration=1', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-vf', 'scale=640:360', '-c:a', 'libopus', '-shortest', flat]);
    await run('ffmpeg', ['-y', '-loglevel', 'error', '-display_rotation', '90', '-i', flat, '-c', 'copy', sideways]);
    // Act
    const stamped = await stampVideo(await readFile(sideways), stamp, null);
    // Assert
    expect(stamped).not.toBeNull();
    const out = join(folder, 'out.mp4');
    await import('node:fs/promises').then((fs) => fs.writeFile(out, stamped!));
    const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,width,height', '-of', 'csv=p=0', out]);
    expect(stdout.trim().split('\n')).toEqual(['h264,360,640', 'aac']);
    await rm(folder, { recursive: true, force: true });
  }, 60_000);

  it('a WebM from a phone browser (Android Chrome, VP8 and Opus) comes out as a stamped MP4', async () => {
    // Arrange: what MediaRecorder writes in the web's camera (José 12/11: the PWA too).
    const folder = await mkdtemp(join(tmpdir(), 'video-stamp-test-'));
    const webm = join(folder, 'shot.webm');
    await run('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=white:s=640x480:d=1', '-f', 'lavfi', '-i', 'sine=duration=1', '-c:v', 'libvpx', '-c:a', 'libopus', '-shortest', webm]);
    // Act
    const stamped = await stampVideo(await readFile(webm), stamp, null);
    // Assert
    expect(stamped).not.toBeNull();
    const out = join(folder, 'out.mp4');
    await import('node:fs/promises').then((fs) => fs.writeFile(out, stamped!));
    const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,width,height', '-of', 'csv=p=0', out]);
    expect(stdout.trim().split('\n')).toEqual(['h264,640,480', 'aac']);
    await rm(folder, { recursive: true, force: true });
  }, 60_000);

  it('gives null for bytes that are not a video, and the caller sends it as it came', async () => {
    // Act
    const stamped = await stampVideo(Buffer.from('not a video'), stamp, null);
    // Assert
    expect(stamped).toBeNull();
  }, 30_000);
});
