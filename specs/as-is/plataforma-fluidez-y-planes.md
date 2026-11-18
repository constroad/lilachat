# As-is · Plataforma · Fluidez, diagnóstico y planes de iPhone y PWA

## 1. Qué es

El estado de los tres planes del 02/11 (`specs/PLANES-FLUIDEZ-IOS-PWA.spec.md`):

1. **Fluidez:** que el APK se sienta como Telegram.
2. **iPhone:** app nativa por TestFlight.
3. **PWA:** la web usable e instalable en un teléfono.

Y la herramienta que los mide: Ajustes › Diagnóstico.

**Fecha de corte:** 17/11/2026. El spec de planes se actualizó por última vez el
05/11 (PWA) y el 04/11 (fluidez).

## 2. Qué hace hoy

### APK — Diagnóstico

- `app/src/diagnostico/DiagnosticoAjuste.tsx`: Ajustes › Diagnóstico. Dice el código en
  uso (OTA o APK, runtime), los errores por origen (`socket`, `sesion-renovada`…) y el
  bloque «Fluidez».
- `diagnostico/diagnostico.ts` y `motor.ts`: el registro, que sube a LilaStore.
- `diagnostico/frames.ts` (puro) + `frameMonitor.ts` + `FrameMonitorHost.tsx`: cuadros
  caídos por interacción, en el hilo JS (rAF) y en el de UI (Reanimated). Ventanas:
  abrir chat, teclado abrir/cerrar, abrir foto, abrir hoja, enviar. Cada paso con nombre.
- `diagnostico/ScreenMetricsLine.tsx` (13/11): mide la pantalla.
- Corrección del 04/11: el medidor contaba cuadros normales como caídos. Las cifras de
  cuadros anteriores al 04/11 no valen; los milisegundos con nombre sí.

### APK — Plan 1, fluidez (fases F0 a F6)

| Fase | Estado (spec, 04/11) | Qué quedó en el código |
| --- | --- | --- |
| F0 Medir | Hecha (OTA `f4ca42ef`) | `diagnostico/frames.ts`, `frameMonitor.ts` |
| F1 Fuera los modales | Hecha (0.1.177 + OTA) | `ui/overlay/*`, `ui/Sheet.tsx` con arrastre; 17 hojas más el 04/11 |
| F2 Visor de fotos | Hecha (0.1.177) | La foto crece desde su burbuja; arrastre para cerrar |
| F3 Teclado | Hecha (0.1.178) | Cerrar arrastrando el chat; panel de emojis que baja con él |
| F4 Toque y envío | En curso | Ripple nativo; un envío dibuja 2 filas y pide 4 celdas (antes 147) |
| F5a Lectura síncrona | Hecha (0.1.179) | `readLastPageSync`: el chat frío nace pintado |
| F5b SQLCipher | Hecha (0.1.179) | Base `lilachat-v2.db` cifrada entera; mudanza chat por chat |
| F6 Higiene | Casi hecha | Fuera `moti`; `useLegacyPackaging` se queda |

Quedan en `Modal` a propósito: `AppFormSheet`, `CallControls` y `CallReactions`.
`overlays.ts` y el congelado se quedan: una hoja con campo de texto sube el teclado igual.

### iPhone — Plan 2

- **No empezado.** `app/app.json` tiene `ios.supportsTablet` pero no `bundleIdentifier`
  ni entitlements. **Verificado en código.**
- La OTA rechaza cualquier plataforma que no sea Android
  (`server/src/ota/otaRoutes.ts:94`). **Verificado en código.**
- Fases escritas: I0 papeles de Apple (de José), I1 compilar, I2 APNs y vida en fondo,
  I3 OTA y enlaces universales, I4 TestFlight, I5 paridad (CallKit, Share Extension),
  I6 App Store. Recomendación del spec: TestFlight externo con enlace público.
- Decisiones pendientes de José: Organización o Individuo en Apple, Xcode local o EAS.

### Web/PWA — Plan 3

- **P1 y P2 hechas el 05/11** para los ingenieros con iPhone (detalle en
  `plataforma-ajustes-tema-disposicion.md`): teclado con `visualViewport`, safe areas,
  campos a 16 px, toque sostenido, guía de instalación y franja de instalar.
- **P0** solo en las pantallas del recorrido de los ingenieros.
- **P3** (Contact Picker, notas de voz en formato aceptado, cámara propia, recorte) y
  **P4** (página para iPhone en LilaStore): pendientes.

### Server y Shared

- Nada propio de los planes. El server mide en logs (por ejemplo, la demora de cada
  acuse de push desde el 16/11).
- `shared/src/messageWindow.ts`, `listIndex.ts`, `almacenDeMensajes.ts`,
  `cacheCifrada.ts`: motores que la fluidez usa (lista y almacén local).

## 3. Diferencias APK vs web

| Tema | APK | Web/PWA |
| --- | --- | --- |
| Medidor de fluidez | Diagnóstico con cuadros por interacción | No hay |
| Almacén local | SQLite cifrado con SQLCipher | IndexedDB (Dexie, `web/src/local/*`) |
| Hojas | `Sheet` propio en la misma ventana | Diálogos y hojas inferiores bajo 640 px |
| iPhone | No hay app | PWA instalable desde Safari |

## 4. Historia reciente

- **02/11** · F0: medir antes de tocar. F1 y F2 en 0.1.177. F3, F4 y F6 en 0.1.178.
  F5a y F5b en 0.1.179. Motivo: José, «aún se siente tosco».
- **02/11–03/11** · OTAs de F4: la barra no se redibuja con el eco; un envío redibuja su
  fila; FlashList pide 4 celdas por envío y no 147.
- **03/11** · Siete hojas más con arrastre; cada paso del envío con nombre.
- **04/11** · El medidor contaba de más: corregido. La lista del espacio no se redibuja
  bajo el chat. 17 hojas más. El teclado sobre una hoja (`keyboard: dismiss|avoid|keep`).
- **05/11** · P1 y P2 de la PWA.
- **13/11** · El diagnóstico mide la pantalla (`ScreenMetricsLine`).

## 5. Diseños de Stitch

Los planes no tienen diseños propios. La guía de iPhone y la franja de instalar salen del
banner de Portal. Los diseños `la-04`, `la-10` y `la-11` (PWA del IAA) son de otro grupo.

## 6. Pendientes y deuda conocida

- F0: falta el número real en el teléfono de José (2 min). **Según spec** (§5).
- F4: medir con la Mac libre y decidir si se bajan los 3 renders de `ChatScreen` por
  envío. **Según spec** (§5.10).
- F5a: `leer-chat` no aparece entre los trabajos con nombre; medir en el teléfono antes
  de borrar `memoriaDeChats`. **Según spec.**
- F5b: cerrar sesión y volver a entrar no se probó; suma 2,3 MB al APK. **Según spec.**
- F6: el umbral de F0 en el gate `rn-perf` vive en constroad-skills. **Según spec.**
- F1: 6 de 17 hojas sin E2E por falta de escenario real. **Según spec** (§5.11).
- F2 y F3: el número en el teléfono de José (el emulador captura fotos negras y usa
  teclado compacto). **Según spec.**
- iPhone nativo: sin empezar; espera decisiones y papeles de José. **Según spec** y
  **verificado en código** (`app.json`).
- PWA: P0 completo, P3, P4 y emojis como en la app. Nada probado en un iPhone real.
  **Según spec** (§3.5).
- La OTA de las fases sale por el server propio; la migración a LilaStore sigue
  pendiente. **Verificado en código** (`app.json` › `updates.url`).
- El estado por fase del spec es del 04/11: no se actualizó después. **Verificado**
  (encabezado de §5).

## 7. Pruebas

**Unit (APK):** `app/src/diagnostico/frames.test.ts`, `motor.test.ts`;
`app/src/ui/sheetGesture.test.ts`, `sheetFrame.test.ts`, `layers.test.ts`,
`overlays.test.ts`.

**Unit (shared):** `messageWindow.test.ts`, `listIndex.test.ts`,
`almacenDeMensajes.test.ts`, `cacheCifrada.test.ts`.

**Unit (web):** `web/src/pwa/visualViewport.test.ts`, `touchHold.test.ts`,
`iosInstall.test.ts`, `InstallStrip.test.tsx`, `installOffer.test.ts`.

**Maestro:** ninguno.

**E2E registrado:** cada fase de fluidez en el emulador `lilafotos-qa`, grabado cuadro a
cuadro, con `rn-smoke` 3/3 antes de cada OTA (PLANES §5.1 a §5.11). La PWA, en Chromium
local a 390×664 con agente de iPhone (05/11).
