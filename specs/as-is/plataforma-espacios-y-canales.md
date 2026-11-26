# As-is · Plataforma · Espacios de trabajo y canales

## 1. Qué es

El «modo empresa» de Lilachat, como Slack: espacios con miembros, roles, código de
ingreso, invitaciones, canales (públicos, privados, #general, de cliente y
compartidos entre espacios), miembros ocultos y borrado del espacio.

**Fecha de corte:** 17/11/2026 (APK 0.1.189).
Nació el 21/10 (E1/E2, commit `bcee0786`). Fuentes: código, `git log`,
`specs/INGRESO-POR-ESPACIO.spec.md` §8–§10 y `specs/ARCHITECTURE.spec.md` §6.1-ter.

Fuera de este archivo: las apps/bots del espacio (`bots-api-y-tarjetas.md`), el
contenido de los canales de cliente (cobranza, Drive, informes), Dali y el mapa de obra.

## 2. Qué hace hoy

### Server

- **Rutas** (`server/src/workspaceRoutes.ts`, `/api/workspaces`):
  - `GET /` mis espacios (`?incognito=<id>` trae el oculto abierto), `POST /` crear.
  - `GET /preview/:code` y `POST /join` (con límite por IP).
  - `GET /invitations`, `POST /invitations/:id/accept`.
  - `PATCH /:id`, `POST|DELETE /:id/logo`, `POST /:id/delete`, `POST /:id/leave`.
  - `GET|POST /:id/members`, `PATCH|DELETE /:id/members/:memberId`.
  - `GET|POST /:id/channels`, `DELETE /:id/channels/:chatId`, `POST …/join`.
  - `GET|POST|DELETE /:id/channels/:chatId/shares…`, `GET …/people`,
    `GET /:id/share-invites`, `POST /:id/share-invites/:chatId`.
  - `GET|POST|DELETE /:id/emojis…` (emojis propios del espacio).
  - Rutas de clientes y visitas (`/:id/clients/*`, `/:id/visits/*`): otro as-is.
- **Invitar por correo** (`workspaceInviteRoutes.ts`, `workspaceEmailInvites.ts`):
  `POST /:id/invites` y `DELETE /:id/invites/:inviteId`. El server manda el correo por
  constroad-auth (`authClient.sendInvitation`, desde el 12/11). Responde `emailSent` y
  `emailError`. Tope de constroad-auth: 5 por hora y destino.
- **Reenviar desde «Invitados» (José 19/11, Globofast).** Cada correo invitado dice cuándo se
  invitó («Invitado por correo el 12 nov», `emailInviteLine` en shared) y tiene «Reenviar» junto a
  retirar, en web y APK. Reenviar es el mismo `POST /:id/invites` con el correo: manda otro correo
  con el cargo guardado en la invitación. La invitación de Lilachat no vence. El código de 6 dígitos
  que pide la persona al entrar sí vence (constroad-auth); al fallar dice «Toca Reenviar el código».
- **Lógica** (`server/src/workspaces.ts`): crear, código, unirse, listar, `addByPhone`,
  `updateMember`, `rejectRequest`, `leaveWorkspace`, `claimPhoneInvites`,
  `incognitoWorkspaces`.
- **Roles:** `owner`, `admin`, `member`, `guest`. Estados: `active`, `pending`,
  `invited`, `deactivated`. Política: `open` o `approval` (`shared/src/workspaces.ts`).
- **#general** (`workspaceGeneral.ts`): todo miembro activo está. «Ana se unió al
  espacio» cae ahí. Un espacio viejo recibe su #general al primer vistazo.
- **Canales** (`workspaceChannels.ts`): un grupo con `channel`. Público o privado.
  En un espacio solo se crean canales, no grupos (desde el 28/10).
- **Canales compartidos** (`sharedChannels.ts`, `sharedChannelModel.ts`, desde el 11/11):
  como Slack Connect. Solo un admin comparte; no se comparten #general ni los canales
  de cliente. Si quien comparte también es admin del otro espacio, queda activo; si no,
  espera a un admin. El espacio que recibe puede dejar de verlo.
  En la lista del espacio que recibe, cada espacio dueño es su propio bloque, como
  «External connections» de Slack (José 19/11): una línea fina de ancho completo
  arriba de cada bloque y otra bajo el último (`border-outline/15`, sin tarjeta ni
  color), cabecera con logo, NOMBRE, 🔗 apagado, cantidad y flecha de plegar, y sus
  canales con 16 px más de sangría (`ChannelRow nested`). Las filas del bloque ya no
  llevan 🔗: lo dice la cabecera. Un canal propio compartido hacia afuera lo conserva.
  Web `SpaceChatList.tsx`; APK `SpaceChatsScreen.tsx` (la línea de abajo la pone la
  sección siguiente, que ya tiene la suya).
- **Salir o ser desactivado** (`workspaceChats.ts`, `reachedElsewhere`): la persona
  sigue en los canales que el espacio comparte con otro donde sigue activa (12/11).
- **Miembro oculto** (`hiddenMembers.ts`, 12/11): `hidden: true` en su
  `WorkspaceMember`, solo por la base. No sale en directorio, conteos, menciones,
  «Info» ni «Te agregó». En incógnito solo lee: `ensureNotIncognito` (en
  `chatService.ts`) rechaza sus mensajes. Detalle en `plataforma-admin.md`.
- **Avisos de espacios** (`workspaceNotices.ts`): «tus espacios cambiaron» por socket
  a quien toca un cambio (solicitud, aprobación, rol, desactivación).
- **Borrar un espacio** (`workspaceDelete.ts`, 10/11): solo el dueño, escribiendo el
  nombre. Marca `deletedAt`, guarda miembros en `deletedWithSpace`, desinstala apps.
- **Purga** (`workspacePurge.ts`, 11/11): cada 6 h borra de verdad lo eliminado hace
  más de 30 días (`PURGE_AFTER_DAYS`). Los archivos en disco quedan.
- **Info del espacio** (`workspaceInfo.ts`) y el aviso «se unió» (`joinNotice.ts`).

### APK

Carpeta `app/src/spaces/`:

- Entrar y crear: `WelcomeScreen` (e-01), `JoinSpaceScreen` (e-02), `RequestCard`
  (e-03), `CreateSpaceScreen` (e-04), `YourSpacesScreen` (i-03).
- Moverse: `SpaceSwitcherSheet` (e-06), `SpaceChatsScreen` (e-07, con secciones),
  `currentSpace.ts`, `seenSpaces.ts`, `spaceCache.ts`, `useSpaceChatsLive.ts`.
- `spaceDiskKey` (26/11): toda copia de un espacio vive bajo `lilachat:space-cache:<spaceId>:`, también el detalle guardado de un servicio (`plataforma-sin-senal.md`).
- Personas: `DirectoryScreen` (e-08), `MemberProfileScreen` (e-09), `MembersScreen`
  (e-10, pestaña Invitados), `MemberActionsSheet`, `memberUi.tsx`.
- Invitar: `InviteToSpaceScreen` (e-05): correo primero, luego WhatsApp.
- Canales: `ChannelsScreen` (e-15), `CreateChannelSheet` (e-16), `SharedChannelsApp`.
- Ajustes: `SpaceSettingsScreen` (e-12), `SpaceSettingsSection` (e-34, arriba de
  Ajustes), `IntegrationsSection`, `customEmojis.tsx`, `DeleteSpaceScreen`.
- Avisos de estado: `AddedToSpaceScreen` (e-13), `AccessRemovedScreen` (e-14).
- Entrada en espera: `heldEntry.ts` (un enlace de invitación que espera la sesión).

### Web/PWA

Carpeta `web/src/spaces/`:

- Riel de espacios: `SpacesRail.tsx` dentro de `rail/AppRail.tsx`; `SpaceLogo.tsx`.
- Diálogos equivalentes al APK: `CreateSpaceDialog`, `JoinSpaceDialog`,
  `InviteToSpaceDialog`, `MembersDialog`, `MemberProfileDialog`, `DirectoryDialog`,
  `ChannelsDialog`, `CreateChannelDialog`, `SpaceSettingsDialog`, `DeleteSpaceDialog`,
  `AddedToSpaceDialog`, `AccessRemovedDialog`, `SharedChannelsWeb`, `WelcomePane`.
- Lista y navegación: `SpaceChatList.tsx`, `SpaceSwitcher.tsx`, `SpaceTitleMenu.tsx`,
  `SpacesLayer.tsx`, `useSpacesWeb.tsx`, `linkedChatSpace.ts` (un `/c/<chat>` de otro
  espacio abre en ese espacio), `pendingJoin.ts`, `openedChat.ts`.
- En el teléfono: `SpacePhoneLinks.tsx` en Ajustes y la barra de abajo
  (Chats · Directorio · Menciones · Ajustes).
- `YourSpacesPage.tsx` (i-03) después del código.

### Shared

- `workspaces.ts`: roles, estados, `makeJoinCode`/`normalizeJoinCode`,
  `canManageMembers`, `canDeleteSpace`, `confirmsSpaceName`, `canChangeRole`,
  `canDeactivate`, `normalizeChannelName`, `withoutClosedIncognito`.
- `workspaceMembers.ts`: rótulos de rol, áreas (Obra, Planta, Flota, Admin.),
  acciones por miembro, filtros, fechas.
- `sharedChannels.ts`: reglas de compartir, pastilla del otro espacio,
  `shareInvitesStore` (una sola tienda para web y app).
- `clientChannels.ts`: canal vivo = movimiento en 60 días (`CLIENT_LIVE_DAYS`),
  grupos de Archivados.
- `welcome.ts`, `invitacion.ts`, `infoDeGrupo.ts`, `accionesDeMiembro.ts`.

## 3. Diferencias APK vs web

| Tema | APK | Web/PWA |
| --- | --- | --- |
| Cambiar de espacio | Hoja `SpaceSwitcherSheet` | Riel a la izquierda; selector en el teléfono |
| Pantallas | Pantallas y hojas a pantalla completa | Diálogos sobre la lista |
| Ajustes del espacio | Arriba de la pestaña Ajustes (e-34) | `SpaceSettingsDialog`; en el teléfono, `SpacePhoneLinks` |
| Riel en el teléfono | No hay riel | Bajo 900 px no hay riel; barra de abajo como el APK (06/11) |

Las reglas de permisos son las mismas: vienen de `shared` y el server las aplica.

## 4. Historia reciente

- **21/10** · Espacios de empresa E1/E2: miembros, canales, riel, selector, código
  de ingreso. Directorio, perfil, miembros y roles, solicitudes, «Te agregaron»,
  «Sin acceso» y Medios (0.1.125).
- **22/10** · #general en cada espacio. Invitar por correo con pestaña Invitados
  (0.1.140). Listas que abren con lo ya visto (0.1.141).
- **24/10** · Ajustes del APK con el espacio abierto arriba (e-34).
- **25/10** · Ficha de persona con «Enviar mensaje»; «Agregar miembros» lista a los
  del espacio.
- **28/10** · En un espacio solo se crean canales. Emojis propios del espacio.
- **29/10** · Sección CLIENTES, Archivados y pestaña Servicios (f-01 a f-03). Bienvenida
  e-01 para cuentas nuevas.
- **01/11** · La hoja de espacios pedía la lista 4–5 veces por segundo: arreglado. Un 2xx
  sin la lista ya no tumba la app.
- **04/11** · Ingreso por espacio (i-03). La lista del espacio pinta una sola vez.
- **10/11** · El dueño puede eliminar un espacio.
- **11/11** · Purga a los 30 días. Canales compartidos entre espacios. El espacio que
  recibe puede dejar de verlo.
- **12/11** · Miembro oculto. Salir conserva los canales compartidos donde sigue activo.
  Invitación por correo enviada por el server. Un `/c/<chat>` de otro espacio abre en él.
- **13/11** · Incógnito solo lee. «Ver incógnitos» pasa a Ajustes › Superadmin.
- **17/11** · La ficha de miembro web ya no se desborda a 390 px.
- **19/11** · «Invitados» muestra la fecha de cada invitación por correo y permite «Reenviar».
- **19/11** · Los canales compartidos de otro espacio forman su bloque entre divisores, con sangría y sin 🔗 por fila (web y APK; José eligió el divisor estilo Slack sobre la tarjeta de color).
- **19/11** · El superadmin comparte un canal también con los espacios donde está incógnito (`shareTargets` + `GET /admin/incognito`, web y APK; José: «sistemas» de Inframaq con Globofast). El server ya lo aceptaba.
- **25/11** · `scripts/space-channels.ts` suma los `--join` a un canal que ya existe (antes lo saltaba); en un canal privado los agrega `--by` con `addMember`. Usado para Nikole, Leopoldo Campos, Cielo y Pachas en #oficina de Globofast. `scripts/topic-channel.ts` mueve un tema de avisos de una app a un canal, por `setTopicChannels`: el tema `informes` de agentes (las visitas técnicas) pasó de #general a #admin en Constroad y a #oficina en Globofast.

## 5. Diseños de Stitch

| Diseño | Estado | Evidencia |
| --- | --- | --- |
| `e-01` Bienvenida | Implementado (29/10) | `WelcomeScreen.tsx`, `WelcomePane.tsx`; INVENTARIO lo marca |
| `e-02` Unirse con código | Implementado | `JoinSpaceScreen.tsx`, `JoinSpaceDialog.tsx` |
| `e-03` Solicitud enviada | Implementado | `RequestCard.tsx` (app y web) |
| `e-04` Crear un espacio | Implementado | `CreateSpaceScreen.tsx`, `CreateSpaceDialog.tsx` |
| `e-05` Invitar | Implementado | `InviteToSpaceScreen.tsx`, `InviteToSpaceDialog.tsx` |
| `e-06` Selector de espacios | Implementado | `SpaceSwitcherSheet.tsx`, `SpaceSwitcher.tsx` |
| `e-07` Lista del espacio | Implementado | `SpaceChatsScreen.tsx`, `SpaceChatList.tsx` |
| `e-08` Directorio | Implementado | `DirectoryScreen.tsx`, `DirectoryDialog.tsx` |
| `e-09` Perfil de miembro | Implementado | `MemberProfileScreen.tsx`, `MemberProfileDialog.tsx` |
| `e-10` Miembros y roles | Implementado | `MembersScreen.tsx`, `MembersDialog.tsx` |
| `e-11` Solicitudes | Implementado | commit `5d6e609b` (21/10) |
| `e-12` Ajustes del espacio | Implementado | `SpaceSettingsScreen.tsx`, `SpaceSettingsDialog.tsx` |
| `e-13` Te agregaron | Implementado | `AddedToSpaceScreen.tsx`, `AddedToSpaceDialog.tsx` |
| `e-14` Ya no tienes acceso | Implementado | `AccessRemovedScreen.tsx`, `AccessRemovedDialog.tsx` |
| `e-15` Explorar canales | Implementado | `ChannelsScreen.tsx`, `ChannelsDialog.tsx` |
| `e-16` Crear canal | Implementado | `CreateChannelSheet.tsx`, `CreateChannelDialog.tsx` |
| `e-34` Ajustes con el espacio arriba | Implementado (24/10) | `SpaceSettingsSection.tsx`; spec §131 |
| `inc-02` Selector con «Ver incógnitos» | **No implementado, a propósito** | Sustituido el 13/11: va en Ajustes › Superadmin |
| `f-07` Canal que nace con la cotización | **Descartado** por José (29/10) | INVENTARIO |

No se abrió cada PNG en este corte: el estado sale de los archivos y del INVENTARIO.
La fidelidad visual fina no está auditada (no hay archivo en `design/stitch/auditorias/`
para las pantallas `e-*`).

## 6. Pendientes y deuda conocida

- El miembro oculto solo se pone y se quita por la base: no hay pantalla.
  **Verificado en código** (`hiddenMembers.ts`; decisión de José).
- Un canal NUEVO no suma solo a la admin puesta a mano en los canales de Globofast.
  **Según spec** (INGRESO §10).
- Recuperar un espacio eliminado es a mano (borrar `deletedAt` y devolver miembros).
  **Verificado en código** (`workspaceDelete.ts`).
- La purga deja los archivos en disco. **Verificado en código** (`workspacePurge.ts`).
- El enlace del correo sin sesión (correo escrito en «Entrar con mi correo») solo
  tiene test, sin prueba real. **Según spec** (INGRESO §9).
- Las pantallas `e-*` no tienen auditoría escrita contra el mockup. **Verificado**
  (carpeta `auditorias/` solo trae adm-01 y lv01–lv03).

## 7. Pruebas

**Unit (server):** `workspaces.test.ts`, `workspaceAdmin.test.ts`,
`workspaceGeneral.test.ts`, `workspaceDelete.test.ts`, `workspacePurge.test.ts`,
`sharedChannels.test.ts`, `hiddenMember.test.ts` (9 casos), `channelLifecycle.test.ts`,
`channelMembers.test.ts`, `chatSpaces.test.ts`, `server/test/joinNotice.test.ts`.

**Unit (shared):** `workspaces.test.ts`, `workspaceMembers.test.ts`,
`sharedChannels.test.ts`, `clientChannels.test.ts`, `welcome.test.ts`,
`accionesDeMiembro.test.ts`, `infoDeGrupo.test.ts`.

**Unit (APK):** `app/src/spaces/heldEntry.test.ts`. Las pantallas no tienen test propio.

**Unit (web):** `web/src/spaces/` trae 53 archivos de test; los de esta área:
`spaces.test.tsx`, `enterprise.test.tsx`, `currentSpace.test.tsx`, `spaceCache.test.tsx`,
`InviteToSpaceDialog.test.tsx`, `MemberProfileDialog.test.tsx`, `SharedChannelsWeb.test.tsx`,
`SpaceLogo.test.tsx`, `WelcomePane.test.tsx`, `pendingJoin.test.ts`,
`linkedChatSpace.test.tsx`, `SuperadminSettings.test.tsx`.

**Maestro:** ninguno para espacios (los flujos de `app/.maestro/` son de chat, Dali y alta).

**E2E registrado:** 12/11 en producción, invitación por correo a direcciones QA en el
espacio Test, luego retiradas (INGRESO §9).
19/11, web en producción, espacio Test: invitación a `qa-invitados-lilachat@yopmail.com` →
«Invitados» dice «Invitado por correo hoy» → «Reenviar» responde «Le reenviamos la invitación
a …» → retirada, «Invitados 0». El APK (OTA `933bc6f1`) quedó cubierto por tsc y lint, sin E2E.
