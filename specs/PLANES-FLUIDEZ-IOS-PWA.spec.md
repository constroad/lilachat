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

### Estado por fase (02/11/2026, 17:45)

| Fase | Estado | Falta |
| --- | --- | --- |
| F0 Medir | **Hecha.** En `main`, OTA `f4ca42ef` en vivo, probada en el emulador | 2 min en el teléfono de José para el número real |
| F1 Fuera los modales | **Hecha** (APK 0.1.177). Host en la misma ventana (sesión y chat), capas animadas, puente de contextos, `Sheet` con arrastre: avisos, clip, fijar, ficha de persona, historial y acciones de miembro. El bloqueo de la app queda sobre todas las capas | Pasar las otras ~26 hojas a `Sheet` (cada una con su E2E). `overlays.ts` y el congelado se QUEDAN: una hoja con campo de texto sube el teclado igual (§5.3) |
| F2 Visor de fotos | **Hecha** (APK 0.1.177). La foto crece desde su burbuja y vuelve a ella; arrastre que muestra el chat; foto completa pedida al apoyar el dedo; barras con fundido | El número en el teléfono de José (el emulador captura fotos negras, §5.3) |
| F3 Teclado | Pendiente | Cierre arrastrando, salto al cerrar, sin `runOnJS` al terminar |
| F4 Toque y envío | Pendiente | Enviar traba el JS ~0,5 s (§5.1); ripple nativo en filas y botones |
| F5a Lectura síncrona | Pendiente | Chat frío pintado en el primer cuadro; borrar `memoriaDeChats` |
| F5b SQLCipher | Pendiente | Va en el próximo APK |
| F6 Higiene | Pendiente | `moti`, `useLegacyPackaging`, umbral en `rn-perf` |

### Bitácora

| Fecha | Fase | Estado |
| --- | --- | --- |
| 02/11/2026 | F0 | Código en `main` (46177fb): motor `diagnostico/frames.ts` con tests, samplers JS (rAF) y UI (frame callback de Reanimated) en `frameMonitor.ts` + `FrameMonitorHost`, ventanas abrir-chat · teclado-abrir/cerrar · abrir-foto · abrir-hoja · enviar, bloque «Fluidez» en Ajustes › Diagnóstico. Pendiente: OTA, línea base en el emulador (`gfxinfo`) y 2 min del teléfono de José |
| 02/11/2026 | F0 | OTA `f4ca42ef` publicada y verificada en vivo (runtime 62ff8b1c, git 46177fb); rn-smoke 3/3 limpio, heap 24 MB. E2E en `lilafotos-qa`: el bloque «Fluidez» de Diagnóstico muestra las seis interacciones. Línea base en §5.1 |
| 02/11/2026 | F1 | Rama `fluidez-f1`: `ui/overlay/OverlayHost` (raíz de la sesión y del chat) + `OverlayModal` (capas con slide/fade de Reanimated, atrás cierra la de arriba); el wrapper `ui/Modal` usa el host más cercano, con interruptor `IN_WINDOW_OVERLAYS`. `ui/Sheet` con arrastre para cerrar (`sheetGesture`, tests) y la hoja de avisos migrada. Pendiente: E2E en el emulador, medir contra F0, migrar las 31 hojas restantes, borrar `overlays`/`freeze` |
| 02/11/2026 | F1 + F2 | APK 0.1.177 (178): hojas en la misma ventana con arrastre, foto que crece desde su burbuja (vuelo por `transform`), arrastre que muestra el chat, foto completa pedida al apoyar el dedo. E2E en el emulador, rn-smoke 3/3, medida en §5.3. Publicada en LilaStore |

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
