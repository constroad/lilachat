# As-is · Dali: el espacio de prospectos (bandeja de ventas)

## 1. Qué es

Dali es la app de agentes que atiende por WhatsApp a quien escribe desde un anuncio.
En Lilachat, un espacio «Dali · <empresa>» muestra esos prospectos para que los vendedores los atiendan.
- Un canal PRIVADO por prospecto, con el bot y todos los miembros activos del espacio.
- Lo escrito en el canal sale al cliente por WhatsApp. Un hilo se queda en el equipo.
- Agentes escribe lo que Dali sabe del prospecto. Lilachat guarda lo que decide el vendedor.
- Un espacio es «de Dali» si tiene instalada una app con `prospects:write`
  (`server/src/workspaces.ts`, la marca `prospects: true` del espacio).

Contrato: `specs/BOTS-API.spec.md` §c-prospectos (fases 1, 2, 2b y 3).
Diseños: `dl-01` a `dl-13` en `design/stitch/INVENTARIO.md` (prototipo v3).
**Fecha de corte: 17/11/2026.** Los anuncios de Constroad salían el 17/11.

## 2. Qué hace hoy

### Server

**Lo que escribe agentes** (token del bot, `server/src/bots/botProspects.ts`, `botMessages.ts`).
- `PUT /api/bots/prospects/:prospectId`: la primera vez crea el canal (201). Después actualiza (200).
  - Fase 1: `name`, `phone`, `source` (`ctwa`, anuncio), `last_activity_at`, `attended_by`,
    `listing` (`'prospect'` | `'chat'`, 20/11: ausente no cambia lo guardado, como el resto de fase 2).
    `source.platform` (`'instagram'` | `'facebook'`, 20/11, opcional): la plataforma del anuncio.
  - Fase 2: `stage`, `service`, `intent`, `score`, `score_reasons`, `fields`, `missing`, `ready_at`, `kind`,
    `summary`, `follow_up_draft`, `quote`, `unanswered`.
  - Un campo de fase 2 mal formado no frena el PUT: vuelve en `ignored: [{ field, message }]`.
  - Fase 3: un `field` con `source: "document"`, `file_id`, `confirmed` y `geo` (puntos o polígono).
  - `keepConfirmedFields`: un PUT con `confirmed: false` no deshace lo que confirmó una persona.
- `POST /api/bots/messages` con `prospect` y `as_contact: true`: el mensaje es del prospecto.
  `sent_at` da la hora real. `idempotency_key` = id del mensaje de WhatsApp.
- `POST /api/bots/files` + `files: [{ file_id }]`: los documentos que mandó el cliente (fase 2b).
- Push: cada mensaje `as_contact` avisa a los miembros. El primero dice «Prospecto nuevo · <anuncio>».
- `message.created` hacia agentes lleva `channel.prospect_id`.
- Colección `prospectchannels`. Índices `{workspaceId, appId, prospectId}` (único),
  `{workspaceId, lastActivityAt}` y `{chatId}`. Creados en producción el 17/11 con el OK de José.

**Grupos de WhatsApp en Chats (fase 1, 20/11, pedido vía agentes, `server/src/bots/botWhatsapp.ts`).**
A diferencia de un prospecto o un cliente, este canal NO guarda una identidad fija: un grupo tiene muchos
remitentes posibles, así que cada mensaje trae el suyo.
- `PUT /api/bots/whatsapp/:waId`: `waId` es el jid completo (`…@g.us` para grupos; fase 1 es solo grupos,
  `…@s.whatsapp.net`/`…@lid` quedan validados pero sin uso). Body `{ title, is_group? }`. La primera vez
  crea un canal PRIVADO con el bot y **todos los miembros activos del espacio** (José: visible a todo el
  espacio, igual que un prospecto — no solo quien participa). Después solo renombra y agrega a quien se
  sumó al espacio desde entonces.
- Target nuevo en `BotTarget`: `{ whatsapp: waId }` (`shared/src/bots.ts`), para `POST /api/bots/messages`.
- `as_contact` para `whatsapp` es un objeto `{ name, phone?, sent_at? }` (no `true` como en un prospecto):
  `name` es obligatorio, `phone` opcional (un `@lid` puede no traerlo). Se guarda en el MISMO campo
  `Message.prospect` que ya usa un prospecto (ahora con `phone?` opcional) — el renderizado
  (`prospectAuthorView`, la pastilla, el agrupado por `authorKeyOf`) no distingue el origen y no necesitó
  cambios; `authorKeyOf` cae a `name` cuando no hay `phone`, para no juntar remitentes distintos.
- `message.created` hacia agentes lleva `channel.whatsapp_id` (mismo patrón que `prospect_id`: un campo
  `whatsappId` en `Chat`, seleccionado en `hearingOf`).
- Colección `whatsappchannels`. Índice `{workspaceId, appId, waId}` (único).
- **`message.reply_to`** (20/11, implementado): ver §c-prospectos arriba y `BOTS-API.spec.md`.
- **Una foto o video posteado por agentes llega sin `width`/`height`** (20/11, José vía agentes: «no
  respeta su proporción, se ve estirada/recortada»). Causa real: sin esas dimensiones, `tamanoDeBurbuja`
  (`shared/src/media.ts`) caía al cuadrado 220×220 de respaldo — TODA foto de bot salía recortada al
  centro sin importar su forma real. Arreglado leyendo la forma del thumbnail que el uploader YA genera
  (`shapeOf()` en `server/src/localMediaUploader.ts`, con `sharp`: sin ffprobe, sirve igual para foto y
  video porque el resize/el primer frame de ffmpeg conservan la proporción) → `BotUpload.width/height`
  (`botUploads.ts`) → `Message.media.width/height` (`uploadMedia()` en `botMessages.ts`). A partir de ahí
  usa el MISMO motor que una foto de una persona (`photoBubbleStyle`, `VisorDeFotos`, controles de video):
  no hubo que tocar la burbuja. Fuera de fase 1 todavía: adjuntos con `kind: 'sticker'` para distinguir su
  render.
- **Álbum de fotos consecutivas del mismo remitente real, sin `media.album` compartido** (20/11, José vía
  agentes: agentes publica cada foto de WhatsApp aparte, nunca como un lote). `albumLayout`
  (`shared/src/albums.ts`) ahora también agrupa por `authorKeyOf`-equivalente (`prospect.phone ?? name`) +
  el mismo minuto de `at`, cuando no hay `media.album` explícito — la lógica de persona (selección múltiple
  en un picker) no cambia.

**Lo que hacen los vendedores** (sesión, `server/src/bots/prospectRoutes.ts`, `prospectDesk.ts`).

| Ruta | Qué hace |
| --- | --- |
| `GET /api/workspaces/:id/prospects?since=` | Abiertos y los nacidos o cerrados desde `since`, con `admin`, `enabled`, `me` |
| `GET .../prospects/:prospectId` y `.../by-chat/:chatId` | Uno |
| `GET .../prospects/:prospectId/documents` | Hasta 20 archivos que mandó el cliente |
| `PATCH .../prospects/:prospectId` | Tomar, reasignar, próxima acción, resultado → `prospect.updated` |
| `POST .../follow-up` | Aprobar (o editar) el borrador → `prospect.follow_up.approved` |
| `POST .../handback` | Devolver a Dali → `prospect.handback` |
| `POST .../fields/confirm` | Confirmar o corregir un dato leído → `prospect.field.confirmed` |
| `GET /api/workspaces/:id/dali/knowledge` | «Lo que Dali sabe» → `dali.knowledge.requested` (8 s, 502 si no responde) |
| `POST /api/workspaces/:id/dali/faqs` | «Enseñarle a Dali» → `dali.faq.add` (8 s) |
| `GET /api/workspaces/:id/dali/review` | La última tarjeta `review:*` de Dali en el #general |

- Cada cambio trae `version`. Si otro cambió antes: `409 stale` con el prospecto como quedó.
- La próxima acción crea un recordatorio PERSONAL en la Agenda (`prospectRef`). Al sonar abre el canal.
- Un resultado borra la próxima acción. `result: null` reabre.
- Aprobar un seguimiento gasta el borrador. Con resultado: `409 closed`. Sin borrador: `409 no_draft`.
- Un miembro oculto (incógnito) lee pero no decide: `403 incognito`.
- La plata (`quote.amount`, precios y política de precios) solo llega a los admins del espacio.
- `daliDoor.ts` pregunta a Dali. `prospectAnnounce.ts` avisa `workspace.prospects.changed`.

### Shared (motores puros, compartidos por web y APK)

- Validación: `prospects.ts` (fase 1, `authorKeyOf`, `prospectAuthorView`), `prospectInsight.ts` (fase 2),
  `prospectSeller.ts` (lo del vendedor), `prospectFieldConfirm.ts`, `prospectFieldGeo.ts` (`fieldGeoMapOf`).
- Vistas: `prospectBoard.ts` (`inboxOf`, `overdueOf`, `followUpsOf`, `funnelOf`, `isSalesProspect`),
  `prospectInboxRows.ts`, `prospectFollowUpCards.ts`, `prospectFunnelView.ts`, `prospectFigures.ts`,
  `prospectPanel.ts`, `prospectSheet.ts`, `prospectPlan.ts` (`agoOf`, `arrivedThisMonth`, `isOnlyConsult`),
  `prospectReview.ts`.
- `ProspectView.listing?: 'prospect' | 'chat'` (20/11, pedido vía agentes): ausente o `'prospect'` es una
  venta; `'chat'` es un 1:1 directo que agentes marcó como tal. `isSalesProspect` filtra `inboxOf`,
  `funnelOf`, `followUpsOf` (`prospectBoard.ts`), `weekReviewOf` (`prospectReview.ts`) y `panelOf`
  (`prospectPanel.ts`): un prospecto `listing: 'chat'` nunca cuenta en Bandeja/Embudo/Panel/Revisión.
- `daliChatSections` (`prospectBoard.ts`, 20/11): separa los chats de la pestaña Chats en `directs`
  (equipo + prospecto `listing:'chat'`) y `whatsappGroups` (`chat.whatsapp === true`). Única fuente de
  verdad para web y APK; sin WhatsApp en el espacio, `whatsappGroups` sale vacío y no cambia nada visible.
- `unreadFirst` (`prospectBoard.ts`, 23/11, pedido vía agentes: «scroll para adivinar cuál no leyó»): los
  chats con algo sin leer van primero dentro de cada sección de `daliChatSections` (`DaliSpace.tsx`, web y
  APK), ordenamiento estable — conserva la recencia que ya traía la lista dentro de cada grupo. Nunca toca
  el orden de Bandeja, que no pasa por `daliChatSections`.
- Conflictos: `prospectChange.ts` (409 → «Alguien lo cambió antes que tú…»).
- Dali: `daliKnowledge.ts` (`knowledgeViewOf` quita precios a quien no es admin, `questionsOf`),
  `daliTeach.ts` (Enseñarle a Dali, hasta 1000 letras).

### Web/PWA (`web/src/spaces/dali/`)

- `DaliSpace.tsx`: cabecera de una fila con la barra **Bandeja · Chats · Embudo · Panel · Revisión** y el
  botón «Lo que Dali sabe». Bandeja y Chats son maestro-detalle: lista de 380 px, conversación y (solo en
  Bandeja) ficha desde 1280 px. Un punto en Bandeja/Chats (20/11, vía agentes: «ninguna marca cuando llegan
  mensajes nuevos») cuando esa pestaña tiene algo sin leer — `daliTabUnread` (`prospectBoard.ts`), mismo
  corte que `daliChatSections` pero sumando `chat.unread`; sin nada sin leer, ningún punto (igual en el APK).
- `DaliInbox.tsx` + `ProspectRow.tsx`: Míos · Sin asignar · Todos, filtro por servicio, «Seguimientos de hoy»,
  tres secciones (Atender ahora, En seguimiento, Dali conversando) y «Solo consultas».
- `DaliChats.tsx` (20/11, pedido vía agentes): la pestaña Chats — los chats del equipo y un prospecto que
  agentes marcó `listing: 'chat'` (no es una venta). `daliChatSections` (`shared/src/prospectBoard.ts`) es la
  única fuente de verdad del corte; `DaliSpace.tsx` le pasa `chats` del espacio y `list.prospects`.
  Grupos de WhatsApp (fase 1, 20/11): sección propia «Grupos de WhatsApp» bajo «Mensajes directos», que
  solo aparece cuando el espacio tiene al menos uno (`DaliChats.test.tsx`: sin grupos, ningún encabezado).
- `ProspectChat.tsx`: cabecera (iniciales, teléfono, origen, Llamar con el marcador, Ficha, Marcar resultado)
  y franja (quién atiende, Dali en pausa, Tomar, Devolver a Dali).
- `ProspectSheet.tsx` + `prospectSheetBlocks.tsx`: la ficha. `ClientDocumentsCard.tsx`, `DocumentFieldRow.tsx`
  (Confirmar · Corregir) y `FieldGeoMap.tsx` (el lote del KML).
- Hojas y diálogos: `NextActionDialog.tsx`, `ResultDialog.tsx`, `FollowUpsSheet.tsx`, `TeachDaliDialog.tsx`.
- Pestañas: `DaliFunnel.tsx`, `DaliPanel.tsx`, `DaliReview.tsx`, `DaliKnowledgeSheet.tsx`.
- Datos: `useProspects.ts`, `sellerDesk.ts`, `prospectEcho.ts`, `prospectsApi.ts`. Datos de prueba:
  `daliTestData.ts`.
- Sin polling: relee con `workspace.prospects.changed` (2 s de margen) y al reconectar.

### APK (`app/src/spaces/dali/`)

- `DaliSpace.tsx`: la pestaña Chats del shell pasa a ser la barra del espacio —
  **Bandeja · Chats · Embudo · Panel · Revisión**. «Lo que Dali sabe» es el libro de la cabecera. Teléfono
  girado y tablet: bandeja a la izquierda y conversación al lado.
- `DaliInbox.tsx` + `ProspectRow.tsx`, `useProspectDoor.tsx` (la conversación: cabecera, franja y
  «Se envía al cliente por WhatsApp»), `ProspectSheetScreen.tsx` (ficha a pantalla completa).
- `DaliChats.tsx` (20/11): la pestaña Chats, pantalla completa (sin columnas) — misma fuente que la web
  (`daliChatSections`), `SectionList` con `FilaDeChat` (grupos de WhatsApp en su propia sección, 20/11
  fase 1, igual criterio que la web). `DaliInbox.tsx` siempre pasa `teamChats: []`
  a `inboxRowsOf` (`shared/src/prospectInboxRows.ts`): el pliegue «Chats del equipo» queda vacío y
  no se dibuja (la función sigue genérica y probada; solo dejó de recibir datos en la Bandeja).
- `NextActionSheet.tsx`, `ResultSheet.tsx`, `FollowUpsScreen.tsx`, `TeachDaliSheet.tsx`,
  `DaliKnowledgeScreen.tsx`, `DaliFunnel.tsx`, `DaliPanel.tsx`, `DaliReview.tsx`.
- `ClientDocumentsCard.tsx` (Abrir · Descargar), `DocumentFieldRow.tsx`, `FieldGeoMap.tsx`.
- `useProspects.ts`, `sellerDesk.ts`, `prospectEcho.ts`, `prospectsApi.ts`, `daliParts.tsx`.
- Chats del espacio con el mismo caché y eventos que un espacio común (`app/src/spaces/useSpaceChatsLive.ts`).
- La cabecera del canal acepta `prospectHeader` (`app/src/chat/EncabezadoDelChat.tsx`).

## 3. Diferencias APK vs web

- En la web «Marcar resultado» está en la cabecera de la conversación. En el teléfono vive en la ficha.
- En la web la ficha puede ir en una tercera columna. En el APK siempre va a pantalla completa.
- Web (26/11): la lista y la ficha son `ResizableAside`: se ensanchan arrastrando el borde y se pliegan a
  un riel; ancho y plegado quedan por navegador. Arreglado el 26/11: soltar el borde justo después de
  moverlo tumbaba la web entera («Algo falló al mostrar Lilachat»), porque el ancho se leía de un arrastre
  ya terminado; ahora se calcula en el movimiento (`ResizableAside.test.tsx`).
- Orden dentro de cada sección de la Bandeja (José 26/11, «todo muy desordenado»; eligió la opción): primero los
  que tienen mensajes sin leer, después los vencidos (algo atrasado según `overdueOf` o la próxima acción ya
  pasada) y al final el resto, del mensaje más reciente al más viejo (`inboxOrder` en `prospectBoard.ts`;
  web y APK le pasan los no leídos de cada chat). «Solo consultas» sigue la misma regla. Antes cada sección
  ordenaba distinto (puntaje, próxima acción, reciente).
- Web: diálogos y panel lateral bajo la barra. APK: hojas de abajo y pantallas con ←.
- Documentos: la web descarga con su nombre (`?download=`). El APK ofrece Abrir · Descargar.
- El segmentado y los círculos son los propios de cada plataforma (tonal y `Avatar` en el APK).
- En un renglón angosto del APK (menos de 150 dp) la pastilla del origen se va.
- Lo que decide cada pantalla sale de los mismos motores de `shared/`.

## 4. Historia reciente

- **25/11** · José: «dice que hay algo sin leer pero no sé cuál». La «Bandeja» tenía el punto y el espacio un 1, pero la vista abría en «Míos» y el no leído (Walter A, atendido por Dali) estaba en «Sin asignar». Ahora cada filtro (Míos · Sin asignar · Todos) lleva un contador lleno con cuántos prospectos tienen mensajes sin leer (`inboxUnreadByView` en `shared/src/prospectBoard.ts`; `Segmented` web y `Segmentado` APK).

- **16/11** Contrato fase 1 y fake (`PUT prospects`, `as_contact`). Canal por prospecto, el nombre del
  prospecto con la pastilla «WhatsApp», `prospect_id` hacia agentes.
- **16/11** Análisis fase 2 con datos de agentes (Baileys 7 en el 949, Haiku 5.5, sin Meta). Diseños `dl-*`,
  embudo por lo que falta, próxima acción, revisión semanal y config de Dali vista desde Lilachat.
- **16/11** Prototipo v3: una sola barra de pestañas en todo el espacio (José: «pierdo los tabs»).
- **16/11** Contrato y servidor fase 2: lo que Dali sabe en el PUT, el escritorio del vendedor y preguntar a Dali.
- **17/11** Pantallas web (`0053a7c8`) y del APK (`5978413e`).
- **17/11** Índices de `prospectchannels` en producción. El espacio usa el avatar de Dali como logo.
- **17/11** Cabecera de una fila en la computadora. Pastillas que nunca cortan una palabra. Aviso de versión nueva.
- **17/11** Fase 2b (`36206b42`): subidas del bot, archivos como del prospecto, tarjeta de documentos,
  datos por confirmar.
- **17/11** Fase 3 (`e5d3f680`): el vendedor confirma o corrige lo leído, y el lote del KML en la ficha.
- **20/11** Pestaña Chats (web y APK), pedido urgente vía agentes: `listing: 'chat'` en el contrato de
  `PUT prospects`, `isSalesProspect` filtra los 5 motores de la Bandeja/Embudo/Panel/Revisión, y
  `DaliChats.tsx` muestra los chats directos (los del equipo y los `listing: 'chat'`). La Bandeja deja de
  plegar «Chats del equipo»: se promovió a su propia pestaña. Probado con `vitest run` en las 4 cuentas
  (shared/web/app/server) y E2E real en el Chrome de José, espacio «Dali» de Constroad.
- **20/11** Publicado: push a `main` (`39547a75`, verificado en vivo en `lilachat.constroad.com`) y
  OTA (`c99dcd51…`, runtime `e058464c`, 726 assets) para que José lo probara el mismo día.
- **20/11** El aviso de un mensaje lleva a qué pestaña de Dali abrir (`pushService.ts`'s `daliTabOf`,
  `data.daliTab`): `'inbox'` para un prospecto de venta, `'chats'` para un chat directo. En el APK,
  `destinoDeAviso.ts` lo valida y `DaliSpace.tsx` expone `setDaliTab` (mismo patrón que el golpe de «Lo que
  Dali sabe») para que el espacio abra en la pestaña correcta aunque ya esté montado. **Pendiente de una
  build nativa**: el camino del aviso que dibuja Android NATIVO (`CAPACIDAD_MENSAJE_NATIVO`, el que tiene
  casi todo APK) reconstruye el destino en Kotlin (`AvisoDeMensaje.kt`/`DestinoDeAviso`), que no conoce
  `daliTab` — hace falta tocar ese Kotlin y una build+publicación de APK nueva (no sale por OTA). Hoy
  funciona en el camino común de Expo (dispositivos sin esa capacidad); documentado para no re-investigarlo.
- **20/11** Pedido chico vía agentes: `source.platform: 'instagram' | 'facebook'` opcional en el PUT
  (`shared/src/prospects.ts`, `sourceSchema` en `botProspects.ts`). `originOf` (`prospectBoard.ts`) nombra
  la plataforma en la pastilla de ORIGEN (ficha y fila de la bandeja) en vez de la genérica «Meta»; la
  `key` sigue siendo `'meta'` para no partir el agrupado por origen del Panel. Además, `originLineOf`
  (`prospectSheet.ts`) deja de mostrar el título del anuncio cuando es solo un host (`api.whatsapp.com`,
  un anuncio de post impulsado) y muestra `ad_url` en su lugar; la web dejó de duplicar esa lógica inline
  y llama a `originLineOf` como ya hacía el APK.
- **20/11** Grupos de WhatsApp en la pestaña Chats, fase 1 (pedido vía agentes, nuevo pedido grande aparte
  de lo de arriba). Contrapropuesta de contrato acordada con agentes (canal `PUT /api/bots/whatsapp/:waId`
  + target `whatsapp` + `as_contact` con remitente por mensaje). Antes de implementar, José confirmó
  explícitamente los dos riesgos que agentes marcó: (1) visible a TODO el espacio, igual que un prospecto,
  no solo a quien participa de ese grupo en WhatsApp; (2) la sesión única de Baileys de agentes sigue
  siendo un cuello de botella para fase 1 (si se cae, ningún grupo de Dali recibe ni manda mientras tanto),
  pero José le pidió a agentes buscar una mitigación de su lado — agentes respondió que ya existe: cola en
  Mongo con reintentos y vigencia de 24 h, reconexión sola, y alertas por Telegram/WhatsApp; lo único que
  no se recupera es el historial de mensajes de WhatsApp llegados mientras la sesión estaba caída (Baileys
  no lo trae). Implementado fase 1 (texto solo): canal, target, autor por mensaje reusando `Message.prospect`,
  `channel.whatsapp_id` en `message.created`, sección «Grupos de WhatsApp» en Chats (web y APK).
  Publicado el mismo día (José: «publícalo»): push a `main` (`73e262fb`, server) — sin OTA todavía (fase 1
  no toca el APK más allá de la UI de Chats, que necesita su propio release para llegar a los teléfonos).
- **20/11** El punto de no leídos en Bandeja/Chats (agentes, a nombre de José: «ninguna marca cuando llegan
  mensajes nuevos»). El cálculo del server (`unreadCount`) ya contaba bien los mensajes `as_contact` del
  bot — un test lo confirmó — así que no era un bug de conteo: faltaba el aviso en la pestaña misma. Se
  agregó un punto (`daliTabUnread`) en Bandeja y en Chats cuando esa pestaña tiene algo sin leer; sin nada
  sin leer, ningún punto. `ProspectRow` y `FilaDeChat` ya mostraban el contador POR FILA (sin tocar).
  Publicado (José: «sí, publícala»): push a `main` (`c64c4c5c`) y OTA (`e3c2c1c8…`, runtime `e058464c`,
  726 assets) — smoke en frío verde (versionCode 192) antes de publicar.

## 5. Diseños de Stitch relacionados

| Diseño | Estado | Evidencia |
| --- | --- | --- |
| dl-01 bandeja (v3) | Implementado | `DaliInbox.tsx` web y APK; `DaliInbox.test.tsx` |
| dl-02 conversación | Implementado | `ProspectChat.tsx`, `useProspectDoor.tsx`; `ProspectChat.test.tsx` |
| dl-03 ficha | Implementado | `ProspectSheet.tsx`, `ProspectSheetScreen.tsx` |
| dl-04 panel | Parcial | `DaliPanel.tsx`. Sin costos de Meta, «Exportar» ni asignación automática (comentario del archivo) |
| dl-05 seguimientos de hoy | Parcial | `FollowUpsSheet.tsx`, `FollowUpsScreen.tsx`. Sin el contador diario «4 de 20» ni «Prioridad alta» |
| dl-06 / dl-07 resultado | Parcial | `ResultDialog.tsx`, `ResultSheet.tsx`. Sin «Muy pequeño», sin «Dali le escribe en 30 días», sin aviso a Meta |
| dl-08 embudo | Parcial | `DaliFunnel.tsx` (v3 y baldosas v5 en el teléfono). En el teléfono repite cifras y baldosas (spec) |
| dl-09 próxima acción | Parcial | `NextActionDialog.tsx`, `NextActionSheet.tsx`. Sin «Avisar también a» ni pastillas de la secuencia |
| dl-10 revisión | Parcial | `DaliReview.tsx`. Sin «Publicar en #ventas», «Revisado» ni «Agendar revisión semanal» |
| dl-11 hilo del equipo | No implementado como pantalla | No hay archivo en `spaces/dali/` que lo dibuje. Se usa el hilo normal del chat |
| dl-12 lo que Dali sabe | Implementado | `DaliKnowledgeSheet.tsx`, `DaliKnowledgeScreen.tsx` (solo lectura, por servicio) |
| dl-13 enseñarle a Dali | Implementado | `TeachDaliDialog.tsx`, `TeachDaliSheet.tsx` (contador contra 1000, no 500) |

Lo que Stitch inventó y no va está listado en la spec (fase 2, pantallas de la web).
**No existe auditoría escrita de ningún `dl-*`** en `design/stitch/auditorias/`. Verificado en el repo.

## 6. Pendientes y deuda conocida

- **`daliTab` no llega por el aviso nativo** (20/11): el teléfono con `CAPACIDAD_MENSAJE_NATIVO` dibuja el
  aviso en Kotlin y reconstruye su destino ahí (`AvisoDeMensaje.kt`), sin pasar por `destinoDeAviso.ts`.
  Agregar `daliTab` ahí (y el extra que lo lleva al re-abrir la app) necesita una build nativa, no una OTA.
- **Seis decisiones de negocio abiertas** (spec «Decide José»): aprobar la fase 2, reparto manual o por
  turnos, precios desde Portal, zona y mínimos como datos, accesos de Meta, códigos de TikTok y web.
  Hoy el reparto es libre.
- **Fase 2 del cuadro de fases sin hacer**: audios del prospecto y checks de entregado.
  Verificado en código: `shared/src/botUploads.ts` no acepta audio y no hay marca de entregado.
- **Sin verificar con agentes de verdad**: la app Dali corre en el espacio «Dali» (no en Test, José vía
  agentes 18/11). El E2E de prospectos se hace ahí. Pendiente.
- **Sin verificar**: «Lo que Dali sabe» cuando agentes no responde (502) y la tarjeta de la revisión del
  domingo. Según spec.
- **Embudo en el teléfono** repite «3 Falta información» en cifras y baldosas. Va en un lote aparte
  para web y APK. Según spec.
- **Tocar el avatar del prospecto en la burbuja del APK abre el perfil del bot.** Según spec fase 1.
  No verificado en código.
- **Costo por prospecto y por venta** necesita `ads_read`. **Conversions API** necesita el Business
  Manager de José. Según spec. Depende de agentes y de José.
- **Precios de Dali copiados una vez de Portal**: si Portal cambia un precio, Dali no se entera.
  Según spec. Depende de agentes.
- **«Enseñarle a Dali» lo hace cualquier miembro activo.** Si José prefiere solo admins, es una línea.
  Según spec.
- **El panel de Dali** (editar negocio, catálogo, FAQ) se muda en agentes. Rutas no verificadas
  desplegadas. Depende de agentes.
- **La lectura del documento** (fotos, PDF, KML, Excel) es de agentes. Depende de agentes.
- **La tarjeta «No llegó por WhatsApp»** la publica agentes. Depende de agentes.
- **Logo del espacio**: el avatar de Dali, puesto a mano el 17/11 hasta tener otro. Según spec.
- **Grupos de WhatsApp fase 1**: publicado (`22428f71`). `message.reply_to` también implementado (ver
  abajo). Pendiente aparte: adjuntos (foto/doc/audio por `/api/bots/files`, falta un `kind: 'sticker'`),
  y fotos/videos del chat WEB respetando su proporción (pedido José vía agentes, 20/11).
- **`message.reply_to`** (José vía agentes, 20/11): `botTriggers.ts` expone en `message.created` un
  `reply_to: { id, seq, idempotency_key? }` cuando el mensaje escuchado tiene `replyToSeq`.
  `idempotency_key` solo si el mensaje original lo publicó un bot — nuevo campo `Message.botIdempotencyKey`,
  escrito sin condición en `extraOf()` (`botMessages.ts`) para todo mensaje de `publishText`. Se devuelve
  tal cual lo mandó agentes al publicar (p.ej. `wa-in:<línea>:<id de WhatsApp>`), sin parsear nada de este
  lado. Cubierto en `botListening.test.ts`.
- **Mitigación de la sesión única de Baileys**: confirmada por agentes (cola, reconexión, alertas), pero
  no verificada desde este lado — vive en el repo de agentes. Si en producción un grupo se queda sin
  mensajes durante una caída, revisar ahí antes de sospechar de Lilachat.

## 7. Pruebas

- Server: `server/src/bots/botProspects.test.ts` (6), `prospectDesk.test.ts` (25, 20/11: +4 del editor de cotización embebido), `botUploads.test.ts` (7, 20/11: +1 de la forma del bot),
  `fake.test.ts` (10), `botWhatsapp.test.ts` (8, 20/11, grupos de WhatsApp fase 1).
- Shared: `bots.test.ts` (47, +8 de `whatsapp`/`as_contact` por mensaje fase 1, +1 de `open: quote-embed`/20·11),
  `prospects.test.ts` (23, +2 de `source.platform`/20·11 y +1 de `authorKeyOf` sin `phone`/20·11),
  `prospectInsight.test.ts` (9), `prospectSeller.test.ts` (6),
  `prospectBoard.test.ts` (31, +4 de `isSalesProspect`, +1 de `platform`, +2 de `daliChatSections` y +2 de
  `daliTabUnread`/20·11), `prospectPanel.test.ts` (6),
  `prospectSheet.test.ts` (43, +1 de `originLineOf`/20·11), `prospectChange.test.ts` (4), `prospectFieldConfirm.test.ts` (4),
  `prospectFieldGeo.test.ts` (6), `prospectFigures.test.ts` (17), `prospectFollowUpCards.test.ts` (14),
  `prospectFunnelView.test.ts` (12), `prospectInboxRows.test.ts` (20), `prospectPlan.test.ts` (11),
  `prospectReview.test.ts` (7), `daliKnowledge.test.ts` (8), `daliTeach.test.ts` (9).
- Web: `web/src/spaces/dali/DaliInbox.test.tsx` (7), `DaliChats.test.tsx` (4, 20/11: +2 de grupos de WhatsApp fase 1),
  `ProspectChat.test.tsx` (7), `DaliPanel.test.tsx` (3), `DaliHeader.test.tsx` (6, 20/11: +1 del punto de no leídos),
  `ClientDocumentsCard.test.tsx` (3), `DocumentFieldRow.test.tsx` (4).
  También `web/src/chat/BurbujaDeMensaje.person.test.tsx` y `filasDeLaConversacion.test.ts` (según spec).
- APK: sin tests unitarios en `app/src/spaces/dali/`. La lógica está en `shared/`. Verificado.
- Arnés: `scripts/e2e-dali.ts`. Mongo en memoria, server real en :4003, stub de agentes y de
  constroad-auth en :4013. Registra cada escritura del vendedor en `<tmp>/lilachat-e2e-dali/events.json`.
  Nada toca producción.
- Maestro: `app/.maestro/dali.yaml` (285 líneas, 103 pasos, verde el 17/11) y
  `app/.maestro/dali-documents.yaml` (112 líneas: documento, por confirmar, Confirmar, mapa, Corregir).
- E2E web del 17/11: escritorio 1440 y 1100, teléfono 375 y 390, claro y oscuro. Según spec.

Las cifras entre paréntesis son casos `it(...)` contados el 17/11.
