# As-is · Chat: stickers, emojis, guiños, zumbido y GIF

## 1. Qué es

Lo expresivo del chat. Un panel con cuatro pestañas (`shared/src/panelTab.ts`): Emojis, Stickers, GIF y Guiños.
Además, el zumbido de Messenger, los emojis propios del espacio y los atajos «:hug».
Tono adulto: nada chibi ni infantil (decisión de José, §74).

**Fecha de corte:** 27/11/2026.

## 2. Qué hace hoy

### APK (`app/src/chat/`)

**Panel**
- Panel en el lugar del teclado, sin rebote: `PanelDeEmojis.tsx`, `EmojiToggle.tsx`, `EmojiStickerPanel.tsx`.
- Recuerda su última pestaña (21/10). Solo el botón emoji/teclado escucha al panel (plan 1, F4).
- Emojis: todas las categorías en una sola vista con barra que salta, «Recientes» primero (01/11): `emojiPanel.ts`, `emojiPanel/emojiLayout.ts`.
- Atajos «:hug» con sugerencias en el chat (30/10) y en el hilo (17/11): `emojiShortcode/useEmojiShortcode.ts`, `EmojiSuggestions.tsx`.

**Stickers** (`stickers/`)
- Panel con Recientes · Favoritos · Mis stickers y «Crear»: `StickerPanel.tsx`, `useStickers.ts`, `stickersApi.ts` (diseño `s1-app-panel-stickers`).
- Paquetes: «Lila» (24, WebP) y «En movimiento» (animado). El animado se reproduce como Lottie desde el 11/11 (0.1.182): `LottieStickerView.tsx`.
- Crear sticker desde una foto (diseño `s1-app-crear-sticker`): `CreateSticker.tsx`, `StickerCanvas.tsx`, `CutoutTools.tsx`, `useStickerCutout.ts`.
  - Recorte del sujeto con ML Kit en el teléfono; borrar y restaurar sobre el recorte (20/10).
  - Texto arrastrable, colores y borde; guarda en «Mis stickers» como WebP 512×512.
- Sticker recibido sin burbuja, con la hora debajo y reacciones: `StickerMessage.tsx`.
- Guardar el sticker de otro y marcarlo favorito. Responder con sticker (21/10).
- Dos stickers seguidos de la misma persona van en una fila (01/11).
- Un solo mosaico «Crear» con «Foto, video o GIF» (26/11, diseño `sc-01a`): abre la galería con fotos y videos (`pickStickerSource.ts`); `stickerSource.ts › stickerSourceKind` decide el editor. Una foto va al recorte (`CreateSticker.tsx`, recibe la foto por `StickerPhotoContext`, ya no abre la galería); un video o un GIF, al editor con sonido. Ya no hay «Desde un video» ni «Desde un GIF».
- «Convertir en sticker animado» de un GIF del chat (barra del mensaje, toque en el GIF y visor) abre el mismo editor con ese GIF, para ponerle sonido (26/11): se baja a la cache (`chatGifEditor.ts`) y lo dibuja `GifStickerEditorHost.tsx`, montado en `App.tsx`. «Enviar» lo manda al chat del GIF. Un GIF de chat secreto no se convierte.
- Sticker con sonido desde un video o un GIF (26/11, diseños `ss-01`, `ss-02`, `ss-03`): `CreateVideoSticker.tsx` con tramo de hasta 6 s (`VideoTrimStrip.tsx`, `videoStickerTrim.ts`, vista en bucle `useClipPreview.ts`) y hoja de sonido `StickerSoundSheet.tsx` (original, grabar `VoiceClipRecorder.tsx`, elegir un audio del teléfono, sonidos de Lilachat, sin sonido; `videoStickerSound.ts`).
  - Un GIF se ve con expo-image (expo-video no lo reproduce), sin tira de tramo: va entero desde el inicio (`startMs=0`, `endMs=6000`; el server lo corta a su largo). Sin «Sonido original»; empieza en «Sin sonido».
  - Sin texto sobre el sticker: el «Aa Texto» del diseño no está.
  - Si las miniaturas del tramo fallan (expo-video no lee la cantidad de cuadros de algunos archivos), la tira queda lisa con un aviso en consola.
  - En el chat, hilo y canal llega silenciado con el parlante `stickerSound.tsx`; al tocarlo suena 3 veces (`stickerSoundController.ts`) y la animación sigue mientras suena.

**GIF** (`gifs/`)
- Pestaña GIF con GIPHY: `GifPanel.tsx`, `GifGrid.tsx`, búsqueda a pantalla completa `GifSearchScreen.tsx`, `gifsApi.ts`, `gifOptions.ts`.
- La burbuja aparece al instante mientras el server guarda el GIF: `gifsInFlight.ts`.
- GIF animado en la burbuja; en la lista dice «GIF», no «Foto».
- Responder con un GIF a un mensaje citado (10/11). GIF nítidos con la versión de 200 px (10/11).
- Web (26/11): el GIF llena su burbuja como una foto, 300 px de ancho con 3 px de borde; sin texto lleva la hora encima (ver `chat-mensajes.md`).

**Guiños**
- Pestaña «Guiños» con tarjetas del personaje: `WinkPanel.tsx` (diseño `m-02`).
- Grupos (`shared/src/winks.ts › winkPanelGroups`): la temporada vigente primero, luego «Te ataco», «Personajes», «Obra y pistas» y «Emojis».
- Guiño a pantalla completa: `WinkOverlay.tsx`, `WinkCharacter.tsx`, `WinkSketch.tsx`, envoltura global `FunScreen.tsx`.
- En Android se reproduce con imágenes, ~46 cuadros por segundo (21/10): `winkImages.ts`, `winkTiles.ts`, `winkPlay.ts`, sonidos `winkSounds.ts`.
- Tarjeta del guiño en el chat con miniatura y «Devolver» para un ataque recibido: `nudge.tsx`.
- No se repite al volver a entrar; un guiño borrado no se reproduce: `funSeen.ts`, `funAvailable.ts`.
- Se elige y se borra como cualquier mensaje (01/11).
- En un grupo, solo si un admin los enciende: tarjeta «Diversión» `GroupFunCard.tsx` (diseño `m-05`).
- Responder con un guiño a un mensaje citado (10/11).

**Zumbido**
- Sacude toda la pantalla unos 2 s, suena y vibra; también vibra a quien lo manda y se puede repetir: `nudge.tsx`, `FunScreen.tsx`.
- Línea del chat con hora (diseño `m-04`).

**Emojis propios del espacio** (`reacciones/`)
- Sección «De <espacio>» en el panel de reacciones: `SpaceEmojiGrid.tsx` (diseño `c-06`).
- Agregar uno con imagen, nombre `:casco-ok:` y vista previa: `AddCustomEmojiSheet.tsx`, `app/src/spaces/customEmojis.tsx` (diseño `c-07`).
- Se dibujan en las reacciones: `ReactionGlyph.tsx`.

- Opciones de un sticker guardado (27/11, diseños `sa-01`, `sa-02`): mantener presionado abre `StickerOptionsSheet.tsx` (el sticker en grande, «Animado · sin sonido» o «con sonido · Risa», y «Agregar/Cambiar sonido», «Quitar sonido», «Exportar para WhatsApp», favoritos, «Quitar de Mis stickers»; `stickerOptionsOf`). El sonido usa la misma hoja `StickerSoundSheet.tsx` sin «Sonido original» (`SavedStickerSoundSheet.tsx`, decisiones en `savedStickerSound.ts`): «Guardar sonido» manda solo lo que cambió; atrás o el fondo solo cierran. Las hojas viven en `useSavedStickerSheets.tsx`.
- «Exportar para WhatsApp» (27/11, diseño `sa-05`): `StickerExportSheet.tsx` + `stickerExport.ts`. El video con su sonido se baja con la sesión y va a la galería (permiso de solo escritura) o a compartir; la imagen WebP/PNG, a compartir.
- Pestaña GIF (27/11, diseño `sa-04`): la pastilla «+ Sonido» (micrófono + texto) en cada GIF y mantener presionado («Enviar GIF» / «Hacer sticker con sonido») abren el editor con ese GIF sin mandarlo (`chatGifEditor.ts › openGiphyGifInEditor`, por `GET /api/gifs/:id/file`). También en «Buscar GIF», que se cierra al abrir el editor.
  - José 27/11: «aparece un iconito de sonido, pero en realidad no es sonido… cuando lo toco se agrega de frente». La nota musical sola se leía como «este GIF suena» y el botón vivía DENTRO del `Pressable` que envía. Ahora es hermano del mosaico (`GifGrid › SoundStickerPill`), dice «Abriendo…» con spinner mientras baja el GIF, y ese mosaico no envía mientras tanto. Un toque a la vez: `gifOptions.ts › createGiphySoundStickerOpener`.
- Escuchar antes de guardar (José 27/11: «el botón de play es recontra inestable… no tiene ningún feedback»): `soundPreview.ts` usa el mismo controlador que el chat (`createStickerSoundController` con `replay: () => false`: suena una vez) y `useClipPreviewPlaying(uri)` dice si ese archivo suena. «Tu voz» (`VoiceClipRecorder › ListenVoiceButton`), la voz de Valeria/Daniel, el audio del teléfono (`ListenChip`) y el botón de la fila de sonido del editor pasan a «Detener» (relleno con el acento) mientras suenan, y un toque lo para. «Tu voz está lista» muestra cuánto dura (`AudioClip.ms`). El reproductor de expo-audio está en `expoLoopPlayer.ts`.

### Web/PWA (`web/src/chat/`)

- Panel: `PanelDeEmojis.tsx`, `stickers/EmojiStickerPanel.tsx`; cierra con clic afuera o Escape; colores en oscuro (21/10).
- Atajos «:hug»: `emojiShortcode/useEmojiShortcode.ts`, `EmojiSuggestions.tsx`.
- Stickers: `stickers/StickerPanel.tsx`, `useStickers.ts`, `stickersApi.ts`, `StickerMessage.tsx`, `LottieSticker.tsx` + `lottiePlayer.ts` (diseño `s1-web-stickers`).
- Crear sticker: `stickers/CreateStickerWeb.tsx`, recorte `cutoutWeb.ts` (MediaPipe, Apache 2.0), máscara `mask.ts`, composición `composeWeb.ts`.
- Un solo «Crear» en el panel («Foto, video o GIF», diseño `sc-01a`, José 26/11): un selector de archivos; `stickerSourceOf` (`videoSticker.ts`) manda la foto al recorte (`CreateStickerWeb.tsx`, `initialPhoto`) y el video o GIF al modal con sonido.
- Sticker con sonido desde un video o GIF (26/11, diseños `ss-03`, `ss-04`): `stickers/CreateStickerFromVideo.tsx` (modal; un GIF se ve en `<img>`, va entero hasta 6 s y sin «Sonido original»), tramo de hasta 6 s `VideoTrimStrip.tsx`, sonido `StickerSoundPicker.tsx` (original, grabar `VoiceRecorder.tsx`, subir, sonidos de Lilachat, sin sonido); decisiones puras en `videoSticker.ts`. «Guardar en Mis stickers» y «Enviar».
  - En el chat llega silenciado con un botón de parlante (`StickerMessage.tsx`); al tocarlo suena 3 veces seguidas (`stickerSoundLoop.ts`), uno a la vez en la página.
- «Convertir en sticker animado» sobre un GIF del chat abre ese mismo modal con el GIF (`GifStickerDialog.tsx`, `fetchGifFile`), para ponerle sonido.
- Menú del mensaje: «Guardar en Mis stickers», «Agregar a favoritos», «Convertir en sticker animado» (`MenuDelMensaje.tsx`).
- GIF: `gifs/GifPanel.tsx`, `GifInBubble.tsx` (se mueve y se detiene), `gifsApi.ts`, `gifsInFlight.ts`.
- Guiños: `WinkPanel.tsx`, `WinkOverlay.tsx`, `WinkCharacter.tsx`, `WinkSketch.tsx`, `sketchFrames.ts`, `winkSounds.ts`.
  - Los botones del guiño en su componente; se borra desde su menú (01/11).
  - El guiño de otro chat ya no suena al cambiar de chat (21/10).
- Zumbido: mueve toda la ventana y suena (`nudge.tsx`).
- Ajuste del grupo: `info/GroupFunRow.tsx`. Lo visto: `funSeen.ts`.
- Emojis propios: `reacciones/SpaceEmojiSection.tsx`, `AddCustomEmojiDialog.tsx`, `ReactionGlyph.tsx`.

- Opciones de un sticker guardado (27/11, José: «quiero agregarle audio sin volver a buscar el GIF»; diseño `sa-03`): «⋯» al pasar el cursor (`StickerCellMenu.tsx`) con «Agregar/Cambiar sonido», «Quitar sonido», «Exportar para WhatsApp», favoritos y «Quitar de Mis stickers» (`stickerOptionsOf`, shared). El menú va en un portal con posición fija (`menuPlaceOf`): dentro del panel con scroll se cortaba en el borde (E2E 27/11). El sonido se elige en `StickerSoundDialog.tsx` (sin «Sonido original»; abre en su preset). Un sticker del paquete se guarda primero (`useStickers › setSound`).
- «Exportar para WhatsApp» (27/11, diseño `sa-05`): `StickerExportDialog.tsx` descarga el video con su sonido (MP4 del server) y la imagen WebP/PNG. WhatsApp no recibe sonido desde otras apps: el sonido se pone en su «Crear sticker» con ese video (beta 2.26.47, 25/11).
- Pestaña GIF (27/11, diseño `sa-04`): «Sticker con sonido» en cada GIF (al pasar el cursor; siempre en pantalla táctil) abre el editor con ese GIF sin mandarlo (`GET /api/gifs/:id/file`, `giphyGifFile`).

### Server (`server/src/`)

- Stickers (`stickersRoutes.ts`, en `/api`): `GET/POST /stickers`, `PATCH/DELETE /stickers/:id`, `POST /stickers/from-message`, `POST /stickers/from-pack`, `POST /chats/:chatId/stickers` (enviar).
- Sticker animado propio desde un GIF (`animatedStickerRoutes.ts`, `animatedSticker.ts`): `POST /stickers/animated`, `POST /stickers/from-gif`. WebP animado 512×512, hasta 6 s y 500 KB, con sharp.
- Sticker con sonido desde un video (26/11): `POST /stickers/from-video` (`videoStickerRoutes.ts`), multipart con `file` (video o GIF hasta 60 MB; `isStickerClipMime`), `audio` opcional, `startMs`, `endMs` y `sound` (`original`, `file`, `none`, `preset:<id>`).
  - `soundSticker.ts`: ffmpeg corta el tramo a GIF de 12,5 cuadros por segundo (80 ms, exacto en GIF: el dibujo va al ritmo del sonido) y sharp lo deja en WebP animado 512×512; el sonido sale aparte en AAC mono de 64 kbps. Uno a la vez en la mini.
  - Un sonido grabado o elegido se queda entero hasta 6 s; un GIF más corto se repite debajo mientras suena (José 27/11: «mi voz está cortada»; antes se cortaba al largo de una vuelta del GIF).
  - Un video sin pista de sonido queda como sticker sin sonido, sin error. Los sonidos de Lilachat no se suben: apuntan a `/sonidos/wink-*.mp3` de la web (`webOrigin.ts`).
  - `Sticker.audioUrl` y `Message.media.audioUrl` viajan al enviar y al guardar el sticker de otro.
- Modelo y vista: `stickerModel.ts`, `stickerView.ts`.
- GIF (`gifRoutes.ts`, en `/api/gifs`): `GET /` (disponible), `GET /search`, `POST /send`. La llave de GIPHY no sale del server; el GIF se guarda en nuestro disco.
- Guiños y zumbido (`zumbido.ts`): en 1:1 siempre; en grupo solo si un admin lo permitió; uno de cada tipo cada 10 s por persona y chat.
- Encender guiños y zumbidos en un grupo: `PATCH /api/chats/:chatId/fun` (`funRoutes.ts`).
- Emojis propios: `GET/POST /api/workspaces/:id/emojis`, `DELETE /api/workspaces/:id/emojis/:emojiId` (`workspaceRoutes.ts`, `customEmojiCatalog.ts`, `customEmojiModel.ts`).
- Mensajes: `kind` `sticker`, `zumbido` y `guino` (`Message.wink` con el id del catálogo).

- Sonido de un sticker guardado (27/11): `POST /stickers/:id/sound` (`stickerSoundRoutes.ts`), multipart `sound` (`file`, `none`, `preset:<id>`; `original` no aplica) y `audio`. Solo el dueño (404 si no). El audio se queda entero hasta 6 s (`cutStickerSound`; ya no lee el dibujo: cortarlo a una vuelta dejaba la voz a medias, José 27/11). Lo ya enviado conserva su sonido.
- Voz como sonido (27/11, José: «voces… las de latino español»; «solo admins, y deja solo Valeria y Daniel»): `shared/src/stickerVoice.ts` (`STICKER_VOICES`, `canUseStickerVoice`, `voiceTextOf` ≤ 120, `stickerVoiceFileName` → `sticker-voz-<voz>.m4a`). La etiqueta «Voz de Valeria» sale del campo `soundVoiceId` del sticker (`stickerModel`, `toClientSticker`, `LibrarySticker`): el servidor de medios renombra los archivos, así que el nombre no sirve (E2E 27/11 decía «Sonido propio»). Otro sonido lo borra. El sonido `voice:<voz>` llega con `voiceText` y `spaceId`; `server/src/stickerVoice.ts › spokenSoundOf` revisa la frase y que sea owner/admin activo del espacio ANTES de pedir el audio (403/400), y traduce lo de agentes a 503 «La voz no está disponible ahora», 429 tope del espacio. Sirve para un sticker guardado (`stickerSoundRoutes`), uno hecho de video (`videoStickerRoutes`) y «Escuchar» (`POST /stickers/voice/preview`). El audio sale de agentes, `POST /v1/voice/speech` (agentes 871d7c9; Voice Studio en la MacBook de José): `server/src/agentesVoice.ts › speakWithAgentes` firma como los eventos (`x-lilachat-installation/-timestamp/-signature`, HMAC con el `signingSecret` de una instalación viva, EN ESE ESPACIO, de cualquier app alojada en agentes (`agentesDoorFor`: el host del webhook de la app de desarrollador Lila; en producción Lila no tenía instalaciones y Dali, Portal e Inframaq sí, 27/11) en el host de esa app; espera 20 s. Medido 27/11: 12 KB en 12,6 s con Voice Studio frío. Agentes corta a 6 s, cachea 90 días y pone tope de 5/min y 30/24 h por espacio. Web (diseño `sv-01`): «Voz» con la etiqueta «Solo admins» en «Sonido del sticker» (`SpokenVoiceOption.tsx`, la tarjeta común en `SoundOption.tsx`), frase con contador n/120, Valeria o Daniel y «Escuchar» (`previewStickerVoice`); aparece solo si `useStickerVoiceDoor` da puerta: `stickerVoiceSpaceOf` (shared) toma el espacio abierto si lo administro y, si no (Personal, un chat directo, un espacio donde soy miembro), el primero que administro (José 27/11: «aún no veo el generar voz»); quien no administra ninguno no la ve. Viaja como `SoundPick` `spoken` → `voice:<voz>` + `voiceText` + `spaceId` (`appendSoundParts`). APK: la misma opción en la hoja «Sonido del sticker» (`SpokenVoiceOption.tsx`; la tarjeta común pasó a `SoundOptionCard.tsx`), para un sticker guardado y uno hecho de video; `SoundChoice` `spoken` (`spokenVoice.ts`: campos `voiceText`/`spaceId`, resumen «Voz de Daniel»). «Escuchar» guarda el audio en la caché (`audioBase64Of` + `btoa`, uno solo a la vez) y lo toca con `previewClip`; la puerta (`useStickerVoiceDoor`) cuelga de `useStickers`.
- Exportar (27/11): `GET /stickers/:id/export.mp4` (`stickerExportRoutes.ts`, `stickerVideo.ts`): sharp saca cada cuadro sobre blanco y ffmpeg arma el MP4 con su sonido (libx264, si no h264_videotoolbox, si no mpeg4). Solo si se mueve o suena (`stickerExportOf`). Si el sticker tiene sonido y no se puede leer, responde 503: nunca un video mudo (E2E 27/11). Un sticker animado con sonido repite su dibujo (`-stream_loop -1`) y el video dura lo más largo entre una vuelta y el sonido (ffprobe), hasta 6 s: antes se cortaba a una vuelta y la voz quedaba a medias. Verificado en producción: H.264 + AAC, 512 × 512.
- `GET /api/gifs/:gifId/file` (`gifRoutes.ts`): el GIF de 200 px de GIPHY para el editor, sin mandarlo.

### Shared (`shared/src/`)

- Panel: `panelTab.ts`. Atajos: `emojiShortcode.ts` + `emojiNamesData.ts` (carga diferida).
- Stickers: `stickers.ts` (paquete «Lila» y «En movimiento»), `stickerEditor.ts`, `stickerMask.ts`, `stickerRows.ts`, `animatedStickers.ts`.
- Stickers con sonido: `soundStickers.ts` (`isStickerClipMime`: video o GIF; `clipHasOwnSound`: solo el video trae sonido; tramo `clipWindowOf` de 0,5 a 6 s, `parseStickerSound`, 8 sonidos de Lilachat `STICKER_SOUND_PRESETS`, 3 reproducciones `STICKER_SOUND_PLAYS`).
- Lottie: `lottie/` (`svgToLottie`, `rigToLottie`: una parte del guiño en SVG pasa a formas Lottie, revisado píxel a píxel).
- Guiños: `winks.ts` (catálogo `WINKS`, `winkPanelGroups`, `canReturnWink`, `shouldPlayFun`, `NUDGE_SHAKE`), `winkArt.ts`, `winkDances.ts`, `winkTimeline.ts`, `winkSeasons.ts`, `winkSketches*.ts` (Halloween, Navidad, Año Nuevo, San Valentín, Día de la Madre, Fiestas Patrias, rockero, ataque), `winkEmojis.ts`.
- Lo ya reproducido: `funLedger.ts`. Zumbido: `nudge.ts`.
- GIF: `gifs.ts` (host permitido, tope 4 MB, sugerencias «Gracias», «Listo», «Jajaja»…).
- Emojis propios: `customEmojis.ts` (PNG, WebP o GIF hasta 256 KB; la reacción guarda `:nombre:`).
- Reacciones: `reacciones.ts`.

- `soundStickers.ts` (27/11): `stickerOptionsOf` (las opciones de un sticker guardado), `stickerExportOf`, `stickerSoundLabelOf`, `soundPresetIdOf`.

## 3. Diferencias APK vs web

| Función | APK | Web |
| --- | --- | --- |
| Recorte del sujeto del sticker | ML Kit en el teléfono | MediaPipe en el navegador |
| Guiño fluido | Imágenes pre-renderizadas (~46 fps) | SVG animado en la GPU |
| GIF a pantalla completa | `GifSearchScreen.tsx` | Panel |
| Zumbido | Sacude la pantalla y vibra | Mueve la ventana; sin vibración |
| Emoji propio en el texto | No: solo en reacciones | No: solo en reacciones |

Lo demás (paquetes, Mis stickers, favoritos, GIF, guiños, temporadas, zumbido, ajuste del grupo) existe en las dos.

## 4. Historia reciente

- **19/10 (0.1.97):** panel de emojis y @menciones.
- **20/10 (0.1.111–0.1.113):** stickers como WhatsApp: recorte, editor, paquete «Lila», borrar y restaurar; stickers en el hilo.
- **21/10:** zumbido (§71). Guiños con personajes adultos y groove (0.1.117), con remate y 21 sonidos (0.1.118). José rechazó la primera versión chibi.
- **21/10 (0.1.120):** guiños fluidos en Android (de 14 a ~46 cuadros por segundo), miniatura del guiño, el zumbido vibra a quien lo manda. José: «el chanchito lo veo muy lento».
- **21/10:** paquete animado «En movimiento». El panel recuerda su pestaña. El zumbido viejo no vuelve a sonar.
- **22/10:** GIF con GIPHY por el server (0.1.138). Convertir un GIF en sticker animado propio. Guiños de Halloween y temporadas.
- **23/10:** guiños de Navidad, Año Nuevo, San Valentín, Día de la Madre, Fiestas Patrias y «Rockero furioso» (pendientes 73 y 77).
- **28/10:** emojis propios del espacio (pendiente 19). Zumbidos y guiños no se repiten al volver (pendiente 107).
- **30/10:** atajos «:hug» en web y app.
- **01/11:** «Te ataco», 12 guiños que le pegan a la pantalla del otro, y «Devolver». 70 emojis animados más. Emojis en una sola vista con scroll. Stickers de a dos.
- **02/11:** José: «aún se siente tosco». Sticker, guiño y zumbido responden al toque; el guiño entra un cuadro después de cerrar el panel (plan 1, F4).
- **02/11:** José rechazó los guiños «Telenovela»; eligió «Te ataco».
- **10/11:** responder con GIF o guiño; GIF nítidos.
- **11/11 (0.1.182):** el paquete animado se reproduce como Lottie, también en canales e hilos. URL versionada para los Lottie.
- **17/11:** «:hug» en el hilo.
- **26/11:** stickers animados con sonido desde un video, como los de WhatsApp del 25/11 (José aprobó `ss-01…ss-04`).

## 5. Diseños de Stitch relacionados

| Diseño | Estado | Evidencia |
| --- | --- | --- |
| `s1-app-panel-stickers` | Implementado | `stickers/StickerPanel.tsx`, `EmojiStickerPanel.tsx`, `StickerMessage.tsx` |
| `s1-app-crear-sticker` | Implementado | `stickers/CreateSticker.tsx`, `StickerCanvas.tsx` |
| `s1-web-stickers` | Implementado | `web/src/chat/stickers/StickerPanel.tsx`, `CreateStickerWeb.tsx` |
| `s1-pack-lila` | Implementado | `shared/src/stickers.ts` (`lila-1`) |
| `m-02-guinos-panel` | Implementado | `WinkPanel.tsx` (app y web) |
| `m-03-guino-recibido` | Implementado (referencia) | `WinkOverlay.tsx` |
| `m-04-lineas-del-chat` | Implementado | `nudge.tsx` (app y web), `web/src/chat/nudge.test.tsx` |
| `m-05-ajustes-diversion` | Implementado, sin «Quién puede mandarlos» (sin backend) | `GroupFunCard.tsx`, `info/GroupFunRow.tsx` |
| `s-04-directo-guino-e-hilo` | Implementado (referencia de la tarjeta del guiño) | §79 del spec |
| `x-a…x-e`, `y-a`, `y-b`, `y-c` | Fuente del arte | `shared/src/winkArt.ts`, `WINK_PROPS` |
| `w-a…w-e` (chibi) | Rechazado | INVENTARIO: «NO vale» |
| Guiños «Telenovela» | Rechazado por José (02/11) | INVENTARIO |
| Guiños «Te ataco» | Implementado | `shared/src/winkSketchesAttack.ts` |
| `c-06-emojis-propios-panel` | Implementado | `reacciones/SpaceEmojiGrid.tsx`, `SpaceEmojiSection.tsx` |
| `c-07-agregar-emoji` | Implementado | `reacciones/AddCustomEmojiSheet.tsx`, `AddCustomEmojiDialog.tsx` |
| `ss-01-crear-sticker-video` | Implementado, sin «Aa Texto» | `app/src/chat/stickers/CreateVideoSticker.tsx` |
| `ss-02-sonido-del-sticker` | Implementado (la captura se corta abajo) | APK y web: selector de sonido |
| `ss-03-chat-sticker-sonido` | Implementado | `StickerMessage.tsx` (app y web) |
| `ss-04-web-sticker-sonido` | Implementado | `web/src/chat/stickers/CreateStickerFromVideo.tsx` |
| `sc-01a-crear-sticker-uno` | Implementado (APK), sin la nota con flecha | `app/src/chat/stickers/StickerPanel.tsx` (`btn-crear-sticker`) |
| `multimedia-emojis` | Implementado (referencia) | §48.2 del spec |

## 6. Pendientes y deuda conocida

- **Los emojis propios solo sirven para reaccionar,** no dentro del texto. Verificado en código (`customEmojiToken` solo lo usan `ReactionGlyph` y la grilla).
- **«:hug» no se prueba con Metro** (el `import()` diferido de la tabla de nombres no resuelve en el monorepo). Según spec (17/11).
- **«Quién puede mandarlos» en la tarjeta Diversión:** no existe; el ajuste es encendido o apagado para todo el grupo. Según INVENTARIO y verificado en código (`funRoutes.ts`).
- **GIF depende de `GIPHY_API_KEY`:** sin llave, `GET /api/gifs` dice que no está disponible. Verificado en código.

## 7. Pruebas

- **Shared:** `soundStickers`, `stickers`, `stickerEditor`, `stickerMask`, `stickerRows`, `animatedStickers`, `winks`, `winkArt`,
  `winkDances`, `winkTimeline`, `winkSeasons`, `winkSketches`, `winkSketchesAttack`, `funLedger`, `nudge`, `gifs`,
  `customEmojis`, `emojiShortcode`, `reacciones`, `lottie/svgToLottie`, `lottie/rigToLottie` (`shared/src/**/*.test.ts`).
- **Server:** `stickers` (incluye `from-video`), `soundSticker` (ffmpeg real), `animatedSticker`, `zumbido` (`server/src/*.test.ts`).
- **APK:** `stickers/stickerSource`, `stickers/chatGifEditor`, `stickers/videoStickerTrim`, `videoStickerSound`, `stickerSoundController`, `emojiPanel`, `emojiPanel/emojiLayout`, `winkPlay`, `funSeen`, `funAvailable`, `stickers/stickersApi`,
  `stickers/stickerRenderers`, `gifs/gifsInFlight`, `gifs/gifOptions`.
- **Web:** `stickers/videoSticker`, `stickerSoundLoop`, `CreateStickerFromVideo`, `stickers/StickerPanel`, `StickerMessage`, `LottieSticker`, `lottieFiles`, `stickersApi`, `mask`,
  `gifs/GifPanel`, `gifs/gifsInFlight`, `nudge`, `funPlayback`, `funSeen`, `sketchFrames`, `reacciones/customEmojis`.
- **Maestro:** ninguno.
