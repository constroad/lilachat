import { groupContactsByLetter, type Contact, type ContactGroup } from './contacts.js';

/**
 * A quién se puede sumar a un grupo. PURO.
 *
 * José, 29/08/2026: «implementá agregar miembros desde un contacto nuevo».
 *
 * Sumar gente ya funcionaba, pero la hoja para elegir listaba **solo con quien
 * ya tenías una conversación abierta**. Alguien de tu agenda que está en
 * Lilachat y con quien nunca hablaste no aparecía por ningún lado: para sumarlo
 * al grupo había que abrirle antes un chat 1:1 que nadie quería. La lista buena
 * ya existía —la del lápiz, que cruza la agenda con el padrón— y lo único que le
 * faltaba era descontar a los que ya están adentro.
 */
export function candidatosParaSumar(params: {
  /** Los contactos que puedo ver, ya agrupados por letra. */
  registrados: ContactGroup[];
  /** Los ids de quienes YA están en el chat. */
  yaEstan: readonly string[];
}): {
  /** Los que se pueden elegir: sin los que ya están, y sin letras vacías. */
  paraSumar: ContactGroup[];
  /**
   * TODOS los registrados, sin recortar — incluidos los que ya están en el
   * grupo.
   *
   * Es lo que hay que pasarle al cruce con la agenda del teléfono: quien ya
   * está en el grupo obviamente tiene Lilachat, así que con la lista recortada
   * reaparecería abajo en «Invitar a Lilachat», ofreciéndole instalar la app que
   * está usando.
   */
  registrados: Contact[];
} {
  const dentro = new Set(params.yaEstan);
  const todos = params.registrados.flatMap((grupo) => grupo.contacts);

  return {
    // Se reagrupa en vez de filtrar cada grupo: así una letra que se queda sin
    // nadie desaparece con su cabecera, en lugar de dejar una «W» sobre la nada.
    paraSumar: groupContactsByLetter(todos.filter((uno) => !dentro.has(uno.id))),
    registrados: todos,
  };
}
