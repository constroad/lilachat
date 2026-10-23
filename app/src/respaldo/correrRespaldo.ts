import {
  armarRespaldoPorTrozos,
  conciliarRollo,
  correrSubida,
  type ContenidoDeRespaldo,
  type ResultadoDeSubida,
} from '@lilachat/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { reportBackupAttempt, type ChatSummary } from '../api/client';
import { hidratarTodo } from '../chat/hidratador';
import { leerTodosLosMensajes, resumenDelAlmacen } from '../chat/mensajesGuardados';
import { conservarSolo, escribirRespaldo, listarRespaldos } from './archivosDeRespaldo';
import { leerCondiciones } from './condicionesDelTelefono';
import { guardarEstadoDeRespaldo, leerEstadoDeRespaldo, type EstadoDeRespaldo } from './estadoDeRespaldo';
import { leerLibro } from './libroDeRespaldos';
import { leerPassphrase } from './passphraseDeRespaldo';
import { decidirCorrida, huellaDelAlmacen, motivoParaNoEmpezar, nombreDeRespaldo } from './planDeRespaldo';
import { puertoDeRespaldo } from './puertoDeRespaldo';
import { reportMissingKeyOncePerDay } from './missingKeyReport';

/**
 * Una corrida de respaldo (F12.1): completar el almacén → ¿hay algo nuevo? →
 * armar el archivo cifrado → subirlo con el corredor (`shared/subida`)
 * → dejar el estado visible. Corre igual desde «Respaldar ahora» y desde la
 * tarea de fondo; cambian `forzado` y el presupuesto.
 *
 * El orden importa: el hidratador va PRIMERO, para que el archivo sea la
 * conversación entera y no lo que el teléfono tenía a mano.
 */
export type ResultadoDeCorrida = {
  estado: EstadoDeRespaldo;
  subida: ResultadoDeSubida | null;
};

export async function correrRespaldo(params: {
  jwt: string;
  telefono: string;
  chats: readonly Pick<ChatSummary, 'id' | 'lastSeq'>[];
  forzado: boolean;
  presupuestoMs: number;
  /** Se consulta entre pasos: al cerrar sesión o pausar, la corrida para limpia. */
  sigue?: () => boolean;
}): Promise<ResultadoDeCorrida> {
  const sigue = params.sigue ?? (() => true);
  const inicio = Date.now();
  try {
    const passphrase = await leerPassphrase();
    if (!passphrase) {
      // Pending 83: without this the server cannot tell «no key yet» from «the disk was not there».
      void reportMissingKeyOncePerDay({ storage: AsyncStorage, report: () => reportBackupAttempt(params.jwt, 'sin_passphrase') });
      return { estado: await guardarEstadoDeRespaldo({ ultimaCorridaEn: inicio, decision: 'sin_passphrase', fallo: null }), subida: null };
    }

    const condiciones = await leerCondiciones();
    const detenidoPor = motivoParaNoEmpezar({ forzado: params.forzado, condiciones });
    if (detenidoPor) {
      return { estado: await guardarEstadoDeRespaldo({ ultimaCorridaEn: inicio, detenidoPor, fallo: null }), subida: null };
    }

    await hidratarTodo(params.chats, params.jwt, sigue);

    const [resumen, estadoPrevio, libro] = await Promise.all([resumenDelAlmacen(), leerEstadoDeRespaldo(), leerLibro()]);
    const huella = huellaDelAlmacen(resumen);
    const sinSubir = conciliarRollo(listarRespaldos(), libro).pendientes.length;
    const decision = decidirCorrida({
      hayPassphrase: true,
      hayCambios: huella !== estadoPrevio.huellaRespaldada && huella !== estadoPrevio.huellaPendiente,
      archivosSinSubir: sinSubir,
    });

    if (decision === 'al_dia') {
      return { estado: await guardarEstadoDeRespaldo({ ultimaCorridaEn: inicio, decision, detenidoPor: null, fallo: null }), subida: null };
    }

    if (decision === 'armar') {
      const contenido = await armarContenido(params.telefono, resumen.map((chat) => chat.chatId));
      const nombre = nombreDeRespaldo(new Date());
      // Por trozos y cediendo el hilo (FL5): con 20 000 mensajes, el sobre
      // único congelaba la pantalla si la corrida era «Respaldar ahora».
      escribirRespaldo(nombre, JSON.stringify(await armarRespaldoPorTrozos(passphrase, contenido)));
      // El teléfono guarda UN respaldo: el nuevo reemplaza al que hubiera.
      conservarSolo(nombre);
      await guardarEstadoDeRespaldo({ huellaPendiente: huella });
    }

    if (!sigue()) return { estado: await leerEstadoDeRespaldo(), subida: null };

    const subida = await correrSubida(puertoDeRespaldo(params.jwt), {
      // Se vuelve a leer: hidratar y armar pudieron tardar minutos.
      condiciones: await leerCondiciones(),
      forzado: params.forzado,
      presupuestoMs: Math.max(0, params.presupuestoMs - (Date.now() - inicio)),
      cancelado: () => !sigue(),
    });

    const subio = subida.subidos > 0 || subida.yaEstaban > 0;
    const estado = await guardarEstadoDeRespaldo({
      ultimaCorridaEn: inicio,
      decision,
      detenidoPor: subida.detenidoPor,
      fallo: subida.fallidos.length > 0 ? `El server rechazó el archivo (${subida.fallidos[0]!.motivo}).` : null,
      ...(subio
        ? {
            ultimoRespaldoEn: Date.now(),
            bytesDelUltimo: listarRespaldos()[0]?.bytes ?? null,
            huellaRespaldada: (await leerEstadoDeRespaldo()).huellaPendiente ?? huella,
            huellaPendiente: null,
          }
        : {}),
    });
    return { estado, subida };
  } catch (error) {
    const fallo = error instanceof Error ? error.message : 'No se pudo respaldar.';
    return { estado: await guardarEstadoDeRespaldo({ ultimaCorridaEn: inicio, fallo }), subida: null };
  }
}

/** La copia del almacén, chat por chat, en la forma que cifra `armarRespaldoPorTrozos`. */
async function armarContenido(telefono: string, chatIds: readonly string[]): Promise<ContenidoDeRespaldo> {
  const chats: ContenidoDeRespaldo['chats'] = [];
  for (const chatId of chatIds) {
    chats.push({ chatId, mensajes: (await leerTodosLosMensajes(chatId)) ?? [] });
  }
  return { v: 1, creadoEn: new Date().toISOString(), telefono, chats };
}
