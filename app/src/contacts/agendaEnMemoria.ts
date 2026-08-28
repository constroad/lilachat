// **`expo-contacts/legacy` y NO la raíz.** En la 57 la raíz expone la API nueva
// (`Contact`, `getPermissionsAsync`) pero NO `getContactsAsync` ni `Fields`:
// llamarlos ahí devuelve `undefined` y revienta al leer `Fields.PhoneNumbers`.
// Ese fue el bug de los esqueletos eternos del 26/08/2026.
import * as Contacts from 'expo-contacts/legacy';
import { indexarAgendaPorTelefono, type ContactoDeAgenda } from '@lilachat/shared';
import { reportarError } from '../ui/reportarError';
import { resolverEstadoAgenda } from './estadoAgenda';
import { aplanarAgenda } from './aplanarAgenda';

/**
 * La agenda del teléfono, leída UNA vez y guardada en memoria.
 *
 * José, 27/08/2026: «cuando doy click al lápiz ya me debería aparecer precargado
 * los contactos y no recién allí ponerme a cargar, eso da una experiencia de
 * lentitud de la app».
 *
 * Tenía razón y el problema era estructural: la lectura vivía dentro del hook,
 * así que empezaba **cuando se montaba la pantalla** — es decir, en el momento
 * exacto en que la persona ya está mirando y esperando. Y como cada pantalla que
 * necesita contactos monta su propio hook, los 600 y pico de la agenda se leían
 * de nuevo en «nuevo chat», en «evento» y en «encuesta».
 *
 * Acá la lectura se hace una vez, apenas hay sesión, mientras la persona mira la
 * lista de chats. Cuando toca el lápiz los datos ya están: la pantalla abre con
 * la lista puesta en vez de con esqueletos.
 *
 * **Lo que todavía NO hace:** sobrevivir al cierre de la app. En un arranque en
 * frío la primera lectura sigue costando. Guardarla en disco es el siguiente
 * paso y va cifrada —una agenda en claro en el almacenamiento es exactamente lo
 * que `cacheCifrada.ts` existe para evitar—.
 */
export type EstadoAgendaCruda =
  | { estado: 'cargando' }
  | { estado: 'denegado' }
  | { estado: 'error'; mensaje: string }
  | { estado: 'listo'; agenda: ContactoDeAgenda[] };

let permiso: 'concedido' | 'denegado' | null = null;
let agenda: ContactoDeAgenda[] | null = null;
let fallo: string | null = null;

/**
 * La promesa en curso.
 *
 * Es lo que vuelve idempotente a `precargarAgenda()`: tres pantallas montando a
 * la vez se suman a la MISMA lectura en lugar de disparar tres. Sin esto el
 * almacén compartido no arreglaría nada — solo movería las tres lecturas de
 * lugar.
 */
let enCurso: Promise<void> | null = null;

const oyentes = new Set<() => void>();

function avisar(): void {
  for (const oyente of oyentes) oyente();
}

/** El estado actual, ya resuelto. Se recalcula solo cuando algo cambió. */
let instantanea: EstadoAgendaCruda = { estado: 'cargando' };

function recalcular(): void {
  instantanea = resolverEstadoAgenda({ permiso, agenda, fallo }) as EstadoAgendaCruda;
  avisar();
}

export function estadoDeAgenda(): EstadoAgendaCruda {
  return instantanea;
}

export function suscribirAgenda(oyente: () => void): () => void {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

/**
 * Empieza a leer la agenda si no se leyó ya. No espera a nadie.
 *
 * Se llama al entrar a la app. **Pide el permiso de contactos ahí**, que es un
 * cambio de comportamiento visible: antes el diálogo aparecía al tocar el lápiz.
 * Se acepta a conciencia — el permiso hay que pedirlo en algún momento, y
 * pedirlo mientras la persona mira sus chats interrumpe menos que pedirlo justo
 * cuando quiere escribirle a alguien.
 */
export function precargarAgenda(): Promise<void> {
  if (enCurso) return enCurso;

  enCurso = (async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        permiso = 'denegado';
        return;
      }
      permiso = 'concedido';

      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
      });
      agenda = aplanarAgenda(data);
    } catch (error) {
      // **Se guarda el mensaje, no se traga.** Antes esto dejaba el estado en
      // `null` y la pantalla mostraba esqueletos para siempre.
      reportarError('precargarAgenda', error);
      fallo = error instanceof Error ? error.message : String(error);
    } finally {
      recalcular();
    }
  })();

  return enCurso;
}

/**
 * Al cerrar sesión la agenda se olvida.
 *
 * Otro teléfono, otra persona: dejarla cargada haría que quien entre después vea
 * los contactos del anterior en «invitar».
 */
export function olvidarAgenda(): void {
  permiso = null;
  agenda = null;
  fallo = null;
  enCurso = null;
  instantanea = { estado: 'cargando' };
  indiceCacheado = null;
  avisar();
}

/**
 * La agenda indexada por teléfono, para resolver nombres de contacto.
 *
 * Se memoiza sobre la MISMA lista: `nombreDeContacto` se llama una vez por fila
 * de la lista de chats y por cada mensaje que llega, y reconstruir un `Map` de
 * 600 entradas en cada llamada sería peor que el problema que resuelve.
 */
let indiceCacheado: { fuente: ContactoDeAgenda[]; indice: Map<string, string> } | null = null;

/**
 * El vacío es UNA instancia compartida, no un `new Map()` por llamada.
 *
 * `useSyncExternalStore` compara por referencia: devolver un mapa nuevo cada vez
 * se lee como «cambió» en cada render y la app entra en bucle. Es el mismo pozo
 * que ya tiene su comentario en `estadoDeAgenda()`, y lo pisé igual escribiendo
 * esta función.
 */
const VACIO: ReadonlyMap<string, string> = new Map();

export function agendaPorTelefono(): ReadonlyMap<string, string> {
  if (instantanea.estado !== 'listo') return VACIO;
  if (indiceCacheado?.fuente === instantanea.agenda) return indiceCacheado.indice;

  const indice = indexarAgendaPorTelefono(instantanea.agenda);
  indiceCacheado = { fuente: instantanea.agenda, indice };
  return indice;
}
