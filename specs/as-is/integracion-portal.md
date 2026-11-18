# As-is · Integración con Portal (lado de Lilachat)

> Fecha de corte: **17/11/2026**. Solo el lado de Lilachat. Fuentes: código de `main`
> (`server/src`, `web/src`, `app/src`, `shared/src`), `git log` de las últimas dos
> semanas, `specs/INFORMES-DESDE-LILACHAT.spec.md`, `specs/MAPA-OBRA.spec.md` y
> `specs/AS-IS-0.1.170.spec.md`. Lo que Portal hace por dentro no se documenta aquí.

## 1. Qué es

Portal (`www.constroad.com`) guarda los datos de obra: servicios, informes, mapa de
obra, visitas, observaciones, áreas, Drive, cobranza. Lilachat es la puerta de campo:
captura, muestra y manda. Casi todo cruza por **Agentes** (la app de Lilachat que
habla con Portal). Lilachat llama a Portal directo en pocos lugares, listados en §3.

## 2. Contrato

El contrato vive en Portal: <ruta por confirmar>.

Del lado de Lilachat, el contrato de eventos y tarjetas de las apps está en
`specs/BOTS-API.spec.md`. Este archivo no repite el de Portal.

## 3. Dónde Lilachat llama a Portal

### 3.1 Por Agentes (el camino normal)

Todo pedido sale del server de Lilachat al webhook de la app instalada en el espacio
(`callBotWebhook`, `server/src/bots/botEvents.ts`).

| Pieza | Valor |
| --- | --- |
| Transporte | `POST` al `webhookUrl` de la app. En la mini, `agentes.constroad.com` va por `http://127.0.0.1:3012` (`botLoopback.ts`) |
| Firma | `X-Lilachat-Event`, `X-Lilachat-Delivery`, `X-Lilachat-Installation`, `X-Lilachat-Timestamp`, `X-Lilachat-Signature` (HMAC con el secreto de la instalación) |
| Identidad | `user` (id, nombre, teléfono) que pone el server; nunca lo manda el teléfono |
| Frontera | `client_id` y `service_id` junto a los valores; la puerta es `findAskedService` (`server/src/bots/clientFiles.ts`) |
| Espera | 8 s en las lecturas (`ASK_TIMEOUT_MS`); un 2xx cortado cuenta como falla |
| Falla | La respuesta trae `portal_url` (`fallbackUrl`) para abrir el servicio en Portal |

**Lecturas (preguntas con respuesta):**

| Evento | Ruta de Lilachat | Para qué |
| --- | --- | --- |
| `client.service.requested` | `GET /api/workspaces/:id/clients/:clientId/services/:serviceId/detail` | Detalle del servicio (pedidos, informes, `editor: 'v2'`) |
| `client.files.requested` | `GET …/services/:serviceId/files` | Drive del servicio |
| `client.service.requested` (cobranza) | `GET …/services/:serviceId/billing` | Cobranza, `need: 'money'` |
| `client.account.requested` | `GET /api/workspaces/:id/clients/:clientId/account` | Cuenta del cliente, `need: 'money'` |
| `client.report.requested` | `GET …/reports/:reportId/pdf` | PDF de un informe |
| `client.report.embed.requested` | `GET …/reports/:reportId/embed`, `POST …/reports/embed` | Enlace del editor 2.0 |
| `client.report.draft.requested` | `POST …/reports/draft` | Documento del informe por secciones |
| `visit.draft.requested` | `POST /api/workspaces/:id/visits/draft` | Visita técnica |

**Escrituras:** siempre `form.submitted`. Lilachat abre un `BotCommandRun` (15 min) con
`POST …/reports/forms` o `POST /api/workspaces/:id/visits/forms`, y el envío va por
`POST /api/chats/:chatId/commands/:commandId/form` (fotos por `…/files`). `form_id` es
el nombre de la herramienta de Portal. Lista de kinds y herramientas: `obra-mapa.md` §2,
`obra-informes.md` §2 y `obra-visita-e-iaa.md` §2.

### 3.2 Directo del server de Lilachat a Portal

| Llamada | Método y destino | Auth | Para qué | Archivo |
| --- | --- | --- | --- | --- |
| Detalle público del servicio | `GET https://www.constroad.com/api/public/client-portal/services/[id]?token=` | El token del enlace del servicio, que la persona ya obtuvo | Mapa de obra (`detail.workStreets`) | `server/src/workMapRoutes.ts` (`POST /api/service-work-map`) |
| Subida con sello | `POST` multipart al boleto de Portal | El boleto firmado que dio Portal | Foto o video de la cámara de Lilachat, sellado por el server | `server/src/stampedForward.ts` (`POST /api/stamped-forward`) |

- El token del mapa viaja en el cuerpo, nunca en el log. Solo se aceptan enlaces de
  `constroad.com` (`workMapRequest`). Espera 7 s.
- El enlace del servicio sale de `crear_enlace_de_servicio` (kind `service_link`).
- Boletos válidos (`isPortalUploadTicket`, `shared/src/driveUpload.ts`):
  `https://*.constroad.com/api/public/{service-drive-upload | observation-evidence-upload |
  additional-area-upload | site-visit-upload}/<boleto>`. El server exige que la persona
  esté en el chat.

### 3.3 Directo del cliente (web o APK) a Portal

| Qué | Destino | Archivo |
| --- | --- | --- |
| Subida sin sello (galería, documentos) | El boleto de Portal (`fetch` en la web, `subirPorXhr` en el APK) | `web|app/src/spaces/clients/useDriveUpload.ts` |
| Editor 2.0 de un informe | `iframe` a `https://www.constroad.com/embed/report/<id>#t=<token>` | `web/src/spaces/clients/reports/PortalEmbedWeb.tsx` |
| Croquis de una visita | `https://www.constroad.com/embed/site-visit/<id>?vista=croquis#t=<token>` | `web/src/spaces/visits/VisitCroquisWeb.tsx`, `app/src/spaces/visits/VisitCroquis.tsx` (WebView) |
| Abrir en el Portal | `service.url` del detalle o `portal_url` de una falla | `ServiceDetailWeb.tsx`, `ServiceDetailView.tsx`, `CreateReportDialog.tsx`, `CreateReportSheet.tsx` |
| Página del servicio en la sección mapa | `…/service/<id>?section=map` (`serviceMapPage`) | `shared/src/serviceMap.ts` |
| Ver archivos | PDF y fotos de `www.constroad.com` y `lila.constroad.com` | visores de la app |

**CSP de la web** (`server/src/cabecerasDeSeguridad.ts`): `connect-src` suma
`https://www.constroad.com`, `https://lila.constroad.com` y `https://constroad.com`
(subidas). `frame-src` suma `https://www.constroad.com` (`PORTAL_EMBED_ORIGINS`). En
desarrollo también `http://localhost:3000`.

## 4. Informes: qué crea cada superficie

| Superficie | Qué crea | Cómo |
| --- | --- | --- |
| **APK** | Solo los tipos de la página pública: CTL-IMP, IAA, CTL-PIS, CON-CAP, RCP-CAM, REG-OBS, LEV-OBS, FRE-PAV (SOL-IMP abre Portal) | Formulario por secciones propio, con cola sin señal |
| **PWA angosta** (< 1024 px) | Los mismos tipos, menos medir IAA | Igual que el APK |
| **Web ancha** (≥ 1024 px) | Los 8 tipos de campo y, si ve montos, las 9 hojas de bloques | Editor 2.0 de Portal embebido (`EMBED_CREATE_TYPES`) |

Fuentes: `REPORT_TYPE_OPTIONS`, `EDITOR_REPORT_TYPE_OPTIONS` (`shared/src/reportCreation.ts`),
`createsInEmbed`, `EMBED_MIN_WIDTH_PX = 1024` (`shared/src/portalEmbed.ts`).

**Abrir un informe existente.** Una fila con `editor: 'v2'` abre el editor en la web
ancha. En el APK y la PWA abre el formulario por secciones; una hoja de bloques abre
su ficha con el PDF y «Abrir en el Portal».

### 4.1 Editor 2.0 embebido (escritorio y tablet)

- **Pedido del enlace:** evento `client.report.embed.requested` {client_id, service_id,
  report_id, user} → herramienta `abrir_editor_de_informe`. Crear: `crear_informe_en_editor`.
- **Respuesta:** `{url, expires_at}`. Token por miembro y por pedido, 12 h, en el
  fragmento: no llega a logs ni Referer. Lo valida `embedLinkOf` contra los orígenes.
- **Rol:** lo firma Agentes (`space_role`); el evento no lo lleva.
- **Hoja de bloques:** `POST …/reports/embed` pide `need: 'money'` (`needsMoneyToCreate`).
- **Mensajes v1** (`postMessage`, solo del origen de Portal):
  - Portal → Lilachat: `portal-embed:ready`, `:dirty`, `:saved`, `:published`, `:closed`,
    `:error`, `edit-croquis`.
  - Lilachat → Portal: `portal-embed:close-request`, `:theme`, `croquis-changed`.
- **Tiempos:** «Abriendo el editor del Portal…» hasta `ready`; «Reintentar» a los 15 s;
  «Salir igual» a los 45 s si el guardado se traba.
- **«Editar croquis»** (16/11): Portal pide el mapa; Lilachat dibuja el mapa de obra
  encima del editor y al volver manda `croquis-changed`.
- **APK:** no tiene el editor de informes. Solo usa el puente en el WebView del croquis
  de la visita (`nativeEmbedEventOf`, `nativeEmbedCommand`).

## 5. Por módulo

### Mapa de obra

- Lectura: directo a Portal con el enlace del servicio (§3.2). El motor de sumas es
  `@constroad/shared/obra`, el mismo paquete que usa Portal.
- Escritura: por Agentes con las herramientas `*_de_obra` (ver `obra-mapa.md`).
- Sin señal: `entradaId` UUID; Portal responde `ya_marcada`.

### Visitas técnicas

- La puerta la decide el admin del espacio en Lilachat (`shortcut:visita_tecnica`).
- Lectura y escritura por Agentes (`visit.draft.requested`, `guardar_visita`,
  `marcar_punto_de_visita`, `subir_foto_de_visita`, `terminar_visita`, `pdf_de_visita`,
  `abrir_visita_en_editor`).
- Las fotos van al boleto `site-visit-upload` (con sello por `/api/stamped-forward`).
- La tarjeta lv01 la publica Agentes en el tema `informes` (`refs.visit_id`). Si Portal
  borra la visita, Agentes baja la tarjeta (`visita.deleted`).

### Observaciones (REG-OBS / LEV-OBS)

- `informe_de_observaciones`, `registrar_observacion` (con `precisionM` y
  `fuente: 'apk' | 'web'`), `levantar_observacion`. Interruptor `OBSERVATIONS_OPEN_HERE`.
- Evidencia al boleto `observation-evidence-upload`.

### Área adicional (IAA)

- `registrar_area_adicional` (`crear`, `editar`, `quitar`) con `geometria` opcional.
  Fotos al boleto `additional-area-upload` (en `data.upload`).

### Drive, antes y después

- `client.files.requested` lista; `subir_al_drive` abre el boleto `service-drive-upload`.
- `marcar_foto_antes_despues` (kind `photo_phase`) marca una foto desde el visor.

### Avisos (Portal → Lilachat)

- Portal no escribe en Lilachat. Agentes publica las tarjetas con la API de bots
  (`POST /api/bots/messages`, `PATCH`, `DELETE /api/bots/messages?idempotency_key=`).
- Tarjetas por tema: `informes` (informe publicado con su PDF, visita lv01), y las que
  Agentes decida. Una creación en el editor 2.0 no publica tarjeta (E2E 16/11).
- Canales de cliente y servicios: `PUT /api/bots/clients/:clientId` (incluye
  `services[].started_at` como día). Tareas de un pedido: `POST /api/bots/clients/:clientId/tasks`.
- «Enviar al grupo» (WhatsApp del cliente): la casilla `enviarAlGrupo` solo llega a un
  admin del espacio (`withoutGroupSend`). El envío lo hace Portal.

## 6. Diferencias APK vs web

| Tema | Web | APK |
| --- | --- | --- |
| Editor 2.0 | `iframe` con puente v1 (web ancha) | No existe |
| Croquis de visita | `iframe` | WebView en Modal |
| Subida con sello | `fetch('/api/stamped-forward')` | `subirPorXhr` a `/api/stamped-forward` |
| Mapa | `/api/service-work-map` | El mismo endpoint |

## 7. Historia reciente (03/11 – 17/11)

- **05–06/11** CTL-IMP y CTL-PIS por Agentes. La plata vive en Cuenta (`need: 'money'`).
- **06/11** Drive: subir fotos y videos al boleto de Portal.
- **07/11** Mapa: lectura directa con el enlace del servicio; escrituras `*_de_obra`.
  Enlace de un servicio sin cuenta de Portal.
- **11/11** Editor 2.0 embebido en la web. Observaciones encendidas.
- **12/11** En la web ancha un informe nuevo nace en el editor. Cámara con sello:
  `selloLilachat` y `/api/stamped-forward`. CON-CAP.
- **13/11** FRE-PAV y RCP-CAM. Documentos en el Drive (Portal 7822bc25).
- **14/11** Visita técnica por Agentes; croquis en el editor de Portal (web y APK).
- **15/11** IAA, FRE-PAV y RCP-CAM en el editor (web ancha). IAA se mide en el APK.
- **16/11** Hojas de bloques en la web ancha. «Reintentar» del editor; Portal sacó
  `/embed/*` de su service worker (ec9a18f0). «Editar croquis» sobre el editor.
  Geometría del IAA a Portal (30792e53).

## 8. Pendientes y deuda conocida

- **Las visitas técnicas de Portal ya tienen fotos por calle** (recurso
  `site-visit-<visitId>-<streetId>`, misma forma que el de un punto). Lilachat todavía no
  las muestra. Cambiar el texto de la herramienta requiere que José lo reapruebe.
  (Fuente: sesión de Portal, 17/11.)
- Cambiar la entrada de cualquier herramienta da 502 hasta que José la reaprueba en
  Agentes (pasó con `registrar_area_adicional` el 16/11).
- `client.files.requested` para un miembro sin cuenta de Portal: pedido el 07/11 a
  Agentes y Portal; no verificado si se cerró.
- «Ver PDF» de una tarjeta necesita `link.mime`: la URL del PDF de Portal no termina en
  `.pdf` (pedido 14/11).
- El miembro sin montos frente al editor 2.0: solo cubierto por tests (no hay sesión
  de un miembro no admin en Test).
- La visita en escritorio por `/embed/site-visit/[id]` completo: no verificado.
- Publicar un IAA desde Lilachat: Portal responde `unsupported` (según spec §20).

## 9. Pruebas

- **Server:** `workMapRoutes.test.ts`, `bots/clientFiles.test.ts` (404 de un canal ajeno,
  `need: 'money'`), `bots/clientReports.test.ts`, `bots/siteVisitDoor.test.ts`,
  `bots/areaForms.test.ts`, `bots/observationForms.test.ts`, `bots/workMapForms.test.ts`,
  `cabecerasDeSeguridad.test.ts`.
- **Shared:** `portalEmbed.test.ts`, `driveUpload.test.ts`, `serviceMap.test.ts`,
  `workMapPortalParity.test.ts`.
- **Web:** `PortalEmbedWeb.test.tsx`, `CreateReportDialog.test.tsx`, `ServiceDetailWeb.test.tsx`.
- **E2E:** manuales, en producción, espacio Test, documentados en los specs de cada módulo.
