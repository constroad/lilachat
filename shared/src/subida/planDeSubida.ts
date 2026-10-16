import {
  BATERIA_MINIMA_SIN_CABLE_PCT,
  ESPERA_MAXIMA_HORAS,
  LOTE_MAX_BYTES,
  LOTE_MAX_ELEMENTOS,
} from './constantes.js';
import type { Condiciones, ElementoDelRollo, MotivoDeEspera, Veredicto } from './tipos.js';

/**
 * Qué se sube y cuándo (Lilafotos spec §5; copiado a Lilachat
 * el 15/09/2026 para que Lilachat use las mismas reglas).
 *
 * La regla que define la app: si el trabajo puede esperar, espera. Una foto
 * del mediodía se sube a las dos de la mañana, cargando y con wifi, cuando el
 * sistema quiera. WorkManager aplica las condiciones por su cuenta; esto es
 * la misma decisión, en un lugar testeable, para el botón «Subir ahora» y
 * para explicarle al usuario por qué no está subiendo.
 */

const MINUTO_MS = 60_000;
const HORA_MS = 60 * MINUTO_MS;
const DIA_MS = 24 * HORA_MS;

/**
 * `forzado` es el usuario tocando «Subir ahora»: saltea la carga y el wifi
 * medido, que son decisiones suyas. Nunca saltea la falta de wifi —datos
 * móviles, jamás— ni la batería crítica sin cable.
 */
export function puedeSubirAhora(
  condiciones: Condiciones,
  opciones: { forzado?: boolean } = {}
): Veredicto {
  const forzado = opciones.forzado ?? false;
  if (!condiciones.wifi) return espera('sin_wifi');
  if (condiciones.wifiMedido && !forzado) return espera('wifi_medido');
  if (!condiciones.cargando && !forzado) return espera('sin_carga');
  if (!condiciones.cargando && bateriaCritica(condiciones.bateriaPct)) return espera('bateria_baja');
  return { puede: true };
}

const espera = (motivo: MotivoDeEspera): Veredicto => ({ puede: false, motivo });

const bateriaCritica = (pct: number | null): boolean =>
  pct !== null && pct < BATERIA_MINIMA_SIN_CABLE_PCT;

/**
 * Lo más nuevo primero: es lo que el usuario acaba de sacar y lo que mira
 * cuando abre la app para ver si «ya está». Todo lo pendiente corre el mismo
 * riesgo; el orden se elige por lo que se percibe. Empate por id para que dos
 * corridas den el mismo orden.
 */
export function ordenarParaSubir<E extends ElementoDelRollo>(pendientes: readonly E[]): E[] {
  return [...pendientes].sort(
    (a, b) => b.capturadoEn - a.capturadoEn || a.id.localeCompare(b.id)
  );
}

/**
 * Lo que cabe en una corrida del worker. Un PREFIJO del orden: saltear un
 * video pesado para meter fotos chicas rompería «lo nuevo primero». Un
 * elemento que solo ya excede el tope va igual —solo—, o un video de 3 GB no
 * se subiría nunca.
 */
export function armarLote<E extends ElementoDelRollo>(
  ordenados: readonly E[],
  topes: { maxElementos?: number; maxBytes?: number } = {}
): E[] {
  const maxElementos = topes.maxElementos ?? LOTE_MAX_ELEMENTOS;
  const maxBytes = topes.maxBytes ?? LOTE_MAX_BYTES;
  const lote: E[] = [];
  let bytes = 0;

  for (const elemento of ordenados) {
    if (lote.length >= maxElementos) break;
    if (lote.length > 0 && bytes + elemento.bytes > maxBytes) break;
    lote.push(elemento);
    bytes += elemento.bytes;
  }
  return lote;
}

/** Una fecha en el futuro (reloj adelantado) cuenta como ahora: nunca «hace -3 min». */
export function haceCuanto(desde: number, ahora: number): string {
  const transcurrido = Math.max(0, ahora - desde);
  if (transcurrido < MINUTO_MS) return 'hace un momento';
  if (transcurrido < HORA_MS) return `hace ${Math.floor(transcurrido / MINUTO_MS)} min`;
  if (transcurrido < DIA_MS) return `hace ${Math.floor(transcurrido / HORA_MS)} h`;
  return `hace ${Math.floor(transcurrido / DIA_MS)} d`;
}

const UNIDADES = ['B', 'KB', 'MB', 'GB', 'TB'] as const;
const BASE = 1000;

/** Base 1000, como el Finder y los ajustes de Android: el número que el usuario compara. */
export function bytesLegibles(bytes: number): string {
  let valor = bytes;
  let indice = 0;
  while (valor >= BASE && indice < UNIDADES.length - 1) {
    valor /= BASE;
    indice += 1;
  }
  const texto = indice === 0 ? String(valor) : valor.toFixed(1).replace('.0', '').replace('.', ',');
  return `${texto} ${UNIDADES[indice]}`;
}

const FRASE_DE_ESPERA: Record<MotivoDeEspera, string> = {
  sin_wifi: 'Esperando wifi',
  wifi_medido: 'El wifi tiene datos medidos',
  sin_carga: 'Esperando que el teléfono cargue',
  bateria_baja: 'Batería baja',
};

export type EstadoVisible = {
  titulo: string;
  detalle: string;
  /** Algo lleva demasiado esperando: el backup dejó de andar y hay que decirlo. */
  alerta: boolean;
};

/**
 * Lo que la pantalla muestra siempre (spec §5): cuántas quedan y por qué
 * esperan. Un backup que dejó de funcionar en silencio es indistinguible de
 * uno que anda; la alerta es la diferencia.
 *
 * La alerta mira cuánto lleva esperando lo más viejo, por su fecha de
 * modificación en el teléfono —no la de captura: una foto recibida hoy por
 * WhatsApp trae la fecha de quien la sacó, y no lleva días esperando.
 */
export function resumenDeEstado(entrada: {
  pendientes: readonly ElementoDelRollo[];
  ultimaSubidaEn: number | null;
  ahora: number;
  veredicto: Veredicto;
}): EstadoVisible {
  const { pendientes, ultimaSubidaEn, ahora, veredicto } = entrada;
  if (pendientes.length === 0) {
    const detalle =
      ultimaSubidaEn === null ? 'Todavía no se subió nada' : `Última subida ${haceCuanto(ultimaSubidaEn, ahora)}`;
    return { titulo: 'Todo respaldado', detalle, alerta: false };
  }

  const bytes = pendientes.reduce((total, elemento) => total + elemento.bytes, 0);
  const masViejo = Math.min(...pendientes.map((elemento) => elemento.modificadoEn));
  return {
    titulo: `${pendientes.length} por subir · ${bytesLegibles(bytes)}`,
    detalle: veredicto.puede ? 'Listo para subir' : FRASE_DE_ESPERA[veredicto.motivo],
    alerta: ahora - masViejo > ESPERA_MAXIMA_HORAS * HORA_MS,
  };
}
