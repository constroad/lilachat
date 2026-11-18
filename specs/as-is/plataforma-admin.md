# As-is · Plataforma · Superadmin, operadores e incógnito

## 1. Qué es

Lo que solo ve el creador de Lilachat (superadmin) y lo que puede hacer un operador.
Incluye el panel de personas y espacios (`/admin`), el modo incógnito en un espacio y
el respaldo manual del servidor. Los permisos dentro de un espacio (dueño, admin) están
en `plataforma-espacios-y-canales.md`.

**Fecha de corte:** 17/11/2026.
Fuentes: código, `git log`, `specs/INGRESO-POR-ESPACIO.spec.md` §10,
`specs/ARCHITECTURE.spec.md` §94 y `design/stitch/auditorias/adm-01-usuarios-por-espacio.md`.

## 2. Qué hace hoy

### Server

- **Quién es superadmin** (`server/src/operators.ts`, `isSuperadmin`): el teléfono del
  creador, como constante (`CREATOR_PHONES`). No hay variable de entorno para esto.
- **Quién es operador** (`isOperator`): los teléfonos de `LILACHAT_OPERADORES`.
  Sin la variable, nadie. Un operador corre el respaldo manual; no ve el panel.
- **Panel** (`server/src/adminRoutes.ts`, `/api/admin`, todo con sesión y 403 si no
  es superadmin):
  - `GET /` → `{ superadmin: true }`. La web lo usa para decidir si muestra el panel.
  - `GET /incognito`: los espacios donde está oculto (`incognitoWorkspaces`).
  - `GET /users`: personas, 50 por página, búsqueda y totales
    (`adminPeople.ts`).
  - `GET /spaces` y `GET /spaces/:spaceId/members`: vista por espacio
    (`adminSpaces.ts`), 10 espacios por página y 4 miembros de muestra.
  - Lee solo `users`, `devices`, `workspaces`, `workspacemembers` e `invitations`.
    Nunca chats, mensajes ni contactos.
- **Incógnito** (`hiddenMembers.ts`, `workspaces.ts`):
  - `hidden: true` en su `WorkspaceMember`, puesto por la base.
  - No sale en directorio, «Miembros y roles», conteos, canales, menciones, «Info»,
    doble check ni «Hablar con un admin». «Te agregó…» queda sin nombre.
  - Tampoco se ve a sí mismo como miembro (13/11).
  - Solo lee: `ensureNotIncognito` (`chatService.ts`) rechaza sus mensajes en los chats
    de ese espacio, también en 1:1. El detalle del chat trae `incognito: true`.
  - Lo que sigue a la vista, a propósito: sus mensajes firmados, su «escribiendo», un
    1:1 con él y `GET /api/bots/members`.
  - En un canal compartido sale con la etiqueta del otro espacio y sin rol.
- **Respaldo manual** (`backupRoutes.ts`): `POST /api/backup/run` solo para operadores.
  `GET /api/backup` dice `puedeRespaldar`.

### APK

- `app/src/settings/SuperadminSetting.tsx`: en Ajustes, solo para el superadmin
  (`useIsSuperadmin.ts`). Una fila: «Ver incógnitos».
- `app/src/settings/IncognitoScreen.tsx`: lista los espacios donde está oculto y entra.
  Al abrir otro espacio, el oculto sale de la lista (`withoutClosedIncognito`).
- El compositor se cierra con «Estás en modo incógnito en este espacio: solo puedes leer.».
- `useEsOperador.ts`: muestra «Respaldo del servidor» en Ajustes solo al operador.
- El APK **no** tiene el panel de personas y espacios.

### Web/PWA

- `web/src/spaces/SuperadminSettings.tsx`: sección «Superadmin» al pie de Ajustes con
  «Usuarios de Lilachat» (enlace a `/admin`) y «Ver incógnitos».
- `/admin` (`web/src/App.tsx:58`) abre `web/src/admin/AdminUsersScreen.tsx`.
  - Segmentado «Por espacio · Todas las personas» (`AdminSpacesView.tsx`, 14/11).
  - Cuatro cifras: Personas, Nuevas esta semana, Activas hoy, Perfil completo.
  - Filtro de espacios en columna desde `lg`, chips abajo; «Sin espacio».
  - Cada persona: rol, correo, se unió, última vez, dispositivos, quién lo invitó,
    «También en». Bajo `md`, una tarjeta por persona.
  - Piezas en `AdminParts.tsx`, datos en `adminApi.ts` y `useAdminLoad.ts`.

### Shared

- `shared/src/adminUsers.ts`: `AdminUser`, totales, `ADMIN_USERS_PAGE_SIZE` (50),
  rótulos de dispositivos, de alta y de última vez.
- `shared/src/adminSpaces.ts`: resumen por espacio, `ADMIN_SPACES_PAGE_SIZE` (10),
  `ADMIN_SPACE_PREVIEW` (4), orden de roles, `adminPanelQuery` (lee `vista`, `espacio`,
  `q`, `page` de la URL).
- `shared/src/workspaces.ts`: `withoutClosedIncognito`.

## 3. Diferencias APK vs web

| Tema | APK | Web/PWA |
| --- | --- | --- |
| Panel de personas y espacios | No existe | `/admin` |
| «Ver incógnitos» | Ajustes › Superadmin | Ajustes › Superadmin |
| Respaldo del servidor (operador) | Fila en Ajustes | No hay fila |

## 4. Historia reciente

- **22/10** · Panel del superadmin: quién está en Lilachat y desde cuándo, sin leer
  chats. «Usuarios de Lilachat» en Ajustes de la web.
- **12/11** · Solo el creador ve el panel; el operador ya no. Miembro oculto para el
  soporte de José en Globofast (temporal).
- **13/11** · Incógnito solo lee y no se ve ni a sí mismo. «Ver incógnitos» pasa del
  selector de espacios a Ajustes › Superadmin (se descartó `inc-02`).
- **13/11** · La lista de incógnitos web hace scroll hasta verse.
- **14/11** · `/admin` agrupa a las personas por espacio (adm-01). Dos revisiones de
  la tabla: cortes de columnas, logo con respaldo, vacío sin búsqueda.

## 5. Diseños de Stitch

| Diseño | Estado | Evidencia |
| --- | --- | --- |
| `adm-01-usuarios-por-espacio` (escritorio y móvil) | Implementado. Segunda revisión: «pasa con observaciones» | `AdminSpacesView.tsx`; `auditorias/adm-01-usuarios-por-espacio.md` |
| `inc-02-selector` | **No implementado, a propósito** | Sustituido por Ajustes › Superadmin (INVENTARIO, 13/11) |

En la auditoría de adm-01 quedó «no verificable» la parte baja de la página («Sin
espacio», «Expandir», paginación y vacío): la captura era solo del primer pantallazo.

## 6. Pendientes y deuda conocida

- El miembro oculto no tiene pantalla: se pone y se quita por la base
  (`$unset: { hidden: 1 }`). **Verificado en código** y decisión de José.
- La presencia de José oculto en Globofast es temporal; él pedirá que lo saquen.
  **Según spec** (INGRESO §10).
- El superadmin es una constante en código. Cambiarlo exige un deploy.
  **Verificado en código** (decisión: un dato del producto, no configuración).
- adm-01: falta la captura de la página completa para auditar la parte baja.
  **Según auditoría** (`adm-01-usuarios-por-espacio.md`, fila 20).
- El APK no tiene panel de personas. **Verificado en código** (no hay pantalla que lea
  `/api/admin/users`).

## 7. Pruebas

**Unit (server):** `server/test/adminUsers.test.ts`, `server/test/adminSpaces.test.ts`,
`server/src/hiddenMember.test.ts`, el caso del canal compartido en
`server/src/sharedChannels.test.ts`, `backupRoutes.test.ts` (operador).

**Unit (shared):** `adminUsers.test.ts`, `adminSpaces.test.ts`, `workspaces.test.ts`.

**Unit (web):** `web/src/admin/AdminUsersScreen.test.tsx`,
`web/src/spaces/SuperadminSettings.test.tsx`.

**Unit (APK):** ninguno propio de esta área.

**Maestro:** ninguno.

**E2E registrado:** revisión de adm-01 sobre capturas de producción (14/11, código
`d14c8ac9` y `99951620`).
