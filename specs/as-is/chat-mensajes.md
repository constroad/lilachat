# As-is · Chat: mensajes y pantalla del chat

## 1. Qué es

La conversación de Lilachat: escribir, leer y actuar sobre cada mensaje.
Cubre el compositor, las acciones del mensaje (responder, editar, borrar, reenviar,
fijar, destacar, info), los acuses, «escribiendo», los temporales, los programados,
la búsqueda y las tarjetas de enlace. Hilos, medios, agenda y stickers tienen su archivo.

**Fecha de corte:** 17/11/2026 (último commit revisado: `42cdea72`).

## 2. Qué hace hoy

### APK (`app/src/chat/`)

**Pantalla y lista**
- Pantalla del chat: `ChatScreen.tsx`, cabecera `EncabezadoDelChat.tsx`, menú ⋮ `HeaderDropdown.tsx` + `chatHeaderMenu.ts`.
- Lista de mensajes: `ListaDeMensajes.tsx`, filas `MessageRow.tsx` / `FlatMessageRow.tsx` (modo Slack), celdas `messageCells.ts`, `useDibujarFila.tsx`.
- Ventana y paginación: `useChatWindow.ts`, `messageWindowRows.ts`, `paginacion.ts`, `storedRows.ts`.
- El chat frío nace pintado desde el disco (plan 1, F5a, 02/11).
- Historial local cifrado con SQLCipher (`mensajesGuardados.ts`, plan 1 F5b, 02/11).
- Divisor de no leídos y botón «bajar» con contador: `divisorNoLeidos.ts`, `useDivisorNoLeidos.tsx`, `finalDeLaConversacion.ts`.
- Saltar a un mensaje (búsqueda, aviso, cita): `useIrAMensaje.ts`, `anchorAfterJump.ts`, `scrollSafely.ts`.
- Mensaje largo colapsado con «Leer más»: motor `shared/src/mensajeLargo.ts` (700 caracteres o 15 líneas).
- Burbujas en TODOS los chats desde el 25/11 (José, capturas de WhatsApp y Telegram): los canales y grupos de un espacio también. Las filas planas estilo Slack solo con «grupos como lista» (`drawsAsList`): `FlatMessageRow.tsx`, `ui/groupsAsList.ts`, `settings/GroupsAsListSetting.tsx`, motor `shared/src/flatLayout.ts`. En un espacio «Responder» sigue abriendo el hilo (`usesFlatLayout` decide el comportamiento, `drawsAsList` el dibujo).
- Colores de burbuja (`shared/src/tokens.ts`): en oscuro la propia es violeta pleno `#5b3fc4` con texto claro y la ajena `#232f47`, un paso sobre el fondo. La web usa los mismos tokens (`bg-burbuja-propia`, `bg-burbuja-ajena`), con esquinas `rounded-2xl` y la punta recortada en la primera del bloque. Un prospecto de Dali lleva la etiqueta «WhatsApp» junto a su nombre en la burbuja.
- Tarjeta de PDF con página: la tarjeta mide lo que la miniatura (240 dp + margen), la página va con esquinas redondeadas y el nombre se corta abajo; nunca se sale de la burbuja (`TarjetaDeArchivo.tsx`, `PdfCardWeb.tsx`).
- Tamaño de letra del chat (`settings/ChatFontSetting.tsx`) y fondo (`FondoDelChat.tsx`).
- Línea «Reenviado» (`ForwardedLabel.tsx`, 13/11).

**Compositor**
- Barra: `Composer.tsx`, `ChatBottom.tsx`, `campoDeTexto.ts`, teclado sincronizado (`useScrollConTeclado.tsx`).
- Borrador por chat: `borradores.ts` («Borrador: …» en la lista).
- Panel de emojis en el lugar del teclado: `PanelDeEmojis.tsx`, `EmojiToggle.tsx` (detalle en `chat-stickers-emojis-guinos.md`).
- Atajos «:hug» con sugerencias: `emojiShortcode/useEmojiShortcode.ts`, `EmojiSuggestions.tsx`.
- @menciones con sugerencias: `useMenciones.ts`, `useMentionCandidates.ts`, `SugerenciasDeMencion.tsx`.
- `@todos` y `@aquí` en grupos (`shared/src/menciones.ts`).
- «X no está en el canal, ¿agregarlo?»: `useOutsideMentions.tsx` (25/10).
- Tarjeta del enlace mientras se escribe: `VistaPreviaAlEscribir.tsx`, `useVistaPrevia.ts`.
- Pegar una imagen copiada: `useClipboardImage.ts`, `PasteImageChip.tsx`.
- Cola de salida sin red: `outboxStore.ts` + motor `shared/src/outbox.ts`; reintento `useMensajeFallido.ts`.
- Programar mensaje (mantener presionado «Enviar»): `ProgramarMensajeModal.tsx`, `useProgramados.ts`, `ProgramadosDelChat.tsx`, `programados.ts`.

**Acciones sobre un mensaje**
- Selección y barra de acciones: `SeleccionDeMensaje.tsx`, `useSeleccionDeMensajes.ts`, `useAccionesDeSeleccion.ts`.
- Qué acción aparece lo decide `shared/src/accionesDeMensaje.ts` (también en la web).
- Acciones: Responder, Responder en hilo, Copiar, Reenviar, Destacar, Fijar/Desfijar, Editar, Info, Eliminar.
- «Denunciar» (19/11, Google Play): un solo mensaje ajeno, vivo, que no sea aviso ni tarjeta de una app (`canReportMessage` de `shared/src/reports.ts`). Va último en la barra (`barraDeSeleccion.ts`, suele quedar en «⋮») y abre `app/src/reports/ReportSheet.tsx`. Detalle en `plataforma-perfil-contactos-privacidad.md`.
- Deslizar para responder: `DeslizarParaResponder.tsx`, `gestoDeRespuesta.ts`; cita `CitaDeRespuesta.tsx`.
- «Responder» abre el teclado con el cursor en la barra (21/10): `useRespuestaYEdicion.ts`.
- Editar: solo lo propio, solo texto, 15 minutos (`shared/src/editarMensaje.ts`, `editedMessage.ts`).
- Eliminar para todos: solo el autor; un admin borra la tarjeta de una app (13/11). Motor `shared/src/eliminarMensaje.ts`.
- Lo borrado se vacía de verdad: texto, sobre y archivo (`camposDeLapida`).
- Eliminar para mí: se oculta en todos mis dispositivos (13/11): `ocultos.ts`, `hiddenRows.ts`.
- Reenviar: `reenviar/ForwardScreen.tsx` (frecuentes, recientes y elegidos), `frecuenciasDeEnvio.ts`.
- Compartir hacia Lilachat desde otra app: `reenviar/IncomingShareHost.tsx`, `incomingShare.ts`.
- Fijar: franja «1 de N» `FranjaDeFijados.tsx`, hoja de duración `HojaDeFijarMensaje.tsx`, lista `fijados/ListaDeFijados.tsx`, tarjeta en la info `fijados/TarjetaDeFijados.tsx`.
- Fijados: hasta 50; 24 h, 7 días, 30 días o sin vencimiento; en un grupo solo admins (`shared/src/mensajesFijados.ts`).
- Destacados (estrella personal): `destacados/ListaDeDestacados.tsx`, `TarjetaDeDestacados.tsx`, `useDestacadosDelChat.ts`.
- Info del mensaje: `InfoDelMensaje.tsx`; leído/entregado por persona con hora (13/11).
- Reacciones: `reacciones/BarraDeReacciones.tsx`, `PastillaDeReacciones.tsx`, `HojaDeReacciones.tsx` (una por persona).

**Estado y presencia**
- Acuses en vivo (checks): `useAcuses.ts`, `acuseVivo.ts`, `hastaDondeLeer.ts`, `readElsewhere.ts`.
- «Confirmaciones de lectura» apagables: `settings/ReadReceiptsSetting.tsx` (30/10).
- «Escribiendo…»: `useAvisoDeEscribiendo.ts`, `useEscribiendoDelChat.ts`.
- Última vez: `useUltimaVez.ts`, subtítulo `useChatSubtitle.ts`.
- Lo leído en otro dispositivo apaga el aviso del teléfono: `noticeSync.ts` (16/11).

**Del chat**
- Buscar en el chat: `BuscadorDelChat.tsx`, `useBuscarEnChat.ts`, `ResultadosDeMensajes.tsx`.
- Búsqueda global de mensajes desde la lista: `ChatListScreen.tsx` → `GET /api/chats/search`.
- Mensajes temporales (24 h, 7 días, 90 días): `DisappearingRow.tsx`, `disappearSetting.ts`, `useWithoutDisappeared.ts`.
- Exportar chat en `.txt`: `ExportChatRow.tsx`, `exportChat.ts`.
- Tarjetas de enlace en la burbuja: `VistaPreviaDeEnlace.tsx`, `linkPreviewCache.ts`, `TextoConEnlaces.tsx`.
- Aviso destacado en el chat (recordatorio que suena, evento que empieza): `HighlightedNotice.tsx`.

### Web/PWA (`web/src/chat/`)

- Conversación: `Conversation.tsx`, `ConversacionConAcciones.tsx`, `contextoDeLaConversacion.tsx`.
- Lista: `ListaDeMensajes.tsx`, `filasDeLaConversacion.ts`, `useMessageWindow.ts`, `windowOnScreen.ts`.
- Burbuja: `BurbujaDeMensaje.tsx` (también las líneas de aviso del sistema), `TextoDelMensaje.tsx`, `LinkedText.tsx`.
- Tarjeta de un bot: `BotCardView.tsx`. Una acción puede traer `open: { route }` en vez de un `button.click`:
  `'service'` navega al tab Servicios interno; `'quote-embed'` (20/11) abre el editor de Portal embebido
  (`QuoteEmbedWeb.tsx`, reusa `PortalEmbedFrame`) — solo web, igual que el embed de un informe. Detalle del
  contrato en `bots-api-y-tarjetas.md`.
- Base local (local-first): `web/src/local/*`, sincronía `web/src/sync/*`.
- Compositor: `Composer.tsx`, `composerInsert.ts`, borrador por chat `chatDrafts.ts` (28/10).
- Atajos «:hug»: `emojiShortcode/useEmojiShortcode.ts`.
- Menciones: `useMencionesDelCampo.ts`, `useMentionCandidatesWeb.ts`, `SugerenciasDeMencion.tsx`, `OutsideMentionNotice.tsx`.
- Enlace al escribir: `VistaPreviaAlEscribir.tsx`, `useVistaPrevia.ts`; en la burbuja `TarjetaDeEnlace.tsx`.
- En un chat de notas con «Ordenar enlaces por categoría» encendido, la burbuja de un enlace muestra la tarjeta que guardó el server (`links/StoredLinkInBubble.tsx`) y su columna toma toda la fila, con las acciones al pasar el mouse (reaccionar, hilo, ⋮) apiladas en una sola columna a su lado; el resto de las burbujas mide hasta el 68 %. «Solo pide comentar» va bajo el autor de la tarjeta. Detalle en `chat-notas.md`.
- Menú del mensaje (flecha al pasar el mouse): `MenuDelMensaje.tsx`; diálogos `DialogosDelMensaje.tsx` (eliminar, info).
- «Denunciar» en ese menú (19/11): mismo criterio que el APK; abre `web/src/reports/ReportDialog.tsx` desde el propio menú.
- Acciones: `useAccionesSobreMensajes.ts`, copiar `copiarTexto.ts`.
- Fijar: `FranjaDeFijados.tsx`, `DialogoFijar.tsx`, `useFijarEnLaWeb.ts`, `fijados/ListaDeFijados.tsx`.
- Destacados: `destacados/ListaDeDestacados.tsx`, `useDestacadosWeb.ts`.
- Reenviar: `reenviar/DialogoReenviar.tsx` con frecuentes.
- Reacciones al pasar el mouse: `reacciones/BotonDeReaccionar.tsx`, `PastillaDeReacciones.tsx`.
- Acuse de leído: `acuseDeLeido.ts` (hasta lo último visible y al volver a la pestaña).
- Privacidad de lectura: `web/src/privacy/ReadReceiptsChoice.tsx`.
- Temporales: `info/DisappearingRow.tsx`, `useWithoutDisappeared.ts`.
- Exportar chat: `info/ExportChatRow.tsx`.
- Título de la pestaña con no leídos: `tituloDeLaPestana.ts`.

### Server (`server/src/`)

- Modelos: `chatModels.ts` (`Message`, `Chat`, `Receipt`). `Message.kind`: text, image, video, audio, file, event, poll, reminder, checklist, system, sticker, zumbido, guino, contact, location.
- Campos clave: `replyToSeq`, `menciones`, `hiloDe`, `enElChat`, `reacciones`, `editedAt`, `deletedAt`, `disappearsAt`, `forwarded`, `envelope` (chat secreto).
- `Receipt`: `readSeq`, `deliveredSeq`, `readLog`/`deliveredLog` (hora, 13/11), `threadSeq` (16/11).
- Socket (`socket.ts`): `msg.send`, `msg.edit`, `msg.delete`, `msg.react`, `read.set`, `deliver.set`, `typing`, `sync.pull`.
- Envío central: `chatService.ts › sendMessage` (membresía, `seq`, idempotencia por `clientKey`).
- Rutas en `/api/chats` (`chatRoutes.ts`): `GET /:chatId/messages`, `POST /:chatId/read`, `GET /search`, `POST /:chatId/schedule`, `GET /scheduled`, `DELETE /scheduled/:id`, `GET /:chatId/messages/:seq/info`, `PUT /:chatId/disappearing`, `POST /:chatId/borrar-para-mi`.
- Denuncias: `POST /api/reports` (`reportRoutes.ts`); con un mensaje guarda su copia como evidencia (`reports.ts`).
- Otras rutas: `fijadosRoutes.ts` (`POST/DELETE /:chatId/fijados`), `hiddenMessages.ts` (`/:chatId/ocultos`), `reenvioRoutes.ts` (`POST /:chatId/reenviar`), `destacadosRoutes.ts` (`/api/chats/:chatId/destacados`, `/api/destacados`), `chatExportRoutes.ts` (`GET /:chatId/export`), `readAll.ts`.
- Vista previa de enlaces: `GET /api/enlaces/vista-previa` (`vistaPreviaRoutes.ts`, `vistaPrevia.ts`, `traerVistaPrevia.ts`, `vistaPreviaPorSitio.ts`: YouTube, TikTok, Instagram, Facebook y Google Maps).
- Programados: `scheduledMessages.ts` (tick con candado `sentAt`).
- Temporales: `disappearingMessages.ts` (barrido que vacía como «Eliminar para todos»).
- Acuses y privacidad: `acusesDelChat.ts`, `entregaPorAviso.ts`, `readPrivacy.ts` (en 1:1; grupos y canales siempre).
- «Escribiendo»: `typingRelay.ts` (miembros en caché unos segundos).
- Info: `infoDeMensaje.ts`. Fijados: `mensajesFijados.ts`. Reenvío: `reenvio.ts` (copia la referencia del archivo; nada borrado ni cifrado).
- Avisos push del mensaje: `pushService.ts`, `pushPreview.ts`, `repartoDePush.ts` (de otros módulos; aquí solo se usan).

### Shared (`shared/src/`, motores puros)

- Acciones: `accionesDeMensaje.ts`. Editar: `editarMensaje.ts`. Borrar: `eliminarMensaje.ts`.
- Fijados: `mensajesFijados.ts`, `textoDelFijado`. Destacados: `destacados.ts`. Reenvío: `reenvio.ts`.
- Menciones: `menciones.ts`, `mentionCandidates.ts`. Atajos de emoji: `emojiShortcode.ts` + `emojiNamesData.ts` (carga diferida).
- Acuses: `acuses.ts`. Escribiendo: `escribiendo.ts`. Temporales: `disappearing.ts`.
- Búsqueda: `busquedaDeMensajes.ts` (subcadena, regex escapado). Exportar: `chatExport.ts`.
- Enlaces: `enlaces.ts`, `vistaPrevia.ts`. Mensaje largo: `mensajeLargo.ts`.
- Ventana de mensajes y sincronía: `messageWindow.ts`, `sync.ts`, `conciliarMensajes.ts`, `almacenDeMensajes.ts`, `outbox.ts`.
- Destino de un envío (respuesta, hilo, «también al chat»): `messageTarget.ts`.
- Compositor: `textoDelComposer.ts`. Diseño plano: `flatLayout.ts`.

## 3. Diferencias APK vs web

| Función | APK | Web |
| --- | --- | --- |
| Buscar dentro del chat | Sí (`BuscadorDelChat.tsx`) | No: lupa atenuada «Buscar (próximamente)» (`Conversation.tsx`) |
| Búsqueda global de mensajes | Sí (`ChatListScreen.tsx`) | No: solo «Buscar chats» por nombre (`ChatList.tsx`) |
| Programar mensaje | Sí | No hay UI ni llamada a `/schedule` |
| Chat secreto | Lee y escribe | No: «Este chat secreto se lee y se escribe en tu teléfono» |
| Compartir desde otra app | Sí (`IncomingShareHost.tsx`) | No aplica |
| Deslizar para responder | Sí | No (menú o flecha) |
| Historial local | SQLCipher en el teléfono | Base local del navegador (`web/src/local`) |
| Destacados en chat secreto | No (el server no ve el texto) | No |

Lo demás (editar, borrar, reenviar, fijar, destacar, info, reacciones, menciones,
«:hug», temporales, exportar, acuses) existe en las dos con el mismo motor compartido.

## 4. Historia reciente (16/10 → 19/11)

- **20/11:** José, de nuevo, nombre de obra cortado a una línea en la cabecera
  del chat (web `Conversation.tsx`, app `EncabezadoDelChat.tsx`): ahora 2
  líneas (`line-clamp-2`/`numberOfLines={2}`), sin techo de alto en el
  contenedor que las recorte.
- **19/11:** en un canal de cliente, `Conversation.tsx` deja la cabecera y las pestañas del canal sobre un servicio abierto desde 768 px; solo en el celular el servicio ocupa todo (diseños cc, ver `obra-canal-cliente-y-tutoriales.md`).

- **16/10:** el historial vive en el teléfono (SQLite y respaldo cifrado). Lo mío queda leído en mis otros equipos.
- **17/10:** editar mensajes (FL9b) y buscar en el chat (FL9c).
- **18/10:** «Info» del mensaje (FL9f) y la tarjeta de los enlaces.
- **19/10:** emojis, @menciones y tarjeta al escribir (0.1.97). Barra como WhatsApp, borradores y mensajes largos (0.1.98).
- **19/10:** fijar mensajes y barra de selección en una línea (0.1.101). Web W0–W2: local-first y paridad de mensajes.
- **20/10:** reacciones, chat contigo («Tú»), fijados como Slack (50, sin vencimiento) y reenviar como WhatsApp (0.1.105).
- **20/10:** «Destacados» aprobado por José. Vista previa de YouTube, TikTok, Instagram y Facebook.
- **21/10:** «Responder» abre el teclado. Formato Slack en canales (diseño `s-01`).
- **25/11:** look de WhatsApp y Telegram: burbujas con color en los dos lados también en los espacios, violeta pleno en oscuro, PDF contenido en la burbuja.
- **22/10:** abrir un mensaje viejo con su contexto. Lo borrado se lee borrado. «Bajar» dice cuántos sin leer.
- **23/10:** un enlace de Google Maps muestra el punto (pendiente 80).
- **23/11:** la tarjeta de ubicación (`LocationCard`/`LocationCardWeb`) gana «Abrir en Waze» junto a
  «Abrir en Maps» (`locationWazeLink` en `shared/src/sharedLocation.ts`); muestra `name`/`address` cuando
  vienen. La reusa, sin cambios de UI propios, el bot post de una ubicación forwardeada de WhatsApp
  (ver `bots-api-y-tarjetas.md`).
- **25/11:** una tarjeta «INFORME» de un canal de cliente lleva «Abrir informe» (web y APK, `BotCardView`); el mensaje le pasa su `clientRef`. Detalle en `obra-canal-cliente-y-tutoriales.md`.
- **25/11:** el visor de fotos y videos (`VisorDeFotos.tsx`) tiene fondo negro sólido, como WhatsApp (antes `bg-black/95` dejaba ver el chat).
- **25/10:** tocar un aviso abre el espacio, el mensaje y el hilo. Aviso de menciones fuera del canal.
- **28/10:** saltar a un mensaje lo mantiene en vista. En la web, el campo es de cada chat y guarda su borrador.
- **30/10:** atajos «:hug», confirmaciones de lectura apagables, temporales (24 h, 7 d, 90 d) y exportar chat (R31/10).
- **02–03/11 (plan 1, fluidez):** SQLCipher, chat frío pintado del disco, una fila nueva no redibuja las demás. José: «aún se siente tosco».
- **09/11:** ningún salto cae por `scrollToIndex out of range` (reporte `3921979f`).
- **11/11:** la cita del hilo nombra el original; un original borrado no se cita. Pegar conserva lo escrito (web).
- **13/11:** «Eliminar para mí» en todos mis dispositivos. «Reenviado». Hora en «Info». Incógnito solo lee.
- **13/11:** un admin del canal o del espacio borra para todos la tarjeta de una app.
- **16/11:** avisos: el teléfono suena con la web abierta; leer en otro lado apaga el aviso; todo mensaje que llega se guarda.

## 5. Diseños de Stitch relacionados

| Diseño | Estado | Evidencia |
| --- | --- | --- |
| `fl6-conversacion` | Implementado (referencia) | FL6 ✅ 17/10 y auditoría FL13d (§48.2 del spec) |
| `chat-grupo`, `multimedia-emojis` | Implementado (referencia) | §48.2: avatar al pie del último mensaje del bloque |
| `fm-app-seleccion` | Implementado | `app/src/chat/FranjaDeFijados.tsx` |
| `fm-app-duracion` | Implementado | `app/src/chat/HojaDeFijarMensaje.tsx` |
| `fm-web-fijado` | Implementado | `web/src/chat/FranjaDeFijados.tsx` |
| `f1-app-reacciones` | Implementado | `reacciones/BarraDeReacciones.tsx`, `PastillaDeReacciones.tsx` |
| `f1-app-quien-reacciono` | Implementado | `reacciones/HojaDeReacciones.tsx` |
| `f1-app-reenviar` | Implementado | `reenviar/ForwardScreen.tsx` |
| `f1-app-fijados` | Implementado | `FranjaDeFijados.tsx`, `fijados/ListaDeFijados.tsx` (app y web) |
| `f1-app-info-fijados` | Implementado | `descripcion/DescripcionDelGrupo.tsx`, `fijados/TarjetaDeFijados.tsx` |
| `f1-web-reacciones-reenviar` | Implementado | `reacciones/BotonDeReaccionar.tsx`, `reenviar/DialogoReenviar.tsx` |
| `f1-web-info-fijados` | Implementado | `web/src/chat/info/DescripcionDelChat.tsx` |
| `e-17-menciones-sugerencias-*` | Implementado | `SugerenciasDeMencion.tsx` (app y web), `shared/src/menciones.ts` |
| `s-01-grupo-formato-slack` | Solo con «grupos como lista» (25/11) | `FlatMessageRow.tsx`, `shared/src/flatLayout.ts`, `GroupsAsListSetting.tsx` |

La banda «Ana respondió en un hilo · Ver» no tiene diseño de Stitch (decisión propia, 16/11).

## 6. Pendientes y deuda conocida

- **Web sin búsqueda de mensajes.** La lupa dice «Buscar (próximamente)». Verificado en código (`web/src/chat/Conversation.tsx`).
- **Web sin programar mensajes.** No hay UI ni llamada a `/api/chats/:id/schedule`. Verificado en código.
- **Web no abre chats secretos.** Muestra el aviso de usar el teléfono. Verificado en código.
- **Destacados no funciona en chats secretos.** Verificado en código (`destacadosRoutes.ts`).
- **Avisos que requieren APK nuevo:** que el toque abra el mensaje o hilo exacto, apagar el aviso con la app cerrada, llevar el texto en el toque. Según spec (§«Avisos… José 16/11»).
- **Aviso con datos lentos sin verificar** en el teléfono de José (APK 0.1.189). Según spec.
- **«:hug» no se prueba con Metro:** el `import()` diferido de la tabla no resuelve en el monorepo; el bundle de producción sí. Según spec (17/11).
- **Punto del riel en dos espacios sin E2E de navegador** (11/11). Según spec.

## 7. Pruebas

**Unitarias (shared):** `accionesDeMensaje`, `editarMensaje`, `eliminarMensaje`, `mensajesFijados`, `textoDelFijado`,
`destacados`, `reenvio`, `menciones`, `mentionCandidates`, `emojiShortcode`, `acuses`, `escribiendo`, `disappearing`,
`busquedaDeMensajes`, `chatExport`, `enlaces`, `vistaPrevia`, `mensajeLargo`, `messageWindow`, `sync`,
`conciliarMensajes`, `almacenDeMensajes`, `outbox`, `messageTarget`, `textoDelComposer`, `reacciones`, `reports` (todos `shared/src/*.test.ts`).

**Server:** `editarMensaje`, `hiddenMessages`, `readReceipts`, `acusesDelChat`, `readAll`, `destacados`, `deletePinned`,
`deleteAppCard`, `reenvio`, `scheduledMessages`, `disappearingMessages`, `typingRelay`, `chatExportRoutes`,
`vistaPrevia`, `vistaPreviaPorSitio`, `vistaPreviaRoutes`, `chatNotifications` (`server/src/*.test.ts`); denuncias en `server/test/reports.test.ts`.

**APK:** `divisorNoLeidos`, `messageWindowRows`, `messageCells`, `hiddenRows`, `disappearSetting`, `readElsewhere`,
`borradores`, `burbuja`, `gestoDeRespuesta`, `linkPreviewCache`, `programados`, `rowKindsDeleted`, `editedMessage`,
`acuseVivo`, `anchorAfterJump`, `scrollSafely`, `paginacion`, `sonarPorMensaje`, `barraDeSeleccion` (`app/src/chat/*.test.ts`).

**Web:** `MenuDelMensaje`, `useAccionesSobreMensajes`, `Composer`, `composerInsert`, `chatDrafts`, `acuseDeLeido`,
`FranjaDeFijados`, `useFijarEnLaWeb`, `TarjetaDeEnlace`, `SugerenciasDeMencion`, `useMencionesDelCampo`,
`useMentionCandidatesWeb`, `useOutsideMentionsWeb`, `useWithoutDisappeared`, `useMessageWindow`,
`dialogoEliminar.appCard`, `destacados/destacados`, `info/ExportChatRow`, `info/DisappearingRow`, `copiarTexto`.

**Maestro:** ninguno propio de mensajes. `app/.maestro/multiseleccion.yaml` es de la lista de chats.
