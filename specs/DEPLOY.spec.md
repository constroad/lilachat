# DEPLOY — publicar Lilachat (web + server y APK)

> Para quien nunca lo hizo. Todo lo de aquí se ejecutó el 25/10/2026 (release 0.1.170,
> commit `a874de5`, deploy de `74bebf1`) o se comprobó con un comando ese mismo día.
> Lo que NO se comprobó está marcado **[sin verificar]**. Nunca se escribe un valor de
> secreto: solo su NOMBRE y dónde vive. Si un documento viejo (`README.md:57`,
> `specs/ARCHITECTURE.spec.md` §12 y P1) contradice este, manda este: aquellos describen
> el plan, no lo que corre hoy.
>
> Raíz del repo: `/Users/josezamora/projects/lilachat` (máquina de José, usuario `josezamora`).
> La Mac mini (usuario `jose`) solo sirve; **aquí se compila y se prueba, allá no**.
>
> Los comandos usan la carpeta `/tmp/lilachat-release/` para logs y notas. Cada llamada a
> la terminal empieza de cero: las variables NO sobreviven de una llamada a otra, así que
> cada bloque las define. Un release a la vez en toda la máquina (otras sesiones comparten
> `/tmp`, el emulador y el árbol de git).

## 0. El mapa en 30 segundos

| Pieza | Qué es | Cómo llega a producción | Dónde corre |
| --- | --- | --- | --- |
| Server + web | UN proceso Node (`dist/index.js`): API, Socket.IO y la web (Express sirve `web/dist`) | `git push` a `main` → GitHub Actions → Torre despliega | Mac mini, `https://lilachat.constroad.com` |
| APK (`app/`) | App RN/Expo, fuera de los workspaces de npm (su propio `node_modules`) | Se compila en la máquina de José y se sube a **LilaStore** con `@constroad/lila-cli`. NO pasa por Torre | Teléfonos; se descarga de `lilastore.constroad.com` |

Un `git push` a `main` **despliega a producción**. Se hace solo con la orden de José para
ese cambio. Quién decide qué:

- **Qué se publica, cuándo y el `push`: José.** Sin su orden para ese cambio, se prepara
  todo (commit local, gates, build) y se le pide el visto bueno antes del push.
- **Versión:** la siguiente de parche (0.1.170 → 0.1.171) salvo que José diga otra.
- **`audience` de las notas:** `spaces` si el cambio solo importa a quien está en un
  espacio de empresa, `personal` si solo importa a quien tiene chats personales, `all`
  si importa a ambos (`shared/src/releaseNotes.ts`, `ReleaseAudience`).
- **Texto de las notas:** 4 líneas cortas, español neutro (tú, nunca voseo), lo que verá
  la persona, no lo que cambió en el código.

## 1. Lo que NO se hace (cada línea costó un incidente)

1. **No ejecutar tests ni builds de prueba en la mini.** Tiene 8 GB y atiende a usuarios;
   un test pesado allí dejó a Portal lento (comentario en `Portal/.github/workflows/deploy.yml`).
   Los tests corren aquí y en el runner de GitHub. (Torre sí hace `npm ci` + build en la mini
   al desplegar: es lo único que corre allí.)
2. **No juntar `gates.sh` y `git push` en un mismo comando**, ni poner `| tail` después de
   `gates.sh`: el pipe se come el código de salida y el hook que mira el sello se burla
   (un push salió en rojo el 20 y el 21/10). El push va en un comando APARTE, después de
   leer `gates=0`.
3. **No usar la CLI sin fijar la versión.** En la máquina de José hay un `npm link` global
   (`$(npm root -g)/@constroad/lila-cli` → `/Users/josezamora/projects/lila-cli`, versión
   0.10.0 NO publicada). `npx --yes @constroad/lila-cli` sin versión —y el alias `lila` de
   zsh, que es exactamente eso— corre ESA copia, no la del registro (0.9.0). Siempre
   `npx --yes @constroad/lila-cli@0.9.0`. El APK 0.1.170 se compiló sin fijar, es decir con
   la copia local; salió bien (firma y URL verificadas), pero no es reproducible.
   **Bug conocido de 0.9.0:** cuando LilaStore RECHAZA la subida (401, 409, 413, 422) la CLI
   muere con un `ReferenceError` (`respuesta.status`, `src/publish.mjs:305` de 0.9.0) y tapa
   el motivo. Está arreglado en la copia local 0.10.0 (`/Users/josezamora/projects/lila-cli/src/publish.mjs`).
   Entre 0.9.0 y 0.10.0 solo difieren `args.mjs`, `publish.mjs` y un archivo nuevo
   (`capturas.mjs`); `build.mjs` es el mismo. Publicar 0.10.0 en npm y subir el pin es
   decisión de José. Mientras tanto, un `ReferenceError` en `apk publish` significa
   «el server rechazó»: mira §5.
4. **No pasar el texto de las notas a `--notes`**: es la RUTA de un archivo, pegada con `=`
   (`--notes=/ruta/notas.txt`). Con el texto, o con un espacio en vez de `=`, falla con
   «No pude leer las notas en …» y no publica.
5. **No imprimir secretos**: ni `cat .env`, ni `echo $LILASTORE_TOKEN`, ni logs sin
   enmascarar. Los comandos de abajo leen el valor dentro del mismo comando.
6. **No tocar `app/.env` para un release.** Trae la URL de desarrollo
   (`EXPO_PUBLIC_API_URL`, el emulador). El release la sobrescribe con `app/lila.json`
   (`build.env.EXPO_PUBLIC_API_URL = https://lilachat.constroad.com`) y la CLI comprueba
   que quedó DENTRO del binario. El host se hornea en el APK: cambiarlo obliga a republicar.
7. **No usar `--enforce`** (fija la versión como MÍNIMA y obliga a todos a actualizar)
   sin orden de José. Hoy el mínimo es `0`.
8. **No editar archivos mientras compila el APK**: el bundle JS se arma a mitad de Gradle y
   se llevaría la edición a medias.
9. **No hacer QA en los espacios reales** (Constroad, Inframaq). Toda prueba va en el
   espacio «Test», y lo creado se borra por el camino de la app.
10. **No `pm clear` ni desinstalar en el emulador** `lilafotos-qa` para "limpiar": borra la
    sesión. Sirve `force-stop`.
11. **No `git add .`, ni `git stash`, ni `git checkout -- <archivo>` en el árbol**: se comparte
    con otras sesiones que tienen cambios sin commitear. Agregar archivos por nombre.
12. **Nunca `git push --force`**, ni `--no-verify`.

## 2. Secretos, variables y dónde viven

| Nombre | Para qué | Dónde vive | Quién lo lee |
| --- | --- | --- | --- |
| `TORRE_HMAC` | firma HMAC-SHA256 del disparo del deploy | Secret del repo `constroad/lilachat` en GitHub (Torre guarda el mismo para verificar) | `.github/workflows/deploy.yml` |
| `LILASTORE_TOKEN` | token de publicación de la app `lilachat` en LilaStore (formato `lsp_<id>_<secreto>`) | `.env` de la raíz del repo (gitignoreado) | `apk publish` (variable de entorno) |
| `LILACHAT_UPLOAD_STORE_FILE`, `LILACHAT_UPLOAD_KEY_ALIAS`, `LILACHAT_UPLOAD_STORE_PASSWORD`, `LILACHAT_UPLOAD_KEY_PASSWORD` | keystore de firma del APK | `~/.gradle/gradle.properties` (fuera del repo) | Gradle, vía `apk build` |
| `EXPO_PUBLIC_API_URL` | URL del server que se hornea en el APK | `app/lila.json` (release) y `app/.env` (desarrollo) | `apk build` |
| `JWT_SECRET`, `MONGO_URL`, `CONSTROAD_AUTH_KEY`, `LILA_SERVER_URL`, `LILA_APP_JWT_SECRET`, `LILA_PUBLIC_URL`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `BACKUP_DIR` (+ opcionales `ANTHROPIC_API_KEY`, `TURN_URL`, `TURN_SECRET`) | server | `.env` compartido de la mini (`deploys/chat/shared/.env`, enlazado por `sharedFiles` en Torre) | el server al arrancar |

Sobre esa última fila: la lista completa está en `specs/ARCHITECTURE.spec.md` (P1,
línea 537, aunque su entrada de Torre está desfasada: manda `torre.apps.json`). `README.md`
lista solo cinco variables; no la uses como inventario.

Reglas:

- **Las variables del server las carga José en Torre** y se reinicia el servicio: el `.env`
  se lee una sola vez al arrancar. Un modelo no las deriva ni las pide a otra sesión.
- `LILASTORE_TOKEN` se guarda **hasheado** en LilaStore: no se puede ver de nuevo. Si se
  pierde, José crea otro en la consola de LilaStore y revoca el viejo. Un token = una app.
- **Vence el 22/11/2026** (`whoami`, 25/10). Renovarlo antes: si vence, `apk publish`
  responde 401 y, con 0.9.0, lo verás como un `ReferenceError`.
- La keystore firma todas las versiones. Si se pierde, Android no deja actualizar sobre lo
  instalado (la firma no puede cambiar) y hay que desinstalar en cada teléfono. La CLI trae
  `keystore backup|verify|fingerprint lilachat`.
- Comprobar de qué app es el token sin mostrarlo:

```bash
cd /Users/josezamora/projects/lilachat/app && LILASTORE_TOKEN="$(grep '^LILASTORE_TOKEN=' ../.env | cut -d= -f2- | tr -d '"')" npx --yes @constroad/lila-cli@0.9.0 whoami
```

Debe decir `app : lilachat (Lilachat)` y una fecha de vencimiento.

## 3. Publicar el server + la web

Torre (la mini) tiene registrada la app con id `chat` en `~/projects/torre/torre.apps.json`
(repo `constroad/torre`; ese archivo solo se cambia por PR): repo
`git@github.com:constroad/lilachat.git`, rama `main`, puerto interno 3004, `build:
npm-ci-build`, servicio launchd `com.constroad.chat`, health
`http://127.0.0.1:3004/api/health`, hostname `lilachat.constroad.com`, entrada
`dist/index.js`, `sharedFiles: [".env"]`.

### 3.1 Antes del commit y del push

Todo desde `/Users/josezamora/projects/lilachat`.

**El árbol es compartido.** Antes de nada:

```bash
cd /Users/josezamora/projects/lilachat && git status --short
```

Lo que aparezca y no sea tuyo (otras sesiones editan `web/src/spaces/*` y los specs, y hay
worktrees en `.claude/worktrees/`) NO se toca, NO se agrega y NO se esconde. Pero los gates
y `npm run build` corren sobre el árbol de trabajo (la regla de inglés escanea hasta lo no
trackeado) y la CI solo ve lo commiteado: un rojo causado por un archivo ajeno no es tuyo
de arreglar —avisa a José y espera— y un verde local puede no ser el de la CI. Para un
commit de release, agrega solo tus archivos por nombre:

```bash
cd /Users/josezamora/projects/lilachat && git add app/app.json shared/src/releaseNotes.ts && git commit -m "chore(release): 0.1.171 con <resumen corto>"
```

**La memoria de la Mac manda.** Un hook (`constroad-gates/1.8.0/hooks/memoria.sh`) BLOQUEA
antes de ejecutar cualquier llamada que empiece por `gates.sh`, `npm run build` o
`apk build` si la Mac está paginando; por eso la espera va en una llamada PREVIA, en
segundo plano (puede tardar hasta 20 min; una llamada normal corta a los 10):

```bash
bash ~/.claude/skills/web-app-loop/scripts/mem-guard.sh --wait
```

1. Los gates (tests de shared/server/web, lint + tsc + tests de `app`, regla de código en
   inglés y de español neutro). Escriben un sello atado al HEAD actual; cualquier commit o
   `--amend` posterior lo invalida y hay que repetirlos. No se midió su duración: córrelos
   en segundo plano (o con timeout de 600000 ms) y lee el log.

```bash
mkdir -p /tmp/lilachat-release && cd /Users/josezamora/projects/lilachat
bash ~/.claude/plugins/cache/constroad-skills/constroad-gates/1.8.0/scripts/gates.sh > /tmp/lilachat-release/gates.log 2>&1; rc=$?
echo "gates=$rc" >> /tmp/lilachat-release/gates.log; tail -25 /tmp/lilachat-release/gates.log; exit $rc
```

`1.8.0` es la versión instalada del plugin `constroad-gates` el 25/10; si hay otra, usar la
más nueva de `~/.claude/plugins/cache/constroad-skills/constroad-gates/*/scripts/gates.sh`.
Leer las líneas ✓/✗ y `gates=0`. Con `gates=1`, leer el log completo antes de seguir. (Con
el emulador abierto, dos tests del server —`server/src/localMedia.test.ts` y
`server/test/respuestaDesdeAviso.test.ts`— han fallado con «Parse Error: Expected HTTP/…»
por choque de puertos efímeros; pasan solos. Se repiten los gates; no se pushea en rojo.)

2. El build de la raíz. **Es obligatorio aparte de los gates**: la CI corre `npm run build`
   (shared → server → web) y compila también los tests del server con `tsc`; los gates no.
   Ya cayó la CI con los gates en verde (23/10).

```bash
mkdir -p /tmp/lilachat-release && cd /Users/josezamora/projects/lilachat
npm run build > /tmp/lilachat-release/build.log 2>&1; rc=$?; echo "build=$rc"; tail -5 /tmp/lilachat-release/build.log; exit $rc
```

### 3.2 Push (comando aparte, con la orden de José)

```bash
cd /Users/josezamora/projects/lilachat && git push
```

### 3.3 Qué pasa solo

`.github/workflows/deploy.yml` (sin filtro de rutas: **un push que solo toca `specs/*.md`
también despliega**):

1. Job `verificar` en GitHub: `npm ci`, `npm test --if-present`, `npm run build`.
2. Job `desplegar` (necesita `verificar`): firma `{"app":"chat","sha":"<GITHUB_SHA>"}` con
   `TORRE_HMAC` y hace POST a `https://torre.constroad.com/api/hooks/deploy`.
   `202` = encolado. `409` se trata como `::warning::` con salida 0: el run queda VERDE
   aunque ese commit no se haya desplegado. Según el código de Torre
   (`torre/src/app/api/hooks/deploy/route.ts`) Torre ya encola y solo contesta 409 si es
   Torre desplegándose a sí misma, así que para `chat` es raro; **[sin verificar]** que la
   Torre de la mini tenga esa versión. Por eso se verifica siempre en vivo (3.4).
3. Torre construye en la mini desde `git archive` (sin `.git`; la carpeta del release se
   llama `AAAAMMDD-HHMMSS-<sha7>`), reinicia el servicio y consulta el health.

Hoy (25/10) pasaron ~4 minutos entre el push y verlo en vivo.

### 3.4 Verificar que está en vivo

La web lleva el commit corto de 7 caracteres horneado en CADA build (`__WEB_VERSION__` en
`web/vite.config.ts`; se ve en Ajustes). Server y web salen del mismo release, así que ese
commit prueba el despliegue de ambos, incluso si el commit solo tocó el server o un spec.
Si no aparece en 10 minutos, imprime `NO_LLEGO`:

```bash
SHA=$(git -C /Users/josezamora/projects/lilachat rev-parse --short=7 HEAD); LLEGO=0
for i in $(seq 1 30); do
  ASSET=$(curl -s https://lilachat.constroad.com/ | grep -o 'assets/index-[A-Za-z0-9_-]*\.js' | head -1)
  if [ -n "$ASSET" ] && curl -s "https://lilachat.constroad.com/$ASSET" | grep -q "$SHA"; then echo "EN VIVO $SHA ($ASSET)"; LLEGO=1; break; fi
  sleep 20
done
[ "$LLEGO" = 1 ] || echo "NO_LLEGO $SHA"
curl -s https://lilachat.constroad.com/api/health
```

El health responde `{"status":"ok","service":"lilachat-server","version":"0.1.0"}`: esa
versión es constante, NO identifica el commit. Si dice `NO_LLEGO`: abrir
`https://github.com/constroad/lilachat/actions` (¿`verificar` en rojo? ¿`desplegar` con
409?) y los logs de Torre en `torre.constroad.com/logs?f=chat:app` (errores: pestaña
«chat · errores»). **Tú no puedes ver esas dos páginas** si no tienes sesión de GitHub
(`gh` no está autenticado para los agentes) ni de Torre: pídele a José el estado del run.

## 4. Compilar y publicar el APK

Todo desde la máquina de José (Android SDK y JDK 17 viven aquí).

### 4.1 Subir la versión (siempre ANTES de compilar)

1. `app/app.json`: `expo.version` (línea 5) y `expo.android.versionCode` (línea 21).
   Convención observada: `versionCode = parche + 1` (0.1.170 → 171, 0.1.171 → 172).
   LilaStore compara el `versionCode`, nunca el texto, y responde `409 version_no_avanza` si
   ya existe uno igual o mayor.
2. `shared/src/releaseNotes.ts`: entrada NUEVA arriba de `RELEASE_NOTES` con `version`,
   `audience` y las líneas de las notas (el test acepta de 1 a 4; la convención de José es
   **4**). La misma lista alimenta «Novedades» de la app y de la web y el texto de LilaStore.
3. Commit (§3.1), gates, build y push como en la sección 3. Compila el APK con el árbol
   limpio en `app/` y `shared/`: `git status --short app shared` debe salir vacío (el APK se
   lleva lo que haya en el disco, aunque no esté commiteado).

### 4.2 Compilar

Los `export` no son indispensables (la CLI resuelve JDK 17 y el SDK sola, `src/build.mjs`),
pero se dejan: con Gradle a mano, sin JDK 17 CMake muere con «A restricted method in
java.lang.System has been called», y `adb` solo está en el PATH con ellos. `PROY=lilachat-app`
evita que el candado de `heavy.sh` (`/tmp/<carpeta>-heavy-lock`, y la carpeta aquí se llama
`app`) lo compartas con otro repo que también tenga `app/`.

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@17 ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
mkdir -p /tmp/lilachat-release && df -h / | tail -1          # hacen falta >= 6 GB libres (25/10: 10 GB)
cd /Users/josezamora/projects/lilachat/app
PROY=lilachat-app ~/.claude/skills/web-app-loop/scripts/heavy.sh npx --yes @constroad/lila-cli@0.9.0 apk build > /tmp/lilachat-release/apk-build.log 2>&1; rc=$?
echo "apk exit: $rc"; tail -8 /tmp/lilachat-release/apk-build.log | cut -c1-200; exit $rc
```

Va en segundo plano (o con timeout largo): Gradle tarda ~3 min (0.1.170: 3 min 10 s) más la
espera de memoria. Una compilación buena termina así:

```
✓ Firmado con CN=lilachat, OU=movil, O=ConstRoad, L=Lima, ST=Lima, C=PE
  huella: 82C794022AD622F6FDEE04F1FAB9ED498EBB5F8224A174DAC4293662D04A24C9
✓ EXPO_PUBLIC_API_URL → https://lilachat.constroad.com
✓ dist/lilachat-<versión>-<code>.apk · ~39 MB
```

Si la huella o la URL son otras: **no publicar** (firma de debug o URL de desarrollo
horneada). La huella no es secreta: es la que LilaStore tiene registrada para validar al
firmante.

### 4.3 Publicar en LilaStore

Las notas salen del mismo catálogo (hace falta haber corrido `npm run build` en la raíz para
que `shared/dist` tenga la entrada nueva). Revisa que el texto salga con la versión y el
`audience` correctos:

```bash
mkdir -p /tmp/lilachat-release && cd /Users/josezamora/projects/lilachat && node -e "
import('./shared/dist/releaseNotes.js').then((m) => { console.log(m.releaseNotesText(m.RELEASE_NOTES[0])); });
" > /tmp/lilachat-release/notes.txt && cat /tmp/lilachat-release/notes.txt
```

```bash
cd /Users/josezamora/projects/lilachat/app
APK=$(ls -t dist/lilachat-*.apk | head -1); echo "publicando $APK"
export LILASTORE_TOKEN="$(grep '^LILASTORE_TOKEN=' ../.env | cut -d= -f2- | tr -d '"')"
npx --yes @constroad/lila-cli@0.9.0 apk publish "$APK" --channel=stable --notes=/tmp/lilachat-release/notes.txt > /tmp/lilachat-release/apk-publish.log 2>&1; rc=$?
echo "publish exit: $rc"
sed 's/lsp_[A-Za-z0-9_-]*/lsp_***/g; s/Bearer [A-Za-z0-9._-]*/Bearer ***/g' /tmp/lilachat-release/apk-publish.log | tail -12; exit $rc
```

Éxito = `exit: 0` y una línea `✓ Publicada <versión> (<code>) · https://lilastore.constroad.com/d/<id>`.
El `<code>` que imprime es el que LilaStore leyó DEL BINARIO (`AndroidManifest.xml`), no el
que se creía subir. Un código de salida 0 solo prueba que el proceso terminó.

### 4.4 Verificar lo que baja una persona

1. La API de LilaStore dice la versión nueva (la que consulta la app para mostrar «Hay una
   versión nueva»). Sale con `Cache-Control: public, max-age=60`: justo tras publicar puede
   mostrar lo viejo; espera 60 s o agrega `&t=$(date +%s)`. El JSON trae hasta 10
   `novedades`; mira solo los primeros campos:

```bash
curl -s "https://lilastore.constroad.com/api/v1/apps/lilachat/min-version?desde=108&t=$(date +%s)" | python3 -c "import json,sys; d=json.load(sys.stdin); d.pop('novedades',None); print(json.dumps(d,indent=1))"
```

   Debe traer `latestVersion`, `latestVersionCode`, `sha256`, `size`, `downloadUrl`
   (`https://lilastore.constroad.com/d/<releaseId>`) y `minVersionCode` (hoy 0).

2. La descarga REAL entrega el archivo nuevo (la API puede decir la versión nueva con la
   descarga cacheada vieja, y es el fallo más caro de diagnosticar). Pon en `URL` el
   `downloadUrl` del paso 1:

```bash
URL="https://lilastore.constroad.com/d/<releaseId>"
curl -sI "$URL" | grep -iE "^HTTP|content-disposition|content-length|etag"
cd /Users/josezamora/projects/lilachat/app && shasum -a 256 "$(ls -t dist/lilachat-*.apk | head -1)"
```

   `content-disposition` debe nombrar `lilachat-<versión>-<code>.apk`; `etag` y `content-length`
   deben igualar el `sha256` y el tamaño del archivo local. (0.1.170: sha256 `70a4026e…3e60e79`,
   40 642 421 bytes, coincidieron.) Si el nombre es el de la versión anterior, está cacheada.

3. En un teléfono con la versión anterior aparece el aviso «Hay una versión nueva» y
   actualiza. La instalación en teléfonos reales pide permitir «instalar desde esta fuente»
   y, en Play Protect, **«Más detalles» → «Instalar de todos modos»** (el botón grande no
   instala).

### 4.5 Probar en el emulador (E2E) y cerrar

Solo si hay que ver la app andando. El emulador `lilafotos-qa` se comparte entre sesiones:
revisa y toma el candado `/tmp/emulador-lock` (`mkdir` falla si ya lo tiene otra sesión: en
ese caso espera o avisa a José).

```bash
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools; export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
mkdir /tmp/emulador-lock && echo "lilachat release <tu nombre>" > /tmp/emulador-lock/owner
nohup emulator -avd lilafotos-qa -no-snapshot-save -no-audio -no-boot-anim > /tmp/lilachat-release/emulator.log 2>&1 &
adb wait-for-device
adb install -r "/Users/josezamora/projects/lilachat/app/dist/$(ls -t /Users/josezamora/projects/lilachat/app/dist | grep '^lilachat-.*apk$' | head -1)"
```

La cuenta de prueba ya tiene la sesión iniciada en el emulador; si no la tiene, el código
OTP (solo el número `902049935`) llega al teléfono de José: **no inicies sesión tú, pídele
el ingreso a José.** Todo lo que crees va en el espacio «Test» y se borra con «Eliminar para
todos» u otro camino de la app (un `deleteOne` en la base deja la burbuja en el caché del
teléfono). Al terminar: `adb emu kill; rm -rf /tmp/emulador-lock`.

Después de publicar:

- Deja en `app/dist/` solo los 3 APK más recientes (convención para cuidar el disco):

```bash
cd /Users/josezamora/projects/lilachat/app && ls -t dist/lilachat-*.apk | tail -n +4 | xargs rm -f; ls dist
```

- La medición de peso (APK y bundle web) y la evidencia E2E se anotan en
  `specs/ARCHITECTURE.spec.md`: las secciones numeradas van de la más nueva a la más vieja y
  la última (`## 135.`) está en la línea 4912, así que la nueva (`## 136.`) se inserta
  justo ANTES de esa línea. Ese archivo tiene unas 12 000 líneas; léelo por rangos.

## 5. Errores conocidos y arreglo

| Síntoma | Causa | Arreglo |
| --- | --- | --- |
| CI cae en «Run npm run build» con gates verdes | los gates no compilan los tests del server | `npm run build` en la raíz antes del push |
| El hook bloquea el push: «el sello es de <otro commit>» | cambió HEAD después de los gates, o gates y push iban en el mismo comando | repetir gates; push en comando aparte |
| Una llamada con `gates.sh`/`npm run build`/`apk build` es «BLOQUEADA por memoria» | la Mac está paginando (el hook `memoria.sh`) | `mem-guard.sh --wait` en una llamada previa, en segundo plano; si no baja en 20 min, avisar a José |
| `gates=1` por `english-only` | un nombre o comentario en español en líneas cambiadas (los textos de UI pueden quedar en español) | renombrar/traducir y repetir gates |
| Los gates se ponen rojos por un archivo que no es tuyo | cambio sin commitear de otra sesión en el árbol compartido | no lo toques; avisa a José y espera o repite cuando esa sesión cierre |
| `git push` rechazado (non-fast-forward) | alguien subió antes | no fuerces: detente y avisa a José |
| Run de Actions verde pero el commit no aparece en vivo | Torre contestó 409 (warning) | esperar el deploy en curso; si no llega, pedir a José un `workflow_dispatch` del workflow o un push nuevo; verificar con 3.4 |
| Run de Actions en rojo en `verificar` | tests o build fallan en el runner | no hay deploy (`desplegar` depende de `verificar`): corregir con un commit nuevo, nunca forzar |
| `✗ No pude leer las notas en …` | `--notes` recibió texto o un espacio | `--notes=/ruta/archivo.txt` pegado |
| `ReferenceError … respuesta` al publicar | 0.9.0 tapa el rechazo del server (§1.3) | mira estas causas: `versionCode` no subió (409 `version_no_avanza`), token de otra app, vencido (vence 22/11/2026) o línea ausente en `.env` (401), APK mal formado (422) o muy grande (413). Revisa con `whoami` y con la API de 4.4 |
| 401 al publicar | token de otra app, vencido o línea ausente en `.env` | `whoami` (sección 2); renueva José |
| `409 version_no_avanza` | `versionCode` no subió | subir `versionCode` en `app/app.json` y recompilar |
| `Unable to locate a Java Runtime` / `SDK location not found` | Gradle a mano sin `JAVA_HOME`/`ANDROID_HOME` | con `apk build` no ocurre (la CLI los resuelve); si usas Gradle, repetir los `export` de 4.2 |
| «A restricted method in java.lang.System has been called» | JDK 21+ | `JAVA_HOME=/opt/homebrew/opt/openjdk@17` |
| Build falla por espacio | disco lleno (APK viejos, snapshots del emulador) | `df -h /`; borrar APK viejos de `app/dist`; `adb emu kill` del emulador que no se usa |
| La subida corta con `524` | APK universal (`--abi=all`, ~96 MB): excede el límite de ~100 s de Cloudflare hacia LilaStore (`specs/ARCHITECTURE.spec.md`, nota de tamaño) | no pasar `--abi`: el valor por defecto es una sola arquitectura (arm64-v8a, ~39–40 MB) |
| La app instalada dice «Sin conexión» con wifi | APK con URL de desarrollo | no publicar sin la línea `✓ EXPO_PUBLIC_API_URL → https://lilachat.constroad.com` |
| Publiqué y la descarga sigue siendo la vieja | caché | comparar `content-disposition` y `etag` (4.4); no confiar en la API |
| Variable del server nueva "no existe" | el `.env` se lee solo al arrancar | José la carga en Torre y reinicia el servicio |

### Deshacer

- **Un deploy malo (web/server):** `git revert <sha>` (commit nuevo, nunca reescribir
  historia), gates, build, push con la orden de José: son otros ~4 min. Torre vuelve sola
  a la versión anterior si el servicio no responde el health tras reiniciar (lo dice el
  comentario del `deploy.yml` de Portal sobre la misma tubería; **[sin verificar]** para
  `chat`).
- **Un APK malo:** no se puede volver a publicar el mismo `versionCode` (409). Se corrige,
  se sube `versionCode` y se publica otro. Retirar una versión de la tienda se hace en la
  consola de LilaStore, y eso lo hace José **[sin verificar el procedimiento]**.

## 6. Lista de un release completo

1. [ ] `git status --short` revisado; `git status --short app shared` limpio; `app/app.json` y `releaseNotes.ts` subidos y commiteados por nombre.
2. [ ] Memoria libre → `gates=0` → `build=0`.
3. [ ] `git push` aparte, con la orden de José.
4. [ ] Web en vivo con el commit (3.4: `EN VIVO`).
5. [ ] `apk build` con `@0.9.0`, firma y URL correctas (4.2).
6. [ ] `apk publish` con `--notes=<ruta>` → `✓ Publicada` (4.3).
7. [ ] API + descarga real + sha256 iguales (4.4).
8. [ ] E2E en el espacio «Test» (web y emulador, si José lo pide) y limpieza verificada en cero (4.5).
9. [ ] Medición y `ARCHITECTURE.spec.md` actualizados (4.5).
10. [ ] Informe a José: qué cambió, versión, enlace de descarga, qué quedó sin verificar.

## 7. Límites de este documento

- No se probó un `apk publish` con `--enforce`, la renovación del token, ni un rechazo del
  server con 0.9.0 (el bug del `ReferenceError` se leyó en el código, no se provocó).
- No se midió la duración de los gates ni de `npm run build`.
- Un lector independiente (sin contexto) revisó este documento el 25/10/2026: comprobó rutas,
  líneas y la entrada `chat` de Torre, y encontró los errores que ya están corregidos arriba.
  No pudo ver GitHub Actions, los logs de Torre, `~/.gradle/gradle.properties` ni los
  secretos, y el pin de `0.9.0` frente a `0.10.0` queda a decisión de José.
- El registro `torre.apps.json` y el secreto `TORRE_HMAC` se leen aquí pero no se cambian;
  si hay que tocarlos, es por PR a Torre y lo hace José.
- `apk build` reciente con 0.9.0 no se repitió: se compiló la 0.1.69 con él en una sesión
  anterior, y `build.mjs` es idéntico en 0.9.0 y 0.10.0, así que se espera el mismo
  resultado que el de 0.1.170.
