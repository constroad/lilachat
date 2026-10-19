import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

/**
 * Las vinculaciones por QR en curso (W5, spec §54.4), EN MEMORIA.
 *
 * No van a la base a propósito: duran a lo sumo 5 minutos, y si el server se
 * reinicia la web pide otra sin que nadie lo note. Una colección exigiría un
 * índice TTL en la bóveda, que no crea índices sola.
 *
 * - La web recibe `id` + `clave` (privada, nunca sale de esa pestaña) y un
 *   `token` para el QR, que cambia cada 20 s y vence a los 60 s.
 * - El teléfono solo ve el token: con él consulta y aprueba.
 * - Solo quien tiene la clave canjea la aprobación, una sola vez.
 * - Se guardan hashes: un volcado de memoria no sirve para vincular nada.
 */
export const VIDA_DEL_TOKEN_MS = 60_000;
export const VIDA_DE_LA_VINCULACION_MS = 5 * 60_000;
const TOPE_POR_DEFECTO = 2_000;
/** Más de un par de esperas por vinculación es una pestaña repetida o un abuso. */
const ESPERAS_POR_VINCULACION = 3;
const BYTES_DEL_SECRETO = 32;

export type Aprobacion = { userId: string; aprobadoPor: string };
export type EstadoDeEspera = 'aprobada' | 'pendiente' | 'vencida';

type Vinculacion = {
  id: string;
  claveHash: Buffer;
  nombre: string;
  creadaEn: number;
  tokens: Map<string, number>;
  aprobacion: Aprobacion | null;
  esperas: Set<(estado: EstadoDeEspera) => void>;
};

const hash = (texto: string): Buffer => createHash('sha256').update(texto).digest();
const secretoAlAzar = (): string => randomBytes(BYTES_DEL_SECRETO).toString('base64url');

export function crearVinculaciones(opciones: { ahora?: () => number; tope?: number } = {}) {
  const ahora = opciones.ahora ?? Date.now;
  const tope = opciones.tope ?? TOPE_POR_DEFECTO;
  const porId = new Map<string, Vinculacion>();
  /** hash del token → id de la vinculación. */
  const porToken = new Map<string, string>();

  const vencida = (vinculacion: Vinculacion) => ahora() - vinculacion.creadaEn > VIDA_DE_LA_VINCULACION_MS;

  const borrar = (vinculacion: Vinculacion) => {
    porId.delete(vinculacion.id);
    for (const tokenHash of vinculacion.tokens.keys()) porToken.delete(tokenHash);
    for (const avisar of vinculacion.esperas) avisar('vencida');
  };

  const limpiar = () => {
    for (const vinculacion of porId.values()) if (vencida(vinculacion)) borrar(vinculacion);
  };

  const emitirToken = (vinculacion: Vinculacion): string => {
    for (const [tokenHash, emitido] of vinculacion.tokens) {
      if (ahora() - emitido > VIDA_DEL_TOKEN_MS) {
        vinculacion.tokens.delete(tokenHash);
        porToken.delete(tokenHash);
      }
    }
    const token = secretoAlAzar();
    const tokenHash = hash(token).toString('hex');
    vinculacion.tokens.set(tokenHash, ahora());
    porToken.set(tokenHash, vinculacion.id);
    return token;
  };

  /** La vinculación de ESA web (id + clave correctos y vigente), o `null`. */
  const deLaWeb = (id: string, clave: string): Vinculacion | null => {
    const vinculacion = porId.get(id);
    if (!vinculacion) return null;
    if (vencida(vinculacion)) return (borrar(vinculacion), null);
    return timingSafeEqual(hash(clave), vinculacion.claveHash) ? vinculacion : null;
  };

  /** La vinculación pendiente de un token vigente, o `null`. */
  const delToken = (token: string): Vinculacion | null => {
    const tokenHash = hash(token).toString('hex');
    const vinculacion = porId.get(porToken.get(tokenHash) ?? '');
    if (!vinculacion || vencida(vinculacion) || vinculacion.aprobacion) return null;
    const emitido = vinculacion.tokens.get(tokenHash) ?? 0;
    return ahora() - emitido > VIDA_DEL_TOKEN_MS ? null : vinculacion;
  };

  return {
    iniciar(nombre: string): { id: string; clave: string; token: string } | null {
      limpiar();
      if (porId.size >= tope) return null;
      const clave = secretoAlAzar();
      const vinculacion: Vinculacion = {
        id: randomUUID(),
        claveHash: hash(clave),
        nombre,
        creadaEn: ahora(),
        tokens: new Map(),
        aprobacion: null,
        esperas: new Set(),
      };
      porId.set(vinculacion.id, vinculacion);
      return { id: vinculacion.id, clave, token: emitirToken(vinculacion) };
    },

    rotar(id: string, clave: string): { token: string } | null {
      const vinculacion = deLaWeb(id, clave);
      if (!vinculacion || vinculacion.aprobacion) return null;
      return { token: emitirToken(vinculacion) };
    },

    consultar(token: string): { nombre: string } | null {
      const vinculacion = delToken(token);
      return vinculacion ? { nombre: vinculacion.nombre } : null;
    },

    aprobar(token: string, aprobacion: Aprobacion): { nombre: string } | null {
      const vinculacion = delToken(token);
      if (!vinculacion) return null;
      vinculacion.aprobacion = aprobacion;
      for (const avisar of vinculacion.esperas) avisar('aprobada');
      vinculacion.esperas.clear();
      return { nombre: vinculacion.nombre };
    },

    /** Espera (long-poll) a que el teléfono apruebe, hasta `ms`. */
    esperar(id: string, clave: string, ms: number): Promise<EstadoDeEspera> {
      const vinculacion = deLaWeb(id, clave);
      if (!vinculacion) return Promise.resolve('vencida');
      if (vinculacion.aprobacion) return Promise.resolve('aprobada');
      if (vinculacion.esperas.size >= ESPERAS_POR_VINCULACION) {
        const masVieja = vinculacion.esperas.values().next().value;
        masVieja?.('pendiente');
      }
      return new Promise((listo) => {
        const avisar = (estado: EstadoDeEspera) => {
          clearTimeout(reloj);
          vinculacion.esperas.delete(avisar);
          listo(estado);
        };
        const reloj = setTimeout(() => avisar('pendiente'), ms);
        vinculacion.esperas.add(avisar);
      });
    },

    /** La aprobación, UNA vez: después la vinculación deja de existir. */
    canjear(id: string, clave: string): { nombre: string; aprobacion: Aprobacion } | null {
      const vinculacion = deLaWeb(id, clave);
      if (!vinculacion?.aprobacion) return null;
      const { nombre, aprobacion } = vinculacion;
      borrar(vinculacion);
      return { nombre, aprobacion };
    },

    cantidad: (): number => porId.size,
  };
}

export type Vinculaciones = ReturnType<typeof crearVinculaciones>;
