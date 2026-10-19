import { beforeEach, describe, expect, it } from 'vitest';
import { olvidarCache } from './cacheLocal';

describe('olvidarCache — la caché vieja de localStorage', () => {
  beforeEach(() => localStorage.clear());

  it('borra la lista y los mensajes guardados por la web vieja', () => {
    localStorage.setItem('lilachat.chats', '[]');
    localStorage.setItem('lilachat.msgs.c1', '[]');

    olvidarCache();

    expect(localStorage.getItem('lilachat.chats')).toBeNull();
    expect(localStorage.getItem('lilachat.msgs.c1')).toBeNull();
  });

  it('no toca la credencial ni el id del dispositivo', () => {
    localStorage.setItem('lilachat.perfil', '{}');
    localStorage.setItem('lilachat.deviceId', 'd1');

    olvidarCache({ alSalir: true });

    expect(localStorage.getItem('lilachat.perfil')).toBe('{}');
    expect(localStorage.getItem('lilachat.deviceId')).toBe('d1');
  });
});

describe('olvidarCache — los emojis recientes', () => {
  beforeEach(() => localStorage.clear());

  it('al abrir se conservan', () => {
    localStorage.setItem('epr_suggested', '[]');
    olvidarCache();
    expect(localStorage.getItem('epr_suggested')).toBe('[]');
  });

  it('al cerrar sesión se borran: no se heredan en un navegador compartido', () => {
    localStorage.setItem('epr_suggested', '[]');
    olvidarCache({ alSalir: true });
    expect(localStorage.getItem('epr_suggested')).toBeNull();
  });
});
