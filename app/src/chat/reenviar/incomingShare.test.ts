import { describe, expect, it } from 'vitest';
import { MAX_SHARED_TEXT, planIncomingShare } from './incomingShare';

/** José, 02/11: «Compartir» in YouTube, Instagram, TikTok or Facebook did not list Lilachat. */
describe('planIncomingShare', () => {
  it('a YouTube link with its title as subject: sends the link, as WhatsApp does', () => {
    // Arrange
    const share = { text: ' https://youtu.be/abc123 ', subject: 'Ver «Asfalto en frío» en YouTube' };
    // Act
    const plan = planIncomingShare(share);
    // Assert
    expect(plan).toEqual({ text: 'https://youtu.be/abc123', files: [], summary: 'https://youtu.be/abc123' });
  });

  it('only a subject: the subject is the text', () => {
    expect(planIncomingShare({ text: '', subject: 'Reunión del lunes' })?.text).toBe('Reunión del lunes');
  });

  it('nothing usable, or nothing at all: no plan', () => {
    expect(planIncomingShare(null)).toBeNull();
    expect(planIncomingShare({ text: '   ', subject: null, files: [] })).toBeNull();
    expect(planIncomingShare({ files: [{ uri: 'file:///data/data/com.lilachat.app/files/secret.json', mimeType: 'application/json' }] })).toBeNull();
  });

  it('a long text is cut to what a message holds', () => {
    expect(planIncomingShare({ text: 'a'.repeat(MAX_SHARED_TEXT + 50) })?.text).toHaveLength(MAX_SHARED_TEXT);
  });

  it('files: only content uris, at most 10, the text as the first one’s caption', () => {
    // Arrange
    const photos = Array.from({ length: 12 }, (_, index) => ({ uri: `content://media/external/images/${index}`, mimeType: 'image/jpeg', name: `IMG_${index}.jpg`, size: 2048 }));
    // Act
    const plan = planIncomingShare({ text: 'Avance de obra', files: [{ uri: 'file:///sdcard/x.jpg', mimeType: 'image/jpeg' }, ...photos] });
    // Assert
    expect(plan?.files).toHaveLength(10);
    expect(plan?.files[0]).toEqual({ uri: 'content://media/external/images/0', mimeType: 'image/jpeg', fileName: 'IMG_0.jpg', sizeBytes: 2048, caption: 'Avance de obra' });
    expect(plan?.files[1]?.caption).toBeUndefined();
    expect(plan?.text).toBeNull();
    expect(plan?.summary).toBe('10 fotos');
  });

  it('a file with no name, type or size gets safe ones; the queue measures it after copying', () => {
    const plan = planIncomingShare({ files: [{ uri: 'content://com.zhiliaoapp.musically.fileprovider/v/1', mimeType: 'video/mp4' }, { uri: 'content://x/2', mimeType: '', name: '../../etc/passwd', size: -4 }] });
    expect(plan?.files).toEqual([
      { uri: 'content://com.zhiliaoapp.musically.fileprovider/v/1', mimeType: 'video/mp4', fileName: 'compartido.mp4', sizeBytes: 0 },
      { uri: 'content://x/2', mimeType: 'application/octet-stream', fileName: 'passwd', sizeBytes: 0 },
    ]);
    expect(plan?.summary).toBe('2 archivos');
  });

  it('the summary under the title: one video, or the first line of a long text', () => {
    expect(planIncomingShare({ files: [{ uri: 'content://v/1', mimeType: 'video/mp4' }] })?.summary).toBe('1 video');
    expect(planIncomingShare({ text: `Primera línea ${'x'.repeat(100)}\nsegunda` })?.summary).toMatch(/^Primera línea x+…$/);
  });
});
