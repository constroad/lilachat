# As-is · Chat: stickers, emojis, guiños, zumbido y GIF

## 1. Qué es

Lo expresivo del chat. Un panel con cuatro pestañas (`shared/src/panelTab.ts`): Emojis, Stickers, GIF y Guiños.
Además, el zumbido de Messenger, los emojis propios del espacio y los atajos «:hug».
Tono adulto: nada chibi ni infantil (decisión de José, §74).

**Fecha de corte:** 17/11/2026.

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
- Un GIF del chat se puede convertir en sticker animado propio (22/10).

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

### Web/PWA (`web/src/chat/`)

- Panel: `PanelDeEmojis.tsx`, `stickers/EmojiStickerPanel.tsx`; cierra con clic afuera o Escape; colores en oscuro (21/10).
- Atajos «:hug»: `emojiShortcode/useEmojiShortcode.ts`, `EmojiSuggestions.tsx`.
- Stickers: `stickers/StickerPanel.tsx`, `useStickers.ts`, `stickersApi.ts`, `StickerMessage.tsx`, `LottieSticker.tsx` + `lottiePlayer.ts` (diseño `s1-web-stickers`).
- Crear sticker: `stickers/CreateStickerWeb.tsx`, recorte `cutoutWeb.ts` (MediaPipe, Apache 2.0), máscara `mask.ts`, composición `composeWeb.ts`.
- Menú del mensaje: «Guardar en Mis stickers», «Agregar a favoritos», «Convertir en sticker animado» (`MenuDelMensaje.tsx`).
- GIF: `gifs/GifPanel.tsx`, `GifInBubble.tsx` (se mueve y se detiene), `gifsApi.ts`, `gifsInFlight.ts`.
- Guiños: `WinkPanel.tsx`, `WinkOverlay.tsx`, `WinkCharacter.tsx`, `WinkSketch.tsx`, `sketchFrames.ts`, `winkSounds.ts`.
  - Los botones del guiño en su componente; se borra desde su menú (01/11).
  - El guiño de otro chat ya no suena al cambiar de chat (21/10).
- Zumbido: mueve toda la ventana y suena (`nudge.tsx`).
- Ajuste del grupo: `info/GroupFunRow.tsx`. Lo visto: `funSeen.ts`.
- Emojis propios: `reacciones/SpaceEmojiSection.tsx`, `AddCustomEmojiDialog.tsx`, `ReactionGlyph.tsx`.

### Server (`server/src/`)

- Stickers (`stickersRoutes.ts`, en `/api`): `GET/POST /stickers`, `PATCH/DELETE /stickers/:id`, `POST /stickers/from-message`, `POST /stickers/from-pack`, `POST /chats/:chatId/stickers` (enviar).
- Sticker animado propio desde un GIF (`animatedStickerRoutes.ts`, `animatedSticker.ts`): `POST /stickers/animated`, `POST /stickers/from-gif`. WebP animado 512×512, hasta 6 s y 500 KB, con sharp.
- Modelo y vista: `stickerModel.ts`, `stickerView.ts`.
- GIF (`gifRoutes.ts`, en `/api/gifs`): `GET /` (disponible), `GET /search`, `POST /send`. La llave de GIPHY no sale del server; el GIF se guarda en nuestro disco.
- Guiños y zumbido (`zumbido.ts`): en 1:1 siempre; en grupo solo si un admin lo permitió; uno de cada tipo cada 10 s por persona y chat.
- Encender guiños y zumbidos en un grupo: `PATCH /api/chats/:chatId/fun` (`funRoutes.ts`).
- Emojis propios: `GET/POST /api/workspaces/:id/emojis`, `DELETE /api/workspaces/:id/emojis/:emojiId` (`workspaceRoutes.ts`, `customEmojiCatalog.ts`, `customEmojiModel.ts`).
- Mensajes: `kind` `sticker`, `zumbido` y `guino` (`Message.wink` con el id del catálogo).

### Shared (`shared/src/`)

- Panel: `panelTab.ts`. Atajos: `emojiShortcode.ts` + `emojiNamesData.ts` (carga diferida).
- Stickers: `stickers.ts` (paquete «Lila» y «En movimiento»), `stickerEditor.ts`, `stickerMask.ts`, `stickerRows.ts`, `animatedStickers.ts`.
- Lottie: `lottie/` (`svgToLottie`, `rigToLottie`: una parte del guiño en SVG pasa a formas Lottie, revisado píxel a píxel).
- Guiños: `winks.ts` (catálogo `WINKS`, `winkPanelGroups`, `canReturnWink`, `shouldPlayFun`, `NUDGE_SHAKE`), `winkArt.ts`, `winkDances.ts`, `winkTimeline.ts`, `winkSeasons.ts`, `winkSketches*.ts` (Halloween, Navidad, Año Nuevo, San Valentín, Día de la Madre, Fiestas Patrias, rockero, ataque), `winkEmojis.ts`.
- Lo ya reproducido: `funLedger.ts`. Zumbido: `nudge.ts`.
- GIF: `gifs.ts` (host permitido, tope 4 MB, sugerencias «Gracias», «Listo», «Jajaja»…).
- Emojis propios: `customEmojis.ts` (PNG, WebP o GIF hasta 256 KB; la reacción guarda `:nombre:`).
- Reacciones: `reacciones.ts`.

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
| `multimedia-emojis` | Implementado (referencia) | §48.2 del spec |

## 6. Pendientes y deuda conocida

- **Los emojis propios solo sirven para reaccionar,** no dentro del texto. Verificado en código (`customEmojiToken` solo lo usan `ReactionGlyph` y la grilla).
- **«:hug» no se prueba con Metro** (el `import()` diferido de la tabla de nombres no resuelve en el monorepo). Según spec (17/11).
- **«Quién puede mandarlos» en la tarjeta Diversión:** no existe; el ajuste es encendido o apagado para todo el grupo. Según INVENTARIO y verificado en código (`funRoutes.ts`).
- **GIF depende de `GIPHY_API_KEY`:** sin llave, `GET /api/gifs` dice que no está disponible. Verificado en código.

## 7. Pruebas

- **Shared:** `stickers`, `stickerEditor`, `stickerMask`, `stickerRows`, `animatedStickers`, `winks`, `winkArt`,
  `winkDances`, `winkTimeline`, `winkSeasons`, `winkSketches`, `winkSketchesAttack`, `funLedger`, `nudge`, `gifs`,
  `customEmojis`, `emojiShortcode`, `reacciones`, `lottie/svgToLottie`, `lottie/rigToLottie` (`shared/src/**/*.test.ts`).
- **Server:** `stickers`, `animatedSticker`, `zumbido` (`server/src/*.test.ts`).
- **APK:** `emojiPanel`, `emojiPanel/emojiLayout`, `winkPlay`, `funSeen`, `funAvailable`, `stickers/stickersApi`,
  `stickers/stickerRenderers`, `stickers/gifSticker`, `gifs/gifsInFlight`, `gifs/gifOptions`.
- **Web:** `stickers/StickerPanel`, `StickerMessage`, `LottieSticker`, `lottieFiles`, `stickersApi`, `mask`,
  `gifs/GifPanel`, `gifs/gifsInFlight`, `nudge`, `funPlayback`, `funSeen`, `sketchFrames`, `reacciones/customEmojis`.
- **Maestro:** ninguno.
