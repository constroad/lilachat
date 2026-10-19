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

> **Tabla HISTÓRICA (estado al 24/08/2026).** El tablero vigente, con el
> estado real de cada fase y el plan de fluidez, está en **§45**.

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

`scripts/iconos-de-la-app.mts` genera todo desde un solo dibujo (desde FL6, la
geometría de `shared/src/marca.ts`, la misma del `<Logo>` de la app — §45.13).
A mano son cinco PNG que se desincronizan al primer retoque.

| Archivo | Para qué |
| --- | --- |
| `icon.png` (1024) | el ícono «plano», y el de la tienda |
| `android-icon-foreground.png` | la capa que Android RECORTA con la máscara del fabricante |
| `android-icon-background.png` | la capa de abajo: blanco plano (desde FL6) |
| `android-icon-monochrome.png` | temas dinámicos de Android 13+ |
| `splash-icon.png` | arranque |
| `favicon.png` | la web |

**La capa de frente vive dentro del 66 % central.** El sistema la recorta con la
máscara del fabricante —círculo, cuadrado redondeado, «squircle»—: llenar el
lienzo entero es lo que produce íconos con las puntas comidas. En el script eso
se consigue escalando el dibujo al centro (`escala: 0.66`), no redibujando.

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

### 30.1c El ruido del arranque, eliminado

El mensaje exacto lo dijo todo: **«WebSocket is closed before the connection is
established»**. No era el server ni el túnel: era la web cerrando sockets a medio
conectar. Dos causas, las dos propias:

1. **Se abría con el token GUARDADO**, que puede estar vencido, antes de que el
   refresco lo renovara → el server rechazaba el handshake y socket.io
   reintentaba. Ahora el socket **espera a que la sesión esté resuelta**
   (`sesionLista.ts`, con test); sin secreto de dispositivo no espera nada,
   porque no hay refresco que aguardar.
2. **React monta, desmonta y remonta en el arranque**, y cada montaje abría y
   cerraba su propio socket. Ahora vive **fuera del efecto**, se reutiliza
   mientras sea la misma sesión, y al desmontar se SUELTA en vez de cerrarse:
   solo se apaga cuando nadie lo usa, y en el tick siguiente — porque un remonte
   inmediato vuelve a pedirlo.

**Verificado en una pestaña NUEVA** (buffer de consola desde cero), cargando con
la sesión ya guardada, que es justo el caso que fallaba:

| Medición | Resultado |
| --- | --- |
| Mensajes en consola tras cargar | **ninguno** |
| Peticiones HTTP a `/socket.io/` | 0 — WebSocket puro |
| Mensaje enviado desde otro cliente | llega en vivo |
| Consola después de recibirlo | **sigue vacía** |

La lección de método: el buffer de consola **acumula entre navegaciones**, así
que contar errores después de recargar en la misma pestaña mide toda la sesión y
no la carga. Una pestaña nueva es el único cero confiable.

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

## 31. «Algo se rompió» al tocar el lápiz (27/08/2026)

José reportó la pantalla de error al abrir «Nuevo chat». **El reporte de §20
hizo exactamente lo que se le pidió**: el `ErrorBoundary` atrapó el fallo, mostró
la pantalla con «Reintentar» en vez de dejar la app en blanco, y mandó la línea
al server.

Reproducido en el emulador con el flujo de yopmail (§28.1). El log lo dijo
entero:

```
E ReactNativeJS: [Error: Rendered more hooks than during the previous render.]
  componentStack: at SeccionInvitar …
E ReactNativeJS: [crash] app — Rendered more hooks than during the previous render.
```

### 31.1 La causa

En `SeccionInvitar` había tres hooks —`useMemo`, `useConsultaDiferida`,
`useMemo`— **después** de los `return null` de «cargando», «error» y «denegado».
El primer render salía con 2 hooks y el siguiente con 5.

**Este repo ya tenía la lección escrita**, en `web/src/App.tsx`, del mismo
defecto en la pantalla de acceso: «un hook después de un return condicional
cambia la CANTIDAD de hooks entre renders». Se repitió igual, y en el mismo día
en que se movieron esos hooks para acelerar el buscador (§25.2).

### 31.2 Por qué no lo vio nada de lo que ya había

- `tsc --noEmit`: pasa. El orden de los hooks no es un problema de tipos.
- Los tests: cubren los motores puros, que no tienen hooks.
- El build: compila perfecto.

Solo se ve **renderizando el componente**, y solo cuando el estado cambia de
«cargando» a «listo» — o sea, con la agenda del teléfono ya leída.

### 31.3 El arreglo sistémico

Los hooks subieron arriba de todo, y se agregó **ESLint con una sola regla**:
`react-hooks/rules-of-hooks`. Es lo único que detecta esto leyendo el código.

Verificado que sirve: se reintrodujo el defecto a propósito y el lint lo marcó
—`React Hook "useMemo" is called conditionally`— antes de compilar nada.

Queda encadenado a `npm run typecheck`, que es lo que corre `lila apk build`:
un APK con este defecto ya no se puede construir.

## 32. Observabilidad: por qué «estoy a ciegas» seguía siendo cierto (27/08/2026)

Había reporte de crash desde el 26 y aun así José escribió: «estoy prácticamente
a ciegas». Tenía razón, y por tres motivos distintos que se sumaban.

### 32.1 Los reportes estaban en la pestaña de al lado

`crashRoutes` escribía con `console.error`, que en Node va a **stderr**. En la
mini eso es `chat-err.log`, y en Torre la pestaña «chat · errores». José miraba
`?f=chat:app` —que es stdout— y ahí solo hay arranques.

La separación stdout/stderr está bien y se conserva: es lo que permite grepear
los errores. Lo que estaba mal era que **fuera el único camino**.

### 32.2 El log no tenía hora

Lo que veía era una pared de `[lilachat] escuchando en :3004` repetido, sin una
sola marca de tiempo. Sin hora, un log no contesta ninguna de las preguntas que
uno le hace: ¿esto fue hoy?, ¿son dos deploys o un bucle de reinicios?, ¿pasó
antes o después del error que busco?

`server/src/registro.ts` la agrega. Dos decisiones que valen:

- **La zona se fija en `America/Lima`, no se toma del sistema.** Es la lección de
  `server-timezone-changed-with-hosting`: la app ya se mudó de host una vez y la
  zona cambió con la mudanza. Un log fechado en «la hora del server» obliga a
  saber dónde corre el server para leerlo.
- **Se sella el `console`, no se reescriben las 22 llamadas.** Cambiar 22 líneas
  para no cambiar ningún comportamiento es un diff donde solo pueden aparecer
  regresiones; y sellar además fecha lo que **no** escribimos nosotros —los
  warnings de Node y de las dependencias—. Un log donde algunas líneas tienen
  hora y otras no es peor que uno sin hora: invita a ordenarlas como si fueran
  comparables. Verificado en vivo: el `MODULE_TYPELESS_PACKAGE_JSON` de Node
  salió fechado.

### 32.3 Nadie abre un log por las dudas

Este es el que importa. Un error solo existe si te interrumpe; si hay que ir a
buscarlo, solo se encuentra cuando ya sospechabas de él, y entonces el log no te
avisó de nada.

Ahora un crash sale por DOS caminos y hacen falta los dos: **al log** con hora y
stack completo (el registro, para investigar) y **a Telegram** deduplicado (el
aviso, para enterarse). Mismo bot y mismo canal que lila-app —no hace falta un
canal nuevo para mirar en dos lugares—. `alertarServidor()` cubre además los
`uncaughtException` del propio server, que son peores que el crash de un
teléfono: el del teléfono lo sufre una persona, este los deja a todos sin chat.

El dedupe (`shared/src/alerta.ts`) no es un adorno. El endpoint acepta 60
reportes por minuto: una pantalla en bucle mandaría 60 mensajes de Telegram por
minuto, y la reacción humana a eso es silenciar el canal — con lo cual el
siguiente error, el que sí importaba, tampoco se ve. La huella incluye la
**versión** a propósito: el mismo error en una versión nueva es noticia otra vez,
porque significa que el arreglo no funcionó.

Probado contra el endpoint real: cuatro POST idénticos → 4 líneas en el log, 1
solo aviso.

**Lo que falta y se sabe que falta:** las variables `TELEGRAM_BOT_TOKEN` y
`TELEGRAM_ALERTS_CHAT_ID` **no estaban en el `.env` de lilachat** —por eso no
llegaba nada aunque el bot existiera hace meses—. Están en el `.env` local; hay
que ponerlas en el de la mini por Torre, y **reiniciar**: el `.env` se lee al
arrancar (memoria `env-loaded-at-boot-needs-restart`).

## 33. La notificación permanente, el círculo del header y la agenda (27/08/2026)

### 33.1 «A cada rato me aparece la burbuja»

Hay que separar las dos mitades del reclamo, porque una es cierta y la otra no
es nuestra:

- **WhatsApp no muestra esta notificación** porque recibe por FCM, un canal que
  mantiene el sistema operativo. Cierto.
- **Nosotros no podemos ocultarla.** Sin FCM —descartado a conciencia— la única
  forma de que un socket propio sobreviva a la app cerrada es un servicio en
  primer plano, y Android exige la notificación como condición para dejarlo
  correr. No es una decisión reversible con una línea.

Pero «a cada rato **me aparece**» sí era un defecto, y estaba en un detalle: una
notificación lleva por defecto la hora en que se publicó, y **cada
`onStartCommand`** —reconexión, `START_STICKY`, volver del segundo plano— la
republica con hora nueva. Android la reordena como si fuera un aviso recién
llegado y salta al tope de la bandeja. Era siempre la misma notificación
comportándose como una nueva varias veces por día. `setShowWhen(false)` +
`setOnlyAlertOnce(true)` la dejan quieta, que es lo que se espera de una
constancia. Verificado en el emulador: queda en la sección «Silent».

Y como el precio es fijo, lo que se puede dar es la **elección**: interruptor en
Ajustes → Avisos. Apagarlo saca la notificación **y** los mensajes con la app
cerrada, y el texto lo dice. Por defecto encendido: una app de mensajería que de
fábrica no entrega los mensajes está rota, y nadie atribuiría ese silencio a un
ajuste que nunca tocó.

El interruptor vive en `App.tsx` y baja como prop. Dos copias del mismo ajuste se
desincronizan, y el síntoma sería el peor posible: el switch en una posición y la
notificación en la otra.

### 33.2 El círculo con un número era un botón trampa

«Hay un círculo con un número, no me dice qué es ni para qué sirve». Era el
avatar, mostrando la primera letra de `name` — y como no hay nombre puesto,
mostraba el primer dígito del teléfono.

Era peor que ilegible: **cerraba la sesión de un toque y sin preguntar**. Cerrar
sesión ya vive en Ajustes, escrito y en su sección. Dos formas de hacer lo mismo,
una de ellas muda, no es una comodidad — es una trampa. Ahora lleva a Ajustes, y
sin nombre muestra un ícono de persona en vez de un dígito suelto.

### 33.3 La agenda se leía cuando ya la estabas esperando

«Al lápiz ya me debería aparecer precargado los contactos y no recién allí
ponerme a cargar». El problema era estructural: la lectura vivía **dentro del
hook**, así que los 600 y pico de contactos se empezaban a leer en el instante en
que la pantalla se montaba — es decir, con la persona ya mirando. Y como cada
pantalla que usa contactos monta su propio hook, la lectura se repetía entera en
«nuevo chat», en «evento» y en «encuesta».

`agendaEnMemoria.ts` la lee una vez, apenas hay sesión, mientras se mira la lista
de chats. Detalles que no son opcionales:

- **La promesa en curso se guarda.** Es lo que vuelve idempotente a
  `precargarAgenda()`: tres pantallas montando a la vez se suman a la MISMA
  lectura. Sin eso, el almacén compartido solo movería las tres lecturas de lugar.
- **`estadoDeAgenda()` devuelve siempre la misma referencia** mientras nada
  cambie. Es requisito de `useSyncExternalStore`, no un detalle: un objeto nuevo
  por llamada se lee como «cambió» sin fin y la app entra en bucle de render.
- **`olvidarAgenda()` al cerrar sesión.** Otro teléfono, otra persona.
- Cambia **cuándo se pide el permiso de contactos**: ahora al entrar, no al tocar
  el lápiz. Se acepta — el permiso hay que pedirlo en algún momento, y pedirlo
  mientras se miran los chats interrumpe menos que pedirlo justo cuando querés
  escribirle a alguien.

Verificado en el emulador: a **un segundo** del toque el lápiz ya muestra la
lista, sin esqueletos.

**Lo que todavía NO hace:** sobrevivir al cierre de la app. En un arranque en
frío la primera lectura sigue costando. Guardarla en disco es el siguiente paso y
va **cifrada** — una agenda en claro en el almacenamiento es exactamente lo que
`cacheCifrada.ts` existe para evitar.

### 33.4 Lo que queda pendiente

**Modo claro/oscuro.** `shared/tokens.json` ya trae la paleta `dark` completa,
pero `tailwind.config.js` solo cablea la `light`, y hay **88 colores hardcodeados**
repartidos en 20 pantallas (casi todos `color="#…"` de iconos, que no aceptan
clases de Tailwind). No es un ajuste de configuración: es un proveedor de tema
más un barrido pantalla por pantalla. Hacerlo a medias deja pantallas mitad
oscuras, que se ven peor que no tenerlo.

## 34. Modo claro / oscuro (27/08/2026)

José: «lilachat no tiene darkmode o light mode como lilastore».

**Primero hubo que corregir un supuesto mío.** Dije que la paleta oscura ya
estaba en `shared/tokens.json` y solo faltaba cablearla. Falso: tenía DOS
colores, `background` e `inversePrimary`. Eso no es una paleta, es una intención.
Hubo que diseñarla.

### 34.1 Variables CSS, no `dark:` en cada clase

El camino obvio —poner `dark:` en cada `className` de cada pantalla— es el
equivocado, y no por trabajo: son 20 pantallas, se olvida una y queda un bloque
blanco en medio de una pantalla negra; y desde ese día cada clase nueva hay que
acordarse de duplicarla. El olvido es cuestión de tiempo.

Los colores se declaran como **variables CSS** (`--color-surface`) y las clases
quedan iguales en los dos modos: lo que cambia es el valor. Una pantalla escrita
sin pensar en el tema funciona en oscuro sola. `darkMode: 'class'` y NativeWind
pone la clase según `colorScheme`.

Piezas y por qué están donde están:

- `shared/src/tema.ts` — `NOMBRES_DE_COLOR` es la fuente ÚNICA del mapa
  token→clase. De ahí salen **el `tailwind.config.js` y el bloque de variables de
  `global.css`, los dos generados** (`npm run emit-tokens`). Escribir cualquiera
  de los dos a mano habilita el fallo silencioso: una variable que Tailwind
  nombra y el CSS no define **no rompe nada, se resuelve a transparente**, y uno
  termina buscando el problema en el layout.
- Los valores son **canales sueltos** (`107 56 212`), no `rgb(...)`. Tailwind lo
  envuelve con `<alpha-value>`, y eso es lo que mantiene vivo el `/10` de
  `bg-primary/10`. Con un `rgb()` completo adentro, todos los fondos tenues de la
  app se vuelven sólidos.
- El test `todos los nombres resuelven en los DOS modos` recorre el mapa entero:
  un color nuevo sin su par oscuro sale en rojo antes de compilar. Y el de
  «superficie y texto cambian entre modos» existe porque sin él la prueba pasaba
  con la paleta oscura vacía heredando todo lo claro — el estado real del
  proyecto hasta hoy.

### 34.2 Las decisiones de la paleta oscura

- **Las tarjetas van MÁS CLARAS que el fondo** (`#1a2337` sobre `#0f172a`). Es el
  reflejo de la regla del modo claro (blanco sobre gris): la elevación se lee
  como «más cerca de la luz». Una tarjeta más oscura que su fondo parece un
  agujero.
- **`primary` se invierte**: en oscuro es violeta CLARO (`#d0bcff`) y `onPrimary`
  pasa a ser oscuro. En oscuro `primary` se usa sobre todo como texto sobre el
  navy, y el violeta del modo claro ahí no se lee. Es el `inversePrimary` de
  Material, que existía suelto y ahora ocupa su lugar.
- **`outline` es MÁS CLARO que en modo claro**, y no es un descuido: los bordes
  se dibujan con `border-outline/10`, y el gris del modo claro a un 10 % sobre
  navy es literalmente invisible.
- El fondo es navy y nunca negro puro (spec §2.1).

### 34.3 Los 106 hex escritos a mano

Lo que las clases no cubren: el `color` de los iconos de `lucide-react-native`,
el `placeholderTextColor` y el `StatusBar`. Eran **106 hex en 21 archivos**, y
cada uno un punto que se quedaba en modo claro. Ahora salen de `useColores()`;
quedan cero hex fuera de `src/ui/tema.tsx`.

El barrido se hizo con un script, y el script inserta `const colores =
useColores()` como **PRIMERA sentencia** del componente a propósito: es la
lección de §31 —un hook después de un return condicional cambia la cantidad de
hooks entre renders—, y meterlo en cualquier otro lado era la forma más rápida de
reintroducir ese bug en 21 archivos de una vez. La regla `rules-of-hooks` en
verde después del barrido es la que confirma que no pasó.

`App.tsx` se partió en `App` (monta proveedores) y `Contenido`: un componente no
puede consumir un contexto que él mismo monta, y sin el corte el `StatusBar` y el
indicador de carga se quedaban en claro para siempre.

### 34.4 Detalles encontrados probándolo en el emulador

- **`CallScreen` casi queda ilegible.** La había excluido del barrido pensando
  que sus iconos blancos van sobre botones rojos y verdes. Su raíz es
  `bg-primary`, que en oscuro es violeta CLARO: los iconos blancos habrían
  desaparecido. Es el argumento contra excluir archivos «por criterio» en un
  barrido de color — se revisa o se incluye, no se supone.
- **El botón deshabilitado no se leía.** El fondo inactivo es `bg-primary/30`, o
  sea el primario translúcido sobre el fondo: el resultado se parece al FONDO, no
  al primario, así que el `on-primary` oscuro quedaba casi encima del navy. Ahora
  el contenido inactivo usa `on-surface-variant`, que además mejora el modo claro
  (era blanco sobre violeta pálido).
- **Un falso positivo mío**: leí el enlace «Envíalo a mi correo» como azul
  oscuro sobre navy en la captura. Muestreado el píxel, era `#9ecaff` exacto
  sobre `#0f172a` exacto. En capturas de 320 px el ojo no alcanza: se mide.

### 34.5 Verificado en el emulador (0.1.20 · 21)

| Paso | Resultado |
| --- | --- |
| Sistema en oscuro, «Sistema» | toda la app en navy, StatusBar claro |
| Ajustes → «Claro» con el sistema en oscuro | vira a claro al instante |
| Ajustes → «Oscuro» | vira a oscuro |
| Nuevo chat, agenda, hoja de crear, formulario de evento | correctos en oscuro |
| Modo claro tras el cambio | idéntico al anterior, sin regresión |

**Pendiente:** no se pudo ver la pantalla de conversación con burbujas — hace
falta una segunda persona y la QA corre con un solo usuario de prueba.

## 35. Notificaciones por FCM (27/08/2026)

Tres veces José pidió sacar la notificación permanente y tres veces la respuesta
fue que no se podía. Era cierta pero incompleta: no se podía **manteniendo el
socket propio**. Con FCM el que sostiene la conexión es el sistema operativo, y
el servicio en primer plano —con su burbuja fija y su wake lock— deja de hacer
falta.

### 35.1 El camino de push estaba roto y decía estar listo

`pushSender.ts` afirmaba en su comentario que estaba «completo salvo la
credencial». No lo estaba: hablaba con `https://fcm.googleapis.com/fcm/send`, la
API **legacy** que Google apagó en junio de 2024. Poniendo la clave no habría
salido ni una notificación — un camino configurado, en verde, y mudo.

Es el peor tipo de deuda: la que se documenta como terminada. Si alguien hubiera
puesto `FCM_SERVER_KEY` un mes antes, el síntoma habría sido «las notificaciones
no llegan» sin ninguna pista de que el endpoint ya no existía.

### 35.2 Lo que hay que saber de HTTP v1

- Se autentica con una **cuenta de servicio**, no con una clave: se firma un JWT
  RS256 y se cambia por un token de acceso. `jsonwebtoken` ya era dependencia
  (lo usan las sesiones), así que no se sumó nada al árbol.
- El token de acceso dura una hora y **se cachea**: pedir uno por notificación
  agrega un viaje a cada mensaje y, con un grupo activo, nos gana un límite de
  tasa de Google por cuenta propia. Se renueva un minuto antes de vencer — uno
  que expira entre que se lee y se usa da un 401 irreproducible.
- **Todo `data` tiene que ser string.** Mandar el `seq` como número da un 400 que
  solo dice «invalid argument».
- Los `\n` de la clave privada llegan **escapados** al pasar por un `.env` o por
  un panel web, y la firma falla después con un error de OpenSSL que no menciona
  el formato en ningún lado. Por eso la credencial viaja en base64 y el motor los
  desescapa.
- «No está configurada» y «está rota» se distinguen: tratarlas igual deja a
  alguien creyendo que solo le falta pegar la credencial cuando ya la pegó mal.

### 35.3 Por qué la credencial NO va en el APK

La pregunta de José, y la respuesta define el diseño: son **dos mitades
distintas**.

- `google-services.json` va **dentro de la app**. Identifica el proyecto y deja
  que Android pida un token. No es secreto: viaja en cada APK y cualquiera puede
  descomprimirlo y leerlo.
- La **cuenta de servicio** va **solo en el server**. Con esa clave se le puede
  mandar una notificación a CUALQUIER usuario de Lilachat, firmada como
  Lilachat. Meterla en el APK sería publicarla: un `unzip` y listo.

O sea: la mitad pública se hornea en el build, la mitad secreta vive en el `.env`
de la mini y nunca sale de ahí.

### 35.4 El guard que hacía imposible probarlo

`registerPushToken` empezaba con `if (!Device.isDevice) return 'unsupported'`. La
intención era razonable —un emulador pelado no entrega token— pero la
consecuencia era que **FCM no se podía verificar en ningún lado**: en el emulador
se rendía sin intentar, y en un teléfono real no hay forma de depurar. Un
emulador CON Google Play sí entrega token.

Se quitó: el `try/catch` ya cubre el caso. Se intenta y se degrada, en vez de
adivinar por el tipo de aparato. Es la diferencia entre una función que se puede
probar y una que hay que creerle.

### 35.5 Verificado

| Paso | Resultado |
| --- | --- |
| Credencial → token de acceso de Google | OBTENIDO |
| Endpoint v1 con destino inválido | `INVALID_ARGUMENT` (lo correcto) |
| La app registra su token FCM | sí, tras quitar el guard de `isDevice` |
| Envío real a ese token | 200, con id de mensaje |
| Llegada al aparato con la app cerrada | **la burbuja aparece**, sin aviso permanente |

**El servicio en primer plano queda APAGADO por defecto**, y con él se va el wake
lock. Se conserva como opción para un teléfono sin Google Play, donde el push no
llega nunca.

## 36. Grupos: sumar gente y salir (29/08/2026)

«Implementá el detalle de chat de grupo, no existe» (José). La pantalla SÍ
existía —`ChatDetailScreen`, del diseño `info-grupo-alpha.png`—, pero «Añadir» y
«Salir del grupo» estaban apagados, y no por pereza de UI: **el server no sabía
hacer ninguna de las dos cosas**. Un botón inerte y una capacidad inexistente se
ven idénticos desde afuera; esa es la trampa de dejar botones apagados «por
ahora», parecen trabajo hecho.

### 36.1 Las reglas, en un motor puro

`shared/src/miembrosDeGrupo.ts` (`puedeAgregar`, `decidirSalida`):

- **Cualquier miembro puede sumar**, no solo el admin. Es lo que hace WhatsApp
  por defecto, y en un grupo chico pedir permiso convierte al admin en un cuello
  de botella que nadie pidió. Restringirlo sería un ajuste del grupo, no el
  arranque.
- **A un 1:1 no se suma gente**: lo convertiría en grupo sin que los dos
  originales lo decidan.
- **Si se va el último admin se promueve al miembro más antiguo**, en la misma
  operación. Sin eso queda un grupo que nadie puede administrar nunca más y solo
  se arregla desde la base. Y no se le impide salir: retener a alguien porque es
  el único admin es el tipo de puerta cerrada que hace desinstalar una app.

Endpoints: `POST /api/chats/:id/members`, `POST /api/chats/:id/leave`,
`GET /api/chats/:id/detail`. Los tres avisan por `chat.changed` a cada miembro
(las salas del socket son por usuario, así que el recién sumado se entera aunque
nunca haya abierto ese chat).

`addMember` usa `'members.userId': { $ne: … }` en la CONDICIÓN del update, no
solo `$addToSet`: así dos toques simultáneos no dejan a la misma persona dos
veces. Que la persona exista se comprueba contra la base y no en el motor — es un
dato, no una regla; sumar un id inventado dejaría un miembro fantasma.

### 36.2 Salir te dejaba adentro del grupo que abandonaste

Encontrado probando el flujo real. Salir funcionaba —el server sacaba, promovía
al más antiguo y el grupo desaparecía de la lista—, pero la UI solo cerraba el
detalle: quedabas **dentro de la conversación que acababas de dejar**, con el
campo de escribir habilitado, y había que tocar atrás para enterarte de que había
funcionado. Se agregó `onSalio`, que cierra el detalle Y la conversación.

Ningún test lo veía: el server hacía todo bien y la lista se actualizaba bien.
Era la experiencia lo que estaba roto.

### 36.3 «Agregar miembros desde un contacto nuevo»

La hoja para elegir a quién sumar listaba **solo a la gente con la que ya tenías
conversación abierta** (`GET /api/contacts`). Consecuencia: a alguien de tu
agenda que está en Lilachat y con quien nunca hablaste **no había forma de
sumarlo** — primero había que abrirle un chat 1:1 que nadie quería.

La lista buena ya existía: la del lápiz (`ContactPicker`), que cruza la agenda
del teléfono contra el padrón por `POST /contacts/match` y además ofrece
«Invitar a Lilachat» para quien todavía no entró. **Se reusa esa**, en vez de
mantener dos selectores que se comportan distinto.

Lo único que le faltaba es `candidatosParaSumar` (`shared/`, puro): descuenta a
los que ya están —se esconden, no se muestran para fallar al tocarlos— y
devuelve **en la misma llamada** el padrón SIN recortar. Esa segunda lista es la
trampa del cambio: «a quién falta invitar» se calcula cruzando la agenda contra
los registrados, así que con la lista recortada quien ya está en el grupo
reaparecería abajo, ofreciéndole instalar la app que está usando. Las dos salen
juntas para que no se pueda pasar la equivocada.

De paso apareció un defecto viejo en `ContactPicker`: el
`if (coinciden.length === 0) return null;` de la sección de invitar estaba
**comentado sin querer** —un bloque de documentación quedó sin cerrar y se tragó
la línea—, así que la cabecera «Invitar a Lilachat» se pintaba sobre una lista
vacía. Invisible al leer: la línea muerta parecía parte del comentario.

### 36.4 Verificado en el emulador (0.1.33 · 34)

Sembrando un usuario registrado que NO tiene chat conmigo y SÍ está en la agenda
del aparato (`scripts/seed-contacto-nuevo.ts`), que es el caso que la hoja vieja
no mostraba:

| Paso | Resultado |
| --- | --- |
| Abrir «Añadir» en el grupo | aparece el contacto nuevo, que antes no existía para esta pantalla |
| Wilson, ya miembro | NO aparece ni para sumar ni en «Invitar a Lilachat» |
| Tocarlo | «3 participantes», y el miembro nuevo con el nombre de MI agenda |
| En la base | `999888777 · member · joinedAt` — la escritura está |
| Reabrir «Añadir» | «Todos tus contactos de Lilachat ya están en este grupo» |
| Buscar «wilson» | «Nadie coincide»: el buscador no saltea la exclusión |
| Salir del grupo (turno anterior) | `902049935 admin + 960397018 member` → `960397018 admin` |

Data de QA borrada y verificada en cero; el grupo quedó con los miembros y roles
que tenía.

### 36.5 Sacar a alguien del grupo

`DELETE /api/chats/:chatId/members/:userId` — sacar a alguien es borrar una
membresía, y el verbo lo dice mejor que un `POST /kick`.

**Sacar NO es simétrico con sumar, y esa es la decisión.** Sumar lo puede hacer
cualquier miembro; sacar, solo un admin. Si un miembro común pudiera echar gente,
cualquiera podría vaciar el grupo —o echar al admin— y no quedaría a quién
reclamarle. Dos límites más, por el mismo motivo:

- **Entre admins no se echan.** Si no, el grupo lo decide quien toca primero: dos
  admins enojados se sacan mutuamente en una carrera. Para que se vaya un admin,
  se le pide que salga.
- **A uno mismo no se saca**: eso es salir, y salir tiene reglas propias
  (promover al más antiguo si era el último admin). Mandarlo por acá las
  saltearía.

Las reglas están en `puedeSacar` (motor puro) y **las revalida el server**:
esconder un botón no es un permiso. La membresía va en la CONDICIÓN del update,
así que si la persona ya salió sola entre la lectura y el update no se contesta
que se hizo algo que no pasó.

`chat.changed` va a los miembros de ANTES, **incluido el que se sacó**: si se
notifica solo a los que quedan, al sacado el grupo le sigue apareciendo en la
lista y sigue parado dentro de un chat donde ya no puede escribir. Es el mismo
detalle que ya había fallado al salir.

En la UI el botón aparece solo cuando de verdad se puede, y **pregunta antes**
diciendo a quién y qué le va a pasar: es la única acción de esta pantalla que le
pasa algo a otra persona. El diálogo es el nativo (`Alert.alert`); en Android el
estilo `destructive` no pinta el botón de rojo, así que el peso lo carga el
texto.

#### Verificado (0.1.34 · 35)

| Paso | Resultado |
| --- | --- |
| Fila de un miembro, siendo admin | aparece el botón de sacar |
| Mi propia fila | NO aparece: para irme está «Salir del grupo» |
| Tocarlo | diálogo con el nombre y qué le va a pasar |
| Confirmar | «2 participantes» y la membresía borrada en la base |
| Wilson (miembro común) intenta sacar, por el endpoint real | 400 «Solo un admin puede sacar a alguien del grupo» |
| Sacarme a mí mismo, por el endpoint real | 400 «Para irte del grupo usá "Salir del grupo"» |
| Sacar dos veces al mismo | 400 «Esa persona ya no está en el grupo» |

Lo que NO se verificó: **qué ve el sacado**. Hace falta un segundo aparato con
sesión propia; el aviso se manda (`chat.changed` a los miembros previos) pero
nadie lo recibió en la prueba.

### 36.6 Nombrar admin y renunciar al admin

`PATCH /api/chats/:chatId/members/:userId` con `{role}`: cambia UN campo de una
membresía que ya existe, mientras el `DELETE` de al lado la borra.

**Nombrar lo puede hacer cualquier admin; el admin se lo saca uno mismo.** Dar
permisos no le quita nada a nadie, pero si un admin pudiera degradar a otro
podría después echarlo: dos toques y el grupo cambió de dueño. Es la misma
carrera que ya evita `puedeSacar`.

**Y el grupo nunca se queda sin admin**: el único no puede renunciar. Es el
agujero que `decidirSalida` tapa promoviendo al más antiguo cuando alguien se va;
acá NO se promueve solo —quien está mirando la lista puede elegir— así que se le
pide nombrar reemplazo antes. La puerta no queda cerrada: hay salida y se dice
cuál.

El rol ANTERIOR va en la condición del update, así que dos cambios simultáneos no
se pisan con una vista vieja. Los miembros viejos sin `role` guardado cuentan
como «member», que es lo que ya asume el resto del código.

**Las tres acciones sobre un participante pasaron a una HOJA con etiquetas**
(`AccionesDeMiembro`), en vez de iconos sueltos en la fila: dos iconos ya
competían con el nombre y el sello de admin, y sobre todo un escudo no dice
«nombrar admin». Qué acciones aparecen lo decide `accionesDeMiembro`, que le
pregunta a las MISMAS funciones que después aplica el server — armar esa lista
aparte sería una segunda copia de las reglas, y las dos copias se separan en el
primer cambio. **Una fila sin acciones no abre hoja.**

Las tres preguntan antes, y el texto dice lo que de verdad va a pasar: al nombrar
admin **ya no se lo podés quitar**, y al renunciar te tiene que nombrar otro.

#### Verificado (0.1.35 · 36)

| Paso | Resultado |
| --- | --- |
| Siendo el único admin, mi propia fila | sin «⋮»: no hay nada que pueda hacer conmigo |
| «⋮» de un miembro | hoja con «Nombrar admin» y «Sacar del grupo» |
| Nombrar admin | aviso de que después no se lo puedo quitar; queda `admin` en la base |
| Fila del otro admin, ya nombrado | sin «⋮»: ni bajarlo ni sacarlo |
| Mi fila, con otro admin en el grupo | «⋮» con «Dejar de ser admin» |
| Renunciar | quedo `member` en la base, y **ninguna fila abre hoja** |
| Miembro común se nombra admin a sí mismo, por el endpoint | 400 «Solo un admin puede cambiar los roles» |
| Admin le quita el admin a otro admin, por el endpoint | 400 «No podés quitarle el admin a otra persona» |
| El único admin renuncia, por el endpoint | 400 «Sos el único admin. Nombrá a otro antes» |
| `role: 'dueño'` | 400 «Ese rol no existe» |

El grupo quedó como estaba: José admin, Wilson member. Toda la ida y vuelta de
roles se hizo por la API real, sin tocar la base a mano.

### 36.7 El nombre y la foto del grupo

`PATCH /api/chats/:chatId` con `{name}`, y `POST /api/chats/:chatId/avatar`
(multipart) para la foto.

**Lo puede cualquier miembro**, igual que sumar gente. Lo que pide admin es lo
que le SACA algo a otro; corregir un nombre no le saca nada a nadie. Un 1:1 no se
toca: ahí no hay nombre ni foto propios —son los de la otra persona— y dejarlos
editar sería dejarte renombrar a alguien en su propio chat.

La foto **se sube y se guarda en UN request**, igual que la media de los
mensajes: subir primero y guardar después dejaría archivos huérfanos si algo se
cae en el medio. `avatarUrl` se guarda RELATIVA y se sirve absoluta —persistir el
host dejaría rotas todas las fotos viejas en el próximo cambio de hosting, ya
pasó en Portal—. El campo `avatarMediaId` estaba declarado en el schema desde el
principio **y sin usar**; ahora guarda el nombre en el storage.

El nombre se limpia antes de guardarse: los saltos de línea y los espacios
repetidos se COLAPSAN en vez de rechazarse. Un `\n` pegado desde otro lado rompe
la fila de la lista, y arreglarlo en silencio es mejor que devolver un error por
algo que la persona ni ve. El tope de 25 dejó de estar escrito dos veces: sale de
`shared`.

#### La lección que estaba escrita y pisé igual

La primera versión de la subida usaba `fetch`, y en el emulador falló con **«Sin
conexión»** teniendo conexión: el `fetch` de Expo SDK 57 («winter») solo acepta
strings o Blobs en un `FormData`, y el `{uri, name, type}` clásico de React
Native muere ahí. La lección estaba escrita en `mediaUpload.ts` desde el E2E de
F3 — y aun así el código nuevo la repitió.

El arreglo no fue copiar el XHR: se extrajo `subidaXhr.ts`, que ahora usan las
dos subidas. Una lección escrita en un comentario se vuelve a pisar; una que vive
en la única función que sabe subir, no.

Que el fallo dijera «sin conexión» es lo que lo hizo caro de leer. **El server se
probó primero** (§4c del loop): un `curl` al mismo endpoint devolvió 200, y eso
señaló al cliente en un paso.

#### Verificado (0.1.36 · 37)

| Paso | Resultado |
| --- | --- |
| Cabecera del detalle | cámara sobre el avatar y lápiz junto al nombre |
| Escribir «Los originales  2026» con DOS espacios | se guardó `"Los originales 2026"`, con uno |
| Elegir foto de la galería | queda de avatar, y en la base `avatarUrl` + `avatarMediaId` |
| Volver a la conversación | la cabecera muestra la foto y el nombre nuevos sin recargar |
| Lista de chats | la fila del grupo con su foto |
| Nombre vacío / 26 caracteres | 400 con el motivo de cada uno |
| Renombrar un 1:1 | 400 «Una conversación de a dos no tiene nombre propio» |
| Un PDF como foto | 400 «La foto del grupo tiene que ser una imagen» |

El grupo quedó como estaba: «Los originales», sin foto.

### 36.8 El chat cuenta lo que cambió

Cada cambio del grupo deja su línea en la conversación: nombre, foto, sumar,
sacar, salir, nombrar admin y renunciar. Antes el grupo se llamaba distinto de un
día para el otro y nadie sabía quién lo había cambiado; alguien desaparecía de la
lista de participantes sin rastro de si se fue o lo sacaron.

**El texto se arma en el TELÉFONO, no en el server.** El server solo conoce el
nombre que cada uno se puso; el que quien mira reconoce es el de SU agenda. El
mensaje guarda el EVENTO y con qué resolver los nombres (`system: { evento,
targetId, valor, quien, aQuien }`), y la frase la compone `textoDeAviso` (motor
puro). `body` va como respaldo con los nombres del server.

Tres decisiones que no son obvias:

- **En un chat cifrado no se escribe ningún aviso.** Guardar «Fulano cambió el
  nombre» en claro dentro de una conversación con candado rompe la promesa del
  candado por una cortesía. `escribirAviso` filtra por `encrypted: { $ne: true }`.
- **La promoción automática va sin autor** («Ana quedó como admin del grupo»). La
  decidió el server al irse el último admin; firmarla con el nombre de quien se
  fue sería mentir sobre quién decidió qué.
- **Un evento sin sus datos no se dibuja.** Si llega incompleto —un cliente
  viejo, un dato perdido— es mejor un hueco que «agregó a undefined».

`escribirAviso` no pasa por `sendMessage` porque ese exige que quien manda sea
miembro, y el aviso de que ALGUIEN SE FUE se escribe justo cuando dejó de serlo.
Comparte lo único que no puede divergir: el `$inc` atómico de `lastSeq`.

**No generan notificación push.** `notifyOffline` cuelga del handler del socket,
así que los avisos quedan fuera solo. Es lo correcto: despertar un teléfono para
contarle que alguien cambió una foto es la vía rápida a que silencien la app.

#### Dos defectos que destapó

1. **La última fila quedaba tapada por la barra de escribir.** Un grupo recién
   creado tiene UNA línea, y aparecía cortada a la mitad. Con la conversación
   llena no se notaba, así que el defecto vivía escondido en el único caso que
   antes casi no existía: un chat sin historial. Faltaba `flex-1` en la lista
   —sin él su borde inferior quedaba debajo de la barra— y un `scrollToEnd` al
   montar: con `startRenderingFromBottom`, el contenido corto se ancla al fondo
   con un offset que sobra.
2. **La vista previa de la lista decía el número, no el nombre.** «902049935
   cambió la foto del grupo»: es la MISMA queja que ya había arreglado
   `nombreDeContacto`, en el mismo lugar. Adentro de la conversación estaba bien;
   el resumen de la lista solo llevaba el `body` del server. Ahora viaja también
   el payload y la lista lo rearma igual.

#### Verificado (0.1.37 · 38)

Los siete eventos, en una sola conversación y con datos reales: «Cambiaste el
nombre del grupo a …», «Agregaste a WilsonPrueba», «Nombraste admin a
WilsonPrueba», «WilsonPrueba dejó de ser admin», «Sacaste a WilsonPrueba»,
«WilsonPrueba salió del grupo», «Cambiaste la foto del grupo». El nombre que se
lee es el de la AGENDA del teléfono, no el que la persona tiene en Lilachat.

Lo que NO se verificó: `admin-auto` (hace falta que se vaya el último admin de un
grupo real) y cómo se ve un aviso para quien NO lo hizo — las dos frases en
tercera persona salieron de los tests, no de la pantalla, porque hay un solo
teléfono con sesión.

## 37. El aviso de que hay versión nueva (30/08/2026)

Pregunta de José: «¿es buena idea que salte una burbuja de actualización, o que
al abrir la app les salga el aviso de alguna manera?».

**Burbuja no.** Una notificación push por una actualización es la vía más rápida
a que alguien silencie las notificaciones de la app — y con ellas los mensajes,
que es lo único que importa de verdad. Un modal al abrir es peor: interrumpe
justo cuando la persona venía a leer algo.

Va una **banda discreta arriba de la lista de chats**, que se descarta y **no
vuelve por la misma versión** pero sí aparece con la siguiente: descartar no
puede ser apagarlo para siempre. La excepción es la versión MÍNIMA
(`minVersionCode`): ahí no se puede descartar, porque por debajo del mínimo la
app no funciona y esconder el aviso deja a alguien mirando algo roto sin saber
por qué.

### 37.1 Por qué Lilachat NO se instala a sí misma

La otra pregunta de José: «así como LilaStore se actualiza e instala sola,
¿Lilachat debería poder?».

Técnicamente sí; conviene que no. Instalar un APK exige
`REQUEST_INSTALL_PACKAGES`, y **a LilaStore ya la bloqueó Play Protect** por su
combinación de permisos (§ de la dieta de permisos). Esa app tiene un motivo
legítimo para pedirlo: es una tienda. Una app de CHAT que sabe instalar
aplicaciones es una señal de alarma justificada — es la forma exacta que tiene el
malware — y Lilachat acaba de salir de una dieta de permisos por ese motivo.

Así que la banda **deriva a LilaStore** (`lilastore://`), que además verifica el
`sha256` antes de entregarle nada al instalador de Android. Sin la tienda
instalada, cae al navegador con la descarga directa. No se pregunta con
`canOpenURL`: en Android 11+ eso exige declarar la app en `<queries>` y contesta
`false` sin decirlo, que se leería como «no tenés la tienda» a quien sí la tiene.

La consulta al arrancar es UNA sola y ya existía (el enlace de la invitación):
ahora sirve para las dos cosas.

### 37.2 Verificado (con un build viejo a propósito)

Instalando un APK 0.1.36 (37) con 0.1.37 (38) ya publicado:

| Paso | Resultado |
| --- | --- |
| Abrir la app | banda «Lilachat 0.1.37 — Hay una versión nueva» |
| «Actualizar» | abre LilaStore (`topResumedActivity` = `com.constroad.lilastore`) |
| «✕» | la banda se va |
| Cerrar y volver a abrir | NO vuelve |

**Lo que no se pudo verificar en el emulador:** que LilaStore ofrezca
«Actualizar». Mostró «Abrir», y el motivo es del entorno, no del código: la
tienda **no puede leer la versión instalada** de otra app —no hay API de Expo
para eso— así que usa su propio registro de lo que instaló ella. Acá Lilachat se
instaló por `adb`, o sea fuera de la tienda, y para ella es una app «instalada
con versión desconocida» → `accionDeApp` devuelve «Abrir», que es su
comportamiento correcto (`instaladas.ts`). En un teléfono donde la tienda instaló
la app, el registro existe y ofrece actualizar. **Queda sin comprobar en un
teléfono real.**

### 36.9 Pendiente

- **Sumar de a varios**: hoy es uno por vez (la hoja se cierra y la lista se
  recarga). Alcanza para un grupo familiar; para armar uno de diez es tedioso.
- **Nadie puede recuperar un grupo sin admin.** No puede pasar por las reglas de
  hoy, pero si pasara —datos viejos, un borrado a mano— no hay forma de arreglarlo
  desde la app.
- Invitar desde acá crea la admisión y comparte el enlace, pero **no suma**: la
  persona tiene que instalar y entrar, y recién ahí se la puede agregar. La hoja
  lo dice en su subtítulo en vez de dejar que se descubra.
- **La foto se puede cambiar pero no QUITAR**: no hay endpoint para volver a la
  inicial. Un grupo con una foto desafortunada solo puede taparla con otra.
- **El aviso de `admin-auto` no se vio en pantalla**: solo en los tests. Hace
  falta un grupo del que se vaya su último admin.
- **La tienda ofreciendo «Actualizar» no se probó en un teléfono real** (§37.2).


## 38. Buscador y filtros en la lista, y el video que no se reproducía (30/08/2026)

Tres cosas que José marcó mirando la app al lado de WhatsApp.

### 38.1 La lupa llevaba días apagada

«La lista de chats no tiene el buscador ni los filtros de no leído, favoritos,
etc.». El ícono de lupa estaba en la cabecera desde el primer día **inerte**,
esperando a «F6» — y un ícono apagado se ve igual que uno roto.

Ahora la lista tiene el buscador SIEMPRE visible y una fila de chips: **Todos ·
No leídos · Grupos**, con su contador al lado. El motor es puro
(`filtrarChats`): busca sin tildes ni mayúsculas —«jose» encuentra a «José»— y
también dentro del último mensaje, que es como se encuentra «el chat donde
hablamos de eso». El título que se busca es el YA resuelto contra la agenda:
buscar «Wilson» lo encuentra aunque el server solo conozca su número.

**No hay chip de «Favoritos» a propósito**: en esta app no existe marcar ni fijar
un chat, y poner el chip para que no filtre nada sería repetir el error de la
lupa apagada. La lupa inerte de la cabecera se quitó: dejarla al lado de un
buscador que funciona enseña que hay botones que no responden.

Dos detalles de layout que solo se ven corriéndolo:

- Un `ScrollView` horizontal dentro de una columna **estira a sus hijos a toda
  su altura**: los chips salieron como píldoras gigantes hasta ponerles
  `alignItems: 'center'`.
- Y **crece hasta llenar lo que sobra**: sin `flexGrow: 0` la fila de chips se
  comía media pantalla con dos huecos enormes alrededor.

### 38.2 El video no se reproducía

«Toco el video y no reproduce en el visor». Eran dos cosas encadenadas:

1. **El visor solo sabía dibujar imágenes.** Se le pasaba la URL a un
   `<Image>`, así que un video mostraba su cuadro de portada y nada más. Ahora,
   si el `mime` empieza con `video/`, monta un reproductor (`expo-video`) con los
   controles nativos y arranca solo — uno toca un video para verlo, no para
   encontrarse otro botón de play.
2. **Y le llegaba el archivo equivocado.** El visor recibía `thumbUrl` —la
   miniatura— y no `url`. Con un video eso es un JPG: no había nada que
   reproducir. De paso, las FOTOS se venían mostrando a pantalla completa en su
   versión miniatura, o sea borrosas, desde siempre.

Además, en la burbuja **un video se veía idéntico a una foto** (la miniatura es
un cuadro del video): ahora lleva el botón de play encima.

### 38.3 El «+» se convertía en un spinner

«Al subir, el ícono de más cambia a un loader, eso es incorrecto». Tenía razón:
es contar la misma cosa dos veces y en el lugar equivocado — el progreso ya se ve
en la burbuja que se está subiendo, que es donde uno mira. Y un botón que cambia
de forma hace perder el punto donde estaba el dedo. Queda atenuado y sin
responder —no se puede subir dos cosas a la vez— pero se sigue viendo lo que es.

### 38.4 Verificado (0.1.40 · 41)

| Paso | Resultado |
| --- | --- |
| Lista de chats | buscador arriba y chips «Todos · No leídos · Grupos 1» |
| Chip «Grupos» | queda solo «Los originales» |
| Buscar «wil» | encuentra a Wilson, con el nombre de la agenda |
| Burbuja de un video | miniatura con el botón de play encima |
| Tocarla | el visor **reproduce**, con controles nativos, y llega al final |
| Subir una foto (grupo de QA) | el «+» sigue siendo «+», atenuado; el progreso en la burbuja |

Data de QA borrada y verificada en cero.


## 39. Los archivos, y la caché que no olvidaba (30/08/2026)

### 39.1 «Limpiá esas líneas sin desloguearme»

Habían quedado en el grupo de José unos avisos de una prueba mía que **borré de
la base**, y no se iban del teléfono. La causa es de diseño y valía la pena
verla: `mergeBySeq` solo SUMA, así que un mensaje que desaparece del server sigue
dibujándose para siempre en cada aparato que ya lo tenía guardado.

Arreglarlo llevó **tres intentos**, y los dos primeros fallaron por el mismo tipo
de razón: creer que el problema estaba resuelto sin mirar por dónde entra de
verdad la data.

1. **Conciliar por rango.** La página que llega describe un tramo de `seq`; ahí
   manda el server. No alcanzó: los fantasmas tenían seq 3–7 y el chat, que yo
   había vaciado reseteando `lastSeq`, volvía a empezar en 1. Nunca entraban en
   el rango de ninguna página.
2. **Sumar el tope del server** (`lastSeq`, que ahora viaja CON la página —
   calculado en el cliente sería una carrera). Correcto, pero seguía sin pasar
   nada: **la carga inicial no usa ese camino**. Va por `sync.pull` del socket,
   que manda un DELTA desde un cursor y por definición nunca describe el chat
   entero.
3. **Sanear al abrir**: si había caché, se pide la última página por HTTP y se
   concilia. Recién ahí los fantasmas desaparecieron.

La regla quedó acotada a propósito: dentro del rango de la página manda el
server, por encima del tope no puede existir nada, y **fuera de eso no se toca**
—lo de más atrás el server no lo mencionó, y borrar por silencio vaciaría el
historial en cada apertura—. Una página vacía no dice nada.

**Ojo el día que el server empiece a olvidar a propósito.** Si se adopta el
modelo de WhatsApp —borrar al entregar— esta función pasa de arreglar una
inconsistencia a BORRAR el historial de la gente, y sale junto con ese cambio.
Está escrito en el módulo.

### 39.2 Un PDF era un rectángulo en blanco

«Probá con un PDF el visor». Estaba roto de punta a punta:

- En el chat llegaba como un **rectángulo blanco de 220×220** —lila le genera
  miniatura de la primera página— sin nombre, sin tamaño y sin nada que dijera
  que era un archivo. Mientras subía, un cuadro vacío del color de la burbuja con
  un porcentaje encima.
- En el visor, la URL del PDF iba a parar a un `<Image>`: pantalla negra.
- Y **el nombre del archivo no existía**: el server guardaba el nombre del
  storage (`file-2026-08-30T…pdf`), que no le dice nada a nadie. Un documento ES
  su nombre, así que el mensaje ahora guarda `fileName` y `sizeBytes`.

Ahora en el chat va como tarjeta (ícono, nombre, tamaño) y en el visor una
tarjeta con **Abrir**, que lo entrega a la app del teléfono que sepa abrirlo, por
`content://` — pasarle un `file://` de nuestro almacenamiento privado le da una
ruta que no puede leer y Android lo corta con `FileUriExposedException`. Meter un
motor de PDF pesaría más que toda la app, y el teléfono ya tiene uno.

### 39.3 Verificado (0.1.43 · 44)

| Paso | Resultado |
| --- | --- |
| Abrir el grupo con las líneas fantasma | desaparecen solas; queda lo que el server tiene |
| Mandar un PDF | tarjeta con «prueba-lilachat.pdf · 654 B» |
| Un archivo subido ANTES del cambio | tarjeta con «Archivo · Tocá para abrirlo» (sin nombre guardado) |
| Tocarlo | el visor muestra el nombre y «Abrir» |
| «Abrir» | lo abre el visor de PDF del teléfono, con el texto legible |

Data de QA borrada y verificada en cero.

## 40. Notas de voz, checks, recorte y un solo camino de actualización (30/08/2026)

Cuatro pedidos de José en una tanda.

### 40.1 Notas de voz

El micrófono estaba en la barra desde el primer día **apagado**, ocupando su
lugar para que la barra no cambiara de forma el día que existiera. Ahora graba
(`expo-audio`, `useGrabadorDeVoz`).

**Se toca para empezar y se toca para mandar, no se mantiene apretado.** En
WhatsApp hay que sostener el dedo, y para quien no lo tiene incorporado eso
termina en audios cortados a la mitad — soltás sin querer y ya se mandó. Con dos
toques se puede hablar mirando la pantalla y cancelar. Mientras graba, la barra
ES la grabación: cancelar, el tiempo corriendo, mandar.

Medio segundo de mínimo (`MINIMO_DE_VOZ_MS`) para que un roce no deje un audio de
dos décimas sonando en el teléfono de todos. Sube por el MISMO camino que una
foto —es media como cualquier otra—, así que la cola, el progreso y los errores
no se re-implementan. En la burbuja se escucha ahí mismo (`NotaDeVoz`), y **no
arranca solo**: un audio que suena al aparecer en pantalla es lo peor que puede
hacer un chat. El tipo `audio` se agregó de punta a punta (`MediaKind`, el enum
del schema, el preview de la lista).

### 40.2 Los checks se ponían azules sin que nadie leyera

«Los dos checks azules es si mi contacto ya leyó el mensaje; antes es gris». El
server emite `receipt` a TODOS los miembros del chat, **incluido quien acaba de
leer**. El cliente lo tomaba sin mirar de quién era, así que al abrir un chat
—donde la app se marca leída sola— mi PROPIO acuse subía «hasta dónde leyeron los
demás» y todos mis mensajes se pintaban de azul al instante, con el otro lado sin
haber visto nada. `esAcuseDeOtro` descarta el acuse propio.

### 40.3 La foto de grupo no se recortaba

«No hay opción de hacer crop de la imagen y centrarla». Se subía la foto entera y
el avatar es un círculo, así que una apaisada quedaba cortada por el medio a
criterio de nadie. Ahora `allowsEditing` abre el recortador del sistema en `1:1`,
porque el destino ES un círculo. (Sirve para grupo; la foto de perfil personal
todavía no existe.)

### 40.4 Un solo camino de actualización

«Buscar actualizaciones» de Ajustes abría el navegador con el APK suelto —el
«File might be harmful» de Chrome— mientras la banda de la lista ya mandaba a
LilaStore. El mismo pedido resuelto de dos formas es, para quien lo usa, una app
que a veces funciona. Los dos pasan ahora por `abrirActualizacion`.

### 40.5 Verificado (0.1.45 · 46)

| Qué | Cómo |
| --- | --- |
| **Checks** — VERIFICADO en el emulador | Con el fix, tras abrir el chat (que marca MI lectura) el mensaje quedó en UN check gris; cuando el otro usuario leyó de verdad (POST `/read` con su credencial) pasó a doble check. Antes, abrir el chat lo pintaba de azul solo. |
| Notas de voz | **Pendiente de ver en el aparato de José**: el emulador se reinició desde un snapshot viejo y perdió su sesión justo en el diálogo de permiso del micrófono. El motor tiene tests, el render y la subida compilan. |
| Recorte de foto | **Pendiente**, por lo mismo: es una opción del `ImagePicker`, sin lógica propia. |
| Un solo camino | El de la banda ya estaba verificado (§37.2); el de Ajustes usa la misma función. |

**Por qué quedó a medias la verificación en vivo:** el emulador crasheó y volvió
a un estado sin sesión. Recuperarla exige un OTP, y la regla es no generarlo ni
tipearlo (`qa-phone-only-902049935`: inventar números creó usuarios falsos en
producción). Lo verificable sin sesión se cubrió; lo visual queda para el aparato
de José, con este guion.

## 41. Checks estilo WhatsApp, PDF con miniatura, y el OTP por yopmail (30/08/2026)

### 41.1 Los checks: faltaba «entregado» de verdad

José, con capturas: «los dos checks azules es si tu contacto ya leyó; antes es
gris». El bug de fondo: `markRead` ponía `readSeq` **y** `deliveredSeq` a la vez,
así que no existía el estado intermedio. Un mensaje saltaba de un check
(enviado) a doble check azul (leído) **sin pasar nunca por el doble check gris**
(entregado) de WhatsApp.

Se agregó un acuse de ENTREGA separado (`markDelivered`, `$max` solo sobre
`deliveredSeq`), por dos caminos que se complementan:

- **Server**: al emitir `msg.new` a un miembro CONECTADO que no es el autor, se
  marca su entrega y se avisa al remitente. Así el doble check gris aparece
  aunque esa persona no tenga el chat abierto — como WhatsApp.
- **Cliente**: al RECIBIR un mensaje ajeno (`msg.new` / `sync.pull`) emite
  `deliver.set`. Cubre al que estaba offline y reconecta.

`resolveDeliveryState` ya distinguía los cuatro estados; lo que faltaba era el
dato. Reloj = en cola, un check = enviado, doble gris = entregado, doble azul =
leído.

**Verificado de punta a punta** (0.1.46, con un segundo socket como Wilson):
mensaje enviado → un check; Wilson conectado sin abrir → doble check GRIS;
Wilson marca leído → doble check AZUL. Confirmado el color mirando el píxel.

### 41.2 PDF: preview card y el nombre con %20

- La burbuja de un documento ahora muestra la **miniatura de la primera página**
  (lila la genera) como la preview card de WhatsApp, en vez de una tarjeta gris.
- El nombre salía URL-encodeado —«...REYNALDO%20(1).pdf»—; se **decodifica** para
  mostrar (`nombreLimpio`).
- `nombreDeArchivo` solo conocía extensiones de imagen/video: un PDF se bajaba
  como `.jpg`. Ahora un documento se baja con SU nombre y su extensión real.

**El pozo que caví y tapé en el mismo día:** al guardar el documento con su
nombre real, los espacios y paréntesis de «Cotizacion-289-REYNALDO (1).pdf»
rompían la ruta de cache y la content-uri del visor — el PDF abría **en blanco**.
El nombre EN DISCO se hace seguro (`[^A-Za-z0-9._-]→_`) conservando la extensión;
el nombre bonito se muestra igual. Abrir en sí ya funcionaba desde 0.1.43 (el
«Something went wrong» de la captura era del build viejo, 0.1.30).

Verificado en el emulador con la sesión real de José: el PDF abre y renderiza la
cotización completa.

### 41.3 El OTP se lee de yopmail, no se le pide a José

Estaba en las memorias y no lo hacía. El flujo correcto para verificar en el
emulador sin molestar a José ni crear usuarios falsos: apuntar el respaldo de
correo de SU número (`902049935`) a `jose.test@yopmail.com` un momento
(`InvitationModel.email`), pedir el código con `preferEmail:true`, leerlo en
`yopmail.com/en/?login=jose.test` (desktop, clic real en la fila), y **restaurar
su Gmail** al terminar. Su usuario real no se toca; solo un canal de respaldo que
se pone y se saca.

## 42. Audio, visor, Media/Docs/Links y presencia (30/08/2026)

Lote grande de José, verificado en el emulador con su sesión real y un segundo
socket como Wilson.

### 42.1 Audio: la duración en reposo

El envío y la reproducción YA funcionaban (grabar → enviar → reproducir,
verificado). Lo que se veía mal: en reposo mostraba «0:25» para una nota de 4 s,
porque el `m4a` remoto reporta mal su duración hasta cargar entero. Se guarda la
duración REAL al subir (`durationMs`) y es la que se muestra en reposo; al
reproducir se muestra lo que va corriendo.

### 42.2 Visor con flechas

El visor no navegaba. Se agregaron flechas ‹ › sobre la imagen/video que saltan a
la media anterior/siguiente por `seq`. Un documento no navega. Verificado: de una
foto a la siguiente, con ambas flechas cuando hay vecinos de los dos lados.

### 42.3 Detalle: Media / Docs / Links

La sección «Multimedia» mezclaba todo. Ahora son tres pestañas (motor puro
`clasificarMedias`): Media en cuadrícula de 3 con el play sobre los videos, Docs
y Links en lista. Abrir una media desde acá casa por url con la lista del chat,
así que las flechas del visor funcionan también desde el detalle. Los nombres de
Docs se decodifican (`nombreLimpio`).

### 42.4 «En línea» / «escribiendo…»

**Estaba muerto:** el server reenviaba `typing` pero NINGÚN cliente lo emitía.
Ahora la app emite al teclear (un `on:true`, `off` 3 s después de la última
tecla) y el header muestra «escribiendo…» / «en línea» en 1:1. En grupo dice
«alguien está escribiendo…» (nombrarlo pediría un fetch de miembros que no vale
para un cartel); «en línea» no se muestra en grupo (ruido con varios).

**El bug que costó encontrar:** el header no mostraba «en línea» aunque el otro
estuviera conectado. El `presence.snapshot` se emite UNA vez al conectar y lo
consume la lista de chats; cuando se ABRE un chat, `useChat` monta después y el
snapshot ya pasó, así que `enLinea` arrancaba vacío. El typing sí se veía porque
es un evento en vivo. Se agregó `presence.request` (el cliente lo pide al
conectar, el server responde con el snapshot actual). Diagnosticado node-a-node:
el server reenviaba presence y typing bien — faltaba pedir el estado inicial.

### 42.5 Multi-selección de chats (31/08/2026)

Como al mantener presionado en WhatsApp: long-press sobre una fila entra al modo
y desde ahí un toque marca/desmarca. El modo ES «hay algo seleccionado» (sin un
flag aparte). La barra reemplaza al buscador: X + conteo a la izquierda; a la
derecha las acciones del CONJUNTO, no de una fila.

**Las acciones se derivan del conjunto** (motor puro `shared/seleccionDeChats.ts`,
`accionesDeSeleccion`, 8 tests): silenciar dice «reactivar» solo si TODOS están
silenciados; fijar dice «desfijar» solo si todos están fijados; «marcar leído»
solo si algún seleccionado tiene no-leídos; «salir» solo si TODA la selección son
grupos (mezclar un 1:1 lo esconde). Una sola acción por lote.

**Silenciar y fijar persisten por usuario y por chat** — no globales: que José
silencie «Los originales» no lo silencia para Wilson. Viven en el subdoc
`chat.members[i]` (`muted`, `pinned`, `chatModels.ts`), se leen en `listChats`
(`ChatSummary.muted/pinned`) y se escriben por `PATCH /api/chats/:chatId/ajustes`
(`cambiarAjustesDeChat`, update posicional `members.$`). El push respeta el
silencio: `pushService` filtra los `muted` del chat antes de notificar.

**Orden con fijados arriba** (`ordenarChats`): los fijados primero, cada grupo por
recencia. El server NO ordenaba (`find` sin `.sort` → orden de inserción), así que
esto además arregla que la lista ahora va por recencia como WhatsApp. La hora de
`lastMessage.at` (ISO) se parsea a ms para comparar.

**En la fila**: icono de pin y de campana-tachada antes de la hora; el silencio
además apaga el badge de no-leídos (gris en vez de acento) y le quita el acento a
la hora. El FAB se esconde en modo selección.

**Marcar leído** reusa el socket `read.set` (el mismo cursor que ya usa el chat
abierto), por cada seleccionado con no-leídos. **Salir** reusa `POST
/:chatId/leave`.

**Verificado en el emulador (release 0.1.55, sesión viva de José, Maestro
`multiseleccion.yaml`)**: long-press entra a selección; la barra muestra las
acciones correctas por conjunto — grupo leído → fijar/silenciar/salir; 1:1 leído →
fijar/silenciar (sin salir, sin marcar-leído); check sobre el avatar de la fila
marcada; cancelar vuelve al buscador; orden por recencia.

**Persistencia verificada contra prod (31/08/2026, commit `8d6d09a`)**: por el
stack deployado completo — `PATCH /ajustes muted=true` → 200, y acto seguido la
DB tiene `members[jose].muted=true` **y** `listChats` lo devuelve `muted:true`
(que es lo que enciende el icono); `muted=false` revierte ambos. El silencio es
por-usuario (solo pega en el miembro que lo pide). Marcar leído y salir reusan
endpoints ya vivos. Server + shared + app en verde (tsc/lint/vitest: 23 archivos
server, 359 shared, 96 app).

### 42.6 Dos incidentes por saltarse el flujo canónico de publicación (31/08/2026)

El release **debe** compilarse y publicarse con `@constroad/lila-cli`
(`lila apk build` → `lila apk publish`), NUNCA a mano con `gradlew` + otro CLI
(skill `publicar-apk` §1, §1-bis). Saltarse ese carril produjo dos bugs seguidos,
ambos porque el CLI hace guardas que a mano se pierden.

**1) La 0.1.55 apuntaba a `http://10.0.2.2:4003` (localhost).** `app/.env` trae
esa URL de dev y **`EXPO_PUBLIC_*` se hornea en el bundle al compilar**;
`gradlew assembleRelease` lee `.env`, no `app/lila.json`. Síntoma tramposo: la
**lista** se veía (caché `leerChatsGuardados`), pero el **detalle de chat** (1:1 y
grupo) —que siempre pega a la red— decía «Sin conexión», y silenciar no llegaba.
En un teléfono real `10.0.2.2` no resuelve. La URL correcta ya estaba declarada en
`app/lila.json`; `lila apk build` la hornea Y **la verifica dentro del binario**
(rechaza localhost/IP privadas/`.ts.net`). Un `.env.production` fue un parche a un
problema autoinfligido; se quitó — la fuente es `lila.json`.

**2) Bucle de «Actualizar» que no se apaga tras actualizar.** `versionApi.ts`
lee el versionCode propio de `Constants.expoConfig.android.versionCode`, o sea del
**`app.json` empaquetado**. Los builds manuales bumpeaban `build.gradle` (→ el
`versionCode` del manifiesto, que la tienda LEE del APK) pero **no `app.json`**
(quedó en 55). Resultado: la app se creía la 55 mientras la tienda anunciaba 56/57
→ `decidirAvisoDeActualizacion` con `ultima > actual` **para siempre**; actualizar
instalaba otro APK con el mismo `app.json` empaquetado en 55 y el banner volvía.
`expo prebuild` (que corre `lila apk build`) deriva el manifiesto de `app.json`,
así que por el carril canónico las **dos** fuentes salen del mismo número y no
pueden divergir. Se bumpeó `app.json` (`version` + `android.versionCode`), única
fuente.

**Resuelto** republicando por el CLI como **0.1.57 (code 58)**: el `app.config`
embebido en el APK y el manifiesto dicen 58, la tienda anuncia 58 → `al-día`, el
banner desaparece. Verificado (skill §10): la descarga sirve
`lilachat-0.1.57-58.apk` (`content-disposition`), `cf-cache-status: DYNAMIC`.

Nota de tamaño: el APK va **solo arm64-v8a** (~39 MB, `--abi=arm64-v8a`). El
universal (4 ABIs, ~96 MB) excede el límite de ~100 s de Cloudflare del origen de
LilaStore y la subida corta con `524`.

### 42.7 Sonido al llegar un mensaje (31/08/2026)

José: «cuando me llegue un mensaje, que suene, como WhatsApp». Llegaba la
notificación pero **muda**: el canal Android `mensajes` se creaba sin `sound`, y
en expo-notifications un canal sin sonido es silencioso. Afecta los DOS caminos,
que comparten canal: el aviso **local** (`avisoLocal.ts`, con el socket vivo por
el servicio en primer plano) y el **push FCM** (`pushSender.ts`, con la app
muerta).

**Fix**: `sound: 'default'` en el canal (`'default'` = el tono del teléfono, así
respeta silencio/volumen del usuario) y en el push FCM (`android.notification`).
El aviso local pasó de `trigger: null` a `trigger: { channelId }`
(`ChannelAwareTriggerInput`): sin fijar canal, Android usaba uno de respaldo mudo.

**El canal es INMUTABLE una vez creado**, así que subir el sonido sobre el id
`mensajes` que ya existe en los teléfonos NO cambia nada. Se creó un id nuevo
`mensajes-v2` (constante `CANAL_MENSAJES` en `shared`, única fuente para app y
server; si divergen, el push cae en un canal inexistente y Android lo descarta) y
se borra el `mensajes` viejo (`deleteNotificationChannelAsync`). Test guarda que
el id sea versionado, no el original mudo. Los propios envíos ya no suenan
(`TabsShell` excluye `senderId === yo`).

**Transición**: mientras un teléfono no actualice, su app vieja solo tiene el
canal `mensajes`; el server ya manda a `mensajes-v2`, así que su push FCM
(app muerta) se descarta hasta que actualice — el aviso local sigue por su canal
viejo. Base chica que actualiza rápido, se autorresuelve. Publicado **0.1.58
(59)** por el flujo canónico. El **server** necesita deploy (push a `main`) para
que el push FCM lleve el `channelId`/`sound` nuevos; el aviso local ya va en el
APK.

**Tono/vibración con la app ABIERTA (0.1.59, 60).** José: sumar el tono dentro de
la app y el zumbido en modo vibrador. `avisarMensaje` ya no corta en foreground:
dispara la notificación igual, y `configureNotificationHandler` la presenta con
`shouldPlaySound: true` pero `shouldShowBanner: false` — suena/zumba sin tapar la
conversación con una burbuja. **No hace falta expo-audio ni leer el modo del
teléfono**: al presentar la notificación, Android aplica el `sound` y el
`vibrationPattern` del canal según el ringer — tono en normal, vibración en modo
vibrador, nada en silencio, que es exactamente lo pedido. Los propios envíos
siguen sin sonar (`TabsShell` los excluye).

**Paridad WhatsApp: sonar en cualquier pantalla menos el chat abierto (0.1.60,
61).** El tono de `TabsShell` solo salía en la LISTA: esa pantalla se desmonta al
abrir un chat (`App.tsx` es un ternario `home`/`chat`, mutuamente excluyentes) y
su listener `msg.new` se apaga, así que estando DENTRO de un chat no sonaba nada.
Se agregó en `App.tsx` un listener **siempre montado** que actúa solo con un chat
abierto (`boot.phase === 'chat'`), toca `avisarMensaje` para otros chats y **omite
el que estás mirando** (motor puro `sonarPorMensaje`: descarta lo propio y el
`chatAbierto`). No se pisa con el de la lista porque las fases son excluyentes, y
usa `socket.off('msg.new', onNew)` con handler NOMBRADO —el `off` a secas
borraría el listener de `useChat` que muestra los mensajes del chat abierto—. El
nombre sale del cache guardado (`leerChatsGuardados`). De paso tapa un hueco: con
la app en segundo plano DENTRO de un chat, ahora los otros chats sí avisan.

## 43. Sesión 14/09/2026 — llamadas reales, autoactualización, tus, búsqueda, F11

Un empujón grande; el detalle está en los commits, acá lo que hay que recordar.

**Llamadas reales (F10 media).** Se cableó `react-native-webrtc` al
`RTCPeerConnection` (SDP + ICE por la señalización de socket que ya existía).
El TURN **no es coturn en la mini**: la mini expone solo el 443 por el túnel, y
un TURN necesita UDP + relay públicos. Se usa **Cloudflare Realtime TURN**
(managed, 1 TB/mes gratis) — el server pide credenciales cortas con
`CF_TURN_KEY_ID`/`CF_TURN_API_TOKEN` (solo en el server) y las sirve por
`GET /api/calls/ice` (¡plural!), que la app trae antes de cada llamada. Falla
cerrado a STUN (llamada misma-red igual anda). Video ya estaba (mismo motor).

**Autoactualización (P3).** Lilachat se actualiza DESDE la app: baja el APK con
progreso, **verifica el sha256** y lo pasa al instalador (`REQUEST_INSTALL_PACKAGES`).
Reusa `apkInstall`/`installDecision` de lilastore-app. `min-version` ahora expone
`sha256`/`size`/`releaseId` (solo apps públicas). **Riesgo aceptado por José**: el
permiso de instalar en un chat es lo que Play Protect mira con lupa; se acepta
porque ya se reparte fuera de Play.

**Subida por tus (LilaStore + lila-cli 0.9.0).** El APK con WebRTC pesaba 50 MB y
no entraba en los ~100 s de Cloudflare (524). Se subió por **tus** (trozos,
`@tus/server` + `tus-js-client`): endpoint `pages/api/v1/releases/upload-tus`,
validación compartida en `publicarRelease`. Pines del CLI a `@0.9.0` en
lilastore-app y timon.

**Adelgazamiento: 50 → 24 MB.** `useLegacyPackaging` (comprime los `.so`) + R8
(`enableProguardInReleaseBuilds` + `shrinkResources`) vía `expo-build-properties`.
Verificado que R8 no borró los módulos nativos (webrtc/filesystem/intentlauncher
presentes en el dex).

**Búsqueda de mensajes.** `GET /api/chats/search` — subcadena (regex escapado)
scopeada por membresía, saltea lo cifrado. Motor puro en shared; sección
«Mensajes» en la lista con resaltado.

**F11 Automatizaciones.** #1 **Mensajes programados** (modelo + tick en el cron de
un minuto con candado atómico + endpoints; UI con long-press en enviar +
datetimepicker). #2 **Recordatorios recurrentes** ya existía (F5). #3
**Auto-respuesta de ausente** (a offline de un 1:1; anti-loop: un auto-reply no
dispara otro; rate-limit 2 h; `User.autoReply` + `/api/me/auto-reply`). #4 reglas
«si X → Y» **diferida** — José la definirá cuando tenga una concreta.

**Pendiente de verificación (solo con teléfonos reales):** llamada voz/video
cross-red (que el TURN de Cloudflare rebote — requiere `CF_TURN_*` en el `.env`
de la mini, ya puesto por José), auto-update in-app, y el auto-reply.

## 44. F12 — el historial vive en el teléfono (15/09/2026)

**La decisión.** José pidió «que los mensajes se guarden en los teléfonos como
WhatsApp». Al preguntarle qué buscaba, la respuesta fue **privacidad** (que el
server no pueda leernos), no el modelo store-and-forward. El camino es entonces
**cifrar por defecto** (extender F9 a todos los chats), **no** tirar el modelo
Telegram del §0: el server sigue siendo la verdad sobre QUÉ mensajes existen
(`seq`, lápidas, cursores) y deja de poder leer su contenido. Con eso, el
`mongodump` de F7 deja de ser un respaldo legible → la copia entera tiene que
vivir en el teléfono y respaldarse **desde** el teléfono. Fases:

| Fase | Qué | Gate |
| --- | --- | --- |
| **F12.0** | Store durable en el teléfono (SQLite) + hidratador | — (**hecha**, abajo) |
| F12.1 | Respaldo cifrado desde el teléfono al disco de la mini (patrón Lilafotos, paquete `constroad-respaldo`) | — |
| F12.2 | Restaurar en teléfono nuevo (asistente post-OTP + passphrase) | — |
| F12.3 | Cifrado por defecto: chats nuevos `encrypted:true`, **media cifrada en el cliente**, búsqueda local, preview de push en el teléfono | **Lila con carve-out** (decidido: el chat con Lila queda en claro) |
| F12.4 | Multi-dispositivo/web: sobre por dispositivo + ratchet persistido + cripto en el navegador | **web sí importa** (decidido) |

**El orden importa**: respaldo ANTES de cifrar por defecto. Si primero se cifra,
el `mongodump` deja de servir y la única copia queda en un teléfono sin
respaldo — «sincronizar no es respaldar» (Lilafotos §3.1).

**Lo que se hereda de Lilafotos** (coordinado con esa sesión el 15/09): la
subida (`subida.ts`, corredor puro con puerto inyectado), las reglas de cuándo
(`planDeSubida.ts`: wifi obligatorio, cargando/medido solo forzado, batería
<15 % bloquea), la huella por stream (`huella.ts`), el dedup (`recepcion.ts`),
y **del server `disco.ts` + `plazo.ts`, que NO son opcionales**: el 15/09 el USB
de la mini se colgó a nivel kernel —`access`/`statfs` contestaban desde la caché,
`read`/`write` nunca— y cada fs op colgada ocupaba un hilo del pool de Node (4):
al cuarto pedido murió el health y Torre reiniciaba en bucle. Cualquier server
que escriba en ese disco lleva sondas con plazo y «montado» = escritura real.
Se copia el PATRÓN y se comparte el DISCO, no el servicio: identidad distinta
(fotos = correo, lilachat = teléfono) y ciclos de vida desacoplados (Lilafotos
§4). `lilachat-server` escribe en `CONSTROAD-BACKUP/lilachat-datos/<teléfono>/`
con marca `.lilachat` propia y un segundo repo restic con clave propia. Lo que
Lilafotos NO tiene y acá es obligatorio: el asistente de **restaurar** (para
fotos el server es la verdad y un teléfono nuevo baja el catálogo); solo se
hereda la descarga verificada por huella.

### 44.1 As-is F12.0 — el almacén (`app/src/chat/mensajesGuardados.ts`)

- **SQLite (`expo-sqlite ~57.0.3`), una fila por mensaje, cifrada en reposo.**
  Tabla `mensajes(chatId, seq, sobre)` con clave primaria `(chatId, seq)`. **Solo
  `chatId` y `seq` en claro** —lo mínimo para ordenar, paginar y encontrar
  huecos—; el mensaje entero va dentro del sobre (`cerrarCache`/`abrirCache` de
  F9, AES-GCM). La clave sigue en `expo-secure-store`
  (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`) y se borra al cerrar sesión junto con las
  filas. Nada lanza: sin llavero no se guarda, una fila que no abre se saltea (el
  hidratador la vuelve a pedir).
- **Reemplaza la caché** de un blob por chat en AsyncStorage con los últimos 60
  (`recortarParaCache` y `MAX_MENSAJES_EN_CACHE` se fueron: sin consumidores). La
  **migración** es idempotente por construcción: cada `lilachat.msgs.<chatId>` se
  vuelca y se borra; una cortada a la mitad sigue donde quedó. Corre una vez por
  proceso, antes de la primera lectura.
- **Se escribe lo que LLEGA, no la lista entera**: delta del `sync.pull`, cada
  `msg.new` (el chat abierto lo guarda `useChat`; los cerrados, un listener
  siempre montado en `App.tsx`), cada página del server, y la lápida de
  `msg.deleted` (`marcarBorradoGuardado`, también si el chat no estaba abierto).
  Reescribir miles de filas por mensaje era lo que un almacén completo no podía
  permitirse. Un lote va en una transacción.
- **Una sola regla de conciliación** (`conciliarPaginaGuardada`): la MISMA
  `conciliarPagina` de la pantalla aplicada a los `seq` del disco, y
  `seqsQueSobran` (shared, con test) dice qué borrar. Si pantalla y disco
  conciliaran distinto, la línea que José pidió limpiar volvería al reabrir.
- **El cursor del `sync.pull` nace del almacén** (`ultimoSeqGuardado`), no de
  `{}`. Hallazgo de esta fase: con `{}` el server contestaba los **200 más viejos**
  del chat en cada apertura (`pullSince` ordena ascendente desde 0) — inútiles
  en una conversación larga; el delta real lo cubría la página de saneo.
- **El scroll hacia arriba lee del disco primero**, y del server si hace falta.
  Lo local solo sirve si es **contiguo hasta lo visible y entero**
  (`tramoContiguoAntesDe`, shared, con test): un teléfono que volvió tras días
  recibe 200 del delta y queda con un hueco en el medio; servir lo local
  saltando el hueco haría desaparecer conversación sin que nadie lo note.
- **Hidratador (F12.0b, `hidratador.ts`)**: al ganar la sesión (4 s después,
  para que la lista cargue) completa cada chat hasta su primer mensaje con los
  `lastSeq` de la lista guardada, **del hueco más nuevo al más viejo**, de a un
  chat, páginas de 100 (tope del server), 40 páginas por corrida; lo que falte
  sigue en la próxima. Se miran los NÚMEROS (`huecosDelHistorial`, con test) y no
  una bandera «completo»: un hueco puede formarse después. **El server también
  tiene huecos** (las líneas de prueba se borraron de la base): una página que
  no trae nada del hueco pedido lo da por cerrado (`cubreHueco`, con test) —
  sin eso, bucle. Para de escribir si la sesión se cierra (`sigue()`): una
  corrida que siguiera dejaría filas de quien ya se fue. **Tiene que correr
  mientras el server guarda en claro**: con F12.3, lo que no esté en el
  teléfono no se recupera.
- Tests: `shared/almacenDeMensajes.test.ts` (19: sobrantes, tramo contiguo,
  huecos, cubre hueco) y `app/migracionDeCache.test.ts` (4). shared 383 ✅,
  app 125 ✅, `tsc` limpio en los dos, lint limpio en lo tocado (shared no tiene
  config de ESLint 9: preexistente).
- **Sin cambios en server ni web.** La web sigue con su caché de lista
  (`MAX_CHATS_EN_CACHE`, intacto).

**Lo que F12.0 NO resuelve (a propósito):** en un chat secreto se guarda el
SOBRE tal como llega; el ratchet no se persiste (hueco de F9), así que tras
reiniciar esos mensajes siguen sin abrir. Persistir el texto abierto es de
F12.3, junto con el sobre por dispositivo de F12.4. Y la media no está en el
almacén: vive en el storage de lila (`/files/companies/…`, con `restic-media`);
el respaldo de F12.1 lleva referencias, no bytes.

### 44.2 As-is F12.1 — el respaldo cifrado desde el teléfono (15/09/2026)

**Lo copiado de Lilafotos vive DENTRO de lilachat** (decisión final de José,
15/09/2026, después de haber pedido un paquete `constroad-respaldo` que se
armó y se descartó el mismo día: sin repo en GitHub, sin tag, sin dependencia
git en tres `package.json` — más simple). `shared/src/subida/`: los motores
puros (`subida`, `planDeSubida`, `huella`, `recepcion`, `conciliarRollo`, tipos
y constantes) genéricos en `E extends ElementoDelRollo` —sin `tipo: foto|video`—,
con sus 67 tests. `server/src/disco.ts` + `plazo.ts` con **la marca como
parámetro** (`.lilachat`) y 19 tests que nacieron acá contra un disco temporal
real (en Lilafotos los cubría el supertest de las rutas). Lilafotos conserva
sus copias; si un día se comparte, es un paquete con tag de git, nunca
`npm link` (Torre compila con `npm ci` en la mini).

**Motor (`shared/respaldoCifrado.ts`, 14 tests).** `armarRespaldo(passphrase,
contenido)` → `{ v, kdf: { n, r, p, sal }, sobre }`; `abrirRespaldo` devuelve
`null` ante otra passphrase, archivo tocado, versión desconocida, `kdf` fuera de
rango (un `n` gigante colgaría el teléfono) o un JSON que no es un respaldo.
**scrypt** N=2^14/r=8/p=1 (16 MB, ~1 s en un teléfono; `KDF_DE_PRUEBA` en los
tests) y **el mismo AES-GCM de F9**. La passphrase se recorta en los bordes.
Medido en Node: 20 chats × 1 000 mensajes → 4,6 MB, armar 227 ms, abrir 167 ms
(Hermes será más lento; **sin medir en el teléfono todavía**). El respaldo
lleva texto y metadatos; **la media no va**: vive en el storage de lila con
`restic-media`, el archivo lleva las referencias.

**Server (`respaldoRoutes.ts`, 16 tests contra disco temporal + Mongo en
memoria).** `PUT /api/respaldos` cuerpo crudo por streaming + `x-huella` +
`x-nombre` → 201 `guardado` · 200 `ya_existe` · 422 `huella_no_coincide` · 400
`nombre_invalido|huella_invalida|vacio` · **507 `disco_ausente|disco_colgado`
antes de leer un byte**; `POST /huellas`; `GET /ultimo`; `GET /estado` (disco
con plazo, `.copia-a-la-mini.json`, cantidad, último); `GET /:nombre` (404
idéntico para «no existe» y «no es tuyo»). La carpeta es **el teléfono de la
sesión**, nunca lo que diga el cliente: `<RESPALDOS_RAIZ>/<teléfono>/respaldos/`
(`RESPALDOS_RAIZ` en el `.env`; por defecto
`/Volumes/CONSTROAD-BACKUP/lilachat-datos`; marca `.lilachat` que crea solo
`npm run disco:init -w server`). Índice `Respaldo {userId, nombre, huella,
bytes, creadoEn}` con `{userId, huella}` único: la carrera de dos subidas
iguales termina en `ya_existe` y se borra la copia sobrante. **Se conservan los
dos últimos** por persona (el anterior por si el último salió corrupto); el
historial lo guarda restic. `/api/health` sigue en 200 sin disco: el chat no
depende del respaldo.

**Copia del disco a la mini**: `scripts/copia-a-la-mini.sh`, `copia-common.sh`,
`verificar-copia.sh`, `instalar-agentes.sh` — los de Lilafotos con nombres,
repo (`~/backups/restic-lilachat`), clave (`restic-lilachat.pass`) y horario
propios (**02:00**; lila-app 00:30, fotos 01:30, mismo disco; verificación
domingos 04:00). Runbook: `docs/RESPALDOS-RUNBOOK.md`. **Alta pendiente de José
en la mini** (env, clave, `disco:init`, agentes).

**Teléfono (`app/src/respaldo/`).** `planDeRespaldo.ts` (puro, 19 tests):
nombre `respaldo-<fecha UTC sin dos puntos>.lcb`, `huellaDelAlmacen` (por chat:
último seq **y cantidad** — el hidratador rellena huecos sin mover el último),
`decidirCorrida` (sin_passphrase | armar | solo_subir | al_dia) y
`fraseDeEstado` (alerta = sin passphrase, fallo, o >48 h con algo pendiente).
`correrRespaldo.ts`: **hidratar primero** → ¿cambió el almacén? → armar el
archivo (uno solo en el teléfono, `conservarSolo`) → `correrSubida` del paquete
con `puertoDeRespaldo` (`uploadAsync` legacy, streaming nativo; huella por
`readableStream`, nunca `arrayBuffer()`) → estado persistido
(`estadoDeRespaldo.ts`, con `huellaPendiente` para no rearmar lo que ya está
armado). Condiciones de `@constroad/respaldo`: wifi obligatorio, cargando y
medido solo con «Respaldar ahora», batería <15 % bloquea. Tarea de fondo
(`tareaDeFondo.ts`): `expo-background-task` + `expo-task-manager`, ≥60 min, 8 min
de presupuesto, se registra con la sesión **solo si hay passphrase**. La
passphrase en `expo-secure-store` (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`); al cerrar
sesión se borran passphrase, libro, estado y tarea. UI: tarjeta «Respaldo en la
mini» en Ajustes (`RespaldoAjuste.tsx`): crear passphrase con la advertencia
**«si la olvidás, el respaldo no se recupera»** sin letra chica, «Respaldar
ahora», «Cambiar passphrase», y «Copia del disco a la mini: hace X ✓» leída del
server. Módulos nativos nuevos: `expo-sqlite` (F12.0), `expo-background-task`,
`expo-task-manager`, `expo-battery`, `expo-network` → APK nuevo.

**Sin verificar todavía (emulador sin sesión; el OTP del 902049935 es de José):**
la migración de la caché vieja, el scroll offline desde SQLite, el hidratador
contra producción, crear la passphrase y «Respaldar ahora» de punta a punta
(teléfono → `PUT` → disco de la mini; **la mini todavía no tiene
`RESPALDOS_RAIZ` ni la marca**: hasta el alta contesta 507 `disco_ausente`, que
la app muestra como «El disco de la mini no está»), el tiempo real de scrypt +
AES-GCM en Hermes, y la tarea de fondo despertando. F12.2 (restaurar) no está.

### 44.3 As-is F12.2 — restaurar en un teléfono nuevo (15/09/2026)

Lo que Lilafotos no tiene, porque para fotos el server es la verdad. Acá la
verdad es el teléfono, y un teléfono nuevo la pierde si nadie la trae.

- **Motor puro** (`app/src/respaldo/planDeRestauracion.ts`, 8 tests):
  `decidirOferta` (se ofrece sola **una vez** y **solo con el almacén vacío**:
  un teléfono con historial no pisa lo que tiene por un respaldo viejo),
  `descripcionDeRespaldo` («del 15/09/2026 · 1,2 MB», fecha en la zona de la
  persona) y `verificarDescarga` (la huella bajada tiene que ser la anunciada:
  un archivo truncado no se intenta abrir).
- **`restaurar.ts`**: `respaldoAOfrecer(jwt)` pregunta a la mini **solo si vale
  la pena** (almacén vacío y no ofrecido: dos lecturas locales antes de un
  pedido de red). `restaurarDesdeLaMini`: `downloadAsync` (legacy, con el JWT) a
  la caché → huella por stream → `abrirRespaldo` con la passphrase → un
  `guardarMensajes` por chat → guarda la passphrase (el próximo respaldo sale
  con la misma) y deja `huellaRespaldada` = lo restaurado, así no se vuelve a
  subir lo mismo. Fallos con motivo: `descarga` · `huella` · `passphrase` ·
  `importacion`. El temporal se borra siempre.
- **Hoja `RestaurarRespaldo.tsx`**: «Hay un respaldo de este número del … ·
  1,2 MB», passphrase, el paso en que va (bajando / comprobando / abriendo /
  guardando), el fallo en palabras, y «Listo: N chats y M mensajes». «Ahora no»
  marca la oferta como hecha. Sale sola al ganar la sesión desde `App.tsx`
  (fase `home`) y a mano desde Ajustes → Respaldo → «Restaurar desde la mini»
  (solo si la mini tiene uno).
- Después de restaurar, el hidratador (F12.0b) rellena lo que falte desde el
  server mientras los chats sigan en claro; con F12.3 lo que no esté en el
  respaldo no vuelve.
- **Lo que F12.2 NO resuelve**: las claves E2E del teléfono nuevo (los sobres
  sellados a la clave vieja no se abren) — es F12.4, junto con el sobre por
  dispositivo.

**Sin verificar todavía** (sin sesión en el emulador): la oferta al arrancar,
la descarga real y la restauración de punta a punta.

### 44.4 Revisión y E2E de F12.0–F12.2 (16/10/2026)

El trabajo de §44.1–44.3 quedó un mes sin commitear. El 16/10 se revisó, se
corrigió y se probó de punta a punta antes de entrar a `main`.

**E2E en el emulador** (`lilafotos-qa`, debug contra un server local con este
código en :3104, SIN crons —la base es la de producción— y `RESPALDOS_RAIZ` en
una carpeta temporal). Sesión con el 902049935 por yopmail.
- Hidratación en instalación nueva: 2 chats, 23 filas (seq 1–28, los 5 que
  faltan tampoco están en el server) y 13 filas. Mismo conteo que la base.
- Crear passphrase → respaldo automático: el `.lcb` cae en
  `<raíz>/902049935/respaldos/`, cifrado (sin texto en claro), indexado en
  `Respaldo`. La tarjeta dice «Respaldado hace un momento · 21,8 KB».
- Cerrar sesión deja el almacén en 0 filas. Al volver a entrar se ofrece
  restaurar sola; una passphrase equivocada da el fallo en palabras y la buena
  trae «2 chats y 36 mensajes». Filas idénticas a las del server.
- Sin red (`svc wifi/data disable`), el chat abre desde SQLite.
- QA en cero: el device del emulador y el `Respaldo` borrados (devices de José
  20 → 20), su correo de respaldo restaurado, la app desinstalada del AVD.

**Arreglos de esta revisión** (tests primero):
- **Escrituras SQLite en una cola** (`shared/colaSerial.ts`, 4 tests): dos
  transacciones a la vez (hidratador + `msg.new`) hacían que el `ROLLBACK` del
  segundo `BEGIN` deshiciera al primero. Con **generación de sesión**: lo
  encolado antes de cerrar sesión no se escribe después con la clave nueva.
- **`connectSocket` reusa el socket que está conectando** (`reusarSocket`, 4
  tests). Antes, el efecto de `App` reemplazaba el socket recién creado por
  TabsShell y sus listeners quedaban en uno muerto.
- **Hidratador: un hueco irrellenable ya no frena el chat** (`siguienteHueco`,
  4 tests). Antes se daba por completo y los huecos más viejos nunca se pedían.
- **Hidratador con la lista vacía**: si a los 4 s no hay lista guardada
  (instalación nueva, teléfono lento) se pide al server. Visto en el E2E: con
  la Mac saturada la lista cargó tarde y el hidratador no hizo nada en toda la
  sesión.
- **Cambiar passphrase rearma el respaldo** (huellas en null): antes la corrida
  veía «al día» y en la mini quedaba el que abre solo la passphrase vieja.
- **PUT de respaldo con tope** (200 MB, `RESPALDO_MAX_BYTES`): 413
  `demasiado_grande` por `content-length` o al pasarlo en el stream, sin dejar
  temporal (`DemasiadoGrande` en `disco.ts`, 3 tests).
- **Ajustes evita el teclado** (`KeyboardAvoidingView`): con edge-to-edge la
  passphrase quedaba tapada sin forma de subirla. Visto en el E2E.
- Scripts: la verificación de los domingos buscaba fotos y no `.lcb` (fallaba
  siempre); el `.env` cae a `deploys/chat/shared/.env` (el de Torre) si no hay
  uno en el repo; el runbook tenía `deploys/lilachat` en vez de `deploys/chat`.

**R8 borraba el cargador de la tarea de fondo** (smoke del release 0.1.69,
16/10): `ClassNotFoundException: expo.modules.adapters.react.apploader.RNHeadlessAppLoader`
al arrancar, sin síntoma en pantalla — el mismo de LilaStore 0.5.15. Sin esa
clase el respaldo de fondo nunca corre. Arreglo: `extraProguardRules` con
`-keep class expo.modules.adapters.react.apploader.** { *; }` en
`expo-build-properties`. La 0.1.68 publicada lo tiene roto.

**Pendiente de la revisión** (no bloquea; en orden). Los cinco primeros se
hicieron en FL5 (§45.12); queda «filas que no descifran»:
- Cifrado y scrypt sincrónicos en el hilo JS al respaldar y restaurar: con
  ~20 000 mensajes puede congelar la pantalla. Lotes con `await` y
  `scryptAsync`.
- La tarea de fondo hidrata y arma ANTES de mirar wifi y carga.
- Restaurar usa `INSERT OR REPLACE` (puede revivir un borrado) y no cuenta
  filas escritas de verdad.
- El cursor del `sync.pull` sale de `MAX(seq)`: un hueco intermedio no se ve
  hasta el próximo arranque (correr `hidratarChat` al abrir el chat).
- `GET /api/respaldos/:nombre` sin `pipeline` ni plazo; sin índice único
  `{userId, nombre}`; filas que no descifran no se vuelven a pedir.
- Ajenos a F12, vistos en el E2E: `expo-notifications` avisa «Custom sound
  'default' not found» en cada arranque; Ajustes muestra DOS entradas de
  respaldo («Copia de seguridad» y «Respaldo en la mini»); el permiso de
  contactos se vuelve a pedir en cada arranque tras negarlo una vez.
- **Alta en la mini sigue pendiente de José** (`docs/RESPALDOS-RUNBOOK.md`):
  hasta entonces producción contesta 507 `disco_ausente` y la app lo dice.


## 45. Tablero de fases — la fuente para medir el avance (16/10/2026)

La tabla de §13 quedó congelada el 24/08: fases hechas seguían en ⏳, P1/P2
figuraban bloqueadas estando en producción, y «F12» nombraba dos cosas. Este
tablero la reemplaza. **Regla: cada fase que cierra actualiza su fila acá en el
mismo commit** (fecha, commit, versión del APK). ✅ hecho y verificado ·
🟡 hecho con verificación pendiente · ⏳ en curso · ⬜ sin empezar.

### 45.1 Producto (F0–F14, P1–P5)

| Fase | Qué | Estado | Falta |
| --- | --- | --- | --- |
| F0 | Monorepo, tokens, server base | ✅ 20/08 | — |
| F1 | Alta por OTP (constroad-auth), gate de invitación | ✅ | endpoint de QA en constroad-auth (backlog) |
| F2 | Chats, `seq`, sync por cursor, outbox offline | ✅ | — |
| F3 | Media (fotos, video, archivos) vía lila | ✅ | — |
| F4 | Presencia, acuses en vivo, push | ✅ | — |
| F5 | Eventos, recordatorios, encuestas | ✅ | — |
| F6 | Web | ✅ 24/08 | permiso de push del navegador |
| F7 | Respaldo del server (mongodump) | ✅ 24/08 | — |
| F8 | Asistente Lila | 🟡 | probar con `ANTHROPIC_API_KEY` real; notas de voz |
| F9 | Chats secretos (E2EE opt-in) | 🟡 | ratchet persistido; sobre por dispositivo (→ F12.4) |
| F10 | Llamadas voz/video (WebRTC + TURN Cloudflare) | 🟡 14/09 | llamada entre dos teléfonos en redes distintas |
| F11 | Automatizaciones: programados, auto-respuesta | 🟡 14/09 | auto-respuesta en teléfono real; reglas «si X → Y» diferidas |
| F12.0–2 | Historial en el teléfono, respaldo cifrado, restaurar | 🟡 16/10 `943d293` | alta del disco en la mini (runbook); pendientes §44.4 |
| F12.3 | Cifrado por defecto + media cifrada | ⬜ | **bloqueada por D1** |
| F12.4 | Multi-dispositivo/web con sobre por dispositivo | ⬜ | después de F12.3 |
| F13 | Mongo de emergencia en la mini | ⬜ | **revisar**: con la base ya EN la mini (bóveda, 17/10) el plan original pierde sentido; redefinir como respaldo verificado de bóveda |
| F14 | Legado Digital (antes «F12» en §13) | ⬜ | — |
| P1 | Deploy en Torre (`lilachat.constroad.com`) | ✅ 25/08 | — (push a main despliega el server solo, ~90 s) |
| P2 | APK en LilaStore | ✅ | — |
| P3 | Autoactualización desde la app | 🟡 14/09 | probar en teléfono real |
| P4 | Aviso de versión en LilaStore web | 🟡 | sin confirmar en la revisión del 16/10 |
| P5 | Avisos con la app cerrada | ✅ | FCM + servicio en primer plano opcional (no sin Firebase como decía §13) |

### 45.2 Decisiones abiertas

| # | Decisión | Opciones | Bloquea |
| --- | --- | --- | --- |
| D1 | Modelo de mensajes | ✅ **(a) el server guarda los mensajes** y el cifrado de punta a punta es opcional por chat (chat secreto). José, 17/10/2026, al aprobar el plan empresarial (§47): buscar, retener y exportar piden mensajes legibles en el server. Descartadas: (b) store-and-forward como WhatsApp y (c) borrar al confirmar entrega | F12.3, F12.4, §47 |
| D2 | Base de Lilachat | ✅ **bóveda** desde el 17/10/2026 (§45.11) | — |
| D3 | Marca | ✅ dos burbujas redondas desde una sola geometría (`shared/src/marca.ts`, §45.13) | — |

### 45.3 Plan Fluidez — «que se sienta como WhatsApp» (pedido de José, 16/10/2026)

Origen: auditoría del 16/10 (app, server y diseño). La lentitud no es de React
Native: es trabajo de más en cada paso, red en el camino crítico y cero física
al tocar. Se **rehace el cascarón** (navegación, lista, chat, composer) sobre
los motores de `shared`, que tienen tests; no se reescribe la app.

| Fase | Qué | Criterio de aceptación (medido) | Estado |
| --- | --- | --- | --- |
| FL0 | **Medir + bugs que se sienten lentos** — ver §45.4 | línea base anotada en §45.4 | ✅ 16/10 (0.1.70) |
| FL1 | **Navegación nativa** — ver §45.5 | volver de un chat no remonta la lista | ✅ 16/10 (0.1.71) |
| FL2 | **Pantalla de chat nueva** — FL2a (§45.6) y FL2b (§45.8) | 0 frames perdidos al tipear y al abrir; teclado sincronizado | ✅ 16/10 (0.1.73) |
| FL3 | **Burbujas y lista estilo WhatsApp** — conversación (§45.9) y lista (§45.10), claro y oscuro | auditoría lado a lado contra el diseño de Stitch | ✅ 16/10 (0.1.75) |
| FL4 | **Latencia del server** — hecho: envío de 5 a 3 viajes, lista sin N+1, ping 15/10 s (§45.7). Hecho también: bóveda (D2, §45.11), fotos con dimensiones (FL9e) y la lista pedida 1 vez al arrancar en vez de 6 (§45.25). Falta: caché de membresía para acuses/typing, blurhash | ack < 300 ms medido | 🟡 18/10 |
| FL5 | **Pendientes de F12 que pesan en el hilo JS**: cifrado/scrypt por lotes, tarea de fondo que mira wifi/carga primero (§44.4) — ver §45.12 | respaldar 20 000 mensajes sin ANR en `gama-baja` | 🟡 17/10: hecho y medido en V8 (tramo típico 0,7 ms); falta medir en un gama baja real |
| FL6 | **Marca y Stitch**: logo vectorial único (ícono, adaptativo, mono, splash y `<Logo>` desde la misma geometría) — ver §45.13; diseñar en Stitch la conversación llena, con la paleta real y las pestañas reales | ícono verificado dentro del APK | ✅ 17/10: logo (0.1.76) y pantallas de Stitch |
| FL7 | **Agenda editable y visor a lo WhatsApp** + lo roto de la auditoría que no podía esperar — ver §45.14 | editar/borrar avisos y eventos, día y hora exactos, deslizar entre fotos; E2E en el emulador | ✅ 17/10 (0.1.77) |
| FL8 | **Lo que se pierde o se rompe** (auditoría §46.1) — ver §45.15 | ningún mensaje desaparece sin aviso; la notificación abre su chat; la llamada suena fuera del chat | ✅ 17/10 (0.1.78) |
| FL8.1 | **Llamada entrante como WhatsApp** (pedido de José tras probar con Wilson, 17/10): pantalla completa sobre el bloqueo con tono que se repite, deslizar para contestar, rechazar sin abrir la app, tono con la app abierta, «Llamada perdida» en el chat — ver §45.16 | con la app cerrada y el teléfono bloqueado la llamada ocupa la pantalla y suena hasta contestar, rechazar o 30 s; E2E en el emulador | 🟡 17/10 (0.1.79 publicada): verificada en el emulador, más el bug de presencia que frenaba todos los push; falta probar sobre un bloqueo real |
| FL8.2 | **Doble check sin abrir la app** (José, 17/10, chat con Wilson: un solo check aunque Wilson tenía internet). Hoy «entregado» lo marca la app al conectarse; el push llega al teléfono pero es una notificación común, Android la muestra sin ejecutar código de la app y el server nunca se entera. Camino: push de mensaje solo-datos que recibe el servicio nativo de FL8.1, que dibuja la notificación y le confirma la entrega al server con un token corto del propio push (sin JWT) | con la app cerrada, el mensaje pasa a dos checks grises al llegar el push al otro teléfono — ver §45.17 | ✅ 17/10: hecho y verificado en el emulador; sale en 0.1.80 |
| FL9 | **Lo que WhatsApp hace a diario** (§46.2) | pulsación larga completa, links tocables, varias fotos con pie, buscar en el chat, notas de voz con velocidad | ✅ — FL9a hecha (§45.18): pulsación larga completa, links, cita que salta, divisor de no leídos, atrás; editar mensajes (§45.19); FL9b: varias fotos con pie y notas de voz con velocidad (§45.20); FL9c: borradores, archivar, marcar no leído, perfil con nombre y foto, buscar en el chat (§45.21); FL9d: programados visibles y cancelables, búsqueda que salta al mensaje, «ya no eres participante», eliminar chat (§45.22); FL9e: varios mensajes a la vez, nota de voz sostenida con cancelar y bloquear, fotos con su forma (§45.23); FL9f: «Info» del mensaje, onda de la nota de voz, arranque de ~90 ms (§45.24). ✅ 18/10 (0.1.87). Abierto menor: arrastrar en la onda, hora en la «Info» |
| FL10 | **Pulido y coherencia** (§46.3): un solo registro (tuteo), 44 dp, encuestas completas, detalle de evento | auditoría de pantalla entera sin hallazgos ALTA | 🟡 18/10: tuteo, 44 dp, «últ. vez», punto verde solo en 1:1, un solo respaldo en Ajustes, «Ponme al día» sin llamadas (§45.25, 0.1.88); encuestas completas, detalle de evento con hora de fin e invitados de afuera, ErrorBoundary por pantalla (§45.26, 0.1.89); gira y tiene tablet con dos paneles (§45.27). ✅ 18/10 |
| FL11 | **Lo que José vio con Wilson** (18/10, teléfonos reales con 0.1.86) — ver §46.4 | contestar desde la notificación conecta la llamada; avisos agrupados por chat, sin duplicados, con nombre de la agenda y «Responder»; foto con pie sin hueco; «Ponme al día» con sentido | ✅ 18/10: «Ponme al día» (§45.25); la llamada conecta desde el aviso y sigue al cambiar de app, probado con José (§45.28, 0.1.91); avisos uno por chat y sin duplicar, nombre de la agenda, «Responder» y «Marcar como leído», foto con pie (§45.29, 0.1.92) |

### 45.4 As-is FL0 (16/10/2026)

**Qué se hizo** (test primero en todo):
- **`sync.pull` solo de los chats pedidos** (`pullSince`, 2 tests): con cursores
  se miran solo esos chats (cruzados con la membresía) y uno al día no hace
  consulta. Sin cursores sigue trayendo todos (contrato viejo).
- **La lista se parchea con `msg.new`** (`chat/listaEnVivo.ts`, 6 tests): la
  fila cambia sin ir al server; solo un chat desconocido recarga. E2E: un
  mensaje en vivo movió la fila arriba con **0 GET** a `/api/chats`.
- **`socket.off` siempre con handler** (lista y TabsShell). E2E: después de
  cambiar de pestaña, un mensaje de un chat cerrado se siguió guardando en
  SQLite y la lista se siguió actualizando.
- **`publicarMensaje`** (socket.ts): un solo camino para repartir + push. La
  media ahora manda push; auto-respuestas y programados se emiten en vivo
  (test con socket real).
- **Arranque local-first** (`auth/arranque.ts`, 5 tests): con credencial
  completa se entra con lo guardado y el refresh concilia por detrás; un 401
  real sigue mandando al alta (E2E con el device borrado en el server). El
  socket reusado toma el JWT nuevo para su próxima reconexión. E2E con el
  server congelado (`SIGSTOP`): la lista aparece y un chat abre con sus
  mensajes desde el disco.
- **Diagnóstico a LilaStore** (`diagnostico/`, motor con 13 tests): errores
  (captura global + `reportarError`), trabas del hilo JS por minuto, y tres
  medidas — `arranque-a-lista`, `abrir-chat`, `ack-envio`. Envío automático al
  ir a segundo plano y al arrancar; Ajustes → Diagnóstico con «Enviar
  problema» (E2E: «Enviado», LilaStore aceptó). El mensaje se tacha de JWT y
  teléfonos antes de guardarse.

**Línea base** (debug en el emulador `lilafotos-qa`, server local contra
**Atlas**, 16/10/2026 — el release y un teléfono real darán otras cifras; la
comparación que vale es la de `/console/reportes` con la 0.1.70):

| Medida | Valor |
| --- | --- |
| `ack-envio` | 624 ms y 941 ms — los 5 viajes seguidos a Atlas (FL4, meta < 300 ms) |
| `abrir-chat` (desde el disco) | 308–824 ms |
| `arranque-a-lista` (credencial guardada) | ~2,5 s (incluye cargar el bundle de Metro) |
| `hilo-js` (peor traba por minuto) | 285–904 ms |

Ojo al leerlas: `arranque-a-lista` también se anota tras un alta (incluye el
tiempo de pedir el código) y `abrir-chat` de un chat vacío espera al primer
mensaje: esas entradas no son de rendimiento.

### 45.5 As-is FL1 (16/10/2026)

- **Stack nativo** (`@react-navigation/native-stack` + `react-native-screens`):
  `ui/NavegacionDeSesion.tsx` con «Inicio» (las pestañas) y «Chat». `App.tsx`
  dejó de tener la fase `chat`: el chat abierto sale del estado del navegador
  (`ui/rutas.ts` → `chatAbiertoDe`, 4 tests) y alimenta el sonido y el guardado
  que antes miraban la fase. Transición `slide_from_right` con el fondo del
  tema (sin flash blanco en oscuro).
- **La lista queda viva debajo.** E2E: buscar «QA», abrir el chat, volver → la
  búsqueda sigue escrita, el filtro aplicado y **0 GET** a `/api/chats`. Atrás
  del sistema vuelve igual.
- **Con la lista montada cambian dos cosas** (`listaEnVivo.ts`, 4 tests más):
  el chat abierto no suma no leídos y abrirlo lo deja en 0 (`marcarLeido`); y
  TabsShell no avisa con un chat abierto —avisa `App`— para no sonar dos
  veces.
- **Un toque abre el chat con el teclado abierto** (`keyboardShouldPersistTaps`
  en la lista). Visto en el E2E: el primer toque solo cerraba el teclado.
- Pendiente para FL2/FL3: las pestañas todavía se remontan al cambiar (el
  `key` de TabsShell), las hojas siguen siendo `Modal`, y el atrás predictivo
  de Android 14 (`predictiveBackGestureEnabled`) sigue apagado. TabsShell pasó
  de 632 a ~650 líneas: se parte al mover las hojas a pantallas.
- Límite del E2E: los mensajes de QA salen de otro dispositivo de José (no
  suman no leídos por ser propios); el caso «mensaje de otra persona con el
  chat abierto» está cubierto por los tests de `listaEnVivo`.

### 45.6 As-is FL2a (16/10/2026)

- **El Composer es un componente aparte** (`chat/Composer.tsx`, memo): el
  borrador y el contador de la nota de voz son su estado. Antes vivían en
  `ChatScreen` y cada tecla re-renderizaba la pantalla con todas sus burbujas.
  Programar (long-press) le pide el texto al Composer y lo limpia por
  `ref` al confirmar. `ChatScreen` bajó de 939 a ~870 líneas.
- **Filas estables**: `rows` memoizadas (la burbuja de subida guarda su
  `queuedAt` al empezar; antes era `new Date()` en cada render), `renderItem`
  con `useCallback`, `MessageRow` con `memo`, callbacks estables
  (`onVerImagen` recibe el `seq`), y las citas en un mapa por `seq`
  (`chat/filasDelChat.ts`, 6 tests) en vez de un `messages.find` por fila.
  `getItemType` recicla por tipo (texto, media, aviso, pendiente).
- **La conversación queda abajo**: `autoscrollToBottomThreshold: 0.2` (lo que
  llega o se manda cerca del final baja la lista), lo mío siempre baja al
  final, y al abrir el teclado vuelve abajo si se estaba abajo. Visto en el
  E2E: con el teclado abierto el último mensaje quedaba debajo del campo.
- E2E (emulador, server local): enviar; long-press → el modal de programar
  muestra el texto y al cerrar vuelve al campo; deslizar → «Respondiendo a
  vos» → la respuesta sale con su cita; con el teclado abierto el último
  mensaje se ve; un mensaje entrante estando abajo baja la lista.
- Pendiente FL2b: el deslizar sigue con `PanResponder` en el hilo JS (Maestro
  no lo dispara con `swipe` sobre el elemento; con coordenadas sí), y el
  teclado sube con `KeyboardAvoidingView` (no sincronizado con su animación).

### 45.7 As-is FL4, primera parte (16/10/2026)

- **Envío: de 5 a 3 viajes a la base antes del ack.** La membresía va en el
  filtro del `$inc` que reserva el `seq` (un no-miembro no consume número) y
  ese mismo viaje trae los miembros (`SendResult.members`), que
  `avisarMensajeNuevo` / `publicarMensaje` usan en vez de releer el chat. El
  duplicado se busca primero y sin mirar membresía: devuelve el mensaje propio
  ya guardado, no filtra nada ajeno. Tests: miembros devueltos y «un
  no-miembro no consume seq».
- **`listChats`: tres consultas en paralelo** en vez de 2 + N + 1 en serie: el
  último mensaje de todos los chats sale de UNA agregación
  (`$sort {chatId:-1, seq:-1}` + `$group $first`, sobre el índice
  `{chatId, seq}`) y los nombres van en el mismo `Promise.all`.
- **Socket.IO: ping 15 s / espera 10 s** (antes los defaults 25 + 20): un
  teléfono sin señal se da por caído en ~25 s. No se usa
  `connectionStateRecovery`: salta el middleware de auth al reconectar y la app
  ya hace `sync.pull` en cada `connect`.
- **Medido** contra el server local apuntando a **Atlas** (16/10): ack
  **375–426 ms** (línea base 624–941 ms); `GET /api/chats` 310 ms con el
  último mensaje correcto. Con la base en la misma mini (D2) cada viaje baja a
  milisegundos: ahí se mide la meta de < 300 ms.
- `scripts/conciliar-migracion.ts`: cuenta y concilia Atlas → bóveda para la
  migración de D2 (probado con `--contar`; la conciliación se corre en el
  cambio).

### 45.8 As-is FL2b (16/10/2026)

- **Deslizar para responder en el hilo de UI** (`chat/DeslizarParaResponder.tsx`
  con `react-native-gesture-handler` + Reanimated; reglas puras en
  `chat/gestoDeRespuesta.ts`, 3 tests): arranca a los 12 dp en horizontal, se
  suelta si el movimiento vertical pasa 14 dp (deja el scroll a la lista), y
  solo el «responder» cruza a JS. Reemplaza al `PanResponder` del hilo de JS.
- **Haptics** (`expo-haptics`): un tick al CRUZAR el umbral del deslizar (no
  al soltar) y otro al seleccionar con long-press. E2E: los dos aparecen en
  `dumpsys vibrator_manager` con el paquete de la app.
- **Teclado sincronizado** (`react-native-keyboard-controller`):
  `KeyboardAvoidingView` de la librería en el chat y en Ajustes, con
  `KeyboardProvider` y `GestureHandlerRootView` en la raíz de `App.tsx`. Con
  el teclado abierto el pie del composer baja a 8 dp (`useKeyboardState`): ya
  no queda hueco entre el campo y el teclado. Trampa: NativeWind no estiliza
  componentes de terceros — el `KeyboardAvoidingView` lleva `style`, con
  `className` perdía el `flex: 1` y aplastaba la pantalla.
- E2E: deslizar → «Respondiendo a vos» → la respuesta sale con su cita;
  teclado abierto pegado al campo; long-press → «1 seleccionado». Ojo: el
  `swipe` de Maestro desde el centro de una burbuja propia recorre muy poco
  antes del borde y no dispara; con `adb shell input swipe` (lento, 280 dp) sí.
- **Lo propio queda leído** (`marcarPropioLeido`, después del ack y en
  `publicarMensaje`; test con socket real): un mensaje mandado desde otro
  dispositivo ya no cuenta como «sin leer» ni dispara el «ponme al día» de
  Lila. Y el aviso dice «1 mensaje», no «1 mensajes».

### 45.9 As-is FL3, la conversación (16/10/2026)

**Diseño de referencia**: «Conversación 1:1 · Claro» generado en Stitch el 16/10
(proyecto 15540754270713720465, pantalla `db8e9add1f63431a939a8d6fbcac5b41`) —
la pantalla que faltaba: una conversación llena con agrupado, citas, foto, voz
y pendiente. La versión oscura falló por «service unavailable»; queda
pendiente. Las capturas NO van al repo.

- **Colores propios del chat** (tokens `fondo-chat`, `burbuja-propia`,
  `on-burbuja-propia`, `burbuja-ajena`, `on-burbuja-ajena`, `check-leido`,
  `autor-1…6`, en `shared/src/tokens.ts` + `tema.ts`, emitidos a
  `global.css`): propia lavanda clara con texto oscuro en claro y violeta
  profundo con texto claro en oscuro (test: contraste y «en oscuro la propia
  es oscura»); ajenas blancas / slate.
- **Forma** (`chat/burbuja.ts`, 9 tests): radio 18, esquinas internas de 6
  dentro del bloque, cola (4) solo en la última; 2 dp entre burbujas del
  mismo bloque.
- **Hora y checks DENTRO** de la burbuja, en la última línea: el texto lleva un
  relleno con la MISMA hora a 11 sp pintada del color de la burbuja (en
  Android un span `transparent` se ve gris) y la hora real va encima. Sobre
  una foto o video, en una píldora oscura. Checks vectoriales (lucide
  `Check`/`CheckCheck`/`Clock3`), azul de leído.
- **Grupos**: nombre del autor en la primera burbuja del bloque, con color
  estable por persona (`colorDeAutor`), y avatar con SU inicial junto a la
  última (antes era la inicial del nombre del grupo). Los nombres salen de
  `/api/chats/:id/detail` UNA vez por grupo (`useNombresDelGrupo`, con cache
  en memoria; resolución en `nombresDelGrupo.ts`, 3 tests: gana la agenda).
  **Bug que destapó**: la navegación pasaba `otherUserId` también en grupos
  («el primero»): la pantalla no se enteraba de que era un grupo y el botón de
  llamar llamaba a un miembro cualquiera. Ahora solo en 1:1.
- **Fondo** con patrón de puntos (`FondoDelChat`, un `Svg` con `Pattern`),
  chips de fecha blancos, selección que tiñe la fila (no la burbuja).
- **Botón «bajar al final»** con contador de lo que llegó de otros mientras se
  leía arriba (`useFinalDeLaConversacion`, contado por `seq`).
- **Controles inertes fuera**: el ⋮ abre la info del chat; el emoji (no hacía
  nada) se reemplazó por clip y cámara DENTRO de la píldora, que se esconden
  al escribir.
- E2E en el emulador: burbujas propias en un chat de QA y ajenas con nombre de
  autor en un grupo real (solo lectura); hora en la misma línea cuando cabe;
  video con la hora sobre la imagen; el botón bajar aparece al subir y lleva al
  final.
- **Subtítulo de la cabecera en grupos** (`chat/cabeceraDelChat.ts`, 5
  tests; diseño «Conversación de grupo · Oscuro», pantalla
  `b45fbc69cf2b43bd82a5d86fdaf18685`): nombra a quien escribe («Mamá está
  escribiendo…», «Mamá y Papá están…») y si nadie escribe, los miembros con
  «Vos» al final. Sin nombres cargados no inventa ninguno.
- `ChatScreen` quedó en 913 líneas (deuda previa, >600): la lógica de scroll
  salió a `useFinalDeLaConversacion`; falta partir la cabecera y los modales.

### 45.10 As-is FL3, la lista y el oscuro (16/10/2026)

- **Fila de la lista**: ripple de Material al tocar, sin líneas separadoras,
  avatar de 52 dp, hora a 12 sp, punto de «en línea» con token propio
  (`en-linea`, antes `bg-emerald-500` suelto).
- **Vista previa**: si lo último es MÍO, los checks van antes del texto (gris
  enviado/entregado, azul leído, con `resolveDeliveryState`); la media lleva un
  ícono vectorial (`resolveChatPreview` devuelve `media` y el texto sin emoji —
  test en `shared/chatDisplay.test.ts`; la web muestra el texto igual).
- **Fuera la cámara inerte** de la cabecera de la lista.
- **Modo oscuro verificado** contra «Conversación de grupo · Oscuro»: propias
  violeta profundo, ajenas slate, nombre del autor en color, subtítulo del
  grupo con los miembros.
- **De paso — «no pude bajar la versión anterior»** (José, 16/10): la banda
  «Actualizar» usaba la versión capturada al ABRIR la app; con seis
  publicaciones seguidas ofrecía una vieja. Ahora al tocar vuelve a preguntar
  (`infoParaActualizar`, 2 tests: fresca si llegó completa, si no la
  guardada). Y el fallo de descarga dice su motivo y queda en el diagnóstico
  (antes «Revisá la señal» a secas). El server de LilaStore sirve bien
  cualquier versión publicada (verificado con HEAD).

### 45.11 Migración de la base a bóveda (16–17/10/2026)

- **Lo que había**: `lilachat_db` ya existía en bóveda con una copia CONGELADA
  del ~19/09 (alguien empezó la migración y no la terminó); producción seguía
  escribiendo en Atlas. Se detectó comparando el último `updatedAt` de cada
  colección en las dos bases (acuses y usuarios de Atlas eran de ese día).
- **Copia fresca**: `mongodump` de Atlas → `mongorestore --db lilachat_db --drop`
  por el túnel con el usuario `lilachat_dev` (`--desde tunel`): 79 documentos
  con sus índices (`{chatId, seq}` único incluido). Trampa: con la base en la
  URI, `mongorestore` apuntado a la carpeta del volcado restaura 0 documentos;
  hay que pasarle la carpeta de la base (`dump/lilachat_db`) y `--db`.
- **El cambio**: José creó `lilachat_app` (`--desde mini`) con `--torre chat
  --clave MONGO_URL` (el modo automático no deja que Claude escriba secretos de
  producción en Torre) y el push de `5d8cdfc` relanzó el server.
- **Verificado**: un `read.set` propio contra producción (mismo `seq`, sin
  efecto visible) movió el `updatedAt` del acuse en bóveda y no en Atlas.
  `scripts/conciliar-migracion.ts --aplicar`: nada faltaba en bóveda (ya tenía
  4 mensajes y 1 recordatorio nuevos, uso real); lo único modificado en Atlas
  después del volcado fueron artefactos de QA (correo de la invitación vuelto
  a su valor, login de prueba, un acuse — conciliado por máximo).
- **La laptop**: `MONGO_URL` del `.env` apunta a bóveda con `lilachat_dev` por
  el túnel (`boveda tunel`); el QA ya no escribe en el Atlas congelado.
- **Atlas** queda congelado: leerlo no falla, da datos viejos. Revocar el
  usuario `lilachat_app` de Atlas es decisión de José.
- **Latencia**: con la base en la misma mini cada viaje baja de ~100 ms a
  milisegundos; la cifra real del ack va a llegar por el diagnóstico de la
  0.1.70+ (`ack-envio` en `/console/reportes`).

### 45.12 As-is FL5 y las pestañas sin esqueleto (17/10/2026)

**Pestañas** (José, 17/10: «cuando cambio de tabs se muestra un skeleton»).
`TabsShell` remontaba la pestaña en cada cambio (`key={tab}`): cada vuelta a
Chats, Agenda o Encuestas pedía todo de nuevo y mostraba el esqueleto. Ahora:
- Cada pestaña se monta la PRIMERA vez que se visita y después se esconde con
  `display: 'none'`, viva (`ui/pestanas.ts` → `visitadasCon`, 2 tests). El
  `reloadKey` solo remonta Agenda y Encuestas al crear algo.
- La lista de chats guarda además una copia en memoria del proceso
  (`chatsEnMemoria()` en `chatsGuardados.ts`): si se remonta, pinta en el
  primer render sin esperar a AsyncStorage. Cerrar sesión la vacía.
- **E2E** (emulador, debug contra :3104): Chats ↔ Agenda ↔ Encuestas ↔
  Ajustes con captura inmediata tras cada toque: ningún esqueleto y 0
  `GET /api/chats` nuevos en el log del server.

**FL5 — el respaldo sin congelar la pantalla:**
- **Formato v2 por trozos** (`shared/respaldoPorTrozos.ts`, 11 tests): mismo
  scrypt + AES-GCM, pero 100 mensajes por sobre y cediendo el hilo entre
  trozos; scrypt con `scryptAsync`. El id del respaldo y el índice van ADENTRO
  de cada trozo y la cabecera cifrada dice cuántos son: reordenar, quitar,
  duplicar o mezclar trozos no abre. `abrirRespaldoAsync` abre v2 y también
  el v1 de un sobre (los que ya están en la mini).
- **Medido en Node con 20 000 mensajes** (6 MB): armar 0,49 s y abrir 0,48 s
  en total, tramo típico sin ceder 0,7 ms, el más largo 39 ms (el primero:
  cola de scrypt). El v1 bloqueaba 0,32 s de un tirón en V8, más scrypt
  sincrónico; Hermes es varias veces más lento. Falta medirlo en un gama baja.
- **Leer para respaldar, por páginas** (`leerTodosLosMensajes`, 250 filas,
  cursor en el `seq` de la fila): antes se descifraba el chat entero de una.
- **Restaurar no pisa** (`importarMensajes`): `INSERT OR IGNORE`, lotes de 200
  que ceden (`shared/lotes.ts` → `porLotes`, 6 tests) y cuenta las filas
  escritas de verdad. Con todo ya en el teléfono dice «el teléfono ya tenía
  todo lo del respaldo» (`descripcionDeRestauracion`, 3 tests).
- **La tarea de fondo mira wifi y carga ANTES** de hidratar y armar
  (`motivoParaNoEmpezar`, 4 tests). «Respaldar ahora» arma igual.
- **Hueco del cursor**: al abrir un chat, `hidratarChat` rellena de fondo
  hasta 5 páginas de lo que falte en el medio.
- **Server**: `GET /api/respaldos/:nombre` abre con plazo (507
  `disco_colgado`, 404 si el archivo falta) y usa `pipeline`. Antes un archivo
  indexado pero ausente tumbaba el proceso: el 'error' del stream no tenía
  quien lo escuchara (test nuevo). Índice único `{userId, nombre}` (la base
  no tenía filas ni duplicados; mongoose lo crea al arrancar).
- **E2E** (emulador, debug contra :3104, 902049935 por yopmail):
  - el respaldo sale en v2 (2 trozos, scrypt real), sin texto en claro, y
    abre en Node con la passphrase: 27 + 13 mensajes, igual que el SQLite;
  - con el almacén lleno, restaurar escribe 0 filas;
  - con 9 filas borradas a mano del SQLite (`run-as` + `sqlite3`), restaurar
    escribe exactamente esas 9 (31 → 40).
  - QA en cero: devices 20 → 20, `Respaldo` 0, correo restaurado, app
    desinstalada del AVD.
- **Sigue pendiente de §44.4**: las filas que no descifran no se vuelven a
  pedir. Ajenos: el aviso de `expo-notifications` por `sound: 'default'` en
  el canal (lo pone LogBox en cada arranque de la debug, tapa la barra de
  pestañas) y el permiso de contactos pedido de nuevo tras negarlo.

### 45.13 As-is FL6, el logo (17/10/2026)

- **Por qué**: el ícono era un óvalo ancho (1,05 de proporción con la cola) con
  un latido de electrocardiograma adentro. José: «se ve forzado, estirado»; y
  se leía como app de salud. El encabezado usaba otro dibujo (lucide
  `MessageCircle` en un cuadrado violeta) y el login, otro más.
- **El dibujo**: dos burbujas REDONDAS que se superponen —una conversación—,
  la grande con la cola abajo a la izquierda y la chica abajo a la derecha,
  separadas por un corte del color del fondo (máscara, no un trazo). Misma
  familia que el molinete de Lilafotos: símbolo plano, tonos lila, fondo
  blanco. Colores tomados de `tokens.ts`, ningún hex nuevo (test).
- **Una geometría** (`shared/src/marca.ts`, 6 tests): `LOGO` con los dos paths
  y los tres tonos (claro, oscuro, mono), y `svgDelLogo()` para quien no tiene
  React. De ahí salen:
  - `scripts/iconos-de-la-app.mts` → `icon.png`, frente del adaptativo (al
    66 %), fondo blanco plano, monocromo (Android 13+), splash, favicon y el
    de la tienda (512). Reemplaza a `app/scripts/iconos.mjs`, que dibujaba
    el óvalo.
  - `app/src/ui/Logo.tsx`: el símbolo solo, sin contenedor, en la cabecera de
    las pestañas (30 dp) y en el login (72 dp); en oscuro, los tonos oscuros.
- `adaptiveIcon.backgroundColor` pasa de `#E6F4FE` (el de la plantilla) a
  blanco.
- **Verificado en el APK 0.1.76 (77)** con `aapt2`: `ic_launcher` adaptativo
  con `iconBackground` `#ffffff`, frente y monocromo con las dos burbujas
  dentro del círculo de 72 dp (simulado con la máscara). Smoke del release:
  arranca sin `FATAL`/`ClassNotFound`, el login muestra el `<Logo>`, y en el
  cajón del emulador queda al lado de Lilafotos. Publicada en LilaStore con
  el ícono de la tienda nuevo (`lila app icon`); la descarga es idéntica al
  build (sha256).
- **Stitch** (17/10/2026, paleta «Vivid Pulse», la de `tokens.ts`): tres
  pantallas en el proyecto, listadas en `design/stitch/INVENTARIO.md` —la
  conversación 1:1 llena, la lista con las cuatro pestañas reales y «Editar
  recordatorio»—. Lo que dibujan y la app todavía no tiene ya está en §46:
  divisor «N no leídos», nota de voz con onda y velocidad, enlace tocable,
  cita con autor y miniatura (FL9), «Mamá: …» en la vista previa de grupos.
  «Editar recordatorio» coincide con lo construido en FL7 salvo «Repetir», que
  Stitch dibuja como segmentado.
- **Las capturas de Stitch salieron del repo**: estaban versionadas desde el
  primer commit, contra la regla de José. Ahora `design/stitch/*` está en
  `.gitignore` (salvo el inventario) y los archivos siguen en la máquina; la
  historia vieja los conserva hasta que José decida reescribirla.

### 45.14 As-is FL7, agenda editable, visor y lo urgente de la auditoría (17/10/2026)

José: «los sub tabs eventos y avisos tienen el mismo problema, ¿no estás
auditando bien?», «no hay como editar avisos», «no hay como elegir una hora
específica», «en el chat abro una imagen, deslizo y no pasa a la previa o
siguiente». Tenía razón en lo de fondo: se arreglaba lo que él encontraba. Se
hizo una auditoría de TODA la app contra WhatsApp (§46) y esta fase toma lo
que pidió más lo que estaba roto.

**Agenda**
- Eventos y Avisos quedan montados (la vista inactiva se esconde): sin
  esqueleto al cambiar. Crear y editar viven en `AgendaScreen`; al guardar sube
  `recarga` y las listas vuelven a pedir sin remontarse. Al volver a la pestaña
  o a la app se vuelve a pedir (`ui/useAlVolver.ts`), también Encuestas.
- Avisos ya no tiene un segundo control segmentado adentro: una lista con
  «Tuyos» y «Compartidos en tus chats».
- **Editar y borrar**: `PATCH`/`DELETE /api/agenda/reminders/:id` (solo el
  dueño; a otro, 404) y `/events/:id` (solo quien lo creó; a un invitado 403,
  a alguien de afuera 404). Reglas puras en `shared/agendaEdicion.ts` (14
  tests): mover la hora rearma el aviso (`remindedAt: null`) —si no, el cron no
  lo volvía a mirar—, un opcional vacío se borra. Tocar un aviso propio o un
  evento propio (lápiz) abre la misma pantalla en modo edición, con borrar
  confirmado. `GET /events` dice `mio`. 11 tests de rutas (`eventRoutes.test.ts`).
- **Día y hora exactos**: `ui/SelectorDeCuando.tsx` (atajos + casillas Día y
  Hora con el picker del sistema), compartido por avisos y eventos. Atajos en
  hora local (`ui/cuando.ts`, 10 tests): «Esta noche» = hoy 20:00 (antes era
  ahora + 9 h: creado a las 20:00 sonaba a las 5:00), «Mañana» 9:00, «Este
  sábado» / «El próximo sábado» 10:00.
- **«Avisar 1 hora antes» no hacía nada**: la app mandaba `remindGuests` y el
  server lo ignoraba. Ahora se guarda, el cron lo respeta y se edita.
- Errores honestos: sin red las listas conservan lo que había y muestran
  «No se pudo actualizar. Toca para reintentar» (antes, «Sin eventos»). Tirar
  para refrescar en las tres listas, también vacías. El interruptor de un aviso
  vuelve atrás si el server no lo guardó.

**Los avisos llegaban mal (cron, verificado leyendo el código)**
- Con la app abierta, la web abierta o «Conexión permanente» NO llegaban: el
  push se filtraba a los desconectados y nada iba por el socket. Ahora un aviso
  de la agenda va a todos los teléfonos con `tipo: 'agenda'` y la app lo
  muestra con banner aunque esté adelante.
- Un aviso diario que se pasaba de la hora más de una hora quedaba activo para
  siempre sin sonar, y 50 así trababan al cron (`limit` sin orden). Ahora
  `decidirRecordatorio` (shared, 6 tests) lo mueve a la próxima vez o lo apaga,
  y la consulta va ordenada. Reactivar limpia el sello.

**Visor de fotos** (`VisorDeImagen` + `PaginaDelVisor` + `visor.ts`, 9 tests):
pager horizontal (deslizar entre fotos), pellizco y doble toque para acercar
donde se tocó, arrastre con zoom sin cambiar de foto, arrastrar en vertical
para cerrar, un toque esconde las barras, «N de M» en la cabecera, autor real
en grupos (antes, el nombre del grupo), tira con miniaturas (antes decodificaba
cada foto entera a 52 px) y un solo reproductor de video vivo. Las flechas se
fueron: iban al revés porque la lista llega de vieja a nueva.

**Chat secreto mandaba en claro** (auditoría, verificado): sin la clave lista,
la app encolaba el texto sin cifrar, y las fotos y notas de voz nunca se
cifraban. El comentario del server prometía «en un chat cifrado no se guarda
`body`» y el código no lo hacía. Ahora `sendMessage` rechaza todo lo que llega
sin sobre a un chat secreto (`CifradoRequeridoError`, 403 permanente para la
cola, sin consumir `seq`; 6 tests), y la barra de escribir queda bloqueada
hasta tener la clave y en modo solo texto después (sin adjuntos, voz ni
programados, que no viajan cifrados).

**Regresión mía de 55ccf58** (publicada en 0.1.76): un comentario `//` quedó
como texto JSX dentro del `<View>` de Ajustes. Ahora es `{/* */}`.

**E2E** (emulador, debug contra :3104 sin crons, 902049935 por yopmail):
Eventos ↔ Avisos con captura tras cada toque sin esqueleto ni pedidos; crear un
aviso eligiendo 7:30 p. m. en el reloj y el martes 20 en el calendario →
`2026-10-21T00:30Z` en la base; editarlo con «Mañana» y una nota →
`2026-10-18T14:00Z` y nota guardada; borrarlo con confirmación → 0. Evento
sembrado en un grupo «QA FL7» con José solo: aparece al volver a la pestaña,
se edita (título, «Esta noche», aviso apagado → `remindGuests: false`) y se
cancela → 0. Visor en un 1:1 con 6 fotos: deslizar 6→5→6, doble toque,
arrastre con zoom, toque para las barras, deslizar abajo para cerrar. QA en
cero: devices 20, chat QA borrado, app desinstalada.
No probado en la interfaz: el bloqueo del chat secreto (no hay uno en la cuenta
de QA; lo cubren los tests del server).

### 45.15 As-is FL8, lo que se pierde o se rompe (17/10/2026)

Toma la lista de §46.1 entera. El criterio era: ningún mensaje desaparece sin
aviso, la notificación abre su chat y la llamada suena fuera del chat.

**Mensajes que el server rechaza**
- La cola de texto (`shared/outbox.ts`) ya no descarta: un rechazo permanente
  (400/403/404/410) deja el mensaje **fallido** con su motivo (`fallo`), y
  `nextPending` lo saltea para que no trabe a los de atrás. Un 401 marca todo
  como fallido, no lo borra. `reintentarEnLaCola` / `descartarDeLaCola` (27
  tests).
- La burbuja fallida muestra el ícono de alerta en lugar del reloj y debajo
  «No se envió · Toca para reintentar». Al tocarla se abre Borrar / Cancelar /
  Reintentar con el motivo del server.
- La cola sale al conectar el socket, desde cualquier pantalla
  (`socketClient.alConectar`). Antes solo salía con un chat abierto.
- **La hora salía dos veces** en todo texto pendiente o fallido, desde FL3:
  en el texto y otra vez en su propio renglón. `burbuja.dondeVaLaHora` la pone
  en un solo lugar (4 tests).

**Fotos, archivos y notas de voz en cola** (`colaDeArchivos.ts` +
`colaDeArchivosMotor.ts`, 5 tests)
- Se encola el hecho igual que el texto, en AsyncStorage
  (`lilachat-cola-archivos`). El archivo se COPIA a `documentDirectory/
  cola-archivos/`: la caché de la cámara o del selector la limpia el sistema.
- El JWT no se guarda en la cola: se lee del llavero al subir.
- Sin red se reintenta con espera creciente. Un rechazo queda fallido, con
  ícono y «No se envió», sin ruedita (`etiquetaDeSubida`, 2 tests). Sale sola
  al conectar y sobrevive a cerrar la app a la fuerza.
- `useArchivosDelChat` pinta lo encolado en la conversación con su progreso.

**Tocar una notificación abre lo que avisa** (`ui/useAbrirDesdeAviso.ts`,
`ui/destinoDeAviso.ts`, 4 tests)
- Con la app viva, el listener. Con la app cerrada, la respuesta que la abrió
  (`getLastNotificationResponseAsync`), que se borra al atenderla.
- Un aviso de agenda va a la pestaña Agenda. Un `chatId` válido abre ese chat:
  primero desde memoria, después desde disco y, si no está, se pide al server.

**Llamadas de la sesión** (`calls/ProveedorDeLlamadas.tsx`, `server/
llamadas.ts`, 9 tests)
- La llamada ya no vive en `ChatScreen`: se escucha desde que hay sesión y la
  pantalla se monta encima de lo que esté abierto.
- El server guarda la oferta mientras suena (`CALL_TIMEOUT_MS`, en memoria).
  Quien conecta en ese tiempo la recibe. A los desconectados les llega el push
  «Llamada de …» / «Videollamada de …» (`tipo: 'llamada'`). Contestar, colgar
  o rechazar la borran.
- La oferta lleva nombre y teléfono de quien llama (`frameConAutor`): al abrir
  desde el push el chat todavía no está cargado y la pantalla decía «Llamada».
- **Tocar el push no sonaba**: `connectSocket` reemplazaba el socket pausado y
  se perdían los oyentes. `queHacerConElSocket` lo reconecta (tests).
- Vibra mientras suena una entrante. Si ya hay una llamada, la nueva recibe
  «ocupado».
- El altavoz es real (`setAudioModeAsync`). El botón de video solo aparece en
  videollamadas.
- La pantalla se cierra sola 1,5 s después de terminar.
- **Contestada no es conectada** (`calls/estadoDeMedios.ts`, 14 tests):
  - Hasta que ICE conecta la pantalla dice «Conectando…», no el reloj.
  - Si se corta dice «Reconectando…».
  - Si ICE falla, o pasan 30 s sin audio, se corta, se avisa al otro
    (`motivo: 'desconectada'`) y la pantalla dice «No se pudo conectar».
  - Sin candidatos del otro lado ICE no llega nunca a `failed`: en el E2E quedó
    80 s en «Conectando…» hasta el tope.

**Lo demás de §46.1**
- **Checks azules en grupos**: van con la lectura del ÚLTIMO, no del primero.
  Se calcula el mínimo de los demás miembros, sin contar a Lila
  (`shared/acuses.acuseDelGrupo`, 6 tests). El server lo hace en la lista
  (`acuseDe`) y la app en vivo (`useAcuses`).
- **Documentos sin miniatura** (PDF, Word, zip…) se abren con otra app.
- **Silenciar** se guarda en el server y el detalle lo lee (`muted`).
- **Cerrar sesión** pide confirmar y dice qué se borra. Le dice al server que
  olvide el push de este teléfono, y vacía las dos colas.
- **Nuevo chat** pasa los miembros: el 1:1 recién creado tiene botón de llamar
  y, si es secreto, su clave.
- **Permisos sin insistir** (`ui/permisos.ts`, 5 tests): contactos y
  notificaciones se piden una vez, o cuando la persona toca algo que los
  necesita. Android 13 decía «denied» antes de preguntar nunca: ahora la app
  lleva su propia marca de «ya pregunté». El canal local ya no declara sonido
  (`Custom sound 'default'`).
- **Agenda**: el RSVP de quien entró al chat después del evento lo suma como
  invitado (antes daba 403). Eventos, encuestas y avisos de un chat secreto se
  rechazan (403): se guardarían en claro.

**Prueba real de llamada con José** (17/10, su teléfono con 0.1.77 contra
producción y el emulador como «QA Ana»). Producción reparte STUN y TURN de
Cloudflare.
- En la primera, José contestó y no escuchó nada. Nada lo medía, así que no se
  sabe si fue el audio o el micrófono del emulador.
- La segunda y la tercera no sonaron: en 0.1.77 solo suena con el chat abierto.
- En la cuarta, medida con `getStats`, ICE conectó directo en unos 3 s. El
  micrófono del emulador captó la voz (nivel 0,66) y salieron 218 KB y
  entraron 159 KB. José escuchó.
- De ahí salió «Conectando…»: el reloj corría aunque el audio no pasara.

**E2E** (emulador, debug contra :3104 sin crons, 902049935 por yopmail).
El server de QA solo manda push a equipos dados de alta después de `QA_T0`:
los teléfonos de José no recibieron nada. Lo verificado:
- Permisos: se pregunta una vez y el segundo arranque no pregunta.
- Tocar una notificación abre el chat.
- La llamada entrante se ve encima de la lista y vibra. Rechazar le manda
  `call.end` al otro.
- Contestar, altavoz y colgar.
- Push de llamada con la app cerrada: al tocarlo suena.
- Llamada con SDP falso: «Conectando…», a los 30 s «No se pudo conectar», y el
  otro recibió `motivo: 'desconectada'`.
- Mensaje fallido: con José sacado del grupo, el mensaje queda fallido.
  Reintentar tras volver a agregarlo llega como `seq` 2. Borrar lo saca.
- Texto sin red: sale al volver, desde la lista.
- PDF sin red: queda en cola. Tras cerrar la app a la fuerza, volver la red y
  abrir, se sube solo sin entrar al chat.
- El PDF se abre en el visor del sistema.
- Silenciar: `muted: true` en la base y el interruptor sigue al reabrir.
- Cerrar sesión pide confirmar y «Cancelar» mantiene la sesión.

En local las subidas usan un almacenamiento falso: la clave de lila del `.env`
local no es la de producción y lila contesta 401.

**No verificado**
- «Nuevo chat» desde un contacto: el emulador no tiene contactos.
- Auricular contra altavoz en un teléfono: José escuchó, pero no se distinguió
  por dónde.
- Si el diálogo del permiso del micrófono tarda más que el timbre, `contestar`
  corre contra una llamada ya cerrada (se captura y se reporta).

**Deuda**
- `ChatScreen.tsx` tiene 923 líneas y `TabsShell.tsx` 681.
- El ícono chico de la notificación queda para FL10.

### 45.16 As-is FL8.1, la llamada entrante como WhatsApp (17/10/2026)

José probó llamar a Wilson con 0.1.77: a Wilson no le llegó nada; tuvieron que
estar los dos en el chat. 0.1.78 ya la hacía sonar fuera del chat, pero con
la app cerrada solo era una notificación común: sonaba una vez, sin pantalla
completa y sin Contestar/Rechazar.

**Módulo nativo `modules/llamada-entrante`** (Android)
- `ServicioDeAvisos` extiende al servicio de FCM de expo-notifications, con
  prioridad 10 contra −1. La llamada (`tipo: llamada`) y su fin se atienden
  ahí aun con la app cerrada; el resto sigue al delegado de expo.
- `AvisoDeLlamada` es la notificación `CallStyle`:
  - canal propio «Llamadas» con el tono de llamada del teléfono;
  - `FLAG_INSISTENT`: el tono se repite hasta tocar algo o que venza;
  - pantalla completa, categoría llamada, Contestar/Rechazar;
  - vence con lo que le queda de timbre. Es relativo: el reloj del teléfono
    puede no ser el del server.
- **Rechazar sin abrir la app** (`ReceptorDeLlamada`): `POST
  /api/calls/rechazar` con un token corto que trae el push. Ese token se firma
  con un secreto derivado, así nunca sirve como sesión.
- **Contestar o tocarla** abre la app con el chat y la acción
  (`LlamadaEntrantePackage`). La app se muestra sobre el bloqueo y JS se
  entera (`Puente`).
- `Bloqueo.soltar` devuelve la app detrás del bloqueo al terminar, o si la
  oferta no llega en 8 s: si no, cualquiera recorre los chats tras colgar.
- `Tono`: el tono del teléfono con la app adelante.
- `puedePantallaCompleta`: en Android 14+, si el sistema lo negó, Ajustes
  muestra «Llamadas a pantalla completa» con el atajo
  (`AvisoDePantallaCompleta`).
- El autolinking de expo encuentra los packages por el NOMBRE del archivo
  (`*Package.kt`); dentro de otro archivo no se enlazaba.
- expo-notifications llega precompilado (repo maven local), no como proyecto
  de Gradle: va como `compileOnly` por coordenadas.

**Server**
- El teléfono declara `capacidades: ['llamada-nativa']` al registrar su push
  (`CAPACIDADES_DE_PUSH`). A ese le llega la llamada como push solo-datos
  (prioridad alta, vida 30 s, con el token de rechazo, uno por persona). Una
  versión vieja sigue recibiendo la notificación común.
- `cicloDeLlamada.ts` maneja suena → vence o la contestan → termina:
  - al contestar, se apagan los otros teléfonos: push `llamada-fin` y
    `call.end` con `contestada-en-otro` a mis otros dispositivos;
  - al terminar queda la línea en el chat UNA vez (`kind: 'system'`, evento
    `llamada`): «perdida» va con push y la contestada, sin push;
  - el timbre que vence sin respuesta también deja «perdida».
- La oferta que se entrega tarde (al conectar) lleva `quedaMs`: el teléfono no
  arranca otros 30 s. En el E2E contestó a los 54 s y el server ya la había
  dado por perdida.
- **Bug de presencia, de antes de FL8.1:**
  - `markOnline` corría después de un `await` y `markOffline` podía correr
    antes. Conectar y cortar enseguida, como al salir rápido de la app, dejaba
    el contador en 1 para siempre.
  - Esa persona figuraba «en línea» sin socket y no recibía NINGÚN push
    (mensajes ni llamadas) hasta reiniciar el server.
  - Ahora el alta y la baja son sincrónicas
    (`test/presenciaCarrera.test.ts`: fallaba 3 de 3 antes del arreglo).

**App**
- Deslizar hacia arriba para contestar (`DeslizarParaContestar`): un toque no
  contesta y TalkBack tiene la acción «Contestar».
  - La decisión corre en el hilo de UI, así que lleva `'worklet'`. Sin eso el
    gesto fallaba.
  - Se cruza a JS sin argumentos: pasar una función como argumento de
    `runOnJS` no llegaba.
- Con la app adelante suena el tono del teléfono. De fondo con el socket vivo
  («Conexión permanente») la llamada se dibuja en nativo (`comoSuena`).
- Lo tocado en la notificación antes de que llegue la oferta espera a esa
  oferta (`queHacerConElAviso`).
- «Llamada perdida», «Llamada sin respuesta» y «Llamada de voz · 00:21» llevan
  ícono y hora (`LineaDeLlamada`, `shared/registroDeLlamada`, 8 tests). La
  perdida va en rojo.

**E2E** (emulador, debug contra :3104; los push filtrados a equipos nuevos):
- **App con el proceso muerto:** aparece la `CallStyle` «QA Ana · Llamada
  entrante» con canal de llamadas, `INSISTENT`, pantalla completa y el tono
  del teléfono. Rechazar en la notificación hizo que QA Ana recibiera
  `motivo: rechazada` sin abrir la app; quedó la línea «perdida» y su push.
- **App de fondo:** la notificación aparece. Contestar abre la app y contesta
  sola: la primera vez pide el micrófono y después «Conectando…».
- **App adelante:** pantalla con «Desliza para contestar». El toque no
  contestó y deslizar sí.
- **Pantalla apagada:** la llamada la encendió y abrió la app directo en la
  llamada entrante.
- **Quien llama corta antes:** la notificación se va sola y llega «Llamada
  perdida».
- En el chat quedaron las líneas rojas de perdidas y la gris «Llamada de voz ·
  00:21».

**No verificado**
- La llamada SOBRE un bloqueo real: el emulador no tiene bloqueo de pantalla
  (`isKeyguardShowing=false`).
- Tono y vibración audibles: el emulador no suena.
- Una versión vieja recibiendo la notificación común: lo cubre el test del
  server.

**Notas**
- Las líneas de llamada cuentan como no leídas (como WhatsApp), pero disparan
  «Ponme al día» de Lila sobre puras llamadas. Va a FL10.
- Con la app de fondo y sin «Conexión permanente» el socket se pausa: el
  server marca fuera de línea y la llamada va por push. Tras matar el proceso,
  el socket viejo puede tardar en caer, y en ese rato no hay push.

### 45.17 As-is FL8.2, el doble check sin abrir la app (17/10/2026)

José, en el chat con Wilson: un solo check aunque Wilson tenía internet, solo
que no había abierto la app. «Entregado» lo marcaba la app al conectarse. El
push llegaba al teléfono, pero era una notificación común: Android la dibujaba
sin ejecutar nada de la app y el server nunca se enteraba.

**Server**
- El teléfono que declara `mensaje-nativo` (`CAPACIDADES_DE_PUSH`) recibe el
  mensaje como push solo-datos (`notifyOffline` → `mensajeSoloDatos`). Lleva:
  - lo necesario para dibujarlo: quién, de qué grupo y qué dijo;
  - un token de entrega por persona y mensaje (`entregaPorAviso.ts`), con
    secreto derivado: no sirve como sesión, y vive 7 días por si el teléfono
    estuvo apagado.
- **Silenciado no es «no le llegó»**: al teléfono nativo le va el push con
  `silencioso: 1`, que acusa sin dibujar. Al teléfono viejo silenciado, como
  antes, nada.
- `POST /api/push/entregado`, sin sesión y con el token, llama a
  `markDelivered`, que usa `$max` y exige membresía. El `receipt` sale por el
  socket a los del chat.
- Las versiones viejas siguen con la notificación común. 0.1.79 solo declara
  `llamada-nativa`, así que sus mensajes no acusan hasta actualizar.

**Nativo** (`modules/llamada-entrante`, `AvisoDeMensaje.kt`)
- El servicio de FCM atiende `tipo: mensaje`:
  - primero confirma la entrega por HTTP (`Http.postearToken`);
  - después dibuja, salvo que sea silencioso o que la app esté adelante.
- Un aviso por chat, como WhatsApp: `MessagingStyle` con los últimos 7
  mensajes y el nombre del grupo. No duplica si el push se repite (por `seq`).
  Usa el mismo canal `mensajes-v2` que la app.
- Tocarlo abre ESE chat (`Puente.emitirChat`, con su propio lugar de
  pendiente: la llamada se lleva el suyo al arrancar). Abrir el chat, o volver
  a la app con él abierto, borra su aviso (`useLimpiarAvisoDelChat`).

**E2E** (emulador, debug contra :3104; push filtrados a equipos nuevos):
- **App de fondo:** el mensaje de QA Ana tuvo el acuse de entrega a los 2,6 s
  y apareció «QA Ana · Hola José, ¿te llegó?».
- **Proceso muerto:** el segundo mensaje tuvo el acuse a los 2,8 s y se sumó
  al mismo aviso, que quedó con los dos mensajes.
- Tocar el aviso abrió el chat de QA Ana en frío y el aviso se fue.
- **Chat silenciado:** hubo acuse (seq 3) y ninguna notificación.
- **Aviso esperando con el chat abierto:** al volver a la app se fue.

**No verificado:** responder o marcar leído desde la notificación (no
existe todavía); el nombre que se ve es el del server, no el de la agenda del
teléfono (igual que antes).

### 45.18 As-is FL9a, las acciones de la conversación (17/10/2026)

Primera tanda de §46.2: lo que se hace con un mensaje y al moverse por el chat.

**Pulsación larga** (`SeleccionDeMensaje`, `accionesDeMensaje.ts`, 5 tests)
- Responder, Copiar (`expo-clipboard`, con aviso «Copiado»), Reenviar y
  Eliminar. Antes solo había Eliminar, sin confirmar, y aparecía en mensajes
  ajenos que el server rechazaba.
- **Eliminar** pregunta:
  - «Eliminar para todos», solo en lo propio: deja la lápida de siempre;
  - «Eliminar para mí»: se oculta en ESTE teléfono (`ocultos.ts`, por chat en
    AsyncStorage) y los demás lo siguen viendo.
- **Reenviar** manda el TEXTO a otro chat por la cola de siempre.
  - Los chats secretos no aparecen como destino: el texto saldría en claro.
  - Desde un chat secreto no se reenvía.
  - Las fotos no se reenvían todavía: pide que el server comparta el archivo.

**Links, correos y celulares tocables** (`enlaces.ts`, 6 tests;
`TextoConEnlaces`)
- Los links van con o sin `https`. El punto final no es parte del link.
- Los celulares peruanos se reconocen con o sin +51 y espacios. Un monto o un
  código de pedido NO se vuelven tocables.

**Tocar una cita lleva al original** (`CitaDeRespuesta`)
- Lo resalta 1,5 s. Hace un segundo pase de scroll a los 400 ms: con alturas
  variables, el primero cae corto si esa zona no se midió (visto en el E2E).
- En los grupos la cita dice de quién es (`citadosPorSeq` con los nombres del
  grupo; antes quedaba vacía).

**«N mensajes no leídos»** (`divisorNoLeidos.ts`, 3 tests;
`useDivisorNoLeidos`)
- El divisor va arriba del primer no leído y el chat abre AHÍ, no abajo. Se
  toma al abrir y se queda hasta salir, como WhatsApp.

**Atrás deshace lo último** (`decidirAtras`, 5 tests nuevos): suelta la
selección, cancela la respuesta, y en la lista limpia la búsqueda antes de
cerrar la app.

**E2E** (emulador, debug contra :3104, chat «QA Ana» con 15 leídos y 4 no
leídos):
- El chat abrió con «4 mensajes no leídos» sobre el primero nuevo.
- El link abrió Chrome y el celular abrió el marcador.
- La pulsación larga mostró las cuatro acciones y atrás soltó la selección.
- Copiar: el portapapeles del sistema mostró el texto.
- **Eliminar** en uno ajeno solo ofreció «para mí». Se ocultó y en el server
  sigue intacto.
- **Reenviar** a QA Ana: llegó como seq 20.
- **Eliminar en uno propio** ofreció «para todos» y dejó la lápida, también en
  el server.
- **Responder** mostró «Respondiendo» y atrás la canceló.
- **Tocar la cita** saltó al mensaje 2 y lo resaltó.

**Observación:** una vez, recién abierto el chat, la lista volvió sola al
final unos segundos después del salto. No se repitió, pero queda anotado.

**Deuda:** `ChatScreen.tsx` llegó a 940 líneas: hay que partirla.

### 45.19 As-is: editar mensajes (17/10/2026)

Pedido de José. Como WhatsApp: **solo lo propio, solo texto y durante 15
minutos**. Pasado ese rato, editar cambiaría lo que el otro ya leyó y contestó.

- **Motor compartido** `shared/editarMensaje.puedeEditar` (7 tests): lo usan
  el server, que decide, y la app, que solo ofrece «Editar» cuando corresponde.
  En un chat secreto todavía no se edita: el texto viaja cifrado.
- **Server:**
  - `chatService.editMessage` exige membresía, autor, texto, que no esté
    borrado, la ventana y que no quede vacío (para eso está eliminar). Guarda
    `body` y `editedAt` (6 tests).
  - `msg.edit` por socket responde con un ack y avisa `msg.edited` a todos,
    incluidos mis otros teléfonos (2 tests de socket). Sin push: corregir una
    letra no amerita sonar en el bolsillo de nadie.
- **App:**
  - «Editar» (lápiz) en la barra de selección. El texto vuelve al campo con la
    barra «Editando mensaje» y su ×.
  - Al guardar se espera el eco del server. Si lo rechaza, el texto vuelve al
    campo y se dice el motivo.
  - `msg.edited` actualiza la lista y el disco (`marcarEditadoGuardado`, que
    comparte con el borrado `reescribirGuardado`).
  - La burbuja dice «Editado» antes de la hora, también en el relleno
    invisible que le reserva el lugar.
  - Atrás cancela la edición (`cancelar-edicion`).
  - Los pedidos por socket viven en `pedidosDeMensaje.ts`, así `useChat` no
    pasa de 600 líneas.
- **E2E** (emulador, debug contra :3104):
  - el mensaje propio de hace 30 s ofreció Editar;
  - «QA recien con un herror» quedó «QA recien, sin error» con `editedAt` en
    la base;
  - QA Ana recibió `msg.edited` en vivo y la burbuja mostró «Editado»;
  - el propio de hace una hora y el de QA Ana NO ofrecieron Editar;
  - atrás canceló una edición sin salir del chat.
- **No hecho:** editar fotos o su pie, y editar en chats secretos. La web no
  muestra «Editado».

### 45.20 As-is FL9b, varias fotos con pie y notas de voz (17/10/2026)

**Varias fotos con su pie** (`EnviarFotos`, `envioDeFotos.ts`, 4 tests)
- La galería deja elegir hasta 10 en el orden que se tocan.
- La cámara también pasa por la previsualización antes de mandar.
- En la previsualización:
  - la foto se ve grande, con una tira de miniaturas;
  - se puede sacar una (la que se ve no se pierde);
  - cada foto lleva SU pie («Añade un comentario…»).
- Se encolan en orden, con su pie, en la cola persistida (`caption` en
  `colaDeArchivos`; el server ya lo aceptaba). La burbuja pendiente muestra el
  pie.
- La tira horizontal lleva `flexGrow: 0`: sin eso se estiraba a todo el alto y
  achicaba la foto (visto en el E2E). El campo del pie sube con el teclado
  (`KeyboardAvoidingView` de keyboard-controller, como el chat).

**Notas de voz** (`NotaDeVoz`, salió de `MessageRow`; `notaDeVozMotor.ts`, 6
tests)
- Velocidad 1× → 1,5× → 2×.
- Una sola sonando a la vez: la que toma el audio pausa a la anterior.
- Tocar la barra salta a ese punto.

**E2E** (emulador, debug contra :3104):
- **Fotos:** dos fotos de la galería con pie a cada una; volver a la primera
  conservó su pie. Llegaron al server como seq 4 «QA la roja» y seq 5 «QA la
  verde», en orden, y se ven con el pie debajo.
- **Notas de voz:**
  - la velocidad cambió 1× → 1,5× → 2× solo en esa nota;
  - con una sonando, darle play a la otra la pausó;
  - a 2× avanzó dos segundos por segundo;
  - tocar la mitad de la barra saltó a la mitad.

**Notas del QA**
- El almacenamiento falso del server local no genera miniatura, y la app
  dibuja la foto desde la miniatura. Para verlas se le puso una en la base. En
  producción lila la genera.
- `input keyevent 111` (Escape) cierra la previsualización como atrás: no
  usarlo para bajar el teclado en las pruebas.

**Falta en FL9:** buscar dentro del chat, borradores por chat, archivar y
borrar chats, marcar no leído, nombre y foto de perfil, dimensiones de foto.

### 45.21 As-is FL9c, borradores, archivados, perfil y buscar en el chat (17/10/2026)

**Refactor previo** (sin cambio de comportamiento)
- `ChatScreen` pasó de 981 a 787 líneas. Salieron `EncabezadoDelChat`,
  `useAdjuntosDelChat`, `VisorDelChat` y `useProgramados`.
- `ChatListScreen` pasó de 891 a 602 líneas. Salieron `FilaDeChat` (con
  `memo` y callbacks estables), `BarraDeSeleccionDeChats`, `BuscadorDeChats` y
  `ResultadosDeMensajes`.
- Después de publicar 0.1.83 se terminó el corte: ningún archivo pasa de 600
  líneas.
  - `ChatScreen` (569): salieron `ListaDeMensajes`, `useRespuestaYEdicion`,
    `useAtrasDelChat`, `useMensajeFallido`, `useAlAbrirElChat`,
    `CrearDesdeElChat`, y `fotosDelChat` en `filasDelChat.ts` (puro, 3
    tests).
  - `ChatDetailScreen` (567): salió `CompartidoEnElChat`.
  - `TabsShell` (521): salieron `useActualizacionesDeLaApp`,
    `AparienciaAjuste` y `BuscarActualizacionesAjuste`.
  - `ChatListScreen` (581): salió `Archivados`.
  - `Rotulo` (`ui/Rotulo.tsx`) reemplaza tres copias.
  - En el server, `chatService.ts` (956 → 507) se dividió: `listaDeChats.ts`
    tiene la lista y `miembrosDelChat.ts` los miembros, el grupo y los
    ajustes por miembro.
  - Humo en el emulador:
    - archivar → «Archivados» → atrás → desarchivar;
    - editar y cancelar con atrás;
    - responder con cita (llegó al server);
    - detalle con «Compartido» y sus pestañas;
    - buscar, y atrás en orden: búsqueda → chat → lista;
    - oscuro y vuelta a sistema;
    - la banda de versión nueva.

**Borradores por chat** (`borradores.ts`, 2 tests; `resolveChatPreview`, 3
tests)
- Lo escrito y no mandado se guarda en el disco del teléfono, una clave por
  chat, medio segundo después de la última tecla y al salir del chat.
- Al abrir el chat vuelve al campo. Mandar o borrar el texto lo limpia.
- Editar un mensaje no pisa el borrador: al terminar o cancelar, el borrador
  vuelve al campo.
- La lista muestra «Borrador:» en el color de la marca y el texto en una
  línea. «Escribiendo…» del otro gana. En un chat secreto dice solo
  «Borrador», sin el texto.
- Se borran al cerrar sesión y cuando la credencial se revoca.

**Archivar y marcar como no leído** (server: `archived` y `markedUnread` en el
subdoc del miembro, 4 tests; shared: `accionesDeSeleccion` y
`separarArchivados`, 5 tests)
- Son de cada persona, como silenciar.
- La barra de selección suma «Archivar / Desarchivar» y alterna «Marcar como
  leído / no leído».
- Un archivado no se fija, y un mensaje nuevo no lo desarchiva (como
  WhatsApp).
- La lista principal muestra arriba la fila «Archivados», con cuántos tienen
  algo sin leer. Adentro hay cabecera con flecha. Atrás vuelve, y sin
  archivados se vuelve sola. Buscar mira también en los archivados.
- «No leído» es un punto sin número y la hora en el color de la marca. Cuenta
  para el chip «No leídos».
- Se va sola al abrir el chat: `markRead` la limpia en el server (el filtro
  solo escribe si estaba marcada) y la lista la limpia en vivo.
- Atrás en la lista suelta primero la selección, después la búsqueda,
  después «Archivados».

**Perfil: nombre y foto** (`/api/me/perfil`, 8 tests; `validarNombreDePerfil`,
5 tests; `perfilVisible`, 6 tests)
- `PUT /api/me/perfil` guarda el nombre: sin espacios de más y hasta 25
  letras (un emoji cuenta como una). Si no cumple, da 400 con el motivo.
- `POST /api/me/perfil/foto` sube la foto a una carpeta por persona
  (`perfil-<userId>`), aparte de los chats. `DELETE` la quita.
- La validación y la subida de la foto redonda se comparten con la del grupo
  (`subirAvatar.ts`). En la app las comparte `fotoDeGrupo.ts`, con el
  recortador en cuadrado.
- En un 1:1 la foto del chat es la del perfil del otro, en la lista y en el
  detalle.
- La sesión (`/api/auth/session` y el OTP) devuelve `avatarUrl`: la cabecera
  la pinta sin otro pedido.
- Ajustes abre con la tarjeta del perfil:
  - tocar la foto la cambia (cámara o galería);
  - «Quitar» la saca;
  - el lápiz edita el nombre;
  - el error sale debajo del campo.
  Lo cambiado se ve al instante en la cabecera y se guarda en la credencial.

**Buscar dentro del chat** (`coincidenciasEnChat` y `moverCoincidencia`, 6
tests)
- El botón «Buscar» del detalle, que estaba apagado, abre una barra en lugar
  de la cabecera.
- Busca en lo que el teléfono ya tiene, por subcadena, sin mayúsculas ni
  tildes. Incluye los chats secretos, porque acá el texto está descifrado. No
  cuenta los eliminados, los avisos ni lo «eliminado para mí».
- Salta a la coincidencia más nueva, y ↑/↓ recorren las demás con «2 de 5».
  La que se ve queda resaltada.
- Atrás cierra la búsqueda.

**E2E** (emulador, build de desarrollo contra :3104, chat «QA Ana» sembrado):
- **Borrador:**
  - «QA borrador uno» salió en la lista como «Borrador: …» con la etiqueta
    en violeta;
  - al reabrir volvió al campo;
  - borrado el texto, la lista volvió al último mensaje.
- **Buscar:** «cumple» dio «3 de 3» con la más nueva resaltada. Dos ↑
  llevaron a «1 de 3», al primer mensaje, con ↑ apagado. Atrás cerró la
  barra.
- **No leído:**
  - salió el punto, la hora en acento y «No leídos 1»;
  - en la base quedó `markedUnread: true`;
  - al abrir el chat pasó a `false` y el punto se fue.
- **Archivar:**
  - apareció la fila «Archivados» y el chat salió de la principal
    (`archived: true`);
  - adentro estaba la cabecera con flecha, y atrás volvió a la principal;
  - al desarchivar no se ofreció fijar, y la vista volvió sola a la
    principal (`archived: false`).
- **Perfil:**
  - el nombre vacío mostró «Escribe tu nombre.» debajo del campo;
  - «QA Jose» se guardó y la cabecera pasó a «Q»;
  - la foto (galería → recorte cuadrado) subió y se vio en la tarjeta y en
    la cabecera;
  - «Quitar» pidió confirmación y la sacó.
- **Humo del refactor:**
  - la cabecera, el menú de adjuntos y la previsualización de fotos andan;
  - el modal de programar se abre con el texto.
  No se recorrieron la nota de voz, la cámara, el archivo ni el visor.

**Notas del QA**
- Con el build de desarrollo, escribir con `adb input text` sin un campo
  enfocado recarga la app: dos «r» seguidas son el atajo de recarga.
- La galería del emulador estaba vacía. Se le cargó una imagen sintética y
  se borró al terminar.
- Se abrió por error un chat real de José. Se volvió atrás sin tocar nada:
  solo pudo mover su acuse de lectura, que ya estaba al día.
- El perfil de José se guardó antes y se restauró después, sin nombre ni
  foto. QA Ana, su chat y el equipo del emulador se borraron: quedaron 20
  equipos y 0 de QA.

### 45.22 As-is FL9d y el respaldo cerrado (17/10/2026)

**Seguridad: «Respaldar ahora» solo para operadores** (`backupRoutes.ts`, 4
tests nuevos)
- `POST /api/backup/run` lanza un `mongodump` de la base ENTERA y lo podía
  disparar cualquiera con sesión (auditoría §46.3).
- Ahora exige que el teléfono del usuario esté en `LILACHAT_OPERADORES`
  (separados por coma). Sin la variable no lo dispara nadie; el cron de cada
  noche sigue igual. **Para usarlo hay que cargar la variable en Torre.**
- `GET /api/backup` ya no devuelve `dir`, la ruta del disco del server.
  Devuelve `puedeRespaldar`, y la app esconde el botón a quien no puede.

**Ver y cancelar programados** (`programados.ts`, 2 tests;
`ProgramadosDelChat`)
- Sobre la barra de escribir aparece «N mensajes programados». Al tocarlo se
  abre una hoja con el texto y la hora de cada uno, y «Cancelar» pide
  confirmación.
- La lista sale de `GET /api/chats/scheduled` (ya existía). Se pide al abrir
  el chat y después de programar o cancelar.

**La búsqueda general lleva al mensaje**
- El resultado pasa su `seq` por la navegación (`Chat: { chat, irASeq }`).
- El chat abre en ese mensaje, resaltado.
- Si el mensaje no está cargado, avisa «Ese mensaje está más arriba».

**«Ya no eres participante»** (`useGrupo`, que reemplaza a
`useNombresDelGrupo`; `membresiaPorRespuesta`, 2 tests; socket, 1 test)
- Nadie escuchaba `chat.changed`. Ahora:
  - la lista se recarga con ese evento: te sacaron, o cambió el nombre o la
    foto de un grupo;
  - el chat abierto vuelve a pedir el detalle del grupo.
- Un 403/404 significa que ya no sos miembro: la barra de escribir se cambia
  por el aviso y el subtítulo deja de listar miembros. Sin red o con un error
  se sigue como estaba.
- El aviso «X te sacó del grupo» ahora le llega también al que sacaron. Antes
  iba solo a los que quedaban.
- `textoDeAviso` tiene `aMi`: «te sacó», «te agregó», «te nombró admin»,
  «Quedaste como admin». Antes decía «sacó a 902049935», con el propio número.

**Eliminar chat para mí** (server: `borradoHasta` en el subdoc del miembro y
`POST /api/chats/:id/borrar-para-mi`, 4 tests; shared: `eliminar` en
`accionesDeSeleccion`, 1 test)
- El server guarda el último `seq` y deja el chat leído hasta ahí.
- La lista lo oculta hasta que llega un mensaje nuevo. El historial
  (`listMessages`), la sincronización (`pullSince`) y la búsqueda no
  devuelven lo anterior.
- La app lo ofrece en la selección cuando todos son 1:1 (un grupo se deja con
  «Salir»), con confirmación. Borra también la caché local
  (`olvidarMensajesDelChat`) y el borrador.
- Las acciones de la selección salieron a `useAccionesDeSeleccion`.
  `ChatListScreen` queda en 542 líneas.

**E2E** (emulador contra :3104, con QA Ana, un 1:1 y «QA Grupo»):
- **Respaldo:**
  - la pantalla ya no muestra «Respaldar ahora»;
  - por HTTP, `run` da 403 y el estado viene sin `dir`.
- **Programado:**
  - el aviso dijo «1 mensaje programado»;
  - la hoja mostró «Hoy, 8:53 p. m.»;
  - al cancelar quedó `canceledAt` en la base y el aviso se fue.
- **Búsqueda general:** «chocolate» abrió el 1:1 con ese mensaje resaltado.
- **Fuera del grupo:**
  - con el grupo abierto, QA Ana me sacó por HTTP;
  - apareció la barra de «ya no eres participante», llegó la línea en vivo y
    el subtítulo quedó vacío;
  - la lista quitó el grupo;
  - al volver a entrar, las líneas dicen «QA Ana te sacó del grupo».
- **Eliminar:**
  - el 1:1 salió de la lista (`borradoHasta: 3`);
  - con un mensaje nuevo volvió con 1 sin leer, y adentro solo estaba ese.

**Notas**
- `chatDetalle.test.ts` falló una vez con la CPU tomada por Gradle y pasó
  tres veces después. Fue por tiempo de espera, no por la lógica.
- Queda de FL9:
  - elegir varios mensajes a la vez;
  - mantener para grabar la nota de voz y deslizar para cancelar;
  - fotos con su tamaño real.

### 45.23 As-is FL9e: varios mensajes, la voz sostenida y fotos con su forma (18/10/2026)

**Varios mensajes a la vez** (`accionesDeVarios` y `textoParaCopiar`, 4
tests; `useSeleccionDeMensajes`)
- La pulsación larga elige el primero. Desde ahí, tocar una burbuja (o su foto
  o su cita) la suma o la saca. Sin ninguno elegido se sale del modo, y atrás
  suelta todo.
- Responder y editar quedan para cuando hay uno solo. Copiar junta los textos
  en orden y reenviar manda cada uno por separado.
- «Eliminar para todos» solo aparece si todos son propios; «para mí» siempre.
- Deslizar para responder se apaga en modo selección.

**La nota de voz sostenida** (`gestoDeVoz`, 6 tests; `BotonDeVoz`)
- Sostener el micrófono graba y soltar manda.
- Deslizar 100 dp a la izquierda cancela: la barra avisa «Suelta para
  cancelar».
- Deslizar 80 dp hacia arriba deja la grabación sin el dedo.
- Un toque corto también graba sin el dedo, como antes. El grabador decía a
  propósito «se toca, no se mantiene», porque soltar sin querer mandaba audios
  cortados; ese camino sigue igual.
- El botón queda montado mientras se sostiene, porque si se reemplaza el gesto
  se corta.
- `terminar` lee un ref y no el estado: soltar justo después de empezar veía
  el estado viejo y la nota no se cortaba.

**Fotos con su forma** (shared: `dimensionValida` y `tamanoDeBurbuja`, 6
tests; server: `width` y `height` al subir, 1 test; app: `filaDeArchivoEnCola`,
1 test)
- La galería y la cámara dan el ancho y el alto. Viajan por la cola y la
  subida, y el server los guarda solo si son enteros razonables.
- La burbuja respeta la forma dentro de 240×320 y nunca baja de 120 de lado.
  Sin dimensiones, como en los mensajes viejos, queda el cuadrado de 220.
- La foto que sube ya tiene la forma final: la burbuja no salta de tamaño al
  llegar.

**E2E** (emulador contra :3104):
- **Selección:**
  - elegidos dos propios, la barra dijo «2 seleccionados» con copiar,
    reenviar y eliminar;
  - con uno de Ana sumado, solo «Eliminar para mí»;
  - sin el de Ana, «Eliminar para todos» borró los dos (lápidas en la base);
  - atrás soltó la selección sin salir del chat.
- **Voz:**
  - sostener 2,5 s y soltar mandó una nota;
  - deslizar a la izquierda mostró «Suelta para cancelar» y no mandó nada;
  - un toque dejó la barra grabando con X y enviar, y enviar la mandó;
  - deslizar hacia arriba la dejó sin el dedo, y la X canceló.
- **Foto 800×400:** quedó en la base con sus dimensiones. La burbuja salió
  apaisada 2:1, igual mientras subía y al llegar.

**Notas**
- La grabación arranca unos 0,7 s después de apoyar el dedo (preparar el
  grabador). Se pierde el arranque de la primera palabra; queda como mejora.
- El storage falso de QA no genera miniaturas: se puso una en la base para
  ver la foto. En producción lila la genera.

### 45.24 As-is FL9f: «Info» del mensaje, onda de la nota de voz y arranque sin demora (18/10/2026)

**«Info» del mensaje** (server: `infoDeMensaje.ts` y
`GET /api/chats/:id/messages/:seq/info`, 4 tests; app: `info` en
`accionesDeMensaje`, `InfoDelMensaje`)
- Solo de lo propio y con un mensaje elegido. La hoja agrupa «Leído por»,
  «Entregado a» y «Todavía no le llegó a», con los nombres de la agenda.
- Los acuses son un cursor por persona: se sabe el estado y **no la hora**.
  Para tener la hora haría falta guardar un acuse por mensaje; queda anotado.
- No incluye a Lila. Sale en el orden de los miembros del chat.
- Con seis acciones, la barra de selección muestra solo el número: «1
  seleccionado» se partía en dos líneas.

**Onda de la nota de voz** (app: `ondaDeVoz.ts`, 4 tests; server:
`ondaDeVoz.ts` y `media.onda`, 1 test)
- El grabador mide el nivel cada 100 ms (`isMeteringEnabled`). Al terminar
  pasa los dB a barras de 0 a 100: -60 dB o menos es silencio, y se mandan
  hasta 40 barras.
- La onda viaja en la subida como «12,40,…». El server acota cada valor,
  admite hasta 64 y descarta lo que no es un número.
- La burbuja dibuja las barras, que se llenan con el avance. Sin onda, como en
  las notas viejas, queda la línea de siempre.
- El contador de la barra se redibuja solo cuando cambia el segundo.

**Arranque sin demora**
- Medido en el emulador: permiso 221 ms, modo 46, preparar 33, grabar 118.
- El permiso del micrófono ahora se recuerda en el proceso una vez concedido.
  Además se consulta sin diálogo al abrir la barra (`precalentarPermisoDeVoz`).
- Medido después: permiso 0, modo 15, preparar 11, grabar 63. Bajó de ~420 a
  ~90 ms.

**E2E** (emulador contra :3104, grupo con QA Ana y QA Beto):
- **Info:** la hoja mostró «Leído por QA Ana» con checks azules y «Entregado a
  QA Beto».
- **Onda:**
  - una nota de 3,4 s llegó con 29 barras (antes 11);
  - el micrófono del emulador graba silencio, así que la onda real fue plana
    y se sembró una variable para verla;
  - mientras suena, la onda se llena con el avance.
- **Barra de selección:** el número entra en una línea.

**Notas**
- `respaldoRoutes.test.ts` fallaba a veces porque dos respaldos en el mismo
  milisegundo empataban en `creadoEn`. Ahora `_id` desempata, en el último y
  en la limpieza de los viejos.
- Queda abierto: saltar en la onda arrastrando el dedo (hoy se toca).

### 45.25 As-is FL4 y FL10: la lista una vez, tuteo, 44 dp, «últ. vez» y «Ponme al día» (18/10/2026)

**La lista de chats, una vez al arrancar** (app: `api/pedidoUnico.ts`, 4
tests; `debeRecargarAlConectar` en `listaEnVivo.ts`, tests)
- Medido en el log del server de QA: el arranque pedía `GET /api/chats` 6
  veces. `TabsShell` y `ChatListScreen` pedían cada uno, otra vez al primer
  `connect`, y sus `useCallback` dependían del JWT, que el refresh cambia.
- `unSoloPedido(clave, hacer)`: dos pedidos iguales en vuelo comparten la
  misma promesa. `listChats` lo usa con la clave `chats:<jwt>`.
- Al conectar se recarga solo si la última carga buena tiene más de 3 s.
- El JWT se lee de una ref: `load` ya no cambia de identidad con el refresh.
- Medido después: arranque en frío 1, volver del fondo 1, tirar para
  actualizar 1.

**Tuteo** (app, shared y server)
- 45 textos pasaron del voseo al tuteo: «Probá»→«Prueba», «Podés»→«Puedes»,
  «Elegí»→«Elige», «Sos el único admin»→«Eres el único admin», «Seguís en el
  grupo»→«Sigues en el grupo», «Repetila»→«Repítela», etc.
- «Vos» pasó a «Tú» (autor de un mensaje, miembros del grupo, detalle).
  «Respondiendo a vos» pasó a «Respondiendo a tu mensaje».
- Una segunda pasada con patrón (`-ás/-és/-ís`, imperativos con tilde) halló
  6 que la primera no vio. Los comentarios del código quedan como están.

**44 dp**
- Botones de 32–40 dp de ancho pasaron a `h-11 w-11` (cabeceras, cerrar,
  quitar participante, RSVP, «Quitar» foto, cancelar respuesta).
- Donde el dibujo es chico a propósito (quitar foto o chip, reproducir nota,
  barra de la nota, «bajar»), `hitSlop` completa los 44.

**«últ. vez»** (server: `ultimaVez.ts`, 2 tests; shared: `formatUltimaVez`,
3 tests; app: `useUltimaVez`, `subtituloDelChat`, 3 tests)
- `User.lastSeenAt` se escribe al cerrarse el ÚLTIMO socket de la persona,
  no en cada conexión. La presencia sigue en memoria; esto sobrevive a un
  reinicio.
- El aviso `presence` de «se fue» trae `lastSeenAt`.
- Al abrir un 1:1 la app pide `presence.ultimaVez` (con ack) y repite el
  pedido en cada reconexión. El server contesta solo si comparten un chat y
  el otro no está en línea; con un id inválido, `null`.
- La cabecera: «escribiendo…» > «en línea» > «últ. vez hoy a las 7:41 a. m.».
  Ayer dice «ayer», más atrás la fecha («2 oct.»). A la una: «a la 1:05».
- No hay ajuste para ocultarla, como el de WhatsApp. Queda anotado.

**Punto verde solo en 1:1** (`puntoEnLinea` en `listaEnVivo.ts`, 2 tests)
- En un grupo con varios conectados el punto era ruido permanente.

**Un solo respaldo en Ajustes** (`useEsOperador`)
- «Datos» muestra solo «Copia de seguridad», que es el respaldo cifrado de
  los chats de cada uno. Antes se llamaba «Respaldo en la mini».
- «Respaldo del servidor» (volcado nocturno de la base entera) aparece solo
  si el server dice `puedeRespaldar`, o sea para un operador.
- El resto del texto del respaldo todavía nombra «la mini». Para quien no
  conoce la máquina de José no dice nada; queda anotado.

**«Ponme al día» con sentido** (`ponerAlDia.ts`, 6 tests)
- Cuenta solo mensajes ajenos de verdad entre los no leídos: sin avisos ni
  llamadas (`system`), sin lo propio, sin lo eliminado.
- Se ofrece desde 10. Con menos se leen de un vistazo.
- Se esconde al volver al final después de haber estado arriba
  (`onLlegoAlFinal` de `ListaDeMensajes`). Un resumen ya pedido se queda.

**E2E** (emulador contra :3104, chats con QA Ana y QA Beto):
- Con 2 sin leer no salió «Ponme al día». Con 12 y con 30, sí. Con 30 abrió
  en el primero no leído, y al bajar hasta el final la banda se fue.
- QA Beto sembrado sin conectarse nunca: cabecera vacía. Después se conectó
  por socket desde un script: «en línea». Al irse: «últ. vez hoy a las 7:42
  a. m.» sin recargar. Al reabrir: la hora guardada.
- Ajustes: un solo respaldo en «Datos»; «Si la olvidas», «Repítela».
- Lista: 1 `GET /api/chats` al arrancar, al volver del fondo y al tirar.

**Notas**
- El server de QA escribió `lastSeenAt` en el usuario real de José al
  desconectarse el emulador. Se borró en la limpieza y se verificó en 0.
- Fast Refresh no conectaba con el build de desarrollo del emulador: hubo que
  reiniciar la app para ver cada cambio. No es del código.
- Tamaños: `ChatScreen.tsx` 598 líneas, `useChat.ts` 581, `chatRoutes.ts`
  ~572. Lo próximo que entre ahí obliga a partir.

### 45.26 As-is FL10: encuestas completas, el evento para todos y un ErrorBoundary por pantalla (18/10/2026)

**Encuestas** (server: `vistaDeEncuesta.ts`, `votoDeEncuesta.ts`,
`contextoDeChats.ts`, 13 tests; app: `encuestas.ts`, 11 tests,
`TarjetaDeEncuesta`)
- `GET /polls` dice de qué chat es (`chat`: el grupo por su nombre, el 1:1
  por el teléfono y nombre del otro), quién preguntó (`autor`), si es mía
  (`esMia`) y `personas` para nombrar con la agenda.
- **Anónima de verdad:** los votos ajenos salen como seudónimos estables
  («anonimo-0»), lo propio con mi id. Los conteos y porcentajes no cambian,
  ni siquiera en las apps viejas, que cuentan `votes`. `personas` trae solo
  al autor.
- **Votar ya no pisa:** antes se reescribían todas las opciones y dos votos a
  la vez perdían uno (el test lo reprodujo). Ahora cada voto toca solo el id
  de quien vota (`$pull`/`$addToSet`), con el filtro `closedAt: null`.
- Votar devuelve la encuesta actualizada. Cerrar (`POST /polls/:id/close`) y
  eliminar (`DELETE /polls/:id`) son solo de quien la creó.
- La tarjeta: «Familia · preguntó Wilson», «Wilson te preguntó» (1:1) o
  «preguntaste tú». Debajo de cada opción, «Tú, Wilson y 2 más» (nunca en
  una anónima). Al pie, votantes únicos y «Cerrada». Cerrar y eliminar con
  confirmación.
- El voto se ve al instante. Mientras viaja, la tarjeta no acepta otro y
  dice «Guardando…». Si falla, vuelve atrás y lo dice en la tarjeta.

**El evento para todos** (server: `vistaDeEvento.ts`, `invitarAlEvento.ts`,
6 tests; shared: grupo existente en `planTargetChat`, 3 tests; app:
`eventos.ts`, 8 tests, `DetalleDeEvento`)
- Tocar cualquier tarjeta abre el detalle: en qué chat y quién lo creó,
  cuándo (con hora de fin), dónde, descripción, y quiénes van por respuesta
  («Van», «Tal vez», «No van», «Sin responder»). Quien lo creó tiene ahí
  «Editar».
- **Hora de fin** opcional en el formulario («Agregar hora de fin», dos
  horas después por defecto; sin atajos, que cuentan desde ahora). «Quitar»
  la borra también al editar.
- **«Pueden invitar a otros» tiene efecto:** `POST /events/:id/invitar`.
  Quien lo creó, siempre; los demás, solo con el interruptor. Se invita solo
  a contactos (un chat en común), hasta 20 por vez, sin duplicar. El invitado
  de afuera ve el evento («QA Beto te invitó», sin el chat), responde y le
  llegan los recordatorios. `attendees.invitedBy` guarda quién lo sumó.
- **Ya no se crea siempre un grupo nuevo:** con 2+ invitados, si hay un
  grupo con EXACTAMENTE esa gente, el evento va ahí. No se agregó elegir
  conversaciones: José pidió contactos, no chats.
- `GET /events` ahora busca también por `attendees.userId`. En la bóveda no
  hay índice para eso (autoIndex apagado); con pocos eventos no pesa, queda
  anotado.

**ErrorBoundary por pantalla**
- Lista, Encuestas, Agenda, Ajustes y la conversación tienen el suyo. En la
  conversación, además de «Reintentar», «Volver» a la lista.

**Bug previo encontrado en el E2E:** el selector de contactos (nuevo chat,
grupo, invitar) quedaba en esqueleto para siempre si ningún número de la
agenda era válido o la agenda estaba vacía. `POST /contacts/match`
contestaba sin `groups` y la app reventaba al juntar listas. Ahora el server
manda `groups: []` (test) y la app se cuida igual.

**E2E** (emulador contra :3104; autores QA Ana, QA Beto y QA Caro):
- Por HTTP: 6 votos simultáneos entraron todos; la anónima no filtró ids;
  cerrar y eliminar ajenos dieron 403; votar cerrada, 400.
- En la app:
  - **Encuestas:** origen en cada tarjeta, nombres bajo cada opción y la
    anónima sin ellos. Votar mostró «Tú» y «3 votantes». Cerrar dejó la
    encuesta en «Cerrada», sin votos. Sin red, el voto volvió atrás con «Sin
    conexión». Eliminar la sacó de la lista.
  - **Eventos:** las tarjetas mostraron origen y hora de fin. El detalle de
    un evento ajeno mostró los tres grupos de respuesta. Invité a QA Ana
    desde el detalle y apareció en «Sin responder». En el propio, «Editar»
    abrió el formulario con «Termina» precargado; «Quitar» y guardar
    dejaron solo el comienzo.
  - **ErrorBoundary:** con un error forzado en la Agenda (revertido), solo esa
    pestaña mostró «Algo se rompió». Chats siguió andando.

**Notas**
- Otra sesión (Pulso) tenía el emulador con su lock y su Metro en el 8081.
  Lilachat usó el 8082, con `debug_http_host` escrito en las preferencias
  de la app, y lo borró al terminar.

### 45.27 As-is FL10 (cierre): la app gira y tiene tablet (18/10/2026)

**Motor** (`ui/disposicion.ts`, 5 tests; `useDisposicion` sobre
`useWindowDimensions`, nunca `Dimensions.get`)
- `apaisada` = más ancha que alta; `tablet` = lado corto ≥ 600 dp; `amplia` =
  tablet o girada; `dosPaneles` = tablet con ancho para la lista (380) y el
  chat (340).
- `app.json › orientation: "default"`. `android/` está en `.gitignore` y lo
  genera el prebuild; el manifest local se alineó (sin
  `screenOrientation`).

**Teléfono girado**
- Las pestañas pasan a un riel a la izquierda (`BottomNav vertical`): sin él,
  la cabecera y la barra abajo dejaban poca altura para la lista.
- El contenido de cada pestaña se centra con ancho máximo de 720 dp. La raíz
  y la conversación respetan los márgenes laterales del sistema (recorte de
  la cámara y barra de navegación al costado).

**Tablet: dos paneles, como WhatsApp**
- En «Chats», la lista a la izquierda (380 dp) y la conversación a la
  derecha. Sin chat elegido, «Elige un chat».
- Abrir un chat, desde la lista o desde una notificación, lo pone en el
  panel, no en el stack. La flecha atrás lo cierra.
- El chat del panel no lleva el margen superior del sistema
  (`SinMargenArriba`, insets con `top: 0`).
- Al girar una tablet chica (600 dp parada), el chat pasa del stack al panel
  y vuelve.
- `chatQueSeVe` (`rutas.ts`, 3 tests): el chat del panel cuenta como abierto
  (leído) solo con la pestaña Chats a la vista. En otra pestaña el panel se
  desmonta.
- La entrada (teléfono y código) se centra con 480 dp: las seis casillas se
  repartían en 1280.

**E2E** (build de desarrollo con la orientación libre):
- **Teléfono** (Pixel 6, 868 × 411 dp girado): riel, lista, conversación,
  Agenda y Ajustes girados sin cortes. Al volver a vertical vuelve la barra
  abajo.
- **Tablet** (Pixel Tablet, 1280 × 800 dp):
  - dos paneles en las dos orientaciones;
  - abrir y cerrar el chat del panel;
  - la Agenda centrada;
  - al volver a Chats, el chat sigue en su panel;
  - la entrada, centrada.

**Notas**
- La fila del chat abierto no se resalta en la lista de la tablet; WhatsApp
  la resalta. Queda anotado.
- Al entrar en la tablet se negaron los permisos de notificaciones y de
  contactos: el device de QA no debe recibir pushes de producción.

### 45.28 As-is FL11: la llamada contestada desde la notificación (18/10/2026)

**La causa, confirmada con un test:** el server reenviaba `call.ice` solo a
los sockets conectados en ese instante. Quien llama manda sus candidatos ICE
en el primer segundo. El otro teléfono, con la app cerrada, no tenía socket,
así que se perdían. Al tocar «Contestar», la app conectaba y el server le
repetía la oferta (`ofertasVigentes`), pero no los candidatos. Sin los
candidatos de quien llama (sobre todo el `relay` del TURN), el audio no
cruza los NAT del celular y la llamada queda en «Conectando…».

**Arreglo (server, sin APK nueva):**
- `guardarCandidato` guarda los candidatos de quien llama junto con la oferta
  que sigue sonando: hasta 40, solo los de quien llama y solo mientras suena.
- Al conectar, el server manda cada oferta vigente y después sus candidatos,
  en orden (`candidatosDeLaOferta`). La app ya los guardaba en su buffer
  hasta fijar la descripción remota.
- **Segundo bug, encontrado por el test:** cada señal esperaba su propia
  consulta a la base, y la oferta hace una más (el nombre de quien llama). Un
  candidato podía salir antes que su oferta, y el que recibía lo descartaba
  porque todavía no sabía de qué llamada era. Ahora las señales de cada socket
  se procesan en orden (`crearColaSerial`).

**Tests:** 4 unitarios (`llamadas.test.ts`) y 2 de socket
(`llamadaDesdeElAviso.test.ts`):
- quien conecta tarde recibe la oferta y después los candidatos;
- en vivo, la oferta sale antes que sus candidatos aunque lleguen pegados.

Con el código anterior, el primero recibía solo la oferta y el segundo,
fuera de orden.

**E2E en el emulador** (quien llama: una página en el navegador como QA Ana,
con WebRTC):
- con la app cerrada, sonó la llamada a pantalla completa con «Answer»;
- el build de desarrollo tarda unos 23 s en arrancar en frío (baja el JS de
  Metro) y la llamada venció a los 30 s antes de contestar. No es del
  arreglo: la prueba definitiva es en teléfonos reales con la APK.

**Prueba real (José, 0.1.90, 18/10):** lo llamé desde la página como QA Ana,
con el TURN de producción, y contestó desde la notificación con la app
cerrada. En la página se vio llamada contestada, ICE «checking» y después
«connected», con candidatos en las dos direcciones. José escuchó el tono.
**Conecta.** ✅

**Hallazgo nuevo en esa prueba:** al cambiar de app en plena llamada el tono
se dejaba de oír, y volvía al regresar. Va como ítem 7 de §46.4.

**Arreglo del ítem 7 (app, 0.1.91):**
- **Servicio «Llamada en curso»** (`ServicioDeLlamada`, módulo
  `llamada-entrante`):
  - en primer plano, tipo `microphone` (`FOREGROUND_SERVICE_MICROPHONE`);
  - va con la llamada activa y llamando hacia afuera
    (`necesitaServicioDeLlamada`, 3 tests);
  - la notificación usa el estilo de llamada del sistema
    (`CallStyle.forOngoingCall`): arriba de la bandeja, con reloj desde que
    conectó y «Colgar» a la vista;
  - canal sin sonido ni vibración. Con importancia baja quedaba plegada en
    «Silenciosas» y «Colgar» no se veía.
- **«Colgar» de la notificación:** `ReceptorDeLlamada` lo emite a JS y
  `queHacerConElAviso` cuelga la llamada de ese chat. Sin llamada no espera
  ninguna oferta (2 tests).
- **Si el servicio ya corre**, actualizar el aviso (llamando → en curso) va por
  `notify`: Android 12+ no deja volver a arrancar un servicio desde el fondo.
- **El socket no se pausa en plena llamada** (`pausaDelSocket`, 5 tests): la
  pausa de ir al fondo queda pendiente y se aplica al terminar; volver
  adelante la cancela. Por ahí llega que el otro colgó.

**E2E del ítem 7** (emulador, quien llama: la página de QA Ana):
- **Al fondo, 20 s después de contestar:**
  - el servicio sigue en primer plano (tipo 0x80, canal de llamada,
    categoría `call`);
  - el proceso en `procState=4` e `isFrozen=false`;
  - el socket vivo (José en línea) y el ICE en «connected».
- **«Colgar» de la notificación** (ya con el estilo de llamada): la página
  recibió «fin: colgada» y el servicio se apagó.
- **El otro cuelga con la app al fondo:** el aviso llegó, el servicio se
  apagó y recién ahí se pausó el socket (José sin conexión).
- **Prueba real (José, 0.1.91, 18/10):** contestó desde la notificación,
  cambió de app y el tono siguió; colgó desde la notificación. ✅

### 45.29 As-is FL11 (cierre): avisos como WhatsApp y la foto con pie (18/10/2026)

**Duplicados y «uno por mensaje»: la causa estaba en los datos.**
- El token de FCM del teléfono de José figuraba en 2 devices: uno nativo y uno
  viejo. Le llegaban el push de datos (el aviso nativo, agrupado por chat) y el
  común (uno por mensaje), con dos formatos distintos.
- Además había un token viejo repetido en 6 devices y otro en 2, y cada uno
  recibía N copias.
- Arreglo (server, `repartoDePush.ts`, 3 tests y 3 de integración): un token,
  un envío. Si un token es de un device nativo, no va el push común. Se aplica
  a mensajes, llamadas y fin de llamada.

**El aviso local (app viva, por el socket): uno por chat** (`avisosPorChat.ts`,
3 tests)
- Mismo identificador para todo el chat: el nuevo reemplaza al anterior, con
  las últimas 5 líneas y «· 3 mensajes» en el título.
- Abrir el chat borra su aviso nativo y el local.

**El nombre de la agenda en el aviso nativo** (`Agenda.kt`)
- El push de datos trae el teléfono de quien escribe y el código nativo lo
  busca con `ContactsContract.PhoneLookup`: tal cual y con +51, porque «900…»
  solo no coincidía con «+51 900…». Vale también para la llamada entrante.
- Sin permiso de contactos o sin coincidencia, queda el nombre del server.

**«Responder» y «Marcar como leído»** (server: `tokenDeRespuesta.ts`,
`respuestaDesdeAviso.ts`, 7 tests; nativo: `ReceptorDeMensaje`)
- El push trae un token de esa persona y ese chat, con secreto derivado (no
  sirve como sesión) y 7 días de vida. En un chat secreto no va: la respuesta
  saldría sin cifrar, y el server igual la rechaza.
- `POST /api/push/responder` crea el mensaje con la `clientKey` que pone el
  teléfono (un reintento no duplica) y lo publica. Responder marca leído lo
  anterior.
- `POST /api/push/leido` lee el chat hasta su último mensaje y avisa el check
  azul.
- La respuesta va en línea (`RemoteInput`, PendingIntent mutable). Si sale
  bien, el aviso se va; si falla, se cambia por «No se envió tu respuesta», que
  abre el chat.

**Foto con pie** (`anchoDeBurbujaConFoto`, `miniaturaDe`, 7 tests)
- La burbuja con foto no pasa del ancho de la foto: el pie se ajusta a ella.
- Bug encontrado en el E2E: el storage no siempre genera la miniatura (un PNG
  llegó sin ella) y la burbuja mostraba solo el pie. Una imagen sin miniatura
  usa su archivo completo, en la burbuja, en el visor y en «Compartido».

**E2E** (emulador contra :3104):
- **Contacto de QA en la agenda del emulador** («Ana Agenda QA»). Con la app
  cerrada, tres mensajes de QA Ana dieron un solo aviso: «Ana Agenda QA», las
  tres líneas, «Responder» y «Marcar como leído».
- **«Responder» en línea:** el mensaje de José llegó al server. La
  notificación se canceló; SystemUI muestra «Tú: …» como confirmación.
- **«Marcar como leído»:** el aviso se fue y José quedó leído hasta el
  último.
- **App abierta en la lista:** tres mensajes dieron un solo aviso local,
  «Ana Agenda QA · 3 mensajes». Al abrir el chat, se borró.
- **Foto vertical con pie largo:** el pie se ajustó al ancho de la foto, que
  se vio aunque no tenía miniatura.

**Notas**
- En el E2E se abrió por error el chat real «Los originales» (la lista se
  reordenó al irse la banda de actualización). No se tocó nada; no tenía
  mensajes sin leer.
- Al responder rápido con `adb`, el pie de la foto se cortó a mitad: se tocó
  enviar antes de que el build de desarrollo procesara todas las teclas. No es
  un límite de la app.

## 55. FL16 — tarjetas en vivo y editar el recordatorio del grupo (19/10/2026, 0.1.99)

José, 19/10: «no se editan; creé el recordatorio grupal de tomar agua y no hay
cómo editarlo». Y un voto, un cambio o un borrado se veía recién al reabrir
el chat: las tarjetas se pedían solo al montarse. Va en el mismo paquete que
W0–W2 de la web («luego publicamos todo junto»).

| Qué | Cómo | Dónde |
| --- | --- | --- |
| Aviso en vivo | Cada cambio de una tarjeta avisa `ref.changed {chatId, tipo, id}` a TODOS los miembros: voto, cierre y borrado de encuesta; respuesta, edición y cancelación de evento; edición, interruptor, imagen (poner y quitar) y borrado del recordatorio del grupo. Sale DESPUÉS de responder y nunca lanza; el personal (sin chat) no avisa | server `avisoDeTarjeta.ts` (+8 tests), `eventRoutes.ts`, `recordatoriosDeGrupo.ts`, `socket.ts` |
| Tarjetas que escuchan | Pub/sub por `tipo:id`; al reconectar se refrescan todas (lo que pasó con el socket pausado no se pierde). Un 404 dice «ya no está», no «reintentar» | app `tarjetasVivas.ts` (+5 tests), `useTarjetaViva.ts`, `socketClient.ts`, `EncuestaEnElChat`, `EventoEnElChat`, `RecordatorioEnElChat` |
| Editar el recordatorio del grupo | Un admin toca la tarjeta en el chat o la fila en el detalle del grupo y se abre el editor lleno: título, descripción, cuándo, repetir e imagen (ver, cambiar o quitar). Para los demás, la tarjeta no responde al toque. La lista del detalle también va en vivo | app `accionesDeTarjeta.tsx` (contexto), `CrearDesdeElChat` (`QueSeCrea`), `RecordatoriosDelGrupo`, `CreateReminderScreen`, `ImagenDeRecordatorio`, `guardarRecordatorio.ts` (`editarRecordatorio`, +5 tests); server `DELETE /reminders/:id/imagen` (+2 tests) |

**E2E en el emulador (19/10):** «QA Ana» vota desde el server y la encuesta
cambia sola; editar el recordatorio tocando la tarjeta («QA Agua 2L») la
actualiza en el acto; Ana borra su encuesta y la tarjeta dice «ya no está»;
desde el detalle del grupo el editor abre lleno. QA en cero.

**Encontrado al probar (no es de FL16):**
- En desarrollo, dos «r» seguidas tecleadas por `adb` con el foco fuera del
  campo recargan la app (atajo de React Native): para el E2E, verificar el foco
  antes de escribir. No pasa en release.
- **«AudioRecorder.constructor rejected: the current activity is no longer
  available»**: la barra de escribir crea la grabadora al montarse
  (`useGrabadorDeVoz`); si el chat se monta mientras la actividad se recrea, la
  pantalla entera cae con un error de render. Visto tras una recarga de
  desarrollo; en release sería un cierre. **Arreglado:** el grabador se crea
  recién al grabar (`useGrabadorDeVoz` + `opcionesDeGrabacion.ts`, +3 tests) y
  ese fallo pasa a «No se pudo grabar». Falta grabar una nota en el emulador
  antes de publicar.

## 54. Lilachat Web como WhatsApp Web — plan W0–W8 (19/10/2026)

José, 19/10: «enfoquémonos en Lilachat web (similar a WhatsApp Web) con todas
nuestras acciones… fluidez, fácil de usar, intuitivo, robusto y escalable…
PWA con modo offline… incluye E1–E4… escaneo de código QR con la app…».

**Ingeniería inversa: no.** `morluto/rea` sirve para analizar binarios y
webs. Usarlo sobre WhatsApp Web es extraer código de Meta, y sus términos lo
prohíben. El diseño sale del comportamiento observable y del *WhatsApp
Security Whitepaper* público (vinculación de dispositivos). REA queda para
auditar apps NUESTRAS.

### 54.1 Lo que hay hoy (auditoría, con evidencia)

La web de F6 lee y escribe, pero es un prototipo de un solo archivo:

| Hallazgo | Evidencia |
| --- | --- |
| Todo el estado vive en `App.tsx` (486 líneas): chats, mensajes, socket, overlays, ajustes | `web/src/App.tsx:45-82` |
| Solo texto y archivos: sin responder, editar, borrar, reenviar, reaccionar, fijar, menciones, notas de voz, vista previa de enlaces, mensajes largos | `web/src/App.tsx:243-299`, `chat/Composer.tsx` |
| Llamada y videollamada dibujadas e inertes | `chat/Conversation.tsx:2,23` |
| Sin detalle de chat ni de grupo, sin borradores, sin recordatorios del grupo | — |
| Caché en `localStorage` (tope ~5 MB, síncrono, bloquea el hilo) | `chat/cacheLocal.ts` |
| Envío sin cola: sin socket, el optimista queda «pendiente» para siempre | `App.tsx:264-281` |
| Listas sin virtualizar: un grupo con 5 000 mensajes pinta 5 000 nodos | `chat/Conversation.tsx` |
| JWT **y secreto del dispositivo** en `localStorage`: un XSS se lleva la sesión para siempre | `api.ts:39-46` |
| SW solo de push: no hay PWA instalable ni offline (sin manifest, sin íconos) | `public/sw.js:1-7`, `index.html` |
| Avisos con `icon-192.png` que no existe | `public/sw.js:22` |
| Ajustes = un menú flotante con dos botones | `App.tsx:450-484` |
| Sin atajos de teclado, sin arrastrar y soltar, sin pegar imágenes | — |
| Ingreso solo por código; no hay vinculación por QR | `auth/AccessScreens.tsx` |
| Sin título con no leídos ni insignia de la app instalada | — |

Lo que sí sirve y se conserva: sesión con renovación por secreto (`api.ts`,
§26.1), socket único por sesión (`useSocket.ts`, §30), `mergeIncoming` por
`clientKey`, Web Push VAPID del server (`pushRoutes.ts`, `pushSender.ts`), y
los motores de `shared/` (outbox, filtros, menciones, formatos, llamada).

### 54.2 Respuestas a las preguntas de José

**¿Funcionan las notificaciones push en la PWA?** Sí, con Web Push (VAPID),
que el server ya tiene.
- Chrome, Edge y Firefox (Windows, Mac, Linux, Android): llegan con la
  pestaña cerrada mientras el navegador esté abierto.
- Mac con Chrome cerrado del todo: no llegan. Al volver a abrirlo, la web se
  pone al día.
- iPhone y iPad (iOS 16.4+): solo si la web está **instalada** en la pantalla
  de inicio. En Safari suelto, no.
- El permiso se pide al tocar «Activar notificaciones», nunca al entrar.

**¿Y las llamadas?** Sí, voz y video 1:1, con WebRTC del navegador.
- Misma señalización que la app (Socket.IO) y el mismo TURN de Cloudflare.
  No hace falta nada nuevo en el server.
- Con la web abierta: suena y se contesta en la web.
- Con la web cerrada: llega un aviso «Llamada de…». Al tocarlo se abre y se
  contesta si sigue sonando (30 s, `llamadas.ts`).
- Límite honesto: no suena como un teléfono con todo cerrado. En iPhone, la
  llamada web solo funciona en primer plano.
- Extra de escritorio: compartir pantalla (`getDisplayMedia`).

**¿Escanear un QR con la app, como WhatsApp Web?** Sí. Diseño en §54.4.

**¿Compartir chats públicos?** Enlaces de invitación: sí, con candados.
Lectura pública sin cuenta: todavía no. Detalle en §54.5.

### 54.3 Arquitectura de la web nueva

- **Local-first, como WhatsApp Web.** IndexedDB es la fuente de la verdad de
  la pantalla. El socket y la sincronización escriben en la base; la UI lee de
  la base con consultas vivas. Abrir un chat es leer local: cero espera.
  Librería: **Dexie 4** (Apache-2.0, gratis) con `liveQuery`.
- **Cola de mutaciones** (`web-app-blueprint` §4): el motor de
  `shared/outbox.ts` (el mismo de la app) + store en IndexedDB + drenado con
  candado al volver la red o el socket. Cada envío lleva su `clientKey`.
  Fotos, archivos y notas de voz entran a la cola como `Blob`.
- **Listas virtualizadas** con `@tanstack/react-virtual` (MIT): lista de chats
  y conversación con ancla abajo. 10 000 mensajes cuestan lo mismo que 30.
- **Sesión endurecida.**
  - El secreto del dispositivo pasa a una cookie `HttpOnly; Secure;
    SameSite=Strict`, con `Path=/api/auth`. JavaScript ya no lo ve.
  - El JWT vive solo en memoria y se renueva con esa cookie.
  - CSP estricta desde Express: `script-src 'self'`, sin `eval`.
  - Cerrar sesión borra IndexedDB, cachés y la suscripción push.
  - Si el teléfono revoca la web, el socket avisa `session.revoked` y la web
    se borra sola.
- **Estado de UI**: un store chico con `useSyncExternalStore` (sin librería).
  El chat abierto va en la URL (`/c/<chatId>`), así sirven atrás/adelante y el
  aviso abre el chat correcto.
- **Componentes**: primitivas Radix (MIT) estilo shadcn sobre los tokens
  Vivid Pulse de `shared/tokens`. Íconos `lucide-react`. Claro y oscuro.
- **Archivos ≤600 líneas.** `App.tsx` se parte en shell, store, sync y
  pantallas.

### 54.4 Vincular por QR (sin código, como WhatsApp Web)

**Decisión (no evidente):** los dispositivos vinculados los autoriza el
teléfono y son de Lilachat, no de constroad-auth. constroad-auth sigue siendo
la identidad del teléfono (OTP). Así no hace falta tocar otro repo, y es el
modelo de WhatsApp: el teléfono principal autoriza a los acompañantes.

Flujo:
1. La web pide `POST /api/link/start` (sin sesión, con límite por IP). El
   server crea una vinculación con un token de 32 bytes al azar. Guarda solo su
   hash y vence a los 60 s. La web muestra el QR y lo **rota cada 20 s**.
2. El QR lleva `https://lilachat.constroad.com/v/<token>`. La cámara del
   teléfono también lo abre (App Link → la app).
3. En la app: Ajustes → **Dispositivos vinculados** → «Vincular un
   dispositivo» → cámara (`expo-camera`, MIT). La app muestra «¿Vincular
   Chrome en macOS?» y pide el desbloqueo del teléfono
   (`expo-local-authentication`).
4. La app manda `POST /api/link/approve {token}` con SU sesión. El server
   comprueba token vigente, sin usar y del mismo origen; crea el dispositivo
   vinculado con su secreto (hash en `linkedDevices`) y avisa a la web por el
   socket de la vinculación.
5. La web canjea con `POST /api/link/claim` y recibe la cookie del secreto
   más un JWT. El token queda quemado.
6. Todos los dispositivos del usuario reciben «Se vinculó Chrome en macOS».

Candados: un solo uso; 60 s; el QR no sirve sin el teléfono desbloqueado; la
lista de vinculados muestra nombre, último uso y «Cerrar sesión». Revocar corta
el socket en el acto. Máximo 4 vinculados, como WhatsApp. El ingreso por código
sigue como alternativa («Entrar con número de teléfono»).

**Chats secretos:** la web no los lee hasta tener un sobre por dispositivo
(pendiente de F9). Se muestran con candado y «Este chat secreto se lee en tu
teléfono». El QR ya transporta la clave pública de la web para ese paso.

### 54.5 Compartir chats: enlaces de invitación seguros

Recomendación: **enlace de invitación a grupos y canales, sí. Página pública
legible sin cuenta, no por ahora.**

Enlace de invitación (`/i/<token>`):
- Token de 128 bits al azar, guardado como hash. Adivinarlo es inviable.
- Solo un admin lo crea, lo copia, lo **restablece** (el viejo deja de
  servir) o lo apaga.
- Vence a elegir (1 h, 1 día, 7 días, nunca) y con tope de usos.
- Opción «Aprobar a cada uno»: quien entra queda en una lista de solicitudes
  hasta que un admin lo acepta.
- La vista previa muestra nombre, foto y cantidad de miembros; nunca los
  teléfonos ni los mensajes.
- Quien entra por enlace no ve los teléfonos de quienes no son sus contactos:
  ve nombres.
- Límite de intentos por IP y por usuario. Todo queda en la bitácora del
  grupo: quién creó, quién entró y por qué enlace.
- **Nunca compartibles**: chats directos, chats secretos y borradores.

Página pública sin cuenta (estilo `t.me/s/canal`): el riesgo es filtrar
información de una empresa e indexarla. Si hace falta, va después como «Canal
de difusión público» explícito: solo admins publican, `noindex` por defecto y
un aviso claro al crearlo. No se construye sin un pedido concreto.

### 54.6 Fases

Ciclo de siempre: test primero → implementar → E2E en el navegador real →
as-is. Cada fase se publica sola. Antes de cada pantalla nueva, su diseño de
Stitch (escritorio 1440, tablet y móvil 390), que hoy solo existe para la
lista y la conversación (`web-claro.png`, `nexchat-web-oscuro.png`).

| Fase | Qué | Depende de |
| --- | --- | --- |
| **W0** | Diseños Stitch de las pantallas nuevas; sesión endurecida (cookie `HttpOnly`, JWT en memoria, CSP); manifest con íconos 192/512/maskable y tarjeta para WhatsApp | — |
| **W1** | Núcleo local-first: Dexie + sincronización por cursor + cola de mutaciones + listas virtualizadas; `App.tsx` partido; URL `/c/<chatId>`; título «(3) Lilachat» e insignia de la app | W0 |
| **W2** | Paridad de mensajes: responder, editar, borrar para mí y para todos, reenviar, reaccionar, fijar, info de lectura, @menciones, enlaces con tarjeta, «Leer más», notas de voz (`MediaRecorder` + onda), fotos y archivos con arrastrar, pegar y pie de foto, visor, emojis | W1 |
| **W3** | Paridad de chats: filtros Todos · No leídos · Grupos · Borradores, archivar, silenciar, fijar chat, borrar para mí; detalle de chat y de grupo (nombre, foto, miembros, admins, salir); borradores; agenda, encuestas, eventos y recordatorios del grupo; Lila (Ponme al día, respuesta automática, programados); ajustes completos | W1 |
| **W4** | PWA: SW a mano (≤100 líneas), cache-first solo de lo que tiene hash, navegación con timeout y caída al shell; instalable; aviso «Hay una versión nueva · Recargar»; envío y lectura sin red | W1 |
| **W5** | Vincular por QR (§54.4): endpoints, pantalla QR que rota, escáner y «Dispositivos vinculados» en la app (exige APK nuevo con `expo-camera`) | W0 |
| **W6** | Llamadas WebRTC 1:1 en la web: voz, video, compartir pantalla, contestar desde el aviso | W1 |
| **W7** | Atajos como WhatsApp Web (nuevo chat, buscar, siguiente chat, ↑ editar el último), paleta ⌘K, enlaces de invitación seguros (§54.5) en app y web | W3 |
| **W8** | E1–E4 en la web, junto con la app: E1 consola del espacio (directorio, roles, desactivar), E2 canales en la barra lateral, E3 hilos en un tercer panel a la derecha, E4 comandos `/` con autocompletado, botones de bots y webhooks | E1–E4 del server |

La web es el mejor lugar para la administración de E1 y E4 (escritorio
primero), así que esas consolas pueden salir en la web antes que en la app.

**Fuera de alcance por ahora:** leer chats secretos en la web, llamadas
grupales, stickers y GIFs (§53), página pública sin cuenta.

### 54.7 W1 — núcleo local-first (19/10/2026, publicado con 0.1.99)

Hecho, con 80 tests de la web en verde (eran 15):

| Pieza | Qué | Dónde |
| --- | --- | --- |
| Base local | Dexie, una base por usuario (`lilachat-<userId>`): `chats`, `mensajes` (`[chatId+seq]`, solo lo confirmado), `cola` (`clientKey`), `meta`. Página conciliada con `conciliarPagina`; eco que pisa la misma fila; lápida y edición | `web/src/local/baseLocal.ts`, `mensajesLocales.ts` |
| Cola | Motor de `shared/outbox.ts` sobre IndexedDB, drenado con candado por base; reintento al volver la red, la pestaña o el socket, nunca con la pestaña oculta | `local/colaDeEnvio.ts`, `sync/useSincronizacion.ts` |
| Sincronización | `sync.pull` por cursor al conectar (sin nada guardado no pide: el server mandaría todo); acuse de `msg.send` traducido igual que la app | `sync/sincronizar.ts`, `sync/envioPorSocket.ts` |
| Pantalla | Consultas vivas (`dexie-react-hooks`); lista ordenada con `ordenarChats` y sin archivados; conversación **virtualizada** (`@tanstack/react-virtual`), pegada al final, página anterior al acercarse arriba sin saltos; «No se envió · Reintentar · Borrar» | `local/useBaseLocal.ts`, `chat/ListaDeMensajes.tsx`, `BurbujaDeMensaje.tsx`, `filasDeLaConversacion.ts` |
| Shell | `App.tsx` (486 líneas) → puerta + `Shell.tsx` + `useSesion`; chat en la URL (`/c/<id>`, entiende `?chat=`); «(N) Lilachat» e insignia de la app | `Shell.tsx`, `sesion/useSesion.ts`, `chat/useChatDeLaUrl.ts`, `tituloDeLaPestana.ts` |
| Caché vieja | La de `localStorage` (historial en claro, tope 5 MB) se borra al arrancar | `chat/cacheLocal.ts` |

**Defecto encontrado:** la web leía `createdAt`, que el server nunca mandó
(es `at`): la hora y el chip del día salían vacíos desde F6. Los tipos se
copiaron del server (`chat/types.ts`).

**E2E en el navegador (19/10, server local sin crons):** entrar por código;
lista y chat desde la base; abre abajo; 120 mensajes con 32 nodos en el DOM;
páginas anteriores sin saltos; enviar (✓); entrante abajo lo sigue y se marca
leído; **sin server**: el mensaje queda con reloj, sobrevive a recargar la
pestaña y sale solo al volver, una sola vez en la base; 375 px sin desborde;
cerrar sesión borra la base. QA en cero.

**Pendiente de W1:** virtualizar la lista de chats; nombre del autor en los grupos
(hoy no sale, tampoco antes); «escribiendo» guarda el `userId`, no un nombre;
qué mostrar si el navegador no deja usar IndexedDB.

### 54.8 W0 — sesión endurecida, instalable y con tarjeta (19/10/2026, publicado con 0.1.99)

| Pieza | Qué | Dónde |
| --- | --- | --- |
| Cookie del dispositivo | Con `cliente: 'web'`, el canje y la renovación ponen `lilachat_dispositivo` (`HttpOnly; SameSite=Strict; Path=/api/auth`, `Secure` por HTTPS, 400 días) y el secreto NO viaja en el cuerpo. `/session` renueva con la cookie sola; una sesión vieja con el secreto en el cuerpo se muda a la cookie; revocada (401) la borra; sin respuesta (503) la deja. `POST /auth/salir` la borra y le quita el aviso a ese navegador. La app no cambia | server `cookieDeDispositivo.ts` (+4 tests), `authRoutes.ts` (+7 tests) |
| JWT en memoria | En `localStorage` solo el perfil (quién soy, id del navegador). Sin red al abrir: sin JWT, la pantalla sale de la base y la sesión se renueva sola al volver la red | web `api.ts`, `sesion/useSesion.ts`, `auth/AccessScreens.tsx` |
| CSP y cabeceras | `script-src 'self'` sin `eval`, `object-src 'none'`, `frame-ancestors 'none'`, socket al mismo host, fotos y audios por https; `nosniff`, `Referrer-Policy`, `X-Frame-Options`. Solo en lo que sirve la web, no en `/api` | server `cabecerasDeSeguridad.ts` (+3 tests), `app.ts` |
| Instalable y tarjeta | `manifest.json` con íconos 192/512 y enmascarable (el logo al 80 % para que el círculo no lo corte), `apple-touch-icon`, metas `og:*` con imagen absoluta 1200×630; el aviso del SW usa el ícono real y abre `/c/<id>` | web `public/manifest.json`, `public/icons/*`, `index.html`, `public/sw.js` |

**E2E (19/10, web compilada servida por el server local):** cabeceras y
tarjeta con `curl -A WhatsApp`; entrar por código → en `localStorage` solo
perfil e id, la cookie invisible a JavaScript; recargar entra solo con la
cookie y sin errores de CSP (fuentes, fotos y socket); cerrar sesión → la
renovación da 401, sin perfil ni base local. QA en cero.

**Los tests de pantalla no tenían IndexedDB:** pasaban con errores sueltos de
Dexie. `fake-indexeddb/auto` va en `src/test/setup.ts`.

**Una vez, en la suite completa del server, falló «un admin le cambia título,
descripción y hora»** y no se repitió en nueve corridas. Si vuelve, mirar la
hora del `startsAt` contra el reloj.

### 54.9 W2 — paridad de mensajes (19/10/2026, publicado con 0.1.99)

**Motores que pasaron de la app a `shared`** (web y app con las mismas
reglas): `accionesDeMensaje`, `mensajeLargo`, `textoDelComposer` (menciones al
escribir), `enlaces` (links, correos y celulares tocables), `ondaDeVoz` y
`colorDeAutor`. La app ahora resuelve `@lilachat/shared` al fuente también en
sus tests (`app/vitest.config.ts`); antes leía `shared/dist` y un motor nuevo
daba «is not a function».

| Qué | Dónde (web) |
| --- | --- |
| Menú por mensaje como WhatsApp Web (flecha al pasar el mouse o con foco): Responder, Copiar, Reenviar, Editar (15 min), Info, Eliminar (para todos solo lo propio; para mí oculta en este navegador) | `MenuDelMensaje`, `useAccionesSobreMensajes`, `DialogosDelMensaje`, `local/ocultos.ts`, `sync/envioPorSocket.ts` (`msg.edit`/`msg.delete` con acuse) |
| Franja «Respondiendo a…» y «Editando» sobre el campo; Escape sale | `Composer` (`ContextoDelComposer`) |
| Autor con su color en grupos, cita de la respuesta, @menciones con el nombre que ve cada uno («@Tú») y al escribir (flechas, Enter, Tab) | `BurbujaDeMensaje`, `TextoDelMensaje`, `SugerenciasDeMencion`, `useMencionesDelCampo`, `useDetalleDelChat` |
| Tarjeta del enlace en la burbuja y al escribir; links tocables; «Leer más» | `useVistaPrevia`, `TarjetaDeEnlace`, `VistaPreviaAlEscribir` |
| Fotos y archivos: elegir varios, arrastrar y soltar, pegar capturas; vista previa con pie; medidas de la foto; visor a pantalla completa con flechas y Escape | `EnviarArchivos`, `VisorDeFotos`, `mediaUpload` (pie, medidas, duración y onda **separada por comas**, como lee el server) |
| Notas de voz: grabar con `MediaRecorder` (permiso al tocar), onda con el motor compartido, reproducir con avance | `useGrabadoraDeVoz`, `nivelDeAudio`, `BarraDeGrabacion`, `NotaDeVoz` |
| Emojis nativos en español, cargados recién al abrir el panel | `PanelDeEmojis` (`emoji-picker-react` 4.22.3, MIT) |
| «Escribiendo» al tipear (regla de la app) y «Ana está escribiendo…» en grupos | `useSincronizacion` (`avisarEscribiendo`) |
| Chat secreto: la web no lo escribe (saldría en claro): aviso en lugar del campo | `Conversation` |
| Librerías en piezas propias para que el navegador las guarde entre versiones | `vite.config.ts` (`manualChunks`, sin los íconos) |

**E2E (19/10, web compilada con CSP, server local):** autores con color,
«Leer más», tarjeta y link, «@Tú»; responder (cita en la burbuja), editar
(«Editado»), eliminar para todos (lápida sin cita, el server vacía el texto) y
para mí (oculto); reenviar solo a «QA Web3» (verificado en la base); Info;
copiar; mención al escribir (rango guardado en la base); foto con pie, visor y
la lista que sigue abajo; panel de emojis; chat secreto sin campo; micrófono
bloqueado → aviso, sin romperse; un audio sintético subido se reproduce. QA en
cero. **Sin probar:** grabar con un micrófono real (el panel del navegador lo
bloquea) — falta en Chrome.

**Lo que encontró el E2E:**
- El menú de Radix, al cerrarse, devolvía el foco a su flecha: lo tecleado tras
  «Responder» iba a la flecha y el Enter reabría el menú. Ahora el menú no es
  modal y no devuelve el foco.
- Al crecer una fila (una foto), el navegador mueve el scroll y eso se leía
  como «subió a leer»: la lista dejaba de seguir el final. Ahora solo un gesto
  de la persona (rueda, toque, tecla) la despega (`sigueEnElFinal`), igual que
  en la app; y si la lista se achica (panel de emojis) sigue abajo.
- La lápida mostraba la cita de arriba; ahora no.
- El portapapeles del panel está bloqueado por política: se agregó el respaldo
  clásico (`copiarTexto`).
- Los emojis recientes de la librería quedaban al cerrar sesión: se borran
  (solo al salir, no al abrir).

**Pendiente de W2:** reacciones (no existen en el server); la duración de un
audio subido como archivo (no como nota) sale 0:00.

## 53. FL15 — barra como WhatsApp, borradores, recordatorios del grupo, novedades, mensajes largos (19/10/2026, 0.1.98)

José, 19/10: la barra de WhatsApp (emoji adentro a la izquierda, clip y cámara
adentro a la derecha, micrófono afuera); «chatear conmigo mismo, crear
borradores y nombrarlos» (respuesta: chats contigo con nombre, en una categoría
de arriba); «recordatorios grupales que vivan en el grupo, solo los admins, con
descripción, imagen»; «al haber una actualización, mostrar las novedades y recién
ahí descargar»; «los mensajes largos deberían poder colapsarse».

| Pedido | Qué se hizo | Dónde |
| --- | --- | --- |
| Barra | Se fue el «+» de afuera (era la misma puerta que el clip). El clip queda siempre adentro; la cámara, solo con el campo vacío. Stickers y GIFs, después (José eligió emojis ahora) | `Composer` |
| Borradores | Chat `notas`: solo yo, con nombre, nunca cifrado; varios, uno por tema. «Nuevo borrador» en Nuevo chat; chip «Borradores» con su cuenta; ícono propio en la lista; cabecera «Solo tú lo ves»; detalle con nombre y foto editables, sin participantes ni avisos | server `POST /api/chats` (`kind: 'notas'`), `editarInfoDeGrupo`; shared `filtrarChats`/`contarChats`; app `NewChatScreen`, `BuscadorDeChats`, `FilaDeChat`, `ChatScreen` (`esBorrador`), `ChatDetailScreen` |
| Recordatorios del grupo | Los crea un admin desde el clip («Recordatorio del grupo»), con descripción e imagen (16:9). Se publican en el chat como tarjeta (`ref: recordatorio`, `kind: 'reminder'`), a la hora le suenan a TODOS con «Grupo · título», se listan en el detalle del grupo y los borra un admin. No aparecen en la agenda personal | server `recordatoriosDeGrupo.ts` (permisos, `GET /reminders/del-chat/:chatId`, `GET /reminders/:id`, `POST /reminders/:id/imagen`), `eventRoutes`, `reminderCron`; app `CreateReminderScreen` (`grupo`), `ImagenDeRecordatorio`, `RecordatorioEnElChat`, `RecordatoriosDelGrupo` |
| Novedades | `lila apk publish --notes=<archivo>` sube las notas; LilaStore devuelve las de cada versión posterior con `min-version?desde=`; «Actualizar» abre «Novedades» y la descarga sale de ahí (también desde Ajustes) | LilaStore `minVersionRespuesta`; app `novedades.ts`, `NovedadesDeLaVersion`, `useActualizacionesDeLaApp` |
| Mensajes largos | Más de 700 caracteres o 15 líneas: cortado en una palabra con «… Leer más»; «Ver menos» lo vuelve a cerrar. Se recuerda por mensaje (la lista recicla celdas) | `mensajeLargo.ts`, `TextoDelMensaje` |

**Release:** las notas de 0.1.97 se publicaron con `--notes`. Desde ahora cada
release lleva su archivo de novedades, escrito para quien usa la app.

### 53.1 Lo que encontró el E2E en el emulador (19/10)

Verificado: barra (vacía y con texto), «Leer más / Ver menos», novedades
desde la banda (con el `versionCode` real del APK instalado), borrador
(crear, mandar, chip con cuenta, ícono), recordatorio del grupo con imagen
(tarjeta, lista en el detalle, borrar). Dos defectos, con su causa:

| Defecto | Causa | Arreglo |
| --- | --- | --- |
| La tarjeta del recordatorio salía **sin la imagen**, en el teléfono de todos, hasta reabrir el chat | el chat se publicaba al CREAR; la tarjeta se pedía en ese instante y la imagen llegaba un request después | con imagen, la app crea con `publicar: false`, sube y llama `POST /reminders/:id/publicar` (idempotente y atómico por `publicadoEn`; si publicar falla, suelta la marca). Publica aunque la imagen falle. `guardarRecordatorio.ts` + 4 tests de server |
| El chat **no quedaba abajo**: al crecer una tarjeta (~300 dp al cargar la imagen) y al abrir en frío (1 de cada 3) | los eventos de scroll que produce la propia lista al acomodarse traían posiciones viejas (8 dp con 916 de contenido) y se leían como «lejos»; además `scrollToEnd` en el mismo evento de tamaño no hace nada | `PosicionEnLaLista` pasa a **pegada al final**: abre pegada y solo un ARRASTRE del dedo la despega (`onScrollBeginDrag`/`onMomentumScroll*`); pegada, si lo de abajo crece, baja un cuadro después. 3 de 3 aperturas en frío abajo; entrante abajo lo sigue; arriba se queda con «⌄ 1» |

También: la cabecera del borrador muestra la libreta, como la lista.

**Pendiente (no es de FL15):** las tarjetas del chat (encuesta, evento,
recordatorio) se piden al montar y no se enteran de cambios: un voto, una
edición o un borrado se ve recién al reabrir el chat («Este recordatorio ya no
está»). Hace falta un aviso por socket (`ref.cambio {tipo, id}`) que las
refresque.

## 52. FL14 — emojis, @menciones, tarjeta al escribir, ver la foto, renombrar (19/10/2026, sin publicar)

José, 19/10: «la tarjeta no se muestra cuando estamos escribiendo la url», «al
tocar la foto de perfil no me permite verla, solo seleccionar otra», «no hay un
botón de emojis como en WhatsApp», «al cambiar el nombre de un grupo el teclado
se pierde», «en un grupo no puedo taggear un contacto con @».

| Pedido | Qué se hizo | Dónde |
| --- | --- | --- |
| Emojis | Botón dentro de la píldora (alterna con el teclado) y panel en el lugar del teclado: recientes guardados, categorías y buscador en español, colores del tema. ATRÁS lo cierra. `rn-emoji-keyboard` 1.7.0 (MIT, sin nativo); su aviso de `InteractionManager` se silencia en desarrollo | `PanelDeEmojis`, `Composer`, `index.ts` |
| @menciones | Al escribir «@» en un grupo salen los miembros (con foto); elegir completa «@Nombre ». Viaja el texto MÁS `menciones: [{userId, desde, largo}]`; el server guarda solo las válidas (`validarMenciones`: miembros, dentro del texto, sobre un «@», sin superponerse, máx. 20) y las quita al editar. Cada teléfono la dibuja con SU nombre para esa persona; a mí, «@Tú». Al mencionado le suena aunque haya silenciado el grupo | `shared/menciones`, `useMenciones`, `SugerenciasDeMencion`, `TextoDelMensaje`, `buildOutboxItem`, `chatService.sendMessage`, `pushService` |
| Tarjeta al escribir | Arriba de la barra, 600 ms después de dejar de tipear, con X para quitarla; misma caché que la burbuja (`useVistaPrevia`). No en chats secretos. La barra solo se redibuja si el texto parece un link | `VistaPreviaAlEscribir`, `useVistaPrevia` |
| Ver la foto | Tocar tu foto en Ajustes la abre entera con «Cambiar» y «Quitar»; la cámara la cambia directo. En el detalle, tocar la foto de un chat la muestra; la cámara del grupo la cambia | `ui/VisorDeFoto`, `PerfilAjuste`, `IdentidadDelChat` |
| Renombrar el grupo | La causa: `autoFocus` dentro del modal tomaba el foco antes que la ventana y Android no abría el teclado (emulador: cursor titilando, `mInputShown=false`). El foco va 350 ms después de `onShow` (lo que dura el fundido; con 60 no alcanzaba) y la hoja sube con el teclado | `EditarNombreDeGrupo` |

**Bug encontrado al probar (existía desde FL12):** un borrador restaurado que
se enviaba sin tocarlo quedaba en el campo: el nativo ignoraba el `clear()` de
un campo nacido de `defaultValue`. Enviar ahora vacía y remonta el campo, con el
teclado si lo tenía. Insertar un emoji o completar una mención también remonta
(un `value` controlado por un render dejaba el mismo problema).

**Otros:** el placeholder pasa a «Mensaje», como WhatsApp (con el emoji adentro
«Escribe un mensaje» se partía en dos líneas). `ChatScreen` bajó de 629 a 597
líneas (`useDibujarFila`; los mencionables salen de `useGrupo`).

**E2E (emulador con el teclado en pantalla forzado):** panel de emojis abierto
tras cuatro emojis; borrador + emojis + enviar deja el campo vacío; «@an» →
QA Ana con el teclado abierto → enviado con su rango; «@Tú» en la mención de
Ana; tarjeta de El Comercio al escribir y en la burbuja; foto propia y ajena a
pantalla completa; renombrar abre el teclado 3 de 3 y guarda.

**Lilachat Empresa (§47):** las @menciones de grupo son el primer pedazo de E3.
Los comandos con `/`, Lila como bot y los botones en el chat son E4; E1–E5
siguen sin empezar.

## 51. «Invitar» daba 500 y la tarjeta de los enlaces (18/10/2026, sin publicar)

José, 18/10, con capturas: «el invitar en esas pantallas ya no funciona», «el
buscar contacto busca pero el botón invitar no hace nada» y «cuando comparto un
link en un chat no genera la tarjeta como sí lo hace WhatsApp con el SEO».

### 51.1 Invitar

- **La causa** estaba en la base, no en el código: `invitations` tenía un
  `email_1` único SIN `sparse`. Con UNA invitación sin correo, ninguna otra sin
  correo podía entrar (`E11000 … dup key: { email: null }` → 500 «Algo falló de
  nuestro lado»). Se reprodujo contra la base y en el log del server de QA.
- **El arreglo de la base** es `scripts/fix-indexes.ts --apply`, que ahora cubre
  `users` e `invitations` y crea el índice `sparse` él mismo: en la bóveda no hay
  `autoIndex`. El esquema declara el índice para que la base en memoria sea igual
  (`contactRoutes.test.ts` lo prueba con `syncIndexes`).
- **«No hace nada» en Nuevo chat:** el aviso salía al pie de la lista, fuera de
  la pantalla. Ahora `useInvitar` (uno solo para «Invitar» y «Nuevo chat»)
  muestra el progreso en el botón, no acepta otro toque mientras viaja y deja el
  motivo debajo de la fila tocada (`textoDeInvitacionFallida`).

### 51.2 Vista previa de enlaces

- **Server:** `GET /api/enlaces/vista-previa?url=` (`vistaPreviaRoutes.ts`) con
  sesión, freno de 60 por minuto por usuario, caché de 500 tarjetas (24 h; una
  hora si la página no dio tarjeta) y una sola salida por enlace aunque lo pida
  todo el grupo a la vez.
- **SSRF** (el server vive en la mini junto a la bóveda y Torre): solo http(s)
  en los puertos 80/443, sin credenciales ni nombres internos; el DNS de la
  conexión rechaza toda IP privada, reservada o de la máquina, y cada
  redirección (hasta 3) se valida de nuevo (`traerVistaPrevia.ts`,
  `vistaPrevia.ts`). 5 s de plazo; se lee hasta `</head>` o 1,5 MB (YouTube pone
  `og:title` pasados los 750 KB).
- **Parser puro** `leerMetadatos`: `og:` → `twitter:` → `<title>`/`description`;
  imagen absoluta y solo http(s); textos recortados.
- **App:** `VistaPreviaDeEnlace` dentro de la burbuja, sobre el texto, con el
  PRIMER link (`primerEnlace`). Imagen ancha arriba; un ícono o logo cuadrado va
  chico al costado, como WhatsApp. Caché por enlace en memoria. **Los chats
  secretos no la piden**: el server no tiene que ver sus enlaces.
- La imagen la baja cada teléfono desde la página (no pasa por el server).
- **E2E (emulador, server de QA):** LilaStore, El Comercio y YouTube con
  tarjeta; un dominio que no existe, sin tarjeta; `MessageRow` bajó a 567 líneas
  (la tarjeta de archivo salió a `TarjetaDeArchivo`).

## 50. Encuestas y eventos en el chat, contadores y el recordatorio doble (18/10/2026)

José, 18/10, tres reclamos sobre la 0.1.92/0.1.93:

**1. «Llegaron 2 mensajes a la misma hora».** El recordatorio «Hacer ejercicios»
sonó dos veces. `reminderCron.pushTo` juntaba los tokens de todos los devices
de la persona sin quitar repetidos, y el mismo teléfono figuraba en dos devices
(reinstalar deja el viejo con el mismo token). Es el mismo problema que FL11
arregló para los mensajes con `repartirPorToken`; este camino había quedado
afuera.
- Arreglo: tokens únicos en `pushTo`, y también en el transporte de FCM
  (`enviarA`), para que ningún camino vuelva a mandar dos veces al mismo token.
- Test: dos devices con el mismo token dan un solo envío.

**2. «Creé una encuesta desde el chat de Wilson y nunca se envió al chat».**
La encuesta y el evento se guardaban, pero el chat no se enteraba.
- Ahora crear una encuesta o un evento desde un chat publica un mensaje ahí
  (`publicarEnElChat`): `kind: 'poll' | 'event'` y `ref: { tipo, id }`.
- Es un mensaje más: toma su `seq`, llega por el socket y con push, y la lista
  de chats lo muestra con su ícono (`resolveChatPreview`: encuesta y evento).
  El `clientKey` sale del id, así que un reintento no duplica.
- En la conversación se dibuja como tarjeta (`TarjetaDelChat`):
  - la encuesta (`EncuestaEnElChat`) se vota ahí mismo, con la misma tarjeta y
    las mismas acciones que la pestaña (`useAccionesDeEncuesta`, que salió de
    `PollsScreen`);
  - el evento (`EventoEnElChat`) muestra qué, cuándo y dónde, y deja confirmar
    con «Voy» o «No voy».
- Rutas nuevas: `GET /api/agenda/polls/:id` y `GET /api/agenda/events/:id`.
  Quien no ve la encuesta o el evento recibe 404, para no confirmar que existe.
- Si publicar falla, lo creado queda y se registra: no se tumba la creación.

**3. «No hay un contador en los tabs».**
- **Barra:** Agenda cuenta los eventos que vienen y no respondí; Encuestas, las
  encuestas abiertas sin mi voto. Lo propio no cuenta.
  - Sale de `GET /api/agenda/pendientes`: dos `countDocuments` en paralelo.
  - Hook `usePendientesDeAgenda`, sin polling. Se refresca:
    - al llegar un mensaje de encuesta o de evento;
    - al cambiar de pestaña y al volver de un chat;
    - al votar.
- **Segmentos de Agenda:** «Eventos N» (los que vienen) y «Recordatorios N»
  (activos), como los chips de la lista de chats.

**E2E (emulador, QA Ana):**
- Ana crea una encuesta y un evento: los dos llegan al chat como tarjetas, la
  lista los muestra con su ícono y aparece «1» en Agenda y en Encuestas.
- Votar y responder ahí mismo funciona, y los contadores vuelven a cero al
  volver a la lista.
- El aviso local mostraba «📎 Archivo» para estos tipos: `armarAviso` ahora usa
  su texto.

## 49. Auditoría de fluidez contra WhatsApp (18/10/2026) — plan FL12

Pasada de solo lectura sobre el código, archivo por archivo. El informe
completo quedó en el scratchpad de la sesión; acá va lo que se ataca, por
impacto en lo que se SIENTE.

| # | Qué se siente | Causa (archivo) | Arreglo |
| --- | --- | --- | --- |
| 1 | El teclado tapa los últimos mensajes mientras sube | `KeyboardAvoidingView` re-mide la lista en cada frame (`ChatScreen.tsx`) | `KeyboardChatScrollView` como `renderScrollComponent` + `KeyboardStickyView` (ya instalado, 1.21.9) |
| 2 | El chat entra vacío y las burbujas llegan 0,3–0,8 s después | estado inicial `[]`; lectura de disco asíncrona (`useChat.ts`, `mensajesGuardados.ts`) | caché en memoria de los últimos chats; precarga en `onPressIn` |
| 3 | Re-render de toda la pantalla por cada acuse | `setVersion` aunque el cursor no se mueva; `dibujarFila` cambia de identidad (`useAcuses.ts`) | actualizar solo si cambió; `entrega` solo en filas propias; el server difunde solo si avanzó |
| 4 | Tráfico de más al abrir y al scrollear | `read.set` en cada cambio de `messages` (`useAlAbrirElChat.ts`) | mandar solo cuando el seq sube |
| 5 | Trabas al abrir | el relleno de historial cifra 100 filas en el hilo JS (`useChat.ts`, `App.tsx`) | no correr con un chat abierto; lotes que ceden |
| 6 | Todas las burbujas se redibujan a los 0,5 s | conciliar con el server crea objetos nuevos (`conciliarMensajes.ts`, `sync.ts`) | conservar la referencia si no cambió |
| 7 | La burbuja enviada «salta» y a veces sale dos veces | clave `p-<clientKey>` → `m-<seq>`; eco antes del ack | clave por `clientKey`; filtrar pendientes ya confirmados |
| 8 | Costo por fila | `Intl.DateTimeFormat` nuevo en cada llamada (`chatDisplay.ts`) | formateadores a nivel de módulo |

Siguen, de menor impacto: X25519 + HKDF por mensaje en chats secretos, un
reproductor nativo por nota de voz visible, progreso de subida que redibuja la
pantalla, la lista de abajo sin `freezeOnBlur`, el campo de texto controlado,
`recyclingKey` en las imágenes recicladas, `inlineRequires` apagado.

**Medir antes y después:** el detector actual solo ve trabas de más de
250 ms. Hace falta un contador de frames caídos en la conversación para
probar cada arreglo.

### 49.1 Hecho en FL12 (18/10/2026, sin publicar)

| # | Arreglo | Dónde |
| --- | --- | --- |
| 1 | **Se probó y se volvió atrás.** `KeyboardChatScrollView` + `KeyboardStickyView` hacían que la lista saltara al principio de la conversación al cerrar un modal (colgar una llamada, la hoja de adjuntar). Sigue el `KeyboardAvoidingView` de antes | — |
| 1b | Abrir en frío quedaba ARRIBA 2 de cada 3 veces: la lista nacía vacía, los mensajes llegaban del disco y el scroll inicial de `startRenderingFromBottom` se pisaba con la corrección de posición de FlashList 2.0.2 (se medía `scroll 6621` → `scroll 7`). La lista se vuelve a montar al pasar de vacía a con filas | `ListaDeMensajes` (`key`) |
| 1c | El botón «bajar» aparecía estando abajo al reabrir: el último evento de scroll llega con el alto ESTIMADO (9032 dp contra 7838 medidos). El alto del contenido sale de `onContentSizeChange`; un cambio de tamaño solo puede acercar, nunca alejar | `finalDeLaConversacion` (`PosicionEnLaLista`), `useFinalDeLaConversacion` |
| 2 | El chat nace pintado: memoria de los últimos 10 chats con sus 50 mensajes ya descifrados, precargada al apoyar el dedo en la fila. Se vacía al cerrar sesión o borrar el chat | `memoriaDeChats`, `precargarChat`, `useChat`, `FilaDeChat` |
| 3 | Un acuse que no cambia el check no redibuja; cada fila recibe su `entrega` resuelta y solo las propias; el server reparte un `receipt` solo si el cursor avanzó (compara contra el documento anterior: con `timestamps`, `modifiedCount` da 1 siempre) | `useAcuses`, `MessageRow`, `chatService.moverCursor`, `socket.ts` |
| 3b | Sin `deliver.set` por `msg.new` en vivo: el server ya lo marcó entregado al repartirlo. Sigue el de `sync.pull` | `useChat` |
| 4 | `read.set` solo cuando sube, y lo pendiente sale al reconectar | `useChat.markRead`, `emitirLeido` |
| 5 | El relleno de huecos al abrir espera las animaciones y 3 s de calma; el cifrado de páginas cede el hilo cada 20 filas | `useChat`, `mensajesGuardados.escribirFilas` |
| 6 | `mergeBySeq` y `conciliarPagina` conservan la referencia de lo que no cambió y devuelven el MISMO array si nada cambió (`mismoValor`) | `shared/sync`, `shared/conciliarMensajes`, `shared/mismoValor` |
| 7 | Pendiente y confirmado comparten clave (`claveDeFila` por `clientKey`) y tipo de celda; un pendiente ya confirmado no se dibuja (fin de la burbuja doble) | `filasDelChat`, `ListaDeMensajes`, `ChatScreen` |
| 8 | Formateadores de hora y fecha creados una vez | `shared/chatDisplay` |
| 9 | Chat secreto: la clave de mensajes se deriva una vez por sesión y lo abierto se recuerda por sobre | `deviceKeys.claveDeMensajes`, `useSecretChat` |
| 10 | Nota de voz: el reproductor nativo nace al primer toque | `NotaDeVoz` |
| 11 | El progreso de subida avisa por pasos de 4 % | `progresoDeSubida.valeAvisarProgreso`, `colaDeArchivos` |
| 12 | «Inicio» congelada con un chat encima (`freezeOnBlur`); la lista de chats se escribe al disco juntando ráfagas de 1,5 s | `NavegacionDeSesion`, `chatsGuardados` |
| 13 | Pendientes, presencia y «escribiendo» no crean estado nuevo si nada cambió; el detalle del chat se monta al primer uso | `useChat`, `ChatScreen` |
| 14 | base64 con tabla de valores en vez de `indexOf` por carácter | `shared/e2ee` |
| — | `recyclingKey` en las imágenes de filas y avatares; gesto de deslizar memoizado | `MessageRow`, `Avatar`, `DeslizarParaResponder` |

| 15 | El campo de escribir no es controlado: el texto vive en un ref y la barra solo se redibuja al cruzar vacío ↔ con texto (`formaDelTexto`); poner un texto desde afuera remonta el campo, limpiar usa `clear()` | `Composer`, `campoDeTexto` |
| — | El «escribiendo…» se apaga cuando llega el mensaje de esa persona | `useChat` |

**E2E (emulador, 18/10):**
- Enviar no deja burbuja doble.
- El campo no controlado cambia micrófono ↔ enviar y se limpia al mandar.
- Se ve «escribiendo…» y el mensaje en vivo.
- Reabrir el chat entra pintado (a los 0,6 s ya está entero).
- Abrir en frío: 4 de 4 abajo (antes 1 de 3). Reabrir: 4 de 4 abajo y sin
  botón «bajar». Colgar una llamada y cerrar la hoja de adjuntar: sigue abajo.
- El botón «bajar» sale al subir, cuenta el mensaje que llega leyendo arriba
  y no aparece si el mensaje llega estando abajo.
- La subida con el teclado NO se pudo ver: los dos AVD declaran teclado físico
  y Gboard queda flotante. Se verifica en un teléfono.

**Pendiente (de menor impacto):** la caché de membresía del server (G2), el
`explain` de `GET /api/chats` (G3), `inlineRequires` y la agenda persistida
(F3/F4), y el contador de frames caídos para medir.

## 48. Auditoría de diseño premium (18/10/2026, pedido de José)

José, 18/10: «audita el diseño, es muy pobre, no me gusta, tiene errores de
paddings, no se siente premium». La auditoría se hizo pantalla por pantalla en
el emulador (claro y oscuro, datos QA sembrados por el socket) y al lado de
las capturas de Stitch (`design/stitch/*`).

**Sistema de diseño: lo que rompe varias pantallas a la vez**
1. **Un celeste fuera de la paleta.** `surfaceVariant` claro es `#d3e4fe`. El
   design system de Stitch lo sacó del azul secundario y se usa en 23
   lugares: «Cerrar sesión», campos del respaldo, chips, esqueletos. Choca con
   la paleta lila.
2. **Una tarjeta por fila**, con 8–12 dp de aire entre tarjetas: cada
   participante, cada ajuste, cada opción. Stitch y WhatsApp agrupan las filas
   en una sola superficie con separadores finos. Así se ve pesado y gasta la
   pantalla.
3. **Todo lila.** Buscador, chips, banda, tarjetas y avatares con el mismo
   relleno lavanda: no hay jerarquía. Falta un neutro.
4. **Avatares distintos según la pantalla**: lavanda con letra violeta en la
   lista y violeta sólido con letra blanca en Nuevo chat.
5. **Sin título por pestaña**: todas dicen «Lilachat» arriba. WhatsApp y
   Stitch muestran el nombre de la pestaña.

**Pantalla por pantalla**
- **Lista de chats:** las filas miden ~80 dp, igual que en Stitch (una
  primera medida de «105 dp» estaba mal convertida). Con la banda de
  actualización, buscador y chips suman ~170 dp antes del primer chat.
- **Conversación:** «+» y además un clip en la barra de escribir, dos puertas
  al mismo menú. La franja de no leídos va a todo el ancho, y no como
  pastilla. En grupo, el avatar queda centrado en la burbuja en vez de arriba.
- **Detalle del chat:** participantes y ajustes en tarjetas sueltas.
  «Reportar grupo» parece deshabilitado. Stitch: lista agrupada con «Añadir
  participante» como fila.
- **Ajustes:** el formulario entero del respaldo está desplegado en la
  pantalla, cuando debería ser una fila que abre su propia pantalla. «Cerrar
  sesión» va celeste. Las filas van sueltas.
- **Invitar:** muy por debajo del diseño «invitar-amigos». Falta la cabecera,
  los contactos con «Invitar» y la tarjeta con el enlace, «Copiar» y
  «Compartir». El mensaje de WhatsApp es un bloque de texto con dos enlaces
  pelados; Pulso usa un mensaje corto con vista previa. La página pública por
  app queda para LilaStore (tarea aparte).
- **Agenda:** la pestaña dice «Avisos» y crear ofrece «Recordatorio».
- **Avisos del sistema:** el ícono chico es un círculo genérico, no el logo.

**Plan (FL13)**
- **FL13a, sistema:** token neutro; una sola fila y un solo grupo de filas;
  un avatar; título por pestaña; lista más densa; barra de escribir sin
  duplicado; no leídos como pastilla; ícono de los avisos.
- **FL13b, pantallas:** Ajustes, Detalle del chat, Invitar (con el mensaje
  nuevo), Nuevo chat, Agenda y Encuestas.
- **FL13c, contra Stitch:** entrada (teléfono y código) y llamada.

### 48.1 Hecho en FL13a/b (18/10/2026, sin publicar)

- **La causa de los paddings.** NativeWind compila `rem` = 14 por defecto y
  Stitch dibuja con 16, así que toda clase de Tailwind salía 12,5 % más chica:
  `h-11` medía 38,5 dp (no los 44 de toque) y `text-base`, 14. Ahora
  `metro.config.js` pasa `inlineRem: 16`. Las clases en px no cambian.
- **Tokens:** `surfaceVariant` neutro (`#eeecf3`), burbuja propia sólida
  (`bubbleOwn`, `onBubbleOwn`, `onBubbleOwnMuted`, `readTickOwn`) y cinco tonos
  de avatar.
- **Piezas únicas en `src/ui/`:**
  - `Avatar` + `avatarMotor`: dos iniciales y un tono que sale del nombre (la
    misma persona tiene el mismo color en toda la app); si el nombre es un
    teléfono, va el ícono. Reemplaza 14 versiones; la llamada usa solo las
    iniciales.
  - `FilaDeAjuste` y `GrupoDeAjustes`: listas agrupadas con línea fina.
  - `PantallaEnModal`, `Segmentado` (uno solo, tonal; había tres estilos) e
    `Interruptor` (colores de los tokens: en claro el riel apagado no se veía).
- **Ajustes** pasa a `settings/PantallaDeAjustes.tsx` (TabsShell baja de 562
  a 447 líneas):
  - grupos Notificaciones, Chats, Lilachat y Cuenta;
  - la copia de seguridad abre su propia pantalla;
  - «Cerrar sesión» va en rojo;
  - sin avatar en la cabecera (llevaba a la misma pantalla);
  - «la mini» pasa a «el servidor» en todo texto de usuario; el disco del
    server solo lo ven los operadores.
- **Cabecera de pestañas:** el título de cada pestaña, sin línea y con el
  fondo de la lista. Chips apagados en gris lleno.
- **Composer:** la píldora y los botones miden 48 dp y quedan alineados.
- **Detalle del chat:** participantes y ajustes agrupados. «Reportar» se quitó:
  estaba deshabilitado y no tiene backend.
- **Nuevo chat:** «Nuevo grupo» y «Chat secreto» en un mismo grupo.
- **Agenda:** «Avisos» pasa a «Recordatorios», como el «+» y su pantalla.
- **Invitar** (diseño `invitar-amigos`): cabecera, tarjeta del enlace
  (copiar o compartir), contactos agrupados con «Invitar». Una sola FlashList
  para todos los estados, así el buscador no se desmonta.
- **Mensaje de invitación** en `shared/invitacion.ts` (`mensajeDeInvitacion`,
  `nombreDePila`, `enlaceDeWhatsapp`): una frase en tuteo con el enlace al
  final, como Pulso. Con un contacto se abre `wa.me` en su chat con el texto
  listo; si no, el menú del sistema (`contacts/compartirInvitacion.ts`).
  Invitar sigue creando la admisión antes de compartir.
- **El enlace de la invitación es la ficha de LilaStore**
  (`lilastore.constroad.com/app/lilachat`, LilaStore §10a-bis). WhatsApp arma la
  tarjeta con su `og:*`, y el botón principal baja Lilachat directo: quien
  recibe la invitación no tiene que instalar LilaStore (José, 18/10). Un
  `/descargar` propio del server se probó y se quitó antes de publicar.
- **Ícono chico de los avisos:** `notification_icon`, la silueta blanca en
  cinco densidades, generada por `scripts/iconos-de-la-app.mts`. Lo usan los
  avisos de mensaje, de llamada, de llamada en curso y el de conexión
  permanente. Necesita build nativo.

**FL13c (18/10), revisado contra Stitch:**
- La entrada (teléfono y código) ya coincide; el teclado numérico del diseño lo
  pone el sistema.
- La llamada coincide en composición. Se corrigió la barra de estado: íconos
  claros sobre el violeta en tema claro, y oscuros sobre la lavanda en oscuro.
- Los no leídos como franja de ancho completo y el «+» junto al clip son del
  diseño FL6: se quedan.
- **Inter, no.** WhatsApp en Android usa Roboto, la fuente del sistema, que es
  la que ya tiene la app. Cambiarla exigía un `Text` propio en unos 100
  archivos y un build nativo, sin ganar parecido.

### 48.2 FL13d — auditoría lado a lado (18/10/2026, sin publicar)

Se recorrieron en el emulador todas las pantallas con datos QA sembrados por el
socket y la API (un 1:1, un grupo de cuatro con encuesta y evento), en claro y
oscuro, al lado de cada captura de Stitch. Lo que no coincidía y se arregló:

| # | Diferencia | Arreglo | Dónde |
| --- | --- | --- | --- |
| 1 | La encuesta y el evento en un grupo quedaban fuera de la columna de las burbujas, sin avatar y con el autor dos veces («QA Ana» arriba y «Familia · preguntó QA Ana» adentro) | Van como un mensaje ajeno: avatar al pie de la tarjeta, el nombre en el color de esa persona y la hora debajo. Adentro del chat la encuesta no repite de qué chat es | `TarjetaDelChat`, `TarjetaDeEncuesta` (`enElChat`) |
| 2 | El evento en el chat tenía «Voy / No voy» con otro estilo; la Agenda, «Voy / Tal vez / No voy», y decía «1 van» | Un solo `BotonesDeRsvp` y un solo `resumenDeRsvp` («1 va · 0 tal vez · 3 sin responder») | `agenda/BotonesDeRsvp`, `agenda/eventos` |
| 3 | La cabecera cortaba «últ. vez hoy a las 7:…»: se perdía la hora | `formatUltimaVez` corta: hoy «últ. vez 7:38 p. m.», ayer «últ. vez ayer …», antes solo el día; el subtítulo achica la letra hasta 15 % antes de cortar | `shared/chatDisplay`, `EncabezadoDelChat` |
| 4 | Participantes con iniciales aunque tuvieran foto; «Tú» con un ícono | El detalle manda la foto de cada miembro; se ve en el detalle y en las burbujas del grupo | server `GET /chats/:id/detail` (`avatarUrl`), `useGrupo` (`fotos`), `MessageRow` |
| 5 | Sin «Añadir participante» en la lista, como el diseño | Primera fila de la tarjeta, y el rótulo con la cantidad | `ParticipantesDelGrupo` (salió de `ChatDetailScreen`) |
| 6 | Teléfonos sin espacios en el detalle y en Ajustes | `formatPhoneDisplay`: «900 000 088» | `ChatDetailScreen`, `PerfilAjuste` |
| 7 | «passphrase» y «aparatos» en textos de usuario | «clave del respaldo» y «dispositivos» | respaldo, `AjustesDelChat` |

**Revisado y que se queda como está** (coincide con Stitch): el avatar del grupo
al pie del ÚLTIMO mensaje del bloque (`chat-grupo`, `multimedia-emojis`); el
interruptor apagado con bolita oscura (`crear-encuesta`, Material 3); la
tarjeta de recordatorio tintada con ícono de color (`recordatorios`); crear
evento, crear recordatorio, nueva encuesta, nuevo grupo e invitar.

**Pendiente:** la foto del grupo al crearlo (el diseño `nuevo-grupo-info` la
pide; hoy se pone después, desde el detalle); el teléfono con espacios cuando
es el NOMBRE de un chat sin contacto (toca la búsqueda de chats, va aparte).

## 47. Lilachat Empresa — plan (17/10/2026)

José aprobó llevar Lilachat a un uso empresarial tipo Slack, con D1 en (a).
Fases propuestas, por impacto:

| Fase | Qué | Estado |
| --- | --- | --- |
| E1 | **Espacio por empresa y directorio**: miembros sin depender de la agenda, roles dueño/admin/miembro/invitado, desactivar a alguien corta sus equipos | ⬜ |
| E2 | **Canales** públicos y privados por tema, con descripción y fijados; unirse sin invitación | ⬜ |
| E3 | **Hilos y menciones** (@persona, @canal, @aquí); avisos configurables: todo o solo menciones | ⬜ |
| E4 | **Integraciones**: webhooks entrantes (el Portal publica en un canal), comandos con `/`, Lila como bot y **mensajes con botones** como WhatsApp Business (respuestas rápidas, listas, «Ver detalle»); solo los bots los mandan, tocar uno responde y le avisa al bot | ⬜ |
| E5 | **Búsqueda** en todo el historial con filtros, retención, exportación y auditoría | ⬜ |

**Dependencia: central de push.** Un proyecto de Firebase con todas las apps
y un módulo «Avisos» en LilaStore: interruptor por app, clave por backend,
`registrar` / `enviar`, limpieza de tokens y métricas. Se trabaja en el repo
de LilaStore; Lilachat sigue con su FCM directo y migra cuando esté.

## 46. Auditoría UX contra WhatsApp (17/10/2026)

Dos pasadas de solo lectura (conversaciones; todo lo demás), con evidencia
`archivo:línea`. Lo hecho en FL7 está en §45.14; lo que sigue, por fase.

### 46.1 FL8 — lo que se pierde o se rompe
- Un mensaje que el server rechaza desaparece sin aviso; no hay «falló» ni
  reintentar; con 401 se vacía la cola en silencio (`outboxStore.ts:104-113`,
  `shared/outbox.ts:75-88`).
- La cola solo se vacía con un chat abierto (`ChatListScreen.tsx:219`).
- Fotos, archivos y notas de voz no entran a la cola: sin red fallan y se
  pierden (`ChatScreen.tsx:311-337`).
- Tocar una notificación no abre ese chat (nadie escucha la respuesta;
  `avisoLocal.ts:87`).
- Una llamada solo suena si el otro tiene ese chat abierto: la señalización
  vive en la pantalla del chat y no hay push (`useCall.ts:157`,
  `socket.ts:298`). Altavoz y «activar video» no hacen nada real.
- En grupos el check azul se pone con la lectura del PRIMERO
  (`useChat.ts:385-390` vs `chatService.ts:293`).
- Documentos sin miniatura (Word, Excel, zip, mp3) no abren
  (`ChatScreen.tsx:293`).
- «Silenciar» en el detalle no se guarda (`ChatDetailScreen.tsx:113`).
- Cerrar sesión: sin confirmar, borra historial y passphrase, y el server no
  se entera (el `pushToken` sigue: el teléfono deslogueado recibe avisos).
- Chat nuevo desde «Nuevo chat» abre con `memberIds: []` → se trata como
  grupo, sin botón de llamar y el chat secreto no deriva la clave
  (`TabsShell.tsx:611-622`).
- Los permisos de contactos y notificaciones se vuelven a pedir en cada
  arranque; `expo-notifications` avisa «Custom sound 'default'» en cada inicio.
- RSVP de quien entró al chat después de creado el evento da 403
  (invitados = foto de los miembros al crear).
- Un evento o una encuesta de un chat secreto se guarda en claro.

### 46.2 FL9 — lo que WhatsApp hace a diario
- Pulsación larga: solo «Eliminar», de a uno, sin confirmar, sin «para mí /
  para todos», y aparece en mensajes ajenos. Faltan Responder, Copiar,
  Reenviar, Info, multiselección (`ChatScreen.tsx:549-579`).
- Links, teléfonos y correos no se tocan (`MessageRow.tsx:336`).
- Una foto por vez, sin previsualización con pie (el server ya acepta pie).
- Tocar una cita no salta al original; en grupos la cita no dice de quién.
- No se busca dentro de un chat (botón deshabilitado); un resultado de la
  búsqueda general no lleva al mensaje (el `seq` llega y se ignora).
- Sin divisor «N no leídos»; el chat siempre abre abajo.
- Notas de voz: sin velocidad, sin arrastrar, sin onda; dos suenan a la vez;
  grabar es tocar/tocar (sin mantener y deslizar para cancelar).
- Borrador por chat; ver y cancelar programados (el server ya lo tiene).
- Atrás de Android sale del chat con algo seleccionado o una respuesta a
  medias; en la lista cierra la app con una búsqueda activa.
- No se archiva ni se elimina un chat; no hay «marcar no leído».
- Sin nombre ni foto de perfil (el OTP acepta `name` y nadie lo pide).
- Fotos siempre recortadas a 220×220 (el server no guarda dimensiones).
- Sacado de un grupo, la conversación sigue con la barra de escribir y la
  cabecera de miembros. WhatsApp dice «Ya no eres participante» (E2E de FL8).

### 46.3 FL10 — pulido y coherencia
- ✅ 18/10 **Un solo registro: tuteo** (Perú). Hoy Agenda y onboarding tutean y
  Ajustes, Contactos, respaldo e invitación vosean, a veces en el mismo
  mensaje («Te invito… Instalá»).
- ✅ 18/10 Áreas táctiles < 44 dp y botones sin etiqueta (volver/llamar 36 dp, RSVP 36
  dp, quitar participante 24 dp…).
- ✅ 18/10 (§45.26) Encuestas: no dicen de qué chat ni quién preguntó, nunca muestran quién
  votó, «anónimo» no es real (el server manda los votantes a todos), no se
  cierran ni se borran, votar no espera ni avisa errores.
- ✅ 18/10 (§45.26) Evento: sin detalle para quien no lo creó (quiénes van, en qué chat), sin
  hora de fin, «Pueden invitar a otros» sin efecto, invitar a 2+ siempre crea
  un grupo nuevo.
- ✅ 17/10 «Compartidos» en avisos nunca tiene nada (nadie crea un aviso de chat).
  Ya no hay pestaña: la sección solo aparece si hay alguno (`RemindersScreen`).
- ✅ 18/10 Presencia: sin «últ. vez»; los grupos muestran el punto de en línea.
- ✅ 18/10 Dos respaldos distintos en Ajustes; «Respaldar ahora» de la copia vieja
  deja a cualquiera lanzar un dump del server entero (`backupRoutes.ts:44`).
- ✅ 18/10 Un solo ErrorBoundary para toda la app (§45.26); orientación fija en
  vertical (§45.27).
- ✅ 18/10 Las líneas de llamada cuentan como no leídas y disparan «Ponme al día» de
  Lila sobre puras llamadas (E2E de FL8.1).
- ✅ 18/10 La lista de chats se pide 5 veces al arrancar: `TabsShell` y
  `ChatListScreen` piden cada uno, y otra vez al reconectar (log del server de
  QA, FL8). Va con FL4.

### 46.4 FL11 — lo que José vio con Wilson (18/10/2026, teléfonos reales, 0.1.86)

La llamada ya ocupa la pantalla con la app cerrada (FL8.1 funciona en un
teléfono real). Lo que falló o quedó raro:

1. ✅ 18/10 (§45.28, probada con José en 0.1.90) **ALTA. Contestar desde la notificación se queda en «Conectando…» y nunca
   conecta**, en los dos sentidos (José → Wilson y Wilson → José). El chat
   registra «Llamada de voz · 00:18»: el server vio el contestar, pero el
   audio nunca se estableció.
   **Hipótesis principal (leída en el código):** `socket.ts` reenvía
   `call.ice` solo en vivo. Los candidatos que manda quien llama antes de que
   el otro teléfono conecte se pierden; la oferta sí se repite al conectar
   (`ofertasVigentes`), los candidatos no. Con la app abierta llegaban todos.
   Arreglo probable: guardar los candidatos junto a la oferta
   (`guardarOferta`), repetirlos con ella y aplicarlos después de
   `setRemoteDescription`. Otras hipótesis, en este orden:
   - la app arranca desde el aviso y contesta antes de tener la oferta o el
     socket;
   - los candidatos ICE se pierden mientras la pantalla se monta;
   - la credencial TURN no llega en el arranque en frío.
   En el emulador, con la app abierta, conectaba (FL8): el caso es la app
   cerrada.
2. ✅ 18/10 (§45.29) **Los avisos de mensajes salen uno por mensaje**, sin agruparse por chat
   como WhatsApp. Además algunos salen **duplicados** en dos formatos: «Los
   originales · 960397018» con el texto, y «Los originales» con
   «960397018: texto». Parece que el aviso nativo (`AvisoDeMensaje`) y el
   local de JS (`avisoLocal`) se disparan los dos cuando el proceso está vivo.
3. ✅ 18/10 (§45.29) **El aviso dice el número y no el nombre de la agenda** («960397018» y no
   «Wilson Zamora»): el código nativo no ve la agenda. Se puede buscar el
   nombre con `ContactsContract.PhoneLookup`.
4. ✅ 18/10 (§45.29) **El aviso no tiene «Responder»** ni «Marcar como leído», como WhatsApp
   (respuesta en línea desde la notificación).
5. ✅ 18/10 (§45.29) **Foto con pie: hueco a la derecha.** Con FL9e la foto vertical mide 240 de
   ancho, pero un pie más largo ensancha la burbuja hasta el 80 % y la foto
   queda pegada a la izquierda. WhatsApp ajusta el pie al ancho de la foto.
6. ✅ 18/10 (§45.25) **«Ponme al día» sin sentido**: salió con «1 mensaje sin leer», que se lee
   de un vistazo, y no se fue al leerlo. Mostrarlo solo con muchos sin leer
   (p. ej. 10 o más), sin contar las líneas de llamada (§46.3), y esconderlo
   cuando ya se leyó.
7. ✅ 18/10 (§45.28, probada con José en 0.1.91) **ALTA. En plena llamada, al cambiar de app se deja de oír** (José, 18/10,
   0.1.90; al volver suena otra vez). Android congela una app de fondo sin
   servicio en primer plano, y con ella el audio. Además, el socket se pausaba
   al ir al fondo: tampoco llegaba que el otro colgó. Arreglo: servicio
   «Llamada en curso» de tipo micrófono, con cronómetro y «Colgar» en la
   notificación, mientras la llamada esté activa o sonando hacia afuera; y el
   socket no se pausa en plena llamada.
