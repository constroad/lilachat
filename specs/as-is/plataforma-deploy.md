# As-is · Plataforma · Deploy y publicación

## 1. Qué es

Cómo llega Lilachat a producción. Tres caminos:

| Pieza | Cómo sale | Dónde corre |
| --- | --- | --- |
| Server + web (un solo proceso Node) | `git push` a `main` → GitHub Actions → Torre | Mac mini, `https://lilachat.constroad.com` |
| APK | Se compila en la máquina de José y se sube a LilaStore con `@constroad/lila-cli` | Teléfonos Android |
| OTA (solo JavaScript de la app) | `npx tsx scripts/ota-publish.mts` desde la máquina de José | `/api/ota/*` del propio server |

**Fecha de corte:** 17/11/2026. Fuente canónica: `specs/DEPLOY.spec.md`, escrito y
ejecutado el 25/10 (release 0.1.170) y con la nota del 02/11 sobre la OTA en LilaStore.
Este archivo resume y marca lo que cambió después.

## 2. Qué hace hoy

### Server + web

- **Workflow** (`.github/workflows/deploy.yml`, verificado en código):
  - Corre en cada push a `main`, sin filtro de rutas: un cambio solo de specs también
    despliega. Concurrencia `deploy-chat`, sin cancelar.
  - Job `verificar`: Node 22, `npm ci`, `npm test --if-present`, `npm run build`.
  - Job `desplegar`: firma `{"app":"chat","sha":…}` con `TORRE_HMAC` y hace POST a
    `https://torre.constroad.com/api/hooks/deploy`. `202` encolado; `409` es solo
    *warning* (el run queda verde sin desplegar).
- **Torre** construye en la mini desde `git archive`, reinicia `com.constroad.chat`
  (puerto interno 3004) y consulta `/api/health`. Entrada `dist/index.js`, `.env`
  compartido por `sharedFiles`.
- **Express sirve la web** (`web/dist`) y el service worker; ver
  `plataforma-versiones-ota-respaldo.md`.
- **Cómo se verifica en vivo:** el commit corto va horneado en el bundle web
  (`__WEB_VERSION__`, se ve en Ajustes). El health dice una versión fija (`0.1.0`) que no
  identifica el commit.
- **Antes del push:** gates de constroad-gates (tests, lint, tsc, inglés, español neutro)
  y `npm run build` aparte: la CI compila también los tests del server.
- **Árbol compartido:** se agrega por nombre; nada de `git add .`, `stash`, `--force` ni
  `--no-verify`.

### APK

- **Versión** en `app/app.json` (`version` y `versionCode = parche + 1`) y notas en
  `shared/src/releaseNotes.ts` con su `audience`. Hoy: 0.1.189 (190).
- **Compilar:** `npx --yes @constroad/lila-cli@0.9.0 apk build` con JDK 17 y el candado de
  `heavy.sh`. Debe imprimir la huella de firma correcta y
  `EXPO_PUBLIC_API_URL → https://lilachat.constroad.com` (sale de `app/lila.json`).
- **Anotar el runtime:** `scripts/ota-publish.mts --record-apk=<apk>` escribe
  `app/ota-runtime.json` (versionCode, runtime y conteo de hosts de desarrollo).
- **Publicar:** `apk publish --channel=stable --notes=<ruta>`. Se verifica la API de
  LilaStore, la descarga real y el sha256.
- **Probar:** emulador `lilafotos-qa` con candado y `rn-smoke`; QA solo en el espacio Test.
- **Plugins de build** (`app/plugins/`): firma de release, memoria de Gradle (Metaspace),
  arranque nativo, PiP de llamada, consulta a LilaStore, intents de `MainActivity`.
- **Módulos nativos** (`app/modules/`): `ar-measure`, `instalador-apk`,
  `llamada-entrante`, `pdf-pages`, `servicio-socket`, `share-into`, `subject-cutout`.

### OTA

- Publicador `scripts/ota-publish.mts` (motores en `shared/src/otaPublish.ts`):
  - Exige `main` limpio y empujado.
  - Exporta con el entorno de `app/lila.json` y `--clear`.
  - Se niega si cambió lo nativo (runtime distinto de `ota-runtime.json`) o si el bundle
    trae hosts de desarrollo (gate `urls-locales.sh`).
  - Firma con la llave privada que vive solo en la máquina de José.
  - Verifica en vivo después de subir. `--embedded` vuelve al código del APK.
- Server: ver `plataforma-versiones-ota-respaldo.md`.

### Secretos (solo nombres)

`TORRE_HMAC` (GitHub), `LILASTORE_TOKEN` (`.env` de la raíz), keystore en
`~/.gradle/gradle.properties`, `OTA_PUBLISH_TOKEN` (server y `app/.env`), llave OTA en
`~/.config/lilachat-ota/`, y las del server en el `.env` compartido de la mini
(`JWT_SECRET`, `MONGO_URL`, `CONSTROAD_AUTH_KEY`, VAPID, `BACKUP_DIR`, entre otras).
Las carga José en Torre; el server las lee solo al arrancar.

## 3. Diferencias APK vs web

| Tema | APK | Web/PWA |
| --- | --- | --- |
| Quién lo construye | La máquina de José | Torre, en la mini |
| Cuánto tarda en llegar | Cada persona actualiza (banda, LilaStore) | ~4 min tras el push (25/10) |
| Marcha atrás | Otro `versionCode`; o OTA `--embedded` | `git revert` y push |
| Prueba previa | `rn-smoke` en emulador | Gates + build + CI |

## 4. Historia reciente

- **25/10** · Se escribe DEPLOY.spec con un release real (0.1.170). Primera OTA propia
  (0.1.171). Las dos primeras OTA traían la URL del emulador: rollback y el publicador
  ahora la bloquea (gate `urls-locales`).
- **25/10** · Más Metaspace para Gradle: expo-updates agotaba los 512 MB.
- **28/10** · Se permite la constante de desarrollo de react-native en el gate.
- **30/10** · APK 0.1.175 más liviano; runtime anotado.
- **02/11** · Decisión: la OTA pasa a LilaStore (OTA centralizada); lo propio vale hasta
  migrar.
- **04/11** · 0.1.180 sale sin OTA: el ingreso por espacio entra al runtime.
- **06/11** · Un server que reinicia ya no pide una marcha atrás falsa.
- **13/11–16/11** · Siete APKs seguidos (0.1.183 a 0.1.189), por la videollamada, la
  medición AR y el aviso de push.

## 5. Diseños de Stitch

No aplica.

## 6. Pendientes y deuda conocida

- **`LILASTORE_TOKEN` vence el 22/11/2026.** Hay que renovarlo antes; vencido da 401 y,
  con lila-cli 0.9.0, un `ReferenceError`. **Según spec** (DEPLOY §2, leído el 25/10).
- lila-cli 0.9.0 (la publicada que se fija) tapa el motivo de un rechazo con un
  `ReferenceError`. El arreglo estaba en una copia local sin publicar. Qué versión se
  usa hoy: **no verificado**. **Según spec** (§1.3).
- La OTA sigue en el server propio; migrar a LilaStore exige `lila ota cert`, cambiar
  `updates.url`, un APK nuevo y después borrar `server/src/ota`, el publicador y el
  token. **Verificado en código** (`app.json`) y **según spec** (§4-bis).
- Un `409` de Torre deja el run verde sin desplegar. **Verificado en código**
  (`deploy.yml`).
- El health no dice qué commit corre. **Según spec** (§3.4).
- Sin verificar: que Torre vuelva sola a la versión anterior si el health falla, y el
  procedimiento para retirar un APK de LilaStore. **Según spec** (§5, «Deshacer»).
- El spec dice que el push va solo con la orden de José. Si esa regla cambió después del
  25/10: **no verificado**.
- `README.md` y `ARCHITECTURE.spec.md` §12 describen el plan viejo; manda DEPLOY.spec.
  **Según spec** (encabezado).

## 7. Pruebas

- **CI:** `npm test --if-present` y `npm run build` en cada push (`deploy.yml`).
- **Gates locales:** constroad-gates `gates.sh` (versión instalada; el spec cita 1.8.0).
- **OTA:** `shared/src/otaPublish.test.ts`, `server/src/ota/otaRoutes.test.ts`,
  `otaMount.test.ts`, `otaCertificate.test.ts`.
- **Plugins:** `app/plugins/withCallPictureInPicture.test.js`,
  `withMainActivityNewIntent.test.js`, `withNativeStartup.test.js`.
- **APK:** `rn-smoke` en el emulador antes de publicar.
- **Comprobaciones sin token** tras desplegar: DEPLOY §4-bis.6 (`manifest` 400,
  `PUT`/`POST` sin token 401).
- **Maestro:** ninguno propio del deploy.
