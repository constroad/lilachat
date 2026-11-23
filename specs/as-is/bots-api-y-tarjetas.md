# As-is · API de bots, instalación y tarjetas de las apps

## 1. Qué es

Es la puerta por donde las apps de agentes (Lila, Dali, Portal, Inframaq, Pulso…) entran a Lilachat.
Una app se registra por manifiesto, se instala en un espacio con OAuth y escribe en los chats como bot.
Lo que hacen las personas le llega a la app como eventos firmados.

- Contrato canónico: `specs/BOTS-API.spec.md` (2080 líneas). Este as-is lo resume y apunta al código.
- Comandos, formularios y horarios van en `bots-comandos-formularios-y-horarios.md`.
- Dali y sus prospectos van en `bots-dali-prospectos.md`.
- Quién habla con quién (agentes, Portal) va en `bots-integracion-agentes-portal.md`.
- **Fecha de corte: 17/11/2026.**

## 2. Qué hace hoy

### Server (`server/src/bots/`)

Montaje en `server/src/app.ts` (líneas 160–166): `/api/oauth`, `/api/bots/apps`, `/api/bots/spaces`,
`/api/bots/files` (direcciones firmadas), `/api/bots` (token del bot) y `/api` (rutas de personas).

**Alta de apps por manifiesto** (`botApps.ts`, `botRoutes.ts`).
- Solo una app «desarrolladora» crea apps: `DEVELOPER_APP_CLIENT_IDS` en `botApps.ts` (hoy, solo Lila).
- `POST /api/bots/apps` con `Basic client_id:client_secret`. Idempotente por `key`. Hasta 20 apps.
- `POST /api/bots/apps/:clientId/secret` rota el secreto. `DELETE /api/bots/apps/:clientId` desinstala todo.
- El manifiesto trae `commands`, `shortcuts`, `notice_topics`, `scopes`, `suggested_schedules`,
  `description`, `features`, `developer`, `category` y `avatar_url`. Validación en `shared/src/botManifest.ts`.
- Permisos (`APP_SCOPES`): `users:read.email`, `channels:history` y `prospects:write`.
- Secretos con prefijo (`botSecrets.ts`): `lca_` id, `lcx_` secreto, `lcb_` token, `lcs_` firma.
  Se guarda solo el hash, salvo el secreto de firma.

**Dónde se puede instalar** (`botAvailability.ts`).
- `GET /api/bots/spaces?admin=<correo o celular>`: espacios donde esa cuenta es dueña o admin.
- `GET/PUT /api/bots/apps/by-key/:key/availability`: `{ everywhere: true }` o `{ spaces: [...] }`.
- Sacar un espacio de la lista no desinstala la app.

**Instalación OAuth con PKCE** (`oauthService.ts`, `botInstall.ts`, `botRoutes.ts` líneas 68–77).
- `GET /api/oauth/app` y `POST /api/oauth/authorize` (sesión), `POST /api/oauth/token` (servidor a servidor),
  `POST /api/oauth/revoke` (token del bot).
- El canje devuelve `access_token`, `installation_id`, `bot_user_id`, `signing_secret` e `installed_by`.
- Una instalación por app y espacio. Reinstalar reemplaza la anterior.

**Mensajes del bot** (`botMessages.ts`).
- `POST /api/bots/messages`: destino `channel_id`, `user`, `topic`, `client` o `prospect`.
  Contenido: `text`, `card`, `checklist` o `files`. `idempotency_key` obligatorio. 60 por minuto.
- `thread_of` responde en un hilo. Un hilo ajeno da `400 invalid_thread` (07/11).
- `PATCH /api/bots/messages/:id` reemplaza texto, tarjeta o álbum, y avisa `msg.edited`.
- `DELETE /api/bots/messages/:id` y `DELETE /api/bots/messages?idempotency_key=` (14/11).
  Queda la lápida «Se eliminó este mensaje». Desde el 15/11 borrar libera la clave.
- `files: [{ url, mime }]` de hosts de Constroad = álbum de fotos y videos (09/11).
- `files: [{ file_id }]` = archivos subidos antes por `POST /api/bots/files` (17/11).
- `mention_user_ids` (20/11): Lilachat antepone un `@Nombre` real por cada id que sigue siendo miembro del
  destino, con su mención válida; el que ya no es miembro se descarta en silencio (`mentionedTextOf` en
  `botMessages.ts`). Agentes solo manda ids, nunca el texto de la mención.

**Subidas del bot** (`botUploads.ts`, `shared/src/botUploads.ts`).
- `POST /api/bots/files`, multipart, campo `file`, hasta 16 MB.
- Acepta jpg, png, webp, mp4, audio (ogg/opus, mp4, mpeg — una nota de voz de WhatsApp, 23/11) y documentos
  pdf, kml, kmz, xlsx, xls, docx, doc, dwg, dxf y csv.
- Un audio llega al chat como `kind: 'audio'` (igual que una nota de voz propia): web y APK ya dibujan
  cualquier media con `mime` que empiece en `audio/` como `NotaDeVoz`/reproductor, por mime y no por kind,
  así que no hizo falta tocar `BurbujaDeMensaje.tsx` ni `MessageMedia.tsx` (app) para esto.
- El `file_id` no vence. El nombre se lee en UTF-8 («Ríos» ya no llega como «RÃos»).

**Tarjetas** (`shared/src/botBlocks.ts`, `shared/src/bots.ts`).
- Base e-21: `kicker`, `title`, `status`, `fields`, `link`, hasta 3 `actions` (5 en una tarjeta de visita).
- Bloques: `metric`, `rows`, `chips`, `text`, `people` (con `times` y `evidence`), `tank` (con `detail`),
  `chart`, `weather`, `gallery`, `map` (lugar o ruta de hasta 31 puntos), `stat`, `section` y `tiles`.
- Diseño a10 (12/11): `accent`, `subtitle`, `url` del cuerpo, `footer`, `link.style: 'button'`, `link.mime`.
- Una fila o un botón con `command` corre esa línea para quien toca (05/11). Ver el archivo de comandos.
- Una tarjeta pesa hasta 16 KB con su detalle. Los textos no se cortan con «…» (`upToWord`).

**Eventos hacia la app** (`botEvents.ts`, `botTriggers.ts`, `botLoopback.ts`).
- Firma `v1=` HMAC-SHA256 por instalación, con `X-Lilachat-Delivery` estable entre reintentos.
- Asíncronos con reintentos a 10 s, 1 min, 5 min y 30 min: `message.created`, `message.edited`,
  `message.deleted`, `button.click`, `checklist.item.toggled`, `app.uninstalled`, `prospect.*`.
- Síncronos (se espera la respuesta): `command.invoked`, `shortcut.invoked`, `form.submitted`,
  `form.preview.requested`, `link.status`, `link.revoke`, `dali.knowledge.requested`, `dali.faq.add`,
  `visit.draft.requested` y los `client.*.requested` del canal del cliente.
- `llm.task.requested` (18/11): una tarea del modelo que Lilachat le pide a agentes por la app Lila
  (`agentesModel.ts`, 10 s). La firma la instalación de Lila de un espacio de un miembro del chat
  (`developerAppClientIds()` de `botApps.ts`). Agentes elige el modelo; Lilachat no guarda claves.
- `GET /api/bots/commands/:id/context` (18/11, José: una sola Lila): el nombre del chat y sus últimos
  mensajes (`{ from, text }`, el mismo corte de 40 mensajes y 8000 caracteres del asistente) para que la
  Lila de agentes conteste `/lila <pregunta>` en un canal. Solo vale una corrida viva de `/lila` (15 min)
  de una app de agentes (la app Lila o una con `ownerAppId` de ella), en el chat donde se pidió y con la
  membresía de quien preguntó. 403 `not_a_context_command` para otro comando u otra app, 409 `no_chat`
  desde el ⚡ y `encrypted_chat` en un chat cifrado (`bots/commandContext.ts`).
- Canal privado nombrado para un comando (18/11): si el admin puso un canal privado en la lista «Canales donde
  funciona» de un comando, el primer uso del comando ahí mete a la app en el canal, para que su respuesta
  `in_channel` llegue al canal y no solo a quien preguntó. «Todos» no nombra canales privados, y una app que un
  admin sacó del canal no vuelve (`bots/commandChannelJoin.ts`, llamado desde `invokeApp`).
- En la mini, `agentes.constroad.com` se llama por `http://127.0.0.1:3012` y cae a la URL pública
  si nadie escucha (28/10). La lista vive en `botLoopback.ts`.
- Con `channels:history` la app oye todo el canal. Los archivos llegan en `message.files` con dirección
  firmada de 15 min (`botFiles.ts`).

**Lectura** (`botRoutes.ts` líneas 175–204).
- `GET /api/bots/me`, `/channels`, `/members`, `/messages/:id/files` y `/channels/:id/files?from=&to=`.
- El tipo de una imagen sale de sus bytes, no de la etiqueta del teléfono (14/11).

**Canal por cliente y sus tareas** (`botClients.ts`, `botClientTasks.ts`).
- `PUT /api/bots/clients/:clientId` crea el canal privado del cliente. Vivo = actividad en 60 días.
- Un admin del espacio promovido después se suma solo al canal de un cliente en el PRÓXIMO PUT de agentes
  (`addMissingAdmins`, exportada 21/11 para `scripts/promote-client-channel-admins.ts`): José la usa para
  promover a alguien a admin Y sumarlo de una vez a los canales de cliente que ya existen, sin esperar el
  próximo PUT. `npx tsx --env-file=.env scripts/promote-client-channel-admins.ts --space=<nombre>
  --promote=<nombre>[,<nombre>]` (dry-run; `--apply` escribe, `--list` ve los miembros primero).
- Cada servicio del PUT puede traer, en camelCase aunque el resto vaya en snake_case, `ordersCount`,
  `reportsCount`, `stagesTotal` y `lastActivity: { at, text }` (José 19/11, diseño cc-01). Lista blanca
  (`shared/src/serviceFacts.ts` › `serviceFactsFromWire`): enteros ≥ 0, fecha válida y texto recortado a 80;
  lo inválido se descarta sin rechazar el PUT. Se guardan y salen igual en `GET /api/workspaces/:id/clients`.
  `stagesTotal` son las etapas del MAPA de obra; `reportsCount`, solo informes públicos sin plata.
- `POST/GET /api/bots/clients/:clientId/tasks`: tareas de un pedido en la etapa «Ejecución».
- El detalle del canal del cliente (informes, Drive, cobranza) es de otro as-is.
- Los informes de campo del canal (`clientReports.ts`) se abren solo para los tipos de `OPEN_REPORT_TYPES`, que desde el 18/11 suman SOL-IMP y APR-ADI. APR-ADI lleva montos: el borrador pide `need: 'money'` y un miembro sin plata recibe 404. «Terminar unidad» (`kind: 'unit_album'`, tool `enviar_fotos_de_unidad`) abre con `need: 'services'`: cualquier miembro del canal (José 19/11). El detalle está en `obra-informes.md`. El orden de descarga de un CTL-PIS (José 20/11) vive en `unloadOrder.ts`: `PUT …/reports/:reportId/unload-order` con la misma puerta, y el borrador sale con `unloadOrder`. Sus secciones se guardan con `guardar_seccion_de_acta`, que va con el tipo como `guardar_seccion_de_informe` (`TYPED_SAVE_TOOLS`): el primer guardado crea el informe.

**Temas de aviso** (`botTopics.ts`): `GET/PUT /api/bots/topics`, `POST /api/bots/topics/offer|withdraw`.

**Borrar la tarjeta de una app** (`server/src/chatService.ts`, 13/11).
- Un admin del canal o del espacio borra para todos la tarjeta de una app.
- Motivo: una app no podía borrar lo que publicó y quedaba una tarjeta de QA.

**Rutas de personas** (`botUserRoutes.ts`).
- `GET /api/workspaces/:id/apps`, `/available-apps` y `/app-directory` (directorio e-24).
- `POST /api/workspaces/:id/apps/:appId/chat` abre el 1:1 con la app.
- `GET .../apps/:appId/channels`, `.../link`, `POST .../scopes`, `DELETE /api/workspaces/:id/apps/:installationId`.
- `workspace.apps.changed` avisa a los miembros que relean la lista (`botAnnounce.ts`).
- `botRegistry.ts` guarda en memoria qué usuarios son bots, para no consultar por cada mensaje.

### Shared

- `shared/src/bots.ts`: valida lo que publica un bot (`validateBotPost`), álbum y resumen
  (`botFilesSummary`).
- `shared/src/botBlocks.ts`: el kit de bloques y sus límites (384 líneas).
- `shared/src/botManifest.ts`: manifiesto, scopes, `newScopesOf`.
- `shared/src/botUploads.ts`: tipos y tope de las subidas.
- `shared/src/appLink.ts`: enlaces de vuelta `/s/{space}/apps/{client_id}` y `/chat`.

### Web/PWA

- Consentimiento: `web/src/apps/InstallAppScreen.tsx` en `/instalar-app` (también sin sesión).
- Integraciones: `web/src/spaces/IntegrationsSection.tsx`.
- Sección Apps, directorio, detalle con pestañas y 1:1: `web/src/spaces/apps/AppsSection.tsx`,
  `AppDirectory.tsx`, `AppDetail.tsx`, `AppConversation.tsx`, `AppChannelsSection.tsx`,
  `AppAccountSection.tsx`, `NoticeTopicsSection.tsx`, `NewPermissionsNotice.tsx`.
- Volver a Lilachat tras instalar: `web/src/spaces/apps/pendingAppReturn.ts`.
- Tarjetas: `web/src/chat/BotCardView.tsx`, `web/src/chat/botBlocks/*` (`BlockWeather`, `BlockTank`,
  `BlockGallery`, `BlockMap`, `RouteMapWeb`, `BlockChart`, `BlockDesign`), `BotCardDetail.tsx`.
- Álbum del bot: `web/src/chat/BotFilesAlbum.tsx`.
- Borrar tarjeta de app: `web/src/chat/DialogosDelMensaje.tsx` y `MenuDelMensaje.tsx`.

### APK

- Integraciones e instalar: `app/src/spaces/IntegrationsSection.tsx`, `app/src/spaces/AvailableApps.tsx`.
  «Instalar» abre el `install_url` con `Linking.openURL`.
- Apps del espacio: `app/src/spaces/apps/AppsSection.tsx`, `AppDirectoryScreen.tsx`, `AppDetailScreen.tsx`,
  `AppChatHeader.tsx`, `AppSettingsSections.tsx` (incluye `NoticeTopicsSection`), `AppAccountSection.tsx`,
  `NewPermissionsNotice.tsx`, `AppLogo.tsx`.
- Tarjetas: `app/src/chat/BotCardView.tsx`, `app/src/chat/botBlocks/*` (`RouteMap` en vez de `RouteMapWeb`).
- Álbum: `app/src/chat/BotFilesAlbum.tsx`. Borrar tarjeta: `app/src/chat/SeleccionDeMensaje.tsx`.

## 3. Diferencias APK vs web

- La pantalla de consentimiento existe solo en la web. El APK manda al navegador.
- El mapa de ruta se dibuja con `RouteMap` (APK) y `RouteMapWeb` (web). Mismo motor `routeTilesFor`.
- En la web el título de una tarjeta con `url` es además un enlace, para el teclado.
- En el APK las barras verticales del gráfico achican sus cifras para caber. En la web no.
- La primaria de una tarjeta mide 48 px en el APK (`cardActionLayout`).
- Lo demás (bloques, álbum, borrar tarjeta) es igual en las dos superficies.

## 4. Historia reciente

- **21/10** Nace la API: OAuth con PKCE, mensajes y tarjetas, eventos firmados con reintentos, lectura y fake.
- **23/10** Apps por manifiesto (sin una llave por app en Torre). Directorio, 1:1 con la app, consentimiento
  como Slack, disponibilidad por espacio, kit de bloques. Permisos `users:read.email` e `installed_by`.
- **23/10** Bloque `weather` (/clima por horas). Tanque con detalle al tocarlo (24/10).
- **25/10** La instalación guarda quién cambió qué tema de canal.
- **28/10** Escuchar el canal, ediciones, borrados y archivos (`channels:history`). Webhooks por loopback.
- **29/10** Canal por cliente: `PUT /api/bots/clients`, destino `client`, `kind` y `refs`.
- **30/10** Un 502/503 que trae el código de la app no se reintenta como reinicio.
- **04/11** Bloque `people` con hora y evidencia. La app vuelve a pedir los archivos de un mensaje.
- **05/11** La app lee lo escuchado en un canal por fechas. Botones y filas que corren un comando.
- **06/11** Tareas de un pedido en el checklist del cliente.
- **07/11** `thread_of` de otro canal responde 400 y no 500.
- **09/11** Bloques `gallery` y `map`. Mensaje del bot con álbum. La respuesta de un producto se lee hasta 600 KB.
- **12/11** Tarjeta de consumo de Inframaq (Stitch a10): barra, subtítulo, enlace, pie, `stat`, `section`, `tiles`.
- **13/11** Ruta de hasta 31 puntos en `map`. Estado en la línea del kicker (gst-01). La galería acepta
  `inframaq.constroad.com`. Un admin borra la tarjeta de una app.
- **14/11** `DELETE` del mensaje del bot, por id o por clave. Un enlace a PDF, foto o video abre el visor.
  Tipo de imagen leído de los bytes.
- **15/11** Borrar libera la clave de idempotencia (agentes mueve una tarjeta de canal con la misma clave).
- **16/11** Destino `prospect` y `as_contact` (ver as-is de Dali).
- **17/11** `POST /api/bots/files` y `files: [{ file_id }]`. Nombres en UTF-8 también en las subidas de miembros.
- **18/11** Una foto de formulario o de informe con sello Timemark acepta `place`: es la dirección del geocodificador del teléfono. El server la limpia y la quema (`placeOfShot`). Sin ella, la busca en Nominatim.
- **19/11** El mapa de la obra pide `service_croquis` (`workMapForms`): el server abre la tool de Portal `abrir_croquis_de_servicio` con `{ servicioId }` y devuelve el enlace del croquis embebido. Solo lee: no escribe nada en Lilachat.
- **20/11** Una acción de tarjeta puede traer `open: { route: 'service', service_id }`: Lilachat navega sola
  a su Servicios sin mandar nada al bot (agentes arma el payload por separado). Un `POST /api/bots/messages`
  puede traer `mention_user_ids` para etiquetar gente en `text` (ver arriba).
- **20/11** Un invitado de un canal compartido entre espacios (como Slack Connect) ya puede usar los
  comandos de ese canal: detalle completo en `bots-comandos-formularios-y-horarios.md` §4 (20/11,
  `activeMemberOf`).
- **20/11** Destino `whatsapp` (grupos de WhatsApp en Chats de Dali, fase 1 — ver as-is de Dali): séptima
  variante de `target`, con `as_contact` como objeto `{ name, phone?, sent_at? }` en vez de `true` (no hay
  identidad fija en el canal; cada mensaje trae la suya). `message.created` gana `channel.whatsapp_id`.
- **20/11** `open: { route: 'quote-embed', quote_id }`: «Editar» en la tarjeta de una cotización de Dali
  abre el editor de Portal embebido DENTRO de Lilachat, igual que un informe (web únicamente, como todo
  embed de Portal — la APK no muestra este botón). `quote_id` un ObjectId de 24 hex. Al tocarlo, Lilachat
  pide `GET /workspaces/:id/prospects/by-chat/:chatId/quote-embed/:quoteId` (resuelve el prospecto desde el
  chat, nunca pide `prospect_id` a la tarjeta), que dispara `quote.embed.requested { quote_id, prospect_id,
  user }` síncrono al webhook de Dali (mismo mecanismo que `dali.knowledge.requested`, no el de
  `client.report.embed.requested` que es de un CLIENTE). Respuesta `{ url, expires_at }`,
  `https://www.constroad.com/embed/quote/<id>[?tipo=simple|agrupada]#t=<token>` — nuevo `EmbedKind: 'quote'`
  en `portalEmbed.ts`, mismo `PortalEmbedFrame` que un informe. Errores de agentes: 400 `denied` → 403 (solo
  admins editan), 404 `not-found` → la cotización ya no existe, cualquier otro → 502. No necesita que el
  `link` normal de la tarjeta desaparezca: pueden ir juntos.

## 5. Diseños de Stitch relacionados

| Diseño | Estado | Evidencia |
| --- | --- | --- |
| e-21 mensaje de bot con botones | Implementado | `BotCardView.tsx` web y APK; `BotCardView.test.tsx` |
| e-22 Integraciones | Implementado | `web/src/spaces/IntegrationsSection.tsx` y `app/src/spaces/IntegrationsSection.tsx` |
| e-23 sección Apps y chat con una app | Implementado | `AppsSection.tsx`, `AppConversation.tsx`, `AppChatHeader.tsx` |
| e-24 directorio de apps | Implementado | `AppDirectory.tsx`, `AppDirectoryScreen.tsx`, `botDirectory.ts` |
| e-25 / c-04 / c-05 detalle con pestañas | Implementado | `AppDetail.tsx`, `AppDetailScreen.tsx` (ARCHITECTURE §151) |
| e-26 chat con una app | Implementado | `AppConversation.tsx`, `AppChatHeader.tsx` |
| e-33 clima por horas | Implementado | `BlockWeather.tsx` web y APK |
| a10 tarjeta de consumo (Inframaq) | Implementado | `shared/src/botCardDesign.test.ts`, `web/src/chat/BotCardDesign.test.tsx` |
| gst-01 tarjetas del gasto | Parcial | El dibujo está (`cardActionLayout`). Falta la auditoría escrita: no existe `design/stitch/auditorias/gst-01-tarjetas.md` |

## 6. Pendientes y deuda conocida

- **Auditoría gst-01 sin escribir.** `design/stitch/auditorias/` solo tiene adm-01 y lv01–lv03.
  Verificado en el repo. Espera el texto nuevo de Portal (según spec §c-gastos).
- **Etapas repetidas posibles en tareas del cliente.** Dos llamadas a la vez sobre un canal sin etapas
  podrían crear etapas dobles: no hay índice único `{chatId, stage}`. Según spec §c-novodecies.
  Crear el índice en producción pide el OK de José.
- **La spec de subidas está corta.** El código acepta además xls, doc, dxf y csv
  (`shared/src/botUploads.ts`). Verificado en código.
- **Índices a mano.** La base corre con `autoIndex: false` (`server/src/db.ts`). Toda colección nueva
  necesita `scripts/bot-indexes.ts --apply` con el OK de José. Verificado en código.
- **`shared/src/botBlocks.ts` va en 384 líneas** y crece con cada bloque. Sin riesgo inmediato.
- **APK sin la OTA.** Un APK viejo salta `stat`, `section`, `tiles`, `weather`. Agentes manda las cifras
  también en `fields` o `rows`. Según spec §c-tervicies. Depende de agentes.
- **Tarjeta «No llegó por WhatsApp»** y el reintento son de agentes. Depende de agentes.
- **Producción de Lila.** La spec dice que José carga el `client_secret` en Torre. No verificado desde el repo.

## 7. Pruebas

- Server: `server/src/bots/bots.test.ts` (29, punta a punta con webhook HTTP real),
  `botApps.test.ts` (14), `botAvailability.test.ts` (7), `botChannels.test.ts` (5),
  `botListening.test.ts` (23, 20/11: +2 de `message.reply_to`), `botLoopback.test.ts` (3), `botThreadReply.test.ts` (4),
  `botTopics.test.ts` (9), `botUploads.test.ts` (7, 20/11: +1 de la forma de una foto posteada aparte), `botClients.test.ts` (12),
  `botClientTasks.test.ts` (7), `fake.test.ts` (10), `server/src/deleteAppCard.test.ts` (4).
- Shared: `bots.test.ts` (28), `botBlocks.test.ts` (49), `botCardDesign.test.ts` (17),
  `botManifest.test.ts` (13), `botUploads.test.ts` (6), `appLink.test.ts` (3).
- Web: `BotCardView.test.tsx` (26, 20/11: +3 del editor de cotización embebido), `BotCardDesign.test.tsx` (6), `botBlocks/BotBlocks.test.tsx` (18),
  `BotFilesAlbum.test.tsx` (3), `dialogoEliminar.appCard.test.tsx` (2), `apps/InstallAppScreen.test.tsx` (5),
  `spaces/apps/apps.test.tsx` (12), `appSettings.test.tsx` (8), `NewPermissionsNotice.test.tsx` (2),
  `pendingAppReturn.test.ts` (4).
- APK: no hay tests unitarios en `app/src/spaces/apps` ni `app/src/chat/botBlocks`. Verificado.
- Fake para la CI de agentes: `tools/bots-fake/lilachat-bots-fake.mjs` (misma batería que el server).
- Maestro: `app/.maestro/chat-file.yaml` y `chat-pdf.yaml` tocan archivos del chat, no la API de bots.
  Los flujos de bots son los de Dali (ver ese as-is).

Las cifras entre paréntesis son casos `it(...)` contados el 17/11.
