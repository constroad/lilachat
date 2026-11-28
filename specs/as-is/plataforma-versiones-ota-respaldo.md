# As-is · Plataforma · Versiones, OTA, actualización y respaldos

## 1. Qué es

Cómo llega código nuevo a cada equipo y cómo se protegen los datos:

- APK por LilaStore, actualización dentro de la app y versión mínima.
- OTA propia de Expo (solo JavaScript) firmada por José.
- La web: versión nueva y service worker.
- «Novedades» de cada versión, según a quién le toca.
- Respaldo nocturno del server y respaldo cifrado de cada teléfono.
- Reportes de errores de la app.

**Fecha de corte:** 17/11/2026. APK en el repo: **0.1.189 (versionCode 190)**,
runtime `c3b00b2f…` (`app/ota-runtime.json`).
Fuentes: código, `git log`, `specs/DEPLOY.spec.md` §4 y §4-bis,
`specs/ARCHITECTURE.spec.md` §37, §44, §97, §106, §119, §137, y `docs/RESPALDOS-RUNBOOK.md`.

## 2. Qué hace hoy

### Server

- **OTA propia** (`server/src/ota/otaRoutes.ts`, `otaProtocol.ts`, `otaStore.ts`,
  `otaCertificate.ts`; montada en `/api/ota` antes del `express.json`):
  - Públicas: `GET /manifest` y `GET /assets/:hash`. Exige `expo-platform: android`.
  - Del publicador, con `OTA_PUBLISH_TOKEN`: `PUT|HEAD /assets/:hash`, `POST /updates`.
  - Verifica la firma con el certificado público; nunca firma.
  - Guarda en `ota/` del disco de medios, las últimas 10 por runtime.
    Sin disco: 503 con `Retry-After`, nunca 404.
  - 06/11: un server que reinicia ya no pide una marcha atrás falsa.
- **Versión mínima** (`minimumVersion.ts`): lee el mínimo de LilaStore
  (`/api/v1/apps/lilachat/min-version`), lo recuerda 10 min y responde **426** a una app
  que manda `x-lilachat-build` menor. Sin respuesta de LilaStore no bloquea a nadie.
  `/crash` y `/health` quedan abiertos. Hoy el mínimo es 0 (**según spec**, DEPLOY §1.7).
- **¿Tiene el APK?** `GET /api/me/android-app` lo responde con el token de push
  (`androidApp.test.ts`). Lo usa la franja de instalar de la web.
- **Service worker de la web** (`serviceWorker.ts`): `/service-worker` (y `/sw.js`) con
  `no-store`; la versión sale del hash del `index.html`. `staleAssets.ts` sirve los
  archivos con versión en el nombre.
- **Respaldo nocturno** (F7, `backupCron.ts` + `backupRunner.ts`):
  - `mongodump` + manifiesto de media → `tar.gz` en `BACKUP_DIR`.
  - Corre si ya pasó las 04:00 de Lima y no hay uno de hoy (no depende del minuto).
  - Retención 30 días (`shared/src/backup.ts`).
  - Manual: `POST /api/backup/run`, solo operadores. Export de un chat:
    `GET /api/backup/export/:chatId` (la membresía es el permiso).
  - Restaurar: `scripts/restore.ts`.
- **Respaldo de cada teléfono** (F12.1, `respaldoRoutes.ts`, `/api/respaldos`):
  - Depósito: recibe un archivo cifrado que no puede abrir.
    `PUT /` por streaming con `x-huella`; `POST /huellas`; `GET /ultimo`; `GET /estado`;
    `GET /:nombre`.
  - Guarda 2 por persona (`RESPALDOS_QUE_QUEDAN`), tope 200 MB.
  - Activarlo pide correo verificado, salvo a quien ya tenía respaldos.
  - Disco externo `/Volumes/CONSTROAD-BACKUP/lilachat-datos` con marca `.lilachat`
    (`respaldoDisco.ts`, `disco.ts`, `plazo.ts`): ausente o colgado → 507.
  - Cada intento se cuenta por motivo y por día (`backupAttempts.ts`, 23/10).
  - Copia diaria a restic en la mini: `scripts/copia-a-la-mini.sh` (7/4/12).
- **Reportes de errores** (`crashRoutes.ts`, `POST /api/crash`): sin sesión, a propósito.
  Lista cerrada de apps (`lilachat`, `lilastore`, `timon`), tope de tamaño, 60 por minuto.
  Va al log de errores y a Telegram, deduplicado.

### APK

- **OTA silenciosa** (`app/src/updates/`): `SilentUpdateHost.tsx` +
  `useActualizacionSilenciosa.ts`. Revisa al abrir, al volver y cada 30 min (5 min entre
  revisiones). **Aplica** solo al volver tras ≥ 10 min fuera, sin llamada y sin cola de
  envío (`applyPolicy.ts`). Nunca recarga en fondo.
  - `UpdatePromptHost.tsx` + `updatePrompt.ts` (José 28/11): una píldora bajo la cabecera,
    sobre cualquier pantalla (canales de Espacios incluidos), montada en
    `NavegacionDeSesion`. Con una OTA ya bajada dice «Hay una actualización · Reiniciar»
    (`restartDecision`: no durante una llamada; con mensajes o fotos sin enviar avisa y
    espera). Con un APK nuevo y la banda de la lista tapada (chat o canal abierto, otra
    pestaña) dice «Lilachat X · Actualizar» y lleva a la banda. Sin revisiones propias: lee
    `useUpdates()` y el aviso que publica `useActualizacionesDeLaApp`.
  - `runningCode.ts`: Diagnóstico dice «Incluido en el APK» o «Actualización <id>».
  - `updatesLogFile.ts`: vacía el log de expo-updates al arrancar (se comía la memoria).
- **APK nuevo** (`app/src/settings/`):
  - `versionApi.ts` pregunta a LilaStore. Sin respuesta dice «no se pudo», nunca «al día»
    (`actualizacion.ts`).
  - `BandaDeActualizacion.tsx` arriba de la lista; descartable por versión
    (`avisoDeActualizacion.ts`).
  - `useActualizador.ts`: baja el APK con progreso, **verifica el sha256**
    (`installDecision.ts`, falla cerrado) y abre el instalador (`modules/instalador-apk`,
    `installSession.ts`). La pantalla no se apaga mientras baja; un corte reintenta una
    vez (`updateRetry.ts`).
  - `BuscarActualizacionesAjuste.tsx` y `abrirTienda.ts`: mandan a LilaStore o al navegador.
  - `UpdateLockScreen.tsx` (`updateLock.ts`): bajo el mínimo, no se descarta.
  - `NovedadesDeLaVersion.tsx` + `WhatsNewHost.tsx`: «Novedades» una vez.
- **Respaldo del teléfono** (`app/src/respaldo/`):
  - Cifrado con la passphrase (`passphraseDeRespaldo.ts`, `shared/respaldoCifrado.ts`,
    scrypt). Sin passphrase no hay recuperación.
  - Por trozos y por huella (`planDeRespaldo.ts`, `correrRespaldo.ts`,
    `archivosDeRespaldo.ts`, `libroDeRespaldos.ts`).
  - En fondo con WorkManager; sube con wifi y cargando (`tareaDeFondo.ts`,
    `condicionesDelTelefono.ts`).
  - Restaurar: `restaurar.ts`, `planDeRestauracion.ts`, `settings/RestaurarRespaldo.tsx`
    (sale sola en un teléfono nuevo).
  - Ajustes: `RespaldoAjuste.tsx`, `BackupScreen.tsx` (`backupApi.ts`). «Respaldo del
    servidor» solo para operadores.
  - `missingKeyReport.ts`: reporta una clave que falta.
- **Reporte de errores:** `ui/ErrorBoundary.tsx` + `ui/reportarError.ts`; cola de
  pendientes (`shared/crashReport.ts`, hasta 10).

### Web/PWA

- **Versión nueva** (`web/src/ui/webUpdate.ts`, `newVersion.ts`, `NewVersionBand.tsx`):
  una sola banda «Hay una versión nueva». Dos señales: el SW que espera y el `index.html`
  publicado. Se pregunta al volver a la pestaña, cada 30 min como mucho. Sin polling.
- **Service worker** (`web/public/sw.js`, registrado por `pwa/serviceWorker.ts` solo en
  producción): precarga el shell, assets cache-first, navegación con 4 s de espera,
  push y clic. La versión nueva se activa al tocar «Recargar».
- **Versión visible:** commit corto en Ajustes (`webVersion.ts`, `__WEB_VERSION__`).
- **Chunks diferidos** que fallan tras recargar: `lazyChunk.ts`.
- **Novedades:** `ui/WhatsNewDialog.tsx`.
- **Instalar:** ver `plataforma-ajustes-tema-disposicion.md`.
- **Respaldo:** la web no tiene respaldo propio (es local-first con IndexedDB y el
  server tiene todo).

### Shared

- `releaseNotes.ts`: el catálogo de novedades, `ReleaseAudience` (`all`, `personal`,
  `spaces`), `notesToShow`, `updateMatters` (avisar solo a quien le toca).
- `otaPublish.ts`: manifiesto, `assertRuntimeMatches`, `rollbackDirective`, conteo de
  hosts de desarrollo en el bundle.
- `backup.ts`, `respaldoCifrado.ts`, `respaldoPorTrozos.ts`, `crashReport.ts`.

## 3. Diferencias APK vs web

| Tema | APK | Web/PWA |
| --- | --- | --- |
| Código nuevo | OTA en silencio; nativo pide APK | Cada deploy; banda «Recargar» |
| Versión mínima | 426 del server + pantalla que bloquea | No aplica (no manda build) |
| Novedades | `WhatsNewHost` | `WhatsNewDialog` |
| Respaldo | Cifrado por el teléfono al disco de la mini | No hay |
| Errores | `/api/crash` con cola local | Solo a la consola (`ui/ErrorBoundary.tsx`); no llama a `/api/crash` |

## 4. Historia reciente (APK y OTA)

- **22/10** · Pantalla que bloquea bajo la mínima (0.1.136). El server responde 426
  (0.1.144). Actualizar con sesión propia del instalador (0.1.146).
- **23/10** · Medios propios sin lila; cada intento de respaldo cuenta (0.1.155).
  Novedades una vez por versión.
- **24/10** · Avisar de una versión solo a quien le toca (`audience`).
- **25/10** · OTA propia y 0.1.171. Las dos primeras OTA traían la URL del emulador:
  rollback y el publicador ahora se niega.
- **28/10** · 0.1.172 (aviso en frío), 0.1.173 (contestar bloqueado), 0.1.174
  (ubicación en vivo).
- **29/10–30/10** · Vaciar el log de expo-updates; 0.1.175 más liviano.
- **01/11** · 0.1.176: Lilachat como destino de «Compartir».
- **02/11** · 0.1.177 a 0.1.179: plan de fluidez (ver `plataforma-fluidez-y-planes.md`).
- **04/11** · 0.1.180: ingreso por espacio, sin OTA (entra al runtime).
- **06/11** · 0.1.181: mapa nativo.
- **11/11** · 0.1.182: stickers animados en Lottie.
- **13/11** · 0.1.183: videollamada en ventana chica.
- **15/11** · 0.1.184 a 0.1.188: medición AR del IAA.
- **16/11** · 0.1.189: el aviso se dibuja antes de cualquier red.
- **28/11** · El aviso de versión y el «Reiniciar» de una OTA bajada salen sobre cualquier
  pantalla. Antes la banda vivía solo arriba de la lista de Chats: quien trabaja dentro de
  un canal no la veía, y una OTA bajada esperaba 10 min fuera de la app sin envíos.

## 5. Diseños de Stitch

| Diseño | Estado | Evidencia |
| --- | --- | --- |
| `u-01-actualizacion-obligatoria` | Implementado (22/10) | `UpdateLockScreen.tsx`; spec §97. No está en INVENTARIO ni en local |
| `backup.png`, `configuracion-backup.png`, `restaurar.png` (F7) | Implementados con otro alcance (respaldo cifrado F12) | `BackupScreen.tsx`, `RestaurarRespaldo.tsx`; fidelidad no auditada |

## 6. Pendientes y deuda conocida

- **La OTA sigue en el server propio.** La decisión del 02/11 es pasarla a LilaStore
  con un APK nuevo. `app.json` → `updates.url` sigue en
  `lilachat.constroad.com/api/ota/manifest`. **Verificado en código.**
- El disco de respaldos en la mini: el backlog dice que producción respondía 507
  `disco_ausente` hasta montarlo. Estado actual **no verificado** (backlog 67).
- El respaldo nocturno guarda solo la LISTA de media: el comentario supone que los
  archivos viven en lila, pero desde el 23/10 están en el disco propio
  (`CHAT_STORAGE_ROOT`). Si ese disco tiene copia: **no verificado**.
- `updateLock.ts` dice que «el server todavía no rechaza versiones viejas»; desde el
  22/10 sí (426). **Verificado en código** (comentario viejo).
- OTA solo para Android (`expo-platform !== 'android'` → 400). **Verificado en código.**
- La web no reporta sus errores al server: un fallo en el navegador solo queda en la
  consola de quien lo sufre. **Verificado en código** (`web/src/ui/ErrorBoundary.tsx`;
  ningún archivo de `web/src` llama a `/api/crash`).
- Chrome advierte «archivo dañino» al bajar el APK desde la web; no se arregla desde el
  server. **Según spec** (backlog 50).
- LilaStore debería declarar `USE_FULL_SCREEN_INTENT` al actualizar. Derivado a su
  sesión. **Según spec** (backlog 55).

## 7. Pruebas

**Unit (server):** `server/src/ota/otaRoutes.test.ts`, `otaMount.test.ts`,
`otaCertificate.test.ts`, `minimumVersion.test.ts`, `androidApp.test.ts`,
`serviceWorker.test.ts`, `staleAssets.test.ts`, `backupCron.test.ts`,
`backupRoutes.test.ts`, `backupAttempts.test.ts`, `respaldoRoutes.test.ts`,
`disco.test.ts`.

**Unit (shared):** `releaseNotes.test.ts`, `otaPublish.test.ts`, `backup.test.ts`,
`respaldoCifrado.test.ts`, `respaldoPorTrozos.test.ts`, `crashReport.test.ts`.

**Unit (APK):** `app/src/updates/applyPolicy.test.ts`, `runningCode.test.ts`,
`updatesLogFile.test.ts`; `app/src/settings/actualizacion.test.ts`,
`actualizacionInfo.test.ts`, `avisoDeActualizacion.test.ts`, `installDecision.test.ts`,
`installSession.test.ts`, `updateLock.test.ts`, `updateRetry.test.ts`,
`novedades.test.ts`; `app/src/respaldo/planDeRespaldo.test.ts`,
`planDeRestauracion.test.ts`, `missingKeyReport.test.ts`.

**Unit (web):** `web/src/ui/webUpdate.test.tsx`, `newVersion.test.ts`,
`webVersion.test.ts`, `WhatsNewDialog.test.tsx`, `lazyChunk.test.ts`,
`lazyChunkUsage.test.ts`, `web/src/pwa/swRoutes.test.ts`.

**Scripts:** `scripts/qa-backup-restore.ts`, `scripts/verificar-copia.sh`.

**Maestro:** ninguno. Cada APK pasa `rn-smoke` en el emulador antes de publicar
(DEPLOY §4.5).
