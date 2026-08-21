# LILACHAT — Arquitectura y plan (spec canónico)

> Mensajería propia: Android (RN) + web, backend en la Mac mini. Independencia
> de WhatsApp/Telegram, datos propios, backups navegables y asistente IA.
> **No es solo para la familia** (restricción quitada por José el 20/08/2026):
> arranca con acceso por invitación —los primeros usuarios son la familia— y
> evoluciona a producto público. Las decisiones de escala se toman con eso en
> mente.
>
> Estado: **aprobado por José el 19/08/2026**. Nada implementado todavía.
> Convención: identificadores en inglés, textos de usuario en español
> (`constroad-pitfalls` §11-bis).

## 0. Decisiones cerradas

| Decisión | Valor | Por qué |
| --- | --- | --- |
| Nombre | **Lilachat** | familia de marcas lila (lila-app, LilaStore, lila-cli); `lilachat.app` LIBRE al 19/08/2026 (`lilachat.com` tomado desde 2025) |
| Dominio | `chat.constroad.com` (CF Tunnel) | costo cero; comprar `lilachat.app` es opcional y lo decide José |
| App Android | **React Native / Expo SDK 57** | ver §3 |
| Distribución | LilaStore: **privada al inicio → pública cuando el producto evolucione** (decisión 20/08/2026) | el gate de acceso ya vive en la base de Lilachat, así que abrir la distribución no cambia la seguridad |
| Web | Vite + React SPA + shadcn/ui, servida por el mismo Express | sin SEO no hay SSR que justifique Next |
| Backend | Express 4 + Socket.IO 4 + mongoose, un solo proceso en la mini | stack de lila-app → operable con `deploy-mini` |
| DB | **MongoDB Atlas**, base `lilachat_db` con **usuario PROPIO** (`lilachat_app`, `readWrite` solo sobre `lilachat_db`) | Atlas es donde ya vive la operación. Credenciales NUNCA compartidas con Portal: si una app se compromete, la otra no cae (el arranque usó la URI de Portal como puente — deuda que se paga creando el usuario). Mongod local: solo como respaldo de emergencia, F13 |
| Media | storage de **lila** (namespace `files/apps/lilachat/`) | requisito de José |
| Identidad/OTP | **constroad-auth** (:4002, ya en producción) | ver §5 |
| Tema | **Vivid Pulse** (design system de Stitch) para web Y app | ver §2 |
| Modelo de mensajes | estilo **Telegram** (server = fuente de verdad + sync por cursor), no estilo WhatsApp (cola que se borra) | multi-device, web y backups salen gratis |
| E2EE | NO en v1 (TLS + server propio); libsignal = F9 opcional | mismo trade-off que los cloud chats de Telegram, pero el server es NUESTRO |

## 1. Nombre y marca

- Verificación de dominios (RDAP/whois, 19/08/2026): `lilachat.app` LIBRE;
  `lilachat.com` registrado (2025-02); `chaski/chasqui/ayllu/fogata/tertulia`
  tomados en .app y .com; `aldaba.app` libre (descartado igual).
- Para uso familiar el dominio propio es opcional. Si un día pivotea a SaaS,
  el nombre ya pertenece a la familia lila.

## 2. Diseño: Vivid Pulse + pantallas de Stitch

Proyecto Stitch: **Omni Messaging Platform** (`projects/15540754270713720465`).
Tiene TRES design systems; el elegido es **Vivid Pulse**
(`assets/78ffeb6efbad4591b2dcc89131e1c5f5`). Los otros dos (Lilachat Visual
Language `#5865F2` —blurple de Discord— y NexChat `#007aff`) se DESCARTAN.

### 2.1 Tokens de Vivid Pulse (fuente: el design system, no inventados)

| Token | Light | Notas |
| --- | --- | --- |
| primary | `#6b38d4` (container `#8455ef`, base de marca `#8B5CF6`) | acciones, burbuja propia |
| secondary | `#0058be` (base `#3B82F6`) | links, feedback de sistema, verificados |
| tertiary | `#a12e70` (base `#F472B6`) | acentos puntuales |
| neutral | slate (`#64748B` base; on-surface `#0b1c30`) | texto, iconos inactivos |
| background | `#f8f9ff` | dark mode = navy `#0F172A`, **nunca negro puro** |
| error | `#ba1a1a` | — |
| tipografía | **Inter única** (display 48/700 → label 12/500) | no Plus Jakarta Sans |
| radios | `rounded-lg` 16px estándar; burbujas 16px con esquina-cola 4px | avatares siempre circulares |
| espaciado | grid 4px; 8px mismo emisor, 16px cambio de emisor | touch targets ≥44px |
| elevación | capas tonales + backdrop-blur 12px (glass) en nav/FAB; sombras solo en modales, teñidas lila 10% | — |

**Regla dura:** estos hex viven en UN solo lugar por plataforma —
`web/src/styles/tokens.css` (puente a variables shadcn `--primary`, etc., ANTES
del primer componente) y `app/src/ui/theme.ts`. En componentes: tokens, nunca
hex. Dark y light se verifican en todo cambio visual.

### 2.2 Pantallas de Stitch: qué va y qué no

Capturas en `design/stitch/` — las 30 bajadas (20/08/2026; la única que faltó
es «NexChat Web Claro», del design system descartado y con layout ya cubierto
por «Lilachat Web Claro»). **Se miran las capturas, no solo el HTML** — y todas
se re-aplican con Vivid Pulse (`apply_design_system`) porque fueron dibujadas
con los otros temas.

#### Inventario completo (30 pantallas + 7 assets) → fase que cubre cada una

| Pantalla | Fase |
| --- | --- |
| Registro: Teléfono · Verificación OTP · Invitar Amigos | F1 |
| Chats claro/oscuro (par genérico y par Lilachat — se elige el par LILACHAT y el genérico queda de referencia) · Chat de Grupo · Nuevo Grupo: Información · Nuevo Grupo: Seleccionar Contactos · Info del Grupo (2 versiones: manda la de branding Lilachat) · Permisos de Administrador | F2 |
| Multimedia y Emojis · Visor de Archivos · Búsqueda de Archivos · Galería: Elegir Foto de Grupo | F3 |
| Crear Evento · Recordatorios · Crear Encuesta | F5 |
| Lilachat Web (Claro) · NexChat Web (Oscuro, solo como referencia de layout dark) | F6 |
| Copia de Seguridad · Restaurar Datos · Configuración y Backup | F7 |
| Llamada de Voz · Video Llamada | F10 |
| Automatizaciones | F11 |
| Legado Digital | F12 |
| Assets: Brand Identity, Logotype light/dark, icon light/dark, logo viejo, NexChat icon (descartado), avatar de relleno (no va) | marca |

#### Lo que el spec NECESITA y Stitch aún NO diseñó

Se genera con Vivid Pulse al llegar cada fase (no todo por adelantado):

| Pantalla faltante | Fase |
| --- | --- |
| Chat 1:1 móvil con mensajes (solo existe en web; en móvil hay grupo vacío y multimedia) | F2 |
| Lado del INVITADO: aceptar invitación / entrar con el link | F1 |
| Perfil de usuario / editar perfil | F2 |
| Tab/lista de **Eventos** (hay crear y recordatorios, falta la lista) | F5 |
| Encuesta DENTRO del chat (votar/resultados) | F5 |
| Búsqueda de MENSAJES (solo hay búsqueda de archivos) | F6 |
| Lilachat Web (Oscuro) con branding propio | F6 |
| Pantallas de IA: @lila en el chat, «ponme al día», NL→evento | F8 |
| Llamada ENTRANTE (solo hay pantallas en curso) | F10 |

**TODO lo diseñado está en alcance** — las pantallas de llamadas,
Automatizaciones y Legado Digital las pidió José a Stitch a propósito
(aclarado el 19/08/2026; una versión anterior de este spec las marcaba como
fuera de alcance, y era un error de lectura mío, no de los diseños). Lo único
que no va son los usuarios/avatares ficticios de relleno.

| Ahora (F1–F8) | Después (F10+) |
| --- | --- |
| Registro teléfono, OTP, chats claro/oscuro, chat 1:1/grupo, multimedia, visor y búsqueda de archivos, crear grupo (2), info grupo, galería, crear evento, recordatorios, encuestas, backup/restaurar (storage = lila, NO "Google Drive" como dibujó Stitch), invitar, permisos admin, web 2 paneles | Llamadas de voz y video (F10), Automatizaciones/Smart Routines (F11), Legado Digital (F12) |

Navegación v1: **Chats · Eventos · Ajustes** (recordatorios viven en Eventos).
Cuando entren llamadas y automatizaciones se revisa la navegación contra los
diseños (ellos usan tabs Chats/Calls/Vault/Settings).

### 2.2-bis Auditoría contra los diseños (20/08/2026) — y por qué hizo falta

**Las pantallas de F1–F3 se escribieron de memoria**, no abriendo las capturas.
Se habían mirado al arrancar el proyecto y después se construyó citando sus
nombres en los comentarios, que da una falsa sensación de haberlas consultado.
Pasaron todos los tests y se veían prolijas. Faltaba esto:

| Pantalla | Faltaba (estaba dibujado) | Estado |
| --- | --- | --- |
| Chat | **hora bajo cada mensaje**, **check de entrega**, avatar del otro, separador de día, agrupado por emisor, emoji y micrófono en la barra | ✅ corregido |
| Lista | **hora de cada chat**, FAB de conversación nueva, barra inferior (Chats/Estado/Llamadas/Ajustes), vista previa «📷 Foto» | ✅ corregido |
| Lista | un botón «Cerrar sesión» al pie que **el diseño no tiene** | ✅ quitado; vive detrás del avatar del header |
| OTP | **seis cajas** separadas, **temporizador de reenvío**, badge de la pantalla | ✅ corregido |
| Registro | logo de marca, layout centrado, texto de ayuda, botón anclado abajo con flecha | ✅ corregido |
| Chat | íconos de video/llamada en el header | ⏸ van con F10 (llamadas); dibujarlos inertes confundiría |

**La auditoría de arriba dejó pasar la barra del chat entera**, y el motivo vale
más que el arreglo: se preguntó «¿está el emoji? ¿está el micrófono?» y, como
faltaban, se **agregaron al lado** de lo que había. Cinco controles hermanos, el
campo tan angosto que el placeholder se partía en dos líneas. La composición real
del diseño es otra: el `+` va **plano** (sin círculo), hay **una** píldora larga
con el emoji **adentro**, y a la derecha **un solo** botón circular que es
excluyente — micrófono con el campo vacío, enviar apenas se escribe. Verificado
en el emulador: con texto el árbol tiene `btn-enviar` y NO `btn-voz`.

Un elemento puede estar **presente y mal compuesto**, y una lista de presencia no
lo ve. La skill suma ahora las cuatro preguntas que sí lo ven (qué contiene a
qué, qué es excluyente, qué lleva fondo, quién se estira).

**Y todavía faltó una tercera pasada**, porque la segunda corrigió solo lo que el
usuario señaló. Auditoría COMPLETA (20/08/2026), zona por zona:

| Zona | Mismatch | Corregido |
| --- | --- | --- |
| Header del chat | la **palabra «Atrás»** donde el diseño tiene una flecha; sin avatar del chat ni menú ⋮ | ✅ |
| Header de la lista | sin ícono de marca, sin cámara ni búsqueda | ✅ (cámara y búsqueda inertes hasta F6) |
| Filas de la lista | marca de tiempo **siempre en reloj**; el diseño usa «Ayer», «Lun», «12 Feb» | ✅ `formatChatTimestamp` |
| Filas de la lista | **«Escribiendo…»** en cursiva de acento — el socket lo emitía desde F2 y nadie lo mostraba | ✅ con apagado automático a los 6 s |
| Filas de la lista | badge de no leídos centrado en la fila; va en la línea del preview | ✅ |
| Header del chat | video y llamada | ⏸ F10 |
| Filas | punto verde de en línea | ⏸ F4 (presencia) |

La regla que quedó en la skill: **un reclamo sobre una parte de la pantalla es
una muestra, no el alcance**. Se audita la pantalla entera y las hermanas que
comparten patrón, recortando y ampliando cada zona (`sips -c` + `sips -z`) — son
cuatro miradas por pantalla, no cuarenta.

**Lo más grave**: los acuses (`readSeq`) estaban implementados en el server desde
F2 y la interfaz no los mostraba — el dato existía y nadie lo veía. Es la señal
que ahora la skill nombra explícitamente: *«el backend tiene un dato que la UI no
muestra» casi siempre significa que el diseño lo pedía*.

**Bug que destapó la corrección**: al mostrar los mensajes propios a la derecha
apareció que TODOS se veían como ajenos. La credencial guardada era anterior al
campo `userId`, y sin él nada se reconoce como propio. `/api/auth/session` ahora
devuelve el usuario y la app repara la credencial sola en el próximo arranque,
sin obligar a re-loguear.

La skill `constroad-premium-ui` se reforzó con el disparador que faltaba: la
regla de mirar las capturas vivía en «de dónde sale el diseño», que se lee como
un paso de arranque. Ahora dice **abrir la captura de ESA pantalla antes de
escribirla**, lista las señales de estar construyendo de memoria, y exige un
diff explícito contra la captura al cerrar.

### 2.3 Logo e ícono — GENERADOS (19/08/2026)

Generados por Stitch con Vivid Pulse como design system y bajados a
`design/brand/`: `brand-sheet.png` (lámina completa), `logotype-light.png`,
`logotype-dark.png`, `icon-light.png`, `icon-dark.png`. Marca: burbuja de
diálogo de vidrio con destello interior, degradado violeta `#8B5CF6` → azul
`#3B82F6`, acabado glassmórfico. La marca ocupa ~62% del lienzo del ícono
(zona segura del adaptive icon — `publicar-apk` §8).

**Logotipo aprobado por José (19/08/2026): el dark** — burbuja de vidrio con
pulso/destello + wordmark «LILACHAT» en mayúsculas con degradado. Es la
referencia de la marca.

Pendientes de la marca:
- Derivar la variante light DEL aprobado (mismo wordmark en mayúsculas; el
  light actual salió en Title Case y no coincide).
- Los PNG de Stitch son mockups: falta vectorizar (SVG) y producir las capas
  del adaptive icon (foreground/background). **El ícono se verifica sacándolo
  del APK**, no del launcher.
- Pantallas de Stitch en los screens `Lilachat Logotype Light/Dark` y los dos
  «Standalone app icon…» del proyecto, por si hay que re-generar variantes.

## 3. ¿RN o Kotlin? — decisión y evidencia

**React Native/Expo.** La comunidad lo respalda para chat y nuestra realidad lo
exige:

- [Slant recomienda RN sobre Kotlin](https://www.slant.co/versus/1543/4650/~kotlin_vs_react-native) para la mayoría de los casos.
- **Discord — un chat con cientos de millones de usuarios — sigue en RN en 2026**
  con un equipo móvil chico y codebase compartida
  ([análisis](https://eathealthy365.com/discords-enduring-bet-on-react-native-explained/)).
- Kotlin nativo gana cuando la app vive de APIs profundas de plataforma o UI
  custom de altísimo rendimiento ([comparativa](https://www.mobiloud.com/blog/react-native-vs-kotlin)).
  Lilachat no: push es FCM estándar y no hay background agresivo (a diferencia
  del GPS de Timón).
- Nuestra realidad: Timón ya es Expo (toolchain completo: `build-apk.sh`, JDK 17,
  Maestro, LilaStore, skill `rn-app-loop`), y los motores puros TS
  (`shared/`) se comparten con la web. Kotlin duplicaría toda esa lógica.

Riesgos aceptados y su mitigación: listas largas → **FlashList**; llamadas
futuras → `react-native-webrtc` existe (F10). Tercera app RN en la máquina:
**Metro en puerto propio** en el build (`-PreactNativeDevServerPort`), lección ya
pagada.

### 3.1 Stack de UI en la app — el «shadcn + framer-motion» de RN

Equivalencias 1:1 con la web, respaldadas por la comunidad 2026:

| Capa | Web | App RN | Nota |
| --- | --- | --- | --- |
| Componentes | shadcn/ui | **react-native-reusables** | ES el port de shadcn a RN: misma filosofía copy-paste, mismos nombres, theming y dark mode |
| Estilos/tokens | Tailwind | **NativeWind** | Tailwind para RN — los tokens de Vivid Pulse se declaran UNA vez en `tailwind.config` compartido |
| Motion | framer-motion | **react-native-reanimated** + **Moti** | Reanimated es el estándar (corre en el hilo de UI); Moti le pone encima la API declarativa estilo framer-motion |
| Iconos | lucide-react (default de shadcn) | **lucide-react-native** | un solo set de iconos en las dos superficies |
| Listas | virtualización | **FlashList** | la lista de mensajes es LA pantalla |
| Imágenes | — | **expo-image** | cache en disco + blurhash para thumbnails |

Alternativas evaluadas y descartadas: Tamagui (compilador propio, se aparta del
lenguaje Tailwind compartido) y gluestack-ui (más framework, menos copy-paste).
El patrón Timón (StyleSheet + theme.ts) queda para apps utilitarias; Lilachat
tiene design system premium y lo comparte con la web.

Regla de motion en RN (espejo de la de web): variantes y easing en UNA fuente
(`app/src/ui/motion.ts`), y respetar `useReducedMotion` de Reanimated.

## 4. Arquitectura

```
[App RN Expo]          [Web SPA React]
     └── WSS + HTTPS ──────┘
        chat.constroad.com  (CF Tunnel, solo 443)
                 │
         ┌───── Mac mini ─────────────────────────┐
         │ lilachat-server (Express + Socket.IO)  │
         │  ├─ MongoDB local (lilachat_db)        │
         │  ├─ node-cron: recordatorios, backups  │
         │  ├─ FCM + Web Push (VAPID)             │
         │  ├─ Claude API (asistente server-side) │
         │  └─ whisper.cpp (transcripción local)  │
         │ constroad-auth :4002 ← identidad/OTP   │
         │ lila-app :3001 ← media                 │
         └────────────────────────────────────────┘
```

Monorepo `~/projects/lilachat/` (npm workspaces):
`server/` · `app/` (Expo) · `web/` (Vite+shadcn) · `shared/` (motores puros con
test) · `design/` · `specs/`.

## 5. Identidad y OTP: constroad-auth (NO se construye auth propio)

Servicio en producción en la mini (:4002). Reglas de su
`specs/INTEGRATION.spec.md`, que mandan:

- **El teléfono JAMÁS habla con constroad-auth.** Habla con lilachat-server,
  que tiene la llave de servicio. Una llave nunca viaja en un APK.
- Flujo de alta: app → server → `POST /v1/codigo` (canal **email** primario —
  sobrevive una caída de WhatsApp, que es el escenario de esta app; WhatsApp
  como canal alternativo) → usuario tipea código → server → `POST /v1/verificar`
  → **secreto de dispositivo** (una sola vez) → Keystore del teléfono
  (`expo-secure-store`), jamás AsyncStorage.
- Uso diario: server valida con `POST /v1/dispositivos/:id/validar` →
  `{companyId, identidad, app}`. Los permisos NO vienen de ahí: son de Lilachat.
- Baja: `POST /v1/dispositivos/:id/revocar`. **La ausencia de respuesta no
  revoca** — error de red ≠ "me dijo que no" (regla escrita del servicio).
- La llave se emitió en **Torre → Identidad → Emitir llave** (20/08/2026), con
  las decisiones de José:
  - **App** `lilachat` · **Empresa** `constroad` (no se crea tenant propio: un
    tenant fantasma entra a todos los crons que iteran empresas).
  - **UNA llave** con prod + localhost en `enlaces` — el patrón vivo de
    lilastore; separar llave por dev es para cuando haya más de un dev:
    ```
    https://chat.constroad.com/login/callback
    http://localhost:5173/login/callback
    http://localhost:4003/login/callback
    ```
    (la app RN no usa enlaces: el código se tipea). Costo aceptado: la misma
    llave vive en la laptop y en la mini; si la laptop se compromete, se revoca
    y re-emite.
  - **Lista de miembros: «En la base de tu app»** (`exigeMiembro: false`).
    Decisión de producto de José: Lilachat NO es solo la familia — arranca
    privada en LilaStore y evoluciona a app pública, así que la lista de
    quién entra pertenece a la base de Lilachat desde el día uno.

### 5.1 La consecuencia de «en la base de tu app»: el gate es NUESTRO (F1)

constroad-auth le manda el código a **cualquiera** que lo pida — solo prueba
que ese correo es de quien lo pide. Sin gate propio, entra cualquiera. F1
incluye obligatoriamente:

- Colección `invitations` (email, invitedBy, status) — la lista de quién puede
  enrolarse. Bootstrap: `scripts/seed-invitations.ts` siembra a la familia (José
  primero); después las altas salen de la pantalla «Invitar Amigos», que con
  esta decisión deja de ser un share-link decorativo y ES la funcionalidad.
- **El chequeo va ANTES de pedir el código**: si el email no está invitado, el
  server responde el mismo 200 genérico («si tu correo está registrado, te
  llegará un código») y NO llama a constroad-auth — no le gastamos SMTP a
  extraños ni les confirmamos quién está. Y se re-chequea al verificar
  (defensa en profundidad).
- Test que lo fija: email no invitado → mismo cuerpo de respuesta, cero
  llamadas al servicio, y jamás un device creado.

### 5.2 La identidad es el TELÉFONO (corregido el 20/08/2026)

El alta se implementó por **email** por una suposición que quedó obsoleta: que
la lista de miembros vivía en Torre, que es por correo. José eligió «en la base
de tu app», así que la identidad la decide Lilachat — y el diseño «Registro:
Teléfono» decía **número** desde el primer día.

- **Identidad = celular** (9 dígitos, Perú). Es lo que espera cualquiera en una
  app de mensajería: a la gente se la encuentra por número.
- **El canal del código lo decide constroad-auth por el FORMATO del destino**:
  un teléfono va por WhatsApp, un correo por email (`resolverDestino`).
- **Por eso la invitación lleva un email de RESPALDO.** Lilachat existe para
  sobrevivir a que WhatsApp se caiga; si el único canal fuera WhatsApp, el día
  que se cae nadie podría enrolar un teléfono nuevo — justo cuando se necesita.
  El server intenta los destinos EN ORDEN y corta al primero que sale, y al
  canjear verifica contra el mismo destino al que mandó.
- El prefijo `+51` se muestra **fijo, no como selector**: el servicio solo
  valida celulares peruanos, y un selector que rechaza todos los países menos
  uno promete lo que no puede cumplir.

**El respaldo se PIDE, y nunca sale solo.** Hubo dos versiones equivocadas antes
de la buena:

1. El correo solo se usaba si WhatsApp devolvía error. No cubre el caso real —
   WhatsApp responde «ok» y el mensaje igual no llega, o no se ve— y ahí no hay
   nada que dispare el respaldo.
2. Se mandaba a los dos destinos en orden. Con eso el correo llegaba **sin
   haberlo pedido**, lo que vuelve inútil el botón que dice «mándamelo por
   correo»: la interfaz deja de decidir nada. Y cada alta gastaba dos envíos y
   dejaba dos códigos válidos donde alcanza uno.

Lo correcto, y lo que está: **`/otp/request` manda a UN solo destino**. Por
defecto WhatsApp; el correo solo cuando la app manda `preferEmail`, que es lo
que hace el botón «¿No te llegó? Envíalo a mi correo». Al **canjear** sí se
prueban los dos, porque el server no registra por dónde salió cada código y los
dos son legítimamente de esa persona — eso es invisible y no cambia lo que el
usuario recibe.

**Y el botón se muestra SIEMPRE, incluso a quien no tiene respaldo.** Se intentó
devolver un `emailFallback` para que la app supiera si mostrarlo, y el test
anti-enumeración lo tumbó en el acto: invitado y extraño quedaban con cuerpos de
respuesta distintos, que es exactamente la fuga que el gate cierra. Si ese
número no tiene correo, el server no hace nada y la respuesta es idéntica.

Verificado en vivo (20/08/2026) contra el servicio real: un pedido normal deja
**un solo** intento (`falló por whatsapp`) y ningún correo; pidiendo el respaldo,
el correo sale sin error. Antes del arreglo llegaban los dos sin pedir nada.

Lo que constroad-auth sigue quitando del plan: OTP propio, rate limits de
envío, hash de credenciales de device. `devices` local queda como espejo
liviano (pushToken, plataforma, lastSeenAt).

## 6. Protocolo real-time (análisis WA/TG → nuestro diseño)

| | WhatsApp | Telegram (MTProto 2.0) |
| --- | --- | --- |
| Transporte | TCP/WS persistente cifrado con Noise (XX, 25519) | TCP/WS, AES-256-IGE con el server |
| Contenido | E2EE Signal (X3DH + Double Ratchet; Sender Keys en grupos) | cloud chats: cifrado cliente↔server; secret chats E2EE |
| Mensajes | cola en server, se borran al entregar | server = fuente de verdad |
| Sync | re-entrega de cola | `pts` + `getDifference` por cursor |
| Idempotencia | id por mensaje | `random_id` del cliente |
| App dormida | push FCM despierta → reconecta | igual |

**Invariantes que copiamos:** (1) WS persistente + push para despertar; (2)
almacén server-side con `seq` monotónico por chat; (3) sync por cursor al
reconectar; (4) envío idempotente por `clientKey` del cliente (lección Timón);
(5) acks enviado/entregado/leído. A escala familiar: **Socket.IO 4 + JSON**.

### 6.1 Eventos WS

```
cliente → server : msg.send {chatId, clientKey, kind, body?, mediaId?, replyToSeq?} → ack {seq, at}
                   sync.pull {cursors: {chatId: seq}} → ack {batches}
                   read.set {chatId, seq} · typing {chatId, on}
server → cliente : msg.new {message} · receipt {chatId, userId, readSeq}
                   presence {userId, online} · event.reminder {event}
```

### 6.2 Envío idempotente (server)

```ts
async function handleSend(ctx: DeviceContext, frame: SendFrame) {
  assertMember(frame.chatId, ctx.userId);
  const duplicate = await Message.findOne({ chatId, senderId: ctx.userId,
                                            clientKey: frame.clientKey });
  if (duplicate) return ack(duplicate);            // reintento = mismo seq
  const seq = await nextSeq(frame.chatId);         // $inc lastSeq atómico
  const message = await Message.create({ ...frame, seq, at: new Date() });
  io.to(roomOf(frame.chatId)).emit('msg.new', message);
  notifyOffline(frame.chatId, message);            // FCM/WebPush a los sin socket
  return ack(message);
}
```

### 6.3 Outbox del cliente (`shared/`, motor puro, test primero)

Reglas heredadas de las colas de Portal/Timón: `clientKey` nace en el cliente y
sobrevive reintentos; respuesta duplicada = ÉXITO; 401 vacía la cola; 4xx
permanente descarta con motivo visible (anti-wedge); persiste en
expo-sqlite/IndexedDB.

## 7. Modelo de datos (Mongo, `lilachat_db`)

```ts
users     { _id, phone, email?, name, avatarMediaId, createdAt }
devices   { _id, userId, deviceId, platform: 'android'|'web', pushToken?, lastSeenAt }
            // la credencial vive en constroad-auth; esto es espejo operativo
chats     { _id, kind: 'direct'|'group', name?, avatarMediaId?,
            members: [{ userId, role: 'admin'|'member', joinedAt }],
            lastSeq, createdAt }
messages  { _id, chatId, seq, senderId, clientKey,
            kind: 'text'|'image'|'video'|'file'|'event'|'system',
            body?, media?: { mediaId, thumbUrl, width, height, bytes, mime },
            replyToSeq?, editedAt?, deletedAt?, at }
            // índices: {chatId, seq} único · {chatId, senderId, clientKey} único
receipts  { chatId, userId, deliveredSeq, readSeq }   // cursor, NO por mensaje
events    { _id, chatId, title, startsAt, location?, remindMinutesBefore: [60],
            createdBy, attendees: [{ userId, rsvp }], remindersSentAt: [] }
polls     { _id, chatId, question, options: [{ text, votes: [userId] }], closedAt? }
```

## 8. API REST (guard en todo salvo el alta)

```
POST /api/auth/otp/request   { phone }            → proxy a constroad-auth
POST /api/auth/otp/verify    { phone, code, deviceId } → { deviceSecret, jwt }
POST /api/auth/refresh       { deviceId, deviceSecret } → { jwt }
GET  /api/chats · POST /api/chats
GET  /api/chats/:id/messages ?beforeSeq&limit=50
POST /api/media (multipart → lila) · GET /api/media/:id (redirect firmado)
CRUD /api/events · GET /api/chats/:id/events
GET  /api/export/chats/:id   (JSON navegable, solo admin)
POST /api/assistant/catch-up { chatId }
```

Presupuesto 10 s por endpoint. Transcripción/resúmenes se encolan (202).

## 9. Media, push, eventos, backups

- **Media por lila**: server sube con JWT, sharp para thumbnails (concurrencia
  acotada), **calidad original se conserva** (queja clásica de WhatsApp). URLs
  firmadas de vida corta; los blobs son inmutables → URL por contenido + cache
  largo (`immutable` solo en URLs que nombran UN binario — lección LilaStore).
- **Push**: FCM (expo-notifications) + Web Push VAPID. La notificación es el
  timbre, no la entrega: al abrir, la app sincroniza por cursor.
- **Eventos/recordatorios**: node-cron cada minuto; `remindersSentAt` sella lo
  emitido (efectos idempotentes — `constroad-pitfalls` §10).
- **Backups** (nocturno launchd, serializado con los demás jobs de la mini):
  mongodump + manifest de media → tar → lila `/backups/lilachat/`, retención
  30d. **Restore probado en F7 contra DB efímera** — backup sin restore no es
  backup. Export por chat en JSON legible.

## 10. IA (server-side, la key jamás en la app)

Claude API (`claude-opus-5`, thinking adaptativo, `effort: low` en lo casual):
@lila en el chat, "ponme al día" (resumen de no leídos), lenguaje natural →
borrador de evento, transcripción de notas de voz con whisper.cpp local.
Búsqueda semántica: fase posterior (léxica con text index primero).

## 11. Seguridad

- Identidad SOLO de credencial verificada (constroad-auth), jamás de headers.
- Secretos fail-closed; `.env` único enumerado (lección del glob `.env*`).
- **Nada sensible en `EXPO_PUBLIC_*` ni `VITE_*`** — se hornean al bundle.
- CF Tunnel expone solo 443; cero endpoints de cómputo sin auth.
- Coercionar input del cliente; errores genéricos; mensajes idénticos para "no
  existe" y "no coincide".

## 12. Deploy y publicación

- **Server**: pipeline `deploy-mini` (launchd LaunchDaemon, build desde git
  HEAD, artefacto verificado, estáticos de releases previas conservados, aviso
  por Telegram). Watchdog externo (el vigilante de lila lo pingea).
- **APK**: `publicar-apk` — `lila-cli` pinneado, `versionCode` sube ANTES de
  compilar, keystore de José (fuera del repo), JDK 17 elegido por el script,
  `EXPO_PUBLIC_API_URL` fijado y verificado DENTRO del binario, publish con
  `--enforce`, **app pública** en LilaStore.

## 13. Fases (ciclo: test primero → implementar → E2E emulador/Chrome → as-is)

| Fase | Entrega | E2E |
| --- | --- | --- |
| F0 ✅ 20/08/2026 | monorepo (shared+server; web F6, app F1 fuera de workspaces por Metro) + tokens en `shared/src/tokens.ts` + server hello con test primero (3 en verde) + artefacto verificado con humo real + 30 pantallas bajadas + logo aprobado. **Pendiente de F0**: launchd+tunnel (van con el PR a Torre al cerrar F1, §12.1) | `curl /api/health` contra `dist/` ✅ |
| F1 ⏳ | **Server hecho (20/08/2026, test primero, 17 en verde)**: gate anti-enumeración (respuesta byte a byte idéntica + cero llamadas para extraños), cliente constroad-auth con contrato copiado del vivo, `/otp/request` `/otp/verify` `/session` (503≠401 cuando el servicio no contesta — la ausencia de respuesta no revoca), espejo `users`/`devices`, `seed-invitations.ts`, guard de DB desconectada (sin él, el request colgaba mudo — lo destapó el humo). **Humo VIVO verificado (20/08/2026)**: seed de invitación en Atlas real + `/otp/request` para el correo de José → constroad-auth aceptó y el código llegó por email; extraño → mismo 200 sin llamada. Hallazgos del humo, ya corregidos: `new URL()` no parsea URIs Mongo multi-host (mataba al seed DESPUÉS de conectar), y sin DB el request colgaba mudo. **Canje vivo COMPLETO (20/08/2026)**: código real del inbox canjeado → usuario creado + secreto de device + JWT, y `/session` validando contra el servicio. **App RN creada (20/08/2026)**: Expo 57 en `app/` (fuera de workspaces), NativeWind con tokens desde `shared/tokens.json` (generado, no copiado), motores puros con test (7 en verde: normalización espejo del server, auto-submit al 6.º dígito, y 503/sin-red que NUNCA suenan a rechazo), pantallas Email→OTP→Chats placeholder, credencial en SecureStore `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, boot que solo borra credencial ante un 401 REAL. Metro en :8092 (tercera app RN). Usuario Atlas `lilachat_app` creado y verificado. **Maestro `alta.yaml`**: cubre email→OTP con el genérico anti-enumeración; el canje automatizado queda BLOQUEADO por diseño — constroad-auth no tiene costura de QA y el código va a un inbox real (canje vivo ya probado por curl). Backlog: endpoint QA en constroad-auth (fuera de prod, con secreto, como el qa-otp de Timón) | **Maestro VERDE (20/08/2026)**: los 9 pasos del alta en el emulador, contra el server local real |
| F2 ⏳ | **Server + app hechos (20/08/2026, 72 tests)**. Server: `chats`/`messages`/`receipts` con `seq` por chat vía `$inc` atómico (test de 12 envíos concurrentes sin repetir), idempotencia por `clientKey` en índice único —código Y base—, `pullSince` que saca los chats de la MEMBRESÍA (nunca de las claves del cliente: iterarlas filtraría chats ajenos), acuses como CURSOR con `$max`, y Socket.IO en el MISMO proceso/puerto con JWT en el handshake y sala por usuario (multi-device). Test de socket sobre puerto real: ack con `seq`, entrega al otro dispositivo, duplicado, y 403 en chat ajeno. App: outbox persistido en AsyncStorage con store de suscriptores, `useChat` con sync por cursor + `mergeBySeq`, lista de chats con los 3 estados y no-leídos, conversación con FlashList. **E2E REAL verificado (20/08/2026)** en el emulador contra el server y Atlas: historial sembrado visible tras reconectar (sync por cursor), mensaje escrito → `seq=3` en la BASE con el `clientKey` del teléfono, y **corte de red con `adb svc wifi/data disable`** → el mensaje queda con «Enviando…», al volver la red drena solo y persiste como `seq=4`, sin `clientKey` duplicado. Data QA borrada y verificada en cero | ✅ |
| F3 ⏳ | **Server + app hechos (20/08/2026, 86 tests)**. Contrato copiado del código VIVO de lila (`drive.controller.ts`): `POST /api/drive/files` multipart (`file` + `path`) con JWT `{companyId}` firmado con `LILA_APP_JWT_SECRET`; lila genera la miniatura. **Ruta `apps/lilachat/<chatId>`, NUNCA bajo `drive/`**: ahí los archivos saldrían en el explorador del Portal y un chat privado no se mezcla con documentos de la empresa (el precio es el techo de 100 MB en vez de 2 GB, que alcanza). Subida y mensaje en UN request —si fueran dos, una caída deja archivos huérfanos que nadie ve ni borra—, con el mismo `sendMessage` (membresía, `seq`, idempotencia por `clientKey`, sin duplicar reglas). El teléfono NUNCA sube directo a lila. **Humo VIVO contra el storage de producción**: `201`, mensaje `seq=3` tipo `image`, miniatura generada, ambas URLs sirven `200`, y el original bajado tiene **el mismo SHA-256** que el subido — no se recomprime, que es la promesa de la fase. **E2E de CÁMARA verificado (20/08/2026)**: foto tomada con la cámara del emulador → subida a lila → `seq=4` tipo `image` con miniatura en la base → las dos burbujas se ven en el chat. Data QA borrada en cero | ✅ |
| F4 ⏳ | **Server + app hechos (20/08/2026, 126 tests)**. **Presencia** en memoria del proceso (se CUENTAN las conexiones: abrir la web teniendo el teléfono abierto no re-avisa, y cerrar uno de dos no pone a nadie fuera de línea); se emite solo a quien COMPARTE un chat —a un desconocido no le incumbe— y al conectar se manda un `presence.snapshot`, sin el cual los puntos verdes solo aparecerían para quien se conecte DESPUÉS. **Acuses en vivo**: `receipt` por socket, y el check deja de depender del valor congelado que traía la lista. **Push**: se manda solo a quien no tiene socket vivo y nunca al autor; el texto dice quién y qué (en grupo, grupo + persona), porque «tienes un mensaje nuevo» obliga a abrir la app para saber si vale la pena. Un duplicado no re-notifica. **E2E con dos clientes de socket reales**: snapshot → presencia ON → acuse en vivo → presencia OFF → push intentado. **Falta**: la credencial de Firebase (abajo) y el E2E de UI en el emulador | dos sockets ✅ · pantalla bloqueada ⏸ |
| F5 ⏳ | **Server + app hechos (20/08/2026, 177 tests)**. Eventos (invitados = MIEMBROS del chat, nunca una lista del cliente; el autor va confirmado), RSVP con resumen, recordatorios personales y compartidos con recurrencia, encuestas con voto único o múltiple. **Cron dentro del server** (`setInterval` de un minuto sobre dos consultas indexadas): sella ANTES de avisar y de forma condicional —si sellara después, dos corridas solapadas mandarían el aviso dos veces—, reprograma los recurrentes limpiando el sello (sin eso un «cada día» suena una vez en su vida) y apaga los de una vez. **UI**: pestañas del diseño en ESPAÑOL (Chats · Encuestas · Eventos · Avisos · Ajustes) — la barra anterior tenía cuatro copiadas del mock en inglés, que es una generación anterior. **E2E contra el server real**: crear evento → RSVP → resumen → encuesta con cambio de voto → cron que reprograma → aislamiento (un extraño ve 0). **Falta**: E2E de las pantallas en el emulador (necesita sesión) | server ✅ · UI ⏸ |
| F6 | web SPA (2 paneles) + Web Push | Chrome real |
| F7 | backups + restore probado + export | restore en DB efímera |
| F8 | IA: @lila, ponme al día, NL→evento, transcripción | grupo familiar real |
| F9 | (opcional) E2EE libsignal | — |
| F10 | llamadas de voz y video (`react-native-webrtc`; señalización por el mismo Socket.IO; TURN propio en la mini con coturn) | llamada real entre 2 teléfonos |
| F11 | Automatizaciones/Smart Routines (recordatorios contextuales, mute programado; los triggers por ubicación se evalúan contra el costo de batería ANTES de prometerlos) | rutina dispara push |
| F12 | Legado Digital (contacto de legado, vault con inactividad, notas cifradas, cápsula del tiempo) | flujo completo con 2 usuarios |
| F13 | **Mongo local de emergencia en la mini** (pedido de José 20/08/2026): mongod pasivo que cada noche RESTAURA el dump de F7 — el respaldo queda verificado a diario y sirve de standby tibio; failover manual = `MONGO_URL` a localhost + reinicio, procedimiento escrito | simulacro de failover |

### 13.3 Lo que costó el E2E de F3

| Síntoma | Causa real | Fix |
| --- | --- | --- |
| La burbuja aparece pero la imagen queda EN BLANCO | el mensaje persiste la URL **relativa** (correcto) y nadie la resolvía al servir | `messageView.toClientMessage` resuelve al servir, en las TRES puertas (socket, `sync.pull`, historial REST). Persistir la absoluta rompería todos los mensajes viejos al cambiar de hosting — ya pasó en Portal con `localhost` en producción |
| «Sin conexión» subiendo, con la red perfecta | **Expo SDK 57 reemplazó el `fetch` global** por su implementación «winter», cuyo FormData solo acepta strings o Blobs: el `{uri, name, type}` clásico de RN muere con «Unsupported FormDataPart implementation». El mensaje en pantalla acusaba al wifi | subir con **XMLHttpRequest**, que sigue leyendo del disco de forma nativa (leer 90 MB a un Blob cargaría el video en memoria JS, que además es lo que corrompe archivos grandes en Expo). De regalo: progreso de subida |
| El error no decía nada útil | el `catch` traducía TODO a «sin conexión» | el motivo real va al log (`console.warn`); el texto al usuario sigue simple. Sin eso, este bug eran horas revisando la red |

### 13.2 Lo que costó el E2E de F2

| Síntoma | Causa real | Fix |
| --- | --- | --- |
| El server no arranca: `Cannot find module shared/src/tokens.js` | `shared` apuntaba a TS (`main: src/index.ts`) y Node en producción no ejecuta TS — funcionaba solo porque hasta F1 nadie lo importaba en runtime | `shared` compila a `dist` y el build de la raíz lo hace ANTES del server |
| Metro: `Unable to resolve ./tokens.js` desde shared | `shared` usa ESM de Node (`import './x.js'` → archivo `.ts`) porque el server compila con NodeNext; Metro no entiende ese mapeo | `resolveRequest` en `metro.config.js` que quita el `.js` **solo** para módulos de `shared/src`. Quitar la extensión en el fuente rompería al server, que es donde duele |
| `AsyncStorage is null` con el bundle correcto | módulo NATIVO agregado después del último build nativo: el APK del emulador no lo tenía enlazado | `expo run:android` de nuevo. Regla: **toda dependencia con parte nativa exige rebuild**, no basta reiniciar Metro |
| Metro y el emulador se caían al terminar un comando largo | lanzarlos con `nohup` dentro de un comando que después expira mata el grupo de procesos | van como tarea de fondo propia, no encadenados a un comando con timeout |
| «El mensaje se ve en pantalla» pero la base tenía 2 filas | el tap de QA cayó al lado del botón: el texto seguía en el INPUT, no en una burbuja. La pantalla se veía idéntica a un envío correcto | las coordenadas salen del dump de `uiautomator` (`bounds` por `resource-id`), nunca a ojo. Y **la verificación es la BASE**, no la captura: sin ese `find` la fase se habría dado por hecha |

**Y una decisión de diseño que el E2E confirmó**: Metro apunta a `shared/src`, no a `shared/dist`. Si apuntara al dist, la app bundlearía código viejo cada vez que alguien tocara un motor sin recompilar — sin ninguna señal de que quedó atrás.

### 13.1 Lo que costó el E2E de F1 (para no repetirlo)

| Síntoma | Causa real | Fix |
| --- | --- | --- |
| Pantalla roja «Cannot read properties of undefined (reading transformFile)» | `babel.config.js` referenciaba `babel-preset-expo` sin instalarlo — el mensaje NO lo nombra; la línea que sí lo dice está enterrada: «Failed to construct transformer: Cannot find module 'babel-preset-expo'» | instalarlo como devDependency y `expo start --clear` |
| `assertVisible: "Hola 👋"` fallaba con el texto EN pantalla | el emoji se codifica distinto según la capa que lo lea (el dump lo da como `&#128075;`) | **los matchers de Maestro no usan emojis**: se afirma sobre el subtítulo |
| «Tap on btn-continuar FAILED» | `pressKey: Enter` YA dispara `onSubmitEditing` y navega: el tap buscaba un botón que ya no existía | quitar el tap; el Enter es el submit |
| El mismo paso pasó y falló sin cambiar nada | `launchApp: clearState` en un dev build re-descarga el bundle de Metro (35 s la primera vez) | `extendedWaitUntil` con 60 s; y ante un rojo en `launchApp`, **reintentar una vez antes de leerlo como defecto** (`rn-app-loop` §4b) |

### 13.5 El canal WhatsApp del OTP estaba SIN CABLEAR

`porWhatsapp` en constroad-auth devolvía `{ok: false, motivo: 'canal whatsapp
todavía no cableado'}` **desde el día uno**. Nadie lo notó porque los
consumidores de entonces —Torre y lilastore— usan email; Lilachat es el primero
con destino telefónico. El síntoma era el peor posible: la pantalla decía «te
mandamos el código» y no llegaba nada.

Cableado el 20/08/2026 contra lila (`POST /api/message/{sender}/text`, contrato
copiado del cliente vivo de Portal), con JWT HS256 firmado con `node:crypto`
para no sumarle `jsonwebtoken` a un servicio deliberadamente liviano. **Probado
contra lila real: `ok: true`.**

**Queda pendiente de José**: commitear/pushear `constroad-auth`, agregar
`LILA_SERVER_URL` y `LILA_APP_JWT_SECRET` al `.env` de producción en la mini, y
desplegar. Hasta entonces la producción sigue con el stub y el OTP telefónico
solo funciona por el respaldo de correo.

**Y un hallazgo del emulador**: el AVD tenía `hw.keyboard=no`, así que escribir
con el teclado del Mac no hacía nada — había que usar el teclado en pantalla.
Corregido en `~/.android/avd/timon.avd/config.ini`.

### 13.4 Lo que costó el E2E de F4

| Síntoma | Causa real | Fix |
| --- | --- | --- |
| `E11000 dup key: { email: null }` al crear el segundo usuario | el índice `email_1` **único** sobrevivió del esquema en que el email era la identidad. **Mongoose crea los índices que declara pero nunca borra los que dejó de declarar** | `sparse: true` en el esquema + `scripts/fix-indexes.ts` que borra el obsoleto. **Los tests con base en memoria NO pueden ver esto**: arrancan sin índices previos, así que el único que lo destapa es el E2E contra la base real |
| Taps de QA que «no hacen nada» | tocar coordenadas leídas de un dump viejo, después de que la pantalla cambió | releer el dump ANTES de cada tap, no una vez al principio |

## 14. Sin verificar / abiertos

- Marca: logotipo dark APROBADO; falta derivar el light en mayúsculas,
  vectorizar y producir las capas del adaptive icon (§2.3).
- `.env` completo: llave, callback y `MONGO_URL`. **Deuda declarada**: el
  `MONGO_URL` actual usa las credenciales de Portal (fue el puente del humo).
  José crea en Atlas el usuario `lilachat_app` (`readWrite` @ `lilachat_db`,
  nada más) y se actualiza el `.env`; ahí Portal y Lilachat quedan aislados
  también a nivel de credencial.
- Runtime dev y prod: Atlas (`MONGO_URL` en `.env`, fail-closed); los tests
  usan memory-server.
- **Push: falta la credencial.** José tiene que crear el proyecto de Firebase,
  bajar `google-services.json` a `app/` y poner `FCM_SERVER_KEY` en el `.env`
  del server. Hasta entonces el camino completo funciona y el emisor **dice**
  que no envía (`[push] FCM_SERVER_KEY no está configurada`) en vez de fingir.
- El E2E de push con la pantalla bloqueada queda pendiente de esa credencial.
- Confirmar con José: identidad por teléfono + código por email (§5, asunción).
- `lilachat.app`: compra opcional, decide José.
- Nada de este spec tiene código aún; ningún endpoint existe.
