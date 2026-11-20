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
- Conflictos: `prospectChange.ts` (409 → «Alguien lo cambió antes que tú…»).
- Dali: `daliKnowledge.ts` (`knowledgeViewOf` quita precios a quien no es admin, `questionsOf`),
  `daliTeach.ts` (Enseñarle a Dali, hasta 1000 letras).

### Web/PWA (`web/src/spaces/dali/`)

- `DaliSpace.tsx`: cabecera de una fila con la barra **Bandeja · Chats · Embudo · Panel · Revisión** y el
  botón «Lo que Dali sabe». Bandeja y Chats son maestro-detalle: lista de 380 px, conversación y (solo en
  Bandeja) ficha desde 1280 px.
- `DaliInbox.tsx` + `ProspectRow.tsx`: Míos · Sin asignar · Todos, filtro por servicio, «Seguimientos de hoy»,
  tres secciones (Atender ahora, En seguimiento, Dali conversando) y «Solo consultas».
- `DaliChats.tsx` (20/11, pedido vía agentes): la pestaña Chats — los chats del equipo y un prospecto que
  agentes marcó `listing: 'chat'` (no es una venta). `isSalesProspect` (`shared/src/prospectBoard.ts`) es la
  única fuente de verdad del corte; `DaliSpace.tsx` cruza `chats` del espacio contra `list.prospects` por
  `chatId` para armar la lista.
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
  (`isSalesProspect`), lista virtualizada con `FilaDeChat`. `DaliInbox.tsx` siempre pasa `teamChats: []`
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
- Web: diálogos y panel lateral bajo la barra. APK: hojas de abajo y pantallas con ←.
- Documentos: la web descarga con su nombre (`?download=`). El APK ofrece Abrir · Descargar.
- El segmentado y los círculos son los propios de cada plataforma (tonal y `Avatar` en el APK).
- En un renglón angosto del APK (menos de 150 dp) la pastilla del origen se va.
- Lo que decide cada pantalla sale de los mismos motores de `shared/`.

## 4. Historia reciente

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

## 7. Pruebas

- Server: `server/src/bots/botProspects.test.ts` (6), `prospectDesk.test.ts` (21), `botUploads.test.ts` (6),
  `fake.test.ts` (10).
- Shared: `prospects.test.ts` (10), `prospectInsight.test.ts` (9), `prospectSeller.test.ts` (6),
  `prospectBoard.test.ts` (21, +4 de `isSalesProspect`/20·11), `prospectPanel.test.ts` (6),
  `prospectSheet.test.ts` (33), `prospectChange.test.ts` (4), `prospectFieldConfirm.test.ts` (4),
  `prospectFieldGeo.test.ts` (6), `prospectFigures.test.ts` (17), `prospectFollowUpCards.test.ts` (14),
  `prospectFunnelView.test.ts` (12), `prospectInboxRows.test.ts` (20), `prospectPlan.test.ts` (11),
  `prospectReview.test.ts` (7), `daliKnowledge.test.ts` (8), `daliTeach.test.ts` (9).
- Web: `web/src/spaces/dali/DaliInbox.test.tsx` (7), `DaliChats.test.tsx` (2, 20/11),
  `ProspectChat.test.tsx` (7), `DaliPanel.test.tsx` (3), `DaliHeader.test.tsx` (5),
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
