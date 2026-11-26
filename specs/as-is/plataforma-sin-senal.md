# As-is · Sin señal (APK): qué se ve, qué se guarda y qué sale después

> Fecha de corte: **26/11/2026**. Nace del reclamo de José (lunes 24/11, obra en Aucallama, zonas sin
> red ni datos): no cargaban los chats ni los servicios, no pudo registrar fotos, videos ni ubicaciones,
> ni hacer la visita técnica. Este archivo junta el modelo sin señal de toda la app; cada módulo
> conserva su detalle en su propio as-is.

## 1. La regla

- **Lo que ya se vio, se ve sin señal.** Cada lista y cada detalle que el server mandó queda en el
  teléfono y se pinta primero; la red confirma o corrige por detrás.
- **Lo que se hace, se encola.** Cada escritura es un hecho con su clave propia (idempotente), en una
  cola en disco con sus archivos copiados a `documentDirectory`. Sale sola cuando vuelve la red.
- **El server manda.** Una respuesta fresca reemplaza la copia; una negativa (sin acceso, no existe)
  la borra. Un 401 real vacía todo, como siempre (`forgetRevokedSession`).
- **Nada se borra solo.** Lo rechazado queda a la vista con su motivo.

## 2. Qué funciona hoy

| Qué | Sin señal | Dónde |
| --- | --- | --- |
| Arranque con sesión guardada | Entra a la lista; solo un 401 real cierra la sesión | `App.tsx`, `auth/arranque.ts` |
| Lista de chats | La copia del disco (hasta 50), también si la red falla antes que el disco | `chat/ChatListScreen.tsx`, `chat/chatsGuardados.ts` |
| Selectores de chat (formularios, barra de audio) | La misma copia | `ui/TabsShell.tsx` |
| Mensajes de un chat | Los guardados en SQLite (abiertos antes, llegados en vivo o hidratados) | `chat/mensajesGuardados.ts` |
| Hidratador de historiales | Corre al arrancar y otra vez al reconectar (como mucho cada 10 min) | `App.tsx`, `chat/networkReturn.ts` |
| Texto | Cola `lilachat-outbox`, sale al conectar | `chat/outboxStore.ts` |
| Fotos, videos, voz y archivos del chat | Cola `lilachat-cola-archivos`, copia en `documentDirectory/cola-archivos/` | `chat/colaDeArchivos.ts` |
| Espacios, chats del espacio y canales de cliente | Copia del disco por espacio (`lilachat:space-cache:`) | `spaces/spaceCache.ts` |
| Pestaña «Servicios» de un chat abierto sin pasar por la lista del espacio | El cliente sale de las listas guardadas de todos los espacios | `spaces/clients/useSpaceClients.ts` |
| **Detalle de un servicio** (pedidos, informes, mapa, Drive) | **Copia del disco** con la línea «Sin señal · datos guardados el …» y «Reintentar» | `spaces/clients/useServiceAsk.ts`, `savedServiceAnswers.ts`, `shared/savedServiceAnswer.ts` |
| Lista del Drive | Copia del disco | igual |
| **Visita técnica** (datos, entrevista, puntos, fotos y videos, terminar) | **Cola de campo** + copia en el teléfono; ver §3-bis | `spaces/visits/useVisit.ts`, `visitJobs.ts`, `shared/visitOffline.ts` |
| ⚡ de un chat | La última lista de acciones guardada | `chat/commands/useChatCommands.ts` |
| **Pendientes y checklist del canal** | El plan guardado; marcar y subir evidencia van por la cola de campo | `chat/workPlan/useWorkPlan.ts`, `evidenceUpload.ts`, `shared/taskOffline.ts` |
| **Observaciones (REG-OBS, LEV-OBS) e IAA** | El informe guardado; registrar, levantar y medir un área van por la cola de campo | `spaces/clients/fieldWriteJobs.ts`, `shared/fieldWrites.ts` |
| **Mapa de la obra** | El último mapa que dibujó Portal (sin «Abrir en Portal» sin red) | `spaces/clients/ServiceMapPanel.tsx` |
| **«Registrar avance»** | Avance y fotos en un trabajo de la cola; la foto sube al Drive primero, con su clave | `workMap/manualProgressJobs.ts` |
| Informe nuevo de un tipo nunca abierto | Con señal, abrir «Servicios» deja listos los formularios de cada tipo | `reports/reportQueueStore.ts` › `prepareReportTypes` |
| Informes de campo (secciones y fotos) | Cola propia, ver `obra-informes.md` | `spaces/clients/reports/reportQueueStore.ts` |
| **Fotos, videos y documentos al Drive del servicio** | **Cola de campo**: se guardan en el teléfono y suben solos | `spaces/clients/fieldQueueStore.ts`, `useDriveUpload.ts`, `shared/fieldQueue.ts` |
| Vuelta de la red | El socket reconecta en el acto (no espera hasta 30 s) y todas las colas salen | `App.tsx`, `chat/socketClient.ts` › `reconnectNow` |

### Detalle del servicio guardado (26/11)

- Reemplaza la regla del 30/10 «el Detalle no se guarda». Se guarda solo lo que el server ya le mandó
  a ESTA persona: la plata sale del lado del server para quien no la ve (`withoutMoney`).
- Se guardan `detail` y `files`. Nunca `account` ni `billing` (plata).
- Clave `lilachat:space-cache:<spaceId>:service-<kind>:<clientId>:<serviceId>`: `forgetSpace` y el
  cierre de sesión la borran con el resto del espacio. Más de 1,5 M caracteres no se escribe.
- Al abrir: la copia se pinta al instante con «Datos guardados el … · actualizando…», y la respuesta
  fresca la reemplaza. Sin señal queda «Sin señal · datos guardados el …» con «Reintentar»; al
  reconectar el socket se pide sola otra vez. Una negativa del server borra la copia.
- **Precarga:** abrir «Servicios» con señal guarda el detalle de los servicios abiertos (pendiente y
  en ejecución) que no tengan copia o la tengan de hace más de 6 h. De a uno, hasta 8 por visita, y se
  corta al primer «sin señal». Así el servicio de la obra ya está en el teléfono antes de salir.
- El error sin copia ahora trae «Reintentar» (antes había que volver y abrir de nuevo).

### Cola de campo (26/11)

- Un trabajo = un hecho con su clave (`FieldJob.key`, que viaja como `clientUploadId`: Portal no
  duplica un reenvío). Índice en AsyncStorage `lilachat:field-queue`; cada archivo copiado a
  `documentDirectory/field-queue/`. Lo que un trabajo ya terminó (`done`, p. ej. un `mediaId`) se
  guarda y no se repite.
- Sale solo con el socket conectado: al conectar (`alConectar`), al encolar y en cada reintento que
  vence. Sin red no hay temporizador corriendo. Un trabajo cada 1,5 s.
- `watchFieldRun` lee cada paso (abrir, enviar, aviso, subida): sin respuesta → reintenta para siempre
  con espera creciente hasta 60 s; server ocupado, 401, 408, 429 o un aviso que no llegó → reintenta,
  y a los 8 se rinde con «No se pudo enviar después de varios intentos. Toca «Reintentar».»; cualquier
  otra negativa (p. ej. 413) queda a la vista con las palabras de Portal.
- **Drive:** foto, video (con su sello de hora y GPS), documento y pegar del portapapeles van siempre
  por la cola, con señal o sin ella: «Guardado en el teléfono. Se sube al Drive solo, apenas haya
  señal.». Al llegar, la lista del Drive se vuelve a pedir y dice «Archivo subido al Drive.».
- **Franja del servicio** (`FieldQueueStrip`, sobre todas las pestañas y en el Drive solo): «N
  pendientes en el teléfono · salen solos apenas haya señal» y cada rechazado con «Reintentar» y
  «Descartar» (pregunta antes: borra la foto del teléfono).
- Al cerrar sesión se borra todo (`forgetFieldQueue`).

### Pendientes sin señal (26/11)

- El plan de etapas se guarda (`lilachat:space-cache:chat:<chat>:stages`) y se muestra sin red.
- Marcar o reabrir una tarea es un trabajo `task_toggle` que dice el estado que quiere (`done`): el server
  (`checklistRoutes.ts`) responde igual si ya está así, así que un reenvío nunca la vuelve a cambiar. Un
  toque nuevo de la misma tarea reemplaza al que esperaba (`supersededTicks`). La lista dibuja los toques
  en espera (`projectStages`).
- La evidencia es un trabajo `task_evidence`: el archivo sube como mensaje del canal con la clave del
  trabajo como `clientKey` (el server devuelve el mismo mensaje en un reenvío) y luego se une a la tarea
  (el server une un `seq` una sola vez). El `seq` queda guardado: un reintento solo une.
- Franja de pendientes del canal sobre «Pendientes».

### Observaciones e IAA sin señal (26/11)

- Registrar o levantar una observación y guardar un área medida (AR o foto con wincha) son trabajos
  `observation` de la cola: el pedido con su `entry_id`, los valores y cada foto o video con sus campos
  (`captura`). Portal encuentra el primero en un reenvío por `entradaId` y, sin `informeId`, lo archiva en
  el informe abierto del servicio (`findOpenReport`, verificado 26/11): nada espera a otro trabajo.
- El informe que Portal mandó se guarda (`lilachat:space-cache:<espacio>:field-report:<servicio>:<tipo>`)
  y se muestra sin red; una negativa de Portal gana a la copia. Al llegar un registro, el informe se pide
  otra vez. La franja de la cola sale arriba de las dos pantallas.
- Editar y quitar un área siguen directos (necesitan señal).

### Mapa y «Registrar avance» sin señal (26/11)

- El mapa que Portal dibujó se guarda (`lilachat:space-cache:work-map:<cliente>:<servicio>`) y se
  muestra cuando la lectura falla; sin red no hay enlace a Portal.
- «Registrar avance» dentro de un servicio (`ServiceScopeContext`) es un trabajo `map_progress`: las fotos
  se guardan en el teléfono y, al salir, cada una sube al Drive con su clave (su `mediaId` queda guardado:
  un reintento no la sube dos veces) y después el avance con esos ids; Portal responde un reenvío del
  mismo `entry_id` como ya marcado. Sigue esperando la aprobación de un administrador.
- Las demás ediciones del mapa (calles, tramos, etapas, trabajos, borrar, importar, croquis) siguen
  necesitando señal.

### Formularios de cada tipo de informe (26/11)

Con señal, al abrir «Servicios» se lee una vez por espacio y proceso cada tipo de informe que el
teléfono nunca abrió (`prepareReportTypes`): leer un informe nuevo no crea nada en Portal (lo crea su
primera sección). Así un CTL-PIS o un CON-CAP nunca abierto se puede empezar sin red. Las observaciones
y el IAA tienen sus propios documentos y no entran aquí.

### Subidas que se reintentan (26/11)

`isRetryableUploadStatus` (`shared/media.ts`): 401, 408, 429, 502, 503 y 504 vuelven a la cola. Antes
solo 503: un corte del proxy mientras el server reiniciaba dejaba la foto en «No se envió» para
siempre. 400, 403, 413 y el resto siguen siendo «este archivo no va».

## 3. Lo que todavía necesita señal (pendiente, por lotes)

| Qué | Por qué hoy falla | Lote |
| --- | --- | --- |
| Editar o quitar un área (IAA) | Directo, sin cola | 2 |
| Subir con la app en segundo plano | El socket se pausa atrás y todo sale por `alConectar` | 4 |
| Chats secretos | La clave del otro no se guarda | aparte |
| Editar y borrar mensajes | Emit sin cola ni tope | aparte |
| Publicar un informe, PDF, «Terminar unidad» | Los hace Portal en el momento: exigen red y lo dicen | queda así |

## 3-bis. La visita técnica sin señal (26/11)

Hechos verificados en Portal `main` (`portalSiteVisitTools.ts`, `site-visit.repository.ts`): crear la
visita (`guardar_visita` de «Datos» sin `visitaId`) se deduplica por `entradaId` (`entryKey =
visita:<entradaId>`, índice único); un punto, por `entradaId` dentro de la visita; una foto, por
`clientUploadId` (en serie). La foto guarda su `takenAt`; **el punto no** (Portal le pone la hora del
server: hace falta un campo nuevo en `MARK_VISIT_POINT_ARGS`, decisión de José). Leer el borrador sin
visita no escribe nada.

- **Toda escritura va por la cola de campo**, con señal o sin ella: «Datos», entrevista, conclusión
  (`visit_section`), punto con su foto (`visit_point`), foto o video suelto (`visit_photo`) y
  «Terminar» (`visit_finish`). Motor `shared/visitOffline.ts`; envíos `app/spaces/visits/visitJobs.ts`.
- **Visita nueva sin señal:** «Crear visita» abre «Datos» desde la plantilla del espacio y la visita
  nace en el teléfono como `local-<clave>`; la clave es el `entradaId` de su «Datos» (nuestro server
  la deja pasar desde `2566f9fe`). Sale primero; lo demás de esa visita espera su id de Portal
  (`visitJobBlocked`) y la pantalla cambia sola a ella (`resolveLocalVisit`, `lilachat:field-visit-ids`).
  «Terminar» sale último, cuando no queda nada más de la visita; si Portal dice «Falta: …», queda
  rechazado a la vista con eso.
- **Lectura:** lo que manda el server se guarda (`visitCopies.ts`: la plantilla y cada visita por id) y
  la pantalla dibuja la cola encima (`projectVisit`): el punto nuevo con su número, lugar, hora y
  «Sin enviar»; fotos, videos y respuestas en sus cifras. Sin señal: la copia guardada o la plantilla.
  Una visita nueva sin enviar sale en «Visitas abiertas» (`localVisitRows`).
- **Plantilla lista antes de salir:** al cargar el ⚡ de un chat que ofrece «Visita técnica» se pide
  la visita sin id (no escribe en Portal) y se guarda, como mucho cada 6 h por espacio.
- **El ⚡ sin señal:** la lista de acciones de cada chat se guarda (`useChatCommands`); sin red el ⚡
  muestra la última.
- Las secciones se llenan con el formulario dibujado en el teléfono desde el esquema de la visita
  (`visitSectionForm`), no con una corrida de la app de Portal.
- Siguen necesitando red y lo dicen: «Ver PDF» y «Abrir croquis»; en una visita que todavía no llegó
  al Portal dicen «Primero la visita tiene que llegar al Portal…».
- Descartar la creación de una visita nueva se lleva todo su trabajo (`keysGoingWith`).
- **Hora del punto (26/11, apagada):** el teléfono manda `taken_at` y nuestro server lo pasa como
  `tomadoEn` (`pointFieldTime`: no más de 5 min adelante ni 30 días atrás) solo con
  `VISIT_POINT_FIELD_TIME_READY = true`. Orden: Portal declara `tomadoEn` en `marcar_punto_de_visita` y
  despliega → José reaprueba la herramienta en Agentes → Herramientas (cambia su huella) → se enciende.
  Antes de eso, mandarlo rechaza el formulario entero.
- **Compresión:** las tomas de la cámara van enteras y nuestro server las achica una vez al quemar el
  sello (foto con sharp, video con ffmpeg, `stampedForward.ts`); las fotos de galería se achican en el
  teléfono (`shrinkPhotoFile`) antes de entrar a la cola, en el Drive y desde el 26/11 también en la
  visita. Un video de galería sale tal cual (no hay compresor de video en el teléfono); las miniaturas
  las genera el almacenamiento de Portal al recibir.
- Franja de la visita (`FieldQueueStrip` con su id local y el real).

## 4. Pruebas

- **Shared:** `savedServiceAnswer.test.ts` (copia fresca, sin señal, negativa, copia rota, precarga,
  línea), `media.test.ts` (`isRetryableUploadStatus`).
- **Shared:** `visitOffline.test.ts` (ids locales, plantilla, proyección, orden de salida, descartar), `fieldQueue.test.ts` (`blocked`).
- **Server:** `siteVisitDoor.test.ts` (la sección conserva el `entry_id` del teléfono).
- **E2E 26/11 (emulador, Test):** detalle guardado sin red, foto al Drive en cola y subida al volver la red, lista de chats sin red: pasan. Falta el E2E de la visita sin señal.
- **APK:** `chat/networkReturn.test.ts` (en línea, vuelta de la red, hidratador cada 10 min).
- **E2E sin red:** pendiente en el emulador (`adb shell svc data disable` + `svc wifi disable` con la
  app ya abierta, `rn-app-loop` §4b).
