import { describe, expect, it } from 'vitest';
import { updateLockContent } from './updateLock';

const notes = [
  { version: '0.1.136', versionCode: 137, notas: '• Llamadas también desde la computadora\n• Mis tareas con colores por fecha\n\n- Completa tu perfil sin esperas' },
  { version: '0.1.135', versionCode: 136, notas: 'Algo de antes' },
];

/** The screen that blocks a version under the minimum (backlog 32; design `u-01-actualizacion-obligatoria`). */
describe('update lock content', () => {
  it('says which version is installed and which one is new, with the newest notes as lines', () => {
    expect(updateLockContent({ installed: '0.1.118', latest: '0.1.136', novedades: notes, size: 36_528_125 })).toEqual({
      body: 'Esta versión (0.1.118) ya no se puede usar. La nueva es la 0.1.136.',
      notesTitle: 'Novedades de la 0.1.136',
      notes: ['Llamadas también desde la computadora', 'Mis tareas con colores por fecha', 'Completa tu perfil sin esperas'],
      source: 'Se descarga desde LilaStore · 35 MB',
    });
  });

  it('without notes or size it says less, never something made up', () => {
    const content = updateLockContent({ installed: '', latest: '0.1.136', novedades: [], size: 0 });
    expect(content.body).toBe('Esta versión ya no se puede usar. La nueva es la 0.1.136.');
    expect(content.notes).toEqual([]);
    expect(content.source).toBe('Se descarga desde LilaStore');
  });

  it('at most five notes: it is a reason to update, not the changelog', () => {
    const long = { version: '0.1.136', versionCode: 137, notas: Array.from({ length: 9 }, (_, index) => `Cambio ${index + 1}`).join('\n') };
    expect(updateLockContent({ installed: '0.1.1', latest: '0.1.136', novedades: [long], size: 0 }).notes).toHaveLength(5);
  });
});
