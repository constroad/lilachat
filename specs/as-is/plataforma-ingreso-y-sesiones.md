# As-is · Plataforma · Ingreso, sesiones y dispositivos vinculados

## 1. Qué es

Cómo entra una persona a Lilachat y cómo se mantiene la sesión.
Cubre el código por teléfono o correo (vía constroad-auth), el ingreso por espacio
estilo Slack, la sesión JWT, la web vinculada por QR y los dispositivos vinculados.

**Fecha de corte:** 17/11/2026 (APK 0.1.189, versionCode 190).
Fuentes: código, `git log` desde el 16/10, `specs/INGRESO-POR-ESPACIO.spec.md`
y `specs/ARCHITECTURE.spec.md` §5, §5.1, §5.2 y §6.4.

## 2. Qué hace hoy

### Server

- **Rutas de ingreso** (`server/src/authRoutes.ts`, montado en `/api/auth`):
  - `POST /otp/request` y `/otp/verify`: el teléfono es la identidad. El código va por
    WhatsApp; el correo solo si la app manda `preferEmail` («Envíalo a mi correo»).
  - `POST /email/request` y `/email/verify`: entrar por correo (desde el 04/11).
  - `POST /session`: renueva el JWT validando el dispositivo contra constroad-auth.
  - `POST /salir`: cierra la sesión.
  - Las dos puertas terminan en `openSession`.
- **constroad-auth** (`server/src/authClient.ts`): el teléfono nunca le habla.
  El server tiene la llave. Pide el código, lo verifica y valida el dispositivo.
- **Registro abierto:** `REGISTRO_ABIERTO = true` (`authRoutes.ts:41`).
  El gate de invitados sigue en `invitationGate.ts` (respuesta genérica anti-enumeración).
- **Respaldo por correo:** solo vale el correo **verificado** (`backupEmailOf`, desde el 22/10).
- **Cuenta por correo:** guarda `mail:<uuid>` en `users.phone` (`internalPhoneKey`,
  `shared/src/phone.ts`). `isRealPhone` distingue; `formatPhoneDisplay` devuelve vacío.
- **Invitaciones al entrar:** `claimPhoneInvites` reclama las de teléfono al verificar.
  Las de correo esperan a «Unirme» (`GET /api/workspaces/invitations`,
  `POST …/invitations/:id/accept`).
- **Sesión:** JWT propio de 24 h (`server/src/sessions.ts`, `SESSION_TTL`).
  `identidadDeSesion.ts` resuelve el usuario por el dispositivo, no por el texto de identidad.
- **Web en cookie:** el secreto del dispositivo web viaja en cookie `HttpOnly`,
  `SameSite=Strict`, `Path=/api/auth`, 400 días (`cookieDeDispositivo.ts`).
  «Mantener la sesión iniciada» apagado la deja sin `Max-Age`.
- **QR para vincular la web** (`vincularRoutes.ts`):
  - Web: `POST /api/auth/vincular/iniciar`, `/rotar`, `/esperar`.
  - Teléfono: `POST /api/vinculos/consultar`, `/aprobar`, `GET /api/vinculos`,
    `DELETE /api/vinculos/:deviceId`.
  - Las vinculaciones en curso viven en memoria (`vinculaciones.ts`): token del QR
    rota cada 20 s y vence a los 60 s. Se guardan hashes.
  - Webs vinculadas: `dispositivosVinculados.ts`. Revocar pega al instante
    (se consulta con caché de 1 min).
  - Límite por IP en memoria (`limiteDeIntentos.ts`).
- **Versión mínima:** `requireMinimumBuild` (`minimumVersion.ts`) responde 426 a una app
  bajo el mínimo de LilaStore. Detalle en `plataforma-versiones-ota-respaldo.md`.

### APK

- **Flujo de entrada** (`app/src/onboarding/SignInFlow.tsx`, arranca en `entry`):
  1. `WorkspaceEntryScreen` (i-01): correo y «Continuar». Debajo, «Entrar con mi
     número de teléfono» y «Usar sin espacio de trabajo».
  2. `EmailCodeScreen` / `OtpScreen` (i-02): 6 dígitos (`OtpBoxes`), reenvío con
     cuenta regresiva (`useCountdown`), «Cambiar de correo».
  3. `YourSpacesScreen` (i-03, en `app/src/spaces/`): espacios con «Abrir»,
     invitaciones con «Unirme», «Unirme con un código» y «Crear un espacio».
  4. `CreateUserScreen` (i-04): nombre completo, cumpleaños (día y mes obligatorios
     desde el 14/11) y foto opcional.
  - `PhoneScreen.tsx`: el ingreso por teléfono de siempre.
  - Motor puro: `onboarding/machine.ts`.
- **Puerta de perfil:** `useProfileGate.ts` + `CompleteProfileScreen.tsx`. Detalle en
  `plataforma-perfil-contactos-privacidad.md`.
- **Credencial:** en el llavero (`app/src/auth/credentialStore.ts`, `deviceId.ts`).
- **Arranque local-first:** `auth/arranque.ts` abre con la credencial guardada y
  concilia por detrás.
- **Renovación mientras vive** (`auth/sessionRenewal.ts`, `useSessionRenewal.ts`):
  - Renueva al volver a primer plano si pasaron 12 h.
  - Renueva al instante si el socket es rechazado (`unauthorized`).
  - Reintenta cada 30 s, nunca en bucle. Un 401 borra la sesión.
- **Dispositivos vinculados:** Ajustes › `DispositivosVinculadosAjuste.tsx` lista y
  revoca. `EscanerDeVinculacion.tsx` + `useEscanerDeVinculacion.ts` leen el QR de la web.
  Motor: `settings/vinculos.ts`. Máximo 4 vinculados (`MAXIMO_DE_VINCULADOS`).

### Web/PWA

- **Puertas** (`web/src/auth/AccessScreens.tsx`):
  - Pantalla ancha: el QR del teléfono, como WhatsApp Web (`PantallaDeVincular.tsx`,
    QR como un solo camino SVG en `caminoDelQr.ts`).
  - Pantalla angosta: el correo y su código (`EmailSignIn.tsx`).
  - Con número: `IngresoPorTelefono.tsx`.
- **Enlace del correo:** `/login/callback?d=<correo>&c=<código>` (`emailLink.ts`).
  Muestra el código y «Entrar aquí»; el código se gasta con ese toque.
  `?d=` sin código abre «Entrar con mi correo» con el correo escrito (`emailHintOf`).
- **QR escaneado con la cámara:** abre `CodigoParaLaApp.tsx`, que explica dónde escanearlo.
- **Después del código:** `YourSpacesPage.tsx` (i-03) y `CreateUserPage.tsx` (i-04).
- **Sesión:** `web/src/sesion/useSesion.ts`; perfil y JWT en `localStorage`
  (`web/src/api.ts`), secreto del dispositivo en la cookie. Se recupera sola si el
  socket cae (`useSocket.ts`).

### Shared

- `shared/src/vinculacion.ts`: formato del QR, rotación (20 s), máximo (4), prefijo
  `vinculado-`.
- `shared/src/phone.ts`: `normalizePeruPhone`, `internalPhoneKey`, `isRealPhone`.
- `shared/src/workspaces.ts`: `owesItsName`, `accountOwesItsName`, `countdownLabel`,
  `invitedByLine`, `SpaceInvitation`.
- `shared/src/sessionCache.ts`: caché de sesión que pinta lo visto y revalida.
- `shared/src/invitacion.ts`: texto y enlace de invitación (WhatsApp, LilaStore).

## 3. Diferencias APK vs web

| Tema | APK | Web/PWA |
| --- | --- | --- |
| Primera pantalla | Correo (i-01) | QR en pantalla ancha; correo en angosta |
| Secreto del dispositivo | Llavero del teléfono | Cookie `HttpOnly` |
| Vincular | Escanea el QR y lista/revoca vinculados | Muestra el QR; no lista vinculados |
| Renovación | Motor propio por tiempo y por rechazo del socket | Se recupera sola al caer el socket |
| Enlace del correo | No lo abre; el código se escribe | `/login/callback` muestra el código |
| «Mantener la sesión» | No aplica | Casilla en el QR |

## 4. Historia reciente

- **19/10** · Web W0–W5: sesión web en cookie `HttpOnly`, QR para vincular la web
  y dispositivos vinculados en la app (0.1.100). Motivo: la web guardaba el secreto
  en `localStorage` (riesgo de XSS).
- **21/10** · Quien invitó recibe «X se unió a Lilachat» en su 1:1.
- **22/10** · El código de respaldo por correo va solo al correo verificado.
  Motivo: quien invitaba con su correo podía entrar como ese número.
- **22/10** · «Completa tu perfil» antes de entrar (0.1.133). El correo pasa a
  opcional; solo el respaldo lo pide (0.1.144).
- **26/10** · El QR de vincular se dibuja negro también en modo oscuro.
- **04/11** · La app renueva el JWT mientras vive y el socket rechazado se recupera
  solo. Motivo: un proceso de 27 h quedó en «Conectando…».
- **04/11** · Ingreso por espacio como Slack: rutas de correo, cuenta con clave
  interna, cuatro pantallas en app y web. APK 0.1.180 (181), sin OTA.
- **04/11** · El botón del correo lleva a `lilachat.constroad.com` y gasta el código
  solo con un toque (los antivirus abren los enlaces).
- **08/11** · `/auth/session` partido; un 200 vacío de constroad-auth ya no lo tumba.
- **09/11** · El enlace de invitación ya no pide el nombre a quien lo tiene.
- **12/11** · El callback de la llave en Torre y `CONSTROAD_AUTH_CALLBACK` pasan a
  `lilachat.constroad.com`. Antes el botón llevaba a `chat.constroad.com`.
- **14/11** · i-04 pide el cumpleaños a la cuenta nueva por correo.

- **19/11** · Correo: un código vencido dice «Toca «Reenviar el código» y te llega otro» (invitados de Globofast).

## 5. Diseños de Stitch

| Diseño | Estado | Evidencia |
| --- | --- | --- |
| `i-01` Entra a tu espacio | Implementado | `WorkspaceEntryScreen.tsx`, `EmailSignIn.tsx`; E2E 04/11 en spec |
| `i-02` Código por correo | Implementado | `EmailCodeScreen.tsx`, `OtpBoxes.tsx` |
| `i-03` Tus espacios | Implementado | `YourSpacesScreen.tsx`, `YourSpacesPage.tsx` |
| `i-04` Crea tu usuario | Implementado; foto opcional **sin probar** | `CreateUserScreen.tsx`, `CreateUserPage.tsx`; spec §6 |
| `w5-web-vincular` | Implementado | `PantallaDeVincular.tsx` |
| `w5-app-vinculados` | Implementado | `DispositivosVinculadosAjuste.tsx` |
| `w5-app-escaner` | Implementado | `EscanerDeVinculacion.tsx` |
| `otp.png`, `registro.png` (F1) | Reemplazados en la práctica por i-01/i-02 | `PhoneScreen.tsx` sigue como opción |

Las capturas de `i-01` a `i-04` no están en `design/stitch/` local (verificado con `ls`).

## 6. Pendientes y deuda conocida

- `/email/verify` crea la cuenta sin mirar `REGISTRO_ABIERTO`. Si el registro se
  cierra, hay que cerrarlo también. **Verificado en código** (`authRoutes.ts:233-241`).
- La foto opcional de i-04, «Unirme con un código» y «Crear un espacio» desde i-03
  no se probaron en el emulador. **Según spec** (INGRESO §6).
- Pedir permiso de contactos a una cuenta de correo: pendiente de decidir.
  **Según spec** (INGRESO §6).
- El texto del correo de constroad-auth va en voseo («Entrá»). Se pidió a su sesión
  pasarlo a neutro. **Según spec** (INGRESO §9).
- El correo de invitación perdió los pasos por equipo (APK, Safari, computadora).
  **Según spec** (INGRESO §9).
- Ventanas de la sesión: REST no renueva solo; una app 24 h en primer plano llega
  con el token vencido hasta que el socket cae. Reconectar tarda hasta 30 s.
  **Según spec** (§6.4).
- El rechazo por token vencido no se probó en la app instalada. **Según spec** (§6.4).
- `app/.maestro/alta.yaml` espera la pantalla del teléfono como primera
  («Ingresa tu número…»). Desde el 04/11 la primera es la del correo: el flujo está
  desactualizado. **Verificado en código.**
- Las vinculaciones y el límite de intentos viven en memoria. Con más de un proceso
  habría que moverlos. **Verificado en código** (decisión, no fallo).

## 7. Pruebas

**Unit (server):** `server/test/authRoutes.test.ts`, `server/test/emailSignIn.test.ts`,
`server/test/invitationGate.test.ts`, `server/test/vincularDispositivos.test.ts`,
`server/src/authClient.test.ts`, `sessions.test.ts`, `identidadDeSesion.test.ts`,
`cookieDeDispositivo.test.ts`, `vinculaciones.test.ts`, `limiteDeIntentos.test.ts`,
`socketRefusal.test.ts` (socket.io real), `minimumVersion.test.ts`.

**Unit (shared):** `vinculacion.test.ts`, `phone.test.ts`, `workspaces.test.ts`,
`sessionCache.test.ts`, `invitacion.test.ts`.

**Unit (APK):** `app/src/auth/sessionRenewal.test.ts`, `arranque.test.ts`,
`app/src/onboarding/machine.test.ts`, `app/src/settings/vinculos.test.ts`.

**Unit (web):** `web/src/auth/AccessScreens.test.tsx`, `EmailSignIn.test.tsx`,
`emailLink.test.ts`, `caminoDelQr.test.ts`, `useVinculacionPorQr.test.ts`,
`web/src/sesion/useSesion.test.ts`.

**Maestro:** `app/.maestro/alta.yaml` (alta por teléfono hasta la pantalla del código;
desactualizado, ver §6). No hay flujo Maestro para el ingreso por correo.

**E2E manual registrado:** 04/11, web 375 px y emulador con server local y
constroad-auth falso (INGRESO §6). 12/11, invitación real por correo en producción.
