# As-is · Plataforma · Ajustes, tema, disposición e instalación de la web

## 1. Qué es

La carcasa de la app: la pantalla de Ajustes, el tema claro u oscuro, el tamaño de
letra, cómo se reparte la pantalla (barra de abajo, riel, giro, tablet, dos paneles),
el almacenamiento y la web como PWA instalable (Android e iPhone).

**Fecha de corte:** 17/11/2026.
Fuentes: código, `git log`, `specs/PLANES-FLUIDEZ-IOS-PWA.spec.md` §3 y
`specs/ARCHITECTURE.spec.md` §45.27 (giro y tablet), §81 (fuente), §114 (almacenamiento).

## 2. Qué hace hoy

### APK

- **Ajustes** (`app/src/settings/PantallaDeAjustes.tsx`, 191 líneas), de arriba abajo:
  1. El espacio abierto (`SpaceSettingsSection`, diseño e-34).
  2. Perfil (`PerfilAjuste`) y presencia (`PresenceSetting`).
  3. Apariencia (`AparienciaAjuste`: Sistema · Claro · Oscuro) y fuente del chat
     (`ChatFontSetting`).
  4. Privacidad: bloqueo con huella, confirmaciones de lectura, vista previa de avisos,
     bloqueados.
  5. Conexión permanente (servicio en primer plano).
  6. Dispositivos vinculados.
  7. Grupos como lista, Medios, Almacenamiento, Destacados, Respaldo, respuesta
     automática, «Respaldo del servidor» (operador).
  8. Diagnóstico y «Buscar actualizaciones».
  9. Superadmin (solo el creador) e «Invitar a alguien».
  10. Cuenta: «Cerrar sesión» y, al final, «Borrar mi cuenta» (`DeleteAccountSetting.tsx`,
      19/11; detalle en `plataforma-perfil-contactos-privacidad.md`).
- **Filas y controles:** `ui/FilaDeAjuste.tsx`, `ui/Interruptor.tsx`, `ui/Segmentado.tsx`,
  `ui/Rotulo.tsx`, `settings/OwnSwitchSetting.tsx`, `settings/preferencias.ts`,
  `ui/prefStore.ts`.
- **Tema** (`app/src/ui/tema.tsx`): le dice a NativeWind el modo y lo recuerda. Los
  colores son variables CSS de `shared/src/tema.ts`; las clases no cambian.
- **Fuente del chat** (`ui/chatFont.ts`, `ui/monoFont.ts`): Pequeña, Mediana, Grande.
- **Disposición** (`app/src/ui/disposicion.ts`, puro): `apaisada`, `tablet` (lado corto
  ≥ 600 dp), `amplia` (las pestañas pasan a un riel) y `dosPaneles` (lista y chat lado a
  lado). `app.json` permite girar (`orientation: default`) y tablet (`supportsTablet`).
  - Chat al lado de la lista en tablet: `ui/PanelDeChat.tsx`.
  - Márgenes del sistema: `ui/margenes.ts`, `ui/useMargenes.ts`.
- **Navegación:** `ui/TabsShell.tsx`, `ui/BottomNav.tsx`, `ui/bottomTabs.ts`.
  Personal: Chats · Pendientes · Encuestas · Ajustes. En un espacio: Chats · Directorio ·
  Menciones · Ajustes. Nunca cinco.
- **Capas en la misma ventana** (plan de fluidez F1): `ui/overlay/*`, `ui/Sheet.tsx`
  con arrastre para cerrar. `ui/Modal.tsx` usa el host más cercano.
- **Almacenamiento** (`settings/storage/StorageScreen.tsx`, `StorageFilesScreen.tsx`,
  `localBuckets.ts`, `useLocalStorage.ts`): lo que ocupa en el teléfono, «Liberar» por
  grupo, archivos de más de 5 MB y los chats más pesados. Lee también
  `GET /api/me/storage`.
- **Otros:** `ui/ErrorBoundary.tsx` por pantalla, `ui/permisos.ts`, `ui/rutas.ts`,
  `ui/botonAtras.ts`, `ui/screenHold.ts` (pantalla encendida mientras graba o baja).

### Web/PWA

- **Ajustes** (`PanelDeAjustes` en `web/src/Shell.tsx`): un panel flotante con enlaces
  del espacio (en el teléfono), presencia, Apariencia (Claro · Oscuro · Sistema),
  fuente, grupos como lista, almacenamiento del navegador, privacidad, activar avisos,
  instalar, Superadmin, cerrar sesión, «Borrar mi cuenta» (`account/DeleteAccountChoice.tsx`,
  19/11) y la versión. Se cierra con clic afuera o Escape.
- **Tema** (`web/src/ui/tema.ts`, `ThemeToggle.tsx`, `public/tema-inicial.js` para no
  parpadear al cargar). Modo claro «opción A» desde el 12/11: riel en tinta violeta,
  listas en lila claro y cabecera del chat sólida.
- **Disposición** (`web/src/layout.ts`):
  - Desde 900 px, dos paneles. Debajo, uno solo con «entrar y volver».
  - Ancho de la lista arrastrable (280–560 px, 380 por defecto); la conversación nunca
    baja de 420 px. La lista se pliega.
- **Riel** (`web/src/rail/AppRail.tsx`): Chats, Llamadas, Pendientes, Destacados, los
  espacios, Medios, Ajustes y el avatar. Como WhatsApp Web.
- **Teléfono** (`rail/MobileNav.tsx`, `mobileTabs.ts`): bajo 900 px no hay riel; barra
  de abajo como la del APK (06/11).
- **Shell móvil** (solo con `pointer: coarse`, 05/11):
  - `pwa/visualViewport.ts`: `--app-height` y `data-keyboard` para el teclado de Safari.
  - `viewport-fit=cover` y safe areas; campos a 16 px (Safari no hace zoom).
  - `pwa/touchHold.ts`: toque sostenido de 450 ms muestra lo que el ratón muestra con hover.
  - `pwa/pullToRefresh.tsx`: deslizar para actualizar.
  - `pwa/conexion.ts`: un corte corto no muestra cartel.
- **Instalar la PWA:**
  - `pwa/installPrompt.ts`: captura `beforeinstallprompt` desde `main.tsx`.
  - `pwa/InstallStrip.tsx` dentro de la lista: iPhone «Ver cómo»; Android lleva al APK
    de LilaStore salvo que la cuenta ya lo tenga (`useHasAndroidApp.ts`,
    `GET /api/me/android-app`); en computadora no sale.
  - `pwa/installOffer.ts`: cerrarla la duerme 14 días; vuelve una vez y luego solo queda
    en Ajustes.
  - `pwa/iosInstall.ts` + `IphoneInstallGuide.tsx`: la guía sale ANTES de entrar,
    porque la sesión de Safari no pasa a la app instalada. No sale si llegó con un enlace
    de invitación, llamada o correo. En Chrome de iPhone dice «Abre esta página en Safari».
- **Almacenamiento** (`web/src/storage/StorageChoice.tsx`): cuánto usa el navegador
  (`navigator.storage.estimate`).
- **Manifest** (`web/public/manifest.json`) `standalone` con íconos.

### Shared

- `tema.ts` (paleta de los dos modos, `variablesDeTema`), `tokens.ts`, `chatFont.ts`,
  `flatLayout.ts`, `storage.ts` (`BIG_FILE_BYTES` 5 MB), `panelTab.ts`.

## 3. Diferencias APK vs web

| Tema | APK | Web/PWA |
| --- | --- | --- |
| Ajustes | Pantalla completa por grupos | Panel flotante, más corto |
| Ajustes que solo tiene el APK | Perfil, vinculados, conexión permanente, respaldo, respuesta automática, diagnóstico, buscar actualizaciones | — |
| Ajustes que solo tiene la web | — | Instalar, activar avisos del navegador |
| Ancho | Riel solo girado o en tablet | Riel desde 900 px; barra abajo en el teléfono |
| Dos paneles | Tablet con ancho | Desde 900 px |
| Modo claro «opción A» | **No verificado** en el APK (el commit es solo web) | Sí |
| Almacenamiento | Teléfono + reporte del server | Solo la cuota del navegador |

## 4. Historia reciente

- **18/10** · La app gira y tiene tablet (FL10).
- **21/10** · Web: logo, modo oscuro, fondo de puntos, lista que se arrastra y se pliega;
  el riel como WhatsApp Web con Medios.
- **22/10** · Almacenamiento en la app y en el navegador. Llamadas en el riel. Pestañas
  montadas (0.1.142).
- **24/10** · Ajustes con el espacio abierto arriba (e-34).
- **02/11–04/11** · Hojas en la misma ventana con arrastre y ripple nativo (plan 1).
- **05/11** · La web se instala y se usa en un iPhone; franja de instalar.
- **06/11** · La web del teléfono con la barra del APK y sin riel; «Instalar» en Android.
- **12/11** · Modo claro «opción A» en la web. Motivo: «muy triste, muy blanco».
- **13/11** · Las iniciales de Personal usan la tinta del riel en modo claro.
- **17/11** · La ficha de miembro web ya no se desborda a 390 px.
- **19/11** · «Borrar mi cuenta» al final de Ajustes en el APK y en la web (Google Play).

## 5. Diseños de Stitch

| Diseño | Estado | Evidencia |
| --- | --- | --- |
| `e-34` Ajustes con el espacio y «Tu cuenta» | Implementado | `PantallaDeAjustes.tsx`, `SpaceSettingsSection.tsx` |
| `chats-claro`, `chats-oscuro`, `web-claro` | Base del tema (agosto) | `shared/src/tema.ts`; fidelidad actual no auditada |
| `r152-almacenamiento` | Implementado (22/10) | `StorageScreen.tsx` lo cita; PNG no está en INVENTARIO |
| `la-11-pwa-mide-en-apk` y otros `la-*` de la PWA | Fuera de este grupo (IAA) | INVENTARIO |

No hay diseño Stitch de la guía de iPhone ni de la franja de instalar: salen del banner
de Portal (PLANES §3.5).

## 6. Pendientes y deuda conocida

- La guía y la franja no se probaron en un iPhone real; tampoco el teclado de Safari ni
  instalar desde Compartir. **Según spec** (PLANES §3.5).
- Plan PWA: falta P0 completo (auditoría a 390 px de toda la app), P3 (Contact Picker,
  notas de voz, cámara propia) y P4 (página de iPhone en LilaStore). **Según spec.**
- Emojis de la web como en la app: pendiente. **Según spec** (PLANES §3.5).
- PLANES §3.5 aún lista «el riel resta 64 px en el teléfono» como pendiente; ya se
  cerró el 06/11 (bajo 900 px no hay riel). El spec quedó viejo. **Verificado en código**.
- `PanelDeAjustes` de la web se declara «Ajustes mínimos… W3 trae los completos».
  **Verificado en código** (`Shell.tsx:482`).
- `Shell.tsx` tiene 659 líneas: por encima del tope de 600 del estándar.
  **Verificado en código** (`wc -l`).
- No hay Maestro de giro ni tablet para la app. **Verificado** (`app/.maestro/`).

## 7. Pruebas

**Unit (APK):** `app/src/ui/disposicion.test.ts`, `bottomTabs.test.ts`,
`margenes.test.ts`, `pestanas.test.ts`, `overlays.test.ts`, `layers.test.ts`,
`sheetGesture.test.ts`, `sheetFrame.test.ts`, `prefStore.test.ts`, `rutas.test.ts`,
`botonAtras.test.ts`, `screenHold.test.ts`, `avatarMotor.test.ts`,
`app/src/settings/storage/localBuckets.test.ts`.

**Unit (web):** `web/src/layout.test.ts`, `web/src/rail/AppRail.test.tsx`,
`MobileNav.test.tsx`, `mobileTabs.test.ts`, `web/src/ui/tema.test.ts`, `chatFont.test.ts`,
`useDismiss.test.tsx`, `Overlay.test.tsx`, `web/src/pwa/*.test.ts*` (9: conexión,
oferta de instalar, toque sostenido, deslizar, evento de instalar, franja,
`visualViewport`, rutas del SW, iPhone), `web/src/storage/StorageChoice.test.tsx`.

**Unit (shared):** `tema.test.ts`, `chatFont.test.ts`, `flatLayout.test.ts`,
`storage.test.ts`, `panelTab.test.ts`.

**Unit (server):** `server/test/storageReport.test.ts`.

**Maestro:** ninguno de esta área.

**E2E registrado:** 05/11, stack local con Chromium a 390×664 táctil, agente de iPhone,
como admin e ingeniero (PLANES §3.5). 12/11, modo claro revisado en producción.
