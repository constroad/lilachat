import { accionesDeMiembro, puedeAgregar, puedeEditarInfo, type AccionDeMiembro } from '@lilachat/shared';
import { groupSubtitle } from '@lilachat/shared';
import type { DetalleDelChat, MiembroDelChat } from '../useDetalleDelChat';
import type { ChatSummary } from '../types';

/**
 * Qué muestra el panel «Info.» (W3b, diseño `w3-web-info-grupo.png`) y qué
 * deja tocar. Las reglas son las MISMAS que decide el server (`shared`): la
 * pantalla pregunta, no opina aparte.
 */
export type MiembroEnInfo = MiembroDelChat & { acciones: AccionDeMiembro[] };
export type VistaDeInfo = {
  titulo: string;
  subtitulo: string;
  puedeEditar: boolean;
  puedeAgregar: boolean;
  miembros: MiembroEnInfo[];
  puedeSalir: boolean;
  puedeEliminar: boolean;
};

const TITULOS: Record<ChatSummary['kind'], string> = { group: 'Info. del grupo', direct: 'Info. del contacto', notas: 'Info. del borrador' };
/** Un id que no es de nadie: `puedeAgregar` solo pregunta si yo puedo sumar. */
const ALGUIEN_NUEVO = '__nuevo__';

/** Yo primero, después los admins y el resto por nombre (como WhatsApp). */
const orden = (a: MiembroDelChat, b: MiembroDelChat) =>
  Number(b.esYo) - Number(a.esYo) || Number(b.rol === 'admin') - Number(a.rol === 'admin') || a.nombre.localeCompare(b.nombre, 'es');

export function armarInfo(params: { chat: ChatSummary; detalle: DetalleDelChat | null; yo: string }): VistaDeInfo {
  const { chat, detalle, yo } = params;
  const esGrupo = chat.kind === 'group';
  const lista = [...(detalle?.miembros.values() ?? [])];
  const reglas = lista.map((uno) => ({ userId: uno.id, role: uno.rol }));
  const otro = lista.find((uno) => !uno.esYo);
  const subtitle = esGrupo ? groupSubtitle(lista.length) : chat.kind === 'notas' ? 'Solo tú lo ves' : otro?.telefono ?? chat.phone ?? '';
  return {
    titulo: TITULOS[chat.kind],
    subtitulo: subtitle,
    puedeEditar: Boolean(detalle) && puedeEditarInfo({ quien: yo, miembros: reglas, esGrupo: chat.kind !== 'direct' }).ok,
    puedeAgregar: esGrupo && Boolean(detalle) && puedeAgregar({ quien: yo, miembros: reglas, aQuien: ALGUIEN_NUEVO, esGrupo }).ok,
    miembros: esGrupo
      ? lista.sort(orden).map((uno) => ({ ...uno, acciones: accionesDeMiembro({ quien: yo, aQuien: uno.id, miembros: reglas, esGrupo, esApp: uno.app === true }) }))
      : [],
    puedeSalir: esGrupo,
    puedeEliminar: !esGrupo,
  };
}
