# API de bots de Lilachat — contrato para agentes (Lila y Dali)

Versión 1 · 21/10/2026 · base `https://lilachat.constroad.com`

Acordado con la sesión «Agentes Lila y Dali». Agentes queda en el medio. El
Portal nunca llama a Lilachat: sus avisos salen por los «remitentes» de
agentes, y las acciones (pedidos, despachos, gastos) van por Lila → MCP →
Portal, con una tarjeta «¿Confirmas?» que confirma la misma persona.

Lilachat emite solo el token del bot. Agentes emite sus llaves `ag_` y los JWT
por llamada. El Portal no emite ninguna llave. El vínculo espacio ↔ empresa lo
guarda agentes, y se crea al instalar («Add to Slack»).

Todo el JSON va en `snake_case`. Las horas van en ISO 8601 UTC. Los teléfonos
van normalizados (`51` + 9 dígitos).

---

## 0. Alta de la app (una vez)

Un administrador de Lilachat registra la app con un script del servidor. La app
queda con:

| Campo | Ejemplo | Nota |
| --- | --- | --- |
| `client_id` | `lca_8f3k…` | público |
| `client_secret` | `lcx_…` | se muestra UNA vez; José lo carga en Torre para agentes |
| `name` | `Lila` | así aparece en los chats, con la marca «App» |
| `redirect_uris` | `https://agentes.constroad.com/lilachat/callback` | coincidencia EXACTA |
| `webhook_url` | `https://agentes.constroad.com/lilachat/events` | adonde llegan los eventos |

## 0-bis) Apps por manifiesto (0.1.157, como Slack)

José, 23/10: las apps de agentes son agnósticas, sin una llave en Torre por
cada una («como Slack con Bitbucket»). Agentes guarda UNA credencial de
Lilachat (la de Lila) y con ella crea el bot de cada producto. El secreto de
cada bot viaja en la respuesta, de servidor a servidor, y agentes lo guarda
sellado en su base: ninguna persona lo ve ni lo copia.

**Quién puede.** Las apps «desarrolladoras» son una constante del código
(`DEVELOPER_APP_CLIENT_IDS` en `server/src/bots/botApps.ts`; hoy, solo
Lila). Sumar otra es un cambio revisado, no un dato en la base. Auth:
`Authorization: Basic base64(client_id:client_secret)`. Una credencial mala
da 401 `invalid_client`; una app que no es desarrolladora, 403
`not_a_developer`. Diez credenciales malas por minuto desde una IP dan 429.

- `POST /api/bots/apps` con el manifiesto:

  ```json
  { "key": "inframaq", "name": "Inframaq", "avatar_url": "https://…",
    "redirect_uri": "https://agentes.constroad.com/canales/lilachat/vuelta",
    "webhook_url": "https://agentes.constroad.com/v1/channels/lilachat/events",
    "install_url": "https://agentes.constroad.com/canales/lilachat/instalar?app=inframaq",
    "commands": [ { "command": "clima", "description": "…", "usage_hint": "[mañana]" } ] }
  ```

  - Validaciones: `key` con `^[a-z][a-z0-9-]{1,31}$`; `name` hasta 40;
    las URL con https y hasta 500 (http solo a localhost, para desarrollo).
    `avatar_url`, `install_url` y `commands` son opcionales; sin
    `commands` no se tocan.
  - Idempotente por (desarrolladora, `key`): la primera vez, 201 `{
    client_id, client_secret }`; después, 200 `{ client_id }` con los
    campos al día y sin secreto.
  - Hasta 20 apps por desarrolladora (400 `too_many_apps`).
- `POST /api/bots/apps/{client_id}/secret` → `{ client_secret }`. Rota: el
  viejo deja de servir para el canje de OAuth. Las instalaciones y sus
  tokens siguen vivos.
- `GET /api/bots/apps` → `{ apps: [ { client_id, key, name, avatar_url?,
  redirect_uri, webhook_url, install_url?, commands, installations } ] }`,
  sin secretos.
- `DELETE /api/bots/apps/{client_id}` → 204. Antes avisa `app.uninstalled`
  (`by: null`) a cada instalación, como desinstalar desde Integraciones;
  después revoca todo y borra la app.
- Una app de otra desarrolladora da 404, nunca 403.
- Toda app con `install_url` sale en «Para instalar» de Integraciones de
  cualquier espacio (como en Slack). El instalador de agentes corta si el
  espacio no corresponde a una empresa suya.

## a) Instalación: OAuth 2.0 con código y PKCE

1. Agentes manda al administrador del espacio a:

   ```
   https://lilachat.constroad.com/instalar-app
     ?client_id=lca_…
     &redirect_uri=https://agentes.constroad.com/lilachat/callback
     &state=<aleatorio, ≥16 caracteres>
     &code_challenge=<BASE64URL(SHA256(code_verifier))>
     &code_challenge_method=S256
   ```

2. Lilachat pide ingresar (QR o código por WhatsApp) si hace falta. Muestra la
   app, lo que podrá hacer y un selector con los espacios donde la persona es
   dueña o admin.
3. Si **aprueba**, redirige a `redirect_uri?code=<código>&state=<el mismo>`.
   El código vale 10 minutos y una sola vez. Si **rechaza**, redirige a
   `redirect_uri?error=access_denied&state=…`.
4. Agentes canjea el código **de servidor a servidor**:

   ```http
   POST /api/oauth/token
   Content-Type: application/json

   { "grant_type": "authorization_code", "code": "…", "redirect_uri": "…",
     "client_id": "lca_…", "client_secret": "lcx_…", "code_verifier": "…" }
   ```

   ```json
   200 {
     "access_token": "lcb_…",
     "token_type": "Bearer",
     "installation_id": "6ad9…",
     "space": { "id": "6ad9…", "name": "CONSTROAD" },
     "bot_user_id": "6ad9…",
     "signing_secret": "lcs_…"
   }
   ```

   Errores (RFC 6749): `400 { "error": "invalid_grant" | "invalid_client" |
   "invalid_request" | "unsupported_grant_type", "error_description": "…" }`.

- Una instalación por app y espacio. Reinstalar reemplaza la anterior y su
  token deja de valer.
- El token no vence: se revoca. Lilachat guarda solo su SHA-256.
- **Revocar desde agentes:** `POST /api/oauth/revoke` con `Authorization:
  Bearer lcb_…` → `200 { "ok": true }`. Desde ahí, todo da 401.
- **Desinstalar desde Lilachat** (Ajustes del espacio → Integraciones): llega
  el evento `app.uninstalled` y el token muere.

## b) Salida: el bot escribe

Todas las llamadas van con `Authorization: Bearer lcb_…`. El bot solo ve su
espacio.

### `POST /api/bots/messages`

```json
{
  "channel_id": "6ad9…",            // o bien "user": { "phone": "51987654321" } | { "id": "…" }
  "text": "Pedido 1024 listo para despacho",
  "card": { … },                     // opcional, ver abajo
  "checklist": { … },                // opcional, ver abajo
  "thread_of": 42,                   // opcional: responde en el hilo de ese seq
  "idempotency_key": "pedido-1024-listo"
}
```

- Destino: **uno** de `channel_id` (un canal del espacio) o `user` (un 1:1 del
  bot con ese miembro del espacio; se crea la primera vez).
- Contenido: al menos uno de `text` (hasta 4000), `card` o `checklist`.
- `idempotency_key` es obligatorio (hasta 120). La misma clave en la misma
  instalación no publica dos veces: devuelve `200` con el mismo mensaje.
- `201 { "message": { "id": "…", "chat_id": "…", "seq": 57 } }`.
- Errores: `400 invalid_request`, `401 invalid_token`, `403 not_in_channel`
  (canal privado sin el bot), `404 channel_not_found | user_not_found`,
  `429 rate_limited` con `Retry-After` (60 por minuto por instalación).

**Tarjeta** (diseño `e-21`):

```json
{
  "kicker": "PORTAL · PEDIDOS",
  "title": "¿Confirmas el pedido 1024?",
  "status": { "label": "Por confirmar", "tone": "warn" },   // ok | warn | error | info | neutral
  "fields": [ { "label": "Cliente", "value": "Obra Miraflores" }, { "label": "m³", "value": "12" } ],
  "link": { "label": "Ver en Portal", "url": "https://…" },  // solo https
  "actions": [
    { "id": "confirm", "label": "Confirmar", "style": "primary", "value": "<opaco, hasta 2000>" },
    { "id": "cancel",  "label": "Cancelar",  "style": "danger",  "value": "<opaco>" }
  ]
}
```

Límites: título 120, kicker 60, hasta 12 campos (etiqueta 40, valor 120), hasta
3 acciones (`id` con `[a-z0-9_-]`, hasta 40; etiqueta 24). Lilachat no lee
`value`: se lo devuelve tal cual en `button.click`.

### `PATCH /api/bots/messages/:id`

`{ "text"?: "…", "card"?: { … } }` reemplaza el texto o la tarjeta de un
mensaje **de este bot**. Sirve para cerrar una tarjeta después del clic: sin
`actions` y con el estado «Confirmado por José». Responde `200 { "message":
{ … } }`.

**Checklist:**

```json
{ "title": "Despacho 1024", "others_can_mark": false,
  "items": [ { "text": "Cargar tolva", "assignee_phone": "51987654321", "due_at": "2026-10-22T13:00:00Z" } ] }
```

El responsable se busca por teléfono entre los miembros activos del espacio. Si
no está: `400 { "error": "assignee_not_member", "phone": "51…" }`. Una tarea
con responsable solo la marca esa persona o el bot (regla de la §86).

## c) Entrada: eventos firmados hacia agentes

Lilachat hace `POST webhook_url` con:

| Cabecera | Valor |
| --- | --- |
| `X-Lilachat-Event` | `message.created` · `button.click` · `checklist.item.toggled` · `app.uninstalled` · `command.invoked` |
| `X-Lilachat-Delivery` | uuid; **el mismo en los reintentos** (para deduplicar) |
| `X-Lilachat-Installation` | el `installation_id`: con él se busca el `signing_secret` antes de leer el cuerpo |
| `X-Lilachat-Timestamp` | milisegundos |
| `X-Lilachat-Signature` | `v1=<hex de HMAC-SHA256(signing_secret, "<timestamp>.<cuerpo crudo>")>` |

- La firma es **por instalación** (`signing_secret` del canje). Agentes debe
  rechazar firmas que no coinciden y timestamps de más de 5 minutos.
- Hay que responder 2xx en menos de 10 s. Si no, se reintenta a los 10 s, 1
  min, 5 min y 30 min, y después se descarta. Integraciones muestra la última
  falla.

Cuerpo:

```json
{ "event_id": "<= X-Lilachat-Delivery>", "type": "message.created",
  "installation_id": "…", "space_id": "…", "created_at": "…", "data": { … } }
```

- **`message.created`**: los mensajes de un 1:1 con el bot, y los de un canal o
  grupo donde está el bot que lo mencionan (`@Lila`). Nunca los del propio
  bot.
  `data: { channel: { id, kind: "channel" | "group" | "direct", name? },
  message: { id, seq, text, thread_of?, mentions_bot }, author: { id, name,
  phone } }`
- **`button.click`**: alguien tocó una acción de una tarjeta del bot.
  `data: { message: { id, seq }, channel: { id }, action: { id, value }, user:
  { id, name, phone } }`. Agentes valida que `user.phone` sea quien pidió la
  acción.
- **`checklist.item.toggled`**: en un checklist creado por el bot.
  `data: { checklist: { id, title, message_id }, item: { id, text, done,
  assignee_phone? }, user: { id, name, phone } }`.
- **`app.uninstalled`**: `data: { by: { id, name, phone } }`.
- **`command.invoked`**: alguien usó un comando «/» de la app (§c-bis). Va UNA
  vez, sin reintentos, y se espera la respuesta en el cuerpo.

## c-bis) Comandos «/» (0.1.157, como Slack)

Cerrado con agentes el 23/10/2026. Cada app tiene su lista; sale en los chats
de los espacios donde está instalada, agrupada por app.

**Registro, a nivel de app.** `PUT /api/bots/commands` con el Bearer de
cualquier instalación de la app. Reemplaza la lista entera (idempotente;
`[]` la borra). `GET` la misma ruta para leerla.

```json
{ "commands": [ { "command": "clima", "description": "Clima de hoy en la planta", "usage_hint": "[distrito]" } ] }
```

- Hasta 25 comandos. `command` en minúsculas, sin «/» ni espacios
  (`^[a-z][a-z0-9_-]{1,31}$`). `description` hasta 100. `usage_hint`
  opcional, hasta 60 (se muestra como «Ejemplo de uso»).
- Responde `{ commands: [...] }`; una lista mal formada, 400
  `invalid_request`.
- Más adelante se suma `form` opcional (§73.5 del spec general) sin romper
  esto.

**Invocación.** Al enviar «/clima lurin», Lilachat manda `command.invoked`
firmado como los demás eventos:

`data: { command_id, command: "clima", text: "lurin", channel: { id, kind,
name? }, user: { id, name, phone } }`

`text` es lo que va después del comando, crudo: los argumentos los parsea
la app.

**Respuesta en el cuerpo (≤ 3 s).** 200 con:

```json
{ "response_type": "ephemeral" | "in_channel", "text": "…", "card": { …el kit de tarjetas… } }
```

- `ephemeral` (lo que se asume si falta o no se reconoce): solo lo ve quien lo
  pidió, con «Solo tú ves esto». **No se guarda**: se va al cerrar el chat. Las
  acciones de una tarjeta efímera no se pueden tocar (no hay mensaje).
- `in_channel`: se publica en el chat como mensaje de la app (en un canal
  público entra sola, como siempre). En un canal privado sin la app o en un
  1:1 entre personas, cae a efímera.
- 200 con cuerpo vacío, o pasar de 3 s: queda «pendiente» y la persona ve
  «<App> está trabajando…».
- 4xx/5xx o un cuerpo que no se puede mostrar: la persona ve «<App> no pudo
  responder». Integraciones registra la falla (un timeout no cuenta como
  falla).

**Respuesta diferida.** `POST /api/bots/commands/{command_id}/respond`, mismo
cuerpo, con el Bearer de la misma instalación:

- Hasta 5 respuestas en los 15 minutos siguientes al comando.
- Después: 410 `command_expired`. La sexta: 409 `too_many_responses`. Un
  comando de otra app: 404 `command_not_found`.
- Responde `{ response_type }`. La efímera llega por socket
  (`command.response`) solo a los equipos de quien lo pidió.

**Del lado de Lilachat.**
- `GET /api/workspaces/:id/commands` → `{ groups: [ { appId, appName,
  commands } ] }`. Lo pide el compositor una vez por espacio, al escribir «/».
- `POST /api/chats/:chatId/commands { app_id, command, text }` → `{ commandId,
  appId, appName, outcome: "ephemeral" | "posted" | "pending" | "failed",
  response?, message? }`. Hasta 20 comandos por minuto por persona.
- Los usos viven en `botcommandruns` (se leen por `_id`; los vencidos se
  borran en cada uso nuevo, sin índice propio).

## d) Lectura

- `GET /api/bots/me` → `{ installation_id, space: { id, name }, bot_user_id }`.
- `GET /api/bots/channels` → `{ channels: [ { id, name, visibility: "public" |
  "private", is_member } ] }`.
- `GET /api/bots/members` → `{ members: [ { id, name, phone, role: "owner" |
  "admin" | "member" | "guest", title?, area? } ] }`. Solo los activos.

El bot entra solo a todos los canales públicos al instalarse, y a cada canal
público nuevo. A uno privado entra si lo agregan.

## Estado (21/10/2026)

- Servidor: a–e (`server/src/bots/`). Hay 19 tests de punta a punta con un
  webhook HTTP real, y el fake tiene 4 de paridad.
- Interfaz (0.1.131):
  - la pantalla de consentimiento `/instalar-app` en la web (también para
    quien entra sin sesión);
  - la tarjeta con botones en la app y la web;
  - el cierre de la tarjeta en vivo (`msg.edited` trae la tarjeta);
  - la marca «App» junto al nombre del bot, y sin llamadas en su 1:1;
  - Integraciones en Ajustes del espacio, con la última falla de entrega y
    «Desinstalar».
- Producción: «Lila» registrada (`lca_lnkjg6KXzr_GBiF-YG3V`) y sus índices
  creados. Falta que José cargue el `client_secret` en Torre.

## e) Fake para la CI de agentes

`tools/bots-fake/lilachat-bots-fake.mjs`: un archivo, Node ≥ 18, sin
dependencias. Implementa el mismo contrato en memoria:

- `/instalar-app` aprueba solo y redirige con el código.
- `oauth/token`, `oauth/revoke`, `bots/me`, `bots/channels`, `bots/members` y
  `bots/messages` (POST y PATCH) se comportan igual.
- Control para las pruebas:
  - `POST /__fake/emit { type, data }` firma y manda un evento al
    `WEBHOOK_URL`, con los mismos reintentos.
  - `/api/bots/apps` (POST, GET, `/secret`, DELETE) con Basic del cliente
    del fake, que hace de desarrolladora; las apps creadas se instalan con
    `/instalar-app` y su propio secreto.
  - `POST /__fake/command { command, text, user?, channel? }` hace de
    persona: manda `command.invoked`, espera 3 s y devuelve `{ command_id,
    outcome }`. `GET /__fake/command-responses` lista lo que la app respondió
    (en el cuerpo o por `/respond`). `PUT`/`GET /api/bots/commands` y
    `/respond` siguen las mismas reglas que el server.
  - `GET /__fake/messages` devuelve lo que publicó el bot.
  - `POST /__fake/reset` vuelve a empezar.

Se configura por entorno: `PORT`, `CLIENT_ID`, `CLIENT_SECRET`, `REDIRECT_URI`,
`WEBHOOK_URL`, y opcionalmente `SPACE_NAME`, `CHANNELS` y `MEMBERS` (JSON). La
misma batería de pruebas de contrato corre contra el fake y contra el server
real, así no se separan.
