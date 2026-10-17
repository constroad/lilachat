/**
 * Elegir CUÁNDO en avisos y eventos (17/10/2026). Puro: el selector solo
 * dibuja.
 *
 * Antes la única forma eran cuatro atajos relativos («En 3 horas», «Esta
 * noche» = ahora + 9 h). Ahora se elige día y hora exactos con el picker del
 * sistema, y los atajos quedan como lo que son —atajos— calculados en la hora
 * LOCAL del teléfono: «esta noche» es hoy a las 20:00.
 */
export type OpcionRapida = { id: 'hora' | 'noche' | 'manana' | 'finde'; etiqueta: string; fecha: Date };

const HORA_DE_LA_NOCHE = 20;
/** Pasada esta hora, «esta noche» ya no se ofrece: queda menos de una hora. */
const ULTIMA_HORA_PARA_LA_NOCHE = 19;
const HORA_DE_LA_MANANA = 9;
const HORA_DEL_FINDE = 10;
const SABADO = 6;
const HORA_MS = 3_600_000;

const enElDia = (base: Date, diasDespues: number, hora: number): Date =>
  new Date(base.getFullYear(), base.getMonth(), base.getDate() + diasDespues, hora, 0, 0, 0);

export function opcionesRapidas(ahora: Date): OpcionRapida[] {
  const opciones: OpcionRapida[] = [{ id: 'hora', etiqueta: 'En 1 hora', fecha: new Date(ahora.getTime() + HORA_MS) }];
  if (ahora.getHours() < ULTIMA_HORA_PARA_LA_NOCHE) {
    opciones.push({ id: 'noche', etiqueta: 'Esta noche', fecha: enElDia(ahora, 0, HORA_DE_LA_NOCHE) });
  }
  opciones.push({ id: 'manana', etiqueta: 'Mañana', fecha: enElDia(ahora, 1, HORA_DE_LA_MANANA) });
  // El sábado que VIENE. En fin de semana, «este sábado» sería ambiguo (ya
  // pasó, o es hoy): se ofrece el de la semana siguiente con otro nombre.
  const hastaElSabado = (SABADO - ahora.getDay() + 7) % 7 || 7;
  const enFinde = ahora.getDay() === SABADO || ahora.getDay() === 0;
  opciones.push({
    id: 'finde',
    etiqueta: enFinde ? 'El próximo sábado' : 'Este sábado',
    fecha: enElDia(ahora, hastaElSabado, HORA_DEL_FINDE),
  });
  return opciones;
}

/**
 * El picker de Android abre de a un modo: el día conserva la hora elegida y
 * la hora conserva el día. Sin segundos: «a las 7:30» es 7:30:00.
 */
export function combinarFecha(previo: Date, elegido: Date, modo: 'date' | 'time'): Date {
  const nuevo = new Date(previo);
  if (modo === 'date') nuevo.setFullYear(elegido.getFullYear(), elegido.getMonth(), elegido.getDate());
  else nuevo.setHours(elegido.getHours(), elegido.getMinutes(), 0, 0);
  return nuevo;
}

/** Al crear, la próxima hora en punto; al editar, lo guardado. */
export function valorInicial(guardado: string | undefined, ahora: Date): Date {
  const fecha = guardado ? new Date(guardado) : null;
  if (fecha && !Number.isNaN(fecha.getTime())) return fecha;
  const proxima = new Date(ahora);
  proxima.setHours(ahora.getHours() + 1, 0, 0, 0);
  return proxima;
}
