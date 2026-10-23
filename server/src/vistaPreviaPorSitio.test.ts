import { describe, expect, it } from 'vitest';
import { agenteParaHost, AGENTE_DE_FACEBOOK, urlDeOembed, vistaDeMapas, vistaDeOembed } from './vistaPreviaPorSitio.js';

/**
 * José, 20/10: «WhatsApp muestra el link y la miniatura de Instagram y
 * YouTube; en Lilachat no. Revisa Facebook y TikTok». YouTube y TikTok tienen
 * oEmbed (JSON con título y miniatura); Instagram, Facebook y TikTok solo le
 * dan sus etiquetas `og:` al robot de Facebook.
 */
describe('urlDeOembed', () => {
  it('YouTube: video, shorts, youtu.be y móvil', () => {
    for (const enlace of ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://youtube.com/shorts/vRDDH3QUcwk?si=abc', 'https://youtu.be/dQw4w9WgXcQ', 'https://m.youtube.com/watch?v=dQw4w9WgXcQ']) {
      expect(urlDeOembed(new URL(enlace))?.startsWith('https://www.youtube.com/oembed?format=json&url=')).toBe(true);
    }
  });
  it('TikTok: un video', () => {
    expect(urlDeOembed(new URL('https://www.tiktok.com/@khaby.lame/video/7106594312292453675'))).toBe('https://www.tiktok.com/oembed?url=https%3A%2F%2Fwww.tiktok.com%2F%40khaby.lame%2Fvideo%2F7106594312292453675');
  });
  it('el resto (y el canal de YouTube) va por las etiquetas og', () => {
    expect(urlDeOembed(new URL('https://www.youtube.com/@alegrin'))).toBeNull();
    expect(urlDeOembed(new URL('https://constroad.com/obra'))).toBeNull();
    expect(urlDeOembed(new URL('https://www.instagram.com/reel/C9nX1lJyQ3Q/'))).toBeNull();
  });
});

describe('vistaDeOembed', () => {
  it('título, autor como descripción, miniatura y que es un video', () => {
    const json = { title: 'Protejo tu realidad', author_name: 'Alegrin', thumbnail_url: 'https://i.ytimg.com/vi/vRDDH3QUcwk/hq2.jpg', provider_name: 'YouTube' };
    expect(vistaDeOembed(json, 'https://youtube.com/shorts/vRDDH3QUcwk')).toEqual({ url: 'https://youtube.com/shorts/vRDDH3QUcwk', titulo: 'Protejo tu realidad', descripcion: 'Alegrin', imagen: 'https://i.ytimg.com/vi/vRDDH3QUcwk/hq2.jpg', sitio: 'YouTube', video: true });
  });
  it('sin título no hay tarjeta; una miniatura que no es http(s) se descarta', () => {
    expect(vistaDeOembed({ provider_name: 'TikTok' }, 'https://www.tiktok.com/x')).toBeNull();
    expect(vistaDeOembed({ title: 'Hola', thumbnail_url: 'javascript:alert(1)', provider_name: 'TikTok' }, 'https://www.tiktok.com/x')?.imagen).toBeUndefined();
  });
  it('lo que no es un objeto no rompe', () => {
    expect(vistaDeOembed('x', 'https://youtu.be/a')).toBeNull();
    expect(vistaDeOembed(null, 'https://youtu.be/a')).toBeNull();
  });
});

describe('agenteParaHost', () => {
  it('Instagram, Facebook y TikTok reciben al robot de Facebook; el resto, el nuestro', () => {
    for (const host of ['www.instagram.com', 'instagram.com', 'www.facebook.com', 'm.facebook.com', 'fb.watch', 'www.tiktok.com', 'vm.tiktok.com']) expect(agenteParaHost(host)).toBe(AGENTE_DE_FACEBOOK);
    expect(agenteParaHost('constroad.com')).toMatch(/LilachatBot/);
    expect(agenteParaHost('notinstagram.com')).toMatch(/LilachatBot/);
  });

  it('Google Maps also gets it: to our robot it gives the generic «Google Maps» page, not the point or the place (pending 80)', () => {
    for (const host of ['www.google.com', 'maps.google.com', 'maps.app.goo.gl', 'goo.gl']) expect(agenteParaHost(host)).toBe(AGENTE_DE_FACEBOOK);
    expect(agenteParaHost('notgoogle.com')).toMatch(/LilachatBot/);
  });
});

describe('vistaDeMapas (pending 80)', () => {
  it('a Google Maps point loses the generic sales line, in Spanish or English, and its site says «Google Maps»; a place keeps its own line; other sites are untouched', () => {
    const point = { url: 'https://maps.app.goo.gl/x', sitio: '11°49\'45.8"S 76°37\'39.1"W', titulo: '11°49\'45.8"S 76°37\'39.1"W', descripcion: 'Busca negocios locales, consulta mapas y consigue información sobre rutas en Google Maps.', imagen: 'https://maps.google.com/maps/api/staticmap?center=1' };
    expect(vistaDeMapas(point, 'www.google.com')).toEqual({ url: point.url, sitio: 'Google Maps', titulo: point.titulo, imagen: point.imagen });
    expect(vistaDeMapas({ ...point, descripcion: 'Find local businesses, view maps and get driving directions in Google Maps.' }, 'maps.google.com').descripcion).toBeUndefined();
    expect(vistaDeMapas({ ...point, descripcion: '15555' }, 'www.google.com').descripcion).toBe('15555');
    expect(vistaDeMapas(point, 'example.com')).toBe(point);
  });
});
