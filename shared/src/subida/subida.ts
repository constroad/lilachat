import { asientoTrasSubida, conciliarRollo } from './conciliarRollo.js';
import { armarLote, ordenarParaSubir, puedeSubirAhora } from './planDeSubida.js';
import type { AsientoDelLibro, Condiciones, ElementoDelRollo, Huella, Libro, MotivoDeEspera } from './tipos.js';

/**
 * Una corrida de subida: conciliar → ordenar → lote → hashear → preguntar →
 * subir → anotar. Corre igual desde el botón «Subir ahora» y desde la tarea
 * de fondo; la diferencia es el presupuesto y si está forzada.
 *
 * Todo lo que toca el teléfono o la red entra por `PuertoDeSubida`, así la
 * corrida entera se prueba en Jest o Vitest en milisegundos.
 *
 * Nació en Lilafotos (`app/nucleo/subida.ts`); copiada a Lilachat
 * el 15/09/2026, genérica en `E` para que cada app pase su propio elemento
 * (Lilafotos: el del MediaStore con `uri`; Lilachat: el archivo de respaldo).
 */
export type RespuestaDeSubida =
  | 'guardado'
  | 'ya_existe'
  | 'huella_no_coincide'
  | 'rechazado'
  | 'sin_respuesta'
  | 'disco_ausente'
  | 'sin_sesion';

export interface PuertoDeSubida<E extends ElementoDelRollo> {
  rollo(): Promise<E[]>;
  libro(): Promise<Libro>;
  anotar(asiento: AsientoDelLibro): Promise<void>;
  /** Completa lo que falte saber antes de hashear (en Lilafotos, bytes y URI local). */
  completar(elemento: E): Promise<E>;
  huellaDe(elemento: E): Promise<{ huella: Huella; bytes: number }>;
  /** `null` = no se pudo preguntar. */
  huellasQueFaltan(huellas: Huella[]): Promise<Set<Huella> | null>;
  subir(elemento: E, huella: Huella): Promise<RespuestaDeSubida>;
  ahora(): number;
}

export type MotivoDeDetencion =
  | MotivoDeEspera
  | 'sin_respuesta'
  | 'disco_ausente'
  | 'sin_sesion'
  | 'presupuesto'
  | 'pausado';

export type Progreso<E extends ElementoDelRollo> = {
  fase: 'hasheando' | 'subiendo';
  elemento: E;
  indice: number;
  total: number;
};

export type ResultadoDeSubida = {
  subidos: number;
  yaEstaban: number;
  fallidos: Array<{ id: string; motivo: 'rechazado' | 'huella_no_coincide' }>;
  detenidoPor: MotivoDeDetencion | null;
  pendientesRestantes: number;
};

export type OpcionesDeSubida<E extends ElementoDelRollo> = {
  condiciones: Condiciones;
  forzado: boolean;
  presupuestoMs: number;
  onProgreso?: (progreso: Progreso<E>) => void;
  /** «Pausar»: se consulta entre elemento y elemento; nunca se corta uno a medias. */
  cancelado?: () => boolean;
};

type Hasheado<E> = { elemento: E; huella: Huella };

export async function correrSubida<E extends ElementoDelRollo>(
  puerto: PuertoDeSubida<E>,
  opciones: OpcionesDeSubida<E>
): Promise<ResultadoDeSubida> {
  const resultado: ResultadoDeSubida = {
    subidos: 0,
    yaEstaban: 0,
    fallidos: [],
    detenidoPor: null,
    pendientesRestantes: 0,
  };
  const veredicto = puedeSubirAhora(opciones.condiciones, { forzado: opciones.forzado });

  const [rollo, libro] = await Promise.all([puerto.rollo(), puerto.libro()]);
  const pendientes = ordenarParaSubir(conciliarRollo(rollo, libro).pendientes);
  resultado.pendientesRestantes = pendientes.length;
  if (!veredicto.puede) return { ...resultado, detenidoPor: veredicto.motivo };
  if (pendientes.length === 0) return resultado;

  const inicio = puerto.ahora();
  const quedaTiempo = () => puerto.ahora() - inicio < opciones.presupuestoMs && !opciones.cancelado?.();
  const lote = armarLote(pendientes);

  const hasheados = await hashearLote(puerto, lote, opciones, quedaTiempo);
  if (hasheados.length === 0) return { ...resultado, detenidoPor: 'presupuesto' };

  const faltan = await puerto.huellasQueFaltan(hasheados.map((h) => h.huella));
  if (faltan === null) return { ...resultado, detenidoPor: 'sin_respuesta' };

  for (const [indice, { elemento, huella }] of hasheados.entries()) {
    if (!quedaTiempo()) {
      resultado.detenidoPor = opciones.cancelado?.() ? 'pausado' : 'presupuesto';
      break;
    }
    opciones.onProgreso?.({ fase: 'subiendo', elemento, indice: indice + 1, total: hasheados.length });
    const detencion = await subirUno(puerto, elemento, huella, faltan.has(huella), resultado);
    if (detencion) {
      resultado.detenidoPor = detencion;
      break;
    }
  }
  resultado.pendientesRestantes = pendientes.length - resultado.subidos - resultado.yaEstaban;
  return resultado;
}

async function hashearLote<E extends ElementoDelRollo>(
  puerto: PuertoDeSubida<E>,
  lote: E[],
  opciones: OpcionesDeSubida<E>,
  quedaTiempo: () => boolean
): Promise<Hasheado<E>[]> {
  const hasheados: Hasheado<E>[] = [];
  for (const [indice, crudo] of lote.entries()) {
    if (!quedaTiempo()) break;
    opciones.onProgreso?.({ fase: 'hasheando', elemento: crudo, indice: indice + 1, total: lote.length });
    const elemento = await puerto.completar(crudo);
    const { huella, bytes } = await puerto.huellaDe(elemento);
    hasheados.push({ elemento: { ...elemento, bytes: bytes || elemento.bytes }, huella });
  }
  return hasheados;
}

/** Devuelve el motivo de detención si la corrida no puede seguir; `null` si se sigue con el próximo. */
async function subirUno<E extends ElementoDelRollo>(
  puerto: PuertoDeSubida<E>,
  elemento: E,
  huella: Huella,
  faltaEnServer: boolean,
  resultado: ResultadoDeSubida
): Promise<MotivoDeDetencion | null> {
  if (!faltaEnServer) {
    await puerto.anotar(asientoTrasSubida(elemento, huella, puerto.ahora()));
    resultado.yaEstaban += 1;
    return null;
  }
  let respuesta = await puerto.subir(elemento, huella);
  if (respuesta === 'huella_no_coincide') {
    // El archivo cambió entre hashear y mandar (una edición): UNA vez más con la huella nueva.
    const nueva = await puerto.huellaDe(elemento);
    huella = nueva.huella;
    respuesta = await puerto.subir(elemento, huella);
  }
  switch (respuesta) {
    case 'guardado':
    case 'ya_existe':
      await puerto.anotar(asientoTrasSubida(elemento, huella, puerto.ahora()));
      if (respuesta === 'guardado') resultado.subidos += 1;
      else resultado.yaEstaban += 1;
      return null;
    case 'rechazado':
    case 'huella_no_coincide':
      // Anti-wedge: lo que el server rechaza para siempre no bloquea a los demás.
      resultado.fallidos.push({ id: elemento.id, motivo: respuesta });
      return null;
    case 'sin_respuesta':
    case 'disco_ausente':
    case 'sin_sesion':
      return respuesta;
  }
}

/**
 * PURA: el status del server → lo que la corrida entiende. Es el reverso del
 * contrato del `PUT` (201 guardado · 200 ya_existe · 422 huella_no_coincide ·
 * 507 disco ausente o colgado · 401 sin sesión). Un 5xx o un 0 (sin red) NO
 * es un rechazo: se reintenta después, no se descarta el archivo.
 */
export function respuestaDeStatus(status: number): RespuestaDeSubida {
  if (status === 201) return 'guardado';
  if (status === 200) return 'ya_existe';
  if (status === 422) return 'huella_no_coincide';
  if (status === 507) return 'disco_ausente';
  if (status === 401) return 'sin_sesion';
  if (status === 0 || status >= 500) return 'sin_respuesta';
  return 'rechazado';
}
