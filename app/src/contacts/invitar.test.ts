import { describe, expect, it } from 'vitest';
import { textoDeInvitacionFallida } from './invitar';

/**
 * José, 18/10: en «Nuevo chat» el botón «Invitar» «no hacía nada». El error
 * salía al pie de la lista, fuera de la pantalla. Ahora va debajo de la fila
 * tocada y dice a quién no se pudo invitar.
 */
describe('textoDeInvitacionFallida', () => {
  it('nombra a la persona y suma el motivo del server', () => {
    expect(textoDeInvitacionFallida('Aaron Alconze', 'Ese número no es un celular válido.')).toBe(
      'No se pudo invitar a Aaron. Ese número no es un celular válido.'
    );
  });

  it('sin motivo, invita a reintentar', () => {
    expect(textoDeInvitacionFallida('Abogada Diana')).toBe('No se pudo invitar a Abogada. Prueba de nuevo.');
  });

  it('si el nombre es un teléfono, lo usa entero', () => {
    expect(textoDeInvitacionFallida('940476916')).toBe('No se pudo invitar a 940476916. Prueba de nuevo.');
  });
});
