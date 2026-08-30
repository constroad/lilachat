import type { AccionDeMiembro } from '@lilachat/shared';

/**
 * Qué dice el diálogo antes de cada acción sobre un participante.
 *
 * Es texto, no lógica, y por eso vive aparte: son las únicas acciones de la
 * pantalla que le cambian algo a OTRA persona, y **dos de las tres no las puede
 * deshacer quien las hace** —al nombrar admin ya no se lo podés quitar, y al
 * renunciar te tiene que nombrar otro—. Ese detalle tiene que estar en el
 * diálogo: un «¿estás seguro?» a secas no informa nada.
 */
export type Confirmacion = {
  titulo: string;
  cuerpo: string;
  boton: string;
  /** Lo que va a la API: método y qué mandar. */
  metodo: 'PATCH' | 'DELETE';
  cuerpoHttp?: { role: 'admin' | 'member' };
};

export function confirmacionDe(accion: AccionDeMiembro, nombre: string): Confirmacion {
  if (accion === 'hacer-admin') {
    return {
      titulo: `¿Nombrar admin a ${nombre}?`,
      cuerpo:
        'Va a poder sumar y sacar gente. Ojo: después NO se lo podés quitar — solo esa persona puede dejar de ser admin.',
      boton: 'Nombrar',
      metodo: 'PATCH',
      cuerpoHttp: { role: 'admin' },
    };
  }
  if (accion === 'dejar-admin') {
    return {
      titulo: '¿Dejar de ser admin?',
      cuerpo:
        'Seguís en el grupo, pero sin poder sumar ni sacar gente. Para volver a serlo te tiene que nombrar otro admin.',
      boton: 'Dejar',
      metodo: 'PATCH',
      cuerpoHttp: { role: 'member' },
    };
  }
  return {
    titulo: `¿Sacar a ${nombre}?`,
    cuerpo:
      'Va a dejar de ver el grupo y los mensajes nuevos. Los que ya mandó quedan. Podés volver a sumarlo cuando quieras.',
    boton: 'Sacar',
    metodo: 'DELETE',
  };
}
