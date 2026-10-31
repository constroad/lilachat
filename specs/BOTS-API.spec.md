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
  - Para el directorio de apps del espacio (0.1.158, §122 de
    ARCHITECTURE): `description` (una línea, hasta 120), `features` («Qué
    hace», hasta 6 frases de hasta 140), `developer` (hasta 60, p. ej.
    «Agentes ConstRoad») y `category` (`operacion` · `personas` ·
    `finanzas` · `laboratorio` · `otra`). Todos opcionales. Lo que se pasa
    de largo se recorta y una categoría desconocida se ignora: nunca
    rechazan el manifiesto.
  - Idempotente por (desarrolladora, `key`): la primera vez, 201 `{
    client_id, client_secret }`; después, 200 `{ client_id }` con los
    campos al día y sin secreto.
  - El nombre y el logo (`avatar_url`) también llegan a los usuarios-bot ya
    instalados en cada espacio (0.1.169; Portal salía con la «P» porque
    conservaba el SVG con que se instaló, que la app no dibuja). Un
    manifiesto sin `avatar_url` no borra el logo que ya tienen. Mandar PNG.
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
  cualquier espacio (como en Slack), salvo que agentes la limite (§0-ter). El
  instalador de agentes corta si el espacio no corresponde a una empresa suya.

## 0-ter) En qué espacios se puede instalar cada app (0.1.159)

José, 23/10: desde la consola de agentes quiere decidir, espacio por espacio,
qué apps se pueden instalar. Por ejemplo, en INFRAMAQ, Inframaq y Pulso, y
Portal no. Las dos rutas usan la credencial de desarrolladora de §0-bis.

- `GET /api/bots/spaces?admin=<correo o celular>` → `{ spaces: [{ id, name,
  members, role: "owner" | "admin", installed: ["<key>"…] }] }`.
  - Los espacios donde esa cuenta es dueña o admin. Agentes manda la cuenta
    con la que entró a su consola, nunca otra.
  - El correo cuenta solo si la persona lo verificó en Lilachat. El celular
    acepta cualquier forma (`902049935`, `51902049935`, `+51 902 049 935`).
  - Una cuenta que no existe da `{ spaces: [] }`. Algo que no es correo ni
    celular da 400 `invalid_request`.
  - `installed` lista solo las apps de ESA desarrolladora, por `key`.
- `GET` y `PUT` en `/api/bots/apps/by-key/{key}/availability` (o
  `/api/bots/apps/{client_id}/availability`):
  - `{ "everywhere": true }` (lo que tiene toda app que nunca recibió una
    lista) o `{ "spaces": ["<id>", …] }`, hasta 500. Una lista vacía = en
    ningún espacio.
  - Un id que no existe da 400 `unknown_space`; un cuerpo sin esas formas,
    400 `invalid_request`; la app de otra desarrolladora, 404
    `app_not_found`.
  - Efecto: el directorio del espacio (§122 de ARCHITECTURE) y «Para
    instalar» de Integraciones no muestran la app donde no está disponible,
    salvo que YA esté instalada ahí: sacarla de la lista no la desinstala.
    La página de consentimiento solo ofrece los espacios disponibles, y
    `POST /api/oauth/authorize` en otro espacio responde 403
    `app_not_available`.

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
| `X-Lilachat-Event` | `message.created` · `message.edited` · `message.deleted` · `button.click` · `checklist.item.toggled` · `app.uninstalled` · `command.invoked` |
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
  grupo donde está el bot que lo mencionan (`@Lila`), o todos con
  `channels:history` (§c-novendecies). Nunca los del propio bot. Con un archivo,
  `message.files`.
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
- La respuesta puede ser un formulario (§c-ter).

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

## c-ter) Formularios, acciones del «+» y el ⚡ (0.1.160)

Cerrado con agentes el 23/10/2026. Diseños e-28 (formulario), e-29 (el «+»
de un canal) y e-30 (el ⚡ del espacio).

**Formulario.** Cualquier respuesta (a un comando, a una acción o a
`/respond`) puede ser `{ "response_type": "form", "form": { "id", "title",
"submit_label"?, "schema" } }`. `schema` es un JSON Schema de objeto: `enum`
(con `x-labels`) es una opción, hasta 4 lado a lado; `x-input: photo` una
foto; `x-input: location` la ubicación `{ lat, lng, precision }`; `x-unit` la
unidad de un número; `maxLength > 120` o `x-input: textarea` varias líneas;
`format: date | time | date-time` un selector (nunca un campo de texto): el
día, la hora o ambos. Hasta 20 campos.
- La foto sube a Lilachat al elegirla. La app recibe una URL firmada
  `https://lilachat.constroad.com/api/bots/files/<payload>.<firma>`, válida 15
  minutos (después 410).
- Enviar es la confirmación de la persona. Llega `form.submitted { form_id,
  command_id, values, channel, user }`. La app responde como a un comando, o
  con `{ "errors": { "campo": "…", "_": "…" } }` y el formulario queda abierto
  con esos errores.
- **Responder «después» también llega en la misma llamada** (25/10/2026,
  agentes: «No se pudo confirmar» de una firma que sí se registró). Si la app
  solo confirma la recepción (200 vacío o `{}`) y contesta por
  `POST /api/bots/commands/{id}/respond`, Lilachat espera esa respuesta hasta 8
  segundos con la llamada de la persona abierta y se la devuelve en ella: un
  `/respond` que llega ANTES de que vuelva el acuse del webhook también cuenta.
  Pasados los 8 segundos la persona ve «Enviando…» y la respuesta le llega por
  el socket, como antes. Nada cambia para la app: sigue respondiendo por
  `/respond` (15 minutos, hasta 5 veces).
- `shareable: false` en cualquier respuesta: nadie la manda al canal (409 si
  se intenta).
- `x-visible-if: { "campo": ["valor", …] }` en una propiedad (0.1.161): el
  campo solo aparece, y solo se valida, cuando ese otro campo vale uno de esos
  valores. Ejemplo: `actividades` con `{ "accion": ["salida"] }`. Lo oculto no
  viaja en `values`.
- Un `enum` sin `x-labels` se muestra con la primera letra en mayúscula
  («Ingreso»); el valor que viaja es el del `enum`.
- **Fechas y horas** (0.1.169; José, 24/10: «la fecha por defecto en la fecha
  actual y un selector, no un input»). Llegan siempre como `AAAA-MM-DD`
  (`date`), `HH:MM` en 24 h con cero adelante (`time`, «07:30», nunca
  «7:30» ni «07:30 a. m.») y `AAAA-MM-DDTHH:MM` con el reloj del teléfono y sin
  zona (`date-time`). Una fecha arranca en **hoy** y un `date-time` en
  **ahora**, aunque el campo sea opcional; una hora arranca vacía (es una
  decisión). Un `default` válido del mismo tipo manda sobre «hoy»; uno que no
  lo es se ignora. Lo que no es una fecha que existe («2026-02-30») o una
  hora de 24 h da «La fecha no es válida» / «La hora no es válida» en el
  campo. Lilachat de antes de la 0.1.169 mandaba `AAAA-MM-DD HH:MM` con un
  espacio: se acepta y se vuelve `T`.
- **Cómo se dibuja un `enum`** (0.1.169): lado a lado mientras quepa (hasta 4
  y el nombre más largo × la cantidad ≤ 40 letras; «Refrigerio» × 4 cabe),
  lista de filas de 5 a 8 opciones cortas, y **desplegable** para una lista de
  registros (valores que son ids de base de datos: transportistas, canteras,
  plantas), para nombres largos (diseños de mezcla) y para más de 8, que
  además lleva buscador. Un desplegable de 8 o menos abre sin buscador.
- Una respuesta de rechazo («no se responde en un grupo», «esa acción ya se
  decidió») va con `shareable: false`: Lilachat no puede saber qué respuesta
  es un rechazo, y sin eso ofrece «Enviar al canal» sobre un error.

**Acciones.** El manifiesto declara `shortcuts: [{ key, name, description? }]`
(hasta 10; nombre ≤ 40, descripción ≤ 80). Un manifiesto sin ellas las borra.
Al tocar una llega `shortcut.invoked { shortcut, command_id, channel, user }`
y se responde igual que a un comando (casi siempre con su formulario).
- Desde el «+» de un canal: `channel` es ese canal.
- Desde el ⚡ de la cabecera del espacio: `channel: null`, como los atajos
  globales de Slack. Una respuesta `in_channel` sin canal se muestra solo a
  quien la pidió.

**Del lado de Lilachat.** `POST /api/chats/:chatId/shortcuts` y `POST
/api/workspaces/:id/shortcuts` (`{ app_id, shortcut }`); un comando global
desde el ⚡ va por `POST /api/workspaces/:id/commands`. La foto y el envío:
`…/commands/:commandId/files` y `…/commands/:commandId/form`, con el mismo
prefijo. La respuesta tardía de un uso del ⚡ llega por socket con
`workspaceId` en vez de `chatId`.

## c-quater) Temas de aviso: el admin elige el canal (0.1.160)

- El manifiesto declara `notice_topics: [{ key, name, description?, icon? }]`
  (hasta 10). `icon`: `attendance | tank | material | truck | weather | cash |
  document | alert`; otro valor se ignora y se dibuja una campana.
- El admin elige un canal por tema en el detalle de la app, «¿Dónde llega cada
  aviso?» (e-31). Un tema sin tocar va a #general (o al canal público más
  viejo). «Sin canal» = no se publica. Un canal privado elegido suma la app
  como miembro.
- `"default": null` en un tema (agentes, 24/10: la planilla lleva montos) lo
  hace nacer en «Sin canal»: nunca se publica hasta que un admin elige uno, y
  si el canal elegido se borra vuelve a «Sin canal», no a #general. La
  pantalla dice «Datos sensibles: elige un canal privado» mientras no tiene, y
  «Es un canal abierto: mejor uno privado» si eligen uno público. El 409 dice
  «espera a que un admin elija un canal privado».
- La app publica con `"topic": "asistencia"` en vez de `channel_id`. Si el
  tema está sin canal: 409 `topic_without_channel` (no es una falla, no se
  reintenta). Un tema que el manifiesto no declara: 404 `topic_not_found`.
  Los hilos y los PATCH siguen con el `channel_id` y el mensaje que devolvió
  la publicación.
- `GET /api/bots/topics` → `{ topics: [{ key, name, channel: { id, name } |
  null }] }`. `PUT /api/bots/topics { "asistencia": "<id>" | null, … }` es
  parcial: lo que no se manda queda como estaba.
- Personas: `GET/PUT /api/workspaces/:id/apps/:appId/topics` (cambiar, solo
  admins) y `POST …/topics/test` («Probar envío»: una línea por canal).

## c-quinquies) Qué comando o acción funciona dónde (0.1.160)

José, 23/10: «solo algunos van a ser globales». Por cada comando y acción de
una app instalada, el admin decide `{ global, channels }`: si sale en el ⚡ y
en qué canales funciona (`"all"`, `"none"` o una lista). Sin tocar, una acción
es global y un comando no; los dos funcionan en todos los canales.
- `GET /api/workspaces/:id/commands?chat=<id>` y `?place=space` devuelven
  solo lo habilitado en ese lugar (sin parámetro, todo: clientes viejos).
- Invocar algo apagado en ese lugar: 404 `not_enabled_here`. El 1:1 con la
  app ofrece todo.
- `GET/PUT /api/workspaces/:id/apps/:appId/items { items: { "command:clima":
  { global, channels } } }`, parcial; cambiar es de admins. Al guardar se
  avisa `workspace.apps.changed` y las listas se releen.

## c-sexies) Lo que cambió en 0.1.161

- **Sacar la app de un canal.** Un admin la quita desde los miembros, o desde
  Ajustes del detalle de la app (28/10, §151: `GET /api/workspaces/:id/apps/:appId/channels`
  lista dónde está y el interruptor usa las mismas rutas de miembros). Desde
  ahí la API responde 403 en ese canal (publicar, hilos), y la app no vuelve
  sola si el canal pasa a público. Vuelve cuando un admin la agrega, o la elige
  como canal de un tema de aviso.
- **Enlaces de vuelta:** `/s/{space}/apps/{client_id}` abre el detalle de la
  app; con `/chat` al final, su 1:1 (para «Pregúntalo en privado»).
  Instalada, el directorio trae `installUrl` para «Reinstalar».
- **Por qué falló un comando:** cada corrida guarda `failure { at, error }`
  («HTTP 500», «timeout» no cuenta, o el campo inválido del cuerpo) y se
  guarda una semana. Si la app contesta por `/respond` antes de que vuelva su
  webhook, la persona ve esa respuesta: el resultado tardío del webhook no la
  tapa.

- **Una app que se está desplegando** (502, 503, 504 o la conexión
  rechazada): `command.invoked`, `shortcut.invoked` y `form.submitted` se
  reintentan UNA vez a los ~1,2 s con el MISMO `X-Lilachat-Delivery`, dentro
  de la misma espera de 3 s. La app deduplica por entrega. Si sigue caída, la
  persona lee «<App> se está actualizando: vuelve a intentarlo en unos
  segundos.». Un 500 sigue siendo «no pudo responder».

## c-septies) Firmar (0.1.163)

- Un formulario con un campo `x-input: location` y uno `x-input: photo` es una
  firma: la foto es una selfie en vivo, tomada al tocar el botón. No cambia el
  schema.
- La ubicación de una firma llega con `age` (ms). Lilachat ya rechazó la que
  tenía más de 2 min o no traía `age`, así que la app la puede usar como
  ubicación del momento.
- La foto llega con la marca de agua ya estampada: hora del servidor de
  Lilachat (Lima) y «lat, lng · ± m».
- `/respond` con `{ "errors": { … } }` mientras el formulario espera respuesta
  lo vuelve a abrir con esos errores. Si ya se cerró: 409 `form_closed`.
- Tanque: `status` (hasta 24 caracteres, en palabras) además de `tone`; el %
  lo calcula Lilachat de `level`.

## c-octies) Permisos (scopes) y quién instaló (0.1.165)

- El manifiesto puede pedir `scopes: ["users:read.email"]`. La instalación
  guarda lo que el admin aceptó (`grantedScopes`). Si un manifiesto nuevo pide
  más, la app sigue funcionando con lo aceptado, y el detalle le muestra al
  admin «Esta app pide permisos nuevos» con «Reinstalar», que lleva a tu
  `install_url` sin desinstalar.
- Con `users:read.email` aceptado, `user` de `command.invoked`,
  `shortcut.invoked` y `form.submitted` trae `email`: el correo verificado, o
  `null` si la persona no lo verificó. Sin el scope, el campo no viene.
- El canje del código (`POST /api/oauth/token`) devuelve además
  `installed_by: { id, name, phone, email? }`: quien aceptó la instalación, con
  la sesión de Lilachat que vio la pantalla de consentimiento.

## c-novies) «Tu cuenta en <app>»: Conectado como / Desconectar (0.1.165)

La cuenta que una persona conecta es por app, como en Slack (agentes f02cb99).
El detalle de cada app instalada (y la pestaña «Información» de su 1:1)
muestra «Tu cuenta en <app>». Lilachat no guarda nada: cada vez le pregunta a
la app de ESA instalación, por su webhook y con la firma de `command.invoked`.
- `link.status { user: { id } }` → `{ linked: true, label: "j•••@…" }` o
  `{ linked: false }`. Cualquier otra respuesta, un error o más de 5 s
  esconden la fila.
- `link.revoke { user: { id } }` → `{ ok: true }`. Sin eso, la persona ve «La
  app no confirmó la desconexión» y sigue conectada.
- Personas: `GET` y `DELETE /api/workspaces/:id/apps/:appId/link` (cualquier
  miembro, solo su propia cuenta).
- Sin conectar dice «<app> te lo pide la primera vez que la usas»: conectar
  sigue siendo el formulario «Conecta tu cuenta» que trae el rechazo de la app.

## c-vicies) Comandos y horarios (28/10/2026, servidor + OTA + web)

Contrato de agentes: `specs/COMANDOS-Y-HORARIOS.spec.md` (7fb04a5), diseños d-01, d-02 y d-03.

**Ajuste v2 de cada comando y acción** (`shared/src/appItems.ts`): `{ global, channels, direct, who }`.
`direct` = el 1:1 de la persona con la app (ya no lo abre todo: se quitó el atajo `isOwnChat`).
`who` = `{ kind: 'admins' }` · `{ kind: 'everyone' }` · `{ kind: 'people', userIds }` (solo miembros
activos del espacio; los admins siempre pueden). `PUT …/apps/:appId/items` sigue siendo un mapa parcial.

**Todo apagado, con migración.** Una instalación nueva nace con `itemsV2: true` y todo apagado. Las de
antes siguen con los valores de antes (acciones en el ⚡, todos los canales, el 1:1 abierto, cualquiera)
hasta correr `scripts/migrate-items-all-off.ts --apply`, que escribe todo apagado y marca `itemsV2`.
Ese paso escribe producción: **solo con el OK de José**. Así el deploy no apaga nada por sí solo.

**Control al invocar.** `POST …/commands` y `…/shortcuts` revisan lugar y persona en el servidor (un
cliente viejo o una llamada directa se saltan el menú): `403 { error: 'not_allowed_here' }` con «No
tienes permiso para usar /x aquí. Pídeselo a un admin del espacio.».

**Manifiesto.**
- `commands[].schedulable: true`: es una consulta y se puede programar. `shareable: false`: tiene montos
  y solo se programa en el 1:1 del que lo crea.
- `suggested_schedules: [{ command, text, time: 'HH:mm', repeat: { weekdays: [1..6] } | { every: 1 }, only_if_something }]`
  (hasta 10, solo de comandos `schedulable`; lo que no encaja se descarta sin rechazar el manifiesto).
  Lilachat los ofrece al admin con «Crear»; nada corre hasta que un admin lo acepta y elige dónde.
- `notice_topics[].offer: 'chosen'`: el tema no existe para una instalación hasta que la app se lo ofrece.

**Horarios** (rutas de persona, colección propia `AppSchedule`):
- `GET /api/workspaces/:id/apps/:appId/schedules` → `{ schedules, suggested, canEdit }` (cualquier miembro).
- `POST` mismo path `{ command, text, time, repeat, chat_id: '<canal>' | 'direct', only_if_something }` → `201 { schedule }`.
  `PATCH …/:scheduleId { active }` y `DELETE …/:scheduleId`. Solo dueño o admin (403).
- Hasta 30 por app. El canal debe tener al creador y a la app (409 «X no está en #canal: agrégala en Ajustes.»).
- **Por qué no es un recordatorio**: un recordatorio suena en el teléfono de todos y sale en la agenda;
  un horario solo publica lo que la app responde. Usa la misma repetición (`nextRepeat`) y el mismo tick
  de `reminderCron`. El cron toma el turno moviendo `nextRunAt` con un update condicional: dos ticks no
  corren el mismo turno.

**Al correr**: corre COMO el creador (su cuenta en la app, su permiso en Lilachat, revisados otra vez).
`command.invoked` lleva `trigger: 'schedule'`, `schedule_id` y `scheduled_for` (ISO); el reintento del mismo
envío conserva el `event_id`.
- `in_channel` se publica en el canal (o en el 1:1), una vez por turno (`idempotency_key schedule:<id>:<iso>`).
- `ephemeral` (un error, «conecta tu cuenta») va solo al creador, en su 1:1 con la app.
- `nothing_to_report: true` con «Solo si hay algo» → no se publica nada.
- Un formulario no se programa: falla y se avisa al creador.
- Más de 30 minutos tarde (Lilachat caído) → no corre y se le dice al creador por qué.
- Lo que no corrió queda en `lastRun` y la lista dice «No corrió el 27/10: la app no respondió».

**Temas ofrecidos por instalación** (token del bot):
- `POST /api/bots/topics/offer { topic }` y `POST /api/bots/topics/withdraw { topic }` → `{ topics }`.
  Guarda `offeredTopics` en la instalación; repetirlo no hace daño. 404 `topic_not_found` si el manifiesto no
  lo declara; 400 si el tema no es `offer: 'chosen'`.
- Publicar con `topic` a uno no ofrecido → **409 `topic_not_offered`**. `GET /api/bots/topics`, los avisos
  del admin y «Probar envío» solo muestran los ofrecidos.

## c-novendecies) Escuchar el canal, ediciones, borrados y archivos (28/10/2026, solo servidor)

Para el pedido conversacional (pendiente 87) y los vouchers (pendiente 90).

- **`scopes: ["channels:history"]`** en el manifiesto. Al instalar, el admin lee «Leer los
  mensajes de los canales y grupos donde está, aunque no la mencionen». Con el permiso
  aceptado, `message.created` llega por TODO mensaje de los canales y grupos donde la app es
  miembro, con `mentions_bot: false` cuando no la nombran. Una instalación vieja sigue sin él
  hasta que un admin toque «Reinstalar» (§c-octies).
- **`message.edited`**: `data: { channel, message: { id, seq, text, thread_of?, mentions_bot,
  previous_text? }, author }`. Llega si la app escucha el texto nuevo o escuchó el original.
  `previous_text` viene solo si escuchó el original.
- **`message.deleted`**: `data: { channel, message: { id, seq, thread_of? }, by: { id, name,
  phone } }`. Solo si la app lo escuchó. No trae el texto: ya no existe.
- **Archivos en `message.created`**: `message.files: [{ url, mime, name, size? }]` para fotos,
  documentos y notas de voz (no stickers ni videos). `text` puede venir vacío: una foto sin
  texto también llega. La `url` es `https://lilachat.constroad.com/api/bots/files/<token>`,
  vale 15 minutos y responde 410 al vencer y 404 si el mensaje se borró. Bajarlo al llegar.
- Responder en el hilo del mensaje sigue igual: `thread_of` en `POST /api/bots/messages`.

## c-octodecies) Fotos: una sola regla, la de Portal (28/10/2026, servidor + OTA + web)

José, 28/10: «debe ser integral para todos los lados donde se suben las fotos sin
comprometer la calidad». La regla es la de Portal (`optimizeBrowserImageFile`, 7727ee59)
y vive una sola vez en `shared/src/photoSizing.ts`:
- **Menos de 1 MB: no se toca.** Tampoco un GIF, un SVG, un ícono ni un video. «HD» en
  el chat manda la original.
- **1 MB o más:** lado largo hasta 1600 px y JPEG 0,78; si pasa de 1 MB, la calidad baja
  de 0,08 en 0,08 hasta 0,50; si aún no entra, el lado ×0,82 hasta 1000 px (5 pasadas
  como máximo).
- Un PNG con transparencia real queda PNG y solo cambia de tamaño. Lo que pasa a JPEG
  desde una fuente transparente lleva fondo blanco, nunca negro.
- Si el resultado no pesa menos, o algo falla, sube la original.
- La foto se toma a resolución nativa (`quality: 1`) y se comprime una sola vez.

Qué recibe la app: las fotos de un formulario (cámara, galería y selfie) y la selfie
sellada siguen esta regla. El servidor la aplica también como red de seguridad a lo que
llega con 1 MB o más (APK viejas, web sin canvas). La selfie sellada siempre se vuelve a
codificar con la misma escalera. Antes era 1280 px y JPEG 80: ahora una foto de
formulario no queda peor que una del chat.

## c-octodecies) Formularios vivos: varias opciones, miniaturas, filas fijas, refresco y resumen (30/10/2026, servidor + OTA + web)

Contrato cerrado con agentes (2483da7 y 44b0a77) para el consumo de combustible de
Wilson. Agentes resuelve `x-options` del producto a lo que Lilachat dibuja. Diseños
`h-01`…`h-04` en `design/stitch/INVENTARIO.md`. Un formulario que usa algo de esto pide
`forms: 3`; un Lilachat anterior recibe «Actualiza Lilachat para llenar este formulario.».

**Opciones enriquecidas** (`oneOf[]`, en un `choice` o en `items.oneOf` de un multi-select):

```json
{ "const": "<id>", "title": "23 oct · 82 cm", "description": "Usada en el consumo del 22/10",
  "x-thumb": "https://…", "x-photos": ["https://…"], "x-match": { "tanque": "<idTanque>" }, "x-disabled": true }
```

- `x-thumb`: miniatura cuadrada junto a la opción. Solo https; lo demás se descarta.
- `x-photos`: hasta 6, https. Tocar la miniatura abre el visor con «Elegir esta opción».
- `x-match`: en una fila de lista, la opción solo se ofrece si los valores de la fila
  coinciden. El servidor lo vuelve a revisar al enviar: «Esa opción no va en esta fila.».
- `x-disabled`: se ve tachada, con su `description` en ámbar, y no se elige. El servidor
  la rechaza: «Esa opción ya no se puede elegir.».
- Sin extras, un `choice` sigue saliendo como antes (`enum` + `x-labels`).

**Varias opciones**: `type: array` con `items.oneOf` (o `items.enum`) es un multi-select
de filas con casilla. `minItems` es el mínimo («Elige al menos una.»); el máximo, todas.

**Filas fijas**: una lista con `x-fixed-rows: true` toma sus filas de `default` (una por
tanque), sin agregar ni quitar. `x-row-title: "<campo>"` titula cada fila con la etiqueta
de esa opción, y ese campo no se edita.

**Sin nada que elegir** (31/10): un `oneOf: []` es una elección sin opciones todavía, y
un `default: []` en filas fijas es una lista sin filas. El formulario se abre y dice «No
hay opciones para elegir» o «No hay filas para completar». Antes, Test sin pedidos en el
periodo rechazaba el formulario entero y la persona veía «Portal no pudo responder.».

**Refresco** (`x-refresh: true` en un campo, p. ej. `desde` y `hasta`): 600 ms después del
último cambio, Lilachat reenvía el MISMO evento que abrió el formulario:

- `shortcut.invoked` o `command.invoked`, con el mismo `command_id`;
- más `values` (el borrador, sin fotos ni ubicación) y `refresh: true`.

La respuesta trae el formulario resuelto y quizá un `text`, que se muestra como nota. Si
tarda, llega por `/respond` con el mismo `command_id`. En los dos casos reemplaza al
formulario abierto y conserva lo elegido que siga existiendo. Las filas fijas siguen a las
nuevas filas, cada una con lo elegido en la fila del mismo título.

**Resumen** (`"x-preview": { "tool": "revisar_consumo" }` en la raíz del esquema): 600 ms
después de cada cambio, Lilachat manda `form.preview.requested` firmado con
`{command_id, form_id, values, channel, user}` y espera 3 s.

- La respuesta `{blocks, errors?}` lleva bloques del kit (`metric`, `rows`, `chips`,
  `text`, hasta 8). Se dibujan arriba de «Enviar». `errors` va bajo cada campo.
- Si falla o tarda, no hay resumen y se envía igual.
- Rutas de Lilachat: `POST …/commands/:commandId/refresh` y `…/preview` con `{values}`.
  Responden 409 si el formulario no tiene `x-refresh` o `x-preview`.

## c-septendecies) Iniciales solo para personas: `x-avatar` (28/10/2026, OTA + web)

agentes, 28/10: los diseños de mezcla llegan con su **id** como valor (los nombres se
repiten y Portal guarda el id). Lilachat ponía iniciales junto a todo id, y salía «MM»
al lado de MAC-2. Desde ahora las iniciales se piden:

```json
"clienteId": { "type": "string", "title": "Cliente", "oneOf": [ { "const": "<id>", "title": "Minera Santa Rita SAC" } ], "x-avatar": "initials" }
```

- `"x-avatar": "initials"`: cada opción lleva las iniciales de su nombre, en el campo y
  en la hoja. Es para personas: un cliente, un empleado.
- Sin `x-avatar`, u otro valor: ninguna opción lleva avatar, sea id o no. Así quedan
  diseños, sedes, productos y unidades.
- Un Lilachat anterior a este OTA sigue poniendo iniciales junto a cualquier id.

## c-sexdecies) Webhooks por loopback en la misma máquina (28/10/2026, solo servidor)

agentes midió el 28/10: desde la mini, un salto por la URL pública cuesta 0,6–0,96 s
y por loopback 0,002–0,003 s. Cada toque de un comando pagaba ese salto.

**Desde Lilachat:** en producción (Torre arranca Lilachat con `NODE_ENV=production` en
la mini), un `webhook_url` de `agentes.constroad.com` se llama en
`http://127.0.0.1:3012` (el puerto que Torre le da a agentes), con la misma ruta y la
misma consulta. Cuerpo, encabezados y firma `X-Lilachat-Signature` (HMAC-SHA256 con el
secreto de la instalación) no cambian. Para la app solo cambia que el pedido llega
desde `127.0.0.1`.

**Si nadie escucha en local** (un deploy, la app se mudó), el mismo envío, con el mismo
`X-Lilachat-Delivery`, sale por la URL pública dentro de la misma espera. Una respuesta
lenta NO se reintenta por la pública: la app ya la tiene.

**Sin configuración:** la lista vive en el código (`server/src/bots/botLoopback.ts`), no
en el manifiesto ni en una variable. Si Torre cambia el puerto de agentes, se cambia ahí;
mientras tanto todo sigue por la URL pública.

**De la app hacia Lilachat** (responder, `/respond`, mensajes): eso es del lado de la
app. Desde la mini, `http://127.0.0.1:3004` es Lilachat, con los mismos tokens.

## c-quindecies) Dos campos por fila: `x-width` (28/10/2026, OTA + web)

José, 28/10: «cada input ocupa una fila entera y se generan sábanas». Desde
ahora Lilachat pone **dos campos cortos en la misma fila**, en el orden del
schema. La regla es pura y compartida (`shared/src/appFormRows.ts`,
`formRows`): la usan la hoja de la app, el diálogo de la web y las tarjetas
de una lista.

**Cortos sin marcar nada:** `number`/`integer`, `format: date`,
`format: time` y un texto de una línea con `maxLength` ≤ 60. Dos cortos
seguidos comparten la fila; un tercero empieza la siguiente.

**La app decide con `x-width`:**
- `"x-width": "half"`: un campo que Lilachat no emparejaría solo (una lista
  de opciones con nombres cortos, un texto de 60 que en la práctica es una
  placa) va al lado de otro corto.
- `"x-width": "full"`: un número o una fecha que debe ir solo.
- Otro valor se ignora.

**Siempre a lo ancho, diga lo que diga la app:** una lista, una ubicación,
una foto (también la selfie de una firma), un texto largo, un código o PIN y
un `date-time` (ya son dos casillas, día y hora).

**Se emparejan los campos que SE VEN:** uno oculto por `x-visible-if` entre
dos cortos no los separa.

**Un desplegable en media fila va en una línea** (José, 28/10: «Elige de la lista» y
«Planta Lurín» se partían en dos): «Elige…» sin lupa, y el nombre se achica un poco
antes de cortarse con «…». La hoja que abre muestra el nombre entero.

El orden manda: para que «Fecha» y «Hora» compartan fila, van seguidas en
`properties`. Un cliente viejo ignora `x-width` y dibuja un campo por fila;
por eso no sube el nivel de `forms`.

## c-quindecies) Canales por cliente (29/10/2026, servidor; ARCHITECTURE §157)

- `PUT /api/bots/clients/:clientId` crea el canal del cliente la primera vez
  (201) y actualiza su estado (200). Cuerpo: `{ name, ruc?, last_activity_at,
  last_order_at, orders_total, services: [{ id, name, status, stage,
  stage_label, progress?, url?, closed_at? }], drive_url? }`. `status` puede ser pending, in_progress, completed o
  rejected. `drive_url` (https, opcional) es la carpeta del cliente en el Portal: la app la muestra
  como «Drive del cliente» arriba de «Servicios». Los enlaces se guardan hasta 1000 caracteres.
  Responde `{ client: { id, channel: { id, name }, live, archived_since } }`.
  El canal nace PRIVADO, solo con el bot y los admins del espacio. Un admin
  nombrado después entra con el siguiente PUT.
- `POST /api/bots/messages` acepta `client: "<clientId>"` como destino, junto
  con `kind` («order.created»), `refs: { service_id?, record_id? }` y
  `thread_of`.
  - Un cliente sin PUT previo da 404 `client_not_found`.
  - El cliente de otra app también da 404.
- Vivo = `last_activity_at` dentro de los últimos 60 días (José, 29/10). Se
  calcula al leer, no hay ningún cron que lo mueva. Un PUT solo, sin mensaje,
  ya saca el canal de Archivados.
- Los registros de cada servicio salen de los mensajes con `refs.service_id`:
  `GET /api/workspaces/:id/clients/:clientId/records` (solo para miembros del canal; los demás
  reciben 404) devuelve `{ records: [{ seq, at, kind, service_id, record_id?, title, kicker? }] }`,
  los 200 más nuevos primero. «Servicios» los lista dentro de cada servicio y al tocar uno
  salta a su mensaje.
- Los despachos no publican mensajes en el canal del cliente (José, 29/10): solo redibujan la
  tarjeta del pedido. Cada unidad va en el espacio de la planta.
- El fake tiene las mismas rutas y `GET /__fake/clients`.

## c-quaterdecies) Listas de ítems, fotos de la galería y límites exclusivos (28/10/2026, OTA + web + servidor)

José, 28/10: el pedido se carga con **filas**: «N.º de carros» y al lado «m³
por carro», con un botón para agregar otra fila. agentes, 28/10: la cotización
lleva «los productos que sean necesarios». Es el mismo campo:

```json
"despachos": {
  "type": "array", "title": "Carros", "minItems": 1, "maxItems": 6,
  "default": [{ "carros": 1, "m3": 25 }],
  "x-add-label": "Agregar fila",
  "items": { "type": "object", "required": ["carros", "m3"], "properties": {
    "carros": { "type": "integer", "title": "Carros", "minimum": 1, "maximum": 60 },
    "m3": { "type": "number", "title": "m³ por carro", "x-unit": "m³", "exclusiveMinimum": 0, "maximum": 40 }
  } }
}
```

- **Cómo se dibuja.** Hasta 3 campos cortos (número o texto de una línea, sin
  `x-visible-if`) van **en una fila**, con los títulos una vez arriba y un
  tacho por fila. Si no, cada ítem es una **tarjeta** («Productos · 2») con sus
  campos y «Quitar». Abajo, el botón `x-add-label` (sin él, «Agregar fila»)
  hasta `maxItems` (sin él, 10; tope 20). No se quita por debajo de `minItems`.
- **Arranca** con el `default` (solo las claves del ítem, hasta `maxItems`) o,
  sin él, con `minItems` ítems nuevos, cada uno con sus propios `default` (hoy
  para una fecha).
- **Dentro de un ítem** valen texto, número, enum (con `x-labels`, `oneOf` o
  lo que agentes resuelve de `x-options`), fecha, hora y fotos. No van otra
  lista ni una ubicación (el formulario se rechaza diciendo por qué). Hasta 8
  campos por ítem. `x-visible-if` mira los campos **del mismo ítem**, y un
  `required` oculto no se exige.
- **Llega** como array de objetos, limpio (números leídos, claves ajenas
  fuera). Las fotos dentro de un ítem llegan como enlaces firmados, igual que
  arriba.
- **Errores con ruta**: Lilachat y la app escriben `despachos[1].m3`, y se
  pintan debajo de ESE campo de ESE ítem (en la fila: «m³ por carro: Mayor que
  0.»). El error de la lista entera va con su nombre (`despachos: "Agrega al
  menos uno."`).
- **Lilachat viejo.** Cada comando y acción manda `forms: 2` (este Lilachat
  dibuja listas). A uno que no lo manda, el servidor no le entrega un
  formulario con lista: le dice «Actualiza Lilachat para llenar este
  formulario.» en vez de abrir una hoja que no sabe dibujar.

**Límites exclusivos.** `exclusiveMinimum` / `exclusiveMaximum` (lo que sale de
zod `.positive()`) se respetan en el teléfono: «Mayor que 0.», «Menor que 100.»,
«Mayor que 0 y hasta 40.». Antes se ignoraban y un gasto de 0 llegaba a la app
(E2E 28/10). Igual, los 422 de la app van por campo y en español:
`errors: { monto: "El monto debe ser mayor que 0." }`.

**Fotos de la galería.** `"x-gallery": true` en una lista de fotos suma
«Galería» junto a «Tomar» (un comprobante de transferencia es una captura). Sin
él, solo la cámara. La selfie de la firma sigue siendo solo cámara.

**Otros cambios del 28/10.** Tras un rechazo (de Lilachat o de la app), el
formulario se desplaza hasta el primer campo con error. Las iniciales al lado de
una opción las pide la app con `x-avatar` (c-septendecies); ya no salen por ser
un id. Una lista de fotos dice «Se registra con las fotos», no «con tu foto».

## c-terdecies) Varias fotos y fotos más livianas (0.1.169)

- José, 24/10: en la medida de tanque y el ingreso de material se pueden
  subir **varias fotos, quitarlas y volver a tomarlas**. Esquema:
  `{ "type": "array", "x-input": "photo", "minItems": 1, "maxItems": 6 }`
  (hasta 10). A la app le llega `values.<campo>` como **lista** de enlaces
  firmados, en el orden en que se tomaron. Una lista de fotos nunca es la
  selfie de la firma: usa la cámara trasera.
- Una foto suelta que no es firma también usa la cámara trasera, con
  «Tomar foto» (en el E2E del 24/10 la wincha abría la cámara frontal).
- **Fotos más livianas** (agentes, 24/10: Portal sube la foto al Drive antes
  de confirmar). Desde el 28/10 vale el estándar de Portal (§c-octodecies):
  una foto de 1 MB o más llega con el lado largo en 1600 px como máximo y por
  debajo de 1 MB; una más liviana llega como se tomó. Un HEIC siempre llega en
  JPEG. Si sharp no puede leerla, se guarda tal como llegó.

## c-duodecies) Listas largas con buscador y el PIN (0.1.168)

Para marcar asistencia eligiendo el nombre (agentes, 24/10; diseño e-35):
- Un `enum` (o `oneOf: [{ const, title, description? }]`) con **más de 8**
  opciones se dibuja como un campo que abre una hoja con buscador: filtra por
  el nombre sin tildes ni mayúsculas, dice «3 de 31», resalta lo que coincide y
  muestra `description` como línea de abajo (el cargo). Hasta 300 opciones.
- `x-input: "pin"`: dígitos ocultos mientras se escriben, teclado numérico,
  sin autocompletar. Nunca toma `default`, nunca se guarda en el teléfono ni
  en el servidor; Lilachat solo exige que sean dígitos (hasta 8). La app lo
  pide o no según la persona y rechaza con `errors: { pin: "…" }`.
- Una APK anterior a la 0.1.168 no conoce `x-input: "pin"` y no abre ese
  formulario: si el campo es opcional, la app puede mandarlo solo cuando lo
  pide.

## c-undecies) Tocar un tanque abre su detalle (0.1.166)

José, 24/10: al tocar un tanque de la tarjeta quiere ver su detalle. Cada item
del bloque `tank` acepta `detail: { title, blocks }`, igual que el `detail` de
la tarjeta (hasta 12 bloques). agentes manda el `tank` con ese único item y un
`rows` con Nivel, Llenado, Disponible, Mínimo, Estado y Última medida. Dentro
del detalle, un tanque no abre otro: su `detail` se descarta, así nunca hay
bucle. Un tanque sin `detail` no es tocable. Un servidor anterior descarta el
campo y la tarjeta queda igual.

## c-decies) Bloque `weather`: el clima por horas (0.1.166)

Pedido de José (23/10): /clima «como lo entrega Google, con horas». Diseño
e-33. Contrato cerrado con agentes el 24/10:
```
{ "type": "weather", "place": "Ate",
  "days": [ { "label": "Hoy", "icon": "partly", "max": 22, "min": 16, "temp": 19,
              "summary": "Parcialmente nublado", "rain": 10, "mm": 0, "humidity": 78, "wind": 12,
              "risk": { "label": "Riesgo medio para asfaltar", "tone": "warn" }, "note": "Tendencia",
              "hours": [ { "at": "06:00", "temp": 16, "rain": 0, "mm": 0, "wind": 8 } ] } ] }
```
- Hasta 8 días y 12 horas por día. `at` es `HH:MM`; una hora mal escrita se
  descarta. `icon`: `sun | partly | cloud | rain | storm | fog`; otro valor se
  dibuja como nube.
- Números, no texto: °C, `rain` en % (0–100), `humidity` en %, `wind` en
  km/h y `mm` de lluvia. Un número que falta no se dibuja; nunca se vuelve 0.
- `temp` (la de ahora) solo cuenta en el primer día. Arriba va la del día
  elegido: `temp`, o `max` si no viene.
- `risk.tone`: `ok | warn | error` (otro, `warn`). Se dibuja como pastilla
  bajo el resumen y como punto en el chip del día.
- Pestañas Temperatura · Precipitaciones · Viento. Lluvia y viento arrancan
  en 0; la temperatura usa su propio rango. En Precipitaciones el punto dice
  los mm cuando llueve («3,2 mm») y si no, el %.
- Un día sin `hours` (lejano, «Tendencia») no lleva curva.
- Un servidor o una APK que no conocen el bloque lo saltan y dibujan el resto:
  por eso van después las filas de distritos como respaldo.

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
