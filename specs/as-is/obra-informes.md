# As-is · Informes de campo desde Lilachat

> Fecha de corte: **17/11/2026**. Fuentes: código de `main`, `git log` desde el 05/11,
> `specs/INFORMES-DESDE-LILACHAT.spec.md` (2 047 líneas), `specs/AS-IS-0.1.170.spec.md`
> y `design/stitch/INVENTARIO.md`. El Área adicional (IAA) y la visita técnica van en
> `obra-visita-e-iaa.md`.

## 1. Qué es

Decisión de José (05/11): «ya no se use public para generar informes sino que se haga
desde Lilachat». El ingeniero crea y llena los informes de campo desde el canal del
cliente: Servicios → el servicio → Informes → «Crear informe».

- **Lilachat captura; Portal guarda.** Lilachat no calcula, no pinta el PDF ni guarda
  el informe. Portal tiene las fórmulas, valida al publicar, arma el PDF y avisa.
- Un miembro **sin usuario de Portal** crea informes. La puerta es Lilachat:
  miembro del canal, servicio listado en el canal (`findAskedService`, `need: 'services'`).
- APK y web con **un solo motor** (`shared/src/fieldDocument.ts`, `reportSaves.ts`,
  `reportQueue.ts`, `reportScreen.ts`).

## 2. Qué hace hoy

### Tipos de informe

Fuente: `REPORT_TYPE_OPTIONS` en `shared/src/reportCreation.ts`.

| Código | Nombre | Se llena en Lilachat | Notas |
| --- | --- | --- | --- |
| CTL-IMP | Control de imprimación | Sí | Tramos con bandejas; «Agregar tramo» abre donde terminó el anterior. Basta una bandeja completa (19/11) |
| CTL-PIS | Control de pista | Sí | Unidades por despacho, 4 fotos con GPS por volquete, hasta 10 fotos adicionales |
| CON-CAP | Conformación de capa | Sí | GPS, calle y progresiva se llenan solos (`fieldAutofill.ts`) |
| FRE-PAV | Fresado de pavimento | Sí (desde 13/11) | Tramos con progresivas; fotos ANTES/DURANTE/DESPUES |
| RCP-CAM | Recepción de campo | Sí (desde 13/11) | Conformidad por calle con fotos |
| REG-OBS | Registro de observaciones | Sí (interruptor encendido desde 11/11) | Pantalla propia, 3 toques |
| LEV-OBS | Levantamiento de observaciones | Sí | Antes en el visor, después con cámara |
| IAA | Área adicional | Solo en el APK | Ver `obra-visita-e-iaa.md` |
| SOL-IMP | Solicitud de imprimación | Sí (desde 18/11; E2E web 18/11) | Zonas con largo, ancho y fotos; declaración y dos firmas. Web ancha: nace en el editor 2.0 |
| APR-ADI | Aprobación de adicional | Sí (desde 18/11; E2E web 18/11), solo con plata | Sustento, adicional y partidas; sin fotos. Web ancha: nace en el editor 2.0 |

**Hojas de bloques del editor 2.0** (16/11, `EDITOR_REPORT_TYPE_OPTIONS`): ACT-CNF,
REC-EXC, MET-RES, CAL-PROT, TOP-CMP, INF-ACT, PNL-FOT, CONT-SRV y DOS-OBR. Desde el
17/11 también VAL-SRV y LIQ-SRV, con montos (APR-ADI pasó a la lista pública el 18/11) (José: «sumarlos al
embed»; sin cobranza, Portal responde `no_billing`). Solo se crean en la web ancha y solo
quien ve montos (admin del espacio).

### Flujo de un informe (formulario por secciones)

1. «Crear informe» → elige el tipo → pregunta el **responsable** (menos REG-OBS/LEV-OBS).
2. **Hub** del informe (j-02): progreso «N de M secciones listas», una tarjeta por
   sección con su pastilla (Lista / A medias / Falta / Opcional).
3. **Tramos** (j-03) o **Unidades** (j-05/j-06, CTL-PIS).
4. Cada sección abre el formulario que manda Portal, con valores precargados. Abre
   sin señal. «Guardar» encola y cierra.
5. **Fotos** una por guardado, varias seguidas, con descripción y progresiva.
6. **Publicar** (j-04): lista lo que falta o «Todo listo» → nota → Portal genera el PDF
   y lo manda al canal.
7. **Ver PDF** de un borrador: vista previa dentro de la app (APK `ReportPreviewScreen`,
   15/11). Publicado: visor PDF de la app.
8. **Quitar una foto** ya enviada de un borrador (`remove_photo` → `quitar_foto_de_informe`).
9. **Terminar unidad** (CTL-PIS, solo admins, 19/11): revisión de las fotos y envío al grupo
   (`unit_album` → `enviar_fotos_de_unidad`). Detalle en spec INFORMES-DESDE-LILACHAT §24.

### Bandejas del CTL-IMP: basta una (José 19/11)

«Obliga a llenar las 3 bandejas». `sectionFormOf` marca cada bandeja con `x-sample` (solo en
CTL-IMP › `bandejas`, `SAMPLED_FORMS` en `shared/src/formSamples.ts`) y deja obligatoria solo la
bandeja 1. `validateFormValues` aplica la regla (`withSampleRule`), igual en APK, web y server:

- Una bandeja completa basta; puede ser la 2 o la 3.
- Una bandeja empezada se valida entera («Escribe un número.» en lo que le falta).
- Sin nada escrito se pide la bandeja 1. Un borrador guarda lo que haya.
- CON-CAP y los demás tipos no cambian: sus puntos numerados siguen todos obligatorios.

**La tasa de riego la calcula Portal**, no Lilachat: `shared/` solo muestra los `results` que
manda Portal. En Portal el promedio ya ignora las bandejas vacías (`averageNumbers` filtra
`null`, `src/components/field-reports/forms/imprimacionForm.utils.ts` 166–169 y 262–266): con
1 bandeja da su tasa. **Pendiente de Portal:** la sección «Bandejas» queda «A medias» y el
tramo no cuenta como listo con 1 bandeja, porque `imprimacionFields.ts` (35–37) marca las 9
casillas `required` y `stateOf` (`imprimacionDocument.ts` 75) exige todas; el aviso de
publicar dice «Falta un tramo con sus 3 bandejas».

### Ubicación mientras se lee el GPS (José 19/11)

Al abrir una sección con foto, el GPS se lee de una vez. `reportScreen` expone `place`
(`PhotoPlaceReading`: `reading`, `ready`, `failed`, y si la sección la exige) y `placeLineOf`
el texto: «Obteniendo ubicación…» con su indicador, «Ubicación lista.», o el error (exigida:
«No se pudo leer tu ubicación. Enciende el GPS y revisa el permiso de ubicación.»; si no:
«…la foto va solo con la hora.»). Se dibuja sobre los campos: `PlaceStatus.tsx` (APK, en
`AppFormSheet` › `status`) y `PlaceStatusWeb.tsx` (web, en `AppFormDialog` › `status`).
«Usar mi ubicación» (`PlaceButton`) ya tenía su «Buscando tu ubicación…».
Desde el rediseño `imp-*` la línea es una tarjeta con borde, el indicador y un pin.

### CTL-IMP compacto (diseños imp-01/02/03, José 19/11)

José en su teléfono: «botones grandes, diseños feos». Solo cambia cómo se dibuja; lo que se
guarda y lo que lee Portal no cambian.

- `sectionFormOf` marca `compact` cada sección de un CTL-IMP (`isCompactReport`,
  `shared/src/compactReportForms.ts`). Botón único de 52 px (web `PrimaryButton tall`, APK
  `SheetFooter`), campos de 44 px (APK `FormStyleContext.compact`; la web ya los tenía).
- «Ubicación» del tramo: las progresivas antes del carril (`compactSectionSchema`, orden de
  pantalla) y el carril en chips «Derecho · Izquierdo · Ambos» (`x-chips`). Guarda el mismo
  texto; un carril escrito antes sale como un chip más, elegido.
- «Bandejas»: una fila por bandeja (B1, B2, B3) con vacía, con asfalto y área, y su estado al
  final (`sampleRowsOf`, `shared/src/sampleRows.ts`): ✓ completa, ⚠ a medias con «Completa esta
  bandeja o déjala vacía» mientras se escribe, «OPC.» la vacía opcional. «Basta una completa»
  arriba. Web `SampleRowsWeb`, APK `SampleRowsView`.
- Tablet: web diálogo ancho y columna «Estado»; APK hoja de hasta 640 pt y tabla con «Estado»
  desde 560 pt.
- Sin hacer (diferencias en `design/stitch/auditorias/imp-0*.md`): cabecera con «Tramo 2 · JR
  CONCHUCOS» y «BORRADOR», «Desde 0+120 (fin del Tramo 1)», «Foto del riego» y la tasa en el
  formulario, «Guardar tramo» (cada sección se guarda sola: dice «Guardar»), progresivas y
  carril en una fila en tablet. La tarjeta de ubicación sale en las secciones con foto: la
  sección «Ubicación» no lee el GPS.

### Cola sin señal (los dos clientes)

- Todo guardado y toda foto pasan por la cola, con señal o sin ella. «Publicar» exige red.
- Documento local: AsyncStorage (APK) y `meta` de Dexie (web), por servicio y tipo.
- Sin red, 408, 429 y 5xx reintentan con espera creciente; 401 vacía la cola; el resto
  queda rechazado a la vista con «Corregir» y «Descartar».
- Un tramo nuevo lleva id `local-<clave>` hasta que Portal da el suyo.
- Web: solo envía la pestaña con el candado (Web Locks).
- Al cerrar sesión se borra todo (`forgetReportQueue`; en la web, la base entera).

### Cámara con sello tipo Timemark (12–13/11, diseños cam-01…cam-06)

- APK: una sola cámara a pantalla completa (`app/src/chat/camara/FormCamera.tsx`,
  `StampOverlay.tsx`, `StampedPreview.tsx`). Chips «Logo» (`cameraLogoPref.ts`) y
  «GPS ±N m». Zoom .6x/1x/2x (`zoom.ts`, parche de `expo-camera`).
- Web/PWA: `web/src/chat/camera/WebCamera.tsx` en formularios, Drive y chat.
- Sello: hora grande, fecha, día y dirección. Coordenadas solo sin dirección. **Nunca
  el nombre de quien toma la foto.** Logo arriba a la derecha (13/11).
- **Quema el sello el server** (sharp, `stampTimemark` en `server/src/bots/photoStamp.ts`)
  con su hora y la dirección de Nominatim. Video con ffmpeg (`videoStamp.ts`).
- **Una sola compresión:** quien sella comprime. Portal guarda tal cual con
  `selloLilachat: true` (`agregar_foto_de_informe`, `agregar_foto_adicional`,
  `agregar_foto_de_parte`). Si una herramienta no declara la marca, sella Portal.
- La foto de cola guarda la hora en que se **tomó** (`QueuedPhoto.stamp`).

### «Enviar al grupo» (WhatsApp del cliente)

La casilla `enviarAlGrupo` de CTL-IMP y CTL-PIS llega solo a un admin del espacio.
El server la quita del documento de un miembro (`withoutGroupSend`).

En CTL-PIS, desde el 19/11 las fotos de una unidad salen al grupo solo con «Terminar unidad».
Antes, un admin las revisa (`UnitAlbumDialog.tsx` en la web, `UnitAlbumSheet.tsx` en el APK).
Portal ya no las manda al subir la foto de unidad vacía. La puerta del server pide `need: 'admin'`.

### Web/PWA

- Carpeta: `web/src/spaces/clients/reports/` (`CreateReportDialog.tsx`,
  `ReportDocumentWeb.tsx`, `ReportSectionsWeb.tsx`, `ReportUnitsWeb.tsx`,
  `ReportItemsWeb.tsx`, `PublishDialog.tsx`, `reportQueueStore.ts`, `useReportDraftRead.ts`).
- **Editor 2.0 de Portal embebido** (`PortalEmbedWeb.tsx`, desde 11/11). En la web
  ancha (≥ 1024 px, `EMBED_MIN_WIDTH_PX`) un informe con `editor: 'v2'` abre el lienzo
  de Portal en un `iframe`. Crear en el editor: `EMBED_CREATE_TYPES` (los 8 tipos de
  campo, SOL-IMP y las 12 hojas de bloques).
  - Enlace: `https://www.constroad.com/embed/report/<id>#t=<token>`; token por
    miembro, 12 h, en el fragmento.
  - Mensajes v1: `portal-embed:ready`, `:dirty`, `:saved`, `:published`, `:closed`,
    `:error` y, hacia Portal, `:close-request`, `:theme`.
  - «Abriendo el editor del Portal…»; a los 15 s «Reintentar» (16/11). «Salir igual» a
    los 45 s si el guardado se traba.
  - «Editar croquis» abre el mapa de obra sobre el editor (ver `obra-mapa.md`).
- Web angosta (PWA del celular): el mismo formulario por secciones que el APK.

### APK

- Carpeta: `app/src/spaces/clients/reports/` (`CreateReportSheet.tsx`,
  `ReportDocumentScreen.tsx`, `ReportSections.tsx`, `ReportUnitsView.tsx`,
  `ReportItemsView.tsx`, `PublishSheet.tsx`, `reportQueueStore.ts`, `useFieldDocument.ts`,
  `photoRemoval.ts`, `devicePlace.ts`, `useWorkStreets.ts`).
- Vista previa del borrador: `app/src/spaces/clients/ReportPreviewScreen.tsx` (zoom,
  «Abrir en el navegador»).
- **Sin editor 2.0.** Solo los tipos públicos. Una hoja de bloques abre su ficha con
  el PDF y «Abrir en el Portal» (`apkReportTypes.test.ts`).
- Observaciones: `app/src/spaces/clients/observations/*` (lista con mapa, Nueva,
  Levantar). Botones de 72 px; objetivos de 56 dp o más.

### Server

- `POST /api/workspaces/:id/clients/:clientId/services/:serviceId/reports/draft`
  `{ type, report_id? }` → evento `client.report.draft.requested` → `{ document }`.
  Guarda el último documento por persona y servicio 24 h (`ReportDraftModel`).
- `POST …/reports/forms` abre UNA pieza como `BotCommandRun` (15 min). Kinds:
  `section`, `publish`, `remove_photo`, `unit_album`, `observation_register`, `observation_lift`,
  los de área y los del mapa. Errores: 400 sin `at` en una foto, 409 `draft_not_open`,
  409 `outdated_app`.
- `GET …/reports/:reportId/pdf` (PDF de Portal).
- `GET …/reports/:reportId/embed` y `POST …/reports/embed` (crear en el editor). Una
  hoja de bloques pide `need: 'money'` (`needsMoneyToCreate`): un miembro recibe 404.
- El envío va por `POST /api/chats/:chatId/commands/:commandId/form` (y fotos por `…/files`).
- Código: `server/src/bots/clientReports.ts`, `unitAlbumForm.ts`, `observationForms.ts`, `photoStamp.ts`,
  `formPhotoPlaces.ts`, `stampAsked.ts`.

### Shared

`fieldDocument.ts`, `reportCreation.ts`, `reportSaves.ts`, `reportQueue.ts`,
`reportScreen.ts`, `reportUnits.ts`, `unitAlbum.ts`, `reportPdf.ts`, `fieldAutofill.ts`,
`fieldConditions.ts`, `portalEmbed.ts`, `observations.ts`, `observationWrite.ts`,
`photoStamp.ts`, `timemarkStamp.ts`, `weatherBlock.ts`, `formSamples.ts`.

### Lo que depende de otros sistemas

- **Portal:** todas las herramientas (`informe_de_campo`, `guardar_seccion_de_informe`,
  `guardar_seccion_de_fresado`, `guardar_seccion_de_recepcion`, `publicar_informe`,
  `agregar_foto_de_informe`, `agregar_foto_adicional`, `agregar_foto_de_parte`,
  `quitar_foto_de_informe`, `enviar_fotos_de_unidad`, `registrar_observacion`, `levantar_observacion`,
  `abrir_editor_de_informe`, `crear_informe_en_editor`), las fórmulas, el PDF y el editor 2.0.
- **Agentes:** enruta los eventos con el `user` firmado. Cada herramienta nueva o
  cambiada la reaprueba José (si no, 502).

## 3. Diferencias APK vs web

| Tema | Web ancha (≥ 1024 px) | PWA angosta | APK |
| --- | --- | --- | --- |
| Crear CTL-IMP, CTL-PIS, CON-CAP, FRE-PAV, RCP-CAM, REG/LEV-OBS, IAA | En el editor 2.0 | Formulario por secciones | Formulario por secciones |
| Hojas de bloques (9) | Sí, solo admins | No | Solo ver ficha y PDF |
| IAA (medir) | Editor 2.0 | Banner «Se mide en el APK» | AR o foto + wincha |
| Cámara con sello | `WebCamera` | `WebCamera` | `FormCamera` |
| Galería | Portal sella | Portal sella | Lilachat sella solo la cámara propia |
| Disco de la cola | Dexie | Dexie | AsyncStorage |

## 4. Historia reciente

- **05/11** CTL-IMP se crea desde Lilachat (F1). Cola sin señal, fotos seguidas,
  formularios que abren sin red (F2).
- **06/11** CTL-PIS desde Lilachat: unidades por despacho, 4 fotos con GPS. Pedido de
  12 carros probado. Responsable antes del informe. Foto sin esperas: el GPS se lee al
  abrir. Quitar una foto enviada.
- **07/11** Fotos adicionales por unidad (j-07b, hasta 10). «Llegó» abre la foto de
  ingreso. «Ver PDF» junto a «Publicar».
- **09/11** Cada línea de «Todavía falta» abre la unidad que nombra.
- **11/11** REG-OBS y LEV-OBS encendidos; la web móvil también registra. Editor 2.0 de
  Portal embebido en la web.
- **12/11** CON-CAP con GPS, calle y progresiva solas. En la web ancha un informe nuevo
  nace en el editor. Cámara Timemark en informes y formularios; una sola compresión.
  «Enviar al grupo» solo admins. Auditoría de fotos en el celular (progreso por
  tarjeta, «Guardar» en vez de «Enviar»). Los 9 puntos de José.
- **13/11** FRE-PAV y RCP-CAM desde el canal. Sello visible en «Enviar» y en el visor.
- **14/11** La descripción de una foto de fresado nombra su momento y tramo.
- **15/11** IAA, FRE-PAV y RCP-CAM nacen en el editor en la web ancha. Vista previa
  del borrador dentro de la app (APK).
- **19/11** CTL-IMP: basta una bandeja completa; una a medias se valida entera
  (`formSamples.ts`). Indicador «Obteniendo ubicación…» y su error al leer el GPS de una foto.
  Rediseño compacto del formulario (`imp-*`): aprobado por José e implementado en web y APK.
- **19/11** CTL-PIS: «Terminar unidad» (solo admins). Revisión de las fotos con casillas,
  miniatura rota fuera sola, envío por `enviar_fotos_de_unidad` (spec §24).
- **16/11** Hojas de bloques en la web ancha. «Reintentar» del editor. Portal arregló
  el retraso de 60 s de su service worker (ec9a18f0).

## 5. Diseños de Stitch relacionados

| Diseño | Estado | Evidencia |
| --- | --- | --- |
| j-01 crear informe | Implementado | `CreateReportSheet.tsx`, `CreateReportDialog.tsx` |
| imp-01/02/03 CTL-IMP compacto | Implementado (capturas y revisor pendientes) | `CompactFields.tsx` web y APK, `compactReportForms.ts`, `sampleRows.ts`; auditorías `imp-0*.md` |
| j-02 hub | Implementado | `ReportDocumentScreen.tsx`, `ReportDocumentWeb.tsx` |
| j-03 tramos | Implementado | `ReportItemsView.tsx`, `ReportItemsWeb.tsx` |
| j-04 publicar | Implementado | `PublishSheet.tsx`, `PublishDialog.tsx` |
| j-05/j-06 unidades de pista | Implementado | `ReportUnitsView.tsx`, `ReportUnitsWeb.tsx`, `shared/src/reportUnits.ts` |
| j-07b fotos adicionales | Implementado | 3 referencias en código |
| cam-01…cam-06 cámara | Implementado APK y web | `FormCamera.tsx`, `CamaraDelChat.tsx`, `WebCamera.tsx` |
| ob-01, ob-02, ob-03 observaciones | Implementado | `observations/*` (APK), `ObservationsWeb.tsx` |
| ob-07b lienzo con mapa | No implementado en Lilachat | sin referencia en código |

El inventario marca j-01…j-06 «pendiente de la mirada de José».

## 6. Pendientes y deuda conocida

- **E2E con un miembro no admin** desde un iPhone en Test: pendiente de José (según spec §7).
  El miembro sin montos y las hojas de bloques solo están cubiertos por tests.
- **Portal (según spec §15):** ver la imagen al tocarla en el editor; avisar valores
  imposibles (22,2 g/cm³ dio 986,7 %); la hoja que se desplaza sola al guardar.
  Hallazgos de 360ebfc1 pendientes de deploy.
- **FRE-PAV (según as-is 0.1.170):** un documento nuevo marca «Datos de la jornada»
  como LISTA con valores por defecto; el clima no se llenó solo en el emulador (sin GPS).
- **Galería y web:** suben sin el sello de Lilachat; sella y recomprime Portal.
- **Sin verificar:** la cámara web en un celular real, la grabación de video en un
  teléfono real, cuánto tarda el sellado de un video de 3 min en la mini, fotos 3:4
  en un teléfono real (según spec §19).
- **«Ver PDF» de tarjetas:** necesita `link.mime` de agentes o Portal (pedido 14/11).
- **Agentes (según spec §7):** ocultar del ⚡ las escrituras de informes; Portal
  tenía 50 de 50 herramientas (subir `MAX_TOOLS`). No verificado si se cerró.
- Observaciones sin responsable, plazo ni autor: el contrato no los trae (según spec §13).

## 7. Pruebas

- **Shared:** `formSamples.test.ts`, `reportScreenPlace.test.ts`, `fieldDocument.test.ts`, `reportCreation.test.ts`, `reportSaves.test.ts`,
  `reportQueue.test.ts` (con `reportQueue.fixture.ts`), `reportScreen.test.ts`,
  `reportUnits.test.ts`, `unitAlbum.test.ts`, `unitAlbumSend.test.ts`, `reportPdf.test.ts`, `reportPhotoCaption.test.ts`,
  `fieldAutofill.test.ts`, `portalEmbed.test.ts`, `observations.test.ts`,
  `observationWrite.test.ts`, `photoStamp.test.ts`, `timemarkStamp.test.ts`.
- **Server:** `bots/clientReports.test.ts`, `bots/unitAlbumForm.test.ts`, `bots/observationForms.test.ts`,
  `bots/photoStamp.test.ts`, `bots/formPhotoPlaces.test.ts`, `bots/clientFiles.test.ts`,
  `videoStamp.test.ts`, `chatMediaStamp.test.ts`.
- **Web:** `CreateReportDialog.test.tsx`, `ReportDocumentWeb.test.tsx`,
  `PublishDialog.test.tsx`, `UnitAlbumDialog.test.tsx`, `PortalEmbedWeb.test.tsx`, `ObservationsWeb.test.tsx`, `PlaceStatusWeb.test.tsx`.
- **APK:** `reports/apkReportTypes.test.ts`, `chat/camara/cameraRequests.test.ts`,
  `chat/camara/zoom.test.ts`. Sin tests de render de las pantallas de informe.
- **Maestro:** no hay flujo de informes en `app/.maestro/` (verificado).
- **E2E manuales documentados:** web en el Chrome de José y APK en el emulador, espacio
  Test, servicio «QA-CTLPIS — borrar», limpieza por el camino de la app.
