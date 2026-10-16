import { describe, expect, it } from 'vitest';
import { correrSubida, respuestaDeStatus, type PuertoDeSubida, type ResultadoDeSubida } from './subida.js';
import type { AsientoDelLibro, Condiciones, ElementoDelRollo, Huella } from './tipos.js';

/**
 * El corredor de subidas con todo inyectado: rollo, libro, huella, red. Lo
 * que se fija son las REGLAS de la corrida —qué se sube, qué se anota, cuándo
 * se para— sin tocar el teléfono ni el server.
 */
const AHORA = Date.UTC(2026, 8, 14, 12, 0, 0);
const ideales: Condiciones = { cargando: true, wifi: true, wifiMedido: false, bateriaPct: 80 };

/** Lo que una app agrega por encima de `ElementoDelRollo` (Lilafotos: el `uri` del MediaStore). */
type ElementoLocal = ElementoDelRollo & { uri: string };

const elemento = (id: string, extra: Partial<ElementoLocal> = {}): ElementoLocal => ({
  id,
  nombre: `${id}.jpg`,
  bytes: 1_000,
  capturadoEn: AHORA - Number(id.replace(/\D/g, '') || 0) * 3_600_000,
  modificadoEn: AHORA - 3_600_000,
  uri: `file:///dcim/${id}.jpg`,
  ...extra,
});

const huellaDe = (id: string): Huella => id.padEnd(64, '0');

class PuertoFalso implements PuertoDeSubida<ElementoLocal> {
  rolloActual: ElementoLocal[] = [];
  libroActual = new Map<string, AsientoDelLibro>();
  enServer = new Set<Huella>();
  respuestasDeSubida = new Map<string, Awaited<ReturnType<PuertoDeSubida<ElementoLocal>['subir']>>>();
  subidos: string[] = [];
  hasheados: string[] = [];
  sinRespuesta = false;
  reloj = AHORA;

  async rollo() { return this.rolloActual; }
  async libro() { return this.libroActual; }
  async anotar(asiento: AsientoDelLibro) { this.libroActual.set(asiento.id, asiento); }
  async completar(elemento: ElementoLocal) { return elemento; }
  async huellaDe(elemento: ElementoLocal) {
    this.hasheados.push(elemento.id);
    return { huella: huellaDe(elemento.id), bytes: elemento.bytes };
  }
  async huellasQueFaltan(huellas: Huella[]) {
    if (this.sinRespuesta) return null;
    return new Set(huellas.filter((h) => !this.enServer.has(h)));
  }
  async subir(elemento: ElementoLocal, huella: Huella) {
    this.subidos.push(elemento.id);
    const forzada = this.respuestasDeSubida.get(elemento.id);
    if (forzada) return forzada;
    this.enServer.add(huella);
    return 'guardado' as const;
  }
  ahora() { return this.reloj; }
}

const correr = (puerto: PuertoFalso, extra: Partial<Parameters<typeof correrSubida<ElementoLocal>>[1]> = {}): Promise<ResultadoDeSubida> =>
  correrSubida(puerto, { condiciones: ideales, forzado: false, presupuestoMs: 60_000, ...extra });

describe('correrSubida', () => {
  it('sin condiciones no toca el rollo y dice por qué', async () => {
    const puerto = new PuertoFalso();
    puerto.rolloActual = [elemento('a1')];

    const resultado = await correr(puerto, { condiciones: { ...ideales, cargando: false } });

    expect(resultado).toMatchObject({ detenidoPor: 'sin_carga', subidos: 0 });
    expect(puerto.hasheados).toEqual([]);
  });

  it('sube lo pendiente más nuevo primero y lo anota en el libro', async () => {
    const puerto = new PuertoFalso();
    puerto.rolloActual = [elemento('a3'), elemento('a1'), elemento('a2')];

    const resultado = await correr(puerto);

    expect(puerto.subidos).toEqual(['a1', 'a2', 'a3']);
    expect(resultado).toMatchObject({ subidos: 3, yaEstaban: 0, detenidoPor: null, pendientesRestantes: 0 });
    expect(puerto.libroActual.get('a2')).toMatchObject({ huella: huellaDe('a2'), subidoEn: AHORA });
  });

  /** Lo que el server ya tiene no gasta datos (Lilafotos spec §6): se anota sin subir. */
  it('lo que el server ya tiene se anota sin subir bytes', async () => {
    const puerto = new PuertoFalso();
    puerto.rolloActual = [elemento('a1'), elemento('a2')];
    puerto.enServer.add(huellaDe('a2'));

    const resultado = await correr(puerto);

    expect(puerto.subidos).toEqual(['a1']);
    expect(resultado).toMatchObject({ subidos: 1, yaEstaban: 1 });
    expect(puerto.libroActual.has('a2')).toBe(true);
  });

  it('lo que el libro conoce igual no se vuelve a hashear', async () => {
    const puerto = new PuertoFalso();
    const viejo = elemento('a1');
    puerto.rolloActual = [viejo, elemento('a2')];
    puerto.libroActual.set('a1', { id: 'a1', huella: huellaDe('a1'), bytes: viejo.bytes, modificadoEn: viejo.modificadoEn, subidoEn: 1 });

    await correr(puerto);

    expect(puerto.hasheados).toEqual(['a2']);
  });

  /** Si no se pudo preguntar, no se afirma nada ni se sube a ciegas: se para y se dice. */
  it('sin respuesta del server se detiene sin anotar nada', async () => {
    const puerto = new PuertoFalso();
    puerto.rolloActual = [elemento('a1')];
    puerto.sinRespuesta = true;

    const resultado = await correr(puerto);

    expect(resultado).toMatchObject({ detenidoPor: 'sin_respuesta', subidos: 0, pendientesRestantes: 1 });
    expect(puerto.libroActual.size).toBe(0);
  });

  it('con el disco ausente se detiene: lo demás queda pendiente', async () => {
    const puerto = new PuertoFalso();
    puerto.rolloActual = [elemento('a1'), elemento('a2')];
    puerto.respuestasDeSubida.set('a1', 'disco_ausente');

    const resultado = await correr(puerto);

    expect(resultado).toMatchObject({ detenidoPor: 'disco_ausente', subidos: 0, pendientesRestantes: 2 });
    expect(puerto.subidos).toEqual(['a1']);
  });

  /**
   * Anti-wedge (skill `rn-app-loop` §5): un elemento que el server rechaza
   * para siempre se salta con motivo visible; no bloquea a los demás.
   */
  it('un rechazo definitivo se salta y se informa; el resto sigue', async () => {
    const puerto = new PuertoFalso();
    puerto.rolloActual = [elemento('a1'), elemento('a2')];
    puerto.respuestasDeSubida.set('a1', 'rechazado');

    const resultado = await correr(puerto);

    expect(puerto.subidos).toEqual(['a1', 'a2']);
    expect(resultado.fallidos).toEqual([{ id: 'a1', motivo: 'rechazado' }]);
    expect(resultado.subidos).toBe(1);
    expect(puerto.libroActual.has('a1')).toBe(false);
  });

  /** El archivo cambió entre hashear y mandar: se vuelve a intentar UNA vez con la huella nueva. */
  it('huella_no_coincide reintenta una vez y después se rinde', async () => {
    const puerto = new PuertoFalso();
    puerto.rolloActual = [elemento('a1')];
    puerto.respuestasDeSubida.set('a1', 'huella_no_coincide');

    const resultado = await correr(puerto);

    expect(puerto.subidos).toEqual(['a1', 'a1']);
    expect(resultado.fallidos).toEqual([{ id: 'a1', motivo: 'huella_no_coincide' }]);
  });

  /** El worker tiene diez minutos: cuando el presupuesto se acaba se para limpio y lo demás queda para la próxima. */
  it('respeta el presupuesto de tiempo', async () => {
    const puerto = new PuertoFalso();
    puerto.rolloActual = [elemento('a1'), elemento('a2'), elemento('a3')];
    puerto.subir = async function (this: PuertoFalso, elemento, huella) {
      this.reloj += 40_000;
      this.subidos.push(elemento.id);
      this.enServer.add(huella);
      return 'guardado' as const;
    };

    const resultado = await correr(puerto, { presupuestoMs: 50_000 });

    expect(puerto.subidos).toEqual(['a1', 'a2']);
    expect(resultado).toMatchObject({ detenidoPor: 'presupuesto', subidos: 2, pendientesRestantes: 1 });
  });

  it('informa el progreso por elemento', async () => {
    const puerto = new PuertoFalso();
    puerto.rolloActual = [elemento('a1'), elemento('a2')];
    const fases: string[] = [];

    await correr(puerto, { onProgreso: (p) => fases.push(`${p.fase}:${p.elemento.id}:${p.indice}/${p.total}`) });

    expect(fases).toEqual(['hasheando:a1:1/2', 'hasheando:a2:2/2', 'subiendo:a1:1/2', 'subiendo:a2:2/2']);
  });

  it('forzado saltea la carga', async () => {
    const puerto = new PuertoFalso();
    puerto.rolloActual = [elemento('a1')];

    const resultado = await correr(puerto, { condiciones: { ...ideales, cargando: false }, forzado: true });

    expect(resultado.subidos).toBe(1);
  });
});

describe('respuestaDeStatus', () => {
  it('traduce cada status del server a lo que la corrida entiende', () => {
    expect(respuestaDeStatus(201)).toBe('guardado');
    expect(respuestaDeStatus(200)).toBe('ya_existe');
    expect(respuestaDeStatus(422)).toBe('huella_no_coincide');
    expect(respuestaDeStatus(507)).toBe('disco_ausente');
    expect(respuestaDeStatus(401)).toBe('sin_sesion');
    expect(respuestaDeStatus(400)).toBe('rechazado');
  });

  /** Un 5xx o un 0 (sin conexión) NO es un rechazo: se reintenta después, no se descarta el archivo. */
  it('los fallos del server y la falta de red son «sin respuesta», no rechazo', () => {
    expect(respuestaDeStatus(503)).toBe('sin_respuesta');
    expect(respuestaDeStatus(502)).toBe('sin_respuesta');
    expect(respuestaDeStatus(524)).toBe('sin_respuesta');
    expect(respuestaDeStatus(0)).toBe('sin_respuesta');
  });
});
