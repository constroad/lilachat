# As-is · Cómo se conecta Lilachat con agentes y con Portal

## 1. Qué es

Un mapa de quién habla con quién. Lilachat es la superficie: no es fuente de datos de negocio.
- **Agentes** (otro repo) queda en el medio. Ahí viven Lila, Dali y las apps de cada producto
  (Portal, Inframaq, Pulso). Agentes guarda el vínculo espacio ↔ empresa.
- **Portal** no llama a Lilachat. Sus avisos salen por los remitentes de agentes, y sus acciones
  van por Lila → MCP → Portal, con una tarjeta «¿Confirmas?» que confirma la misma persona.
- Lilachat emite solo el token del bot. Agentes emite sus llaves `ag_`. Portal no emite ninguna.

Fuente: `specs/BOTS-API.spec.md` (encabezado, §0-bis, §c-sexdecies, §c-septendecies, §c-visitas, §c-prospectos).
**Fecha de corte: 17/11/2026.**

## 2. Qué hace hoy

### Lo que Lilachat expone

| A quién | Qué | Dónde |
| --- | --- | --- |
| Agentes (credencial de Lila, `Basic`) | Crear y borrar apps por manifiesto, rotar secretos, disponibilidad por espacio, espacios de un admin | `/api/bots/apps`, `/api/bots/spaces` (`server/src/bots/botApps.ts`, `botAvailability.ts`) |
| Agentes (canje OAuth) | Instalar una app en un espacio, con PKCE | `/api/oauth/token`, `/api/oauth/revoke` |
| Cada app (token `lcb_`) | Publicar, editar, borrar, leer canales y miembros, archivos, temas, comandos, clientes, tareas, prospectos, subidas | `/api/bots/*` (`server/src/bots/botRoutes.ts`) |
| CI de agentes | El mismo contrato en memoria | `tools/bots-fake/lilachat-bots-fake.mjs` |

### Lo que Lilachat le manda a agentes (eventos firmados)

| Grupo | Eventos | Espera respuesta |
| --- | --- | --- |
| Chat | `message.created`, `message.edited`, `message.deleted`, `button.click`, `checklist.item.toggled`, `app.uninstalled` | No (reintentos 10 s, 1 min, 5 min, 30 min) |
| Comandos y formularios | `command.invoked`, `shortcut.invoked`, `form.submitted`, `form.preview.requested` | Sí, 3 s (8 s para un formulario que contesta por `/respond`) |
| Cuenta en la app | `link.status`, `link.revoke` | Sí, 5 s |
| Canal del cliente | `client.service.requested`, `client.files.requested`, `client.account.requested`, `client.report.requested`, `client.report.draft.requested`, `client.report.embed.requested` | Sí |
| Visita técnica | `visit.draft.requested` | Sí |
| Dali | `prospect.updated`, `prospect.follow_up.approved`, `prospect.handback`, `prospect.field.confirmed` | No |
| Dali, síncronos | `dali.knowledge.requested`, `dali.faq.add` | Sí, 8 s |

- Firma: `X-Lilachat-Signature: v1=<HMAC-SHA256(signing_secret, "<ts>.<cuerpo>")>` por instalación
  (`server/src/bots/botEvents.ts`).
- En la mini, `agentes.constroad.com` se llama por `http://127.0.0.1:3012`. Si nadie escucha, va por la URL
  pública con el mismo `X-Lilachat-Delivery` (`server/src/bots/botLoopback.ts`).
- De agentes a Lilachat dentro de la mini: `http://127.0.0.1:3004`, con los mismos tokens (según spec).

### Lo que Lilachat consume

| De quién | Para qué | Dónde |
| --- | --- | --- |
| constroad-auth | Ingreso (QR o código por WhatsApp) | `server/src/authClient.ts` (`CONSTROAD_AUTH_URL`, por defecto `auth.constroad.com`) |
| Portal, API pública | El mapa de un servicio, con el token del enlace que la persona ya tiene | `server/src/workMapRoutes.ts` (7 s de espera) |
| Portal, desde el teléfono | Subir fotos y videos al Drive del servicio y a la visita, con un ticket de un solo uso | `driveUploadOf` (shared), ticket `site-visit-upload`; el archivo no pasa por Lilachat |
| Portal, editor | El editor de informes de Portal enmarcado en la web ancha | `PORTAL_EMBED_ORIGINS` en shared; `frame-src` en `server/src/cabecerasDeSeguridad.ts` |
| Portal y lila, archivos | Miniaturas de tarjetas y álbumes solo de hosts de Constroad | `www.constroad.com`, `lila.constroad.com`, `inframaq.constroad.com` (galería) |
| LilaStore | La versión mínima del APK | `server/src/minimumVersion.ts` |
| Anthropic | El asistente `/lila` y «Ponme al día» | `server/src/assistantClient.ts` |

### Superficies

- **Web/PWA**: consentimiento `web/src/apps/InstallAppScreen.tsx`. Editor de Portal en un marco.
- **APK**: «Instalar» abre el `install_url` de agentes en el navegador (`app/src/spaces/AvailableApps.tsx`).
- **Shared**: contratos puros (`bots.ts`, `botBlocks.ts`, `botManifest.ts`, `prospect*.ts`, `siteVisit.ts`).

## 3. Diferencias APK vs web

- La pantalla de consentimiento OAuth vive solo en la web.
- El editor de Portal enmarcado es de la web ancha. El APK conserva sus formularios.
- Los eventos y el contrato son los mismos: los manda el server, no el cliente.

## 4. Historia reciente

- **21/10** Contrato v1 con la sesión «Agentes Lila y Dali». Portal no llama a Lilachat.
- **23/10** Apps agnósticas por manifiesto: agentes guarda UNA credencial (la de Lila) y crea el bot de cada
  producto. Agentes decide en qué espacios se instala cada app.
- **23/10** `users:read.email` e `installed_by`: agentes mapea la persona al usuario de Portal.
- **28/10** Webhooks por loopback (agentes midió 0,6–0,96 s por la URL pública y 0,002 s por loopback).
  `channels:history` para el pedido conversacional y los vouchers.
- **29/10** Canal por cliente: agentes crea el canal y publica con `client`.
- **06/11** Subir al Drive del servicio: el archivo va del teléfono a Portal.
- **07/11** El enlace de un servicio se abre con el servicio del canal, sin cuenta de Portal.
- **11–12/11** El editor de informes de Portal enmarcado en la web.
- **14/11** Visita técnica: contrato con agentes, puerta del admin del espacio, tarjeta lv01.
  Agentes borra tarjetas por su clave (`visita:<id>`).
- **15/11** Borrar libera la clave: agentes mueve una tarjeta de canal sin cambiarla.
- **16–17/11** Dali: prospectos, escritorio del vendedor, documentos del cliente y datos por confirmar.

## 5. Diseños de Stitch relacionados

No aplica: este mapa no tiene pantalla. Las pantallas están en los otros as-is `bots-*`.

## 6. Pendientes y deuda conocida

- **El vínculo espacio ↔ empresa lo guarda agentes.** Lilachat no lo conoce. Según spec. Depende de agentes.
- **El instalador de agentes corta** si el espacio no es de una empresa suya. Según spec. Depende de agentes.
- **`DEVELOPER_APP_CLIENT_IDS` es una constante** (`botApps.ts`, hoy solo Lila). Sumar otra desarrolladora
  es un cambio de código revisado. Verificado en código.
- **El puerto de agentes en la mini está en el código** (`botLoopback.ts`, 3012). Si Torre lo cambia, todo
  va por la URL pública hasta corregirlo. Verificado en código.
- **Cambiar el texto de una herramienta en agentes pide reaprobación** de José (502 mientras tanto).
  Según la memoria de las sesiones. Depende de agentes.
- **Producción de Lila**: la spec del 21/10 dice que falta que José cargue el `client_secret` en Torre.
  No verificado: es probable que ya esté, porque las apps funcionan en producción.
- **Lo que responde cada comando, los permisos de Portal y la plata** los decide la app. Lilachat solo
  esconde montos a quien no es admin donde el contrato lo marca. Depende de agentes.
- **Contratos del otro lado** viven en agentes (`COMANDOS-Y-HORARIOS.spec.md`) y en Portal
  (`PRIMERA-VISITA.spec.md` §9). No se leyeron para este as-is.

## 7. Pruebas

- Batería de contrato: la misma corre contra el server real y contra el fake (`server/src/bots/fake.test.ts`, 10;
  `server/src/bots/bots.test.ts`, 29 con webhook HTTP real).
- Loopback: `server/src/bots/botLoopback.test.ts` (3).
- Disponibilidad y desarrolladora: `botAvailability.test.ts` (7), `botApps.test.ts` (14).
- Stub de agentes y de constroad-auth: `scripts/e2e-dali.ts` (puerto :4013).
- Sin pruebas de punta a punta contra agentes reales en Test para Dali. Según spec.
