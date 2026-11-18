# As-is · Plataforma · Perfil, contactos, privacidad y presencia

## 1. Qué es

Los datos propios de la persona (nombre, foto, cumpleaños, correo), con quién puede
hablar (contactos, agenda, invitar, bloquear) y qué muestra de sí (presencia, «últ. vez»,
confirmaciones de lectura, bloqueo de pantalla, respuesta automática).

**Fecha de corte:** 17/11/2026.
Fuentes: código, `git log`, `specs/ARCHITECTURE.spec.md` §93, §106, §165, §178 y
`specs/INGRESO-POR-ESPACIO.spec.md` §4.

## 2. Qué hace hoy

### Server

- **Perfil** (`server/src/profileRoutes.ts`, `/api/me`):
  - `GET|PUT /profile`: nombre (hasta 60 letras), cumpleaños y correo.
    Devuelve `missing` y `birthdayMissing`.
  - `POST /email/code` y `/email/verify`: prueba el correo con un código. El correo
    verificado es de una sola cuenta. Verificar admite las invitaciones por correo
    (`claimEmailInvites`). Con límite de intentos.
  - Una cuenta de correo (clave interna `mail:`) no tiene `birthday` en `missing`:
    recibe `birthdayMissing: true` y no se bloquea.
- **Perfil corto** (`server/src/meRoutes.ts`, `/api/me`): `PUT /perfil` (nombre),
  `POST|DELETE /perfil/foto` (avatar), `GET|PUT /auto-reply`, `GET /android-app`,
  `GET|PUT /presence`.
- **Cumpleaños** (`server/src/birthdays.ts`): aviso a las 8:00 de Lima en los chats que
  lo encienden, y a los admins del grupo el día anterior.
- **Contactos** (`server/src/contactRoutes.ts`, `/api/contacts`):
  - `GET /`: solo con quién YA tengo un 1:1. El padrón nunca se devuelve.
  - `POST /match`: cruza los números de mi agenda con los usuarios.
  - `POST /invite`: crea la admisión de un número (idempotente).
  - Compartir un contacto en un chat: `contactShareRoutes.ts`.
- **Bloqueados** (`server/src/blockedContacts.ts`, `/api/me/blocked`): `GET`, `POST`,
  `DELETE /:userId`. Un bloqueo corta llamadas, mensajes en ese chat y presencia en las
  dos direcciones.
- **Presencia** (`presence.ts`): en memoria del proceso. **Modos**
  (`presenceModes.ts`): En línea, Ausente, Ocupado, Invisible, y si se muestra «últ.
  vez». Invisible no avisa ni guarda la última vez.
- **«últ. vez»** (`ultimaVez.ts`): se guarda en la base al cerrar el último socket.
- **Confirmaciones de lectura** (`readPrivacy.ts`): apagadas, el 1:1 solo dice
  «entregado» en los dos sentidos. Grupos y canales siempre las cuentan.
- **Vista previa de avisos** (`pushPreview.ts`): ver `plataforma-avisos-push.md`.

### APK

- **Puerta de perfil** (`app/src/onboarding/useProfileGate.ts`,
  `CompleteProfileScreen.tsx`): sin nombre o cumpleaños no se entra. El correo es
  opcional (`EmailVerifyField.tsx`, separado el 14/11). `BirthdayFields.tsx` con día y
  mes obligatorios.
- **Recordatorio del cumpleaños** (`BirthdayReminderBanner.tsx`,
  `useBirthdayReminder.ts`): «Agrega tu cumpleaños» en la lista; «Ahora no» lo duerme 7 días.
- **Ajustes** (`app/src/settings/PantallaDeAjustes.tsx`):
  - `PerfilAjuste.tsx` (nombre y foto; `perfilPropio.ts`, `perfilVisible.ts`).
  - `presence/PresenceSetting.tsx` (modo y «últ. vez»).
  - Privacidad: `AppLockSetting.tsx` + `AppLockGate.tsx` (bloqueo con huella,
    `appLock.ts`, `desbloqueo.ts`), `ReadReceiptsSetting.tsx`,
    `NoticePreviewSetting.tsx`, `BlockedContactsSetting.tsx` (`blockedApi.ts`).
  - `AutoRespuestaAjuste.tsx`: respuesta automática.
  - «Invitar a alguien».
- **Contactos** (`app/src/contacts/`): `NewChatScreen.tsx`, `ContactPicker.tsx`,
  `InviteScreen.tsx` + `CabeceraDeInvitar.tsx`, agenda en memoria (`agendaEnMemoria.ts`,
  `aplanarAgenda.ts`, `busqueda.ts`, `estadoAgenda.ts`), invitar (`invitar.ts`,
  `compartirInvitacion.ts`, `useInvitar.ts`).
- **Relay de agenda para la web** (`webAgendaRelay.ts`): la web vinculada pregunta los
  nombres de sus números y el teléfono responde desde su agenda. El server no guarda nada.

### Web/PWA

- **Puerta de perfil** (`web/src/profile/useProfileGate.ts`, `CompleteProfileScreen.tsx`,
  `BirthdayFields.tsx`) y `CreateUserPage.tsx` (i-04, con foto).
- **Recordatorio** (`BirthdayReminderStrip.tsx`, `useBirthdayReminder.ts`).
- **Ajustes** (panel en `web/src/Shell.tsx`, `PanelDeAjustes`):
  - `presence/PresenceChoice.tsx` (modo; `presenceStatus.ts`).
  - `privacy/PrivacyChoices.tsx`: `ScreenLockChoice` + `ScreenLockGate` (contraseña
    local con PBKDF2, `screenLock.ts`), `ReadReceiptsChoice`, `NoticePreviewChoice`,
    `BlockedContactsChoice` (`blockedApi.ts`, `BlockContactRow.tsx`).
  - No hay fila para editar nombre o foto (ver §6).
- **Contactos** (`web/src/contacts/`): `ContactPicker.tsx`, `usePhoneContacts.ts`,
  `useAgendaRelay.ts` (pide la agenda al teléfono), `phoneAgenda.ts`, `fullAgenda.ts`,
  `mergeContacts.ts`.

### Shared

- `profile.ts`: `validateBirthday`, `profileMissing`, `profileGateNow`,
  `profileGateScreen` (`create` o `complete`), `backupNeedsEmail`,
  `PROFILE_CHECK_LIMIT_MS` (5 s).
- `perfil.ts`: `MAX_PROFILE_NAME` (60).
- `birthdayReminder.ts`: `BIRTHDAY_REMINDER_SNOOZE_DAYS` (7).
- `presenceMode.ts`: modos y la línea bajo el nombre.
- `blockedContacts.ts`: textos del bloqueo y plazos del bloqueo de la app
  (`APP_LOCK_DELAYS`, por defecto 60 s).
- `contacts.ts`, `nombreDeContacto.ts`, `sharedContact.ts`, `emparejarAgenda.ts`,
  `agendaRelay.ts`, `phone.ts`.

## 3. Diferencias APK vs web

| Tema | APK | Web/PWA |
| --- | --- | --- |
| Editar nombre y foto | `PerfilAjuste` en Ajustes | Solo al crear la cuenta (i-04); no hay fila en Ajustes |
| Bloqueo | Huella del teléfono | Contraseña local del navegador |
| Agenda | La del teléfono | Se la pide al teléfono vinculado (relay); el Contact Picker del navegador sigue pendiente (P3) |
| Respuesta automática | `AutoRespuestaAjuste` | No existe |
| «últ. vez» oculta | En `PresenceSetting` | En `PresenceChoice` (`lastSeenHidden`) |

## 4. Historia reciente

- **17/10** · Perfil con nombre y foto; archivar, no leído.
- **18/10** · «últ. vez» guardada al irse y pedida al abrir un 1:1.
- **20/10** · Relay de contactos para la web.
- **22/10** · «Completa tu perfil» antes de entrar, sin saltarlo (app 0.1.133, web).
  Cumpleaños y correo probado por código. Estado propio (modos de presencia). Nuevo
  chat de la web con los contactos del teléfono. Aviso a los admins el día antes del
  cumpleaños. Correo opcional; solo el respaldo lo pide (0.1.144).
- **29/10** · Contactos bloqueados y bloqueo de la app con huella (pendiente 9).
- **30/10** · Confirmaciones de lectura y bloqueo de la web (R31/10). Vista previa de
  avisos apagable.
- **06/11** · El nombre admite un nombre completo (hasta 60).
- **09/11** · La puerta abre la pantalla según lo que falta, no por el teléfono guardado.
- **14/11** · El cumpleaños se pide al crear el usuario por correo, y se recuerda.
  El correo opcional sale a su componente.

## 5. Diseños de Stitch

| Diseño | Estado | Evidencia |
| --- | --- | --- |
| `i-04` Crea tu usuario | Implementado (foto sin probar) | ver `plataforma-ingreso-y-sesiones.md` |
| `invitar-amigos.png` (F1) | Implementado como «Invitar» | `InviteScreen.tsx`, `CabeceraDeInvitar.tsx` |
| `legado.png` (Legado digital) | **No implementado** | Spec §45: F14 sin empezar; sin pantalla en el código |

Perfil de usuario y editar perfil: el spec §2.2 lo anota como pantalla que Stitch no
diseñó. **Según spec.**

## 6. Pendientes y deuda conocida

- La web no permite cambiar nombre ni foto después de crear la cuenta. **Verificado en
  código** (`saveProfile` solo lo usan `CreateUserPage` y `CompleteProfileScreen`;
  el panel de Ajustes no tiene fila de perfil).
- La respuesta automática solo existe en el APK. **Verificado en código** (ningún
  archivo de `web/src` usa `/api/me/auto-reply`).
- Legado digital (F14) sin empezar; necesita decisiones de José. **Según spec** (§45, §168).
- La presencia vive en memoria: con más de un proceso habría que pasarla a Redis.
  **Verificado en código** (`presence.ts`, decisión documentada).
- Pedir permiso de contactos a una cuenta de correo: sin decidir. **Según spec**.
- El comentario de `contactRoutes.ts` dice «contacto = alguien de la lista de invitados»;
  hoy el registro está abierto y la lista sale de los 1:1 y de `/match`.
  **Verificado en código** (comentario viejo, la lógica es la nueva).

## 7. Pruebas

**Unit (server):** `server/test/perfilRoutes.test.ts`, `server/test/profile.test.ts`,
`server/test/presence.test.ts`, `presenceMode.test.ts`, `presenciaCarrera.test.ts`,
`ultimaVez.test.ts`, `birthdays.test.ts`, `contactShare.test.ts`,
`server/src/contactRoutes.test.ts`, `blockedContacts.test.ts`, `readReceipts.test.ts`,
`autoReply.test.ts`.

**Unit (shared):** `profile.test.ts`, `perfil.test.ts`, `birthdayReminder.test.ts`,
`birthdays.test.ts`, `presenceMode.test.ts`, `blockedContacts.test.ts`,
`contacts.test.ts`, `emparejarAgenda.test.ts`, `agendaRelay.test.ts`, `phone.test.ts`.

**Unit (APK):** `app/src/settings/perfilVisible.test.ts`, `app/src/contacts/*.test.ts`
(5: relay, estado de agenda, búsqueda, invitar, aplanar).

**Unit (web):** `web/src/profile/*.test.ts*` (3), `web/src/privacy/*.test.ts*` (5),
`web/src/presence/presenceStatus.test.ts`, `web/src/contacts/*.test.ts` (3).

**Maestro:** ninguno.
