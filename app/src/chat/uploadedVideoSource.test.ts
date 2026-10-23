import { describe, expect, it } from 'vitest';
import { uploadedVideoSource } from './uploadedVideoSource';

/** Pending 74 (José, 23/10): an uploaded video keeps playing with the screen off, with its control in the notification. */
describe('uploadedVideoSource', () => {
  it('names the video in the notification with the chat and shows its cover', () => {
    expect(uploadedVideoSource({ url: 'https://lilachat.constroad.com/media/v.mp4', poster: 'https://lilachat.constroad.com/media/thumbs/h.jpg', chatTitle: 'Obra Huachipa' })).toEqual({
      uri: 'https://lilachat.constroad.com/media/v.mp4',
      metadata: { title: 'Video', artist: 'Obra Huachipa', artwork: 'https://lilachat.constroad.com/media/thumbs/h.jpg' },
    });
  });

  it('without a chat or a cover it still says where it comes from', () => {
    expect(uploadedVideoSource({ url: 'u' })).toEqual({ uri: 'u', metadata: { title: 'Video', artist: 'Lilachat' } });
  });
});
