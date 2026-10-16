import { nombreDeContacto } from '@lilachat/shared';

export type MiembroConNombre = { id: string; name: string | null; phone: string | null };

/**
 * El nombre con que se muestra cada miembro de un grupo (FL3): gana TU agenda,
 * después el nombre que se puso en Lilachat, y si no hay nada el teléfono.
 * Mismo criterio que la lista y la cabecera, para que «Mamá» sea «Mamá» en
 * todos lados.
 */
export function nombresPorMiembro(
  miembros: readonly MiembroConNombre[],
  agenda: ReadonlyMap<string, string>
): Map<string, string> {
  const nombres = new Map<string, string>();
  for (const miembro of miembros) {
    const nombre = nombreDeContacto({ delServidor: miembro.name, telefono: miembro.phone, agenda });
    nombres.set(miembro.id, nombre || miembro.phone || 'Alguien');
  }
  return nombres;
}
