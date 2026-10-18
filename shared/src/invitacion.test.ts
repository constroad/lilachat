import { describe, expect, it } from 'vitest';
import { ENLACE_DE_DESCARGA, enlaceDeWhatsapp, mensajeDeInvitacion, nombreDePila, validarInvitacion } from './invitacion.js';

/**
 * Invitar tiene que ADMITIR, no solo compartir un enlace.
 *
 * El 26/08/2026 Wilson instaló Lilachat y no pudo entrar: ni por WhatsApp ni por
 * correo le llegaba el código. La causa no era el envío — el server **no manda
 * nada** a un número que no tenga una admisión previa, y contesta 200 igual para
 * no revelar quién existe (anti-enumeración, deliberado).
 *
 * El botón «Invitar» compartía el enlace de descarga y **nunca creaba la
 * invitación**. La persona instalaba la app y quedaba afuera para siempre, sin
 * que el sistema pudiera decirle por qué.
 */
describe('validarInvitacion', () => {
  it('un celular peruano se acepta, normalizado', () => {
    expect(validarInvitacion({ telefono: '+51 999 111 222', yoSoy: '999000111' })).toEqual({
      ok: true,
      phone: '999111222',
    });
  });

  it('el formato de la agenda no importa', () => {
    expect(validarInvitacion({ telefono: '999-111-222', yoSoy: '999000111' })).toEqual({
      ok: true,
      phone: '999111222',
    });
  });

  it('algo que no es un celular se rechaza', () => {
    expect(validarInvitacion({ telefono: 'no soy un número', yoSoy: '999000111' }).ok).toBe(false);
  });

  it('vacío se rechaza', () => {
    expect(validarInvitacion({ telefono: '', yoSoy: '999000111' }).ok).toBe(false);
  });

  /**
   * Invitarse a uno mismo no crea nada útil y sí crea una fila rara: quien ya
   * está adentro no necesita admisión.
   */
  it('no me puedo invitar a mí mismo', () => {
    const salida = validarInvitacion({ telefono: '+51999000111', yoSoy: '999000111' });

    expect(salida.ok).toBe(false);
    expect(salida.ok === false && salida.motivo).toMatch(/tuyo|mismo/i);
  });

  /**
   * Un fijo de Lima (7 dígitos) no puede recibir WhatsApp ni entrar: aceptarlo
   * crearía una admisión que nunca va a servir para nada.
   */
  it('un número que no es celular se rechaza', () => {
    expect(validarInvitacion({ telefono: '014567890', yoSoy: '999000111' }).ok).toBe(false);
  });
});

/**
 * El mensaje de WhatsApp (FL13, José 18/10: «se sigue mostrando feo»). Antes eran
 * cinco líneas con dos pasos numerados y dos enlaces pelados. Ahora es UNA frase
 * con UN enlace al final, como la invitación de Pulso: WhatsApp arma la tarjeta
 * con la vista previa de la ficha de LilaStore y el texto no compite con ella.
 */
describe('mensajeDeInvitacion', () => {
  it('saluda por el nombre de pila y termina en el enlace', () => {
    const mensaje = mensajeDeInvitacion({ para: 'Ana Torres' });
    expect(mensaje.startsWith('Hola Ana, ')).toBe(true);
    expect(mensaje.endsWith(ENLACE_DE_DESCARGA)).toBe(true);
  });

  it('una sola línea y un solo enlace: la tarjeta de WhatsApp sale del primero', () => {
    const mensaje = mensajeDeInvitacion({ para: 'Ana' });
    expect(mensaje).not.toContain('\n');
    expect(mensaje.match(/https?:\/\//g)).toHaveLength(1);
  });

  it('corto: se lee entero sin «Leer más»', () => {
    expect(mensajeDeInvitacion({ para: 'Maximiliano Fernández' }).length).toBeLessThanOrEqual(140);
  });

  it('en tuteo, sin voseo', () => {
    const mensaje = mensajeDeInvitacion({ para: 'Ana' });
    expect(mensaje).not.toMatch(/Instalá|Descargá|Bajá|vos\b/);
  });

  it('sin nombre (o con un número de agenda) el saludo sigue teniendo sentido', () => {
    expect(mensajeDeInvitacion({ para: null }).startsWith('Hola, ')).toBe(true);
    expect(mensajeDeInvitacion({ para: '+51 987 654 321' }).startsWith('Hola, ')).toBe(true);
    expect(mensajeDeInvitacion({ para: '' })).not.toMatch(/undefined|null/);
  });

  it('un enlace propio reemplaza al de siempre', () => {
    expect(mensajeDeInvitacion({ para: 'Ana', enlace: 'https://x.test/d' }).endsWith('https://x.test/d')).toBe(true);
  });
});

describe('nombreDePila', () => {
  it('la primera palabra con letras', () => {
    expect(nombreDePila('Ana Torres')).toBe('Ana');
    expect(nombreDePila('  María José  ')).toBe('María');
    expect(nombreDePila('Ñato')).toBe('Ñato');
  });

  it('un teléfono, vacío o nada: no hay nombre', () => {
    expect(nombreDePila('+51 987 654 321')).toBeNull();
    expect(nombreDePila('')).toBeNull();
    expect(nombreDePila(null)).toBeNull();
    expect(nombreDePila(undefined)).toBeNull();
  });
});

/**
 * Invitar desde un contacto abre WhatsApp EN EL CHAT de esa persona, con el
 * mensaje escrito (FL13). Con el menú de compartir había que elegir WhatsApp
 * y después buscar otra vez a la persona.
 */
describe('enlaceDeWhatsapp', () => {
  it('celular peruano: código de país y el mensaje codificado', () => {
    expect(enlaceDeWhatsapp('+51 987 654 321', 'Hola Ana, ¿vienes?')).toBe(
      'https://wa.me/51987654321?text=Hola%20Ana%2C%20%C2%BFvienes%3F'
    );
  });

  it('el formato de la agenda no importa', () => {
    expect(enlaceDeWhatsapp('987-654-321', 'x')).toBe('https://wa.me/51987654321?text=x');
  });

  it('un número que no es celular peruano no arma enlace: se comparte por el menú', () => {
    expect(enlaceDeWhatsapp('01 234 5678', 'x')).toBeNull();
    expect(enlaceDeWhatsapp('', 'x')).toBeNull();
  });
});
