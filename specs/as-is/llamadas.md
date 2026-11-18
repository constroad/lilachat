# As-is · Llamadas (1:1, grupales, video, enlaces e historial)

> Fecha de corte: **17/11/2026**. Fuentes: código de `main`, `git log` desde el 06/10,
> `specs/ARCHITECTURE.spec.md` (§62, §95, §106, §109, §148, §153, §154, §159),
> `specs/AS-IS-0.1.170.spec.md` (13/11 noche, APK 0.1.183) y `design/stitch/INVENTARIO.md`.

## 1. Qué es

Llamadas de voz y video de Lilachat, con WebRTC entre los dispositivos. El server solo
reparte señales (es un «cartero»); los medios van directo o por TURN.

- **1:1** (`call.*`): chats de dos personas, nunca un chat bloqueado.
- **Grupales** (`groupcall.*`): grupos y canales, malla de hasta 4 (`GROUP_CALL_MAX`).
  Nunca un chat secreto. Es un protocolo aparte para no tocar la 1:1.
- **Llamada programada** y **enlace de llamada**: solo en chats de dos.
- No hay servidor de medios (SFU). No se graban llamadas.

## 2. Qué hace hoy

### 1:1

- Ofrecer, sonar, contestar, rechazar, colgar. Timbre de 30 s (`CALL_TIMEOUT_MS`) y
  45 s para conectar (`CALL_CONNECT_TIMEOUT_MS`, `shared/src/call.ts`).
- La oferta se guarda en memoria mientras suena (`server/src/llamadas.ts`): quien
  conecta en ese tiempo (por ejemplo, al tocar el push) la recibe con sus candidatos ICE
  (hasta 40). Un reinicio del server corta la llamada.
- Contestar en un dispositivo corta el timbre en los demás (`contestada-en-otro`).
- **Timbre huérfano (José 17/11).** José llamó a Wilson: le salió «no contestó» y la pantalla
  de Wilson siguió en llamada; al rellamar, «está en otra llamada». El server se reinició 14 veces
  ese día y el timbre vive en memoria. Tres arreglos:
  - Al vencer el timbre en el server, todos los miembros reciben `call.end` con
    `motivo: 'sin-respuesta'` por socket, no solo el push que apaga la pantalla nativa.
  - Al conectar, el server manda `call.ringing { chatIds }` (vacío también). Un teléfono que
    sigue sonando en un chat que no está en la lista la da por terminada (`isStaleRing`).
  - Una oferta nueva en el chat que todavía suena reemplaza al timbre viejo, en vez de
    responder «ocupado» (`incomingOfferAction`, motor en `shared/src/call.ts`, APK y web).
- **APK con la app cerrada:** llamada entrante a pantalla completa con tono y «deslizar
  para contestar» (`DeslizarParaContestar.tsx`, módulo nativo `llamada-entrante`:
  `AvisoDeLlamada.kt`, `LlamadaEnCurso.kt`). Contestar o rechazar con el teléfono
  bloqueado usa un token corto del push, sin sesión.
- Controles como WhatsApp (c-02): barra «⋯ · cámara · altavoz · micrófono · colgar»
  (`callBarLayout.ts`); minimizar en una pastilla con reloj; «Más opciones» (c-03) con seis
  efectos rápidos, «Enviar mensaje», «Guiños y stickers» y cancelación de ruido.
- Girar cámara frontal / trasera (`cameraSwitch.ts`); la vista propia sin espejo con la trasera.
- Apagar mi cámara no oculta la del otro (`cameraOn` aparte, 13/11).
- Guiños y stickers dentro de la llamada (`call.reaction` con `key`). Sin ack en 4 s:
  «{nombre} no lo recibió. Puede que tenga que actualizar Lilachat.».
- Cancelación de ruido encendida por defecto, recordada por persona
  (`shared/src/callAudio.ts`). APK: claves `goog*`; web: las estándar.
- **Compartir pantalla:** web en videollamadas con cámara (`getDisplayMedia`); APK desde
  0.1.175 con servicio `mediaProjection` (`screenShare.ts`, `useScreenShare.ts`).
- **Ventana chica (PiP, APK 0.1.183):** una videollamada se achica al salir de la app
  (`pip.ts`, `Pip.kt`, plugin `withCallPictureInPicture`). Se dibuja `PipCallView`. El
  servicio «Llamada en curso» pasa a `microphone|camera` en video.
- Web: la pantalla no se apaga en la llamada (`useScreenWakeLock.ts`).

### Grupales

- Sala por chat en memoria (`server/src/groupCalls.ts`). Motor puro
  `shared/src/groupCall.ts` (`joinGroupCall`, `leaveGroupCall`, `gridOf`, `groupCallBanner`).
- Malla: el que entra ofrece a todos los que ya están. Un participante = un socket.
- El server solo reparte señales entre dos personas de la misma sala.
- Eventos: `groupcall.join` (ack con `peers` y `names`), `groupcall.leave`,
  `groupcall.signal {to, kind}`, `groupcall.get`, `groupcall.reaction`,
  `groupcall.reaction.ack`. Hacia los clientes: `groupcall.state`, `groupcall.ring` (cuando
  la sala nace, con `chatName`), `groupcall.left`. Código: `server/src/groupCallSocket.ts`.
- En el chat: franja «Videollamada en curso · N personas · Unirse». Al nacer, una tarjeta
  con Ignorar / Unirse (no un timbre a pantalla completa).
- Cuadrícula de hasta 2×2 con el nombre de cada uno; minimizada, la misma pastilla.
- Guiños, stickers y girar la cámara también en grupales (29/10).

### Línea en el chat e historial

- Cada llamada deja una línea de sistema (`kind: 'system'`, evento `llamada`): «Llamada
  perdida», «Llamada sin respuesta», «Llamada de voz · 02:13», «Videollamada grupal ·
  3 personas · 02:30». Valor compacto `voz|video:<seg>[:gN]` o `perdida`
  (`shared/src/registroDeLlamada.ts`). La frase la arma cada cliente según quién mira.
- **Historial «Llamadas»:** solo en la web, en el riel (`web/src/calls/CallsDialog.tsx`,
  `GET /api/calls/history`). El APK no tiene pantalla de historial (verificado por
  búsqueda en `app/src`); solo las líneas de cada chat.
- Devolver una llamada perdida: opciones en la línea y recordatorio personal (21/10).

### Programada y enlace

- **Programar llamada** (menú de la cámara, APK y web): un evento con `call: { video }`.
  Avisa a los dos 5 minutos antes. «Unirse a la llamada» desde 10 min antes hasta 1 h
  después (`callJoinState`, `shared/src/scheduledCall.ts`). 400 en un grupo.
- **Enlace de llamada:** `POST /api/chats/:chatId/call-link` →
  `https://lilachat.constroad.com/llamada/<chat>-<v|a>-<firma>` (HMAC, no se guarda).
  `GET /api/call-links/:token` lo valida: solo miembros (403 con motivo); alterado, 404.
  APK: App Links `pathPrefix /llamada`, pregunta «¿Llamar a …?». Web:
  `CallLinkFollower.tsx`, `pendingCallLink.ts` (espera al ingreso, aguanta un 401).

### Red (ICE)

- `GET /api/calls/ice` → servidores ICE. El server pide credenciales efímeras a
  Cloudflare TURN (`server/src/turnCredentials.ts`). Si falla, cae a STUN
  (llamada solo en redes que se ven). Las credenciales nunca van fijas en el APK.

### Superficies

- **APK** (`app/src/calls/`): `ProveedorDeLlamadas.tsx` (llamadas de la sesión),
  `useCall.ts`, `CallScreen.tsx`, `CallControls.tsx`, `CallReactions.tsx`,
  `PipCallView.tsx`, `llamadaNativa.ts`, `estadoDeMedios.ts`, `noiseSuppression.ts`,
  `tonoDeLlamando.ts`, `iceServers.ts`, `useCallScreenHold.ts`; grupales en
  `app/src/calls/group/` (`useGroupCall.ts`, `GroupCallScreen.tsx`, `useGroupReactions.ts`,
  `groupCallView.ts`). Módulo nativo `app/modules/llamada-entrante`.
- **Web** (`web/src/calls/`): `CallProvider.tsx`, `useWebCall.ts`, `callPeer.ts`,
  `CallOverlay.tsx`, `CallMoreMenu.tsx`, `CallReactions.tsx`, `CallsDialog.tsx`,
  `callTones.ts`, `useScreenWakeLock.ts`, `CallLinkFollower.tsx`, `pendingCallLink.ts`;
  grupales en `web/src/calls/group/` (`useWebGroupCall.ts`, `GroupCallOverlay.tsx`).
  `web/src/socketTurn.ts`.
- **Server:** `socket.ts` (relevo `call.offer`, `call.answering`, `call.answer`,
  `call.ice`, `call.end`, `call.reject`, `call.reaction`), `llamadas.ts`,
  `cicloDeLlamada.ts`, `callRoutes.ts` (`POST /api/calls/rechazar`,
  `POST /api/calls/answering`, `GET /api/calls/history`, `GET /api/calls/ice`),
  `callHistory.ts`, `callLinks.ts`, `groupCalls.ts`, `groupCallSocket.ts`,
  `turnCredentials.ts`.
- **Shared:** `call.ts`, `callMedia.ts` (motor de medios común desde 22/10), `callAudio.ts`,
  `callReactions.ts`, `callHistory.ts`, `groupCall.ts`, `registroDeLlamada.ts`,
  `scheduledCall.ts`.

### Dependencias

Cloudflare TURN (credenciales efímeras). Push FCM para el aviso con la app cerrada. No
depende de Portal ni de Inframaq.

## 3. Diferencias APK vs web

| Tema | Web/PWA | APK |
| --- | --- | --- |
| Entrante con la app cerrada | Aviso del navegador | Pantalla completa nativa, deslizar para contestar |
| Historial «Llamadas» | Sí (riel) | No (solo líneas en el chat) |
| Compartir pantalla | `getDisplayMedia` | Servicio `mediaProjection` (desde 0.1.175) |
| Girar cámara en grupal | Pista nueva en cada sender | `applyConstraints` sobre la misma pista |
| Ventana chica | — | PiP nativo (0.1.183) |
| Cancelación de ruido | Restricciones estándar | Claves `goog*` de libwebrtc |
| Pantalla encendida | `useScreenWakeLock` | Servicio en primer plano |

## 4. Historia reciente (06/10 – 17/11)

- **17/10** La llamada suena fuera del chat; entrante a pantalla completa con la app
  cerrada; línea en el chat.
- **18/10** La llamada no se corta al cambiar de app; la contestada desde el aviso recibe
  los ICE.
- **20/10** El teléfono recibe siempre el aviso aunque figure conectado. Tono de llamando.
- **21/10** Devolver una llamada perdida.
- **22/10** Motor de medios compartido; la web hace y contesta llamadas; «Llamadas» en el
  riel web; llamada programada y enlace de llamada.
- **23/10** Girar la cámara; guiños y stickers en la llamada.
- **28/10** Mi cámara vuelve a verse; contestar bloqueado ya no corta; controles como
  WhatsApp, minimizar, efectos, aviso de guiño no recibido.
- **29/10** Llamadas grupales (malla de 4) en APK y web; cancelación de ruido; compartir
  pantalla en la web; guiños y girar en grupales.
- **30/10** APK 0.1.175: compartir pantalla en el teléfono.
- **04/11** Videollamada sin bloqueo.
- **11/11** Traza de la llamada para diagnóstico.
- **13/11** Apagar mi cámara no oculta la del otro.
- **14/11** APK 0.1.183: PiP y cámara viva de fondo.
- **17/11** Timbre huérfano: `call.end` al vencer, `call.ringing` al conectar y la oferta
  nueva del mismo chat reemplaza la vieja. Sin probar entre dos teléfonos.

## 5. Diseños de Stitch relacionados

| Diseño | Estado | Evidencia |
| --- | --- | --- |
| c-02 videollamada controles | Implementado, **parcial**: «Agregar persona» quedó diferido | `callBarLayout.ts`, `CallControls.tsx` |
| c-03 más opciones | Implementado | `CallMoreMenu.tsx`, `noiseSuppression.ts` |
| `llamada-voz.png`, `video-llamada.png` | Diseños viejos de referencia, sin auditoría registrada | — |

## 6. Pendientes y deuda conocida

- **Sin probar:** audio y video reales entre dos teléfonos en una grupal; la E2E usó
  `scripts/demo-group-call.ts`, que solo firma señales (según spec §159).
- **Sin confirmar en un teléfono real:** que la videollamada ya no se corte al cambiar de
  app con el PiP y el servicio de cámara (según as-is 0.1.170).
- **Fuera de alcance (deuda, según spec §159):** programar y enlace en grupos, pasar a
  video a mitad de la llamada, más de 4 personas (pide un SFU), «Agregar persona» a una 1:1.
- El APK no tiene historial de llamadas (verificado en código).
- Salas y timbres en memoria: un reinicio del server corta toda llamada en curso
  (decisión de diseño).
- El 17/11 el server se reinició 14 veces. Cada reinicio corta las llamadas en curso. La causa
  de tantos reinicios no está investigada.
- Un «ocupado» de un solo dispositivo termina la llamada para todos los del que recibe
  (`call.reject` → `alTerminar`). Sin cambiar.

## 7. Pruebas

- **Shared:** `call.test.ts`, `callMedia.test.ts`, `callAudio.test.ts`,
  `callReactions.test.ts`, `callHistory.test.ts`, `groupCall.test.ts`,
  `registroDeLlamada.test.ts`, `scheduledCall.test.ts`.
- **Server:** `llamadas.test.ts`, `cicloDeLlamada.test.ts`, `groupCalls.test.ts`,
  `turnCredentials.test.ts`.
- **APK:** `calls/iceServers.test.ts`, `cameraSwitch.test.ts`, `callBarLayout.test.ts`,
  `estadoDeMedios.test.ts`, `screenShare.test.ts`, `llamadaNativa.test.ts`, `pip.test.ts`,
  `group/groupCallView.test.ts`.
- **Web:** `CallOverlay.test.tsx`, `CallReactions.test.tsx`, `CallsDialog.test.tsx`,
  `useWebCall.test.tsx`, `useScreenWakeLock.test.tsx`, `pendingCallLink.test.ts`,
  `group/useWebGroupCall.test.tsx`, `group/GroupCallOverlay.test.tsx`.
- **Maestro:** sin flujo de llamadas en `app/.maestro/` (verificado).
- **Script E2E:** `scripts/demo-group-call.ts` (un par que firma señales).
