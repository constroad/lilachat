# As-is · Chat: hilos

## 1. Qué es

Un hilo es una conversación colgada de un mensaje (la raíz), como en Slack.
Cada respuesta es un mensaje más del chat, marcado con `hiloDe` (el `seq` de la raíz).
El chat principal la oculta, salvo que vaya con «También enviar al chat».
No hay hilos de hilos, de avisos, de lo borrado ni en chats secretos.

**Fecha de corte:** 17/11/2026.

## 2. Qué hace hoy

### APK (`app/src/chat/`)

- **Chip debajo de la raíz:** `ChipDeHilo.tsx` (diseño `e3-app-chip-hilo`).
  - Leído: contador gris y borde tenue.
  - Sin leer: borde y fondo de marca, pastilla «Nuevo»; el lector dice «Hay respuestas sin leer» (16/11).
  - Lo alimentan `useHilosEnElChat.ts`, `useResumenesDeHilos.ts` y la instantánea por chat `hilosVistos.ts › seenThreadsOf`.
- **Pantalla del hilo:** `HiloScreen.tsx` (diseño `e3-app-hilo`).
  - Raíz arriba con su tarjeta, su foto o su archivo y el pie (`ThreadRootBody`, 13/11).
  - Respuestas con la misma burbuja del chat; en modo Slack, filas planas (`FlatMessageRow.tsx`, diseño `s-02`).
  - Respuesta con foto, nota de voz o archivo: `ThreadMediaReply.tsx`, `threadReply.ts › isThreadMediaReply` (13/11).
  - Visor de fotos que recorre la raíz y las respuestas: `useThreadPhotoViewer.tsx`, `threadReply.ts › threadPhotoMessages`.
  - Campo con @menciones, atajos «:hug» (17/11), editar lo propio y borrar mi respuesta («Eliminar para todos»).
  - «También enviar al chat».
  - Emojis y stickers en una hoja sobre el hilo: `ThreadPicker.tsx`.
  - Checklist dentro del hilo: `ChecklistEnElChat.tsx` + `agenda/CreateChecklistScreen.tsx` (botón `btn-checklist-hilo`).
  - Reacciones en el hilo: `reacciones/BarraDeReacciones.tsx`, `useReaccionesEnPantalla.tsx`.
  - Tarjetas de apps con sus botones también en el hilo (`TarjetaDelChat.tsx`, 05/11).
- **Abrir un hilo:**
  - Menú del mensaje «Responder en hilo» (`SeleccionDeMensaje.tsx`).
  - En el formato Slack, «Responder» abre el hilo (`shared/src/hilos.ts › replyOpensThread`, pendiente 110).
  - Tocar un aviso abre el espacio, el mensaje y el hilo (25/10).
  - Banda «Ana respondió en un hilo · Ver» sobre el chat: `ThreadRepliesBanner.tsx` (16/11), abre el hilo más reciente sin ver.
- **Cita de una respuesta enviada al chat:** «Respondió en el hilo de Wilson: …» (`CitaDeRespuesta.tsx compact`, 11/11).
- **Pestaña «Hilos» de Actividad:** `app/src/activity/ActivityScreen.tsx` (Menciones · Hilos · Reacciones).

### Web/PWA (`web/src/chat/`)

- Panel del hilo como tercera columna a la derecha: `hilos/PanelDeHilo.tsx` (diseño `e3-web-hilo`).
  - En el teléfono, un modal abre encima del hilo (12/11).
  - Envuelto en `ErrorBoundary`: si falla, «No se pudo mostrar el hilo.» y el chat sigue (pendiente 4).
- Chip con nuevas: `hilos/ChipDeHilo.tsx`. Datos: `hilos/useHilosWeb.ts`.
- Botón de hilo al pasar el mouse: `BotonDeHilo.tsx`.
- Cita de respuesta en el chat: `ThreadQuote` dentro de `BurbujaDeMensaje.tsx`.
- En el panel: clip para adjuntar (`btn-adjuntar-hilo`) y pegar imagen con el texto escrito como pie (10/11 y 11/11).
- En el panel: menciones, «:hug» (17/11), emojis y stickers, checklist (`agenda/CreateChecklistOverlay.tsx`).
- Marca de lectura en estado; aplica `visto` de `GET /hilos` y hace `POST /visto` con el hilo abierto (16/11).
- Pestaña «Hilos» de Actividad: `web/src/activity/ActivityDialog.tsx`.

### Server (`server/src/`)

- Reglas y resumen: `hilos.ts`.
  - La raíz guarda `hilo`: respuestas, `ultimaEn`, `ultimaSeq` y los 3 últimos autores.
  - `interesadosEnElHilo`: la raíz y quienes respondieron reciben el aviso.
- Envío: `socket.ts › msg.send` acepta `hiloDe` y `enElChat`; emite `msg.hilo` a los miembros.
- Borrar una respuesta descuenta el resumen (`msg.delete` emite `msg.hilo`).
- Fotos, GIF y guiños en un hilo: las rutas de medios y de GIF leen `MessageTarget` (10/11).
- Rutas (`hilosRoutes.ts`, en `/api/chats`):
  - `GET /:chatId/hilos`: resúmenes por raíz, con `visto`.
  - `GET /:chatId/hilos/:raiz`: el hilo entero; abrirlo mueve la marca de lectura.
  - `POST /:chatId/hilos/:raiz/visto`: marca lo visto en vivo.
- Marca de lectura por hilo: `threadReads.ts`, en `Receipt.threadSeq` (raíz → seq), sin colección ni índice nuevo.
  - Hilos con respuestas antes de `THREAD_READ_SINCE` (16/11 12:00 UTC) siguen con la marca del chat.
- Bots: una app responde en un hilo con `thread_of`; un `thread_of` ajeno al canal da 400 `invalid_thread` (07/11).

### Shared (`shared/src/`)

- `hilos.ts`:
  - `visibleEnElChat`, `canOpenThread`, `replyOpensThread`.
  - `textoDelChipDeHilo`, `hayRespuestasNuevas`, `respuestasDelHilo`, `aplicarResumenDeHilo`.
  - `threadQuoteLine` (tope `THREAD_QUOTE_MAX` = 80).
  - `threadsWithNewReplies` y `newRepliesLine` (la banda).
- `messageTarget.ts`: el destino de un envío (`replyToSeq`, `hiloDe`, `enElChat`).
- `flatLayout.ts`: filas planas del modo Slack. `activity.ts`: pestaña «Hilos».

## 3. Diferencias APK vs web

| Función | APK | Web |
| --- | --- | --- |
| Adjuntar foto, video o archivo en el hilo | No: el campo del hilo no tiene clip ni pegar (`HiloScreen.tsx`) | Sí (`btn-adjuntar-hilo` y pegar) |
| Nota de voz dentro del hilo | No | No (el panel no tiene micrófono) |
| GIF o guiño dentro del hilo | No (`ThreadPicker` ofrece emojis y stickers) | No verificado (usa `EmojiStickerPanel`) |
| Ver una respuesta con foto, voz o archivo | Sí (`ThreadMediaReply.tsx`) | Sí (`BurbujaDeMensaje`) |
| Disposición | Pantalla completa | Tercera columna (modal encima en el teléfono) |
| Banda «respondió en un hilo» | Sí (`ThreadRepliesBanner.tsx`) | No: `threadsWithNewReplies` solo lo usa el APK |
| Stickers en el hilo | Sí (`ThreadPicker.tsx`) | Sí |
| Checklist en el hilo | Sí | Sí |

## 4. Historia reciente

- **16/10:** deslizar para responder en el hilo nativo (FL2b).
- **20/10 (E3a, 0.1.104):** primera versión. Server con `hiloDe` y resumen. APK con chip, pantalla y «También enviar al chat». Web en panel.
- **20/10:** tarjetas que abren hilo y «Responder en hilo» bajo los emojis (0.1.107). Stickers y editar en el hilo (0.1.113).
- **20/10:** en un 1:1 el hilo nombra a la otra persona. Bug web: cerrar el hilo dejaba la página en blanco; mitigado con `ErrorBoundary`.
- **21/10 (0.1.120):** hilos más grandes (José: «aparecen pero son muy pequeños»). Checklist en hilos.
- **25/10:** tocar un aviso abre el hilo (B3, por OTA).
- **28/10:** pendiente 110: en el formato Slack, responder va al hilo. Borrar mi respuesta desde la app.
- **30/10:** una raíz que es recordatorio, encuesta, evento o checklist se ve como su tarjeta.
- **04/11:** «Ver hilo» salta a la última respuesta. La respuesta de una app se ve sin recargar.
- **05/11:** los botones de una tarjeta funcionan en un hilo.
- **10/11:** responder y escribir en un hilo con foto, GIF o guiño. José: «en un hilo no puedo pegar una imagen». Clip y pegar en la web.
- **11/11:** la cita nombra el original; un original borrado no se cita. Stickers animados (Lottie) también en hilos.
- **13/11:** la raíz muestra la foto y abre el visor. Las respuestas con foto, voz o archivo se dibujan como en el chat (APK).
- **16/11:** cada hilo tiene su marca de lectura. Banda «respondió en un hilo». El chip cambia de color al leer. José: «el punto morado no indica nada».
- **17/11:** «:hug» en el hilo (APK y web).
- **19/11** · Web: el chip «Hilos» ya no queda en 1 con todo leído. «Menciones y actividad» copia sus conteos al chip (`syncActivityChips`), y abrir un hilo o ver una respuesta pide la lista del espacio otra vez (`ACTIVITY_READ_EVENT`).

## 5. Diseños de Stitch relacionados

| Diseño | Estado | Evidencia |
| --- | --- | --- |
| `e3-app-chip-hilo` | Implementado | `app/src/chat/ChipDeHilo.tsx` |
| `e3-app-hilo` | Implementado | `app/src/chat/HiloScreen.tsx` (`pantalla-hilo`) |
| `e3-web-hilo` | Implementado | `web/src/chat/hilos/PanelDeHilo.tsx`, `hilos/ChipDeHilo.tsx` |
| `s-02-hilo-abierto` | Implementado en modo Slack | `HiloScreen.tsx`, `shared/src/flatLayout.ts` |
| `s-04-directo-guino-e-hilo` | Referencia del chip grande | §79 del spec (0.1.120) |
| Banda de respuestas | Sin diseño | Decisión propia (16/11) |

## 6. Pendientes y deuda conocida

- **APK no adjunta medios dentro del hilo.** Solo texto, emojis, stickers y checklist. Verificado en código (`HiloScreen.tsx` sin clip ni pegar).
- **Banda con una respuesta real de otra persona sin verificar.** En el emulador hay una cuenta. Según spec (16/11).
- **Teclado abierto en el hilo** (reporte de José): no se reprodujo; se pidió captura. Según spec (16/11).
- **Respuesta con foto en la APK después del OTA sin verificar en pantalla.** Según spec (as-is 13/11).
- **E2E de pegar y adjuntar en hilo en Test** quedó pendiente en el commit `0fb9c9b7`; la web lo probó en producción el 11/11. Según spec y commit.
- **Web sin la banda «respondió en un hilo».** Verificado en código.
- **Hilos viejos (antes del 16/11)** usan la marca del chat: abrir el chat los da por leídos. Verificado en código (`THREAD_READ_SINCE`).

## 7. Pruebas

- Shared: `shared/src/hilos.test.ts`, `messageTarget.test.ts`, `flatLayout.test.ts`.
- Server: `server/src/threadReads.test.ts`, `server/src/bots/botThreadReply.test.ts`.
- APK: `app/src/chat/hilosVistos.test.ts`, `threadReply.test.ts`.
- Web: `web/src/chat/hilos/PanelDeHilo.test.tsx`, `hilos/ChipDeHilo.test.tsx`, `BotonDeHilo.test.tsx`, `ThreadQuote.test.tsx`, `activity/activity.test.tsx`.
- Maestro: ninguno.
