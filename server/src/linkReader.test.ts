import { describe, expect, it } from 'vitest';
import { type LinkReaderDeps, instagramAuthor, instagramEmbedUrl, parseFacebookMeta, parseInstagramEmbed, readLinkCard } from './linkReader.js';

const EMBED = `<div class="Caption"><a class="CaptionUsername" href="https://www.instagram.com/jsebas.yt/?utm_source=ig_embed" target="_blank">jsebas.yt</a><br /><br />Comenta NICHO y te lo paso!!! <a href="https://www.instagram.com/explore/tags/ia/">#ia</a><div class="CaptionComments"><a>View all 274 comments</a></div></div>`;

describe('instagramEmbedUrl', () => {
  it('points a reel or a post at its captioned embed', () => {
    expect(instagramEmbedUrl('https://www.instagram.com/reel/DfXK5rxuHhk/')).toBe('https://www.instagram.com/reel/DfXK5rxuHhk/embed/captioned/');
    expect(instagramEmbedUrl('https://www.instagram.com/capi.al.grano/reel/DfXK5rxuHhk/')).toBe('https://www.instagram.com/reel/DfXK5rxuHhk/embed/captioned/');
    expect(instagramEmbedUrl('https://www.instagram.com/p/DemCjCiEVE3/?img_index=1')).toBe('https://www.instagram.com/p/DemCjCiEVE3/embed/captioned/');
  });

  it('has nothing for a profile', () => {
    expect(instagramEmbedUrl('https://www.instagram.com/capi.al.grano/')).toBeNull();
  });
});

describe('parseInstagramEmbed', () => {
  it('reads the username and the caption without tags or entities', () => {
    expect(parseInstagramEmbed(EMBED)).toEqual({ username: 'jsebas.yt', caption: 'Comenta NICHO y te lo paso!!! #ia' });
  });

  it('gives nothing for a page without a caption', () => {
    expect(parseInstagramEmbed('<html><body>Login</body></html>')).toEqual({});
  });
});

describe('instagramAuthor', () => {
  it('takes the name and handle from the reel title', () => {
    expect(instagramAuthor('Capi (@capi.al.grano) • Reel de Instagram', 'capi.al.grano')).toBe('Capi (@capi.al.grano)');
  });

  it('takes the name from a post title', () => {
    expect(instagramAuthor('Sebas - automatización de YouTube en Instagram: "Comenta NICHO"', 'jsebas.yt')).toBe('Sebas - automatización de YouTube (@jsebas.yt)');
  });

  it('falls back to the handle', () => {
    expect(instagramAuthor(undefined, 'jsebas.yt')).toBe('@jsebas.yt');
    expect(instagramAuthor(undefined, undefined)).toBeUndefined();
  });
});

describe('parseFacebookMeta', () => {
  it('splits the stats, the caption and the page out of the title', () => {
    const meta = new Map([
      ['og:title', '10&#xa0;mil reproducciones &#xb7; 879 reacciones | Cómo instalar el MCP de Meta | IA Para Tu Negocio - Erik Taveras'],
      ['og:description', 'Cómo instalar y usar el MCP nativo de Meta para ads en Claude y ChatGPT\n\n#MetaAds'],
      ['og:image', 'https://scontent.fbcdn.net/a.jpg'],
    ]);
    expect(parseFacebookMeta(meta)).toEqual({ author: 'IA Para Tu Negocio - Erik Taveras', text: 'Cómo instalar y usar el MCP nativo de Meta para ads en Claude y ChatGPT #MetaAds', imageUrl: 'https://scontent.fbcdn.net/a.jpg' });
  });

  it('gives nothing when Facebook sent the login page', () => {
    expect(parseFacebookMeta(new Map([['og:title', 'Facebook']]))).toEqual({});
  });
});

type Preview = NonNullable<Awaited<ReturnType<LinkReaderDeps['fetchPreview']>>>;
const preview = (overrides: Partial<Preview>): Preview => ({ url: 'x', titulo: 't', sitio: 's', ...overrides });

describe('readLinkCard', () => {
  it('builds an Instagram card from the embed and the preview, with the bait mark', async () => {
    const card = await readLinkCard('https://www.instagram.com/p/DemCjCiEVE3/?igsh=abc', {
      resolveUrl: async (url) => url,
      fetchHtml: async (url) => (url.includes('/embed/') ? EMBED : null),
      fetchPreview: async () => preview({ titulo: 'Sebas en Instagram: "Comenta NICHO"', imagen: 'https://cdn.ig/x.jpg' }),
    });
    expect(card).toEqual({
      url: 'https://www.instagram.com/p/DemCjCiEVE3/',
      platform: 'instagram',
      format: 'post',
      status: 'ready',
      author: 'Sebas (@jsebas.yt)',
      text: 'Comenta NICHO y te lo paso!!! #ia',
      imageUrl: 'https://cdn.ig/x.jpg',
      commentBait: 'NICHO',
    });
  });

  it('builds a YouTube card from oEmbed (title and channel)', async () => {
    const card = await readLinkCard('https://youtube.com/shorts/vRDDH3QUcwk?si=1', {
      resolveUrl: async (url) => url,
      fetchHtml: async () => null,
      fetchPreview: async () => preview({ titulo: 'Globos con forma de animales', descripcion: 'Alegrin', imagen: 'https://i.ytimg.com/a.jpg', video: true }),
    });
    expect(card).toMatchObject({ url: 'https://youtube.com/shorts/vRDDH3QUcwk', platform: 'youtube', format: 'short', status: 'ready', author: 'Alegrin', text: 'Globos con forma de animales' });
  });

  it('follows a TikTok short link before asking oEmbed', async () => {
    const asked: string[] = [];
    const card = await readLinkCard('https://vt.tiktok.com/ZSpHXquM7/', {
      resolveUrl: async () => 'https://www.tiktok.com/@jersonjuarez.gd/video/7676669333476592904?_r=1&_t=ZS',
      fetchHtml: async () => null,
      fetchPreview: async (url) => {
        asked.push(url);
        return preview({ titulo: 'Consejo de multinivel', descripcion: 'jersonjuarez.gd', video: true });
      },
    });
    expect(asked).toEqual(['https://www.tiktok.com/@jersonjuarez.gd/video/7676669333476592904']);
    expect(card).toMatchObject({ url: 'https://vt.tiktok.com/ZSpHXquM7/', author: 'jersonjuarez.gd', text: 'Consejo de multinivel' });
  });

  it('takes the TikTok author from the URL when oEmbed has none, and drops the generic title', async () => {
    const card = await readLinkCard('https://www.tiktok.com/@jersonjuarez.gd/video/7676669333476592904', {
      resolveUrl: async (url) => url,
      fetchHtml: async () => null,
      fetchPreview: async () => preview({ titulo: 'TikTok · GlobalDream', sitio: 'TikTok' }),
    });
    expect(card).toMatchObject({ status: 'ready', author: '@jersonjuarez.gd' });
    expect(card.text).toBeUndefined();
  });

  it('marks as unreadable what the network did not show', async () => {
    const card = await readLinkCard('https://www.instagram.com/p/De9jQMfCh-K/', { resolveUrl: async (url) => url, fetchHtml: async () => null, fetchPreview: async () => null });
    expect(card).toEqual({ url: 'https://www.instagram.com/p/De9jQMfCh-K/', platform: 'instagram', format: 'post', status: 'unreadable' });
  });

  it('survives a fetch that throws', async () => {
    const card = await readLinkCard('https://www.facebook.com/share/v/1H4KjuHHA3/', {
      resolveUrl: async (url) => url,
      fetchHtml: async () => {
        throw new Error('ECONNRESET');
      },
      fetchPreview: async () => null,
    });
    expect(card.status).toBe('unreadable');
  });
});
