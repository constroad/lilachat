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
| E2EE | **por conversación, opt-in** (F9, 24/08/2026). Chats normales sin cifrar; «chat secreto» cifrado con X25519+HKDF+AES-GCM (`@noble`, no libsignal — es nativo y son 3 plataformas) | mismo trade-off que Telegram, pero el server es NUESTRO. Cifrar TODO habría apagado a Lila, el respaldo legible y la búsqueda del server sin que nadie lo pidiera |

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
| F5 ⏳ | **Server + app hechos (20/08/2026, 177 tests)**. Eventos (invitados = MIEMBROS del chat, nunca una lista del cliente; el autor va confirmado), RSVP con resumen, recordatorios personales y compartidos con recurrencia, encuestas con voto único o múltiple. **Cron dentro del server** (`setInterval` de un minuto sobre dos consultas indexadas): sella ANTES de avisar y de forma condicional —si sellara después, dos corridas solapadas mandarían el aviso dos veces—, reprograma los recurrentes limpiando el sello (sin eso un «cada día» suena una vez en su vida) y apaga los de una vez. **UI**: pestañas del diseño en ESPAÑOL (Chats · Encuestas · Eventos · Avisos · Ajustes) — la barra anterior tenía cuatro copiadas del mock en inglés, que es una generación anterior. **E2E contra el server real**: crear evento → RSVP → resumen → encuesta con cambio de voto → cron que reprograma → aislamiento (un extraño ve 0). **E2E de las 3 pantallas verificado en el emulador (24/08/2026)**: Eventos muestra «Mañana, 6:01 p. m.» + ubicación + los tres botones con «Voy» marcado + resumen; Encuestas pinta las barras de porcentaje y **votar MUEVE el voto** (Pollo 100%→0%, Ceviche 0%→100%), no lo duplica; Avisos trae el segmentado «Mis recordatorios / Compartidos», los chips Diario/Semanal y el «Próximo: …». Data QA en cero | ✅ |
| F6 ✅ 24/08/2026 | **Web SPA hecha** (Vite + React + Tailwind con los MISMOS tokens y motores de `shared`, 15 tests). Dos paneles con la composición del diseño: lista con marca/buscador/pie fijo de perfil, y conversación con burbujas agrupadas —avatar en el ÚLTIMO del grupo—, chip de día, checks de entrega y composer `+`/campo/emoji/enviar. El panel se reduce a UNO debajo de 900 px, con volver. **Estado vacío** con bienvenida y dos garantías CIERTAS (servidor propio, multidispositivo): la del diseño prometía cifrado extremo a extremo, que es F9. Express sirve el bundle: un origen, sin CORS, una entrada en Torre. **Web Push VAPID**: `GET /push/key`, `POST/DELETE /push/subscribe` atado al dispositivo del JWT, enrutado por plataforma (FCM ↔ Web Push) y borrado de la suscripción muerta ante 404/410. **E2E en navegador real**: login por OTP, lista con no-leídos, abrir chat, enviar con Enter y con el botón, acuse que baja el contador, un solo panel a 420 px sin desborde. Camino de push cruzado contra el server vivo (204/400/204 + enrutado). **Falta**: otorgar el permiso de notificaciones en un navegador donde se pueda (el del panel lo tiene denegado) | UI ✅ · push permiso ⏸ |
| F7 ✅ 24/08/2026 | **Respaldo, restore y export** (237 tests en total). Motor puro con la retención de 30 días que **nunca deja la carpeta vacía** —un reloj mal puesto o una máquina apagada un mes harían ver todo vencido, y la limpieza borraría el último respaldo justo el día que se necesita— y `summarizeBackups` con `stale`, que es lo que impide pintar un cartel verde sobre una carpeta sin respaldos. Runner: `mongodump` + **manifiesto de media** (la lista, no los binarios: ya viven en lila) → `tar.gz`, armado en un temporal y movido al final para que un corte no deje un tar truncado que parece válido. Cron DENTRO del server que **no pregunta la hora sino «¿ya hay uno de hoy?»**: si la mini estuvo apagada a las 4:30, el respaldo se hace igual. `GET /backup`, `POST /backup/run` (con candado: dos toques no lanzan dos dumps), `GET /backup/export/:chatId` con la **membresía como permiso** y el mismo 403 para «no existe» y «no sos miembro». `scripts/restore.ts` **exige el destino explícito**, sin default a `MONGO_URL`. Pantalla de Ajustes → Copia de seguridad, sin las dos mentiras del mockup (Google Drive y «cifrado extremo a extremo», que es F9). **E2E**: sembrar → mongodump real → restaurar en mongod efímero → comparar documento por documento, incluida una foto que vuelve con su URL intacta; y en el emulador, «Respaldar ahora» creó el archivo y la pantalla pasó de 3.1 KB a 6.2 KB sola | **restore en DB efímera ✅** + emulador ✅ |
| F8 ⏳ 24/08/2026 | **Asistente hecho** (267 tests). **Stitch NO diseñó ninguna pantalla de IA** —el spec las lista como pendientes (§4)—, así que la UI es decisión propia y está anotada como tal en el código. Motor puro: `detectLilaMention` (sin mención NO se llama al modelo — es la diferencia entre un asistente al que se invoca y uno que lee todo), `selectContextMessages` con DOS topes (40 mensajes y 8 000 caracteres, recortando lo viejo) y **excluyendo media** —una URL del storage viajando a un tercero no aporta al resumen—, y `parseEventDraft` que valida la salida del modelo **como si viniera de un cliente hostil**. Server: `POST /assistant/catch-up` desde MI cursor de lectura, `POST /assistant/event-draft` que devuelve BORRADOR y no crea nada (una frase mal entendida no puede invitar a toda la familia), `@lila` por socket DESPUÉS del ack —la conversación no espera al modelo— con la respuesta guardada como un mensaje más, con su `seq`, y **Lila se suma al chat como miembro** en vez de saltarse el control de acceso. Freno de 6 llamadas por minuto y por usuario: el asistente cuesta por llamada. **E2E vivo (6 pasos) contra el server real** con un doble local de Anthropic: resumen, extraño 403 sin llamar al modelo, borrador sin crear evento, mención por socket respondida en `seq=4`, el prompt lleva la conversación y la clave viaja en `x-api-key`, y el freno devuelve 429. **Falta**: `ANTHROPIC_API_KEY` de José para probar contra el modelo real, y la transcripción de notas de voz (whisper.cpp) | E2E con doble ✅ · modelo real ⏸ |
| F9 ⏳ 24/08/2026 | **Cifrado extremo a extremo por conversación** (310 tests). **Chats secretos opt-in**, como los secret chats de Telegram: los normales conservan Lila, respaldo y búsqueda; los cifrados los pierden, y la interfaz tiene que decirlo. Motor en `shared/e2ee.ts`: X25519 + HKDF + AES-GCM con `@noble` (JS puro, auditado) — **no libsignal**, que es nativo y obligaría a un módulo por plataforma; se gana que el MISMO código cifre en teléfono, web y server. Ratchet SIMÉTRICO (clave por mensaje, forward secrecy), **sin el paso DH de Signal**: está escrito en el módulo, no se dibuja como si fuera Signal. Huella de verificación en grupos de 5 dígitos, ordenada para que salga igual en los dos teléfonos. Base64 propio porque `Buffer` no existe en Hermes ni en el navegador. Server: `POST /api/keys` atado al dispositivo **del JWT** —publicar la clave de otro es EL ataque contra un directorio de claves—, `GET /api/keys/:userId` con proyección explícita, `encrypted` en el chat (se decide al crear, no se cambia), y **`sendMessage` descarta `body` cuando viene sobre**: si aceptara los dos, un cliente con bug dejaría texto en claro dentro de un chat con candado. El asistente devuelve **409** en chats cifrados. **E2E vivo de 7 pasos**: publicar claves, traer la del otro, huella común, crear chat secreto, enviar por socket mandando texto Y sobre, comprobar que en la base **no hay nada legible**, descifrar del otro lado y confirmar que Lila queda cortada. **UI hecha y verificada en el emulador (24/08/2026)**: interruptor «Chat secreto» en Nuevo chat —se elige ANTES de tocar a la persona, y NO reusa el chat normal existente porque sus mensajes viejos ya están en claro—, candado junto al nombre en la lista y en la cabecera, «Mensaje cifrado» como vista previa (el server manda el sobre: no hay nada que mostrar), banda de cifrado que reemplaza a la de Lila, hoja de **huella de seguridad** con las TRES consecuencias dichas sin letra chica, aviso si no se pudo cifrar —el mensaje NO se manda—, y `crypto.getRandomValues` enchufado para Hermes. **E2E**: crear chat secreto con Mamá → enviar «la clave es 4821» → se lee en el teléfono y en la base solo hay sobre (`body: NINGUNO`). **Falta**: persistir el estado del ratchet entre reinicios, y un sobre por dispositivo para multi-device | E2E servidor ✅ · emulador ✅ |
| F10 ⏳ 24/08/2026 | **Señalización y pantalla hechas** (342 tests). Máquina de estados en `shared/call.ts`: rechazar una ENTRANTE ≠ colgar una activa —la primera es una perdida que va al chat—, el reloj cuenta desde que se CONECTÓ (los 30 s de timbre no son conversación), una llamada terminada NO revive con un evento tardío, y el tiempo mata lo que nunca conectó pero no una llamada activa. Señalización por el MISMO Socket.IO: el server es cartero de ofertas, respuestas y candidatos; el audio va directo entre los dos. **Credenciales TURN EFÍMERAS** (esquema REST de coturn, HMAC-SHA1, 12 h): una contraseña fija en el APK es un relay gratis para cualquiera que abra el archivo — el abuso clásico de los TURN mal configurados. Pantalla de llamada con la composición de la captura. **E2E vivo de 6 pasos** + 8 tests con DOS clientes de socket reales: la oferta llega, quien llama NO se llama a sí mismo, **un extraño no puede hacer sonar el teléfono de nadie**, respuesta y candidatos viajan, colgar se entera el otro, y el secreto del TURN no viaja. En el emulador: los botones en la cabecera, la pantalla de llamada, y el corte automático a los 30 s. **FALTA para una llamada real**: instalar `react-native-webrtc` (módulo NATIVO, exige rebuild), conectar el `RTCPeerConnection`, levantar coturn en la mini, y probar entre DOS dispositivos — con un emulador no se puede | señalización ✅ · media ⏸ |
| **P1 · Deploy a producción** (pedido de José 24/08/2026). **Hostname decidido: `lilachat.constroad.com`** — `chat` a secas le habría ganado a un tenant de Portal con ese slug, porque la regla del túnel va arriba del comodín. **UN SOLO PROCESO sirve las tres cosas**: `node server/dist/index.js` levanta la API, el Socket.IO (colgado del MISMO servidor HTTP) y la web (Express sirve `web/dist`). Verificado simulando el arranque de Torre en :3004 — health 200, `/` la SPA, y el websocket autenticado CONECTA. Entrada lista para el PR:<br>`{"repo":"git@github.com:constroad/lilachat.git", "path":"/Users/jose/deploys/lilachat/repo", "branch":"main", "port":3004, "build":"npm-ci-build", "service":"com.constroad.lilachat", "health":"http://127.0.0.1:3004/api/health", "exec":"node", "entrada":"server/dist/index.js", "sharedFiles":[".env"]}`<br>Variables del `.env` de la mini: **`JWT_SECRET`** (sin él el server arranca, responde el health y **rechaza a todos en silencio** — ahora falla al arrancar y lo dice), `MONGO_URL`, `CONSTROAD_AUTH_KEY`, `LILA_SERVER_URL`, `LILA_APP_JWT_SECRET`, `LILA_PUBLIC_URL`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `BACKUP_DIR`; opcionales `ANTHROPIC_API_KEY`, `TURN_URL`, `TURN_SECRET`. | **BLOQUEA todo lo demás.** Registrar `lilachat` en `torre.apps.json` por PR (Torre solo se edita así, spec de Torre §5.6), launchd + túnel, y **decidir el hostname**: `chat.constroad.com` ya responde con OTRO servicio. El host va horneado en el APK (`EXPO_PUBLIC_API_URL` es config de BUILD), así que cambiarlo después obliga a republicar | `curl /api/health` contra el host público |
| **P2 · APK de Lilachat en LilaStore** (pedido de José 24/08/2026) | **Bloqueado por P1** (el APK hornea la URL) y por el keystore: `~/.gradle/keystores/` tiene `timon` y `lilastore`, **no `lilachat`**. Lo crea José con `lila keystore create lilachat` — un keystore perdido significa no poder actualizar la app nunca más, así que no lo genera un asistente | APK instalable desde lilastore.constroad.com |
| **P3 · Autoactualización de apps instaladas** (pedido de José 24/08/2026) | **Android NO permite que una app se actualice sola** salvo como device owner (modo MDM): `PackageInstaller` siempre muestra la confirmación del sistema. Lo alcanzable: la app **detecta** la versión nueva, la descarga y abre el instalador — un toque del usuario. Ya existe media pieza: `GET /api/v1/store/version` y `apps/[slug]/min-version` con el bloqueo por versión mínima, y la pantalla «Mis apps y actualizaciones» de la tienda. **Falta**: chequeo en segundo plano (que se entere sin abrir la tienda), y `REQUEST_INSTALL_PACKAGES` + descarga + `ACTION_INSTALL_PACKAGE` | una app vieja avisa y ofrece actualizar |
| **P4 · Aviso de versión nueva en LilaStore web** (pedido de José 24/08/2026) | El plan B de P3, y más barato. `/get` ya muestra la versión vigente de la TIENDA. **Falta**: una página pública por app que diga «hay 0.4.0, vos tenés 0.3.0» y el enlace de descarga — para quien no puede o no quiere autoactualizar | la web dice la versión y ofrece bajarla |
| **P5 · Push por foreground service, SIN Firebase** (decidido por José 24/08/2026) | **Firebase queda fuera del plan.** El aviso con la app cerrada lo da un *foreground service* que mantiene el socket vivo — el mismo patrón que en Timón reemplazó al permiso de ubicación en segundo plano. Cuesta una notificación permanente y algo de batería; para una familia es aceptable, y saca a Google del camino. Hay que borrar `FCM_SERVER_KEY` y `buildFcmSender` de `pushSender.ts`, y dejar Web Push VAPID solo para la web (ahí sí es el estándar del navegador y no depende de Google) | mensaje recibido con la app cerrada y sin FCM |
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

### 13.13 El primer deploy en Torre falló, y por qué

```
src/authRoutes.ts(4,36): error TS2307: Cannot find module '@lilachat/shared'
```

Diez archivos a la vez, con `shared` recién compilado dos líneas antes en el
mismo log. **No era un problema de orden de build.**

**Torre MUEVE `node_modules` a un almacén compartido** (`deploy.sh`: `mv` a
`$NM_CACHE/$HASH_LOCK/node_modules` y `ln -sfn` de vuelta) para no reinstalar en
cada deploy. Con npm workspaces, `node_modules/@lilachat/shared` es un symlink
**relativo** a `../../shared`; desde el almacén ese camino no lleva a ningún
lado y queda colgado. El resto de las dependencias funciona perfecto, así que el
fallo parece de nuestro código.

**El arreglo no es pelear con el almacén: es que la release no dependa del
enlace.** `server/build.js` empaqueta con esbuild y un alias que mete `shared`
ADENTRO del bundle; todo lo demás queda externo (`packages: 'external'`), porque
esas sí viven en `node_modules`, que es justo lo que el almacén sirve bien. Es
el mismo patrón de lila y constroad-auth. El `dist` resultante no menciona
`@lilachat/shared` ni una vez.

**Verificado reproduciendo la condición**: se copió la release a un temporal
SIN `shared/` al lado, con `node_modules` movido a otra carpeta y enlazado —el
symlink de `@lilachat/shared` colgado, igual que en Torre— y el server arrancó:
health 200, la web 200 y el socket 200.

Dos cosas más que salieron de ahí:

- El `banner` de `createRequire` que copié de constroad-auth **duplicaba** el que
  `app.ts` ya declara: «Identifier 'createRequire' has already been declared», y
  el proceso no arranca. Constroad-auth lo necesita porque su código no lo tiene;
  el nuestro sí.
- `tsc` pasa a `--noEmit` (esbuild emite) y con `paths` a `../shared/src`, así
  que el typecheck tampoco depende del symlink.

### 13.12 Lo que costó la UI del chat secreto

| Síntoma | Causa real | Fix |
| --- | --- | --- |
| «Unable to resolve @noble/ciphers/aes.js», con el paquete instalado y visible desde Node | un import que nace en `shared/src` se resuelve desde `shared/`, y sus dependencias están hoisteadas en el `node_modules` de la RAÍZ, que Metro no observaba. **Instalarlo en `app/` NO lo arregla**: el import no nace ahí | `nodeModulesPaths` + `watchFolders` con la raíz del monorepo |
| «crypto.getRandomValues must be defined» al abrir el primer chat secreto | Hermes no trae el generador aleatorio de WebCrypto, y toda librería de cripto seria lo pide | polyfill con `expo-crypto`, importado PRIMERO en `App.tsx`. **Nunca un `Math.random` de reemplazo**: un nonce predecible rompe AES-GCM entero |
| El mensaje llegaba al server sin texto Y sin sobre | una edición mía a `outboxStore` **nunca se aplicó** y el frame del socket seguía mandando solo `body` — que en un chat cifrado ya no existe | verificar con `grep` que el cambio ESTÁ, no asumir que el reemplazo funcionó |
| Burbuja vacía en lo pendiente | la cola guarda el sobre, no el texto: correcto, pero entonces no hay qué mostrar mientras está encolado | vista local **en memoria**, nunca persistida; tras un reinicio dice «🔒 Cifrado», que es la verdad |
| «No se pudo descifrar» en un mensaje propio recién enviado | el descifrado se horneaba AL GUARDAR en el estado. La sesión tarda un instante en tener la clave del otro, así que lo que entraba antes quedaba mal **para siempre** | descifrar al RENDERIZAR (`useMemo` derivado): en cuanto la sesión está lista, todo se lee bien solo |
| El 1:1 se llamaba «Conversación» | la lista nunca resolvió el nombre del otro miembro — un hueco que ya estaba, visible recién con un chat directo | `listChats` resuelve el nombre del otro en los `direct` |

### 13.11 Lo que F9 obliga a decidir (24/08/2026)

El cifrado no es una función que se agrega: **apaga otras**. Antes de escribir
una línea había que elegir qué se rompe.

| Choque | Decisión |
| --- | --- |
| Lila lee los mensajes para resumir (F8) | en un chat cifrado el server **no tiene** el texto. `EncryptedChatError` → **409**, distinto del 403: no falta permiso, falta contenido |
| El respaldo guarda texto legible (F7) | de un chat secreto guarda sobres. Se restauran, pero solo los abre quien tenga las claves del dispositivo |
| La búsqueda del server | no alcanza lo cifrado; solo se busca lo que está en el teléfono |
| Multi-dispositivo | por ahora una clave por persona (la del primer dispositivo). Un sobre por dispositivo queda pendiente |

Por eso el cifrado es **por conversación y opt-in**. Cifrar todo habría apagado
las tres cosas sin que nadie lo pidiera, y **prometer candado y además resumen
automático sería mentir** — que es la misma regla por la que la tarjeta de
«cifrado de extremo a extremo» no se shipeó en F6 ni en F7.

Dos cosas que el módulo dice y la interfaz NO debe contradecir:

- **No es Signal.** Hay ratchet simétrico (clave por mensaje, forward secrecy)
  pero falta el paso DH periódico: quien robe el estado actual sigue leyendo lo
  que venga hasta que la sesión se rehaga.
- **Los metadatos siguen en claro.** Quién le escribe a quién y cuándo, porque
  el server necesita repartir. Se protege el contenido, no el hecho.

### 13.10 Huecos de uso que encontró José (24/08/2026)

Cuatro reclamos, todos ciertos, y ninguno era «se ve distinto»: eran cosas que
no se podían hacer.

| Reclamo | Qué faltaba | Cómo quedó |
| --- | --- | --- |
| «Eventos y avisos deberían ser el mismo menú» | dos pestañas para la misma pregunta —«¿qué tengo por delante?»— | pestaña **Agenda** con segmentado; el botón de crear ofrece los DOS tipos en vez de adivinar por el filtro. La barra bajó de 5 pestañas a 4 |
| «¿Por qué en nuevo evento me pide conversaciones y no contactos?» | que el evento viva en un chat es del server, y se estaba filtrando a la interfaz | se eligen **contactos**; al confirmar se resuelven al 1:1 que ya existe o a un grupo nuevo. `GET /api/contacts` = la lista de INVITADOS, no «todos los usuarios» |
| «Desde un chat debería poder crear encuestas y eventos, como WhatsApp» | solo se podía desde las pestañas | el `+` de la conversación trae Evento y Encuesta, con ese chat ya elegido (`fixedChat`) |
| «El lápiz no hace nada» | el `onNewChat` era `() => undefined` | pantalla **Nuevo chat** con los dos pasos de las capturas: contactos agrupados por letra → nombre con contador `0/25` y participantes con su × |

**Defectos encontrados de paso**, todos reales:

- **El 1:1 se DUPLICABA**: crear dos veces con la misma persona dejaba dos
  conversaciones y los mensajes repartidos, sin forma de juntarlos. El server
  ahora devuelve la existente. Los grupos sí se repiten, a propósito.
- **Un grupo podía crearse sin nombre**, y la lista lo mostraba sin título.
- **`onRequestClose` otra vez**: `NewChatScreen` no tenía el guard y bajar el
  teclado con atrás tiraba el grupo a medio armar. Es la tercera pantalla en la
  que aparece; el guard va en TODO modal con formulario.
- **Una ruta que falla nunca respondía.** Con Mongo desconectado, cada consulta
  quedaba como promesa rechazada: la red de seguridad del proceso la registraba
  —y evitó la caída— pero el cliente esperaba para siempre. Ahora hay
  `asyncRoute` + manejador de errores de Express: 500 con mensaje.
- El chat recién creado abría con el título genérico «Conversación» porque el
  salto no llevaba el nombre.

**Y lo que costó el E2E**: el emulador se quedó **sin red** («Network is
unreachable») y ni `adb reverse` ni cambiar el host del bundle sirven cuando
pasa eso — se ve como «Metro no responde» y se persigue el bundler durante una
hora. Un ciclo de wifi lo recupera a veces; lo que lo arregla de verdad es
arrancar el emulador **en frío** (`-no-snapshot`). Antes de tocar Metro:
`adb shell ping -c 1 10.0.2.2`.

### 13.9 Las pantallas de crear no se parecían al diseño (corregido 24/08/2026)

José: «¿por qué mierda el screen de eventos y avisos no se parece al de Stitch?
¿otra vez construyendo sin mirar el diseño?».

**Lo que pasó, y no es lo mismo que las veces anteriores.** Los diseños de
eventos y encuestas son `crear-evento.png` y `crear-encuesta.png` —pantallas de
CREAR—. Se construyó `CreateSheet`, un modal genérico compartido por los tres
tipos, **sin abrir ninguna de las dos capturas**. Después se auditaron las
pantallas de LISTA, que Stitch nunca dibujó, y se informó «verificado contra el
diseño». O sea: se verificó lo que se había mirado y se reportó como si se
hubiera mirado todo.

| Diseño | Lo que había | Corrección |
| --- | --- | --- |
| «New Event»: héroe centrado (icono en círculo + título en acento + subtítulo) | modal con X y título a la izquierda | `CreateEventScreen` con el héroe |
| Campos RELLENOS en superficie tintada, sin borde | inputs con borde sobre blanco | `FilledField` en `createUi.tsx` |
| «Cuándo y dónde» = filas con icono y chevron | un campo numérico «horas desde ahora» | `PickerRow` que despliega opciones |
| «Invitados» con caras y contador a la derecha del rótulo | lista vertical de chats | fila horizontal con check en la elegida |
| «Opciones» con dos interruptores | no existía | avisar 1 h antes · pueden invitar |
| «New Poll»: título a la IZQUIERDA, sin héroe (distinto a propósito) | mismo layout que evento | `CreatePollScreen` propia |
| «My Reminders»: tarjeta tintada, TRES líneas, icono de color propio | tarjeta blanca con borde, dos líneas, todo morado | nota nueva en el esquema + color estable por id |

**Y el E2E encontró un defecto de fondo mientras se verificaba**: cerrar el
teclado con ATRÁS disparaba `onRequestClose` y **tiraba la encuesta a medio
llenar**. Está documentado en la skill desde Timón y se volvió a cometer; ahora
atrás solo cierra si no hay nada escrito.

Reglas agregadas a `constroad-premium-ui` (commit `15c5618`, pusheado e
instalado): inventario captura → pantalla ANTES de escribir; un componente que
sirve a varios diseños es un olor; y «verificado» tiene que nombrar las capturas
comparadas.

### 13.8 Lo que costó el E2E de F7

Dos de los tres defectos son **la misma falta que F6**: campos escritos de
memoria en vez de leídos del esquema. Y esta vez uno se escondió detrás de un
número creíble.

| Síntoma | Causa real | Fix |
| --- | --- | --- |
| El server ENTERO se murió al exportar | el nombre del chat iba directo a `Content-Disposition`, y «QA-F7 — borrar» lleva un guion largo: Node rechaza el header con `ERR_INVALID_CHAR`. Al ser un handler `async` de Express 4, **nadie atrapa el throw y el proceso cae**. Cualquiera podía voltear el servidor poniéndole una tilde al nombre de su chat | `filename` en ASCII + `filename*` UTF-8 (RFC 5987), sin saltos de línea. Y una red de seguridad de proceso que registra en vez de morir |
| Mis tests no lo vieron | el chat de prueba se llamaba **«Familia»**: puro ASCII. Los nombres reales llevan tildes, guiones largos y emojis | los datos de prueba tienen que parecerse a los de verdad |
| «media referenciada: 0», siempre | la consulta miraba `mediaUrl`, y el esquema guarda un subdocumento `media.url`. **Cero archivos es un resultado creíble**, así que el error se leyó como «no hay fotos todavía» durante toda la fase | consulta corregida + el E2E siembra un mensaje CON foto y falla si el manifiesto no la ve |
| El export salía con todas las fechas en `undefined` | mismo origen: leía `createdAt` y el campo es `at` (el esquema no usa timestamps de mongoose). Los tests solo miraban `seq`, `from` y `body` | test que verifica la fecha y la URL de la foto |
| `qa-backup-restore.ts` moría pidiendo un argumento que su llamador nunca le pasó | el guard del script usaba `endsWith('restore.ts')`, y **«qa-backup-restore.ts» termina en «restore.ts»** | comparar el `basename` exacto |
| El restore «no traía nada», con el dump perfecto al lado | dos errores encadenados: le pasaba a `mongorestore` la carpeta DE LA BASE en vez de la raíz del dump (que es de donde deduce el nombre de la base), y después verificaba en la base `test` —la que nombra una URI sin ruta— en vez de en `lilachat_db` | `--dir` a la raíz; verificar con `dbName` explícito |
| `new URL()` con la URI de Mongo → «Invalid URL» | **ya estaba anotado en §13 desde F1** y lo volví a escribir igual | el nombre de la base lo da la conexión |

### 13.7 Lo que costó el E2E de F6 en el navegador

Los cuatro defectos fueron míos, y **ninguno lo veía un test de componente**:
los pedazos estaban bien por separado y la app entera estaba rota.

| Síntoma | Causa real | Fix |
| --- | --- | --- |
| Pantalla en blanco justo al terminar de escribir el código | un `useMemo` DEBAJO del `return` de la pantalla de acceso: al entrar, el componente renderiza más hooks que en el render anterior | todos los hooks arriba del return condicional. El test que lo atrapa tiene que CRUZAR el login — montar ya logueado no falla nunca |
| Pantalla en blanco al recargar logueado | `presence.snapshot` **no** emite un array: emite `{online:[...]}`, y `new Set(objeto)` tira «object is not iterable». Además inventé `presence.online`/`presence.offline`: el server emite UN evento `presence` con booleano | leer `socket.ts` en vez de escribir el contrato de memoria |
| El mensaje enviado se quedaba con el reloj de «pendiente» | inventé un `POST /chats/:id/messages` que **no existe**: los mensajes salen por el socket (`msg.send` con ack). 404 mudo para el usuario | emitir `msg.send` y usar el `seq` del ack |
| El propio mensaje aparecía DOS veces | deduplicaba por `seq`, y el optimista todavía no tiene `seq` —se lo asigna el server—. El eco de `msg.new` nunca encontraba a su gemelo | `mergeIncoming` en `shared`, que deduplica por `clientKey`. **Para eso existe la clave que nace en el cliente** |
| `tsc` en verde y el navegador con «does not provide an export named X» | `tsc` resolvía `@lilachat/shared` al FUENTE (por `paths`) y Vite al `dist` compilado: dos vistas que discrepan apenas se agrega algo sin recompilar | alias de Vite al fuente, para que las dos miren lo mismo |
| «Enter no envía» | falso: el arnés había perdido el foco del campo. Con el foco puesto de verdad, envía | mirar `document.activeElement` ANTES de acusar al código |

**La lección que las agrupa**: tres de los cuatro fueron *contratos escritos de
memoria* —el evento del socket, su payload, la ruta HTTP—. El código del server
estaba a un `grep` de distancia.

### 13.6 Lo que costó el E2E de F5 en el emulador

| Síntoma | Causa real | Fix |
| --- | --- | --- |
| «No puedo editar el número», con el cursor parpadeando | **mi propio arreglo anterior**: puse `hw.keyboard=yes` para que sirviera el teclado del Mac, y con eso Android da por hecho que hay teclado físico y **oculta el de pantalla** | volver a `hw.keyboard=no` + `settings put secure show_ime_with_hard_keyboard 1` |
| Los taps caían en la tecla «.» en vez del botón | el teclado numérico TAPA el botón de abajo | cerrar el teclado (`keyevent 111`) antes de tocar cualquier botón inferior |
| Código correcto rechazado | se sembró el OTP **antes** de que la app pidiera el suyo, y el pedido posterior lo reemplazó — la misma lección que Timón ya había dejado escrita | re-sellar el código que la app ACABA de pedir, no insertar uno nuevo |
| «Sin conexión» con el server vivo | el emulador se quedó **sin interfaz de red** (sin `eth0`, sin rutas) tras las pruebas de corte de red de F2 | reiniciar el emulador; `svc wifi enable` no lo recupera |
| «Sin eventos» con el evento en la base | la data se sembró con `+26 h` cuatro días antes: ya había pasado, y la pantalla muestra lo que VIENE | re-sembrar con fechas futuras. La pantalla estaba bien |

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
- ~~Nada de este spec tiene código aún~~ **Desactualizado el 25/08/2026:** el
  server está en producción (`https://lilachat.constroad.com`, §15).

## 15. Lecciones del primer deploy (24–25/08/2026)

El primer deploy costó **cuatro builds fallidos, una pantalla congelada y ~2
horas**, repartidos entre este repo y la infraestructura de la mini. Lo que
cada fallo enseñó, en orden:

### 1. Un monorepo con workspaces pisa una mina en el almacén de la mini

`npm ci` crea `node_modules/@lilachat/{shared,server}` como **symlinks
relativos** a las carpetas hermanas. El deploy de la mini movía el árbol a un
almacén compartido y esos symlinks quedaban apuntando a la nada: `tsc` moría
con `Cannot find module '@lilachat/shared'` — un error que manda a buscar el
problema a este repo cuando el repo estaba bien. Ya está arreglado en
`deploy.sh` (si hay `workspaces`, los node_modules van dentro de la release),
pero la lección queda: **un error de módulo no encontrado en CI/deploy puede
ser del transporte, no del código.**

### 2. El contrato con Torre es `exec` + `entrada`, y el default miente

El alta registró la app con `exec: "next"` — el default del formulario — pero
este server es Express/esbuild. El deploy verificaba `.next/BUILD_ID`, que no
iba a existir jamás: «BUILD MINTIÓ: salió con 0 pero NO generó el artefacto».
La corrección fue en dos lados: el registro (`exec: node`, `entrada:
dist/index.js`) y el build de este repo, que ahora **bundlea a la raíz**
(`server/build.js` emite `../dist/index.js`) porque ahí es donde Torre busca
el artefacto de una app node.

### 3. launchd no le pasa el `.env` a nadie

El server asumía variables en el entorno; launchd solo pasa lo que el plist
declara (NODE_ENV, PORT, PATH, HOME). El fix (`010ddda`) carga `./env.js`
**como primer import** — antes de que cualquier módulo lea una variable al
importarse — leyendo el `.env` que el deploy enlaza en `current/`.

### 4. El último tramo del alta necesita root EN la mini

Con el build sano, quedaba instalar el servicio (plist + bootstrap + regla de
túnel). Una sesión sin acceso a la mini no puede hacerlo ni verificarlo — y la
hipótesis a distancia («logs con dueño root») era incorrecta: no había logs
porque **no había plist**; el servicio nunca había existido. El método que
cerró la discusión: arrancar el server a mano con el entorno EXACTO del plist
(`env -i HOME=… PATH=… NODE_ENV=production PORT=3004 node dist/index.js`) —
health 200 y mongo conectado en 4 segundos — y recién entonces instalar.
**Validar el arranque con el entorno de launchd ANTES de instalar** separa «la
app está rota» de «falta infraestructura» en un solo comando.

### Estado final

`com.constroad.chat` corriendo con QoS `Standard`, health local y público en
200, túnel `lilachat.constroad.com → 127.0.0.1:3004` delante del comodín. El
id interno en Torre es `chat` (registro, servicio, carpetas); el hostname
público es `lilachat.constroad.com` — no tienen por qué coincidir y no
coinciden.

## 16. La web sabía leer, no escribir (25/08/2026)

Con `lilachat.constroad.com` ya en pie, José la abrió y encontró el defecto que
ningún test cubría: **desde la web no se podía crear nada**. Ni chat, ni grupo,
ni evento, ni encuesta. La web tenía lista + conversación + estado vacío, y todo
lo demás vivía SOLO en la app RN.

No fue un olvido puntual sino la consecuencia de haber construido F6 (la web)
antes que F8 (agenda) y no haber vuelto: cada fase agregó pantallas al teléfono
y ninguna las agregó al navegador.

### 16.1 Un motor para los dos clientes: `planTargetChat`

Un evento y una encuesta **cuelgan de una conversación** —el server saca de ahí
los invitados, así nadie invita a alguien ajeno al chat—, pero a la persona se le
preguntan **contactos**: pedir «elegí una conversación» para armar un cumpleaños
la obliga a pensar en la estructura de datos.

Esa traducción estaba escrita DENTRO de `CreateEventScreen` de la app. Al
llevarla a la web habría nacido una segunda versión con otro criterio, y dos
clientes creando grupos distintos con los mismos contactos. Se sacó a
`shared/src/agenda.ts` con sus siete tests:

| Entrada | Salida |
| --- | --- |
| abierto desde un chat | ese chat, sin preguntar |
| 1 contacto | chat directo (el server no lo duplica) |
| 2+ contactos | grupo con el nombre del evento/pregunta |
| contacto repetido | cuenta una vez (si no, un directo se vuelve grupo de dos) |
| sin contactos | inválido, antes de mandar nada |
| grupo sin nombre | inválido — el server lo rechazaría con 400 al final |

### 16.2 Lo que se agregó a la web

- **Menú «⋮» de la lista** (existía en el diseño y no hacía nada): nuevo chat,
  nuevo grupo, eventos y encuestas.
- **`ContactPicker`** propio de la web, agrupado por letra, uno o varios.
- **`AgendaOverlay`**: lo que se viene + para decidir, con RSVP y voto. Eventos
  y encuestas comparten pantalla: son dos listas cortas que se miran juntas.
- **El «+» del composer**, como WhatsApp: dentro de un chat se crea un evento o
  una encuesta para ESA conversación, sin volver a elegir a nadie.
- **Estado vacío con salida**: la lista vacía ahora ofrece «Empezar un chat».

### 16.3 La copia que anunciaba dónde se guardan los mensajes

El panel vacío tenía una tarjeta «Servidor propio · Tus mensajes viven en nuestra
máquina, no en la de un tercero». José: «no me parece muy acertado decirle al
usuario que estamos almacenando sus mensajes».

Tiene razón, y el motivo importa: la frase es CIERTA y por eso mismo no va ahí.
Nadie abre un chat familiar para que le recuerden dónde queda almacenado lo que
escribe; el dato tranquiliza a quien montó el server y alarma a quien lo usa.

Las dos tarjetas ahora son **lo que se puede hacer**: «Empezar un chat» y
«Organizar algo». La del diseño original prometía cifrado de extremo a extremo
para todo, que sigue sin ser cierto: eso vale solo para los chats secretos (F9).

### 16.4 Y de paso, la encuesta de la app seguía pidiendo conversaciones

La queja de José sobre eventos («¿por qué me pide conversaciones?») se había
corregido solo en `CreateEventScreen`. `CreatePollScreen` seguía con el selector
de chats. Ahora las dos usan `ContactPicker` + `planTargetChat`: la queja de una
pantalla vale para sus hermanas.

### 16.5 Sin contactos no hay nada que crear

En `lilachat_db` hay DOS usuarios: José y Lila (el asistente). `GET /api/contacts`
devuelve `{"groups":[]}`. La web ya tiene todos los botones, pero hasta que se
registre alguien más el selector dice, honestamente, «Todavía no hay nadie más en
Lilachat. Invita a tu familia y aparecerán acá.»

## 17. El ícono: la app se publicó dos veces con el de la plantilla (25/08/2026)

Lilachat 0.1.0 y 0.1.1 salieron a la tienda con **el ícono genérico de Expo** —la
flecha azul de `assets/icon.png` que trae el `create-expo-app`—. Se vio recién al
instalarla en el emulador: en el cajón de apps aparecía la flecha.

Es un defecto barato de cometer y caro de notar: el ícono no rompe ningún test,
no falla ningún build y solo se ve en un teléfono, que es el único lugar donde
nadie mira durante el desarrollo.

### Un SVG, seis archivos

`app/scripts/iconos.mjs` genera todo desde un solo dibujo. A mano son cinco PNG
que se desincronizan al primer retoque.

| Archivo | Para qué |
| --- | --- |
| `icon.png` (1024) | el ícono «plano», y el de la tienda |
| `android-icon-foreground.png` | la capa que Android RECORTA con la máscara del fabricante |
| `android-icon-background.png` | la capa de abajo, degradado de marca |
| `android-icon-monochrome.png` | temas dinámicos de Android 13+ |
| `splash-icon.png` | arranque |
| `favicon.png` | la web |

**La capa de frente vive dentro del 66 % central.** El sistema la recorta con la
máscara del fabricante —círculo, cuadrado redondeado, «squircle»—: llenar el
lienzo entero es lo que produce íconos con las puntas comidas. En el script eso
se consigue ampliando el `viewBox` (`-25 -25 150 150`), no redibujando.

El dibujo es una burbuja de chat con un latido adentro: la burbuja dice
«conversación» sin texto y en cualquier idioma, y el latido es el «pulse» de
Vivid Pulse. Colores SOLO de `shared/src/tokens.ts`; ningún hex nuevo.

### El APK pesaba el triple

El primer intento de 0.1.2 salió en **96 MB** contra los 35.8 MB de la 0.1.1:
`expo prebuild --clean` + `gradlew assembleRelease` a mano compila **las tres
ABIs**. La receta correcta es `lila apk build`, que por defecto compila solo
`arm64-v8a` — el mismo camino que ya usaba LilaStore. Cuando existe un script de
build compartido, invocar Gradle a mano es cómo se cuelan estas diferencias.

### Y una verificación mía que estaba mal

El 25/08 di por instalada la 0.1.1 porque `pm list packages` mostraba
`com.lilachat.app`. Ese paquete era un build de DESARROLLO previo (0.1.0,
versionCode 1) que ya estaba en el emulador: la instalación desde la tienda había
chocado por firma distinta. **Que el paquete exista no prueba que se haya
instalado lo que uno acaba de instalar** — hay que mirar `versionName` y
`versionCode`, o desinstalar antes.

## 18. El APK apuntaba al emulador, y nadie respetaba las barras del sistema (25/08/2026)

Dos defectos que solo se ven en un teléfono de verdad, reportados juntos.

### 18.1 «Sin conexión» en un teléfono con 5G

`app/.env` tiene `EXPO_PUBLIC_API_URL=http://10.0.2.2:4003` —la dirección con la
que el EMULADOR llega a la Mac— y Expo hornea el `.env` al compilar. Las
versiones 0.1.0, 0.1.1 y 0.1.2 salieron con esa URL adentro: en el teléfono de
José esa dirección no existe, y el error correcto («sin conexión») señalaba al
lugar equivocado. Confirmado leyendo el bundle del APK:

```
$ unzip -p dist/lilachat-0.1.2-3.apk assets/index.android.bundle | grep -ao '10\.0\.2\.2[:0-9]*'
10.0.2.2:4003
```

**El arreglo es `lila.json`**, que existe justo para esto: lo declarado ahí PISA
al entorno al compilar, así que el `.env` de desarrollo no puede colarse en un
release. LilaStore ya lo tenía; Lilachat no.

```json
{ "build": { "env": { "EXPO_PUBLIC_API_URL": "https://lilachat.constroad.com" } } }
```

Ahora el build lo dice en voz alta (`✓ EXPO_PUBLIC_API_URL → https://…`) y se
verifica en el binario, no en el código fuente. **Un default correcto en el
código no salva a nadie**: los diez archivos tenían
`?? 'https://lilachat.constroad.com'` y ninguno se usó, porque la variable
estaba definida. (De paso, `pushRegistration.ts` tenía como default el host
viejo `chat.constroad.com`.)

### 18.2 El botón del pie, debajo de la barra de Android

Ninguna pantalla usaba safe area: había un `pb-8` (32 px) y un `pt-14` (56 px)
escritos a mano en las once pantallas. Con barra de gestos alcanza; con la barra
de TRES BOTONES (48 px) el botón queda **debajo** de ella — se ve y no se puede
tocar.

`src/ui/margenes.ts` + `useMargenes()`, y `SafeAreaProvider` en la raíz (sin el
proveedor, `useSafeAreaInsets` devuelve cero y todo sigue igual). La regla es un
**máximo, no una suma**: el inset ya incluye el alto de la barra, y sumarle el
margen de diseño deja un hueco enorme donde el inset es grande. Se acota por
arriba (64 px pie / 80 px cabecera) para que una medición rara no empuje el
botón a media pantalla.

Verificado en el emulador con la barra de tres botones activada a propósito:

```bash
adb shell cmd overlay enable com.android.internal.systemui.navbar.threebutton
```

| Pantalla | Antes | Ahora |
| --- | --- | --- |
| Acceso (Continuar) | tapado por la barra | despejado |
| Pedir el código | — | llega al server real, sin «sin conexión» |

**El mismo defecto estaba en LilaStore** (`Screen` con `padding: lg` por los
cuatro lados): se arregló en ese único lugar, que cubre todas sus pantallas.

### 18.3 `apk publish` falla y hay que reintentar

Subir ~36 MB con el CLI falla intermitentemente con «fetch failed» —una, dos y
hasta tres veces seguidas— y funciona al reintentar sin cambiar nada. **No es un
falso negativo**: se verificó que el catálogo NO quedaba con la versión después
de un fallo, así que reintentar es seguro. La misma subida por `curl` no falló
nunca, lo que apunta al `fetch` de Node con `FormData` grande y no al server.
Pendiente: reintento automático en el CLI.

## 19. Invitar gente y buscar actualizaciones (26/08/2026)

### 19.1 Invitar: la agenda NO sale del teléfono

`InviteScreen` lee los contactos con `expo-contacts`, los muestra y comparte un
mensaje. **Nada de eso viaja al server.** Subir la agenda para cruzarla contra
los registrados es el camino cómodo —y es el que WhatsApp hizo famoso— y es
exactamente lo que acá no se hace: en un chat familiar, con quién habla alguien
es el dato más sensible que existe.

La consecuencia se acepta a conciencia: **no se marca «este ya tiene Lilachat»**,
porque no se puede saber sin mandar los números. Quien ya está aparece en «Nuevo
chat», que es donde corresponde.

El mensaje lleva **las dos** puertas y en este orden (`textoDeInvitacion`, con
test):

1. LilaStore — la que después deja la app actualizándose sola.
2. El APK directo — el atajo para quien no quiere instalar dos cosas.

Con una sola se pierde gente: solo tienda, quien se cansa en el segundo paso;
solo APK, quien queda sin actualizaciones para siempre.

Se comparte con la hoja del sistema (`Share`), no con un `whatsapp://`: no todo
el mundo lo tiene, y un esquema que no resuelve no hace nada y parece roto.

### 19.2 Buscar actualizaciones, en toda app RN

`settings/versionApi.ts` pregunta a `/api/v1/apps/:slug/min-version`, que **no
está autenticado** a propósito: la app no es un dispositivo enrolado en la tienda
y exigirle credencial haría imposible el único mecanismo por el que alguien se
entera de que tiene que actualizar. Sirve tal cual para cualquier otra app RN
nuestra; solo cambia el `slug`.

**Tres estados, no dos** (`resultadoDelChequeo`): hay-nueva / al-día /
**no-se-pudo**. Sin red o con el server caído NO se dice «estás al día»: es la
respuesta que más daño hace, porque deja a alguien en una versión rota
convencido de que no hay nada que hacer.

El chequeo se dispara **con un toque**, no al abrir Ajustes: un pedido de red
cada vez que alguien entra a una pantalla es tráfico que nadie pidió.

La app no se instala a sí misma: abre la descarga y de ahí manda Android. Quien
tenga LilaStore la actualiza desde ahí, **con verificación de `sha256`**; este
botón es para quien la instaló directo y no tiene la tienda.

## 20. Un botón que no hacía nada, y por qué no nos enteramos (26/08/2026)

José tocó «Invitar a alguien» y no pasó nada. Ni un error en pantalla, ni una
línea en el server, ni nada en Torre.

### 20.1 El defecto

`InviteScreen` quedó **importado y nunca renderizado**: la edición que lo montaba
no encontró su ancla y no avisó. `setInvitando(true)` cambiaba un estado que
nadie leía.

Lo que deja al descubierto no es el descuido, es el **hueco de verificación**:
`tsc --noEmit` pasó, la app compiló y se publicó. TypeScript **no marca un import
sin usar** salvo que se lo pida. Ahora `noUnusedLocals` y `noUnusedParameters`
están activos — y al activarlos salieron otros ocho residuos (imports y props
muertas de refactors anteriores).

### 20.2 Lo que faltaba de verdad: enterarse

Un fallo en el teléfono de alguien era invisible. La única forma de saberlo era
que la persona lo contara, y mientras tanto le pasaba a todos los demás en
silencio.

| Pieza | Qué hace |
| --- | --- |
| `ui/ErrorBoundary.tsx` | envuelve la app; un error de render muestra una pantalla con «Reintentar» en vez de dejar todo en blanco |
| `ui/reportarError.ts` | manda el reporte y escribe en el log local; **nunca lanza y nunca bloquea** |
| `shared/crashReport.ts` | arma y valida el reporte, con topes duros |
| `POST /api/crash` | lo recibe y escribe **una línea en stdout**, que es lo que Torre recoge |

**Sin autenticar, a propósito.** Una app que revienta al arrancar no llegó a
tener sesión, y ese es justo el caso que más importa ver. A cambio: lista cerrada
de apps que pueden reportar, tope de tamaño, y límite por minuto — un endpoint
abierto que escribe en el log es una forma cómoda de llenarnos el disco.

**Qué NO viaja:** el mensaje se corta en 500 caracteres y el stack en 20 líneas.
Un reporte de error es la vía más fácil para que datos privados terminen en un
log —un mensaje del chat dentro de un stack, un teléfono, un token— y el tope no
depende de que quien lanzó el error se haya portado bien.

Verificado con el server local: un reporte válido deja `[crash] lilachat@0.1.5
android InviteScreen — …` y uno con una app desconocida se descarta sin escribir.

**Lo que falta:** sin red el reporte se pierde. Encolarlo es la siguiente vuelta;
hoy se pierde y está escrito que se pierde.

### 20.3 Invitar, como lo hace WhatsApp

La sección va **al pie de «nuevo chat»** (el lápiz), después de los registrados:
arriba con quién se puede hablar ya, abajo a quién falta traer. Invertirlo pone
primero lo que todavía no sirve.

**El cruce se hace EN EL TELÉFONO** (`shared/agendaLocal.ts`). WhatsApp sube la
libreta entera a sus servidores para saber quién está; acá el server ya nos dijo
quiénes son nuestros contactos registrados —gente con la que podemos hablar de
todos modos— y la agenda se compara contra esa lista sin salir del aparato.
Ningún número que el server no conociera ya sale del dispositivo.

Los números se comparan **normalizados**: la agenda guarda «+51 999 111 222» y el
server «999111222». Sin eso todos los contactos caerían en «para invitar» y la
pantalla no serviría para nada. Y un mismo número repetido (casa/celular) se
invita **una vez**: dos mensajes iguales a la misma persona parecen spam.


## 21. La API que ya no existía, y el estado que faltaba (26/08/2026)

La pantalla «Invitar» se quedó con los **esqueletos para siempre** y la sección
de invitar en «nuevo chat» no apareció nunca.

### 21.1 La causa

En `expo-contacts` **57** la raíz del paquete expone la API nueva
(`Contact`, `getPermissionsAsync`, `requestPermissionsAsync`) pero **NO**
`getContactsAsync` ni `Fields` — esos viven en `expo-contacts/legacy`. El código
hacía:

```ts
import * as Contacts from 'expo-contacts';
await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers] });
```

`Contacts.Fields` es `undefined`, así que leer `.PhoneNumbers` revienta. La
llamada se rechazaba y nadie lo veía.

**Por qué compiló:** los tipos del paquete resuelven por la condición `default`
al fuente, y el `import * as` no falló en `tsc`. Un import que compila no prueba
que el símbolo exista en tiempo de ejecución.

### 21.2 El defecto de diseño, que es peor que el bug

Los dos síntomas —esqueleto eterno y sección invisible— salen de lo mismo:
**«cargando» era la ausencia de datos**. Con `contactos === null` significando
«todavía no llegó», un fallo se ve EXACTAMENTE igual que una carga lenta, y una
sección que se esconde ante el error se ve igual que «no hay nadie».

`contacts/estadoAgenda.ts` lo arregla haciendo del error un estado propio:

| Estado | Qué se ve |
| --- | --- |
| cargando | esqueletos con la geometría de la fila |
| denegado | por qué hace falta el permiso + «compartir el enlace igual» |
| **error** | «No pudimos leer tu agenda» **con el mensaje real** + compartir |
| listo | la lista, o «toda tu agenda ya está» |

El mensaje del fallo se muestra EN PANTALLA y no solo en el log: sin él, «no se
pudo» es indistinguible de «no hay nadie» para quien reporta el problema — que
es justo lo que costó dos versiones.

### 21.3 Lo que sí funcionó

El reporte de errores de §20 hizo su trabajo: el fallo de `useAgendaParaInvitar`
—el único de los dos caminos que tenía `try/catch`— viajó a `POST /api/crash` y
quedó en el log del server como
`[crash] lilachat@0.1.5 android useAgendaParaInvitar — …`.

Se ve en **`torre.constroad.com/logs?f=chat:app`**, filtrando por `crash`.

La lección del otro camino: `InviteScreen` no tenía `try/catch`, así que su
fallo no se reportó. **Un reporte que depende de acordarse de envolver cada
llamada no cubre nada**; lo que cubre de verdad es que el estado de error exista
en la pantalla.

## 22. Por qué se sentía lenta (26/08/2026)

José: «está lento y se siente algo lenta la app entera». Medido antes de tocar
nada, y la causa era una sola y estaba en todas partes.

### 22.1 Cero listas virtualizadas

```
$ grep -c "<FlatList" src/**/*.tsx   →  0
$ grep -c "<ScrollView" src/**/*.tsx →  11
```

**Once pantallas, ninguna virtualizada.** Un `ScrollView` monta TODAS sus filas
al abrirse: con una agenda de 633 contactos son 633 filas de React con sus
avatares y sus `Pressable` construidas antes de que aparezca nada en pantalla.
La única lista que estaba bien era la de mensajes, con `FlashList`.

| Pantalla | Antes | Ahora |
| --- | --- | --- |
| Invitar (633 contactos) | `ScrollView` + `map` | `FlashList` |
| Lista de chats | `ScrollView` + `map` | `FlashList` |
| Sección «invitar» en nuevo chat | `map` de 600 dentro de un `ScrollView` | primeras 30 + buscador |

La sección de invitar vive DENTRO del `ScrollView` del selector, así que
virtualizarla sola no se puede: se acotan las primeras 30 y se dice cuántas
quedan. El buscador está justo arriba y es el camino real — nadie scrollea 600
filas para encontrar a su tía.

### 22.2 El cruce corría en cada tecla

`separarAgenda` —normalizar y comparar 600+ números— se ejecutaba en el cuerpo
del hook, o sea **en cada render**, incluida cada letra que se escribe en el
buscador. Justo cuando la app tiene que responder rápido. Ahora va en `useMemo`.

### 22.3 Los chats no cargaban más al scrollear

El server paginaba desde siempre (`beforeSeq`, 50 por página, tope 100) y el
cliente **nunca se lo pidió**: se traía la primera página por el socket y
scrolleando hacia arriba la conversación simplemente se terminaba.

Ahora `onStartReached` pide la anterior, con `chat/paginacion.ts` decidiendo:

- **Freno de `cargando`**: el evento se dispara en cada cuadro mientras el dedo
  se mueve; sin freno se piden tres páginas iguales y la lista salta.
- **Se ignora a los optimistas**: van con `MAX_SAFE_INTEGER` como `seq` y
  tomarlos como límite haría que el server devuelva la conversación entera.
- **El final se DICE**: «Este es el principio de la conversación». Sin eso, quien
  llega arriba no sabe si ya vio todo o si falta cargar.

Y no se trae el histórico al abrir: arrastrar años de mensajes en cada apertura
es justo lo que hace que una app se sienta pesada.

## 23. Registro abierto (26/08/2026)

Wilson instaló Lilachat y no le llegaba el código. La causa no era el envío: el
server **no mandaba nada** a un número sin admisión previa, y contestaba 200
igual para no revelar quién existe. En la base había **una** sola admisión —la de
José—, así que nadie más podía entrar jamás.

Primero se arregló el eslabón que faltaba (invitar CREA la admisión, §anterior).
Después José decidió lo de fondo: **«todo a público, cualquier persona puede
ingresar»**.

### 23.1 Qué se abrió

| Antes | Ahora |
| --- | --- |
| solo se pedía el código a quien tuviera admisión | a cualquier celular |
| canjear sin admisión: 401 genérico | completa el alta y queda como usuario |
| contactos = los INVITADOS | contactos = todos los USUARIOS |
| LilaStore: correo sin cuenta → 403 | se enrola, sin apps concedidas |

**La rama cerrada no se borró.** `registroAbierto` es un interruptor y los tests
de enumeración siguen valiendo de los dos lados: si algún día se vuelve a cerrar,
se cambia en un lugar. Y los tests que fijaban lo contrario **se invirtieron con
su explicación en vez de borrarse** — dejan escrito que la regla cambió y por qué.

### 23.2 El tercer cambio, que no era obvio

Abrir el registro sin tocar los contactos dejaba a la gente entrando **a un lugar
donde nadie la ve**: la lista salía de `invitations`, y quien se da de alta solo
no tiene ninguna. Podría escribirle a otros y nadie podría escribirle a él.

Por eso contactos pasó a ser el padrón de usuarios.

### 23.3 Lo que se pierde, dicho con todas las letras

1. **La lista de contactos es un directorio de teléfonos.** Cualquiera que entre
   ve el número de todos los demás y puede escribirles. Era exactamente lo que
   el filtro por invitación evitaba.
2. **El envío de códigos quedó abierto.** Ahora se llama al servicio por
   cualquier número, así que el tope de constroad-auth es lo único que separa
   esto de ser un grifo de SMS con nuestro dominio.
3. Lo que **no** se abrió: `bloqueado` sigue bloqueado en LilaStore. Abrir el
   registro no puede ser una puerta trasera para quien fue dado de baja a
   propósito.

### 23.4 El padrón abierto duró unas horas

José lo cortó en el acto: «cada teléfono debería ver sus contactos guardados,
como WhatsApp». Tenía razón, y el arreglo es un cambio de **dirección de la
pregunta**:

| | Antes | Ahora |
| --- | --- | --- |
| `GET /api/contacts` | todos los usuarios | solo con quien YA tengo conversación |
| Descubrir gente | venía sola en la lista | `POST /match` con los números que YA tengo |

Preguntando así, **nadie descubre un número que no tuviera antes**. El padrón
completo no sale del server ni una vez.

**Lo honesto sobre la privacidad:** los números de la agenda SÍ salen del
teléfono para poder emparejarlos —no hay forma de hacerlo sin eso, y es lo mismo
que hace WhatsApp— pero el server no los guarda: los usa para la consulta y los
descarta. El tope de 2000 por consulta no es cosmético: sin él, alguien manda el
espacio entero de números y descubre a todos los registrados, que es justo lo que
este diseño impide.

**Con quien ya hablo siempre está**, aunque no lo tenga agendado: perder una
conversación abierta porque el contacto no está en la libreta sería peor que
mostrar un número de más.

## 24. La estrategia de WhatsApp para la fluidez (26/08/2026)

José preguntó si la había mirado. La respuesta corta: el problema del render ya
estaba resuelto (§22, virtualizar y memoizar); lo que faltaba es lo otro.

**WhatsApp es local-first.** Guarda todo en el teléfono, pinta desde ahí al
instante y usa la red solo para conciliar por detrás. Lilachat hacía lo
contrario: **no guardaba nada**, así que cada apertura empezaba en blanco y
esperaba a la red. Ninguna optimización de render arregla eso — el tiempo no se
va dibujando, se va esperando.

### 24.1 Lo que ya se hizo: la lista de chats

Se persiste (`chat/chatsGuardados.ts`, AsyncStorage) y se pinta antes de
preguntar. Tres reglas:

- **Cuando el server contesta, MANDA el server** — no se fusiona. Fusionando, un
  chat borrado desde otro teléfono no desaparecería nunca de este. La caché es lo
  que se ve MIENTRAS, no una segunda fuente de verdad.
- **Sin red se deja lo que había.** El `[]` de «no hay conversaciones» solo se
  pinta si tampoco hay caché; si no, abrir sin señal seguiría vaciando la
  pantalla.
- **Se borra al cerrar sesión.** La lista de con quién habla alguien no se
  hereda al siguiente que entre en ese teléfono.

Guarda la LISTA, no los mensajes: cuerpos de mensajes en un almacén sin cifrar es
otra decisión y merece su propia discusión — los chats secretos (F9) existen
justamente para que ni el server los vea.

### 24.2 Lo que falta para ser local-first de verdad

| Pieza | Estado |
| --- | --- |
| Lista de chats persistida | hecho |
| Últimos mensajes por chat, persistidos | **falta** — al abrir un chat todavía se espera al socket |
| Reconciliación por `seq` contra lo guardado | existe el motor (`mergeBySeq`), falta el almacén |
| Búsqueda local | falta |

Abrir un chat sigue costando una ida y vuelta. Es el mismo patrón de acá y el
motor de merge ya existe; lo que falta es dónde guardarlos y decidir si van
cifrados en reposo.

## 25. Local-first de verdad, y cómo hace WhatsApp el tiempo real (26/08/2026)

### 25.1 Los mensajes, cifrados en reposo

`shared/cacheCifrada.ts` + `app/src/chat/mensajesGuardados.ts`. Abrir un chat
pinta lo guardado al instante; el socket confirma o corrige por detrás.

**Cifrado, y no por adorno.** Guardar los cuerpos en claro sería regalarle el
historial de la familia a cualquier app con permiso de archivos, y contradiría de
frente a los chats secretos (F9), que existen para que ni el server los lea.

- Reusa `encryptMessage` de F9 (AES-GCM, `@noble`). **Un segundo mecanismo de
  cifrado es un segundo lugar donde equivocarse.**
- La clave vive en `expo-secure-store` con `WHEN_UNLOCKED_THIS_DEVICE_ONLY`,
  igual que la credencial. En AsyncStorage —que es un archivo legible— iría la
  caja fuerte junto a su llave.
- **60 mensajes por chat.** Es lo que entra en la primera pantalla y algo más;
  guardar la conversación entera obliga a descifrar un archivo enorme en cada
  apertura, el problema opuesto al que esto resuelve. El resto se pide por
  `beforeSeq` (§22.3).
- **La caché nunca pisa a la red.** Solo se usa si todavía no llegó nada: si el
  socket fue más rápido, pisar lo suyo sería ir para atrás.
- Al cerrar sesión se borran los archivos **y la clave**. Sin borrar la clave
  quedarían descifrables por quien entre después; sin borrar los archivos
  quedaría el historial de alguien que ya se fue.

### 25.2 El buscador de contactos, que «demoraba»

El filtro corría en CADA render sobre ~600 contactos, armando un string y
bajándolo a minúsculas por cada uno: 600 concatenaciones y 600 `toLowerCase` por
tecla.

- La clave de búsqueda se calcula **una vez** (`contacts/busqueda.ts`), sin
  tildes: buscar «mama» tiene que encontrar a «Mamá».
- Escribir y buscar se separan (`ui/useConsultaDiferida.ts`, 150 ms): la letra
  aparece en el cuadro siguiente y la búsqueda espera a que se deje de tipear.
- Sin consulta se devuelve **la misma referencia**, no una copia: una copia
  obliga a la lista a redibujarse entera sin que haya cambiado nada.

### 25.3 Cómo hace WhatsApp el tiempo real

La pregunta de José: si usa sockets o alguna otra estrategia, porque «ves cuando
alguien está escribiendo, cuando está en línea, todo en tiempo real».

**Una sola conexión persistente**, siempre abierta mientras la app está al
frente. WhatsApp arrancó sobre XMPP y hoy usa su propio protocolo binario, pero
la forma es la misma que Socket.IO: un canal bidireccional por el que viajan
TODOS los eventos, en vez de preguntar cada N segundos.

Las dos piezas que hacen que se sienta instantáneo:

1. **Los eventos efímeros no se guardan.** «Escribiendo…» y «en línea» son
   señales que valen segundos: viajan por el socket, se pintan y se descartan. No
   pasan por la base ni por el historial. Por eso llegan sin latencia — no hay
   nada que escribir antes de mandarlas.
2. **La UI lee del almacén local, no de la red.** El socket no pinta: escribe en
   el almacén, y la pantalla observa el almacén. Es lo que permite que abrir sea
   instantáneo Y que lo que llega aparezca al toque, sin que sean dos caminos
   distintos.

**Dónde estamos:** el canal ya es el mismo — `typing`, `presence`,
`presence.snapshot`, `msg.new`, `read.set`, `sync.pull` sobre Socket.IO. Lo que
faltaba era el punto 2, y es lo que se acaba de cerrar con §25.1.

**Lo que sigue faltando:** cuando la app está en segundo plano el socket se cae
y los mensajes entran por Web Push. WhatsApp mantiene la conexión con un servicio
en primer plano; es la misma decisión que ya se tomó para el GPS de Timón y está
pendiente acá.

## 26. Sesión de la web, avisos con vista previa, y el servicio en primer plano (26/08/2026)

### 26.1 La web pedía código «a cada rato»

El `jwt` dura **24 h**. La app lo renueva con el secreto del dispositivo desde
siempre; la **web tiraba ese secreto** —guardaba solo el token—, así que al día
siguiente pedía otro código mientras el teléfono seguía entrando solo.

Ahora la web guarda el `deviceSecret` y renueva: al abrir la pestaña y ante
cualquier 401. Como WhatsApp Web, la sesión dura hasta que uno la cierra.

**Dos frenos que el test destapó, y los dos habrían pasado en producción:**

1. **Sin secreto, el 401 sigue echando.** Las sesiones anteriores a este cambio
   no lo tienen: sin este caso quedaban con la lista vacía para siempre y sin
   forma de volver a entrar.
2. **Un intento de refresco por token.** Sin freno: 401 → renovar → cambia el
   estado → se vuelve a pedir la lista → 401 → renovar… un bucle que martilla la
   API. Lo destapó un test que se colgó; habría llegado a producción el día que
   el server devolviera 401 con un refresco que igual contesta.

Y una lección de método: el primer test **mockeaba un 401 eterno**, incluso
después de renovar. Con eso, cerrar sesión ES lo correcto — el test estaba mal
planteado, no el código. Se corrigió el test para que refleje el caso real.

### 26.2 La burbuja de arriba, con parte del mensaje

`shared/aviso.ts` decide qué se muestra, y sobre todo qué NO:

| Caso | Qué se ve |
| --- | --- |
| grupo | `Familia` / `Mamá: llego tarde` |
| 1:1 | `Mamá` / `llego tarde` — el título ya es la persona |
| **chat secreto** | `Mensaje nuevo`, **sin el texto** |
| foto / audio | «📷 Foto», no un cuerpo vacío |
| muy largo | recortado a 140 con «…», no cortado por Android |

El chat secreto es la regla que importa: la burbuja se lee **en la pantalla de
bloqueo**, y el cifrado existe para que ni el server lo lea — filtrarlo ahí
tiraría por la borda justo eso.

Es un aviso **local**: lo dispara la propia app al recibir el mensaje por el
socket, no un servicio de push. Por eso no hace falta Firebase. Vive en
`TabsShell` y no en `useChat`, porque ese hook solo existe con un chat abierto y
el aviso importa sobre todo cuando NO se está mirando ese chat. Y con la app
adelante no se avisa: una burbuja encima de la conversación que uno está leyendo
es estorbo.

El canal de Android va con importancia **ALTA**: sin un canal propio el aviso
llega a la bandeja pero no asoma arriba, que era lo pedido.

### 26.3 El servicio en primer plano: lo que falta y su precio

Hoy, con la app atrás, Android suspende el runtime y **el socket se cae**: los
mensajes entran al reconectar. Sostenerlo exige un servicio en primer plano.

El de Timón NO sirve de molde: viene dentro de `expo-location`
(`isAndroidForegroundServiceEnabled`) y está atado al rastreo de ubicación. Para
sostener un socket hace falta un servicio propio —módulo nativo o una librería
tipo `notifee` / `rn-foreground-service`— más su config plugin.

**El precio que hay que decidir:** un servicio en primer plano obliga a mostrar
una notificación **permanente** en la bandeja («Lilachat activo»). WhatsApp no la
tiene porque usa FCM. Sin Firebase, esa notificación permanente es el costo de
que el socket no se caiga. Es una decisión de producto, no técnica.

## 27. El servicio en primer plano, y qué es FCM (26/08/2026)

### 27.1 Qué es FCM, y por qué WhatsApp no necesita esto

**FCM (Firebase Cloud Messaging)** es el servicio de Google que entrega
notificaciones a los teléfonos Android. La pieza clave es que **el canal no es de
la app: es del sistema operativo**. Android mantiene UNA conexión con los
servidores de Google, compartida por todas las apps del teléfono, y esa conexión
sí sobrevive a que las apps estén cerradas.

Cuando llega un mensaje, WhatsApp no le habla a tu teléfono: le habla a Google, y
Google lo empuja por ese canal. Por eso WhatsApp no muestra ninguna notificación
permanente — no necesita mantener nada vivo, se apoya en algo que ya está vivo.

El costo, y por lo que José lo descartó: cada mensaje pasa por servidores de
Google, hay que registrar el proyecto en Firebase y meter sus credenciales en el
build. Para un chat familiar en una máquina propia, es meter a un tercero en el
medio de todo.

### 27.2 Sin FCM, el único camino

Sin ese canal del sistema, la app tiene que sostener **su propia** conexión. Con
la app atrás, Android suspende el proceso o lo mata: el socket se cae y los
mensajes entran recién al volver a abrir.

Un **servicio en primer plano** evita eso. Y Android cobra un precio explícito:
para dejar correr un servicio así **exige una notificación permanente**. Es el
trato — el sistema te deja vivir si la persona puede ver que estás vivo.

`modules/servicio-socket` es un módulo Expo local (Kotlin, sin dependencias
nuevas). No abre sockets ni escucha nada: su único trabajo es que el proceso no
muera. El socket sigue siendo el de JavaScript.

Detalles que Android 14+ vuelve obligatorios y que, mal puestos, matan el
servicio al arrancar:

- `android:foregroundServiceType="dataSync"` en el manifiesto **y** el mismo tipo
  en `startForeground(...)`. Si no coinciden, el sistema lo mata en el acto.
- Permisos `FOREGROUND_SERVICE` y `FOREGROUND_SERVICE_DATA_SYNC`.
- Verificado en el APK publicado, no en el código: `aapt2 dump xmltree` muestra
  `foregroundServiceType=0x1` sobre `expo.modules.serviciosocket.ServicioEnPrimerPlano`.

La notificación va con importancia **MÍNIMA** (no suena ni asoma) y dice para qué
está: «Conectado para recibir mensajes». Una notificación permanente sin
explicación se lee como una app que se cuelga sola, y termina desinstalada.

**Se enciende con la sesión, no al pasar a segundo plano** (`decidirServicio`,
con test): esperar deja una ventana en la transición —el momento más frágil—
donde el proceso puede morir antes de que el servicio arranque. Sin sesión se
apaga: la notificación fija sin nada que sostener es molestar por nada.

### 27.3 La web, comparada con la app

Auditoría pedida por José. Lo que la app RN tiene y la web no:

| Falta en la web | Comentario |
| --- | --- |
| Adjuntar fotos/archivos | el «+» solo crea evento o encuesta |
| Chats secretos (E2EE) | la web no tiene `crypto/*` |
| Recordatorios | tiene eventos y encuestas, no recordatorios |
| «Ponme al día» (Lila) | sin `CatchUpBanner` |
| Copia de seguridad | sin pantalla |
| Cargar mensajes viejos al scrollear | la web pide una sola tanda |
| Caché local (abrir sin esperar) | la web siempre espera a la red |
| Cola offline de envíos | sin `outbox` |
| Llamadas | sin `calls/*` |

Lo que **no** corresponde llevar a la web: invitar desde la agenda (el navegador
no lee contactos), el servicio en primer plano, y buscar actualizaciones.

## 28. El E2E que faltaba, y los tres defectos que solo se veían así (27/08/2026)

José: «no veo que estés probando end to end con el emulador». Tenía razón —
entrar exige un OTP y yo lo daba por imposible. La salida la dio él:
`jose.test@yopmail.com`, un buzón **público** que se puede leer desde el
navegador sin credenciales de nadie.

### 28.1 La receta, para repetirla

1. Sembrar una admisión de QA con ese correo:
   `invitations: { phone: '900000001', email: 'jose.test@yopmail.com' }`.
2. En el emulador, entrar con ese número y tocar **«¿No te llegó? Envíalo a mi
   correo»** — el único camino cuyo código se puede leer.
3. Abrir `https://yopmail.com/en/?jose.test` y sacar el código.
4. Al terminar, **borrar todo y verificar en cero**.

Sin el respaldo por correo no hay E2E posible: el código por WhatsApp exige un
número real.

### 28.2 Tres defectos, ninguno visible sin correr el flujo

**1. La app nunca pedía permiso de notificaciones.** `POST_NOTIFICATIONS`
quedaba en `granted=false` y la app entera con `importance=NONE`. Con eso no se
veía **nada**: ni la burbuja de un mensaje ni la notificación del servicio en
primer plano — que el sistema oculta aunque el servicio SÍ esté corriendo. El
`dumpsys` decía `isForeground=true` y la bandeja estaba vacía.

**2. Conceder el permiso después NO hace aparecer la notificación.**
`startForeground` la publica al arrancar; si en ese instante el permiso estaba
denegado, Android la suprime para siempre. Hay que **volver a arrancar el
servicio** después de conceder, y por eso ahora es
`prepararAvisos().then(() => iniciarServicio())`.

**3. La burbuja del primer mensaje decía «Lilachat».** El chat se había creado
después de que la app cargara su lista, así que no se conocía el nombre. Es
justo cuando más importa —no sabés quién te escribió—: ahora, si el chat no está
en la lista, se recarga ANTES de avisar.

Y uno más, visto compartiendo de verdad: **la invitación salía sin la opción 2**
(el APK directo). El enlace estaba atado al botón «buscar actualizaciones», así
que si nadie lo tocaba nunca, la invitación llevaba una sola puerta. Ahora se
busca al arrancar.

### 28.3 Lo verificado, de punta a punta

| Paso | Resultado |
| --- | --- |
| Alta con código por correo | entra a la lista de chats |
| Servicio en primer plano | `isForeground=true`, `types=0x1` (dataSync) |
| Notificación permanente | «Lilachat · Conectado para recibir mensajes», silenciosa |
| Invitar a un contacto | crea la admisión en la base y abre la hoja de compartir |
| Mensaje con la app CERRADA | llega la burbuja con la vista previa, tildes y emoji |
| Segundo mensaje | el título ya es el chat, no el genérico |
| Limpieza | usuario, chat, mensajes, device e invitaciones en cero |

## 29. La web: adjuntar archivos y caché local (27/08/2026)

Los dos huecos más grandes de la auditoría de §27.3.

### 29.1 Adjuntar

La web ya sabía PINTAR media (`mediaUrl`, imágenes): lo que no podía era
enviarla. Ahora el «+» ofrece «Foto o archivo».

- **La MISMA validación que el server** (`validateMedia`, compartida). Si el
  navegador aceptara algo que el server rechaza, la persona espera a que suban
  20 MB para que muera al llegar.
- `FormData` del navegador y `fetch` a secas: el rodeo con `XMLHttpRequest` de
  la app existe por el `fetch` de Expo, que no acepta archivos. Acá no hace falta.
- **El mensaje no se inserta a mano**: lo crea el server en el mismo request y
  llega por `msg.new`. Insertarlo dejaría dos copias en cuanto el socket lo
  repitiera.
- El `<input type="file">` va oculto y **se limpia su valor** al elegir: sin eso,
  elegir el mismo archivo dos veces seguidas no dispara `change` y parece que el
  botón dejó de andar.

### 29.2 Caché local

Misma idea que la app (§25): pintar lo último conocido y dejar que la red
confirme. La lista arranca desde `localStorage` en vez de `null`, y los mensajes
de un chat se pintan antes de pedirlos.

**Sin cifrar, y es una diferencia con la app que hay que decir.** En el teléfono
la clave vive en el llavero del sistema; en un navegador **no existe ese lugar**
—cualquier clave en `localStorage` estaría al lado de lo que protege—. La
consecuencia se toma de frente:

> **Un chat cifrado NO se cachea nunca.** Y basta UN mensaje con sobre en la
> tanda para no guardar ninguno: partir una conversación a la mitad sería peor
> que no guardarla.

Al escribirlo apareció otra cosa: **el tipo `ChatMessage` de la web no modelaba
`envelope`**, aunque el server lo manda desde F9. La web no sabe descifrar
todavía, pero sí tiene que RECONOCERLO — es justo lo que impide que la caché
guarde en claro algo que se cifró a propósito.

Y las reglas que ya se habían pagado en la app se repiten acá:

- El server **manda**: no se fusiona con la caché, o un chat borrado desde el
  teléfono no desaparecería de la web.
- **Sin red se deja lo guardado**: vaciar la conversación por un fallo de red es
  peor que mostrarla un poco vieja.
- Al cerrar sesión se borra todo — en un navegador, lo siguiente que pasa es que
  otra persona abra la pestaña. Pero se borra **solo la caché**: mezclarlo con la
  credencial haría que limpiar el historial cerrara la sesión sin que nadie lo
  pidiera.

### 29.3 El E2E de la web encontró que la foto no se veía

Probado con `jose.test@yopmail.com` (§28.1) contra producción. El archivo se
inyecta en el `<input type="file">` **generándolo en la propia página** con un
canvas — no hace falta transferir bytes al navegador:

```js
c.toBlob((blob) => {
  const dt = new DataTransfer();
  dt.items.add(new File([blob], 'x.png', { type: 'image/png' }));
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
});
```

**Y apareció el defecto:** el POST devolvía 201, el mensaje se guardaba, la lista
decía «📷 Foto»… y la conversación mostraba una **burbuja vacía**.

La causa: el tipo de la web declaraba `mediaUrl` y `thumbnailUrl`, campos que el
server **no manda**. Manda `media.url` y `media.thumbUrl` —lo que la app lee
desde siempre—. TypeScript no puede ver eso: el tipo describía un contrato
inventado y compila igual de bien que uno correcto.

Es la misma lección que ya está escrita para los clientes del server: **los
contratos se leen, no se recuerdan**. Un tipo escrito a mano es una suposición
con sintaxis.

| Paso | Resultado |
| --- | --- |
| Entrar a la web con código por correo | entra y persiste la sesión |
| «+» → Foto o archivo | POST `/api/media` → 201 |
| La lista | «📷 Foto» con contador |
| La conversación | **burbuja vacía** → corregido → se ve |
| Caché en `localStorage` | 1 chat, 1 mensaje, con `media.url` |
| Recargar con `fetch` roto | la conversación sigue en pantalla |

## 30. El WebSocket de la web, y cómo lo hace WhatsApp Web (27/08/2026)

### 30.1 Qué pasaba

La consola del navegador llenaba de `WebSocket connection to
'wss://lilachat.constroad.com/socket.io/…' failed`. Medido antes de tocar nada:

| Prueba | Resultado |
| --- | --- |
| `new WebSocket(…)` crudo desde la página | **abre en 890 ms** |
| socket.io desde Node, token válido | conecta al primer intento |
| socket.io desde Node **con `Origin`** de navegador | conecta |

O sea: el túnel de Cloudflare pasa WebSocket sin problema y el CORS no estorba.
El transporte nunca fue el problema.

**La causa era propia:** el efecto del socket dependía del `jwt`, y el refresco
de sesión que se agregó el mismo día (§26.1) **cambia el `jwt` al arrancar**. Así
que cada carga abría un socket con el token viejo, lo tiraba y abría otro — dos
handshakes por visita, y el «failed» en la consola cada vez.

**El arreglo:** el socket se abre por SESIÓN (`userId`), no por token. El token
se lee de una ref al conectar, y `auth` se pasa como **función** —socket.io la
vuelve a llamar en cada reintento—, así que un token renovado entra solo en la
próxima reconexión. Renovar la sesión ya no tira la conexión.

Lo demás de esos errores era el reintento de socket.io contra una sesión muerta:
al borrar el usuario de QA, la web siguió reintentando hasta que el refresco
devolvió 401 y cerró sesión sola — que es el comportamiento correcto.

### 30.1b Verificado en vivo, con el arreglo desplegado

E2E completo contra producción (27/08/2026, 12:11–12:21):

| Medición | Resultado |
| --- | --- |
| Peticiones HTTP a `/socket.io/` | **0** — no hay polling: va por WebSocket puro |
| Mensaje enviado desde otro cliente | aparece en la web **sin recargar** |
| Segundo mensaje, ya conectado | llega igual, y con **0 errores nuevos** en consola |

Los «WebSocket connection failed» que quedan son **del arranque**, no de la
conexión establecida: una vez conectado, el socket no vuelve a fallar. La causa
de esos primeros es conocida y benigna — cerrar un WebSocket que todavía está en
`CONNECTING` hace que Chrome lo registre como «failed», y eso pasa cuando el
efecto se rehace antes de que el handshake termine.

**Lo que queda pendiente:** que ni siquiera esos aparezcan. Exige que el efecto
del socket no corra dos veces en el arranque; con la sesión ya montada no vuelve
a ocurrir, así que es ruido de consola y no una falla de servicio.

### 30.2 ¿Con sockets? Sí, y así lo hace WhatsApp Web

WhatsApp Web mantiene **una conexión WebSocket persistente** al servidor y todo
viaja por ahí: mensajes, «escribiendo», presencia, acuses. Es la misma forma que
Socket.IO — un canal bidireccional en vez de preguntar cada N segundos.

Las buenas prácticas que aplican, y dónde estamos:

| Práctica | Por qué | Estado |
| --- | --- | --- |
| Una sola conexión por sesión | cada socket es memoria y un handshake; abrir uno por render es el error clásico | **arreglado hoy** |
| Reconexión con backoff | reintentar cada 100 ms contra un server caído es un ataque a uno mismo | lo trae socket.io |
| La UI lee del ALMACÉN, no del socket | el socket escribe, la pantalla observa: así abrir es instantáneo y lo nuevo aparece al toque | §29.2 |
| Eventos efímeros que no se persisten | «escribiendo» vale segundos; guardarlo es latencia y basura | ya es así |
| Reanudar por cursor, no por «desde cuándo» | tras una desconexión hay que pedir lo que falta, no todo | `sync.pull` con `seq` |
| El token no obliga a reconectar | si el socket muriera con cada refresco, la sesión larga sería inútil | **arreglado hoy** |

Lo que **no** hacemos y WhatsApp sí: cifrar de punta a punta TODO (acá es opt-in
por chat, F9), y usar un protocolo binario propio en vez de Socket.IO — que para
esta escala sería optimizar lo que no duele.
