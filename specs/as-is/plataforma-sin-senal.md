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

### Subidas que se reintentan (26/11)

`isRetryableUploadStatus` (`shared/media.ts`): 401, 408, 429, 502, 503 y 504 vuelven a la cola. Antes
solo 503: un corte del proxy mientras el server reiniciaba dejaba la foto en «No se envió» para
siempre. 400, 403, 413 y el resto siguen siendo «este archivo no va».

## 3. Lo que todavía necesita señal (pendiente, por lotes)

| Qué | Por qué hoy falla | Lote |
| --- | --- | --- |
| Evidencia y marcar tareas de Pendientes | Subida directa, sin cola | 2 |
| «Registrar avance» y observaciones del mapa | Formulario de la puerta del mapa en vivo; la foto se sube antes de enviar | 2 |
| REG-OBS, LEV-OBS e IAA | Sin cola (`useObservations`, `useAreas`) | 2 |
| Mapa de la obra | El enlace y la lectura del mapa no se guardan | 2 |
| Informe de un tipo nunca abierto en el teléfono | La cola arma el informe nuevo con la última copia de ese tipo | 2 |
| Visita técnica | El id de la visita lo da Portal; el server exige su copia del documento; la clave de cada sección la crea el server | 3 (toca server) |
| Subir con la app en segundo plano | El socket se pausa atrás y todo sale por `alConectar` | 4 |
| Chats secretos | La clave del otro no se guarda | aparte |
| Editar y borrar mensajes | Emit sin cola ni tope | aparte |
| Publicar un informe, PDF, «Terminar unidad» | Los hace Portal en el momento: exigen red y lo dicen | queda así |

## 3-bis. Diseño del lote 3: la visita técnica sin señal (por hacer)

Hechos verificados el 26/11 en Portal `main` (`portalSiteVisitTools.ts`, `site-visit.repository.ts`):

- Crear la visita (`guardar_visita` de «Datos» sin `visitaId`) **se deduplica por `entradaId`**
  (`entryKey = visita:<entradaId>`, índice único `{companyId, entryKey}`): el reenvío devuelve la misma
  visita. Desde `2566f9fe` nuestro server deja pasar el `entry_id` del teléfono en una sección.
- Un punto se deduplica por `entradaId` dentro de la visita. Una foto, por `clientUploadId` (en serie).
- La foto acepta `takenAt`, `lat`, `lng`, `precisionM`: conserva su hora real. **El punto no**: Portal
  le pone la hora del server (`createdAt: new Date()`); para guardar la hora del campo hace falta un
  campo nuevo en `MARK_VISIT_POINT_ARGS` (decisión de José).
- Leer el borrador sin visita no escribe nada (`showSiteVisit`).

El diseño:

1. **Plantilla:** cada `visits/draft` que responde bien guarda el documento como plantilla del espacio
   (`lilachat:space-cache:<spaceId>:visit-template`), igual que `blankDocumentOf` de los informes. Los
   formularios de cada sección salen de `VisitDocument.forms` (`visitSectionForm`).
2. **Visita local:** `localId` = el `entradaId` de su «Datos». Se guarda la visita en el teléfono con
   lo hecho (secciones, puntos, fotos) para que la pantalla lo muestre sin red.
3. **Trabajos nuevos de la cola de campo:** `visit_section`, `visit_point`, `visit_photo`,
   `visit_finish`, con `payload.visit` = `localId` o el id real. El motor suma `waitsFor` (un id local
   sin resolver) y un mapa `localId → visitaId` en disco: «Datos» sale primero y crea; el resto espera;
   «Terminar» sale último, cuando no queda nada de esa visita.
4. **Al salir cada trabajo:** `visits/draft` (refresca la copia del server, 24 h) → abrir con
   `entry_id` = clave del trabajo → enviar los valores capturados sin red. La foto del punto usa la
   clave del trabajo como `clientUploadId`.
5. **Con red siempre por la cola** (una sola manera de escribir), como el Drive.
6. Siguen necesitando red y lo dicen: el PDF y «Abrir croquis» (editor de Portal).
7. Por verificar al empezar: si el ⚡ («Visita técnica») y la tarjeta lv01 se abren sin red.

## 4. Pruebas

- **Shared:** `savedServiceAnswer.test.ts` (copia fresca, sin señal, negativa, copia rota, precarga,
  línea), `media.test.ts` (`isRetryableUploadStatus`).
- **APK:** `chat/networkReturn.test.ts` (en línea, vuelta de la red, hidratador cada 10 min).
- **E2E sin red:** pendiente en el emulador (`adb shell svc data disable` + `svc wifi disable` con la
  app ya abierta, `rn-app-loop` §4b).
