import { describe, expect, it } from 'vitest';
import { confirmacionDe } from './confirmacionesDeMiembro';

/** What the confirmation says before acting on a member. */
describe('confirmacionDe', () => {
  it('taking out an app says it does not come back on its own, and how it comes back (pending 91)', () => {
    const app = confirmacionDe('sacar', 'Inframaq', true);
    expect(app).toMatchObject({ titulo: '¿Quitar Inframaq del canal?', boton: 'Quitar', metodo: 'DELETE' });
    expect(app.cuerpo).toMatch(/no vuelve sola/);
  });

  it('a person is still taken out of the group', () => {
    expect(confirmacionDe('sacar', 'Ana')).toMatchObject({ titulo: '¿Sacar a Ana?', boton: 'Sacar', metodo: 'DELETE' });
  });
});
