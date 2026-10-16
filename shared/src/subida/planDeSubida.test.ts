import { describe, expect, it } from 'vitest';
import { ESPERA_MAXIMA_HORAS, LOTE_MAX_BYTES, LOTE_MAX_ELEMENTOS } from './constantes.js';
import {
  armarLote,
  bytesLegibles,
  haceCuanto,
  ordenarParaSubir,
  puedeSubirAhora,
  resumenDeEstado,
} from './planDeSubida.js';
import type { Condiciones, ElementoDelRollo } from './tipos.js';

/**
 * Qué se sube y cuándo (Lilafotos spec §5). La regla que define la app: si el trabajo
 * puede esperar, espera — cargando y con wifi. Y el estado tiene que ser
 * visible: un backup que dejó de andar en silencio es el error que ya costó
 * caro en Timón.
 */
const AHORA = Date.UTC(2026, 8, 1, 12, 0, 0);
const HORA = 3_600_000;

const ideales: Condiciones = { cargando: true, wifi: true, wifiMedido: false, bateriaPct: 80 };

const elemento = (extra: Partial<ElementoDelRollo> = {}): ElementoDelRollo => ({
  id: '1',
  nombre: 'IMG.jpg',
  bytes: 1_000_000,
  capturadoEn: AHORA - HORA,
  modificadoEn: AHORA - HORA,
  ...extra,
});

describe('puedeSubirAhora', () => {
  it('cargando y con wifi sin medir, sube', () => {
    expect(puedeSubirAhora(ideales)).toEqual({ puede: true });
  });

  /** Datos móviles, nunca: ni forzado. Es la promesa de la app. */
  it('sin wifi no sube, ni aunque el usuario lo fuerce', () => {
    const sinWifi = { ...ideales, wifi: false };

    expect(puedeSubirAhora(sinWifi)).toEqual({ puede: false, motivo: 'sin_wifi' });
    expect(puedeSubirAhora(sinWifi, { forzado: true })).toEqual({ puede: false, motivo: 'sin_wifi' });
  });

  /** Un wifi medido (un hotspot ajeno) espera solo; el usuario puede decidir usarlo. */
  it('wifi medido espera, salvo que se fuerce', () => {
    const medido = { ...ideales, wifiMedido: true };

    expect(puedeSubirAhora(medido)).toEqual({ puede: false, motivo: 'wifi_medido' });
    expect(puedeSubirAhora(medido, { forzado: true })).toEqual({ puede: true });
  });

  it('sin carga espera, salvo que se fuerce', () => {
    const sinCarga = { ...ideales, cargando: false };

    expect(puedeSubirAhora(sinCarga)).toEqual({ puede: false, motivo: 'sin_carga' });
    expect(puedeSubirAhora(sinCarga, { forzado: true })).toEqual({ puede: true });
  });

  /** Forzar con la batería al 10 % y sin cable es dejar el teléfono muerto a mitad de un video. */
  it('forzado con batería baja y sin cable, no', () => {
    const critica = { ...ideales, cargando: false, bateriaPct: 10 };

    expect(puedeSubirAhora(critica, { forzado: true })).toEqual({ puede: false, motivo: 'bateria_baja' });
  });

  it('batería baja pero cargando, sube', () => {
    expect(puedeSubirAhora({ ...ideales, bateriaPct: 5 })).toEqual({ puede: true });
  });

  it('batería desconocida no bloquea', () => {
    const desconocida = { ...ideales, cargando: false, bateriaPct: null };

    expect(puedeSubirAhora(desconocida, { forzado: true })).toEqual({ puede: true });
  });

  /** El motivo que se muestra es el que el usuario NO puede arreglar enchufando: primero la red. */
  it('con varios impedimentos, la red va primero', () => {
    const todoMal = { cargando: false, wifi: false, wifiMedido: true, bateriaPct: 5 };

    expect(puedeSubirAhora(todoMal)).toEqual({ puede: false, motivo: 'sin_wifi' });
  });
});

describe('ordenarParaSubir', () => {
  /**
   * Lo más nuevo primero: es lo que el usuario acaba de sacar y lo que mira
   * cuando abre la app para ver si «ya está». Todo lo pendiente corre el mismo
   * riesgo; el orden se elige por lo que se percibe.
   */
  it('lo más reciente va primero', () => {
    const vieja = elemento({ id: 'vieja', capturadoEn: AHORA - 3 * HORA });
    const nueva = elemento({ id: 'nueva', capturadoEn: AHORA - HORA });
    const media = elemento({ id: 'media', capturadoEn: AHORA - 2 * HORA });

    const orden = ordenarParaSubir([vieja, nueva, media]).map((unElemento) => unElemento.id);

    expect(orden).toEqual(['nueva', 'media', 'vieja']);
  });

  it('a igual fecha, el orden es estable por id', () => {
    const b = elemento({ id: 'b' });
    const a = elemento({ id: 'a' });

    expect(ordenarParaSubir([b, a]).map((unElemento) => unElemento.id)).toEqual(['a', 'b']);
  });

  it('no muta la lista de entrada', () => {
    const lista = [elemento({ id: 'b', capturadoEn: 1 }), elemento({ id: 'a', capturadoEn: 2 })];

    ordenarParaSubir(lista);

    expect(lista[0]?.id).toBe('b');
  });
});

describe('armarLote', () => {
  /**
   * El worker de Android tiene diez minutos; el lote es lo que cabe en una
   * corrida y el resto queda para la siguiente. Se toma un PREFIJO del orden:
   * saltear un video pesado para meter fotos chicas rompería «lo nuevo primero».
   */
  it('toma un prefijo hasta llenar el tope de bytes', () => {
    const lista = [
      elemento({ id: '1', bytes: 400 }),
      elemento({ id: '2', bytes: 400 }),
      elemento({ id: '3', bytes: 400 }),
    ];

    const lote = armarLote(lista, { maxElementos: 10, maxBytes: 1_000 });

    expect(lote.map((unElemento) => unElemento.id)).toEqual(['1', '2']);
  });

  it('respeta el tope de elementos', () => {
    const lista = [elemento({ id: '1' }), elemento({ id: '2' }), elemento({ id: '3' })];

    expect(armarLote(lista, { maxElementos: 2, maxBytes: Infinity })).toHaveLength(2);
  });

  /** Un video de 3 GB supera cualquier tope y aun así tiene que poder subirse: solo, pero sube. */
  it('un elemento que solo excede el tope va igual, solo', () => {
    const video = elemento({ id: 'video', bytes: 3_000_000_000 });
    const foto = elemento({ id: 'foto', bytes: 100 });

    const lote = armarLote([video, foto], { maxElementos: 10, maxBytes: 1_000 });

    expect(lote.map((unElemento) => unElemento.id)).toEqual(['video']);
  });

  it('con lista vacía el lote es vacío', () => {
    expect(armarLote([], { maxElementos: 10, maxBytes: 1_000 })).toEqual([]);
  });

  it('los topes por defecto son los del spec', () => {
    const lista = Array.from({ length: LOTE_MAX_ELEMENTOS + 5 }, (_, indice) =>
      elemento({ id: String(indice), bytes: 1 })
    );

    expect(armarLote(lista)).toHaveLength(LOTE_MAX_ELEMENTOS);
    expect(LOTE_MAX_BYTES).toBeGreaterThan(0);
  });
});

describe('haceCuanto', () => {
  it('habla en minutos, horas y días', () => {
    expect(haceCuanto(AHORA - 10_000, AHORA)).toBe('hace un momento');
    expect(haceCuanto(AHORA - 5 * 60_000, AHORA)).toBe('hace 5 min');
    expect(haceCuanto(AHORA - 3 * HORA, AHORA)).toBe('hace 3 h');
    expect(haceCuanto(AHORA - 49 * HORA, AHORA)).toBe('hace 2 d');
  });

  /** Un reloj del teléfono adelantado no puede producir «hace -3 min». */
  it('una fecha en el futuro cuenta como ahora', () => {
    expect(haceCuanto(AHORA + HORA, AHORA)).toBe('hace un momento');
  });
});

describe('bytesLegibles', () => {
  /** Base 1000, como el Finder y los ajustes de Android: el número que el usuario compara. */
  it('elige la unidad y usa coma decimal', () => {
    expect(bytesLegibles(0)).toBe('0 B');
    expect(bytesLegibles(950)).toBe('950 B');
    expect(bytesLegibles(2_048)).toBe('2 KB');
    expect(bytesLegibles(1_500_000)).toBe('1,5 MB');
    expect(bytesLegibles(6_950_000_000)).toBe('7 GB');
    expect(bytesLegibles(7_250_000_000)).toBe('7,3 GB');
  });
});

describe('resumenDeEstado', () => {
  const sinPendientes = { pendientes: [], ultimaSubidaEn: AHORA - 3 * HORA, ahora: AHORA };

  it('sin pendientes: todo respaldado, con la hora de la última subida', () => {
    const resumen = resumenDeEstado({ ...sinPendientes, veredicto: { puede: true } });

    expect(resumen).toEqual({
      titulo: 'Todo respaldado',
      detalle: 'Última subida hace 3 h',
      alerta: false,
    });
  });

  /** Un rollo vacío no es un backup roto. */
  it('sin pendientes y sin subidas nunca: no es una alerta', () => {
    const resumen = resumenDeEstado({ ...sinPendientes, ultimaSubidaEn: null, veredicto: { puede: true } });

    expect(resumen.alerta).toBe(false);
    expect(resumen.detalle).toBe('Todavía no se subió nada');
  });

  it('con pendientes dice cuántas, cuánto pesan y por qué espera', () => {
    const pendientes = [elemento({ bytes: 1_500_000 }), elemento({ id: '2', bytes: 1_500_000 })];

    const resumen = resumenDeEstado({
      pendientes,
      ultimaSubidaEn: AHORA - HORA,
      ahora: AHORA,
      veredicto: { puede: false, motivo: 'sin_carga' },
    });

    expect(resumen).toEqual({
      titulo: '2 por subir · 3 MB',
      detalle: 'Esperando que el teléfono cargue',
      alerta: false,
    });
  });

  it('una sola pendiente se dice en singular', () => {
    const resumen = resumenDeEstado({
      pendientes: [elemento()],
      ultimaSubidaEn: null,
      ahora: AHORA,
      veredicto: { puede: true },
    });

    expect(resumen.titulo).toBe('1 por subir · 1 MB');
    expect(resumen.detalle).toBe('Listo para subir');
  });

  it('cada motivo de espera tiene su frase', () => {
    const con = (motivo: 'sin_wifi' | 'wifi_medido' | 'bateria_baja') =>
      resumenDeEstado({
        pendientes: [elemento()],
        ultimaSubidaEn: null,
        ahora: AHORA,
        veredicto: { puede: false, motivo },
      }).detalle;

    expect(con('sin_wifi')).toBe('Esperando wifi');
    expect(con('wifi_medido')).toBe('El wifi tiene datos medidos');
    expect(con('bateria_baja')).toBe('Batería baja');
  });

  /**
   * LA señal del spec §5: algo lleva demasiado esperando. No es «hace cuánto
   * subió algo» —si no hay fotos nuevas, no hay nada que subir— sino cuánto
   * lleva esperando lo más viejo que falta.
   */
  it('alerta cuando lo más viejo pendiente lleva más de la espera máxima', () => {
    const vieja = elemento({ id: 'vieja', modificadoEn: AHORA - (ESPERA_MAXIMA_HORAS + 1) * HORA });
    const nueva = elemento({ id: 'nueva', capturadoEn: AHORA - HORA });

    const resumen = resumenDeEstado({
      pendientes: [nueva, vieja],
      ultimaSubidaEn: AHORA - HORA,
      ahora: AHORA,
      veredicto: { puede: false, motivo: 'sin_carga' },
    });

    expect(resumen.alerta).toBe(true);
  });

  it('no alerta si lo pendiente es reciente, aunque espere', () => {
    const resumen = resumenDeEstado({
      pendientes: [elemento({ modificadoEn: AHORA - HORA })],
      ultimaSubidaEn: null,
      ahora: AHORA,
      veredicto: { puede: false, motivo: 'sin_wifi' },
    });

    expect(resumen.alerta).toBe(false);
  });

  /**
   * Una foto recibida hoy por WhatsApp trae la fecha de captura de quien la
   * sacó, hace meses. No lleva meses esperando: lo que cuenta es desde cuándo
   * existe en el teléfono.
   */
  it('una captura vieja que recién llegó al teléfono no es una alerta', () => {
    const recienLlegada = elemento({ capturadoEn: AHORA - 90 * 24 * HORA, modificadoEn: AHORA - HORA });

    const resumen = resumenDeEstado({
      pendientes: [recienLlegada],
      ultimaSubidaEn: null,
      ahora: AHORA,
      veredicto: { puede: false, motivo: 'sin_carga' },
    });

    expect(resumen.alerta).toBe(false);
  });
});
