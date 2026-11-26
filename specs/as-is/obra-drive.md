# As-is · Drive del servicio

> Fecha de corte: **20/11/2026**. Fuentes: código de `main`, `git log` desde el 29/10,
> `specs/ARCHITECTURE.spec.md` (§169, §171, §175 y «Drive del servicio», 06/11 y 13/11) y
> `design/stitch/INVENTARIO.md`.

- **Sin señal (26/11):** toda subida al Drive pasa por la cola de campo y sale sola al volver la red; ver `plataforma-sin-senal.md`.

## 1. Qué es

La pestaña «Drive» de cada servicio del canal del cliente. Muestra y sube los archivos
que Portal guarda en el Drive de ese servicio: fotos, videos y documentos.

- José 06/11: «los videos no van en informes nunca». Fotos y videos sueltos entran por
  el Drive, en la raíz del servicio, sin informe.
- José 07/11: el Drive es de **todos los miembros del canal** (`canSeeDrive`). La marca
  vieja `files` se sigue leyendo; ya no hay marca «Drive» en los accesos.
- Los datos viven en Portal. Lilachat lista, sube y abre en su visor.

## 2. Qué hace hoy

- **Un solo botón «Subir»** (José 13/11: «nunca vi un diseño que tenga varios botones en un drive»).
- **20/11 (José: «no está como lo diseñaste», diseño cc-05):** sin la cabecera «DRIVE DEL SERVICIO · N
  archivos»; el buscador va justo bajo la franja de pegar, y el selector Lista / Cuadrícula a la derecha de
  los chips. **Mosaico por defecto** (web: `localStorage` solo guarda «lista» si se eligió; APK: arranca en
  cuadrícula). **Carpetas siempre en tarjetas** (ícono, nombre y «41 archivos», `driveFilesLabel`): 2 por
  fila en el teléfono, 3 en tablet, 4 en computadora; en lista y en cuadrícula. **Mosaico** por día de Lima
  («HOY · 19 NOV», sin el título «Recientes»): cada mosaico lleva la etiqueta del tipo arriba a la izquierda
  (`driveTypeTag`: JPG, MP4, PDF, XLSX, DOCX), la miniatura o el ícono del archivo, el nombre, «hoy 08:30 ·
  2.1 MB» (`driveTileLine`) y «⋮» (APK: «⋮» o toque largo; en el teléfono abre la hoja inferior). 2, 3 o 5
  por fila. La lista conserva «Recientes» y la línea «carpeta · peso · día» (`driveFileLine`).
- **19/11 (diseño cc-05):** «Pegar», la cámara y «Subir» van a la derecha de la barra del servicio
  (web). **Pegar:** Ctrl+V en cualquier parte del Drive sube la imagen o el archivo copiado; el botón
  «Pegar» lee el portapapeles (solo imágenes); la franja «Pega aquí una imagen o un archivo (Ctrl+V) o
  arrástralo» se ve en computadora (`web/src/spaces/clients/useDrivePaste.ts`). Lo pegado sin nombre se
  llama `pegado-AAAAMMDD-HHMMSS.png` (`shared/src/driveFileActions.ts` › `pastedDriveName`).
- **Menú «⋮» de cada archivo** (`driveFileActions`, web `DriveFileMenu.tsx`), en el orden de cc-05 móvil:
  Abrir vista previa, Copiar enlace, Copiar archivo (solo imágenes: el portapapeles del navegador lleva PNG;
  la web la redibuja a PNG), Compartir (donde hay hoja de compartir: `navigator.share` en la web, `Share` en
  el APK), «Marcar como antes / después» con «Vincula esta foto al reporte fotográfico» (solo foto con id;
  abre el visor con su barra) y Descargar. «Mover a carpeta» del diseño no está: Portal no tiene herramienta.
- **Celular = hoja inferior** (José 19/11, cc-05 móvil): bajo 768 px (`useCompactShell`) el «⋮» abre una hoja
  desde abajo con miniatura, nombre, «Hoy 09:40 · carpeta · 1.8 MB» (`driveSheetLine`) y ✕; en la
  computadora sigue el menú flotante. Es el mismo componente en el Drive del servicio y en «Medios».
- **«Enlace copiado»** (José 19/11): aviso flotante abajo con check al copiar enlace o archivo
  (`web/src/ui/FloatingNotice.tsx`, `driveNoticeDone`); en el APK, el toast de Android.
- «Subir» ofrece «Tomar foto», «Grabar video», «Desde la galería» y «Documento»
  (`DRIVE_UPLOAD_OPTIONS`, `shared/src/driveView.ts`). Sin cámara en vivo: galería y documento.
- Botón de cámara junto a «Subir»: abre la cámara con FOTO / VIDEO, sello y GPS
  (stitch-design §5-ter: la evidencia abre la cámara al primer toque).
- Chips Todo · Fotos · Videos · Documentos (`filesOfKind`).
- Cuadrícula con miniaturas por día de Lima («Hoy · 13 nov», `driveDayGroups`) y
  carpetas en tarjetas. Columnas por ancho: 2, 3 o 5 (carpetas: 2, 3 o 4).
- Documentos: PDF, Word, Excel y PowerPoint. El tipo sale de la extensión
  (`documentTypeOf`): Android a veces manda `application/octet-stream`. Etiqueta PDF /
  XLSX encima de la miniatura.
- Visor: fotos y videos en el visor del chat; PDF en su visor con «Descargar». Un tipo
  desconocido abre una pestaña nueva (web).
- **Antes / después** (08/11): desde el visor se marca una foto como antes o después
  (`PhotoPhaseBar`, kind `photo_phase` → `marcar_foto_antes_despues`).
- Enlace al Drive del cliente (carpeta de Portal) en la lista de «Servicios».
- Importar calles del mapa: el KMZ o KML sale del Drive (ver `obra-mapa.md`).

### Subida

- Foto sin sello (galería): se achica al estándar de Portal y sube directo al boleto de
  Portal (`service-drive-upload`).
- Foto o video de la cámara de Lilachat: va a `POST /api/stamped-forward`. El server
  quema el sello, comprime una vez y reenvía al boleto (`server/src/stampedForward.ts`).
- Video: tal cual, tope 60 s y 50 MB. Documentos: tope 50 MB.
- Solo sube lo que el boleto anuncia en `upload.mimeTypes`. Si no: «Ese tipo de archivo
  no se puede subir al Drive.».

### Web/PWA

- `web/src/spaces/clients/ServiceDriveWeb.tsx`, `DriveParts.tsx` (menú «Subir», «Suelta
  aquí…» para arrastrar), `PortalFileViewer.tsx`, `useDriveUpload.ts`, `PhotoPhaseBar.tsx`.
- La vista elegida se recuerda en `localStorage` (`lilachat.drive.vista`); sin dato, mosaico.
- La cámara web (`WebCamera`) aparece en cualquier equipo con cámara.

### APK

- `app/src/spaces/clients/ServiceDrive.tsx`, `DriveGrid.tsx`, `DriveHeader.tsx`,
  `DriveUploadSheet.tsx` (hoja inferior), `FileThumb.tsx`, `useDriveUpload.ts`,
  `useFileViewer.tsx`, `PhotoPhaseBar.tsx`.
- La subida va por `subirPorXhr`: `fetch` no envía un archivo por su `uri`.
- **Pegar del portapapeles** (19/11): botón junto a la cámara; lee la imagen copiada (`expo-clipboard`,
  ya en el APK), la guarda como PNG y sube como foto de galería (`drivePaste.ts`, `useDriveUpload.pasteImage`).
  Sin imagen copiada: «No hay una imagen copiada para pegar.».
- **Hoja de cada archivo** (19/11, `DriveFileSheet.tsx`, diseño cc-05 móvil): «⋮» en la fila o toque largo en
  la fila o el mosaico. Cabecera con miniatura, nombre, «fecha · carpeta · tamaño» y ✕. Abrir vista previa,
  Copiar enlace, Copiar archivo (foto: se baja a la caché y va al portapapeles como imagen), Compartir (hoja de
  Android con el enlace), «Marcar como antes / después» y Descargar (abre el navegador). El aviso de copiado es el
  toast de Android. La misma hoja sirve a «Medios» (`app/src/media/MediaScreen.tsx`).
- La vista elegida se recuerda mientras la app está abierta; arranca en mosaico. El selector va junto a
  los chips; «Pegar», cámara y «Subir» quedan en su fila a la derecha (`DriveHeader`).

### Server

- `GET /api/workspaces/:id/clients/:clientId/services/:serviceId/files` → evento
  `client.files.requested` (`server/src/bots/clientFiles.ts`).
- `POST …/reports/forms` con kind `drive_upload` → herramienta `subir_al_drive`
  (devuelve el boleto) y kind `photo_phase` → `marcar_foto_antes_despues`
  (`bots/photoPhaseForm.ts`).
- `POST /api/stamped-forward` (sello y reenvío).
- CSP: `connect-src` incluye `https://constroad.com` (sin eso el navegador corta la subida).

### Shared

`driveUpload.ts` (`isPortalUploadTicket`, `driveFileRefusal`, `formRunAnswer`),
`driveView.ts`, `serviceFiles.ts`, `photoPhase.ts`, `fileViewer.ts`, `workFiles.ts`.

### Dependencias

Portal guarda los archivos y emite el boleto (documentos desde 7822bc25). Agentes
filtraba los tipos del boleto y no dejaba pasar PDF; lo corrigió en a636426 (13/11).

## 3. Diferencias APK vs web

| Tema | Web/PWA | APK |
| --- | --- | --- |
| «Subir» | Menú | Hoja inferior |
| Arrastrar y soltar | Sí | No |
| Recordar vista | `localStorage` | Solo mientras la app vive |
| Envío | `fetch` | `subirPorXhr` |

## 4. Historia reciente

- **29/10** Drive del servicio a pedido (`client.files.requested`, f-06).
- **30/10** Una sola pestaña de archivos, con miniatura y visor.
- **06/11** Subir fotos y videos. El Drive vive en el servicio; se borró la pestaña
  «Archivos» del canal (los archivos del canal se ven en Media).
- **07/11** El Drive es de todos los miembros del canal.
- **08/11** Marcar una foto como antes o después desde el visor.
- **12/11** La cámara con sello también para lo que va al Drive (APK y web del celular).
- **13/11** Documentos; un solo «Subir»; lista y cuadrícula; filtro por tipo; cámara a
  un toque; sello visible en «Enviar» y en el visor.
- **20/11** Pestaña como cc-05: mosaico por defecto con etiqueta de tipo y «hoy 08:30 · 2.1 MB»,
- **20/11** Chips con su conteo («Todo 18», `driveKindCounts`), «Carpetas · N» (`driveFoldersLabel`), chevron en cada carpeta y «N archivos» en cada día (web y APK).
  carpetas en tarjetas con «N archivos», sin la cabecera «Drive del servicio».
- **20/11** Navegación real por niveles (José: «no respeta la carpeta como Portal»): entrar a una carpeta
  con sub-carpetas mostraba TODOS sus archivos aplanados, en vez de solo sus propias sub-carpetas. Arreglado
  en `shared/src/serviceFiles.ts` — `driveFolders`/`filesInFolder` ahora toman la ruta completa
  (`readonly string[]`, como hace Portal con `parentId`/`folderId`), no solo el primer segmento. Breadcrumb
  de varios niveles («‹ Drive › Fotos de obra › Día 1», cada nivel menos el último es un enlace) en
  `ServiceDriveWeb.tsx` y `ServiceDrive.tsx`; BACK del APK sube un nivel a la vez antes de salir del servicio.

## 5. Diseños de Stitch relacionados

| Diseño | Estado | Evidencia |
| --- | --- | --- |
| drv-01 lista | Implementado APK y web | `DriveHeader.tsx`, `DriveParts.tsx` |
| drv-02 cuadrícula | Implementado APK y web | `DriveGrid.tsx`, `driveDayGroups` |
| drv-03 subir | Implementado; la barra de progreso por archivo es una línea de estado | `DriveUploadSheet.tsx`, `DriveParts.tsx` |
| f-06 servicio con Drive | Implementado (el inventario dice «falta», está desactualizado) | 5 referencias en código |

Lo que Stitch inventó y no va: descripción de cada carpeta, peso en la tarjeta y
candado del PDF. Portal no manda esos datos.

## 6. Pendientes y deuda conocida

- **Video grande en campo:** puede tardar minutos y no sigue en segundo plano. Si la app
  se cierra, la subida falla y se reintenta a mano (según spec, 06/11).
- **Miembro sin cuenta de Portal:** pedido a Agentes y Portal que respondan
  `client.files.requested` (07/11). No verificado si se cerró.
- Las pruebas no ven el `fetch` de Expo: una subida rota en el APK solo la detecta el
  E2E en el emulador (según spec).
- Sin conteo en la pestaña: Portal no lo manda.

## 7. Pruebas

- **Shared:** `driveUpload.test.ts`, `driveView.test.ts`, `serviceFiles.test.ts`,
  `photoPhase.test.ts`, `fileViewer.test.ts`, `workFiles.test.ts`.
- **Server:** `bots/clientFiles.test.ts`.
- **Web:** `ServiceDriveWeb.test.tsx`, `PortalFileViewer.test.tsx`.
- **APK:** sin tests de render del Drive.
- **Maestro:** `chat-file.yaml` y `chat-pdf.yaml` prueban archivos del chat, no el Drive
  (no verificado su contenido en detalle). No hay flujo del Drive.
- **E2E documentado:** APK y web con dos PDF de QA en «QA-PISTA-APK — borrar» (13/11).

- **20/11** · cc-05 contra Stitch: Drive a todo el ancho del panel, nombre de archivo de 14 px, carpetas en
  carrusel en el teléfono y 4 por fila desde tablet, sin chevron y con radio de 12 px.
