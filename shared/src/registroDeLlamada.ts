/**
 * La línea que una llamada deja en el chat (FL8.1), como en WhatsApp:
 * «Llamada perdida», «Llamada sin respuesta», «Llamada de voz · 02:13».
 *
 * Viaja como aviso del server (`kind: 'system'`, evento `llamada`) con un
 * `valor` compacto: `voz|video` y los segundos que duró, o `perdida` si nadie
 * contestó. La frase la arma cada teléfono porque cambia según quién mira: la
 * misma llamada es «perdida» para quien no contestó y «sin respuesta» para
 * quien llamó.
 */
export type RegistroDeLlamada = { video: boolean; segundos: number | null; /** A group call (pending 56): how many took part. */ personas?: number };

const PERDIDA = 'perdida';

export function valorDeLlamada(registro: RegistroDeLlamada): string {
  const tipo = registro.video ? 'video' : 'voz';
  const groupSuffix = registro.personas ? `:g${registro.personas}` : '';
  return `${tipo}:${registro.segundos === null ? PERDIDA : Math.max(0, Math.floor(registro.segundos))}${groupSuffix}`;
}

export function leerValorDeLlamada(valor: string | undefined): RegistroDeLlamada | null {
  const partes = /^(voz|video):(perdida|\d+)(?::g(\d+))?$/.exec(valor ?? '');
  if (!partes) return null;
  const registro: RegistroDeLlamada = { video: partes[1] === 'video', segundos: partes[2] === PERDIDA ? null : Number(partes[2]) };
  return partes[3] ? { ...registro, personas: Number(partes[3]) } : registro;
}

const dosDigitos = (n: number) => String(n).padStart(2, '0');

function duracion(segundos: number): string {
  const horas = Math.floor(segundos / 3600);
  const minutos = Math.floor((segundos % 3600) / 60);
  const resto = segundos % 60;
  return horas > 0 ? `${horas}:${dosDigitos(minutos)}:${dosDigitos(resto)}` : `${dosDigitos(minutos)}:${dosDigitos(resto)}`;
}

function contestada(registro: RegistroDeLlamada & { segundos: number }): string {
  if (registro.personas) return `${registro.video ? 'Videollamada' : 'Llamada'} grupal · ${registro.personas} ${registro.personas === 1 ? 'persona' : 'personas'} · ${duracion(registro.segundos)}`;
  return `${registro.video ? 'Videollamada' : 'Llamada de voz'} · ${duracion(registro.segundos)}`;
}

/** La frase en el teléfono. `esMio`: quien mira es quien llamó. */
export function textoDeLlamada(params: { valor: string | undefined; esMio: boolean }): string {
  const registro = leerValorDeLlamada(params.valor);
  if (!registro) return '';
  if (registro.segundos !== null) return contestada({ ...registro, segundos: registro.segundos });
  const tipo = registro.video ? 'Videollamada' : 'Llamada';
  return params.esMio ? `${tipo} sin respuesta` : `${tipo} perdida`;
}

/** El texto de respaldo (notificación y web), con el nombre que conoce el server. */
export function cuerpoDeLlamada(params: { valor: string; quien: string }): string {
  const registro = leerValorDeLlamada(params.valor);
  if (!registro) return '';
  if (registro.segundos !== null) return contestada({ ...registro, segundos: registro.segundos });
  return `${registro.video ? 'Videollamada' : 'Llamada'} perdida de ${params.quien}`;
}

/** A missed call FOR ME: someone called and I did not answer (it is not mine and has no length). */
export function isMissedCallForMe(params: { valor: string | undefined; esMio: boolean }): boolean {
  const registro = leerValorDeLlamada(params.valor);
  return Boolean(registro) && registro!.segundos === null && !params.esMio;
}

/** The title of «Recordarme devolverla» (backlog 23). */
export function callBackTitle(name: string): string {
  return name.trim() ? `Devolver la llamada a ${name.trim()}` : 'Devolver una llamada perdida';
}
