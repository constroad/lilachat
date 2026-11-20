# As-is · Chat: medios y archivos

## 1. Qué es

Todo lo que no es texto en un mensaje: fotos, videos, notas de voz, documentos y PDF.
Incluye la cámara del chat con sello, el clip, el visor, el reproductor y la biblioteca «Medios».
Los archivos viven en el disco propio de Lilachat (pendiente 82); los viejos siguen en lila.

**Fecha de corte:** 17/11/2026.

## 2. Qué hace hoy

### APK (`app/src/chat/`, `app/src/media/`, `app/src/settings/storage/`)

**Enviar**
- Clip ordenado (diseño `m-01`): `AttachSheet.tsx`, con «Fotos recientes» primero (13/11) y la galería entera (pendiente 113).
- Varios a la vez (pendiente 112): `attachSelection.ts`, `useAdjuntosDelChat.ts`, `useArchivosDelChat.ts`.
- Vista previa antes de enviar con pie y «HD»: `EnviarFotos.tsx`, `envioDeFotos.ts`, `shrinkPhoto.ts`.
- Recortar y girar antes de enviar (01/11, como WhatsApp): `crop/CropEditor.tsx`, `CropFrame.tsx`, `cropMath.ts`, `cropPhoto.ts`.
- Fotos elegidas esperan como miniaturas dentro del campo (13/11): `StagedStrip.tsx`.
- Pegar una imagen copiada: `useClipboardImage.ts`, `PasteImageChip.tsx`.
- Subida con anillo de progreso: `mediaUpload.ts`, `subidaXhr.ts`, `AnilloDeSubida.tsx`, `progresoDeSubida.ts`, `colaDeArchivos.ts` + `colaDeArchivosMotor.ts`, `mensajeSubido.ts`.
- La foto aparece al instante en la burbuja mientras sube (20/10).
- Responder con foto o archivo a un mensaje citado (10/11): `useAdjuntosDelChat.ts` lleva `replyToSeq`.

**Cámara única del APK** (`camara/`, 13/11: «solo un componente cámara»)
- `Camera.tsx`: la usan el chat, los informes, los formularios, las observaciones y el Drive.
- Foto y video (hasta 3:00, `shared/src/videoClock.ts › MAX_VIDEO_SECONDS`): `ModeSwitch.tsx`, `useVideoRecording.ts`, `VideoPreview.tsx`.
- Sello en vivo tipo Timemark (hora, fecha, día, dirección, GPS; nunca el nombre): `StampOverlay.tsx`, `useLiveStamp.ts`, `StampedPreview.tsx`.
- **La dirección del sello (18/11):** en el APK la pide primero el geocodificador del teléfono (`Location.reverseGeocodeAsync`, el mismo que usa Timemark), con un tope de 4 s. `devicePlaceOf` en `shared/src/devicePlace.ts` arma el texto: calle, lote, distrito y código postal, sin el país. Esa dirección viaja con la foto en el campo `place`. El server la limpia (`cleanPlace`, 120 caracteres como máximo) y la quema (`placeOfShot`). Sin ella, el server la busca en Nominatim como antes. La PWA siempre usa Nominatim: el navegador no tiene geocodificador, y OpenStreetMap no tiene muchas calles de los distritos de afuera de Lima. Por ejemplo, para la planta sale «Lurigancho, Lima, Lima Metropolitana» donde Timemark dice «Avenida Central Mz.126 - Lt.80».
- Logo del espacio por chip (arriba a la derecha): `CameraChips.tsx`, `cameraLogoPref.ts`.
- Zoom .6x / 1x / 2x y pellizco: `ZoomControls.tsx`, `zoom.ts`. Flash: `flash.ts`.
- En horizontal, controles en columna a la derecha (13/11).
- Entrada del chat: `CamaraDelChat.tsx` («Para:», recientes, disparador; diseño `f2-app-camara`). Host: `CameraHost.tsx`, pedidos `cameraRequests.ts`.
- Formularios: `FormCamera.tsx` con «Repetir» y «Usar foto».

**Ver**
- Burbuja de foto, video, GIF, archivo: `MessageMedia.tsx`, `bubbleWidths.ts`, `cardWidth.ts`.
- Álbum en cuadrícula como WhatsApp (23/10): `AlbumGrid.tsx`; motor `shared/src/albums.ts`.
- Visor de fotos y videos: `VisorDelChat.tsx`, `VisorDeImagen.tsx`, `PaginaDelVisor.tsx`, `visor.ts`.
- La foto crece desde su burbuja y vuelve al cerrar (02/11, como Telegram): `ViewerTransition.tsx`, `zoomFromBubble.ts`, `photoOrigin.ts`.
- El visor pregunta antes de borrar para todos (13/11).
- Video subido: `expo-video`, sigue sonando con la pantalla apagada (pendiente 74): `uploadedVideoSource.ts`.
- Video de YouTube, Instagram, Facebook o TikTok dentro de la app: `VideoEmbedPlayer.tsx` (sin mini reproductor flotante).
- Guardar y compartir: `guardarYCompartir.ts`. «Descargar» de un video guía a guardarlo en la app de la red (01/11).

**Notas de voz**
- Grabar como WhatsApp: `BotonDeVoz.tsx`, `useGrabadorDeVoz.ts`, gestos `gestoDeVoz.ts` (soltar envía, deslizar cancela, subir bloquea).
- Opciones y modo de audio: `opcionesDeGrabacion.ts`, `audioMode.ts`.
- La pantalla no se bloquea mientras grabas (pendiente 115): `recordingWakeLock.ts`.
- Burbuja con onda: `NotaDeVoz.tsx`, `VoiceNoteView.tsx`, `notaDeVozMotor.ts`, caché `voiceNoteCache.ts`, nombre `voiceNoteName.ts`.
- Sigue sonando fuera del chat con barra arriba (22/10): `NowPlayingBar.tsx`, `voicePlayer.ts`, `releasePlayer.ts`.
- Audios seguidos (04/11): `useVoiceNoteQueue.ts`.

**Documentos y PDF**
- Tarjeta de archivo: `TarjetaDeArchivo.tsx`.
- El PDF muestra su primera página recortada desde arriba y «N páginas» (17/11).
- Tocar ofrece «Abrir» o «Descargar» (17/11): `fileActions.ts`.
  - «Abrir» deduce el tipo por la extensión (kml, kmz, xlsx, docx, dwg…). Si nadie lo abre, sale la hoja de compartir.
  - «Descargar» usa el descargador del teléfono; queda en Descargas con su nombre (`archivoDescargado.ts`).
- Visor de PDF en la app (pendiente 7): `pdf/PdfViewerScreen.tsx`, `PdfPageView.tsx`, `usePdfDocument.ts`, `usePdfViewer.tsx`, `pdfSource.ts`.
- Zoom con dos dedos en el visor (17/11): `pdf/pdfLayout.ts`. Al soltar salta a 100, 125, 150, 200, 250 o 300 %.
- Doble toque en el visor (18/11): de 100 % pasa a 200 % sobre el punto tocado; desde cualquier otro zoom vuelve a 100 % (`zoomAfterDoubleTap`).
- Un enlace de una tarjeta a un PDF, foto o video abre el visor de Lilachat (14/11).

**Del chat y del teléfono**
- «Compartido en el chat» con pestañas Media · Docs · Links: `CompartidoEnElChat.tsx`.
- «Medios» de todos mis chats por mes, con «Todo» y búsqueda: `app/src/media/MediaScreen.tsx` (diseño `busqueda-archivos`).
  Toque largo en una foto, video o documento: la misma hoja que un archivo del Drive (`DriveFileSheet`, José 19/11,
  diseño cc-05) con «Ver en el chat», Copiar enlace, Copiar archivo, Compartir y Descargar (`mediaItemAsFile`).
- Almacenamiento por chat: `app/src/settings/storage/StorageScreen.tsx`, `StorageFilesScreen.tsx`, `localBuckets.ts`.
- Chats secretos: fotos, videos, documentos y notas de voz cifrados de punta a punta (29/10): `secretMedia.ts`, `secretMediaFiles.ts`, `app/src/crypto/sealedFiles.ts`.

### Web/PWA (`web/src/chat/`, `web/src/media/`)

- Clip: `AttachMenu.tsx` (diseño `m-01`).
- Diálogo de envío con pie, «HD» y quitar: `EnviarArchivos.tsx` (`SendFilesDialog`), `stagedFiles.ts`, `StagedFilesWeb.tsx`.
- Archivos en espera dentro del campo; el botón dice «Enviar» (13/11).
- Pegar imagen: el texto escrito pasa como pie (`TypedCaption`, 11/11). Enter envía, Shift+Enter no.
- Subida y compresión: `mediaUpload.ts`, `shrinkPhoto.ts`, `colaDeArchivos.ts`, `colaDeArchivosWeb.ts`, `progresoDeSubida.ts`, `AnilloDeSubida.tsx`.
- Burbuja: `BurbujaDeMensaje.tsx`, estilo de foto `photoBubbleStyle.ts`; una foto vertical sale entera (04/11).
- Álbum: `AlbumGridWeb.tsx`. Visor: `VisorDeFotos.tsx` (foto, video y PDF, sin negro).
- PDF: tarjeta con la primera página `PdfCardWeb.tsx` («3 páginas · 255 KB · PDF», 17/11).
- PDF dentro de la web: `PdfViewer.tsx`, con el visor propio del navegador, servido por `GET /api/chats/:id/files/:seq`.
- Descargar con su nombre: enlace con `download` y `downloadUrlOf` (17/11).
- Cámara del celular en la web (12–13/11): `camera/WebCamera.tsx`, `useWebCamera.ts`, `cameraControls.ts`, `shotStamp.ts`, `ComposerCameraButton.tsx`. Sello en vivo, zoom, flash, galería y revisión.
- Notas de voz: `useGrabadoraDeVoz.ts`, `BarraDeGrabacion.tsx`, `nivelDeAudio.ts`, `NotaDeVoz.tsx`, `voicePlayer.ts`, `NowPlayingBar.tsx`, `useVoiceNoteQueue.ts`.
- La nota de voz sigue sonando en otro chat, con su barra arriba de la lista (22/10).
- Videos: `VideoEmbedOverlay.tsx` (YouTube y otros), mini reproductor `web/src/media/MiniVideoPlayer.tsx`, `miniPlayer.ts`.
- «Medios»: `web/src/media/MediaDialog.tsx`. Archivos del chat en la info: `info/ArchivosDelChat.tsx`.
  Cada foto, video o documento lleva el «⋮» del Drive (`DriveFileMenu`): hoja inferior en el celular, menú flotante
  en la computadora (José 19/11). «Enlace copiado» sale como aviso flotante con check (`ui/FloatingNotice.tsx`).
- Almacenamiento del navegador: `web/src/storage/StorageChoice.tsx`.

### Server (`server/src/`)

- Subida: `POST /api/media` (`mediaRoutes.ts`). Lee `MessageTarget` para respuesta e hilo (10/11).
- Tipo real por los bytes, no por la etiqueta del teléfono (14/11): `trueImageMime` de shared.
- Límites (`shared/src/media.ts › MAX_BYTES_BY_KIND`): foto 25 MB, video 90 MB, audio 25 MB, archivo 90 MB.
- Disco propio (pendiente 82): `mediaDisk.ts`, `localMediaUploader.ts`, `mediaInit.ts`, `discoInit.ts`. Raíz `CHAT_STORAGE_ROOT`.
- Servir: `GET /media/*` (`mediaServeRoutes.ts`) con rangos (206); `?download=<nombre>` responde `attachment` (17/11).
- Compresión de fotos con la escalera de Portal (28/10): `photoShrink.ts`.
- Sello de la cámara del chat, quemado una vez al comprimir: `chatMediaStamp.ts` (foto), `videoStamp.ts` (video con ffmpeg, AAC).
- Primera página del PDF (17/11): `pdfThumbnail.ts` con `pdfjs-dist` y `@napi-rs/canvas`. Tope 15 s y 40 MB. Guarda `media.thumbUrl` y `media.pages`.
- Relleno de PDF viejos: `pdfThumbnailBackfill.ts`. En la mini, desde la RAÍZ de la release: `node_modules/.bin/tsx server/src/pdfBackfillCli.ts` (sin `--apply` solo cuenta). `npm run pdf:miniaturas -w server` falla allí: corre en `server/` y `env.ts` no encuentra el `.env`, que Torre enlaza en la raíz.
- PDF por Lilachat con chequeo de membresía: `GET /api/chats/:chatId/files/:seq` (`fileViewRoutes.ts`).
- Medios cifrados de chats secretos: `sealedUpload.ts` (el server solo ve la forma).
- Biblioteca «Medios»: `GET /api/media/library` (`mediaLibraryRoutes.ts`).
- Almacenamiento: `GET /api/me/storage`, `GET /api/me/storage/chats/:chatId/files` (`storageRoutes.ts`).
- Reenviar foto o archivo: copia la referencia, no el archivo (`reenvio.ts`).
- Onda de la nota de voz: `ondaDeVoz.ts`. Miniatura en el push: `pushPreview.ts`.
- Una foto de la cámara hacia un boleto de subida de Portal: `stampedForward.ts` (`/api/stamped-forward`).

### Shared (`shared/src/`)

- Medios y límites: `media.ts`, `fileNames.ts` (`readableFileName`, `downloadUrlOf`), `pdfCard.ts` (`isPdfMedia`, `pdfCardLineOf`).
- Fotos: `photoSizing.ts`, `photoViewer.ts`, `albums.ts`, `messageThumbs.ts`.
- Sello: `timemarkStamp.ts`, `photoStamp.ts`, `videoClock.ts`.
- Voz: `notaDeVoz.ts`, `voiceNote.ts`, `ondaDeVoz.ts`, `nowPlaying.ts`.
- Video embebido: `videoEmbed.ts`. Visor de archivos: `fileViewer.ts`.
- Biblioteca y pestañas: `mediaLibrary.ts`, `mediasDelChat.ts`. Almacenamiento: `storage.ts`.
- Cifrado de medios: `mediaCrypto.ts`.

## 3. Diferencias APK vs web

| Función | APK | Web |
| --- | --- | --- |
| Recortar y girar antes de enviar | Sí (`crop/`) | No |
| Zoom con dos dedos y doble toque en el PDF | Sí (`pdfLayout.ts`) | Visor del navegador |
| Abrir/Descargar con otra app | Sí (`fileActions.ts`) | Descarga con nombre |
| Medios de chats secretos | Cifrados de punta a punta | No abre chats secretos |
| Cámara con sello | Sí, cámara única | Sí en el navegador del celular (12/11) |
| Cámara en horizontal | Sí (controles a la derecha) | No verificado |
| Logo del espacio en el sello | Sí (chip) | Sí (preferencia `lilachat.camara.logo`) |
| Audio del video con pantalla apagada | Sí (`expo-video`) | No aplica |
| Mini reproductor de video | No (descartado para YouTube por sus términos) | Sí (`MiniVideoPlayer.tsx`) |
| Adjuntar en un hilo | No | Sí (ver `chat-hilos.md`) |

## 4. Historia reciente

- **17/10 (FL9b):** varias fotos con pie y notas de voz como WhatsApp.
- **19–20/10:** fotos al instante, comprimidas, con «HD». Reenviar fotos y archivos.
- **20/10 (0.1.106):** cámara propia con la foto al instante.
- **21/10:** pegar la imagen copiada (0.1.116). El audio sigue con la pantalla bloqueada (0.1.115). Visor web con video y PDF.
- **22/10:** visor de PDF en la app (pendiente 7). La nota de voz sigue al salir del chat (0.1.137). Videos embebidos.
- **23/10:** medios en el disco propio, sin lila (pendiente 82). Álbum en cuadrícula. Video con la pantalla apagada.
- **28/10:** una sola regla para comprimir fotos, la de Portal. Pendientes 111–113: clip sin acciones, varios a la vez, galería entera.
- **29/10:** fotos, videos, documentos y notas de voz cifrados en chats secretos.
- **29/10:** «Medios» con «Todo» y búsqueda.
- **01/11:** recortar y girar la foto (con arreglos del gesto «atrás» a 40 dp). «Descargar» del video.
- **02/11 (plan 1, F2):** la foto crece desde su burbuja.
- **04/11:** audios seguidos. Una foto vertical sale entera en la web.
- **12/11:** la cámara del chat con el sello tipo Timemark, foto y video. También en la web del celular.
- **13/11:** una sola cámara en el APK. Logo arriba a la derecha. Zoom en columna, pellizco y .6x. Miniaturas en espera dentro del campo.
- **13/11:** el visor pregunta antes de borrar para todos. La raíz del hilo muestra su foto.
- **14/11:** el tipo de imagen sale de los bytes. Una tarjeta con enlace a PDF, foto o video abre el visor.
- **17/11:** José no pudo bajar «METRADOS 161126.kml»: «Abrir» o «Descargar» en el APK, nombre propio en la web.
- **17/11:** José mandó «Cotizacion-103.pdf» y solo salía el nombre: primera página en el chat, relleno de los viejos y zoom con dos dedos.
- **18/11:** José tocó dos veces el PDF y no hizo zoom. Doble toque: 200 % sobre el punto, y otra vez a 100 %. Las mejoras del visor del 17/11 no le llegaban porque no se había publicado la OTA; salió el 18/11.

## 5. Diseños de Stitch relacionados

| Diseño | Estado | Evidencia |
| --- | --- | --- |
| `m-01-clip-ordenado` | Implementado | `app/src/chat/AttachSheet.tsx`, `web/src/chat/AttachMenu.tsx` |
| `f2-app-camara` | Implementado | `app/src/chat/camara/CamaraDelChat.tsx` |
| `cam-01-camara-vertical` | Implementado | `camara/StampOverlay.tsx`, `CameraChips.tsx`; web `WebCamera.tsx` |
| `cam-02-camara-horizontal` | Implementado en el APK | `camara/Camera.tsx`; web no lo cita |
| `cam-03-revision` | Implementado | `camara/FormCamera.tsx`, `Camera.tsx`; web `WebCamera.tsx` |
| `cam-04-video-listo` | Implementado | `camara/ModeSwitch.tsx`, `CamaraDelChat.tsx` |
| `cam-05-video-grabando` | Implementado | `camara/useVideoRecording.ts`, `shared/src/videoClock.ts` |
| `cam-06-video-revision` | Implementado | `camara/VideoPreview.tsx` |
| `visor-archivos` | Implementado | `VisorDeImagen.tsx`, `pdf/PdfViewerScreen.tsx` |
| `busqueda-archivos` | Implementado | `app/src/media/MediaScreen.tsx`, `web/src/media/MediaDialog.tsx` |

El sello va abajo a la izquierda aunque `cam-01` y `cam-03` lo dejen a media altura (nota del INVENTARIO).

## 6. Pendientes y deuda conocida

- **Web sin recorte ni giro antes de enviar.** Verificado en código (`EnviarArchivos.tsx` no tiene recorte).
- **PDF en la web sin zoom propio:** depende del visor del navegador. Verificado en código (`PdfViewer.tsx`).
- **Backlog 67 / F12.3 dice que la media de chats secretos viaja en claro.** El código ya la cifra desde el 29/10 (`sealedUpload.ts`, `secretMedia.ts`). El backlog quedó sin tachar. Verificado en código.
- **Relleno de miniaturas de PDF viejos:** corrido el 18/11 por lila-2 (release `20261118-000140-18cc63cc`): 48 sin miniatura, 33 dibujadas, 15 no porque piden contraseña (pdf.js no los abre). Quedan solo con el nombre.
- **El script `pdf:miniaturas` no lee el `.env` en la mini** (cwd `server/`). Arreglarlo o dejar la ruta desde la raíz. Sin hacer.
- **Respuesta con foto en el hilo del APK tras el OTA:** sin verificar en pantalla. Según spec (13/11).
- **Sello con una tarjeta real y con datos lentos:** no verificado.
- **Mini reproductor flotante para YouTube:** no se hace; los términos de YouTube lo prohíben. Según spec (pendiente 6).

## 7. Pruebas

- **Shared:** `media`, `fileNames`, `pdfCard`, `photoSizing`, `photoViewer`, `albums`, `messageThumbs`, `timemarkStamp`,
  `photoStamp`, `videoClock`, `notaDeVoz`, `voiceNote`, `ondaDeVoz`, `nowPlaying`, `videoEmbed`, `fileViewer`,
  `mediaLibrary`, `mediasDelChat`, `mediaCrypto` (`shared/src/*.test.ts`).
- **Server:** `pdfThumbnail`, `pdfThumbnailBackfill`, `chatMediaStamp`, `videoStamp`, `photoShrink`, `localMedia`,
  `mediaTarget`, `fileView`, `mediaLibrary`, `disco`, `stampedForward` (`server/src/*.test.ts`).
- **APK:** `archivoDescargado`, `clipboardImage`, `zoomFromBubble`, `photoOrigin`, `visor`, `attachSelection`,
  `envioDeFotos`, `colaDeArchivosMotor`, `progresoDeSubida`, `mensajeSubido`, `uploadedVideoSource`, `secretMedia`,
  `voicePlayer`, `useVoiceNoteQueue`, `recordingWakeLock`, `gestoDeVoz`, `opcionesDeGrabacion`, `notaDeVozMotor`,
  `voiceNoteName`, `releasePlayer`, `audioMode`, `camara/cameraRequests`, `camara/zoom`, `crop/cropMath`,
  `pdf/pdfLayout`, `pdf/pdfSource` (`app/src/chat/**`).
- **Web:** `BurbujaDeMensaje.file`, `VisorDeFotos`, `AlbumGridWeb`, `photoBubbleStyle`, `EnviarArchivos`, `stagedFiles`,
  `mediaUpload`, `shrinkPhoto`, `colaDeArchivos`, `progresoDeSubida`, `NotaDeVoz`, `voicePlayer`, `nivelDeAudio`,
  `useVoiceNoteQueue`, `NowPlayingBar`, `camera/shotStamp`, `camera/cameraControls`, `camera/cameraRequests`,
  `media/MiniVideoPlayer`, `media/miniPlayer`, `media/media`, `storage/StorageChoice`.
- **Maestro:**
  - `app/.maestro/chat-file.yaml`: el KML se descarga y queda en `/sdcard/Download/METRADOS 161126.kml` (arnés `scripts/e2e-dali.ts`).
  - `app/.maestro/chat-pdf.yaml`: tarjeta con la página y «4 páginas · 3.3 KB · PDF», visor «1 / 4», doble toque a «200 %» y de vuelta a «100 %» (verde el 18/11). El pellizco se mandó aparte con `adb root` + `sendevent`.
