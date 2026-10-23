import { describe, expect, it } from 'vitest';
import { fitVideo, videoEmbedFor, videoPlayerHtml } from './videoEmbed.js';

describe('videoEmbedFor (pending 6)', () => {
  it('plays YouTube links, short links and Shorts in the privacy-enhanced player', () => {
    expect(videoEmbedFor('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toEqual({ provider: 'youtube', embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&playsinline=1&rel=0', aspect: 16 / 9, label: 'YouTube' });
    expect(videoEmbedFor('https://youtu.be/dQw4w9WgXcQ?t=42')?.embedUrl).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&playsinline=1&rel=0&start=42');
    expect(videoEmbedFor('https://m.youtube.com/shorts/abcDEF12345')).toMatchObject({ provider: 'youtube', aspect: 9 / 16 });
    expect(videoEmbedFor('https://www.youtube.com/live/abcDEF12345?si=x')?.embedUrl).toContain('/embed/abcDEF12345?');
  });

  it('plays TikTok, Instagram and Facebook videos with their own embeds', () => {
    expect(videoEmbedFor('https://www.tiktok.com/@obra.lima/video/7301234567890123456?lang=es')).toEqual({ provider: 'tiktok', embedUrl: 'https://www.tiktok.com/embed/v2/7301234567890123456', aspect: 9 / 16, label: 'TikTok' });
    expect(videoEmbedFor('https://www.instagram.com/reel/C1a2B3c4D5e/?igsh=abc')).toEqual({ provider: 'instagram', embedUrl: 'https://www.instagram.com/reel/C1a2B3c4D5e/embed', aspect: 9 / 16, label: 'Instagram' });
    expect(videoEmbedFor('https://instagram.com/p/C1a2B3c4D5e')?.embedUrl).toBe('https://www.instagram.com/p/C1a2B3c4D5e/embed');
    expect(videoEmbedFor('https://www.facebook.com/constroad/videos/1234567890/')).toEqual({
      provider: 'facebook',
      embedUrl: 'https://www.facebook.com/plugins/video.php?href=https%3A%2F%2Fwww.facebook.com%2Fconstroad%2Fvideos%2F1234567890%2F&show_text=false',
      aspect: 16 / 9,
      label: 'Facebook',
    });
    expect(videoEmbedFor('https://www.facebook.com/reel/987654321')).toMatchObject({ provider: 'facebook', aspect: 9 / 16 });
  });

  it('leaves everything else to the browser: other sites, bad ids, short links it cannot resolve', () => {
    expect(videoEmbedFor('https://example.com/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(videoEmbedFor('https://www.youtube.com/watch?v=<script>')).toBeNull();
    expect(videoEmbedFor('https://www.youtube.com/channel/UC123')).toBeNull();
    expect(videoEmbedFor('https://vm.tiktok.com/ZMabc123/')).toBeNull();
    expect(videoEmbedFor('https://www.instagram.com/constroad/')).toBeNull();
    expect(videoEmbedFor('not a url')).toBeNull();
    expect(videoEmbedFor('javascript:alert(1)')).toBeNull();
  });
});

describe('the player page and its size', () => {
  it('wraps the embed in an iframe that may autoplay and go full screen', () => {
    const embed = videoEmbedFor('https://youtu.be/dQw4w9WgXcQ')!;
    const html = videoPlayerHtml(embed);
    expect(html).toContain('<iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&amp;playsinline=1&amp;rel=0"');
    expect(html).toContain('allow="autoplay; encrypted-media; picture-in-picture; fullscreen"');
    expect(html).not.toContain('<script');
  });

  it('fits a wide video to the width and a tall one to the height', () => {
    expect(fitVideo(16 / 9, { width: 360, height: 700 })).toEqual({ width: 360, height: 203 });
    expect(fitVideo(9 / 16, { width: 360, height: 600 })).toEqual({ width: 338, height: 600 });
    expect(fitVideo(16 / 9, { width: 800, height: 360 })).toEqual({ width: 640, height: 360 });
  });
});
