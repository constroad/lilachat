/**
 * What is new in each version (pending 66, José 23/10), like WhatsApp Web's
 * «What's new»: shown once after updating, in the app and on the web. The
 * same catalog writes the notes published to LilaStore. Newest first. PURE.
 */
export type ReleaseNote = { version: string; items: readonly string[] };

/** At most this many versions at once, for someone who skipped several. */
const MAX_VERSIONS_SHOWN = 3;

export const RELEASE_NOTES: readonly ReleaseNote[] = [
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

/** The `--notes` text for `lila apk publish`. */
export const releaseNotesText = (note: ReleaseNote): string => `Lilachat ${note.version}\n\n${note.items.map((item) => `- ${item}`).join('\n')}\n`;
