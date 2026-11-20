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

### Páginas públicas de privacidad (19/11, Google Play)

- `/privacidad` (Política de privacidad) y `/seguridad-infantil` (normas CSAE), sin sesión
  y también con sesión. Web: `web/src/legal/LegalPage.tsx`; textos en `privacyPolicy.ts` y
  `childSafety.ts`; la ruta la decide `legalPageHere()` en `web/src/App.tsx`.
- Pie «Privacidad · Seguridad infantil»: `web/src/legal/LegalFooter.tsx` en `AccessScreens`
  y `app/src/onboarding/LegalLinks.tsx` en `WorkspaceEntryScreen` (abre el navegador).
  En Ajustes no hay enlace todavía: otro cambio tocaba Ajustes.
- Los textos salen del código: si cambia lo que se recoge o a quién va, cambian en el
  mismo commit. Responsable: RJZ CONSTRUCTORES S.A.C. (ConstRoad), con los datos de
  Portal (José 19/11). Detalle en `specs/PLAY-STORE.spec.md`.
- La agenda **sí sale del teléfono**: `POST /api/contacts/match` recibe los números, los
  compara y no los guarda. Desde el 19/11 lo dicen el permiso de `app/app.json`,
  `ContactPicker.tsx` e `InviteScreen.tsx` (antes decían «no se envían a ningún lado»).

### Denunciar y bloquear (19/11, Google Play)

- **Server** (`server/src/reports.ts`, `reportModel.ts`, `reportRoutes.ts`): `POST /api/reports`
  con `target: 'user'` (`userId`, `chatId` opcional) o `target: 'message'` (`chatId`, `seq`; el
  autor lo pone el server). Motivo, nota opcional (hasta 500; «Otro» la exige) y `alsoBlock`,
  que reusa `blockUser` en el mismo paso. Pide ser miembro del chat; no se denuncia lo propio,
  un aviso del sistema ni a uno mismo.
- **Evidencia:** un mensaje denunciado se copia en la denuncia (texto, ids de adjuntos, autor,
  chat, fecha). Si luego se borra, la copia queda. En un chat secreto no hay texto: `encrypted`.
- **Anti-abuso:** la misma denuncia abierta (misma persona, o mismo mensaje) no se duplica (200,
  `duplicate`); más de 10 en 24 h da 429.
- **Aviso:** push sin chat (`pushPlainNotice`) al superadmin y a los dueños y admins del espacio
  del chat, nunca al denunciado ni a quien denunció. Sin espacio, solo el superadmin. El texto
  dice motivo y espacio, nunca el contenido. Abuso infantil = «Denuncia urgente».
- **APK:** «Denunciar» en la barra de selección de un mensaje ajeno (`SeleccionDeMensaje.tsx`,
  queda en «⋮») y «Denunciar» + «Bloquear» en la tarjeta de una persona
  (`personCard/usePersonCard.tsx` → `app/src/reports/usePersonSafety.tsx`), que abre desde un
  1:1 y desde un miembro de grupo o canal. Hoja `app/src/reports/ReportSheet.tsx`.
- **Web:** «Denunciar» en el menú del mensaje (`MenuDelMensaje.tsx`) y en la tarjeta de la
  persona (`personCard/usePersonCardWeb.tsx` → `web/src/reports/usePersonSafety.tsx`).
  Diálogo `web/src/reports/ReportDialog.tsx`. La cola del superadmin está en `plataforma-admin.md`.
- Bloquear desde la tarjeta lee la lista de bloqueados al abrirla (un `GET /api/me/blocked`).
  Nunca se ofrece para una app.

### Borrar la cuenta (19/11, Google Play)

- **Pedirlo** (`server/src/accountDeletion.ts`, `accountDeletionRoutes.ts`):
  `GET|POST|DELETE /api/me/account-deletion`. `POST` exige `confirm: 'BORRAR'`. Cierra la
  cuenta al instante: anota `deletionRequestedAt`, borra sus `Device` (sesiones, tokens de push,
  webs vinculadas) y corta sus sockets (`disconnectUser`). `requireSession` y el socket la
  rechazan desde ese momento con un registro en memoria (`closedAccounts.ts`, se carga al
  arrancar). Pedirlo dos veces conserva la primera fecha.
- **Se rechaza** (409) si es dueño de un espacio con otros miembros, o su único admin.
  Dice el espacio: «Pasa el espacio a otra persona o elimínalo antes de borrar tu cuenta».
  **No existe transferir el dueño**; la salida real hoy es «Eliminar espacio».
- **Cancelar:** entrar con el código antes de 30 días (`openSession` en `authRoutes.ts`).
  El ingreso devuelve `accountDeletionCancelled: true` y la app y la web lo dicen.
  `/auth/session` de una cuenta cerrada da 401: solo el código la recupera.
- **Purga** (`server/src/accountPurge.ts`, cron diario en `index.ts`): pasados 30 días
  (`ACCOUNT_DELETION_GRACE_DAYS`) borra sus 1:1 y notas enteros (para los dos), lo saca de
  grupos, canales y espacios, borra dispositivos, acuses, destacados, ocultos, stickers,
  recordatorios, respuesta automática, respaldos, mensajes programados, su invitación y sus
  invitaciones por correo, y lo saca de los bloqueados de otros. Un espacio donde estaba solo
  se elimina (`deleteWorkspace`); uno que ganó gente en el plazo pasa al admin más antiguo.
  El usuario queda con `name: 'Cuenta eliminada'`, `phone: deleted:<id>` y `deletedAt`: así
  cada pantalla que resuelve un autor dice «Cuenta eliminada» sin cambiar los clientes.
  Idempotente: `deletedAt` se marca al final y un borrado ya hecho no se toca.
- **APK:** fila «Borrar mi cuenta» al final de Ajustes › Cuenta (`DeleteAccountSetting.tsx`,
  `api/accountDeletionApi.ts`). Explica, pide escribir BORRAR, y al terminar sale de la
  sesión con un aviso nativo con la fecha. `onboarding/deletionCancelledNotice.ts` avisa la
  cancelación.
- **Web:** fila al final del panel de Ajustes (`web/src/account/DeleteAccountChoice.tsx`). Al
  terminar sale y abre `/borrar-cuenta` en «Tu cuenta se cerró…». Página pública
  `/borrar-cuenta` (`DeleteAccountPage.tsx`): explica, entra por correo, teléfono o QR (los
  mismos componentes de `web/src/auth/`) y confirma con `DeleteAccountConfirm.tsx`.

### Shared

- `accountDeletion.ts`: plazo (30 días), estado, fecha límite, palabra BORRAR, espacios que
  bloquean, «Cuenta eliminada» y textos. `phone.ts`: `deletedPhoneKey`.
- `legalPages.ts`: rutas de las páginas públicas, `legalPageOf`, `legalPageUrl`, pie.
- `profile.ts`: `validateBirthday`, `profileMissing`, `profileGateNow`,
  `profileGateScreen` (`create` o `complete`), `backupNeedsEmail`,
  `PROFILE_CHECK_LIMIT_MS` (5 s).
- `perfil.ts`: `MAX_PROFILE_NAME` (60).
- `birthdayReminder.ts`: `BIRTHDAY_REMINDER_SNOOZE_DAYS` (7).
- `presenceMode.ts`: modos y la línea bajo el nombre.
- `blockedContacts.ts`: textos del bloqueo y plazos del bloqueo de la app
  (`APP_LOCK_DELAYS`, por defecto 60 s).
- `reports.ts`: motivos de denuncia, `validateReportInput`, `canReportMessage`,
  `canSendReport`, prioridad (`child_abuse` = alta), orden de la cola y textos.
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
- **19/11** · Páginas públicas `/privacidad` y `/seguridad-infantil` con pie en el ingreso
  (web y APK). Textos de permisos veraces en `app.json` (Google Play).
- **19/11** · Denunciar y bloquear desde el mensaje y desde la tarjeta de cualquier persona,
  también un miembro de grupo (Google Play). La denuncia guarda la copia del mensaje.
- **19/11** · Borrar la cuenta desde la app, la web y `/borrar-cuenta`: se cierra al instante,
  se borra a los 30 días y entrar con el código lo cancela (Google Play).

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
- Borrar la cuenta: la foto de perfil y los archivos de respaldo quedan en el disco (se borran
  sus filas). Los nombres copiados dentro de mensajes viejos (`sharedBy.name`, tarjetas de
  contacto, avisos del sistema) no se reescriben. No hay transferir el dueño de un espacio.
  Sin E2E todavía. **Verificado en código.**

## 7. Pruebas

**Unit (server):** `server/test/perfilRoutes.test.ts`, `server/test/profile.test.ts`,
`server/test/presence.test.ts`, `presenceMode.test.ts`, `presenciaCarrera.test.ts`,
`ultimaVez.test.ts`, `birthdays.test.ts`, `contactShare.test.ts`,
`server/src/contactRoutes.test.ts`, `blockedContacts.test.ts`, `server/test/reports.test.ts`, `readReceipts.test.ts`,
`autoReply.test.ts`.

**Unit (shared):** `profile.test.ts`, `perfil.test.ts`, `birthdayReminder.test.ts`,
`birthdays.test.ts`, `presenceMode.test.ts`, `blockedContacts.test.ts`,
`contacts.test.ts`, `emparejarAgenda.test.ts`, `agendaRelay.test.ts`, `phone.test.ts`.

**Unit (APK):** `app/src/settings/perfilVisible.test.ts`, `app/src/contacts/*.test.ts`
(5: relay, estado de agenda, búsqueda, invitar, aplanar).

**Unit (shared):** `legalPages.test.ts`, `reports.test.ts`.

**Unit (web):** `web/src/legal/LegalPage.test.tsx`, `web/src/reports/ReportDialog.test.tsx`,
`web/src/chat/personCard/usePersonCardWeb.test.tsx`, `web/src/profile/*.test.ts*` (3), `web/src/privacy/*.test.ts*` (5),
`web/src/presence/presenceStatus.test.ts`, `web/src/contacts/*.test.ts` (3).

**Borrar la cuenta:** `server/src/accountDeletion.test.ts` (pedir, rechazar, cancelar al
entrar, purga, idempotencia, traspaso), `shared/src/accountDeletion.test.ts`,
`web/src/account/*.test.ts*` (3), `app/src/api/accountDeletionApi.test.ts`.

**Maestro:** ninguno.
