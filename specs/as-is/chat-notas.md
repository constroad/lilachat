# As-is · Chat: chats de notas y enlaces por categoría

## 1. Qué es

Un chat de notas (`kind: 'notas'`) es un chat con uno mismo para guardar información.
Hay dos clases:
- **«Tú»** (`propio: true`): uno por persona.
- **Con nombre**, como «IA links» o «Compras»: los que la persona crea.

José los usa para guardar enlaces de redes. Comparte un reel desde Instagram, elige Lilachat, elige el chat y lo envía.
Desde el 18/11 un chat de notas puede ordenar esos enlaces por categoría. El interruptor es por chat y viene apagado.

**Fecha de corte:** 18/11/2026.

## 2. Qué hace hoy

### Chats de notas (server)

- **Crear:** `POST /api/chats` con `kind: 'notas'` y un nombre (`chatRoutes.ts`).
  - Nace con un solo miembro admin y nunca va cifrado.
  - Con `kind: 'yo'` busca o crea el «Tú».
  - Pruebas: `borradores.test.ts`.
- **Lo que no tienen:**
  - mensajes temporales (`disappearingMessages.ts`);
  - zumbidos ni guiños (`zumbido.ts`);
  - cola de pendientes (la web y el APK no la muestran).
- **Pestañas del detalle:** Medios y Ajustes (`shared/src/chatDetailTabs.ts`).

### Enlaces por categoría (José 18/11)

Diseño en Stitch `nl-01` a `nl-03` (ver §5). Prototipo navegable en https://claude.ai/artifact/T2aDskZmxmFxZ3K4y4tNe1.

**Decisiones de José (18/11):**
1. Lila elige la categoría y la persona la corrige. Lila solo propone una categoría nueva cuando ninguna encaja.
2. La clasificación corre en el server de Lilachat con Claude Haiku 5.5, no en agentes.
3. Whisper va después y solo para los videos sin texto. Hoy se usa el texto del post, el autor y la miniatura.
4. El interruptor es por chat y viene apagado.

**Server** (`server/src/`)
- **Interruptor:** `Chat.linkSorting` guarda `{ enabled, categories: [{ _id, name, by: 'lila' | 'user' }] }`.
  - La lista de chats lo manda como `linksSorted: true` (`listaDeChats.ts`).
- **Al llegar un mensaje con enlace** (`linkSorting.ts › queueLinkSorting`, colgado de `reparto.ts › avisarMensajeNuevo`):
  - Vale para cualquier puerta: socket, compartir, reenviar.
  - Corre en una cola de 2 a la vez, después del reparto, así que el chat no espera.
  - Un reintento del mismo mensaje no se vuelve a leer.
- **La tarjeta** (`linkReader.ts`) se guarda en `Message.link`: plataforma, formato, autor, texto, miniatura y estado `ready` o `unreadable`. Lo que da cada red a un robot, medido el 18/11:
  - **Instagram:** el reel trae solo «Nombre (@usuario) • Reel». El texto sale del embed público `/{p|reel}/{código}/embed/captioned/`, que va en el cuerpo de la página (`fetchPublicHtml`).
  - **Facebook:** `og:title` = «estadísticas | texto | página» y `og:description` = el texto.
  - **YouTube y TikTok:** oEmbed (título y canal).
  - **Otra web:** sus etiquetas `og:`.
- **El enlace guardado va limpio:** sin `igsh`, `utm_*`, `si`, `fbclid`, `mibextid` ni `_t`/`_r` (`shared/src/linkNotes.ts › cleanLinkUrl`).
- **«Solo pide comentar»:** el post dice «Comenta NICHO…» y casi nada más (`commentBaitOf`).
- **La categoría** (`linkClassifier.ts`):
  - Una llamada a `claude-haiku-5-5` con esfuerzo `low` y unos US$ 0.0002 por enlace.
  - La respuesta se valida como la de un cliente hostil: solo un nombre de la lista o uno nuevo corto.
  - Topes: 12 categorías por chat y 300 clasificaciones por chat al día.
  - Sin `ANTHROPIC_API_KEY`, la tarjeta se guarda igual «Sin categoría».
  - Un enlace ilegible no se clasifica.
- **Al encender:** se leen los enlaces que ya están en el chat. Si el chat no tiene categorías, Lila las propone (de 5 a 9) o se usan las que llegan en `seed`. Después se ubica cada enlace.
- **Lo que mueve una persona** queda `categoryBy: 'user'`, y Lila no lo vuelve a tocar.
- **Rutas** (`linkSortingRoutes.ts`, bajo `/api/chats`):
  - `GET /:chatId/links`
  - `PUT /:chatId/link-sorting`
  - `POST /:chatId/link-categories`
  - `PATCH /:chatId/link-categories/:id`
  - `POST /:chatId/link-categories/:id/merge` (`into: null` = «Sin categoría»)
  - `PUT /:chatId/messages/:seq/link-category`
  - `POST /:chatId/messages/:seq/link-refresh`
- **Socket:** `msg.link` `{ chatId, seq, link }` y `chat.links.changed` `{ chatId }`.

**Shared** (`shared/src/linkNotes.ts`)
- `buildCategoryView` arma la vista para la web y el APK:
  - un chip por categoría con su conteo, más «Sin categoría»;
  - secciones de la más nueva a la más vieja;
  - la búsqueda sin tildes ni mayúsculas;
  - los filtros de revisión.
- `platformLabel` arma «INSTAGRAM · REEL».

**Web/PWA** (`web/src/chat/links/`, 18/11)
- **Segmentado «Chat · Por categoría»** (`NotesViewSwitch.tsx`, `notesView.ts`): solo en un chat de notas con `linksSorted`.
  - En pantalla ancha (≥ 1024 px) va en la cabecera; más angosta, a todo el ancho debajo.
  - La vista elegida se recuerda por chat en `localStorage`.
- **Vista «Por categoría»** (`LinksByCategory.tsx`, `CategoryLayouts.tsx`, `LinksStates.tsx`): reemplaza los mensajes y el compositor.
  - Ancha: columna de categorías con conteos y «Revisión»; buscador, orden y grilla de 2–3 columnas.
  - «Renombrar» y «Unir con…» solo en una categoría real (`CategoryDialogs.tsx`).
  - Angosta: chips en una fila con scroll y secciones con las 3 más nuevas y «Ver las N».
  - El «+» vuelve al chat y enfoca el compositor.
  - Esqueleto, vacío y error con «Reintentar».
- **Tarjetas** (`LinkNoteCards.tsx`, `linkCardParts.tsx`): ⋮ con «Mover de categoría», «Abrir» y «Copiar enlace». En el teléfono, mantener presionado abre «Mover».
  - Un video soportado se abre en el reproductor del chat (`VideoEmbedOverlay`); lo demás, en otra pestaña.
- **Hoja «Mover a»** (`MoveLinkSheet.tsx`): conteos, la actual marcada, «Sin categoría» y «Nueva categoría».
- **En la burbuja** (`StoredLinkInBubble.tsx`, desde `BurbujaDeMensaje.tsx`): la tarjeta guardada en vez de la vista previa genérica.
  - Abajo, la pastilla de categoría con lápiz. «Solo pide comentar» va bajo el autor, antes de la descripción; «No se pudo leer» con «Reintentar», debajo del texto.
  - Un cuerpo que es solo el enlace no se repite como texto.
- **Datos** (`linkNotesStore.ts`, `linkNotesApi.ts`): una sola lectura de `GET /links` por chat, compartida por la vista, las burbujas y la hoja.
  - `msg.link` actualiza la memoria y la base local (`applyLinkCard` en `local/mensajesLocales.ts`).
  - `chat.links.changed` vuelve a leer la vista.
- **Interruptor:** «Ordenar enlaces por categoría» en Ajustes del detalle del chat (`info/LinkSortingRow.tsx`).

**APK** (`app/src/chat/links/`, 18/11, sale por OTA: sin cambio nativo)
- **Segmentado «Chat · Por categoría»** debajo de la cabecera, solo en un chat de notas con `linksSorted`; la vista elegida se recuerda por chat (`notesViewPref.ts`).
- **Vista «Por categoría»** (`LinksByCategory.tsx`, `LinksParts.tsx`, `linkView.ts`): buscador, chips con conteo en una fila con scroll y secciones «NOMBRE · N».
  - Apaisada o tablet: columna «CATEGORÍAS» con conteos y «REVISIÓN» al costado de las tarjetas.
  - El «+» flotante vuelve al chat; la lista deja abajo el alto del botón.
  - Mantener presionado un chip abre «Renombrar» y «Unir con…» (`CategoryActionsSheet.tsx`).
- **Tarjetas** (`LinkRowCard.tsx`, `LinkCardParts.tsx`): 107 dp de alto con 16 de padding, como Stitch. Mantener presionado abre «Mover a» (`MoveLinkSheet.tsx`). `useLinkOpener.tsx` abre el enlace.
- **En la burbuja** (`NoteLinkBubble.tsx`): la tarjeta guardada, su pastilla de categoría, «Solo pide comentar» y «No se pudo leer» con «Reintentar».
  - La burbuja de un enlace toma la fila entera (`BubbleColumn`, en vez del 80 %); la tarjeta mide el ancho de la pantalla menos los márgenes, hasta 460 dp en tablet.
  - La pastilla de plataforma nunca se corta: se acorta el título.
- **Hoja «Mover a»:** la fila elegida lleva el riel de acento de 3 dp, como Stitch.
- **Datos** (`useChatLinks.ts`, `useNotesLinks.tsx`, `linksApi.ts`): una lectura de `GET /links` por chat; `msg.link` y `chat.links.changed` por socket.
- **Interruptor:** «Ordenar enlaces por categoría» en el menú ⋮ de la conversación (`chatHeaderMenu.ts`).
- Radios: `rounded-card` (12) en tarjetas, chips, filas y botones; `rounded-thumb` (8) en miniaturas, como Stitch.

## 3. Diferencias APK vs web

| Qué | APK | Web |
| --- | --- | --- |
| Interruptor | menú ⋮ de la conversación | Ajustes del detalle del chat (la cabecera web no tiene ⋮) |
| Mover un enlace | mantener presionado la tarjeta | ⋮ de la tarjeta; en el teléfono también mantener presionado |
| Pantalla ancha | apaisada o tablet: columna de categorías | ≥ 1024 px: columna, orden y grilla de 2–3 columnas |
| Renombrar / unir | mantener presionado el chip | ⋮ de la categoría en la columna |

## 4. Historia reciente

- **19/10:** borradores (chats `notas`) y el «Tú».
- **18/11:** José pidió ver «IA links» por categoría.
  - Análisis previo de la sesión de Meta Ads: 8 categorías, transcripción y clasificación.
  - Diseño `nl-01` a `nl-03` y decisiones con José.
  - Server y shared hechos con tests.

## 5. Diseños de Stitch relacionados

| Diseño | Estado | Evidencia |
| --- | --- | --- |
| `nl-01-por-categoria` (móvil y escritorio) | En implementación | ver `design/stitch/INVENTARIO.md` |
| `nl-02-tarjeta-en-el-chat` (móvil) | En implementación | ídem |
| `nl-03-mover-de-categoria` (móvil) | En implementación | ídem |

## 6. Pendientes y deuda conocida

- **Whisper en la mini**, para los videos sin texto: lo decidió José el 18/11 y queda para después.
  - Necesita `yt-dlp` y `whisper.cpp` (modelo base, ~0.4 GB de RAM, uno a la vez).
  - Hoy ninguno de los dos está instalado.
- **Las cuentas con restricción de edad** de Instagram no muestran nada sin sesión. Quedan «No se pudo leer».
- **APK apaisado:** el «+» flotante tapa el final de la primera tarjeta con la vista quieta (E2E 18/11). Se lee al desplazar; mejora posible: un FAB más chico o en la columna de categorías.
- **La cola vive en memoria:** si el server se reinicia a mitad del encendido, lo pendiente queda sin tarjeta. Apagar y encender el interruptor lo vuelve a correr.

## 7. Pruebas

- **Shared:** `linkNotes.test.ts` (limpiar, plataforma, «comenta X», vista por categoría).
- **Server:**
  - `linkReader.test.ts`: embed de Instagram, título de Facebook, oEmbed e ilegible.
  - `linkClassifier.test.ts`: prompt, respuesta hostil, sin clave y error.
  - `linkSorting.test.ts`: cola, propuesta, tope e ilegible.
  - `linkSortingRoutes.test.ts`: listar, mover, crear, renombrar, unir, reintentar e interruptor.
  - `borradores.test.ts`.
- **APK:** `links/linkView.test.ts`. Flujo Maestro `app/.maestro/notes-by-category.yaml`.
  - E2E 18/11 en el emulador: 7 de 7 pasos (interruptor, 4 enlaces con tarjeta, mover, buscar, apaisada).
  - Sin verificar en el APK: «Reintentar» y renombrar / unir desde el chip.
- **Web:** `links/linkNotesStore`, `links/NotesViewSwitch`, `links/LinksByCategory`, `links/MoveLinkSheet`,
  `links/StoredLinkInBubble`, `BurbujaDeMensaje.link`, `info/LinkSortingRow` y `applyLinkCard` en `local/mensajesLocales`.
