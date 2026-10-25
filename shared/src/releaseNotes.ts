/**
 * What is new in each version (pending 66, José 23/10), like WhatsApp Web's
 * «What's new»: shown once after updating, in the app and on the web. The
 * same catalog writes the notes published to LilaStore. Newest first. PURE.
 */
/**
 * Who a version is for (José, 24/10: someone with only personal chats should
 * not update for a company-mode change, and vice versa):
 * `spaces` only matters to who is in a company space, `personal` to who has
 * personal chats; without it, everyone.
 */
export type ReleaseAudience = 'all' | 'personal' | 'spaces';
export type ReleaseNote = { version: string; items: readonly string[]; audience?: ReleaseAudience };

/** At most this many versions at once, for someone who skipped several. */
const MAX_VERSIONS_SHOWN = 3;

export const RELEASE_NOTES: readonly ReleaseNote[] = [
  {
    version: '0.1.170',
    // Everyone: the person card works in personal chats and in spaces.
    audience: 'all',
    items: [
      'Toca el nombre o la foto de una persona para ver su ficha: «Enviar mensaje» abre su chat o lo crea.',
      'En un espacio, la ficha abre el chat directo de ese mismo espacio; las apps instaladas abren su propio chat.',
      'En un canal privado, «Agregar miembros» lista a los miembros del espacio aunque nunca hayas hablado con ellos.',
      'Los zumbidos y los guiños de un canal aparecen en el compositor del modo empresa cuando están activados.',
    ],
  },
  {
    version: '0.1.169',
    // Company mode only: the apps' forms and cards.
    audience: 'spaces',
    items: [
      'Las fechas de los formularios se eligen con un selector y arrancan en hoy; la hora, con su reloj.',
      'Transportista, cantera, planta y los nombres largos se eligen en una lista desplegable.',
      'Si no se puede enviar un formulario, el aviso sale junto al botón.',
      'Las tarjetas de las apps siempre llevan su logo y su nombre, y los datos largos caben en dos líneas.',
    ],
  },
  {
    version: '0.1.168',
    // Company mode only: the apps' forms. The first release the 0.1.167 filter skips for personal-only users.
    audience: 'spaces',
    items: [
      'Marcar asistencia eligiendo tu nombre: las listas largas se abren con un buscador.',
      'Si tu empresa te pide un PIN al marcar, se escribe oculto y no se guarda.',
      'En la medida de tanque y el ingreso de material puedes subir varias fotos, quitarlas y volver a tomarlas.',
      'La foto de la wincha o de la guía abre la cámara de atrás, no la selfie.',
    ],
  },
  {
    version: '0.1.167',
    // For everyone: from this version on the app skips updates that are not for what each one uses.
    audience: 'all',
    items: [
      'Solo te avisamos de una versión nueva si trae cambios para lo que usas: tus chats o el modo empresa.',
      'En un espacio, la pestaña Ajustes empieza con el espacio: miembros, canales, apps e invitar.',
      'Toca un tanque en la tarjeta para ver su detalle: nivel, disponible, mínimo y última medida.',
      'Antes de actualizar ves solo las novedades que te tocan.',
    ],
  },
  {
    version: '0.1.166',
    items: [
      '/clima ahora es como el de Google: la temperatura por horas, la lluvia, el viento y 8 días; toca un día para verlo.',
      'En una llamada puedes mandar guiños y stickers: aparecen en la pantalla de los dos.',
      'Los formularios de las apps muestran los nombres de tanques y materiales, no códigos.',
      'Los botones y enlaces de las apps ya no se cortan a mitad de palabra.',
    ],
  },
  {
    version: '0.1.165',
    items: [
      'En una videollamada puedes girar entre la cámara frontal y la trasera.',
      'Cada app dice con qué cuenta estás conectado, y puedes desconectarla.',
      'Los avisos con montos, como la planilla, no se publican hasta que un admin elija un canal privado.',
      'Si una app pide permisos nuevos, su detalle te avisa y la reinstalas desde ahí.',
    ],
  },
  {
    version: '0.1.164',
    items: [
      'Al marcar, el formulario queda abierto con «Enviando…» hasta que la app confirme o te diga qué corregir.',
      'Si una marca no se confirma en 30 segundos, te lo dice para que revises antes de volver a marcar.',
      'Un comando que no existe en el chat ya no se manda como mensaje: te dice cuáles hay.',
      'Las respuestas y los formularios de cada app llevan su logo, y desinstalar te dice qué se pierde.',
    ],
  },
  {
    version: '0.1.163',
    items: [
      'Marcar asistencia en un toque: eliges el tipo y la selfie se toma con la cámara frontal en vivo.',
      'La foto lleva sellada la fecha, la hora y el lugar, y la ubicación se lee en ese momento, nunca la guardada.',
      'Los tanques se ven como en el reporte: el %, el nivel y el estado en palabras.',
      'Si una app te corrige un formulario después de enviarlo, se abre otra vez con lo que hay que arreglar.',
    ],
  },
  {
    version: '0.1.162',
    items: [
      '«Conecta tu cuenta» de una app se hace dentro de Lilachat: tu correo o WhatsApp y el código, sin salir de la app.',
      'El formulario sube con el teclado, trae lo que la app ya sabe y te dice por qué te lo pide.',
      'Cerrar un formulario lo descarta, y el paso siguiente se abre solo.',
      '«Trabajando…» ya no se queda pegado: si la app no responde, te lo dice para que lo intentes de nuevo.',
    ],
  },
  {
    version: '0.1.161',
    items: [
      'Un canal que creas o al que te unes aparece al toque en la lista, y sus admins lo pasan a privado o le cambian el nombre.',
      'Un admin puede sacar una app de un canal, y no vuelve sola.',
      'El formulario de asistencia muestra siempre el botón «Marcar» y solo pide actividades a la salida.',
      'Los gráficos de la semana entran enteros en la tarjeta, y el «1» de no leídos ya no se queda pegado.',
    ],
  },
  {
    version: '0.1.160',
    items: [
      'El ⚡ en la cabecera de tu espacio: marca asistencia y usa las acciones de las apps sin entrar a un canal.',
      'Las apps te piden lo que necesitan en un formulario: tu ubicación, una selfie y la acción, y te dicen qué falta.',
      'El admin elige a qué canal llega cada aviso de una app, como la asistencia o los tanques, y lo prueba.',
      'El admin decide qué comandos y acciones salen en el ⚡ y en qué canales funcionan.',
    ],
  },
  {
    version: '0.1.159',
    items: [
      'Lo que una app te responde a un comando ahora se puede «Enviar al canal», con «usó /clima» arriba.',
      'Al mandar un comando ves al instante que la app está trabajando.',
      'Los álbumes se ven en cuadrícula, como en WhatsApp, y un enlace de Google Maps muestra el punto o el lugar.',
      'Después de instalar una app vuelves a tu espacio, con la app abierta.',
    ],
  },
  {
    version: '0.1.158',
    items: [
      'En cada espacio, la sección «Apps» reúne tus chats con apps y las que ya están instaladas, como en Slack.',
      'El directorio de apps: búscalas, fíltralas por categoría y mira qué hace cada una, sus comandos y sus permisos.',
      'Un admin instala una app desde su detalle, y la desinstala desde el menú ⋮.',
      'El chat con una app muestra quién la hizo y su información, sin botón de llamada.',
    ],
  },
  {
    version: '0.1.157',
    items: [
      'Escribe «/» en un chat de tu empresa y aparecen los comandos de cada app, como /clima o /tanques.',
      'Lo que una app te responde a un comando lo ves solo tú, con su tarjeta, hasta que lo descartes.',
      'Si la app tarda, ves «está trabajando…» y la respuesta llega sola.',
      'El número de no leídos de «Personal» baja al leer el chat, también si lo leíste en la web.',
    ],
  },
  {
    version: '0.1.156',
    items: [
      'Los avisos de las apps se dibujan: tanques, gráficos y cifras, con su detalle a un toque.',
      'Las apps llevan su robot, para no confundirlas con una persona.',
      'Ajustes del espacio → Integraciones: instala apps como Lila desde ahí.',
      'Las listas vuelven arriba como filtros, con un lápiz para editarlas o borrarlas, y los chats ocupan menos espacio.',
    ],
  },
  {
    version: '0.1.155',
    items: ['Un video que te mandaron sigue sonando con la pantalla apagada o en otra app, con su control en el aviso.'],
  },
  {
    version: '0.1.154',
    items: [
      'Las listas de chats se pliegan como secciones, igual que en Slack.',
      'Tocar un recordatorio que sonó lo abre con su nota, su imagen y sus enlaces.',
      'Guiño nuevo: «Rockero furioso».',
      'Esta ventana: lo nuevo de cada versión, una sola vez.',
    ],
  },
  {
    version: '0.1.153',
    items: [
      'Guiños de temporada para todo el año, cinco por temporada.',
      'Los videos de YouTube, TikTok, Instagram y Facebook se ven dentro de Lilachat.',
      'Comparte tu ubicación desde el clip.',
      'Ajustes → Almacenamiento: cuánto ocupa Lilachat y qué liberar.',
    ],
  },
];

/** Version numbers compared part by part («0.1.154» is newer than «0.1.99»). */
export function compareVersions(first: string, second: string): number {
  const a = first.split('.').map((part) => Number(part) || 0);
  const b = second.split('.').map((part) => Number(part) || 0);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

/**
 * The notes to show now: those after the last version seen, up to the one
 * running. With nothing seen yet (a fresh install, or the update that brings
 * this window, 0.1.154) only the running version's, once.
 */
export function notesToShow(notes: readonly ReleaseNote[], lastSeen: string | null, current: string): ReleaseNote[] {
  if (!lastSeen) return notes.filter((note) => compareVersions(note.version, current) === 0);
  if (compareVersions(current, lastSeen) <= 0) return [];
  return notes.filter((note) => compareVersions(note.version, lastSeen) > 0 && compareVersions(note.version, current) <= 0).slice(0, MAX_VERSIONS_SHOWN);
}

/** The line the published notes carry so an installed app knows who the version is for; LilaStore passes it through untouched. */
const AUDIENCE_LINES: Record<Exclude<ReleaseAudience, 'all'>, string> = { spaces: 'Para: modo empresa', personal: 'Para: chats personales' };

/** The `--notes` text for `lila apk publish`. */
export const releaseNotesText = (note: ReleaseNote): string => {
  const audience = note.audience && note.audience !== 'all' ? `${AUDIENCE_LINES[note.audience]}\n` : '';
  return `Lilachat ${note.version}\n${audience}\n${note.items.map((item) => `- ${item}`).join('\n')}\n`;
};

/** Who published notes are for; notes without the line (every version before 0.1.167) are for everyone. */
export function audienceOfNotes(notes: string): ReleaseAudience {
  const lines = notes.split('\n').map((line) => line.trim());
  if (lines.includes(AUDIENCE_LINES.spaces)) return 'spaces';
  if (lines.includes(AUDIENCE_LINES.personal)) return 'personal';
  return 'all';
}

/** The audience line is for the app, not for people: the notes screen drops it. */
export const isAudienceLine = (line: string): boolean => Object.values(AUDIENCE_LINES).includes(line.trim());

/**
 * Does any version newer than the installed one matter to this person? What
 * they use is unknown (still loading) → yes: a missed update costs more than
 * one notice too many.
 */
export function updateMatters(audiences: readonly ReleaseAudience[], usage: { spaces: boolean; personal: boolean } | null): boolean {
  if (!usage || audiences.length === 0) return true;
  return audiences.some((audience) => audience === 'all' || (audience === 'spaces' && usage.spaces) || (audience === 'personal' && usage.personal));
}
