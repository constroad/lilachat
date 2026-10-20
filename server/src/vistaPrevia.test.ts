import { describe, expect, it } from 'vitest';
import { esDireccionPrivada, leerMetadatos, urlPublica } from './vistaPrevia.js';

/**
 * José, 18/10: «cuando comparto un link en un chat no genera la tarjeta, como
 * sí lo hace WhatsApp con el SEO». El server lee las etiquetas `og:` de la
 * página y el chat las dibuja.
 */
describe('leerMetadatos', () => {
  const base = 'https://lilastore.constroad.com/app/lilachat';

  it('lee título, descripción, imagen y sitio de las etiquetas og', () => {
    const html = `<html><head>
      <meta property="og:title" content="Lilachat">
      <meta property="og:description" content="Chat de Constroad &amp; familia">
      <meta property="og:image" content="/icono.png">
      <meta property="og:site_name" content="LilaStore">
    </head></html>`;

    expect(leerMetadatos(html, base)).toEqual({
      url: base,
      titulo: 'Lilachat',
      descripcion: 'Chat de Constroad & familia',
      imagen: 'https://lilastore.constroad.com/icono.png',
      sitio: 'LilaStore',
    });
  });

  it('un video (og:type video.* u og:video) lleva la marca para el botón de play (20/10)', () => {
    const reel = `<head><meta property="og:title" content="Reel"><meta property="og:type" content="video.other"></head>`;
    const conVideo = `<head><meta property="og:title" content="Clip"><meta property="og:video" content="https://x.pe/v.mp4"></head>`;
    const articulo = `<head><meta property="og:title" content="Nota"><meta property="og:type" content="article"></head>`;
    expect(leerMetadatos(reel, base)?.video).toBe(true);
    expect(leerMetadatos(conVideo, base)?.video).toBe(true);
    expect(leerMetadatos(articulo, base)?.video).toBeUndefined();
  });

  it('sin og, usa twitter, <title> y la descripción común; el sitio es el dominio', () => {
    const html = `<head><title> Menú del día </title>
      <meta name="description" content="Almuerzos a 15 soles">
      <meta name="twitter:image" content="https://cdn.x.pe/a.jpg"></head>`;

    expect(leerMetadatos(html, 'https://www.lila.pe/almuerzo')).toEqual({
      url: 'https://www.lila.pe/almuerzo',
      titulo: 'Menú del día',
      descripcion: 'Almuerzos a 15 soles',
      imagen: 'https://cdn.x.pe/a.jpg',
      sitio: 'lila.pe',
    });
  });

  it('el orden de los atributos no importa', () => {
    const html = `<meta content="Al revés" property="og:title">`;
    expect(leerMetadatos(html, base)?.titulo).toBe('Al revés');
  });

  it('sin título no hay tarjeta', () => {
    expect(leerMetadatos('<html><body>hola</body></html>', base)).toBeNull();
  });

  it('una imagen que no es http(s) se descarta', () => {
    const html = `<meta property="og:title" content="X"><meta property="og:image" content="javascript:alert(1)">`;
    expect(leerMetadatos(html, base)?.imagen).toBeUndefined();
  });

  it('recorta textos largos', () => {
    const html = `<meta property="og:title" content="${'a'.repeat(400)}"><meta property="og:description" content="${'b'.repeat(900)}">`;
    const vista = leerMetadatos(html, base)!;
    expect(vista.titulo.length).toBeLessThanOrEqual(160);
    expect(vista.descripcion!.length).toBeLessThanOrEqual(300);
  });
});

/** SSRF: el server no puede ser la puerta a la red interna de la mini. */
describe('esDireccionPrivada', () => {
  it.each(['127.0.0.1', '10.0.0.5', '172.16.3.1', '172.31.255.255', '192.168.1.10', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fc00::1', 'fd12::3', 'fe80::1', '::ffff:127.0.0.1', '::'])(
    '%s es privada',
    (ip) => expect(esDireccionPrivada(ip)).toBe(true)
  );

  it.each(['8.8.8.8', '172.32.0.1', '104.21.3.4', '2606:4700:3033::6815:1d5', '::ffff:8.8.8.8'])('%s es pública', (ip) =>
    expect(esDireccionPrivada(ip)).toBe(false)
  );
});

describe('urlPublica', () => {
  it('acepta http y https en sus puertos de siempre', () => {
    expect(urlPublica('https://lila.pe/almuerzo?x=1')?.hostname).toBe('lila.pe');
    expect(urlPublica('http://lila.pe:80/')?.hostname).toBe('lila.pe');
  });

  it.each([
    'ftp://lila.pe/',
    'file:///etc/passwd',
    'https://user:clave@lila.pe/',
    'https://lila.pe:8443/',
    'https://127.0.0.1/',
    'http://[::1]/',
    'http://localhost/',
    'no es una url',
  ])('rechaza %s', (url) => expect(urlPublica(url)).toBeNull());
});
