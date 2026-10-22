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
| `X-Lilachat-Event` | `message.created` · `button.click` · `checklist.item.toggled` · `app.uninstalled` |
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

## d) Lectura

- `GET /api/bots/me` → `{ installation_id, space: { id, name }, bot_user_id }`.
- `GET /api/bots/channels` → `{ channels: [ { id, name, visibility: "public" |
  "private", is_member } ] }`.
- `GET /api/bots/members` → `{ members: [ { id, name, phone, role: "owner" |
  "admin" | "member" | "guest", title?, area? } ] }`. Solo los activos.

El bot entra solo a todos los canales públicos al instalarse, y a cada canal
público nuevo. A uno privado entra si lo agregan.

## Estado (21/10/2026)

- Servidor: a–e implementado (`server/src/bots/`, 19 tests de punta a punta con un webhook HTTP real; el fake con 4 de paridad).
- Falta: la pantalla de consentimiento (`/instalar-app` en la web), la tarjeta con botones en la app y la web, la marca «App» y la pantalla Integraciones.
- Producción: registrar «Lila» (`scripts/bot-app-register.ts`) y crear los índices (`scripts/bot-indexes.ts`), con el OK de José. El `client_secret` sale a un archivo privado; José lo carga en Torre.

## e) Fake para la CI de agentes

`tools/bots-fake/lilachat-bots-fake.mjs`: un archivo, Node ≥ 18, sin
dependencias. Implementa el mismo contrato en memoria:

- `/instalar-app` aprueba solo y redirige con el código.
- `oauth/token`, `oauth/revoke`, `bots/me`, `bots/channels`, `bots/members` y
  `bots/messages` (POST y PATCH) se comportan igual.
- Control para las pruebas:
  - `POST /__fake/emit { type, data }` firma y manda un evento al
    `WEBHOOK_URL`, con los mismos reintentos.
  - `GET /__fake/messages` devuelve lo que publicó el bot.
  - `POST /__fake/reset` vuelve a empezar.

Se configura por entorno: `PORT`, `CLIENT_ID`, `CLIENT_SECRET`, `REDIRECT_URI`,
`WEBHOOK_URL`, y opcionalmente `SPACE_NAME`, `CHANNELS` y `MEMBERS` (JSON). La
misma batería de pruebas de contrato corre contra el fake y contra el server
real, así no se separan.
