# As-is · Plataforma · Avisos, push, sonidos e insignias

## 1. Qué es

Cómo se entera una persona de un mensaje o una llamada cuando no está mirando:
push por FCM (APK) y Web Push (navegador), el aviso dibujado por la app, el doble check
sin abrir la app, responder o marcar leído desde el aviso, abrir el chat al tocarlo,
sonidos e insignia de no leídos.

Los avisos por tema de las apps (`notice_topics`) están en `bots-api-y-tarjetas.md`.

**Fecha de corte:** 17/11/2026 (APK 0.1.189, que cambió el aviso nativo el 16/11).
Fuentes: código, `git log`, `specs/ARCHITECTURE.spec.md` §35, §45.28–§45.29, §137,
§179 y §26.

## 2. Qué hace hoy

### Server

- **La regla:** la notificación es el timbre, no la entrega. Al abrir, el cliente
  sincroniza por cursor (`pushSender.ts`).
- **A quién** (`pushService.ts`, `notifyOffline`): decide destinatarios y texto.
  - Desde el 16/11 un teléfono no se silencia por la presencia de la persona (antes,
    una pestaña web abierta o un socket dormido lo callaban). Solo se salta la pestaña
    del navegador mientras está en línea.
  - Nivel por chat: `todo`, `menciones` o `nada` (`shared/src/menciones.ts`),
    silenciar por tiempo y por horario (rutinas).
  - Llamadas y mensajes llegan al teléfono aunque la persona figure conectada (20/10).
- **Transporte** (`pushTargets.ts`): Android por FCM; web por Web Push con VAPID.
  - FCM HTTP v1 con cuenta de servicio en base64 en el entorno (`credencialFcm.ts`).
    La API legacy de FCM la apagó Google en 2024.
  - Web Push con la librería `web-push` (`webPushSender.ts`).
- **Un token, un envío** (`repartoDePush.ts`): sin duplicados entre devices con el mismo
  token; gana el push de datos (lo dibuja la app).
- **Higiene de tokens:** un token `UNREGISTERED` se borra; cada hora se resume lo que
  respondió FCM (`pushTally.ts`, desde el 05/11).
- **Vista previa** (`pushPreview.ts`): apagada, el aviso dice quién escribió pero no qué
  ni la foto.
- **Rutas** (`pushRoutes.ts`, `/api/push`):
  - `GET /key`: la clave pública VAPID.
  - `POST /entregado`: el teléfono confirma la entrega con un token corto del mensaje
    (`entregaPorAviso.ts`, `tokenDeRespuesta.ts`). Da el doble check sin abrir la app.
    Desde el 16/11 cada confirmación deja una línea con la demora desde el envío.
  - `POST /responder` y `/leido`: responder y marcar leído desde el aviso
    (`respuestaDesdeAviso.ts`).
  - `POST|DELETE /subscribe`: suscripción Web Push.
  - El token FCM se registra en `POST /api/chats/push-token`.
- **Aviso sin chat** (`pushPlainNotice`, 19/11): FCM y Web Push a unas personas, sin mirar presencia ni nivel del chat, con `chatId` vacío (tocarlo solo abre la app). Lo usan las denuncias (`reports.ts`).
- **Miniatura y avatares** en el push: foto del grupo o contacto, y del autor (§111, §113).

### APK

- **Registro del token** (`app/src/chat/pushRegistration.ts`): al entrar, al rotar y al
  volver a la app, también dentro de un espacio (05/11).
- **Aviso nativo** (`app/modules/llamada-entrante/.../AvisoDeMensaje.kt`):
  - Recibe el push de datos aunque la app esté cerrada.
  - Desde 0.1.189: primero dibuja el texto sin red, después confirma la entrega,
    después pide las imágenes (8 s) y redibuja con `setOnlyAlertOnce`.
  - `MessagingStyle` agrupado por chat, resumen, número de mensajes (`setNumber`).
  - Acciones Responder y Marcar como leído (`ReceptorDeMensaje`).
  - Canal `mensajes-v2` (`shared/src/aviso.ts`, `CANAL_MENSAJES`).
  - `NoticeThumbnail.kt`: miniatura. Ícono monocromo `assets/notification-icon.png`.
- **Llamada y recordatorio a pantalla completa:** `AvisoDeLlamada.kt`, `ReminderAlarm.kt`,
  `ui/FullScreenCallsPrompt.tsx` (pide el permiso de pantalla completa).
- **Abrir desde el aviso:** `ui/noticeOpener.ts`, `ui/destinoDeAviso.ts`,
  `ui/useAbrirDesdeAviso.ts`, `ui/openChatRequest.ts`. Abre el espacio, el mensaje y el
  hilo (25/10). Sobrevive al refresco del JWT y a la carga diferida de expo-updates.
- **Limpiar avisos** (`chat/useLimpiarAvisoDelChat.ts`, `chat/noticeSync.ts`): mi propio
  acuse de lectura (leído en la web u otro teléfono) borra los avisos de ese chat
  (16/11). Cada mensaje que llega por socket se guarda en el teléfono, así el toque pinta
  al instante.
- **Aviso local** con la app abierta: `chat/avisoLocal.ts`.
- **Sonido:** el del canal de Android; `llamando.m4a` para llamadas; los guiños traen
  sus propios sonidos (`app/assets/sonidos`).
- **Conexión permanente:** `modules/servicio-socket` (servicio en primer plano)
  mantiene el socket vivo; se enciende en Ajustes.
- **Vista previa:** `settings/NoticePreviewSetting.tsx`.

### Web/PWA

- **Activar** (`web/src/push.ts`, `enablePush`/`disablePush`): fila en Ajustes.
- **Franja** «Activa las notificaciones» (`notify/NotificationsBanner.tsx`,
  `notificationsOffer.ts`). En iPhone sin instalar avisa que hace falta instalar.
- **Aviso del navegador** con la pestaña abierta: `notify/browserNotice.ts`.
- **Service worker** (`web/public/sw.js`): `push` muestra la notificación;
  `notificationclick` abre el chat.
- **Sonido** (`sonidos/sonidoDeMensaje.ts`): tono sintetizado con Web Audio. Suena lo que
  no estoy mirando; no lo mío, ni lo silenciado, ni avisos del sistema. Se despierta con
  el primer toque.
- **Insignia:** `navigator.setAppBadge` con los no leídos y el título de la pestaña con
  pendientes (`Shell.tsx`, `useTituloConPendientes`).
- **Vista previa:** `privacy/NoticePreviewChoice.tsx`.

### Shared

- `aviso.ts` (`armarAviso`, canal), `menciones.ts` (niveles, `ringsFor`),
  `muteDuration.ts`, `routines.ts`, `hiddenNotice.ts`, `nudge.ts`, `noticeTopics.ts`.

## 3. Diferencias APK vs web

| Tema | APK | Web/PWA |
| --- | --- | --- |
| Transporte | FCM, push de datos | Web Push (VAPID) |
| Quién dibuja | La app (Kotlin), agrupado por chat | El service worker |
| Doble check sin abrir | Sí (`/push/entregado`) | No |
| Responder desde el aviso | Sí | No verificado |
| Llamada con pantalla bloqueada | Pantalla completa nativa | No suena bloqueado (límite del navegador) |
| Sonido | Canal de Android | Web Audio, solo con la pestaña viva |
| Insignia | `setNumber` del aviso | `setAppBadge` |
| iPhone | No hay app | Solo instalada en inicio y tras un gesto |

## 4. Historia reciente

- **17/10** · El aviso lo dibuja la app y acusa la entrega con la app cerrada (FL8.2).
  Llamada a pantalla completa con la app cerrada (FL8.1).
- **18/10** · Avisos sin duplicar; «Responder» y «Marcar como leído» desde el aviso.
- **20/10** · El teléfono recibe siempre el aviso de llamada y mensaje. Sonido de mensaje
  en la web. @todos y @aquí.
- **22/10** · Miniatura en el push y en la lista; fotos en el push de mensajes; aviso a
  admins el día antes del cumpleaños.
- **25/10** · Destino del aviso en el push: tocarlo abre espacio, mensaje e hilo (B3).
  Cuatro arreglos del toque en frío.
- **28/10** · Un aviso tocado con la app cerrada llega aunque expo-updates retrase la
  carga (0.1.172).
- **29/10–30/10** · Silenciar por horario y por tiempo. Vista previa apagable.
- **05/11** · El teléfono registra el token también dentro de un espacio; un token
  vencido deja rastro. Franja de avisos en la PWA de iPhone.
- **16/11** · El teléfono suena con la web abierta; leer en otro lado limpia el aviso;
  lo que llega por socket queda guardado. APK 0.1.189: el aviso se dibuja antes de
  cualquier red. Motivo: dos fotos en #planta nunca avisaron; con datos lentos el
  proceso moría antes de dibujar.

## 5. Diseños de Stitch

| Diseño | Estado | Evidencia |
| --- | --- | --- |
| `e-18` Avisos del chat (app y web) | Implementado en APK; web **no verificado** | Hoja de avisos migrada a `Sheet` (F1, 02/11); spec §67 lo usó como criterio de E3b |
| `a-01` Recordatorio sonando, `a-02` Evento por empezar | Fuera de este grupo (agenda) | INVENTARIO |

No hay un diseño Stitch del aviso del sistema: sigue a WhatsApp (§45.29).

## 6. Pendientes y deuda conocida

- El aviso nativo con datos lentos no se puede simular en el emulador: lo prueba José en
  su teléfono. **Según commit** `bd80fe37` (16/11).
- En iPhone la PWA no recibe llamadas con la pantalla bloqueada ni mantiene el socket en
  fondo. **Según spec** (PLANES §3.2).
- No se probó en un iPhone real que llegue un aviso con la app cerrada. **Según spec**
  (PLANES §3.5).
- iOS nativo no existe: haría falta emisor APNs en el server (plan 2, I2). **Según spec**;
  `app.json` no tiene `ios.bundleIdentifier` (**verificado en código**).
- El comentario de cabecera de `pushSender.ts` aún habla de `FCM_SERVER_KEY`; la
  credencial real es la cuenta de servicio de `credencialFcm.ts`. **Verificado en
  código** (comentario viejo).
- Responder desde el aviso en la web: **no verificado**.

## 7. Pruebas

**Unit (server):** `server/test/pushSender.test.ts`, `pushService.test.ts`,
`pushImage.test.ts`, `respuestaDesdeAviso.test.ts`, `llamadaDesdeElAviso.test.ts`,
`server/src/pushRoutes.test.ts`, `pushTargets.test.ts`, `pushPreview.test.ts`,
`repartoDePush.test.ts`, `credencialFcm.test.ts`, `entregaPorAviso.test.ts`,
`chatNotifications.test.ts`, `serviceWorker.test.ts`.

**Unit (shared):** `aviso.test.ts`, `menciones.test.ts`, `muteDuration.test.ts`,
`routines.test.ts`, `hiddenNotice.test.ts`, `noticeTopics.test.ts`.

**Unit (APK):** `app/src/ui/noticeOpener.test.ts`, `destinoDeAviso.test.ts`,
`openChatRequest.test.ts`, `fullScreenPrompt.test.ts`, `permisos.test.ts`.

**Unit (web):** `web/src/notify/notificationsOffer.test.ts`, `browserNotice.test.ts`,
`web/src/sonidos/sonidoDeMensaje.test.ts`, `web/src/pwa/swRoutes.test.ts`.

**Maestro:** ninguno.

**E2E registrado:** rn-smoke del APK 0.1.189 en el emulador, 3 aperturas limpias (16/11).
