import { describe, expect, it } from 'vitest';
import { CALL_MENU, chatMenuOptions } from './chatHeaderMenu';

/** José, 21/10: the ⋮ opened the same as the avatar; WhatsApp's has options. */
describe('chat header menu', () => {
  it('a group: add members, info, media, search and mute', () => {
    expect(chatMenuOptions({ kind: 'group', muted: false }).map((option) => option.label)).toEqual(['Agregar miembros', 'Info del grupo', 'Medios del grupo', 'Buscar', 'Silenciar notificaciones']);
  });

  it('a channel says channel', () => {
    expect(chatMenuOptions({ kind: 'channel', muted: false }).map((option) => option.label)).toEqual(['Agregar miembros', 'Info del canal', 'Medios del canal', 'Buscar', 'Silenciar notificaciones']);
  });

  it('a 1:1: the contact, its media, search and mute', () => {
    expect(chatMenuOptions({ kind: 'direct', muted: false }).map((option) => option.id)).toEqual(['info', 'media', 'search', 'mute']);
    expect(chatMenuOptions({ kind: 'direct', muted: false })[0]!.label).toBe('Ver contacto');
  });

  it('muted, it offers to turn the notifications back on', () => {
    expect(chatMenuOptions({ kind: 'direct', muted: true }).at(-1)).toEqual({ id: 'unmute', label: 'Activar notificaciones' });
  });

  it('notes to myself have nothing to mute and nobody to add', () => {
    expect(chatMenuOptions({ kind: 'notes', muted: false }).map((option) => option.id)).toEqual(['info', 'media', 'search']);
  });

  it('the call menu: voice, video, scheduling and a link, like the camera with its arrow in WhatsApp (pending 42)', () => {
    expect(CALL_MENU.map((option) => option.label)).toEqual(['Llamada de voz', 'Videollamada', 'Programar llamada', 'Crear enlace de llamada']);
  });
});
