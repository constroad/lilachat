# Planes: fluidez, iPhone y PWA (02/11/2026)

> Pedido de José (02/11): tres análisis y tres planes con fases. Decisión del
> mismo día: **empezar por la fluidez, con todas sus fases.** iPhone y PWA
> quedan escritos para cuando él decida. El avance se anota al final (§5) y
> cada fase cerrada deja su sección en `ARCHITECTURE.spec.md`.

## 1. Fluidez: por qué Lilachat se siente torpe frente a Telegram

Telegram es código nativo con vistas propias, SQLite local y todo medido. Con
React Native no se iguala al 100 %, pero la distancia que hoy se siente tiene
causas concretas en nuestro código.

**Lo que ya está bien y no se rehace:** arquitectura nueva + Hermes, FlashList
2, expo-image con `recyclingKey`, teclado en el hilo de UI
(keyboard-controller, `ChatBottom`, `useScrollConTeclado`), caché local cifrada,
filas memoizadas, campo de texto no controlado, Proguard (§49, §59 y §79 del
spec de arquitectura).

### 1.1 Las causas, por impacto en lo que se siente

| # | Lo que se siente | Causa (evidencia) | Qué hace Telegram |
| --- | --- | --- | --- |
| 1 | Toda hoja o pantalla encima «se demora» | 89 archivos usan `Modal` de RN (`ui/Modal.tsx`). En Android cada `Modal` es un `Dialog`: ventana nueva (100–200 ms), animación del sistema, sin arrastre. El wrapper lo muestra 2 cuadros después de contarse y suelta 400 ms después de cerrar. `overlays.ts` y el `freeze` existen solo porque los modales rompen el seguimiento del teclado | Hojas como vistas de la misma ventana, con resorte y arrastre |
| 2 | Abrir una foto | `VisorDeImagen`: `Modal` con `fade` + `FlatList` que se monta al abrir. Sin zoom desde la miniatura ni arrastrar para cerrar | Zoom desde la miniatura; cierre arrastrando |
| 3 | Teclado | Ya va en el hilo de UI. Quedan: el salto de ~50 ms al cerrar (padding final, §59), el `runOnJS` al terminar la animación que redibuja `ChatBottom`, listeners en JS. Sin cierre interactivo | Lista anclada abajo; el teclado se cierra arrastrando |
| 4 | Tocar y «no pasa nada» | 231 archivos con `Pressable`, 20 con `android_ripple`. El `active:` de NativeWind corre en JS: con el hilo ocupado la presión no se ve | Ripple nativo instantáneo |
| 5 | Entrar a un chat fuera de los 10 recientes | Lectura asíncrona + descifrado por fila en JS (ver 1.2); §49 midió 0,3–0,8 s hasta pintar | Lee SQLite de forma síncrona: pinta en el mismo cuadro |
| 6 | Enviar | Hay burbuja pendiente y háptico. Falta medir el scroll al enviar y el morph micrófono↔enviar | Animación de salida de la burbuja |

Nada de esto está medido en un teléfono. §49 dejó pendiente el contador de
cuadros caídos; §79 midió solo el guiño y en build de desarrollo.

### 1.2 Lo local-first que falta (corrección del 02/11)

El almacén existe desde el 15/09 (F12.0): SQLite, historial entero, una fila
por mensaje. Lo que falta es **lo síncrono**. Hoy, al abrir un chat: pedir la
clave al Keystore (async), `getAllAsync` de 50 filas, y **descifrar 50 sobres
AES-GCM en JavaScript**. El 18/10 se tapó con `memoriaDeChats` (10 chats en
RAM, precarga al apoyar el dedo): un parche al síntoma. Fuera de esos 10 chats
sigue igual.

Cómo se llegó: el 26/08 se cifró cada fila con el motor de F9 «para no tener
un segundo mecanismo» (WhatsApp y Telegram guardan la base en claro dentro del
sandbox; Signal la cifra entera con SQLCipher, en nativo y transparente); el
15/09 se conservó el sobre y la API async; el 18/10 la auditoría tomó el
camino barato y el contador de cuadros quedó pendiente.

### 1.3 Plan 1 — fases

| Fase | Qué | Cómo se prueba | Sale por | Esfuerzo |
| --- | --- | --- | --- | --- |
| **F0 Medir** | Contador de cuadros caídos (JS y UI) por interacción: abrir chat, teclado abrir/cerrar, abrir foto, enviar, abrir hoja. Va al diagnóstico existente (`diagnostico/`), que ya sube a LilaStore. Resumen «Fluidez» en Ajustes › Diagnóstico. Perfetto + `gfxinfo` del build release en el emulador | José corre 2 min en su teléfono; números antes/después en el spec | OTA | 1 día |
| **F1 Fuera los modales** | `Sheet` propio (Reanimated, misma ventana, arrastre para cerrar) y `Overlay` a pantalla completa con `presentation: 'transparentModal'` del stack nativo. Migrar por uso: adjuntar, visor, hilo, detalle, emojis, el resto. Borrar `overlays.ts` y el `freeze` cuando no quede `Modal` sobre un chat | E2E de cada hoja + F0 antes/después | OTA | 4–5 días |
| **F2 Visor de fotos** | Zoom desde la miniatura (medir la burbuja, animar una copia encima), full-res precargada al apoyar el dedo, arrastrar para cerrar, barras que se desvanecen | Grabación cuadro a cuadro | OTA | 2 días |
| **F3 Teclado** | Quitar el padding final (lista anclada abajo con `blankSpace` animado), `KeyboardGestureArea` para cerrar arrastrando, sin `runOnJS` al terminar, panel de emojis del alto exacto del teclado | F0 en teléfono; chat corto y chat lleno | OTA | 2 días |
| **F4 Toque** | `android_ripple` o feedback en Reanimated en filas, botones y burbujas; `onPressIn` precarga donde falte | Captura con el dedo apoyado | OTA | 1 día |
| **F5a Lectura síncrona** | Clave del Keystore leída una vez al arrancar; `getAllSync` de la última página al montar; descifrado en el mismo render. El chat nace pintado para todos los chats. Se borra `memoriaDeChats` y la precarga | Abrir chat frío: 0 cuadros en blanco; costo del descifrado medido | OTA | 1 día |
| **F5b SQLCipher** | `expo-build-properties › useSQLCipher: true`, `PRAGMA key` desde SecureStore, columnas reales en claro dentro de la base cifrada, migración en fondo idempotente por lotes. Búsqueda local por SQL (F12.3) y scroll hacia arriba sin descifrar en JS | Mismo criterio que F5a, sin el costo del descifrado | **APK** (librería nativa) | 2 días |
| **F6 Higiene** | Sacar `moti` (0 usos), revisar `useLegacyPackaging`, umbral de F0 en el gate `rn-perf` | Gates | APK | ½ día |

Orden: F0 → F1 → F2 → F3 → F4 → F5a → F5b → F6. F1 sola cambia la sensación
de «app pesada». Todo menos F5b y F6 llega por OTA.

## 2. iPhone

### 2.1 Cómo lo hace expo.dev

Distribución **ad hoc** de Apple: `eas device:create` instala un perfil que
devuelve el UDID; Expo lo registra en la cuenta de Apple Developer y arma el
perfil de aprovisionamiento; el IPA se firma (o re-firma sin recompilar,
`eas build:resign`); la página ofrece `itms-services://` + `manifest.plist`.
Límites de Apple: 100 iPhones por año de membresía (los deshabilitados cuentan
hasta renovar), perfil de 1 año, re-firma por cada iPhone nuevo. LilaStore
podría replicarlo (1–2 semanas) con los mismos topes. Para «algunos
ingenieros» y el iPhone de José no conviene.

### 2.2 Las cuatro puertas

| Puerta | Quién instala | Límite | Revisión | Caducidad | Para nosotros |
| --- | --- | --- | --- | --- | --- |
| Ad hoc (Expo / LilaStore) | UDID registrado | 100/año | No | Perfil 1 año | Solo si TestFlight se rechaza |
| TestFlight interno | Usuarios del equipo en App Store Connect | 100 | No | Build 90 días | José + ingenieros |
| **TestFlight externo (enlace público)** | Cualquiera con la app TestFlight | 10 000 | Beta App Review en la primera build de cada versión (< 1 día) | Build 90 días | **Recomendada** |
| App Store | Cualquiera | — | App Review completa | — | Destino de una app pública |

Los 90 días no pesan: se publica cada semana. Versión de marketing fija y solo
sube el build number; las funciones siguen por OTA.

Requisitos previos, de José: Apple Developer Program (US$99/año; como
Organización pide D-U-N-S, 1–2 semanas; como Individuo sale con su nombre).
App Store exige además eliminar cuenta desde la app (no existe), política de
privacidad, declaración de cifrado (`ITSAppUsesNonExemptEncryption` +
autoclasificación BIS), moderación (reportar y bloquear existen).

### 2.3 Lo que la app tiene de Android

| Pieza | Hoy | En iOS |
| --- | --- | --- |
| `servicio-socket` | Mantiene el socket vivo | No existe: iOS corta el socket en fondo. Todo lo en vivo pasa a APNs |
| `llamada-entrante` | Pantalla nativa | CallKit + PushKit. Fase 2; antes, notificación normal |
| `share-into` | Destino de «Compartir» | Share Extension (target aparte, App Group). Fase 2 |
| `pdf-pages` | Páginas del PDF | WKWebView renderiza PDF; o PDFKit |
| `subject-cutout` | ML Kit | VisionKit iOS 17+; o sin la función al inicio |
| `instalador-apk` | Autoactualización | No aplica: TestFlight actualiza |
| Push FCM v1 | `getDevicePushTokenAsync` | Token APNs: emisor APNs (`.p8`) en el server. Llamadas: VoIP push |
| OTA | `otaRoutes.ts:94` rechaza `expo-platform !== 'android'`; export solo android | Runtime por plataforma, export y guard por plataforma |
| Enlaces `/unirse`, `/llamada`, `/s/` | intentFilters | Universal links: `associatedDomains` + AASA |
| Ubicación en vivo, llamadas, tareas | FGS | `UIBackgroundModes`: location, audio, voip, remote-notification, processing |
| `expo-intent-launcher` (2 usos) | Instalador y archivos | `expo-sharing` / `Linking` |

Cero ramas `Platform.OS` en el JS compartido: el trabajo es nativo y de
configuración.

### 2.4 Dónde se compila

Esta Mac (M4, 16 GB): sin Xcode, 7,3 GB libres; Xcode pide ~20 GB. La mini (M1,
8 GB) puede archivar, lento. EAS Build: gratis 15 builds iOS/mes con tope de
45 min (riesgo con WebRTC); pago desde US$19/mes o US$2–4 por build. **No se
contrata sin el OK de José.**

### 2.5 Plan 2 — fases

| Fase | Qué | Esfuerzo |
| --- | --- | --- |
| **I0 Papeles (José)** | Apple Developer (D-U-N-S si es Constroad), clave APNs `.p8`, decisión Xcode local vs EAS | 1–2 semanas de espera |
| **I1 Que compile** | `ios.bundleIdentifier`, `infoPlist`, entitlements, `UIBackgroundModes`; los 6 módulos con `platforms` y stubs iOS; `pdf-pages` por WKWebView; `prebuild --platform ios`; primer build en simulador | 3–4 días |
| **I2 Que viva en fondo** | Emisor APNs en el server; mapeo de payloads; token APNs; sin `servicio-socket`: reconciliar al volver | 3 días |
| **I3 OTA y enlaces** | Manifest por plataforma, export y guard iOS, firma; AASA + universal links | 2 días |
| **I4 TestFlight** | App en App Store Connect, primera build, enlace público, instructivo en LilaStore | 1 día + Beta Review |
| **I5 Paridad** | CallKit/PushKit, Share Extension, VisionKit | 5–6 días |
| **I6 App Store** | Eliminar cuenta, privacidad, cifrado, capturas, revisión | 3 días + revisión |

I1–I4 dan la app usable en un iPhone. I5 la deja como en Android.

## 3. La web como PWA en el teléfono

### 3.1 Lo que ya tiene

Manifest `standalone` con íconos maskable, service worker (assets cache-first,
navegación con 4 s de espera, push con notificación visible), Web Push con
VAPID, insignia de no leídos, IndexedDB (Dexie), chunks diferidos, E2EE en
WebCrypto, un panel bajo 900 px, hojas inferiores bajo 640 px.

### 3.2 Lo que iPhone permite y no

| | iPhone (Safari) | Android (Chrome) |
| --- | --- | --- |
| Instalar | Sin prompt: Compartir → «Añadir a pantalla de inicio». En iOS 26 todo sitio añadido abre como app | `beforeinstallprompt` (ya se usa) |
| Push | Solo instalada y tras un gesto; cada push muestra notificación | Sí |
| Insignia | Sí (16.4+) | Sí |
| Almacenamiento | Instalada: cuota grande, sin borrado de 7 días. **Particionado:** lo de Safari no lo ve la app instalada (sesión de nuevo) | Sí |
| Destino de «Compartir» | **No** | Sí |
| Socket en fondo | No: al bloquear, muere | No |
| Llamadas | WebRTC en primer plano; sin CallKit; no suena bloqueado | Igual |
| Cámara, micrófono, notas de voz, fotos, PDF, ubicación, Contact Picker | Sí | Sí |
| Vibración | No | Sí |

### 3.3 Lo que a la web le falta para un teléfono

Nunca se auditó pantalla por pantalla a 390 px. En el código: sin manejo de
`visualViewport` (en Safari la barra de escribir queda bajo el teclado: el
fallo más grave para un chat); `height: 100 %` sin `viewport-fit=cover` ni
safe areas; sin metas de Apple; acciones solo por hover; conversación mínima
de 420 px y paneles laterales de escritorio; picker de emojis de escritorio.

### 3.4 Plan 3 — fases

| Fase | Qué | Esfuerzo |
| --- | --- | --- |
| **P0 Auditoría** | Playwright a 390×844 y 360×800, cada pantalla; capturas y punch list en el spec | 1 día |
| **P1 Shell móvil** | `visualViewport` para el teclado, `100dvh`, safe areas, metas de Apple, historial para «atrás», toque sostenido donde hay hover, emojis como en la app | 3–4 días |
| **P2 Instalación en iPhone** | Detectar iOS sin standalone → guía «Instalar en iPhone»; permiso de push después de instalar; aviso de volver a entrar | 1 día |
| **P3 Paridad** | Contact Picker, notas de voz en formato aceptado, embeds de video, cámara propia, recorte | 2–3 días |
| **P4 Último recurso** | Página en LilaStore para iPhone que apunta a la PWA; medir instalaciones | ½ día |

Límite sin arreglo por código: sin fondo, sin Share Target, sin llamada con
pantalla bloqueada. La PWA sirve para leer y responder; no reemplaza al APK ni
a la app de iOS.

## 4. Orden entre los tres planes y decisiones de José

1. **Hoy:** F0 (medir) y, si José lo decide, I0 (los papeles de Apple demoran
   semanas).
2. **Semana 1:** F1–F4; P0 en paralelo si la PWA entra.
3. **Semana 2–3:** F5a, F5b y F6; I1–I4 cuando la cuenta de Apple esté lista.

Decisiones de José: Organización vs Individuo en Apple; Xcode local (liberar
20 GB) vs EAS; si la PWA entra o se descarta.

**OTA.** Lilachat hoy usa su propio servidor de OTA
(`lilachat.constroad.com/api/ota/manifest`); LilaStore ya aloja la OTA de
cualquier app (`lilastore.constroad.com/api/v1/apps/<slug>/ota/manifest`,
lilafotos ya está ahí). La migración de Lilachat va en el próximo APK
(`DEPLOY.spec.md` §4-bis). Las fases marcadas «OTA» salen por el servidor que
esté vigente ese día.

## 5. Avance

### Estado por fase (04/11/2026, 11:50)

> **Corrección del 04/11.** Las cifras de cuadros caídos (JS y UI) de §5.1 a §5.9
> y de esta tabla están infladas: el medidor contaba cuadros normales como
> caídos (§5.10). Los milisegundos con nombre, las cuentas de celdas y filas y
> `gfxinfo` siguen valiendo.

| Fase | Estado | Falta |
| --- | --- | --- |
| F0 Medir | **Hecha.** En `main`, OTA `f4ca42ef` en vivo, probada en el emulador | 2 min en el teléfono de José para el número real |
| F1 Fuera los modales | **Hecha** (APK 0.1.177). Host en la misma ventana (sesión y chat), capas animadas, puente de contextos, `Sheet` con arrastre: avisos, clip, fijar, ficha de persona, historial y acciones de miembro; con la OTA `ad44c54e`, siete más (§5.8), y «Programar mensaje» con la OTA `84a5591b` (§5.9). El bloqueo de la app queda sobre todas las capas | Con las OTA `7f968756`, `2ab8381a` y `0fafe027`, 17 hojas más y el teclado sobre una hoja (§5.11). Faltan 6 E2E sin escenario real, y `AppFormSheet`, `CallControls` y `CallReactions` siguen en `Modal` a propósito. `overlays.ts` y el congelado se QUEDAN: una hoja con campo de texto sube el teclado igual (§5.3) |
| F2 Visor de fotos | **Hecha** (APK 0.1.177). La foto crece desde su burbuja y vuelve a ella; arrastre que muestra el chat; foto completa pedida al apoyar el dedo; barras con fundido | El número en el teléfono de José (el emulador captura fotos negras, §5.3) |
| F3 Teclado | **Hecha** (APK 0.1.178). El teclado se cierra arrastrando el chat (y el hilo) hacia abajo; al cerrarse el panel de emojis el chat baja con él en el hilo de UI (§5.4) | Probarlo con un teclado completo en el teléfono de José (el emulador usa el compacto) |
| F4 Toque y envío | **En curso** (APK 0.1.178 y 0.1.179). Ripple nativo; sticker, GIF y guiño con burbuja o animación al instante; la lista de atrás ya no se redibuja con cada mensaje; el botón emoji/teclado es el único que escucha al panel; cerrar el panel no redibuja la grilla ni la lista; la barra no se redibuja con el eco (OTA); un envío dibuja 2 filas y no todas las montadas, y el chat baja de 437 a 222 ms (OTA `eaa9ac0d`); FlashList pide 4 celdas por envío y no 147 (OTA `cdc96f59`, §5.9). Sticker de 63 a 17 cuadros de JS caídos, GIF de 37 a 3, guiño de 232 a 57 (§5.4 a §5.7) | Medir con la Mac libre (las de §5.10 son con carga ~20) y decidir ahí si se bajan los 3 renders de `ChatScreen` por envío. La lista del espacio ya no se dibuja al abrir un chat (§5.11) |
| F5a Lectura síncrona | **Hecha** (APK 0.1.179). El «mediana de 0 cuadros de JS caídos» de §5.5 era un artefacto del medidor: falta repetirlo con la ventana corregida (§5.11). La clave y la base quedan en mano al iniciar la sesión y `useChat` nace con la última página leída en su render (`readLastPageSync`) | `leer-chat` no aparece entre los trabajos con nombre de la ventana: medirlo en el teléfono de José y recién ahí decidir si se borra `memoriaDeChats` |
| F5b SQLCipher | **Hecha** (APK 0.1.179, E2E de la mudanza en §5.5). Base `lilachat-v2.db` cifrada entera con la misma clave (cruda, sin PBKDF2), filas en claro adentro con el texto en su columna; mudanza chat por chat, la fila de v1 se borra después de quedar en v2; sin SQLCipher en el binario sigue v1 | Cerrar sesión y volver a entrar (no se probó: pide un código por WhatsApp a la cuenta real de José); +2,3 MB de APK |
| F6 Higiene | **Casi hecha**: fuera `moti` (0.1.178); `useLegacyPackaging` se queda en `true`, medido en §5.11 | Umbral de F0 en `rn-perf`, que vive en constroad-skills |

### Bitácora

| Fecha | Fase | Estado |
| --- | --- | --- |
| 02/11/2026 | F0 | Código en `main` (46177fb): motor `diagnostico/frames.ts` con tests, samplers JS (rAF) y UI (frame callback de Reanimated) en `frameMonitor.ts` + `FrameMonitorHost`, ventanas abrir-chat · teclado-abrir/cerrar · abrir-foto · abrir-hoja · enviar, bloque «Fluidez» en Ajustes › Diagnóstico. Pendiente: OTA, línea base en el emulador (`gfxinfo`) y 2 min del teléfono de José |
| 02/11/2026 | F0 | OTA `f4ca42ef` publicada y verificada en vivo (runtime 62ff8b1c, git 46177fb); rn-smoke 3/3 limpio, heap 24 MB. E2E en `lilafotos-qa`: el bloque «Fluidez» de Diagnóstico muestra las seis interacciones. Línea base en §5.1 |
| 02/11/2026 | F1 | Rama `fluidez-f1`: `ui/overlay/OverlayHost` (raíz de la sesión y del chat) + `OverlayModal` (capas con slide/fade de Reanimated, atrás cierra la de arriba); el wrapper `ui/Modal` usa el host más cercano, con interruptor `IN_WINDOW_OVERLAYS`. `ui/Sheet` con arrastre para cerrar (`sheetGesture`, tests) y la hoja de avisos migrada. Pendiente: E2E en el emulador, medir contra F0, migrar las 31 hojas restantes, borrar `overlays`/`freeze` |
| 02/11/2026 | F1 + F2 | APK 0.1.177 (178): hojas en la misma ventana con arrastre, foto que crece desde su burbuja (vuelo por `transform`), arrastre que muestra el chat, foto completa pedida al apoyar el dedo. E2E en el emulador, rn-smoke 3/3, medida en §5.3. Publicada en LilaStore |
| 02/11/2026 | F3 + F4 + F6 | APK 0.1.178 (179): teclado que se cierra arrastrando, ripple nativo, sticker con burbuja al instante, guiño y zumbido al tocar, lista de atrás sostenida, panel que baja con el contenido, fuera `moti`. El diagnóstico dice dónde se va el JS de cada interacción. E2E grabado cuadro a cuadro, rn-smoke 3/3 (heap 22 MB), medida en §5.4. El botón emoji aislado va por OTA |
| 02/11/2026 | F5a + F5b | Rama `fluidez-f5`: lectura síncrona de la última página y base SQLCipher con mudanza chat por chat. Sale en el APK 0.1.179 |
| 03/11/2026 | F1 + F4 | OTA `ad44c54e` (runtime 51e099b7, git 986c228): siete hojas más con arrastre (§5.8). E2E de Cambiar de espacio, ⚡ del espacio y Compartir ubicación: se cierran arrastrando, tocando el fondo y con atrás. Medida limpia del envío: 30 cuadros de JS con ~35 ms de trabajo con nombre, y no es el teclado. rn-smoke 3/3 (heap 21 MB) |
| 03/11/2026 | F1 + F4 | OTA `84a5591b` (git afbd775): cada paso del envío de un texto con nombre y «Programar mensaje» con arrastre (cierra arrastrando, tocando el fondo y con atrás; el borrador queda). La medida mostró 147 celdas pedidas por envío. OTA `cdc96f59` (git 6fd6fdb): una celda por fila con lo que cambia su aspecto (`messageCells`, 16 tests) y el dibujo en `drawMessageCell`; 4 celdas por envío. rn-smoke 3/3 antes de cada OTA (heap 18 y 28 MB), medida en §5.9 |
| 03/11/2026 | F4 | OTA `eaa9ac0d` (runtime 51e099b7, git aa2d248): un mensaje nuevo redibuja solo su fila. Tocar una cita y responder salen de refs; álbumes y citas iguales conservan su objeto (`keptValues`, con tests); pastilla de reacciones, chip del hilo y celda del sticker memorizados. Diagnóstico cuenta «Filas N×». rn-smoke 3/3 (heap 19 MB), medida en §5.7 |
| 02/11/2026 | F4 + F5 | `main` para el APK 0.1.179 (180): F5a y F5b integradas; cerrar el panel ya no redibuja la grilla de stickers ni la lista del chat (los dos se suscriben al panel sin estado, `subscribeEmojiPanel` con tests; panel memorizado con callbacks estables); el guiño entra un cuadro después del cierre del panel; textos vacíos con «aquí». E2E de la mudanza con el historial real del emulador, rn-smoke 3/3 (heap 19 MB), medida en §5.5. Publicada en LilaStore |
| 04/11/2026 | F0 + F4 | OTA `6af04d38` (runtime 51e099b7, git 9753a37): medidor de cuadros corregido (§5.10) y la sesión que se renueva sola, con el socket rechazado que se recupera (ARCHITECTURE §6.4). rn-smoke 3/3; E2E de reconexión con la cola en el emulador |
| 04/11/2026 | F1 + F4 | OTA `7f968756` y `2ab8381a` (runtime 51e099b7, la segunda con git 0883a5b): la lista del espacio no se redibuja al abrir un chat, 17 hojas más en `Sheet` y el medidor cuenta la pausa de montar un chat (§5.11) |
| 04/11/2026 | F1 | OTA `0fafe027` (runtime 51e099b7, git e77fdd4): una hoja sin campo de texto cierra el teclado. Server: borrar un fijado avisa al chat, E2E en Test con la franja que se va sola. rn-smoke 3/3. Un intento anterior falló con 502 porque el server se redesplegaba tras el push: no publicó nada (§5.11) |
| 04/11/2026 | F4 | OTA `6f187a1e` (runtime 51e099b7, git dd75848): la lista del espacio pinta una sola vez, con los canales de cliente ya en su sección, y la app guarda los clientes en disco. Antes salían todos en «Canales» y saltaban a «Clientes». rn-smoke 3/3. Va con el bloque de personas por nombre y `audience` en los atajos (pedidos de Agentes) |

### 5.1 Línea base (02/11/2026, antes de F1)

Emulador `lilafotos-qa` (Pixel 6, Android 15), APK 0.1.176 de release con la OTA
`f4ca42ef`, espacio Test, canal #general. Dos fuentes: `dumpsys gfxinfo` (cuadros
del sistema con jank, por interacción, 5 repeticiones) y el propio contador de F0
(cuadros que no llegaron en el hilo JS y en el de UI). El emulador no es un
teléfono: sirve para comparar antes y después en la misma máquina; el número que
vale para José sale de su teléfono.

**gfxinfo** (cuadros con jank por interacción; mediana · peor):

| Interacción | Jank | p99 |
| --- | --- | --- |
| Abrir #general (en la memoria de 10 chats) | 14 · 16 de ~70 | 65 · 85 ms |
| Abrir el teclado | 10 · 14 | 150 · 400 ms |
| Cerrar el teclado | 15 · 23 | 200 · 450 ms |
| Menú de la cabecera (`Modal` fade) | 12 · 18 de ~61 | 85 · 109 ms |
| Clip (`Modal` slide) | 8 · 14 de ~55 | 101 · 250 ms |
| Enviar un texto | 13 · 13 de ~28 | 65 · 117 ms |

**Contador de F0** (cuadros caídos; mediana · peor):

| Interacción | Veces | JS | UI |
| --- | --- | --- | --- |
| Abrir un chat | 6 | 0 · 4 | 0 · 4 |
| Abrir una hoja | 12 | 5 · 19 | 4 · 15 |
| Enviar un mensaje | 4 | **29 · 88** | 5 · 8 |
| Abrir el teclado | 9 | 14 · 31 | 10 · 24 |
| Cerrar el teclado | 8 | 12 · 15 | 8 · 14 |

**Hallazgo nuevo: enviar traba el hilo JS ~0,5 s** (29 cuadros de mediana en la
ventana de 600 ms). El usuario no lo ve como «la burbuja tarda» porque la burbuja
pendiente sale antes, pero todo lo que depende del JS en ese medio segundo
(scroll, teclado, el próximo toque) se congela. Pasa a ser el primer ítem de F4
(nombre nuevo: «F4 Toque y envío»): perfilar qué corre al enviar (persistencia de
la cola, cifrado y guardado en SQLite, re-render de la lista) y sacarlo del
camino del toque.

Abrir #general da 0 en JS porque ese chat está en `memoriaDeChats`; un chat frío
se mide en F5a.

### 5.2 F1 medida (02/11/2026, 16:05, APK de prueba de la rama `fluidez-f1`)

Mismo emulador, mismo guion y mismo canal que §5.1. El emulador arrancó limpio
(su instantánea), así que el primer «abrir chat» de la tanda vino frío.

| Interacción | Jank antes | Jank con F1 | p99 antes | p99 con F1 |
| --- | --- | --- | --- | --- |
| Abrir #general | 14 · 16 | **7 · 7** | 65 · 85 ms | **300 · 450 ms** |
| Abrir el teclado | 10 · 14 | 7 · 10 | 150 · 400 ms | **32 · 150 ms** |
| Cerrar el teclado | 15 · 23 | **6 · 7** | 200 · 450 ms | **32 · 48 ms** |
| Menú de la cabecera | 12 · 18 | **4 · 5** | 85 · 109 ms | **32 · 57 ms** |
| Clip | 8 · 14 | 7 · 12 | 101 · 250 ms | 77 · 97 ms |
| Enviar un texto | 13 · 13 | 8 · 13 | 65 · 117 ms | 65 · 97 ms |

Todo mejora menos el peor cuadro al abrir el chat. La causa estaba en el
host: cada hoja CERRADA del chat le pedía «sácame» en cada render, y el host
recibía siempre una lista nueva y se redibujaba de gusto. `layers.ts` devuelve
la MISMA lista cuando no hay nada que sacar (test). Se vuelve a medir en el
próximo APK de prueba.

**E2E funcional de F1 en el emulador:** menú de la cabecera (fundido, dentro de
la ventana), «atrás» cierra solo la capa de arriba, detalle del chat como capa,
hoja de avisos encima del detalle (se cierra arrastrando, con «atrás» y tocando
el fondo), hilo a pantalla completa con el teclado (la barra sobre el teclado),
hoja de renombrar con foco automático y botones sobre el teclado, el chat de
atrás conserva su posición al cerrar el hilo. Sin caídas ni errores de JS.
QA: 6 mensajes de prueba borrados con «Eliminar para todos».

### 5.3 F1 + F2 en el APK 0.1.177 (02/11/2026, 17:30)

APK de release 0.1.177 (178) instalado en `lilafotos-qa`, mismo guion que §5.1.

| Interacción | Jank antes (§5.1) | Jank 0.1.177 | p99 antes | p99 0.1.177 |
| --- | --- | --- | --- | --- |
| Abrir #general | 14 · 16 | **7 · 9** | 65 · 85 ms | **57 · 101 ms** |
| Abrir una foto (y volver) | sin medir | 5 · 8 de ~25 | sin medir | 81 · 101 ms |

El peor cuadro al abrir el chat volvió a su sitio: el arreglo de `layers.ts`
(§5.2) era la causa. Abrir una foto no tiene línea base porque F0 no lo medía
con `gfxinfo`; queda como base de las próximas fases.

**E2E funcional de F2 en el emulador** (grabación de pantalla, cuadro a
cuadro): la copia de la foto sale del tamaño de la burbuja y crece hasta la
pantalla en ~250 ms; «atrás» y el arrastre la devuelven a su burbuja; las
barras aparecen con fundido al terminar. La hoja del clip se cierra
arrastrando desde el asa. rn-smoke: 3 aperturas en frío limpias sobre el APK
publicado, heap 24 MB.

**Límite del emulador:** la cámara del emulador captura fotos negras y la
galería no carga miniaturas, así que el vuelo se verificó con fotos negras
sobre fondo negro. Se ve el borde de la copia creciendo, no el contenido. El
número y la sensación reales salen del teléfono de José.

**Decisiones:**
- La copia vuela solo con `transform` (escala y traslación, con una escala
  inversa adentro para recortar). Animar `left/top/width/height` no se
  aplicaba cuadro a cuadro en Fabric y la foto «saltaba».
- `openFromBubble` espera la medida de la burbuja (hasta 100 ms) antes de
  abrir. Sin medida, abre igual con fundido.
- `overlays.ts` y el congelado de la lista se QUEDAN: una hoja con un campo de
  texto sube el teclado y la lista de atrás no debe re-medirse.

QA: las 2 fotos de prueba (seq 82 y 83) borradas con «Eliminar para todos».

### 5.4 F3 + F4 y el envío de stickers en el APK 0.1.178 (02/11/2026, 19:30)

José: «al enviar un sticker aún se siente tosco, no es fluido; pruébalo con
guiño, GIF, etc.». Emulador `lilafotos-qa`, APK de release 0.1.178 (179),
espacio Test, canal #general, grabación de pantalla a 30 cuadros.

**Antes (0.1.177, misma grabación):** el sticker aparecía a los ~600 ms y la
lista daba dos saltos (primero la cabecera, después la imagen); la fila
«Recientes» se reacomodaba bajo el dedo; el guiño esperaba la respuesta del
server para cerrar el panel y se reproducía con el eco.

**Lo que se ve en 0.1.178:**

| Acción | 0.1.177 | 0.1.178 |
| --- | --- | --- |
| Sticker: burbuja en pantalla | ~600 ms, dos saltos | ~130 ms, un solo movimiento, sin salto al confirmarse |
| Guiño: empieza la animación | con el eco del server | 1–2 cuadros después del toque; el panel se cierra solo |
| Guiño: el chat al cerrarse el panel | (no se miraba) | baja con el panel, sin hueco |
| GIF: burbuja en pantalla | sin medir | ~250–300 ms (la vista previa del GIF se decodifica) |
| Teclado | solo se cerraba con atrás | se cierra arrastrando el chat hacia abajo |

**Dónde se iba el JS al enviar** (Diagnóstico › Fluidez, cuadros de JS caídos
en la ventana y trabajo con nombre):

| Interacción | Primer build | Con los arreglos |
| --- | --- | --- |
| Enviar un sticker | 63 · Chat 2× 132 ms, Lista del espacio 2× 79 ms, Barra 2× 41 ms | **23** · Chat 2× 183 ms, Barra 2× 77 ms |
| Enviar un GIF | 37 · Chat 257 ms, Barra 44 ms | **3** · Chat 127 ms, Barra 60 ms |
| Mandar un guiño | 119 · Lista del espacio 2× 207 ms, Barra 2× 168 ms, Chat 157 ms | 161 · Chat 343 ms, Barra 2× 328 ms (la ventana incluye el montaje del guiño) |

El emulador varía entre corridas: los ms sirven para ver QUÉ trabaja, no para
compararlos uno a uno.

**Con la OTA `adc809df` (botón emoji aislado, 02/11/2026, 19:53),** recién
arrancada la app:

| Interacción | Antes de la OTA | Con la OTA |
| --- | --- | --- |
| Enviar un sticker | 23 · Barra 2× 77 ms | **15** · Chat 1× 302 ms, Barra **1×** 122 ms |
| Mandar un guiño | 161 · Barra 2× 328 ms | 232 · Chat 1× 520 ms, Barra **1×** 301 ms |

La barra se dibuja una vez en vez de dos. El guiño sigue siendo lo más
pesado: montar la animación y su fila cuesta ~500 ms de JS, y la barra
desmonta el panel en ese mismo commit. Es el primer punto de la próxima
iteración.

**Hallazgos y arreglos:**

1. **La lista del espacio de ATRÁS se redibujaba con cada mensaje del chat
   abierto.** En Fabric, react-navigation nunca congela la pantalla de abajo
   (`isBelowFocused`), así que el `freezeOnBlur` de «Inicio» (FL12) no hacía
   nada. Tapada por un chat (no al lado, en tablet), la lista sostiene lo que
   muestra (`useCached(..., held)`, `heldEntry.ts` con tests) y se pone al día
   al volver.
2. **Al cerrarse el panel con un guiño, la lista quedaba arriba con un hueco
   blanco 330 ms y después saltaba.** El espacio del panel se achicaba en el
   hilo de UI, pero el recorte nativo del scroll esperaba un commit de React,
   y el JS estaba montando el guiño. Ahora, al final del chat, el contenido
   baja con el panel cuadro a cuadro (`contentDrop`, `panelDrop.ts` con tests).
3. **La barra se redibujaba al abrir y cerrar el panel** solo para cambiar el
   ícono. El botón emoji/teclado es ahora un componente propio
   (`EmojiToggle`), el único que escucha al panel. Sale por OTA.
4. **Pendiente (F4):** el chat entero se redibuja al enviar (130–340 ms en el
   emulador): los archivos en vuelo y la ventana de filas viven en
   `ChatScreen`. Se bajan a la lista en la próxima iteración, junto con
   callbacks estables para la barra.
5. **Pendiente (F4):** el guiño monta su animación y su fila en el mismo
   commit en que se cierra el panel (Chat 520 ms con la OTA). Montarlo un
   cuadro después del cierre, o precargar sus partes al abrir la pestaña.

**E2E del teclado (F3):** con el teclado compacto del emulador, el arrastre
hacia abajo lo cierra y la barra baja con él. Falta verlo con un teclado
completo en un teléfono.

**Build:** el primer intento de recompilar murió a los 2 min con «Gradle build
daemon disappeared»: el vigilante de memoria detuvo tres daemons (7,9 GB),
dos de ellos ociosos de builds anteriores. Antes de compilar: `./gradlew
--stop` (o confirmar que no quedan daemons de otra sesión trabajando).

QA: los 9 mensajes de prueba en #general de Test (stickers, GIF y guiños,
seq 86 a 94) borrados con «Eliminar para todos». El «asdasdads» no es de QA
y quedó.

### 5.5 F4 + F5 en el APK 0.1.179 (02/11/2026, 20:50)

Emulador `lilafotos-qa`, APK de release 0.1.179 (180) instalado encima de
0.1.178 con `adb install -r`, sin borrar datos.

**La mudanza a SQLCipher (F5b):**

| Comprobación | Resultado |
| --- | --- |
| Antes | `lilachat.db` 2,4 MB + WAL 4,1 MB: 2921 mensajes de 36 chats |
| Primer arranque | `lilachat.db` desaparece; queda `lilachat-v2.db` (todo en su WAL al principio, 2,9 MB) |
| Leerla sin la clave | `sqlite3`: «file is not a database». El WAL no deja ver texto en claro («Constroad»: 0 coincidencias) |
| Historial | Los canales de Test muestran las mismas filas que antes (#general 74–94, planta 43–49) |
| Arranque en frío y sin red | Mismo historial, leído solo del disco cifrado |
| Novedades | La hoja «Lilachat 0.1.179» aparece una vez al abrir |
| rn-smoke | 3/3 en frío, heap 19 MB |

El APK pesa 43,2 MB: 2,3 MB más que 0.1.178, por SQLCipher y su OpenSSL.

**Diagnóstico › Fluidez** (cuadros de JS caídos, mediana · peor):

| Interacción | 0.1.178 (+ OTA) | 0.1.179 |
| --- | --- | --- |
| Abrir un chat | 12 · 12 | **0** · 10 (8 aperturas) |
| Mandar un guiño | 232 · Chat 520 ms, Barra 301 ms, UI 19 | **57** · Chat 225 ms, Barra 60 ms, UI 5 |
| Enviar un sticker | 15 · Chat 302 ms | 17 · Chat 378 ms (igual: el ruido del emulador) |

**Qué cambió:**

1. **Cerrar el panel redibujaba la grilla de stickers y la lista del chat.**
   Los recientes de stickers y el «bajar al final» de la lista escuchaban el
   estado del panel con `useSyncExternalStore` solo para reaccionar al
   cierre. Ahora se suscriben sin estado (`subscribeEmojiPanel`, con tests) y
   el panel va memorizado con callbacks estables: al cerrarlo con un guiño
   solo se dibuja el botón emoji/teclado.
2. **El guiño entra un cuadro después del cierre.** Montar el sketch cuesta
   cientos de ms de JS; en el mismo commit que el cierre, el panel tardaba en
   empezar a bajar.
3. **El chat frío nace pintado (F5a)** y **la base pasa a SQLCipher (F5b)**:
   abrir un chat ya no espera a descifrar sobres en JavaScript.

**Gates:** los primeros dieron rojo por tres cosas que no eran del cambio
visible: dos nombres en español de F5b, el panel memorizado contado como
función nueva de 98 líneas (la barra de pestañas salió a `PanelTabBar`), y
el test de `funSeen`, que importaba el módulo con relojes falsos y vencía a
los 5 s con la Mac cargada (load 89: el Gradle de Lila Speak, mis gates y
vitest). Ahora solo el guardado corre con relojes falsos.

**Sigue (F4):** el chat entero se redibuja con el eco del server (Chat
200–380 ms por envío). La lista del espacio se dibuja 2 veces al abrir un
chat. Cerrar sesión y volver a entrar con la base nueva queda sin probar.

QA: el guiño y el sticker de la medida (seq 95 y 96) borrados con «Eliminar
para todos». El emulador quedó en el espacio Constroad, con wifi y datos.

### 5.6 La barra deja de redibujarse con el eco (OTA `1df5c376`, 02/11/2026, 22:40)

Los comandos del chat (`useChatCommandsWithActions`) y sus respuestas
(`useAppAnswers`) devolvían un objeto nuevo en cada render, y pegar una imagen
era una flecha en línea. La barra está memorizada, pero esas tres props
cambiaban siempre: se redibujaba con cada mensaje que llegaba. Ahora los dos
objetos van en `useMemo` y `pastePhoto` sale estable de `useAdjuntosDelChat`.

Tres textos en #general de Test, antes y después de la OTA (Diagnóstico ›
Fluidez, «Enviar un mensaje»):

| | Antes | Con la OTA |
| --- | --- | --- |
| Barra | 2× 116 ms | **1× 13 ms** (solo el campo que se vacía) |
| Chat | 1× 654 ms | 1× 437 ms |
| Cuadros JS (mediana · peor) | 0 · 38 | 21 · 36 |

La mediana de cuadros es ruido del emulador con tres envíos; lo que se movió de
verdad es la barra. Abrir el chat en frío mostró «Disco 1× 68 ms»: es
`leer-chat` (F5a). El resumen usa la mediana de todas las aperturas, y las
que salen de memoria lo dejan en cero. Por eso casi nunca se ve.

**Sigue (F4):** el chat entero (`ChatScreen`) se redibuja con el eco del
server. La causa es que los mensajes viven en su estado. Bajarlos a la lista es
una refactorización aparte.

QA: los 6 textos de la medida (seq 97 a 102) borrados con «Eliminar para
todos». La app quedó en Constroad. rn-smoke 3/3 antes de publicar.

### 5.7 Un envío redibuja su fila, no todas (OTA `eaa9ac0d`, 03/11/2026, 00:00)

Cada fila es `memo`, pero dos de sus props cambiaban con cada mensaje:

- **Tocar una cita.** El salto dependía de `releaseFromEnd`, una flecha nueva
  de `ChatScreen` en cada render. Ahora `useIrAMensaje` lee esa flecha y
  `onNoEsta` de un ref.
- **Responder.** Dependía de los álbumes, que se rearman con cada fila nueva.
  Ahora los lee de un ref.

Además, cada render armaba un arreglo nuevo para cada álbum y un objeto nuevo
para cada cita. `keepUnchanged` (`chat/keptValues.ts`, con tests) devuelve el
objeto anterior cuando nada cambió. La pastilla de reacciones recibe el `seq`
en vez de una flecha. La pastilla, el chip del hilo y la celda del sticker van
memorizados.

Para medirlo, Diagnóstico cuenta las filas que se dibujan dentro de la ventana
(`useRenderCount('fila')`, «Filas N×»). Es un conteo sin tiempo: el resumen
lo muestra después de los tres costos más altos.

Tres textos en #general de Test (Diagnóstico › Fluidez, «Enviar un mensaje»):

| | Antes (OTA `1df5c376`) | Con la OTA `eaa9ac0d` |
| --- | --- | --- |
| Filas dibujadas por envío | todas las montadas (84 a 105: hasta 22) | **2** (la nueva y la anterior, que cambia de grupo) |
| Chat | 1× 437 ms | 3× 222 ms |
| Barra | 1× 13 ms | 1× 13 ms |
| Cuadros JS (mediana · peor) | 21 · 36 | 31 · 53 |

**Los cuadros caídos no son comparables.** La medida corrió con la Mac en
load average 20, con el render de Lila Speak (tres procesos `node` al 250 %).
El conteo de filas no depende de la carga, y es lo que prueba el arreglo. Los
cuadros se vuelven a medir con la Mac libre, o en el teléfono de José.

**Sigue (F4):**

- `ChatScreen` hace 3 renders por envío: el pendiente, la confirmación y el
  eco. Los mensajes viven en su estado. Bajarlos a la lista es la
  refactorización que queda.
- Al abrir un chat, «Lista del espacio 2× 165 ms»: la lista de atrás se dibuja
  dos veces.

QA: los 3 textos (seq 103 a 105) borrados con «Eliminar para todos». La app
quedó en Constroad. rn-smoke 3/3 antes de publicar. El test intermitente
`checklistRoutes` (avisos de dos tildes, 1 de 5 corridas) se arregló en el
mismo push: la ventana del aviso pasó de 30 a 500 ms y se espera con
`vi.waitFor`.

### 5.8 Siete hojas más y el envío medido con la Mac libre (OTA `ad44c54e`, 03/11/2026, 01:15)

**Hojas.** Pasan a `Sheet`: Agregar a lista, el ⚡ del espacio y del chat
(`QuickActionsSheet`), Cambiar de espacio, Compartir ubicación, emojis y
stickers del hilo (`ThreadPicker`), el canal de un tema de una app
(`ChannelPicker`) y las opciones con fotos de un formulario
(`RichChoiceSheet`). Las que tienen una lista adentro se arrastran desde el
asa, para no pelear con el scroll. Cada una conserva su testID.

| Hoja | Arrastre | Fondo | Atrás |
| --- | --- | --- | --- |
| Cambiar de espacio | cierra | cierra | cierra |
| ⚡ del espacio | cierra | cierra | cierra |
| Compartir ubicación | cierra | cierra | cierra |

Faltan en el emulador: el ⚡ del chat (es el mismo componente que el del
espacio, pero #general de Test no tiene acciones), Agregar a lista (pide la
lista personal de José), emojis del hilo (#general de Test no tiene hilos),
el canal de un tema y las opciones con fotos (piden una app con temas y un
formulario con fotos en Test). Al abrir Compartir ubicación, Android pidió el
permiso de ubicación: se rechazó, y la hoja se abre igual.

**El envío con la Mac libre** (load average 2,5, OTA `eaa9ac0d`, #general de
Test):

| | Teclado abierto (5 envíos) | Teclado cerrado (4 envíos) |
| --- | --- | --- |
| Cuadros JS (mediana · peor) | 30 · 36 | 29 · 33 |
| Cuadros UI | 0 · 2 | 0 · 0 |
| Trabajo con nombre | Chat 3× 29 ms · Barra 5 ms · Filas 2× | Chat 3× 31 ms · Barra 5 ms · Filas 2× |

El trabajo que el diagnóstico sabe nombrar suma unos 35 ms. La ventana dura
600 ms (36 cuadros) y se caen 30: casi medio segundo de JS sin nombre. No es
el teclado. Tampoco son los efectos que miran los mensajes, que son baratos,
ni guardar en la base: las escrituras son asíncronas y el cifrado mide ~0 ms.
Un GIF (que no pasa por la cola) tira 3. **Sigue:** poner nombre a cada paso
del camino del texto (el toque en enviar, la cola y su `drainOutbox`, el eco
del socket, el `scrollToEnd`) en la próxima OTA y medir de nuevo.

QA: los 9 textos de las medidas (seq 106 a 114) borrados con «Eliminar para
todos». La app quedó en Constroad. rn-smoke 3/3 (heap 21 MB) antes de
publicar.

### 5.9 FlashList pedía todas las celdas en cada envío (OTA `84a5591b` y `cdc96f59`, 03/11/2026, 03:50)

**Los pasos con nombre** (OTA `84a5591b`, git afbd775, 3 textos en #general
de Test). La Mac estaba con load average ~22 por otra sesión compilando: los
milisegundos no se comparan con §5.8, las cuentas sí.

| Paso | Por envío |
| --- | --- |
| Toque en enviar | 1 ms |
| Cola, confirmar, eco del socket, cifrado | < 1 ms cada uno |
| `scrollToEnd`, scroll, cambio de tamaño | < 1 ms cada uno |
| Chat (3 renders) | 159 ms |
| Filas que se redibujan | 2 |
| Celdas que FlashList vuelve a pedir | **147** |

El camino del texto es barato. Lo caro estaba en la lista: FlashList vuelve a
llamar al dibujo de una celda cuando cambia su `item` o su `renderItem`. El
dibujo dependía de `rows`, y `rows` cambia 3 veces por envío (pendiente,
confirmado, eco). Con unas 50 celdas montadas (las lápidas de QA son bajas)
eran 147 llamadas para redibujar 2 filas.

**Arreglo** (git b6ad5db y 6fd6fdb). `messageCells.ts` arma una celda por fila
con todo lo que cambia su aspecto: vecinos (el divisor corta el bloque), chip
del día, divisor de no leídos, álbum, par de stickers, checks, cita, saludo e
hilo con novedades. Una celda igual conserva su objeto (`keepCells`), y si
nada cambió, el arreglo entero. El dibujo (`drawMessageCell.tsx`) solo depende
de lo que es del chat (quién soy, nombres, selección, callbacks). Ya no usa el
índice: una página vieja que entra arriba no redibuja lo que está en pantalla.

**Medida después** (OTA `cdc96f59`, misma carga ~22, 3 textos):

| | Antes (`84a5591b`) | Después (`cdc96f59`) |
| --- | --- | --- |
| Celdas pedidas por envío | 147 | 4 |
| Chat | 3× 159 ms | 3× 141 ms |

Las filas se siguen agrupando bien: el texto nuevo se cuelga del anterior sin
repetir el nombre, y el chip «Hoy» queda donde va (captura del emulador). Esta
tabla traía también cuadros JS y UI: se quitaron porque el medidor estaba mal
(§5.10), y «53 → 34» no era una mejora medida.

**«Programar mensaje»** (OTA `84a5591b`): se abre con un toque largo en
enviar.

| Hoja | Arrastre | Fondo | Atrás |
| --- | --- | --- | --- |
| Programar mensaje | cierra | cierra | cierra |

El borrador queda en el campo al cerrar. No se tocó «Programar».

QA: los 6 textos de las medidas (seq 115 a 120) borrados con «Eliminar para
todos»; el borrador de la prueba se borró sin enviarlo. La app quedó en
Constroad. rn-smoke 3/3 antes de cada OTA; el primer intento de `cdc96f59`
dio 502 (el server se redesplegaba por el push) y se repitió el smoke antes
de volver a publicar.

### 5.10 El medidor contaba cuadros de más (OTA `6af04d38`, 04/11/2026)

**El error.** El intervalo de pantalla salía del delta más corto de la ventana.
Un solo cuadro pegado al anterior lo bajaba a 8 ms, y los cuadros normales de
16 ms contaban como caídos. El test lo mostró: 35 de 70 caídos en una ventana
sana. Ahora sale de la mediana alta (git 9ff267b), y Diagnóstico suma la pausa
más larga del hilo JS en milisegundos.

**Qué se cae y qué queda.** Se caen todas las cifras de cuadros caídos anteriores,
incluida la mejora «53 → 34» de §5.9. Quedan los pasos con nombre, las celdas
(147 → 4), las filas (2) y `gfxinfo`.

**Medida con el medidor corregido** (3 textos en #general de Test, teclado
abierto, app conectada). La Mac estaba con load average ~20 por otra sesión:
sirve como techo, no como número final.

| Interacción | JS: mediana · peor · pausa más larga | UI: mediana · peor |
| --- | --- | --- |
| Enviar un mensaje | 9 · 10 · 89 ms | 9 · 11 |
| Abrir el teclado | 2 · 3 · 51 ms | 2 · 7 |
| Cerrar el teclado | 3 · 4 · 98 ms | 2 · 3 |
| Abrir una hoja | 4 · 4 · 67 ms | 4 · 4 |

El envío sigue en 4 celdas y 2 filas, y `Chat` en 3 renders y 126 ms. **Sigue:**
repetirla con la Mac libre antes de decidir si vale la pena bajar los 3 renders
de `ChatScreen`.

QA: los 5 textos de esta medida y de la prueba de reconexión (seq 131 a 135)
borrados con «Eliminar para todos». rn-smoke 3/3 antes del OTA.

### 5.11 La lista del espacio, las últimas hojas y el teclado sobre una hoja (OTA `7f968756`, `2ab8381a` y `0fafe027`, 04/11/2026)

**La lista del espacio dejó de redibujarse al abrir un chat.** Antes salía en
«Abrir un chat» como `Lista del espacio 2× 286 ms`. `SpaceChatsScreen` queda
envuelta en un `memo` que no pasa mientras la tapa un chat (`listCovered`, con
test), y `useCached` retiene su valor en ese rato. `openChatNow()` avisa el chat
abierto antes de la transición. En 3 aperturas: `Chat 3× 95 ms · Barra 3× 64 ms`
y la lista ya no aparece. Al volver hace 1 render de 74 ms, medido con la Mac a
load ~27.

**17 hojas pasaron a `Sheet`.** Info del mensaje, destacados, fijados, reacciones,
emojis, programados, acciones de miembro, detalle de evento, volver a llamar,
opciones del checklist, tarea, detalle de tarea, editor de listas, llamada
programada, crear canal, horario de una app y selector con buscador. Quedan en
`Modal` a propósito `CallControls` y `CallReactions` (no se prueban sin llamar a
alguien real) y `AppFormSheet` (confirma antes de cerrar y lleva su propio
teclado).

**El bug que apareció en el E2E.** La hoja vive en la ventana de la app, así que
el teclado la tapa. Con el teclado abierto, «Programar» quedaba debajo y no se
podía tocar. `Sheet` ahora tiene `keyboard`: `dismiss` (por defecto) lo cierra,
`avoid` sube con él en las hojas con campo de texto y `keep` lo deja como está en
la búsqueda del selector.

**Otro bug, del server.** Borrar para todos un mensaje fijado lo sacaba de la
base sin avisar. Los fijados viajan con la lista de chats, así que la franja
seguía arriba con un mensaje que ya no existía, hasta recargar. Ahora el borrado
dice si sacó un fijado (`unpinned`) y solo entonces manda `chat.changed`. El
filtro por `fijados.seq` hace falta: con `timestamps`, un `$pull` cuenta como
modificado aunque no saque nada, y el test lo mostró.

**El medidor cerraba antes de tiempo.** «Abrir un chat» marcaba JS 0·0·0 ms: la
ventana se cerraba en el primer pintado y el primer delta se descartaba. La
ventana dura ahora 600 ms y la pausa antes del primer cuadro cuenta. El «mediana
0 cuadros» de F5a era ese artefacto. La lectura síncrona sigue en pie (`Chat` 95
ms, sin esperas), pero ese número no vale.

**E2E en el emulador.** Cada hoja: arrastre · toque en el fondo · atrás.

| Hoja | Arrastre | Fondo | Atrás | Teclado |
| --- | --- | --- | --- | --- |
| Programar (teclado abierto) | | | | lo cierra; el botón queda en y 2016 y se toca |
| Programados | cierra | cierra | cierra | |
| Info del mensaje | cierra | cierra | cierra | |
| Destacados | cierra | cierra | cierra | |
| Reacciones | cierra | cierra | cierra | |
| Emojis | cierra | sin repetir | cierra | |
| Fijados | cierra | cierra | cierra | |
| Opciones del checklist | cierra | cierra | cierra | sube, y 1261 → 439 |
| Editar tarea | cierra | cierra | cierra | sube, y 1126 → 304 |
| Detalle de tarea | cierra | cierra | cierra | |
| Crear canal | cierra | cierra | cierra; con texto pide descartar | sube, y 1060 → 658 |
| Editor de listas | cierra | cierra | cierra | sube; Guardar queda visible |

**Sin E2E, y por qué.** Selector con buscador y horario de una app: Test no tiene
acciones y los formularios reales de Constroad no se tocan. Detalle de evento: la
cuenta no tiene eventos. Llamada programada: solo existe en un 1:1. Volver a
llamar: hace falta una llamada perdida real. Acciones de miembro: Test tiene un
solo miembro. Son 6 de 17; quedan para el uso real.

**F6, `useLegacyPackaging`: se queda en `true`.** Medido sobre el APK 0.1.179: las
32 `.so` pesan 44,7 MB sueltas y 17,6 MB comprimidas. Pasarlo a `false` sumaría
27 MB a cada descarga (45,3 → 72,4 MB, +60 %) y ahorraría 17,6 MB en el teléfono.
La app carga las mismas librerías en los dos casos, así que no cambia la fluidez.
Una descarga más pesada por datos móviles sale peor.

**Para retomar (trabajo pausado por José el 04/11, 11:50).**

1. Medir «Abrir un chat» con la ventana corregida. No se hizo: la Mac siguió con
   load 30 a 70 toda la mañana.
2. Repetir la medida de §5.10 con la Mac libre y decidir ahí si se bajan los 3
   renders de `ChatScreen` por envío.
3. El barrido de mensajes temporales saca el fijado sin avisar
   (`disappearingMessages.ts`, `sweepChat`): el mismo hueco del borrado, sin
   arreglar. La franja queda hasta recargar.
4. Del teléfono de José: 2 min de uso y «Enviar problema» (F0, F2, F5a), un
   teclado completo (F3), salir y entrar (F5b).
5. De constroad-skills: el umbral de F0 en `rn-perf`.
6. Sin probar en un teléfono: el rechazo del token vencido y la renovación por
   tiempo (`sesion-renovada`, §5.10).

QA: seq 131 a 136, 138 y 139 de #general de Test borrados con «Eliminar para
todos». Quedan dos líneas «Fijaste un mensaje» (seq 137 y 140): el intento de
borrar la 140 no terminó. El programado F1-prog-2 quedó cancelado.
