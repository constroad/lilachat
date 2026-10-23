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

**El respaldo es SOLO el correo verificado de la cuenta (22/10/2026).** El
correo del respaldo es una llave de la cuenta: quien recibe el código entra
como ese teléfono. Hasta el 22/10 el server usaba también el correo de la
invitación (lo escribía quien invitaba) y el correo de una cuenta aunque nunca
se hubiera verificado. Con eso, quien invitara un número poniendo SU correo
podía pedir «Envíalo a mi correo» y entrar como ese número, incluso antes de
que llegara su dueño. Además, la cuenta nueva heredaba el correo de la
invitación. Ahora `backupEmailOf` (`invitationGate.ts`) devuelve el correo solo
si tiene `emailVerifiedAt` (lo prueba su dueño con un código en el perfil,
`profileRoutes.ts`). Sin correo verificado, «Envíalo a mi correo» reenvía por
WhatsApp, con la misma respuesta. Al canjear, solo valen el teléfono y ese
correo. Ninguna cuenta nace con correo: llega después, verificado. Como el
perfil obliga a verificar el correo (`profileGateNow`), toda cuenta activa
termina con respaldo. Solo el alta de una cuenta nueva depende de WhatsApp.
Tests: `test/authRoutes.test.ts` («email fallback: only the verified email») y
`test/invitationGate.test.ts`.

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

## 114. Guiños de Navidad, videos dentro de la app, compartir la ubicación y administrar el almacenamiento (22/10/2026, 0.1.152)

Cierra los pendientes 6, 13 y la ubicación fija del 11, y la Navidad del 73.
El 20 ya estaba hecho desde la §109 y se marcó.

**Guiños de Navidad (73).** Hoja de Stitch `r152-navidad`, con tono adulto y
diciembre de Lima (verano).
- Cinco sketches de 6,5–7 s (`winkSketchesChristmas.ts`): «Papá Noel
  capataz» (revisa la lista, manda bajar los regalos y el último le cae en el
  casco: ve estrellas y se ríe), «Elfo practicante» (la torre de regalos se
  tambalea y se cae; se rinde con un chocolate), «Reno chofer» (llega en el
  trineo tocando la bocina, frena en seco y se va volando), «Vigilante de
  nieve» (le pita al sol y se derrite en un charco) y «Amigo secreto» (abre
  el regalo: un panetón, otro, y otro más).
- Arte: 5 personajes y 6 piezas (regalo, arbolito, panetón, chocolate,
  trineo y estrella). Salen del 1 al 26 de diciembre; en octubre no se
  ofrecen, pero un guiño recibido se ve igual.
- Medido en el emulador al recibirlos: 3,1 % de cuadros lentos y p90 de
  22 ms Papá Noel, 1,1 % y 17 ms el elfo, 3,4 % y 21 ms el reno, 1,7 % y
  22 ms el vigilante, 1,9 % y 17 ms el amigo secreto.
- Arreglado en el E2E: el confeti de emojis del amigo secreto lo llevaba a
  12,8 % y 53 ms (se quitó); la torre del elfo le tapaba la cara.

**Videos dentro de la app (6).**
- `videoEmbedFor` (shared, puro): YouTube (enlaces, cortos, Shorts, en vivo y
  el `t=`), TikTok, Instagram (post, reel) y Facebook (video, reel), cada uno
  con el reproductor del sitio (YouTube sin cookies). Lo que no reconoce se
  abre en el navegador como antes.
- App: la tarjeta del enlace abre `VideoEmbedPlayer`, un WebView
  (`react-native-webview`, MIT, con su regla `-keep` para R8) que solo tiene
  el reproductor y lleva el origen de Lilachat como referente (YouTube lo
  exige). Todo enlace que sale del reproductor se abre en el navegador.
- Web: `VideoEmbedOverlay` encima del chat, con Escape y «Abrir en …». La
  CSP de la web suma en `frame-src` solo esos cuatro orígenes
  (`VIDEO_EMBED_ORIGINS`): sin eso el iframe salía negro.
- E2E: YouTube y TikTok reproducen dentro de la app; «Watch now» de TikTok
  abrió Chrome. En la web, YouTube cargado y reproduciendo (4 s, sin pausa)
  en la misma pestaña.
- Falta el mini reproductor flotante (PiP de Android).

**Compartir la ubicación (11, la fija).** Diseño `r152-ubicacion`.
- `sharedLocation` (shared, puro): valida el punto, redondea a ~10 cm, la
  precisión en metros («Precisión 12 m»), el enlace universal al mapa y las
  teselas de OpenStreetMap que rodean al punto (`mapTilesFor`).
- Server: tipo de mensaje `location` y `POST /api/chats/:id/locations` (no
  en chats secretos). El `body` es «Ubicación».
- App: «Ubicación» en el clip abre una hoja con el mapa, la precisión y
  «Enviar ubicación». Permiso solo «mientras se usa la app»
  (`expo-location`, sin segundo plano). Tarjeta con el mapa y «Abrir en el
  mapa» (abre Google Maps).
- Web: muestra la tarjeta (WhatsApp Web tampoco envía ubicaciones).
- Sin servicio pago: las teselas son de OpenStreetMap con su atribución, y
  la app se identifica en el `User-Agent` como pide su política.
- E2E: enviada desde el emulador (Plaza San Martín, precisión 5 m), vista en
  la web de Ana y borrada para todos. Se quitó el permiso de ubicación del
  emulador al terminar.
- Falta la ubicación en tiempo real.

**Administrar el almacenamiento (13).** Diseño `r152-almacenamiento`.
- App, Ajustes → «Almacenamiento»: cuánto ocupa Lilachat y el libre del
  teléfono, y por grupo con «Liberar»: fotos y videos vistos, notas de voz
  descargadas, documentos abiertos y archivos temporales. Los mensajes
  guardados solo se muestran.
- Medido en el emulador: los temporales (actualizaciones descargadas y copias
  del selector de fotos) pesaban 134 MB de 172 MB; «Liberar» los dejó en 38 MB.
- `GET /api/me/storage`: los chats donde más se compartió (fotos, videos,
  audios y documentos) y los archivos de más de 5 MB; y
  `/storage/chats/:id/files`, los de un chat. Respeta lo borrado y lo vaciado
  «para mí».
- La lista de archivos permite elegir varios o todos y «Eliminar para mí»
  (se ocultan en ese teléfono, como en el chat).
- Web: en Ajustes, cuánto guarda el navegador y «Borrar la copia de este
  navegador» (recarga y los chats vuelven del servidor).
- E2E: en el emulador, ocultar dos PDF de Ana y liberar los temporales; en la
  web, ver el tamaño, borrar la copia y recargar.
- Falta «Reenviados muchas veces»: los mensajes no guardan cuántas veces se
  reenviaron.

**Limpieza de QA.** Lo que mandó Ana (guiños, enlaces y PDF) se borró por la
ruta normal; la ubicación de José, con «Eliminar para todos» en el emulador.
El cumpleaños temporal de Ana se sacó en cada E2E web y la web se desvinculó.

## 113. Avatares en los avisos, aviso a los admins el día antes del cumpleaños, guiños de Halloween y el detalle del chat con pestañas (22/10/2026, 0.1.151)

Cierra los pendientes 68, 69 y 72, y el primer tramo del 73 (Halloween).

**Avatares en los avisos (68).**
- El push de datos de un mensaje trae `foto` (quien escribió) y `fotoChat`
  (el grupo o el contacto), en URL absoluta (`pushService`).
- Nativo (`AvisoDeMensaje.kt`): cada `Person` del `MessagingStyle` lleva su
  foto recortada en círculo (`NoticeThumbnail.circle`), guardada por línea.
  El chat se publica como atajo de conversación (`chat-<id>`) con su foto:
  así Android dibuja la foto grande y el ícono de la app chiquito encima,
  como WhatsApp.
- E2E: push real solo al emulador; el aviso mostró la foto del grupo con el
  ícono de Lilachat y la foto de quien escribió.

**Aviso a los admins el día antes (72).**
- `warnAdminsOfTomorrow` (server, en el tick de cumpleaños): a las 8:00 de
  Lima, en cada grupo con los cumpleaños encendidos, avisa a los admins
  (menos al del cumpleaños): «Mañana cumple Carla · 29 años»
  (`birthdayHeadsUpText`, shared).
- Una sola vez por persona y año: se reclama `birthdayHeadsUps.<userId>` en
  el chat antes de mandar.
- Tests: shared (`limaTomorrowKey`, el texto con y sin edad) y server (solo a
  los admins, nunca al del cumpleaños, y no se repite).
- La tarjeta de cumpleaños del detalle lo dice («Un día antes, avisa a los
  admins») y ya no habla de «quien deja ver su fecha» (§112, 71).

**Guiños de Halloween (73).** Hoja de Stitch `r151-halloween`, con tono
adulto.
- Cinco sketches de 6,5–7 s (`winkSketchesHalloween.ts`): «Calabaza obrera»
  (se saca la cabeza, reparte dulces y la cabeza le gira sola), «Jefe vampiro»
  (sale del ataúd, «firma aquí», murciélagos, se va hecho murciélago), «Momia
  de obra» (camina tiesa, se tropieza con su venda y bosteza en la lápida),
  «Bruja contadora» (revuelve el caldero, lee la calculadora y la tira
  adentro) y «Fantasma practicante» (llega cansado, su «¡bu!» llena la
  pantalla y se va avergonzado por la pared).
- Temporadas (`winkSeasons.ts`, en hora de Lima): Halloween 1/10–2/11,
  Navidad 1–26/12, Año Nuevo 27/12–7/1, San Valentín 1–15/2, Día de la Madre
  1–15/5 y Fiestas Patrias 15–31/7. `winkPanelGroups(now)` pone primero el
  grupo de la temporada; fuera de ella esos guiños no se ofrecen, pero los
  recibidos se siguen viendo.
- Arte: 5 personajes y 6 piezas (murciélago, balde de dulces, caldero, ataúd,
  telaraña y lápida), en WebP para la app y miniaturas para la web.
- Medido en el emulador (build de desarrollo), al recibirlos: 8,4 % de
  cuadros lentos y p90 de 34 ms la calabaza (6,9 % repetida), 1,7 % y 17 ms el
  vampiro, 2,3 % y 21 ms la momia, 4,6 % y 28 ms la bruja, 2,8 % y 22 ms el
  fantasma. Más livianos que el perrito (11,6 %) y el panda (11,9 %).
- E2E: Ana mandó los cinco al chat con José; en el emulador sonaron y se
  vieron completos (video cuadro a cuadro del vampiro y la calabaza). En la
  web el panel trae «Halloween» primero con 5, y el vampiro y la bruja se
  reprodujeron.
- Arreglado en el E2E: el balde de la calabaza quedaba debajo de la barra de
  escribir.
- Falta el resto de las temporadas (5 guiños cada una), con su hoja de Stitch.

**Detalle del chat con pestañas (69).** Diseño `r151-detalle-grupo`.
- Arriba: foto, nombre y «Grupo · 5 miembros», las acciones y la
  descripción; los destacados siguen debajo. Después, pestañas **Miembros ·
  Media · Ajustes** (`chatDetailTabs`, shared). Un 1:1 y un borrador no
  tienen Miembros.
- Miembros: «Agregar miembros» primero, «3 miembros» y la pastilla «Admin del
  grupo»; en la app, el teléfono debajo del nombre.
- Media: lo compartido (media, documentos y links). Ajustes: zumbidos y
  guiños, cumpleaños, recordatorios del grupo, avisos, cifrado y salir.
- Abre en la primera pestaña, o en la que pidió el ⋮ («Medios del grupo» →
  Media; «Agregar miembros» → Miembros). Una recarga después de editar no
  cambia de pestaña.
- «Invitar con enlace» del diseño no se puso: esa función no existe.
- Tests: shared 5 y web 2 nuevos.
- E2E: grupo y 1:1 en el emulador, y «Medios del grupo» desde el ⋮. En la web
  como Ana: las tres pestañas, la pastilla y los ajustes.

**Limpieza de QA.** Los cinco guiños de Ana se borraron por la ruta normal; el
cumpleaños temporal de Ana se sacó dos veces; la web se desvinculó. El GIF,
el sticker y el guiño de las 21:11 en el chat de QA con José son de José.

## 112. Repeticiones de recordatorios y vista previa del enlace, recordatorio a pantalla completa, álbum a 3/4 con el gesto de responder y sin la casilla de cumpleaños (22/10/2026, 0.1.150)

Cierra los pendientes 65, 63, 70 y 71; el 64 ya funcionaba y se verificó.

**Repeticiones (65).** Diseño `r150-repetir`.
- `repeatRule` (shared, puro, en hora de Lima): días de la semana elegidos
  (martes y jueves), mensual el mismo día o el último (28, 29, 30 o 31: es «el
  día antes del 1 del mes siguiente») y cada N días, semanas o meses.
  `Recurrence` suma `monthly`.
- **La regla guarda el día pedido** (`day`). Después de sonar, el cron mueve
  `startsAt` a la próxima vez: sin el día, un «31 de cada mes» habría quedado
  en «28» para siempre después de febrero (`anchorRepeatRule`).
- Server: `Reminder.repeat`, alta y edición, y el cron (`decidirRecordatorio`
  y `nextOccurrence`) con la regla. La línea de la tarjeta es `whenItRings` y
  la etiqueta corta, `repeatLabel` («Mar y jue», «Fin de mes», «Cada 2 días»).
- App (`RepeatPicker`) y web (`RepeatPickerWeb`): segmentado de 4, días
  «L M M J V S D», las opciones mensuales, «Cada N» y el resumen («Se repite
  los martes y jueves a las 9:00 a. m.»). Nunca queda una semana sin días.
- Tests: shared 11 (bisiestos, meses de 30 y 31, el día que sobrevive al
  cron), server 3 y web 3.
- E2E web: crear martes y jueves (guardado en 817 ms, la fila dice «Mar y jue
  · 27 oct»), pasarlo a último día del mes y borrarlo. App: el selector, sin
  guardar en la cuenta de José.

**Vista previa del enlace en el formulario (65).** Un enlace en la nota del
recordatorio (app y web) o en la descripción del evento (app) muestra la
tarjeta del chat (`VistaPreviaAlEscribir`) con su X. E2E: YouTube en la web y
en el emulador.

**Recordatorio a pantalla completa (63).**
- El teléfono que lo declara (`REMINDER_NATIVE_CAPABILITY`) recibe el
  recordatorio como push de datos; los demás, el aviso de siempre.
- Nativo (`ReminderAlarm.kt`): aviso con `fullScreenIntent` (el mismo permiso
  de las llamadas) que enciende la pantalla y abre la app sobre el bloqueo,
  con «Listo» y «Posponer 10 min». Posponer no pasa por el server: el teléfono
  lo vuelve a mostrar con `AlarmManager` (exacto si el teléfono lo permite).
- App: `ReminderAlarmHost` lo muestra en grande (hora, título, nota y los dos
  botones) y suelta el bloqueo al terminar.
- E2E: push real solo al emulador, con la pantalla apagada: se encendió y
  mostró «Tomar la pastilla». «Posponer» dejó la alarma programada para 10
  minutos después.

**Aviso desplegable (64).** El aviso ya juntaba los mensajes del chat (hasta
7) y al desplegarse se ven todos, con la imagen del último. Probado con dos
pushes seguidos. Falta probarlo en el Samsung de José.

**Álbum (70).** Cuadrado a 3/4 del ancho, como WhatsApp (antes tomaba el ancho
de la foto). En la primera foto, deslizar a la derecha responde (no hay foto
anterior); en las demás, cambia de foto. E2E: 811 px de ancho en el emulador;
deslizar en la primera abrió «responder»; en la segunda volvió a la primera.

**Cumpleaños sin casilla (71).** «Que mis chats vean mi cumpleaños» salió del
perfil (app y web), y el aviso ya no mira esa preferencia vieja: lo decide el
chat.

**Limpieza de QA.** El recordatorio y el álbum de Ana se borraron por la ruta
normal; el cumpleaños temporal de Ana se sacó; se desvinculó la web; se forzó
el cierre de la app del emulador para cancelar la alarma de prueba.

## 111. Ícono y miniaturas en los avisos y la lista, panel de emojis con íconos y búsqueda de GIF a pantalla completa, el perrito bajo la lluvia, una sola banda de versión en la web y los avisos borrados (22/10/2026, 0.1.149)

Cierra los pendientes 57, 59, 60 y 61, y dos bugs del E2E.

**Ícono y miniaturas (57).**
- Ícono chico propio: la silueta monocroma del logo
  (`assets/notification-icon.png`, sacada del ícono adaptativo) con el color
  de marca, por el plugin de `expo-notifications` (`notification_icon` y
  `notification_icon_color`). Antes caía al ícono de la app a color.
- El push de un mensaje lleva `imagen` (`pushImageOf`): la miniatura del
  sticker, la foto, el GIF o el video, o la del guiño, que sirve la web en
  `/guinos/<arte>-tile.webp`. Nunca en un chat secreto.
- El aviso nativo la baja en el hilo del push (tope de 2 MB, 4 s y 256 px) y
  la pone DENTRO del último mensaje (`MessagingStyle.Message.setData`, por el
  FileProvider de expo-file-system). Plegado se ve a la derecha, como
  WhatsApp; desplegado, dentro del mensaje.
- La lista de chats trae `lastMessage.thumb` (`listThumbPath`) y la fila
  muestra la miniatura antes del texto; el guiño usa su imagen local (app) o
  `/guinos` (web).
- E2E: un push real de FCM, solo al token del propio emulador (leído del
  emulador, nunca impreso), con sticker y con guiño. En la lista salieron el
  GIF, el guiño y la foto.

**Panel de emojis (59).**
- Las pestañas son solo íconos, en una cápsula, como WhatsApp. El nombre
  queda para TalkBack y el lector de pantalla; el GIF es su glifo. App y web.
- En la app, «Buscar GIF» abre a pantalla completa («← Buscar GIF», con el
  teclado y una grilla de 3 columnas). Elegir uno lo manda y vuelve al chat;
  «←» vuelve al panel.
- El teclado de una pantalla abierta encima ya no cierra el panel
  (`ChatBottom` ignora el teclado con un modal arriba: `coveredAbove`).
- E2E: escribir en la búsqueda y volver dejó el panel abierto en GIF (con un
  GIPHY falso en el server de QA, `QA_FAKE_GIPHY`).

**Guiño «Perrito bajo la lluvia» (60).** Diseño de Stitch
`r149-perrito-lluvia` (tono adulto, `stitch-design` §5-bis).
- El extractor sumó la hoja `z-a` a las 8 de siempre: se verificó antes que
  las 8 reproducen el `winkArt.ts` actual sin diferencias. Las orejas van en
  la cabeza (el rig no tiene orejas).
- Sketch `rainy`, 7 s: entra cabizbajo con una nube que llueve solo sobre él,
  solloza, corre y la nube lo alcanza, el viento le da vuelta el paraguas,
  llora un charco y, cuando se va de espaldas, el sol sale a burlarse.
  Sonidos: gotas, viento, rebote, charco y risa.
- Lo aprendido en §79: cada parte es un WebP recortado (30 imágenes, 217 KB);
  la app mueve imágenes, no dibuja SVG. Los ayudantes de los sketches pasaron
  a `winkSketchKit.ts` (el archivo iba a pasar de 600 líneas).
- Medido en el emulador (build de desarrollo), «Ver otra vez»: 11,6 % de
  cuadros lentos, p90 de 53 ms y 0 subidas lentas de imágenes. Es el mismo
  costo que el panda en la misma prueba (11,9 % y 53 ms).
- La miniatura de un guiño ahora puede ser otro arte (`tile: 'dog-sad'`); la
  web la dibujaba solo si era una pieza (`winkTileIsProp`).

**Una sola banda de versión en la web (61).** Había dos «Recargar»: la banda
de la lista (versión publicada) y el aviso de arriba (service worker). Ahora
es UNA banda en la lista, alimentada por las dos señales (`webUpdate`). Al
tocar «Recargar» dice «Actualizando…», gira y no acepta un segundo toque.

**Bugs encontrados en el E2E.**
- **Un aviso del sistema borrado seguía dibujado** («🎂 Hoy cumple QA Ana»
  después de borrarlo). Ahora no se dibuja (`isHiddenNotice`), en app y web.
- **La tarjeta de cumpleaños salía para un aviso borrado** y llegó al teléfono
  de José con 0.1.148 (tocó 🎂 en el chat de QA Ana). `birthdayCardFor` ignora
  los avisos borrados.

**Limpieza de QA.** Los guiños de Ana se borraron por la app. El cumpleaños
temporal de Ana, que solo existía para entrar a la web, se sacó. La sesión web
se desvinculó y se borraron los avisos de prueba del emulador. Verificado: cero
residuos.

## 110. Estado, álbum de fotos, cumpleaños en los chats, visor de PDF en la app y el asistente solo con /lila (22/10/2026, 0.1.148)

Cierra los pendientes 15, 12, 17 (sin «Crear tarjeta con IA») y 7, más el
bug 58. José pidió un mínimo de cuatro pendientes por versión.

**Estado (15).** Diseño `r148-estado`.
- `User.presenceMode` (`auto | away | busy | invisible`) y
  `User.lastSeenHidden`. `GET/PUT /api/me/presence`. Un modo inválido
  responde 400 «Elige En línea, Ausente, Ocupado o Invisible.» El cambio
  llega a mis contactos por el socket (`presence` con `status`).
- Invisible: no avisa ni «se conectó» ni «se fue» y no guarda la última vez;
  los demás ven la que tenía antes. Con «Mostrar mi última vez» apagado,
  nadie la ve.
- App: Ajustes › Estado, a pantalla completa como el diseño (cuatro opciones
  con su punto, Privacidad y Vista previa con el punto en el avatar). La
  cabecera del chat dice «ausente» u «ocupado». Web: la sección Estado en
  Ajustes, y la cabecera dice «Ausente» u «Ocupado».
- Tests: shared (`presenceMode`), server 5, cabecera de la app y
  `presenceStatus` de la web.
- E2E: Ana pasó por ocupado, ausente, invisible y automático. La cabecera de
  José en el emulador mostró «ocupado», «ausente», «últ. vez 3:20 p. m.» (la
  de antes) y «últ. vez 7:27 p. m.». Cada PUT tardó 280–320 ms.

**Álbum (12).** Diseño `r148-album`.
- Dos o más fotos o videos enviados juntos llevan `media.album`: un id que
  arma el cliente y el server valida (`isAlbumId`). `albumLayout` (shared)
  agrupa las filas seguidas del mismo autor y del mismo álbum, sin borradas.
- App: `AlbumCarousel` se desliza de lado, con «2/3» y los puntos. El pie de
  la primera va abajo; el de otra página, encima de la foto. Un toque abre el
  visor en esa foto.
- **En un álbum, deslizar de lado no responde** (José, 22/10: en la última
  foto aparecía «responder»). Se responde desde el toque largo.
- Web: `AlbumCarouselWeb`, con flechas.
- E2E: tres fotos de Ana. En la app, 1/3 → 3/3 → 2/3 con el pie encima, y
  deslizar pasado el borde ya no abre la respuesta. En la web, 1/3 → 2/3 en
  524 ms.

**Cumpleaños (17).** Diseño `c1-app-cumpleanos`.
- `Chat.birthdaysOn`: en un grupo lo cambian los admins; en un chat de dos,
  cualquiera de los dos. `PATCH /api/chats/:id/birthdays`.
- Desde las 8:00 de Lima (un cron cada 15 min) el chat dice «🎂 Hoy cumple
  Carla · 29 años». Sin el año, no dice la edad. Quien oculta su cumpleaños
  (`birthdayVisible: false`) no se anuncia. `Chat.birthdayNotices` guarda un
  aviso por persona y día, reclamado de forma atómica: correr dos veces no
  repite.
- Al abrir el chat ese día, los demás ven la tarjeta, una vez por
  dispositivo. Trae cuatro reacciones que mandan el emoji, y «Saludar» (o
  «Saludar en el grupo»), que escribe el saludo en el campo sin mandarlo.
  «Crear tarjeta con IA» necesita un modelo pago: espera la decisión de José.
- App: el interruptor en el detalle del chat. Web: la fila en Info.
- E2E: el aviso salió en los dos chats de QA. Tardó 5,3 s desde la Mac por
  el túnel; la segunda corrida no agregó avisos. La tarjeta salió en el
  emulador y en la web, «Saludar» escribió en el campo y la tarjeta no volvió
  al reabrir.

**Visor de PDF en la app (7).** Diseño `visor-archivos`.
- Módulo nativo propio, `modules/pdf-pages`, con el `PdfRenderer` de Android
  y sin dependencias. Dibuja cada página a JPEG en la cache solo cuando la
  pantalla la pide: ancho en pasos de 200 px, tope de 1600 px y 6 MP. Al
  cerrar, borra las páginas.
- La pantalla muestra las páginas una debajo de otra. El zoom (100, 150, 200
  y 300 %) conserva la página y el punto que se miraba. Trae «3 / 14» con
  anterior y siguiente, «Compartido en el chat» con los otros PDF y «Abrir
  con otra app». Un PDF con contraseña o dañado dice el motivo y ofrece
  abrirlo afuera; sin red, ofrece «Reintentar».
- Un build sin el módulo abre el PDF con otra app, como antes.
- Medido en el emulador: listo para leer en unos 3,4 s (descarga y apertura,
  medido con volcados de pantalla de ~1 s). Al recorrer las 14 páginas, 1,9 %
  de cuadros lentos y p90 de 18 ms.
- Arreglado en el E2E: al volver al 100 % después de mover la página de lado,
  quedaba corrida. Ahora la posición lateral se reescala con el zoom.

**El asistente solo con /lila (58).** Responde solo a `/lila` al principio
del mensaje y solo en espacios de empresa (`workspaceId`). Una mención nunca
lo llama: en «Lokillos», «@Lila» era para Lila, la persona. Si falla, dice
«No pude responder ahora. Prueba en un rato.» y la causa va al log, nunca al
chat. Con el OK de José, el asistente salió de «Lokillos», el único chat
personal donde estaba. E2E: «@Lila ?» y «/lila hola» en QA Hilos quedaron sin
respuesta.

**Limpieza de QA.** Los mensajes sembrados se borraron por el camino de la
app (Ana y Beto, «Eliminar para todos»). Los cumpleaños de Ana y Beto volvieron
a su valor anterior, los dos chats quedaron sin cumpleaños ni avisos, el
estado de Ana volvió a su valor por defecto y la sesión web de QA se
desvinculó. Verificado: cero residuos.

## 109. Listas de chats propias, llamada programada y enlace de llamada, mini reproductor y contactos del teléfono en la web, y lo borrado que seguía dibujado (22/10/2026, 0.1.147)

Cierra los pendientes 45, 42 (en chats de dos), 14 y 20. José pidió un
mínimo de cuatro pendientes por versión.

**Listas de chats propias (45).** José, 22/10: «Familia», «Amigos», como
las carpetas de Telegram y las listas de WhatsApp.
- Viven en el perfil (`User.chatLists`: nombre y chats, en mi orden). No
  hay colección nueva ni índice nuevo.
- `GET/POST /api/chat-lists`, `PATCH/DELETE /api/chat-lists/:id` y
  `PUT /api/chat-lists/order`. Solo entran chats míos. Hasta 20 listas y
  500 chats por lista.
- Un nombre vacío, repetido o igual a un chip fijo se rechaza con su motivo
  (`chatListNameError`).
- Cada cambio emite `chatLists.changed` a mis otros dispositivos.
  Tests: server 9, shared 15.
- App: un chip por lista después de «Borradores», «+» para crear y toque
  largo para editar o eliminar. En la selección de chats, «Agregar a lista»
  muestra cada lista con todos, algunos o ninguno de los chats elegidos.
- Web: los mismos chips, «+», el lápiz con una lista abierta, clic derecho
  y «Agregar a lista» en el menú de cada chat. Tests: 5.
- Medido en la web contra el servidor de QA: crear una lista y ver su chip,
  1,3 s. Un cambio hecho en otro dispositivo llegó en vivo en 0,8 s.

**Llamada programada y enlace de llamada (42).** José, 22/10, «como
WhatsApp». Las llamadas de Lilachat son de dos personas, así que las dos
opciones salen en chats 1 a 1. Las llamadas grupales quedan como
pendiente 56.
- **Programar llamada:** en el menú de la cámara, en la app y en la web. Es
  un evento con `call: { video }`, solo en chats de dos (400 en un grupo).
  Su línea dice «Llamada programada: …», avisa a los dos 5 minutos antes, y
  la tarjeta ofrece «Unirse a la llamada» desde 10 minutos antes hasta una
  hora después (`callJoinState`). La tarjeta se actualiza justo cuando eso
  cambia (`msUntilJoinChange`), sin un temporizador fijo.
- **Crear enlace de llamada:** `POST /api/chats/:id/call-link` devuelve
  `https://lilachat.constroad.com/llamada/<chat>-<v|a>-<firma>`.
  - Va firmado con HMAC y no se guarda en ningún lado.
  - Solo lo abren los miembros del chat (403 con el motivo). Un enlace
    alterado da 404.
  - App: hoja de compartir de Android. Web: copiar.
- **Abrir el enlace:** en el teléfono lo abre la app (App Links,
  `pathPrefix /llamada`) y pregunta «¿Llamar a …?», voz o video. En la web
  el enlace espera al ingreso, abre el chat y pregunta lo mismo.
- Tests: server 8, shared 10, app 1, web 2.
- Bug encontrado en el E2E: en una pestaña nueva, el pedido salía con la
  sesión guardada antes de renovarse. Recibía un 401 y el enlace se perdía.
  Ahora un 401 conserva el enlace hasta que llega la sesión renovada.
- Error mío al escribirlo: el router del enlace se montaba en `/api` con
  `router.use(requireSession)`. Así habría pedido sesión a toda ruta de
  `/api` montada después. Quedó con la sesión en cada ruta.
- Medido contra el servidor de QA (el túnel a la base pesa): programar y
  ver la tarjeta en la web, 3,9 s. En el emulador, abrir el enlace y ver
  «¿Llamar a QA Ana?», unos 2,7 s, contando las capturas del E2E.

**Mini reproductor en la web (14).** El visor de PDF y el de videos ya
existían. Faltaba el mini reproductor:
- «Mini reproductor» en el visor de un video. El video sigue en una
  ventanita abajo a la derecha, también al cerrar el visor o cambiar de
  chat.
- «Flotar» lo pasa al Picture-in-Picture del navegador, que lo mantiene
  encima aunque cambies de pestaña.
- Bug del E2E: tapaba el botón de enviar. Ahora va por encima del campo de
  mensaje.
- Tests: 6. Abre en 41 ms.

**«Nuevo chat» en la web con la agenda del teléfono (20).** Es la opción
(b) de José: nada se guarda en el servidor.
- La web pide la agenda completa (`agenda.pedirTodo`) y solo los teléfonos
  de esa persona la reciben. El teléfono responde (`agenda.respuestaTodo`)
  con hasta 2000 contactos. El servidor los limpia y se los pasa solo a esa
  web.
- La web pregunta a `/api/contacts/match` quién está en Lilachat y los
  muestra con el nombre de la agenda.
- Sin el teléfono conectado dice «Abre Lilachat en tu teléfono para ver
  aquí sus contactos».
- Tests: shared 3, server 2, app 2, web 5.
- E2E con un teléfono de QA Ana simulado: «Beto de la agenda» apareció a los
  61 ms, y un número sin cuenta no apareció.

**Lo borrado que seguía dibujado (bug, 22/10).**
- En el E2E, los guiños de QA Ana borrados para todos seguían como tarjetas
  con «Ver otra vez» en la app. Las tarjetas de eventos borradas también
  seguían.
- En la web pasaba lo mismo con guiños y zumbidos.
- Ahora un guiño, un zumbido o una tarjeta borrados se leen «Se eliminó
  este mensaje» (`drawsAsFunLine`, `drawsAsCard`; 3 tests en la app y 1 en
  la web).
- Además, un guiño borrado antes de verlo ya no se reproduce
  (`funMessageToPlay`, 1 test).

**La búsqueda dentro del chat no saltaba (bug de la app, encontrado en el
E2E).** Marcaba «1 de 1» o «2 de 2» y la lista seguía abajo. Con la flecha
y el teclado cerrado sí saltaba.
- Medido con registros temporales: la fila estaba (índice 29 de 47) y el
  salto se pedía.
- Al abrir el teclado del buscador, Android reporta un «arrastre» sin dedo.
  `PosicionEnLaLista` lo tomaba como el dedo y volvía a pegarse al final.
  Al medirse las filas del salto, «lo de abajo creció» y bajaba
  (`scrollToEnd`), deshaciendo el salto. El salto animado agregaba su propio
  «arrastre» mientras todavía estaba abajo.
- Arreglo:
  - el salto suelta la lista del final justo antes de moverse
    (`releaseFromEnd`, que existía para esto y nadie llamaba);
  - salta sin animación, como la búsqueda de WhatsApp;
  - mientras buscas o hay un mensaje resaltado, la lista no baja sola;
  - una coincidencia que no está dibujada abre su ventana (44).
- E2E: «Prueba» saltó al mensaje 51 resaltado, con el teclado abierto.
  Sirve también para tocar una cita y para abrir desde un aviso.

**Notas**
- Limpieza de QA en cero:
  - listas: ninguna en las cuentas de José, QA Ana y QA Beto;
  - eventos de hoy: ninguno;
  - las tarjetas borradas por el camino de la app;
  - webs de QA Ana desvinculadas y su perfil restaurado.
- José aprobó borrar el checklist de QA del 21/10 («Vaciado de losa QA»).
  Se borró desde su cuenta en el emulador, con su tarjeta.

## 108. Abrir un mensaje viejo con su contexto, compartir un contacto, el guiño que se repetía y el permiso de pantalla completa (22/10/2026, 0.1.146)

Cierra los pendientes 44, 9 y 54. Suma la parte 2 del 46.

**Mensaje viejo con su contexto (44).** José, 22/10: «Ese mensaje está más
arriba: sube para cargarlo», al abrir un checklist, un recordatorio o una foto.
Ahora pasa lo mismo que en WhatsApp Web y Telegram: el chat salta al mensaje,
con los de antes y los de después.
- Server: `GET /chats/:id/messages` acepta `around=<seq>` (una ventana
  alrededor) y `afterSeq` (la página siguiente), además de `beforeSeq`.
  Se usa uno solo por pedido; con más de uno responde 400 con
  «Usa solo uno: beforeSeq, afterSeq o around.». `readMessagePage` respeta el
  piso de cada miembro (`memberChatFloor`) y el tope de página
  (`clampPageLimit`). Tests: 9.
- Shared: `windowFromPage`, `nextWindowPage`, `extendWindow`, `joinsLive`,
  `mergeIntoLive` y `newSinceWindow` arman la ventana, aparte de lo último.
  Cuando la ventana alcanza el final, se une a lo vivo. Tests: 9.
- App: `useChatWindow` + `messageWindowRows`. El chat salta al mensaje, carga
  más al bajar y muestra «Ir al último». Si mando un mensaje, la ventana se
  cierra y vuelvo al final.
- Web: `useMessageWindow` + `windowOnScreen`. Una ventana corta pide la
  página siguiente sola. «Ir al último» y enviar cierran la ventana sin
  volver a abrirla.
- Medido: en la web, 0,8 s de server + 0,5 s de pintado. En el emulador, con
  el build de desarrollo y el túnel de QA, 2,5 a 3 s.

**Compartir un contacto (9).** En el clip, «Contacto» elige uno de la agenda.
Si tiene varios números, se elige uno (`pickNumber`, con test).
- `POST /chats/:id/contacts` guarda el mensaje `kind: 'contact'` con nombre y
  teléfono. Si ese número es de alguien en Lilachat, el server lo dice
  (`userId`). En un chat secreto no se puede: el mensaje saldría sin sellar.
  Tests: 4.
- La tarjeta muestra el nombre, el número, «Enviar mensaje» (si está en
  Lilachat) y «Agregar». La lista dice «Contacto: Nombre»
  (`sharedContactBody`, 5 tests).
- E2E: QA Ana y José se mandaron contactos entre la web y el emulador. El
  número se pasa como `+51…`: sin el prefijo, el formulario de Android lo
  formateaba como de EE. UU.

**El guiño que se repetía (54).** José, 22/10, con 0.1.145: «Lila me envió un
globo de agua y cada vez que ingreso al chat se reproduce». Después pasó igual
con el oso.
- La base estaba bien: José había leído hasta el 25 y el oso era el 24.
- El error estaba en la app. El chat se abre con el `readSeq` de la fila de
  la lista. La lista ponía en 0 los no leídos, pero nunca subía ese
  `readSeq`: se quedaba con el de la última carga. Cada vez que José volvía a
  entrar, el guiño contaba como nuevo.
- Arreglo en la causa (shared, `listaEnVivo`): `marcarLeido`, mi acuse desde
  otro dispositivo y un mensaje que llega al chat abierto ahora suben el
  `readSeq` de la fila. Tests: 6.
- Segunda defensa (app, `funSeen`, 4 tests): cada chat recuerda en la sesión
  el último guiño o zumbido que ya alcanzó. Cubre una lista que se vuelve a
  montar (la ventana del 44 la monta de nuevo) y cualquier otra fuente vieja.
  «Ver otra vez» no pasa por ahí.
- E2E en el emulador, con el chat de QA Ana silenciado para que no saltara
  en el teléfono de José:
  - QA Ana mandó un oso con José en la lista. Al abrir el chat se vio una
    vez; al volver a entrar, no;
  - QA Ana mandó un globo con el chat abierto. Se vio en vivo; al salir y
    volver a entrar, no.
  - Los dos guiños se borraron para todos y se quitó el silencio.

**Pantalla completa después de actualizar (46, parte 2).** José, 22/10: «¿por
qué se pierde el permiso que le doy? ¿No se puede evitar?».
- Lo que dice Android (AOSP 14, código leído): una actualización NO toca el
  permiso. Al activarlo en Ajustes, Android lo marca como elegido por la
  persona (`FLAG_PERMISSION_USER_SET`). Que se apague en el Samsung de José es
  cosa de One UI, no de la app.
- Lo único que puede hacer un instalador: en su sesión, declarar cómo queda
  `USE_FULL_SCREEN_INTENT`. Desde Android 14, `setPermissionState` lo permite
  a cualquier instalador, sin un permiso especial.
- Hasta 0.1.145, la app le pasaba el APK al instalador del sistema
  (`INSTALL_PACKAGE`), que no declara nada.
- Ahora la app se actualiza con su propia sesión (módulo `instalador-apk`):
  - con el permiso activo, la sesión lo declara concedido;
  - con el permiso apagado, no lo fuerza: queda lo que diga el teléfono;
  - Android sigue pidiendo confirmación (`USER_ACTION_REQUIRED`);
  - un APK que no es de Lilachat falla antes de reemplazar nada
    (`setAppPackageName`).
- Si la app todavía no tiene permiso para instalar apps, usa el instalador
  del sistema. Visto en el emulador: la sesión se cancela al volver de
  Ajustes, y el instalador del sistema sigue solo.
- Los fallos se explican en español (`sessionOutcome`, 7 tests): sin
  espacio, versión incompatible, archivo dañado.
- Medición: si una actualización apaga el permiso, el diagnóstico lo anota
  con quién instaló (`fullScreenLostOnUpdate`, 4 tests). Así se sabrá si One
  UI respeta lo que declara la sesión.
- E2E en el emulador (API 35):
  - con la sesión: apagué el permiso a mano antes de tocar «Update». Después
    de instalar quedó en `allow` y la app lo vio activo. El instalador quedó
    como `com.lilachat.app`;
  - control con `adb install -r`, sin sesión: el permiso siguió apagado.
- Límite honesto: la actualización A 0.1.146 todavía la hace la versión
  vieja, y en el Samsung puede apagarse una vez más. Desde 0.1.146, las
  actualizaciones hechas desde la app van por la sesión. Las que se hagan
  desde LilaStore siguen por el instalador del sistema; eso es trabajo del
  repo de LilaStore.

**Notas**
- En el E2E del guiño se abrió por error el chat real «Lokillos»: al llegar
  el guiño de QA, la fila de QA Ana subió y el toque cayó en otra. Solo se
  abrió; no se envió nada. Desde ahí, cada toque se ubica por el texto de la
  fila justo antes de tocar.
- Queda un checklist de QA de ayer, «Vaciado de losa QA», en el chat de QA
  Ana con José (seq 37). Ese chat tiene historia de varios días, también de
  José. No se borró sin preguntar.

## 107. Stickers animados propios desde un GIF y el enlace de invitación que abre la app (22/10/2026, 0.1.145)

Cierra los pendientes 37 (lo que faltaba: el sticker animado propio) y 47.

**Sticker animado propio (37).** José, 21/10: «crear yo mismo mis stickers
animados»; y 22/10: «al tocar ese gif debe haber una opción para convertirlo
en sticker animado propio, sea un gif que enviamos por giphy o un gif de mi
galería».

Server:
- `gifToAnimatedSticker` (`sharp` 0.35.5, que NO estaba instalado aunque el
  spec decía que sí) convierte el GIF a WebP animado de 512×512, centrado con
  márgenes transparentes;
- lo corta a los 6 s (`framesWithin`: un cuadro sin demora cuenta 100 ms, como
  lo dibujan los navegadores) y prueba calidades de 75 a 30 hasta que pese
  500 KB o menos;
- `POST /api/stickers/animated` recibe un GIF de hasta 8 MB;
- `POST /api/stickers/from-gif {chatId, seq}` convierte un GIF de un chat mío.
  Lee el archivo que el server guardó para ese mensaje, nunca una URL que mande
  el cliente. En un chat secreto no se puede, porque el GIF va cifrado;
- el sticker queda en «Mis stickers» con `animated: true`, y el mensaje que lo
  manda lleva la misma marca en el medio. Así se detiene a los 8 s como los del
  pack (`stickerIsAnimated`), aunque su URL no sea la del pack.

App y web. José aclaró el 22/10 que la opción tiene que salir al tocar el
mensaje del GIF en el chat, no escondida en el visor:
- **app, al tocar un GIF** del chat (mío o de otro, de GIPHY o de la galería)
  sale una ventana flotante con «Convertir en sticker animado», «Ver en
  grande» y «Cancelar». Si estaba quieto, el mismo toque lo vuelve a mover
  (`showGifOptions`, 3 tests);
- **app, toque largo:** la tarjeta flotante de las reacciones suma
  «Convertir en sticker animado» debajo de «Responder en hilo». No aparece en
  chats secretos;
- **web:** el menú del mensaje de un GIF tiene «Convertir en sticker animado»
  (2 tests), y el visor del GIF también;
- el resultado llega en un solo aviso. Un «Convirtiendo…» previo hacía que
  Android lo encolara y la respuesta llegaba 2 s después;
- el panel de stickers tiene «Desde un GIF», junto a «Crear». En la app el
  GIF se elige de la galería sin recorte, porque recortarlo lo aplanaría.

Tests: server 14 (con GIF reales generados con `sharp`: 3 cuadros salen 3; 80
cuadros de 100 ms salen 60; algo que no es imagen se rechaza sin romper);
rutas 6; web 6; app 2; shared 1.

Medido:
- la conversión del GIF de QA (200×150, 24 cuadros, 58 KB) tarda unos 270 ms
  y sale de 131 KB;
- en la web, GIF del chat → sticker: el aviso llega a los 1,3 s del clic;
- en la web, GIF de la computadora → sticker: 0,8 s;
- en el emulador, desde la tarjeta flotante: el aviso llega a ~2 s;
- en el emulador, desde la galería: ~2,5 s, con la subida incluida.

E2E en el emulador (cuenta de José, en QA Hilos):
- tocar el GIF mostró la ventana flotante y «Convertir» lo guardó;
- el toque largo mostró la fila en la tarjeta y también lo guardó;
- «Desde un GIF» con un GIF puesto en la galería del emulador lo guardó;
- un sticker propio mandado al chat se movió y quedó quieto después de 8 s.

Para el E2E, el server de QA reescribe `10.0.2.2` (la Mac vista desde el
emulador) a `127.0.0.1` al leer el archivo. En producción el archivo está en
el almacenamiento de lila.

**El enlace de invitación abre la app (47).** José, 22/10: «si ya tiene la
app instalada, ¿no sería mejor que haya una forma de abrir la app?».
- La invitación lleva primero `lilachat.constroad.com/unirse/<código>`, y
  después el código y la descarga, como antes (`spaceJoinLink`).
- Android abre la app con ese enlace (App Links): `intentFilters` con
  `autoVerify` en `app.json`, y el server sirve
  `/.well-known/assetlinks.json` con el paquete y la huella SHA-256 de la llave
  de release. La huella se comparó con la del APK publicado (`apksigner`).
- La app lee el enlace al abrir (`Linking.getInitialURL`) y mientras está
  abierta (`url`), y abre «Unirme a un espacio» con el código ya escrito.
- En la web, `/unirse/<código>` guarda el código en la pestaña y limpia la
  dirección. Sin sesión, avisa «Te invitaron a un espacio» con la descarga.
  Después de entrar, abre «Unirme» con el código.

E2E web: sin sesión salió el aviso y la dirección quedó en `/`. Después de
vincular como QA Ana, se abrió «Unirme» con `QAQA-2345`.

En el emulador, con un build de desarrollo que ya trae el filtro, el enlace
abrió la app en frío directo en «Unirme» con `QAQA-2345` ya escrito. Con la
app abierta, otro enlace cambió el código a `QAQB-6789`. La verificación real
de Android (`autoVerify`) necesita el `assetlinks.json` en producción y el APK
firmado con la llave de release: se confirma con José en su teléfono.

**Un GIF en la lista decía «Foto» (53).** La fila ahora dice «GIF»:
- el server manda `mime` en `lastMessage`;
- la lista en vivo lo copia del mensaje que llega;
- `resolveChatPreview` lo usa (shared, 2 tests).

**Notas.**
- Un GIF quieto en la burbuja se vuelve a mover al tocarlo. Antes, abrir el
  visor pedía un segundo toque en menos de 8 s; ahora el toque abre la
  ventana flotante, y desde ahí se llega a «Ver en grande».
- Limpieza de QA: los GIF y el sticker se borraron para todos desde la app,
  los stickers de prueba se borraron por id (los de la cuenta de José, los de
  QA Ana por la API) y el GIF salió de la galería del emulador.

## 106. 426 a las versiones viejas, correo opcional, guiños que se reinician, Llamadas en la web y el aviso de Chrome (22/10/2026, 0.1.144)

Cierra los pendientes 32 (lo que faltaba), 38 (Llamadas), 51 y 52. Deja el
análisis del 50.

**El server rechaza las versiones bajo la mínima (32).** `minimumVersion.ts`
(server, 10 tests):
- lee la mínima que José fija en LilaStore (`min-version`) y la guarda 10
  minutos;
- si LilaStore no responde, queda la última mínima conocida; si nunca hubo
  una, no rechaza a nadie;
- a un pedido con `x-lilachat-build` bajo la mínima le contesta **426**
  `update_required` con la mínima;
- en el socket hace lo mismo: `build` en el auth y `update_required`;
- `/api/crash` queda abierto, para que una versión vieja rota igual avise.

Solo se juzga a quien dice su build. Se probó adivinar las apps viejas por su
user agent `okhttp`, y se descartó: la app nueva también tiene caminos sin la
cabecera (descargas de medios y de respaldos), y la adivinanza dejaría afuera
a un teléfono al día. Desde la 0.1.144 la app dice su build en `jsonCall`, en
`client.ts` y en el socket (`appBuild.ts`, 5 tests). Ante un 426 o
`update_required`, la app consulta LilaStore en el momento y sale la pantalla
de bloqueo (§97) sin esperar sus 30 minutos.

E2E con el server de QA y la mínima en un archivo:
- curl con build 145 y mínima 999: 426 con el mensaje;
- curl sin cabecera: 200;
- `/api/crash` con build 1: 204;
- la app del emulador mandó su build en cada pedido (en desarrollo reporta el
  de Metro, 119) y con la mínima en 9999 el server la rechazó.

**El correo es opcional (51).** José, 22/10: invitó a Lila a una cuenta
individual y, después de verificar su número, la app le exigió el correo.
- `profileMissing` pide nombre y cumpleaños; el número ya lo probó el código.
- «Completa tu perfil» (app y web) muestra «Tu correo (opcional)» con «Lo
  necesitas solo para activar la copia de seguridad».
- La app tiene `EmailVerifyField`, extraído del perfil. Lo usa «Copia de
  seguridad»: sin correo verificado, primero pide verificarlo y después deja
  crear la clave.
- El server rechaza el PRIMER respaldo sin correo verificado (403
  `correo_sin_verificar`). Quien ya tenía respaldos sigue respaldando, para
  que nada que funcionaba se corte.
- El panel de superadmin cuenta «perfil completo» con nombre y cumpleaños.

E2E web: QA Ana sin cumpleaños ni correo vio el formulario con «(opcional)»,
«Continuar» se habilitó solo con día y mes, y entró a la lista. En el
emulador, una cuenta con correo verificado sigue entrando directo a crear la
clave. No se probó en el teléfono la cuenta sin correo: haría falta una cuenta
de prueba sin correo en el emulador. Lo cubren los tests de server y web.

**Guiños que se reinician (52).** José, 22/10: al probar varios stickers de
emoji (los guiños) rápido, dejaban de animarse. Causa: las vistas previas usan
siempre la misma semilla y «Ver otra vez» reusa el `seq` del mensaje, y el
overlay tenía como `key` ese `seq`. React dejaba montados los componentes
viejos, y sus animaciones, que arrancan al montarse, no volvían a correr. Ahora
cada inicio tiene su `run` y la clave es `seq:run` (`winkPlay.ts`, 3 tests).

E2E en el emulador: se tocaron tres guiños seguidos (0,4 s entre toques) y el
último se animó entero. Al tocar el mismo otra vez, arrancó de nuevo: las
capturas a 0,6 y 0,7 s del toque muestran la misma etapa. Los cuadros
(p50 57 ms, 60 % con saltos) son de un build de desarrollo con JS de debug, y
no sirven como medida: el APK de release no se puede instalar sobre el build
de desarrollo sin borrar la sesión del emulador.

**Llamadas en el riel de la web (38).**
- Server: `GET /api/calls/history` arma el historial con las líneas de llamada
  de mis chats. Usa el índice `{chatId, kind, at}`, que se verificó en la base,
  con 90 días y 60 filas como tope. Cada fila trae el título del chat (grupo o
  la otra persona) y su teléfono (4 tests).
- Shared: `callDirection` y `callHistoryLabel` (3 tests).
- Web: `CallsDialog` (6 tests) muestra la flecha, «Videollamada perdida» en
  rojo, la hora y el botón para llamar de vuelta con el mismo tipo. Una fila
  abre su chat. Prefiere el nombre de la lista (agenda) y cae al del server
  mientras la lista no llegó, como en una web recién vinculada.
- Recuerda la última respuesta de la sesión: reabrir pinta en el momento y
  refresca detrás.

Medido en el server de QA (por el túnel a la base):
- el endpoint tarda 0,35 s en serie;
- 20 en paralelo: 1,2 s de promedio, contra 1,6 s de `GET /api/chats`;
- abrir Llamadas la primera vez: 1,3 a 2,5 s con el server recién arrancado;
- reabrirla: **18 ms**.

**El aviso de Chrome al bajar el APK (50), análisis.** Chrome muestra «Es
posible que el archivo sea dañino» para todo APK que se baja de una web, con
o sin firma. No se puede quitar desde el server. Lo que hay:
- las actualizaciones nunca pasan por el navegador: la app baja el APK y abre
  el instalador de Android, que no muestra ese aviso;
- la página de LilaStore ya explica los avisos, pero detrás de un enlace.
  Quedó como tarea para la sesión de LilaStore: la explicación a la vista
  junto al botón, el texto exacto del diálogo y abrir LilaStore si ya está
  instalada;
- la única forma de que desaparezca del todo es Google Play. Esa decisión es
  de José.

**Otros.** `qaDebug` borrado. `prefetchSpace` usa `requestIdleCallback`.

Limpieza de QA:
- se desvincularon las sesiones web de QA Ana;
- se restauró su perfil (sin cumpleaños ni correo, como estaba);
- ningún dato nuevo en chats de José.

## 105. Checks, emojis, «bajar» con número, GIF al instante, pantalla completa y la nota de voz (22/10/2026, 0.1.143)

Cierra los pendientes 39, 40, 41, 43, 46 y 49 de José (22/10).

**Checks en la web (39).** Antes eran un glifo de texto lejos de la hora y,
en modo oscuro, el azul de leído casi no se distinguía. Ahora:
- `DeliveryIcon` dibuja reloj, ✓ o ✓✓ de 14 px pegados a la hora, con
  `aria-label` («Enviando», «Entregado», «Leído»);
- en la lista de chats van de 15 px;
- el leído usa el token `check-leido` (`readTick`), que contrasta en claro y
  en oscuro. No usa hex.

**Panel de emojis (40).** Abre en «Recientemente usado», primera pestaña, en
app y web. La grilla es más compacta: en la app emojis de 22 y 8 columnas; en
la web 24 px, con menos relleno y rótulos más bajos.

**«Bajar» con número (41).** `downButtonCount` y `unreadBelow` (shared, 7
tests) deciden el número:
- al entrar, los no leídos de otros desde lo que había leído;
- después de llegar al final una vez, los que llegaron mientras estaba
  arriba.

App y web lo muestran en el botón (`nuevos-abajo`). En la app, «bajar» vuelve
a pegar la lista al final (`goToEnd`).

E2E en el emulador: con 25 sin leer, el chat abrió en el divisor «25 mensajes
no leídos» con «bajar 25», y «bajar» llegó al final. Antes abría abajo una de
cada tres veces. La causa eran los eventos de scroll con que la lista se
acomoda, que la volvían a pegar al final después de `releaseFromEnd`. Ahora
`PosicionEnLaLista` tiene `soltada`: cuando el programa la deja lejos, solo
el dedo, «bajar» o un mensaje mío la vuelven a pegar (2 tests). Si los no
leídos llegan después del primer pintado, el divisor ya no queda congelado en
«ninguno»: espera a que lleguen, ubica la lista ahí una vez (`placedLate`) y
la suelta del final.

**GIF al instante (43).** El server baja el GIF de GIPHY y lo sube antes de
responder, y eso tarda segundos. Ahora la burbuja sale en el momento con la
vista previa de GIPHY y el reloj, y el mensaje real la reemplaza en el mismo
lugar:
- app: `gifsInFlight` la pone en la cola del chat (`useArchivosDelChat`) y
  se quita 1,5 s después de confirmarse;
- web: el mismo motor la suma a `enCola` hasta que llega la confirmación;
- si el envío falla, la burbuja se va.

Medido con el server de QA demorando 2,5 s la bajada:
- web: la burbuja aparece a los 150 ms del clic;
- emulador: la burbuja con reloj aparece mientras el server todavía guardaba
  el GIF, y después se confirma en su lugar.

**Pantalla completa después de actualizar (46).** En el emulador el permiso
sobrevive a `adb install -r`, así que el reinicio parece cosa del teléfono
(Samsung). Por eso la app avisa una vez por versión, solo si está negado:
- `shouldAskFullScreen` (5 tests) decide si avisar;
- `FullScreenCallsPrompt` es la hoja que explica qué pasa si lo deja apagado
  (la llamada suena, pero llega como una notificación más y con el teléfono
  bloqueado no se abre la pantalla para contestar);
- «Activar» abre el ajuste exacto de Android;
- «Ahora no» no vuelve a avisar hasta la próxima versión.

E2E en el emulador con `appops … deny`: la hoja salió al abrir y «Activar»
abrió «Full-screen notifications». Al reabrir con el permiso todavía negado
no volvió a salir.

**La nota de voz que no paraba (49).** Soltar el reproductor era «quitar los
controles y liberar», sin pausar, y un error en el primer paso salteaba el
resto. `releasePlayer` (3 tests) pausa, quita los controles y libera, cada
paso por separado: si uno falla, los demás igual corren. Cubierto con tests
de unidad; falta que José lo pruebe en su teléfono con una nota de más de
2:30, que es cuando hay controles en el bloqueo.

**Otros.**
- `prefetchSpace` usa `requestIdleCallback`: `InteractionManager` está
  deprecado y avisaba en cada entrada a un espacio.

Limpieza de QA:
- el GIF de prueba se borró para todos desde la app;
- las ráfagas de mensajes de QA se borraron por el camino de la app;
- se restauraron el chat Ana–Beto y los perfiles.

## 104. Modo empresa sin «cargando», parte 2; pendientes en la lista; mensajes en otro espacio (22/10/2026, 0.1.142)

José, 22/10:
- «el espacio de constroad no tiene el canal de general»;
- «si hay mensajes en espacios o cuentas individuales, ¿aparece que hay mensaje?»;
- «en la lista de chats no se muestra un indicador de que hay algo que tengo
  que ver en ese chat»;
- terminar lo que quedaba de la auditoría de velocidad.

**`#general` en espacios anteriores.** Solo se creaba al listar los canales, y
Constroad nunca los listó (Inframaq sí lo tenía). Ahora también se crea al
abrir la lista del espacio (`GET /api/chats?workspace=`), que es lo primero
que se ve. E2E en el emulador: al entrar a Constroad apareció `#general`.

**Mensajes en otro lado.** `unreadElsewhere` (shared, 3 tests) cuenta los
chats con algo nuevo fuera de lo que miro. En personal, cuenta todos mis
espacios activos; dentro de un espacio, cuenta personal más los otros
espacios. App: el título de la lista lleva ese número (`badge-otros-espacios`;
la web ya tenía el riel). Se mantiene en vivo de dos formas:
- un mensaje de otra persona en un chat personal que no estoy leyendo suma a
  la lista personal en memoria;
- uno de un chat de espacio relee los espacios, una vez por ráfaga (1,5 s).

E2E: dentro de Constroad, el título mostró «1» por la encuesta de QA Ana en
personal.

**Pendientes en la lista.**
- `GET /api/agenda/queue/keys` devuelve las llaves de lo que me espera en cada
  uno de mis chats: tareas atrasadas, encuestas sin votar, eventos sin
  responder y recordatorios que sonaron hoy. Son las mismas llaves que la cola
  de cada chat; la cola se reescribió para leer varios chats en una consulta
  por tipo.
- `pendingCount` (shared) les resta lo descartado en el equipo.
- App y web dibujan una marca con ícono y cantidad (`pendiente-<chatId>`) en
  la fila del chat y en la de cada canal.
- Se lee al arrancar, al cerrar un chat y al volver a la app o pestaña. También
  cuando llega una encuesta, evento o tarea, cuando se borra un mensaje y
  cuando cambia una tarjeta.
- La cola del chat corrige su chat. Actuar sobre una tarjeta o descartarla la
  saca al instante.

E2E web y emulador: la encuesta de QA puso «📋 1» en la fila al momento. Se
encontró que borrar la tarjeta no la quitaba y se corrigió con `msg.deleted`
y `ref.changed`.

**Velocidad, parte 2** (cierra la auditoría):
- **App: Directorio y Menciones son pestañas montadas** (como Chats), ya no
  una ventana que entra deslizándose. Abrir un chat desde ahí pasa a Chats.
  E2E: con datos a los 0,35 s del toque.
- **La lista de cada espacio vive en la caché** (`<spaceId>:chats`, con sus
  chips). Al volver a un espacio pinta lo guardado sin esqueleto.
- **Los eventos del socket se aplican en el lugar** con `listaEnVivo`. Solo
  piden al server un chat desconocido o cambiado, o una posible mención o hilo.
  La lista personal y `TabsShell` ya no se recargan por los mensajes de un
  canal (`isSpaceChat`). E2E web: un mensaje de QA Beto en `#general` cambió
  la fila («general 2») con 0 pedidos a la lista; antes eran hasta 4.
- **Los chips vienen con la lista:** `GET /api/chats?workspace=` incluye
  `activity` (un pedido y no dos).
- **La lista de espacios se guarda por persona** (web `localStorage`, app
  AsyncStorage), y la sesión que cierra la borra. Entrar a un espacio ya
  conocido no espera a `GET /api/workspaces`.
- **«Miembros y roles» hace un solo pedido** (`?status=all`, con los correos
  invitados), en vez de cuatro.
- **Evento `workspace.members.changed`** a los activos del espacio cuando
  alguien entra, sale, es aprobado o desactivado, o cambia de rol, cargo o
  área. El directorio y «Miembros y roles» abiertos se refrescan solos (motor:
  `expire`, 9 tests). E2E web: QA Beto salió y la pestaña pasó sola a
  «Activos 1».

Limpieza de QA: espacio (0/0/0) y encuestas borradas. La tarjeta en el chat
de José con QA Ana se borró para todos, y se restauraron los perfiles.


## 103. Modo empresa sin «cargando», parte 1 (22/10/2026, 0.1.141)

José, 22/10: «en el modo slack cuando ingreso a directorio, menciones etc sale
cargando… en Slack es todo muy fluido». La auditoría (solo lectura, con
archivo:línea) encontró la causa de fondo: el modo empresa no heredó lo que ya
tenía la lista personal (pintar de memoria y disco). Cada pantalla guardaba
sus datos en su propio estado y los tiraba al abrir: esqueleto, pedido al
server (160–720 ms medidos) y recién ahí pintaba.

**Motor compartido** `shared/sessionCache.ts` (8 tests): pinta lo que tiene y
revalida por detrás. Se suma a un pedido en vuelo en vez de repetirlo, gana la
última respuesta, y un error conserva lo mostrado y se informa aparte (se
limpia con el siguiente éxito). Lo del disco nunca pisa algo más fresco, y un
`patch` sin cambios no re-renderiza. Vale 30 s fresco. Claves
`<spaceId>:<qué>`.

**App** (`app/src/spaces/spaceCache.ts`, AsyncStorage) **y web**
(`web/src/spaces/spaceCache.ts`, tabla `meta` de la base local). Directorio,
Menciones (cada pestaña con lo suyo), Canales y Miembros y roles leen de ahí.
Al entrar a un espacio se precargan su directorio, menciones y canales. Un
espacio en el que ya no estoy activo se borra de memoria y disco. El cierre de
sesión borra todo (app: `forgetAllSpaces` junto a `olvidarChats`; web: la base
se borra entera y la memoria se vacía al desmontar).

**Server.** `/api/activity` lee menciones e hilos una sola vez: las filas de la
pestaña y los conteos de los chips salen de la misma respuesta (antes la misma
consulta corría dos veces). Las búsquedas de chats y canales corren en
paralelo. Tres índices PARCIALES en la bóveda con el OK de José: menciones
`{chatId, 'menciones.userId', at}`, hilos `{chatId, 'hilo.ultimaEn'}` y
reacciones `{chatId, senderId, at}`. Solo guardan los mensajes con mención,
hilo o reacción (5, 12 y 18 hoy). Cada filtro repite la condición del índice,
porque si no el planificador no lo usa. Medido: la consulta de menciones pasó
de examinar 73 documentos a 1.

**E2E web** (servidor de QA, QA Ana en «QA Empresa 141» con QA Beto):
- Al entrar se precargaron directorio y canales.
- Directorio, primera y segunda vez: 2 personas a los 60 ms y ningún esqueleto.
- Menciones → Hilos → Menciones: sin esqueleto.
- Tras recargar, el directorio vino del disco.
- En toda la corrida hubo 2 pedidos, no uno por apertura.
- Espacio borrado (0/0/0).

En el emulador no se probó: la cuenta de José tendría que estar en un espacio
de QA.

**Lo que sigue (auditoría, en orden):**
- App: Directorio y Menciones como pestañas montadas, no Modal; se va la
  animación de entrada.
- Guardar en disco la lista de espacios y la de chats de cada uno, y entrar a
  un espacio conocido sin esperar a `GET /api/workspaces` (son los esqueletos
  de la lista que se ven tras recargar).
- Aplicar los eventos del socket a la lista con `listaEnVivo` (hoy un mensaje
  de canal dispara hasta 4 pedidos en la web).
- Miembros con `?status=all` (1 pedido y no 4).
- Un evento de socket para los cambios de miembros.


## 102. Ingreso, «se unió» en los espacios e invitar por correo (22/10/2026, 0.1.140)

José, 22/10, antes de que su empresa y su familia instalen. Preguntó cómo se
verifica cada alta, si llega «se unió» a los espacios, y si la cuenta
individual debía exigir número y correo. Decidió: una cuenta por persona,
`#general` automático, y correo como respaldo (SMS se estudia después).

**Cómo es hoy la identidad (leído del código).**
- Toda cuenta entra por su número (`/api/auth/otp/*`): es la identidad y es
  única. No hay cuenta solo con correo.
- El correo es obligatorio: «Completa tu perfil» lo pide y lo verifica con un
  código (§93). La cuenta individual ya es número más correo verificado.
- El código llega por WhatsApp. «¿No te llegó? Envíalo a mi correo» lo manda al
  correo verificado (§5, arreglado hoy en 1a1b8a2: antes iba también al
  correo de la invitación o a uno sin verificar).
- Si WhatsApp cae, entra quien tiene correo verificado. Solo un alta nueva de
  ese día queda esperando. SMS exige un proveedor que cobra por mensaje y un
  cambio en constroad-auth: pendiente de estudio.

**`#general` automático** (`workspaceGeneral.ts`, 6 tests).
- Todo espacio nace con `#general` (canal público, `Workspace.generalChatId`)
  y su dueño adentro. Un espacio anterior lo recibe la primera vez que se
  listan sus canales, con todos los activos y sin avisos. Si ya existía un
  canal «general», se adopta.
- Quien pasa a activo entra a `#general` y el espacio lo oye una vez:
  «Ana se unió al espacio» (`se-unio-espacio`, texto en
  `shared/avisoDeGrupo.ts`). Pasa al unirse a un espacio abierto, al ser
  aprobado, al agregarlo por número con cuenta, y al reclamar una invitación
  por número o por correo. Reactivar no avisa de nuevo. Sin nombre no hay
  aviso: «Alguien se unió» no dice nada.
- Para el recién llegado, su propio aviso ya viene leído.

**Invitar por correo, una cuenta por persona** (`workspaceEmailInvites.ts`,
4 tests).
- `POST /api/workspaces/:id/invites {email}` (solo admins). Si una cuenta ya
  tiene ese correo VERIFICADO, entra al toque. Si no, queda la invitación
  (`WorkspaceEmailInvite`).
- Al verificar ese correo en el perfil (`/api/me/email/verify`), cada espacio
  que lo invitó lo admite y entra a `#general`. Un correo sin verificar no
  admite a nadie. A alguien desactivado no lo vuelve a meter un correo (409).
- `DELETE /api/workspaces/:id/invites/:inviteId` retira la invitación. Los
  correos que esperan salen en `?status=invited`, junto a los números.
- App y web: «Invitar por correo» va primero en «Invitar personas». Abre la app
  de correo de quien invita, dirigida a ese correo, con el paso «verifica este
  correo en Completa tu perfil» y el código de respaldo. «Miembros y roles»
  suma la pestaña «Invitados», con «Retirar» para los correos.

**E2E web** (servidor de QA): QA Ana creó «QA Empresa 140», invitó a
beto@qa.lilachat.test (fila «INVITADO», listado en Invitados). QA Beto
completó su perfil con ese correo, el espacio apareció en su riel, y el
`#general` de Ana mostró «QA Beto se unió al espacio». Limpieza: espacio,
miembros, chat y avisos borrados (0/0/0); perfiles de QA restaurados.
En el emulador no se probó la pantalla de la app. Para hacerlo, la cuenta de
José tendría que ser admin de un espacio de QA, y eso se ve en su teléfono
real.

**Índices.** `messages {chatId:1,'ref.id':1}` se creó en la bóveda con el OK de
José. `workspaceemailinvites {workspaceId:1,email:1}` (único) y `{email:1}`
están declarados y esperan su OK (sin ellos funciona; el único evita dos filas
en una carrera).


## 101. Cinco arreglos de José: chip de hilo, actualización, visor, fotos y llamada (22/10/2026, 0.1.139)

José, 22/10, con tres capturas.

**1. «3 respuestas» desalineado con la burbuja.** El chip medía su propio
contenido y quedaba más angosto que una burbuja larga. Ahora la burbuja
anota su ancho (`bubbleWidths.ts`, por `chatId:seq`, solo si tiene hilo) y
el chip usa ese ancho como mínimo. No aplica a filas sangradas ni
centradas.

**2. «No se pudo descargar la actualización (Call to function
'FileSystem.downloadFileAsync' has been rejected)» al bloquearse la
pantalla.** Android corta la red de una app en segundo plano.
- La pantalla queda encendida mientras baja el APK (`expo-keep-awake`).
- Una descarga cortada mientras la app estaba afuera sigue sola, una vez:
  `afterCutDownload` (`updateRetry.ts`, 3 tests) decide `resume-now` si el
  corte llega con la app ya al frente (el E2E mostró que el error suele
  llegar DESPUÉS de volver), `resume-on-return` si llega afuera, `none` si
  no fue un corte o ya se reintentó.
- El texto técnico ya no sale en pantalla: «La descarga se cortó al
  bloquearse la pantalla. Sigue sola al volver.» o «No se pudo descargar la
  actualización. Toca «Reintentar».».
- El botón dice «Reintentar» y baja directo (antes reabría «Novedades»).
  «Abrir LilaStore» queda como enlace debajo. Igual en la pantalla de
  actualización obligatoria.
- E2E en el emulador: bajando al 11 %, salir de la app, red cortada 80 s,
  volver: arrancó sola (0 % → 19 % → 50 %), terminó, verificó el sha256 y
  abrió el instalador (cancelado: es un build de desarrollo).

**3. El visor de fotos mostraba los stickers al deslizar** (app y web).
`opensInPhotoViewer` (shared, 2 tests) es la regla única: fotos, GIF y
videos sí; stickers, borrados y archivos no. Un video sin miniatura también
entra (ver 6).

**4. Tras mandar varias fotos, la lista quedaba arriba.** `followsMyNewRow`
(shared, 2 tests): una fila nueva MÍA al final (foto en cola, sticker, GIF,
nota de voz) lleva la lista al final, esté donde esté. Abrir el chat no
cuenta. App (`useFinalDeLaConversacion`) y web (`ListaDeMensajes`). E2E web:
subido 2074 px, mandar 2 fotos → 1 px del final; en el emulador, la lista
bajó a los videos en cola.

**5. Llamada como WhatsApp** (app y web): nombre y tiempo arriba, la cara (la
foto del chat, o las iniciales) al centro, y abajo un panel redondeado con
botones etiquetados: Altavoz, Video, Silenciar, Colgar (el activo, blanco).
Entrante: Rechazar y «Desliza para contestar». La web pasa la foto por
`photoOf`. E2E: web Ana ↔ Beto (entrante, conectada, silenciada) y web Ana →
emulador (entrante, deslizar, conectada, colgó Ana).

**6. Hallado en el E2E: un video sin miniatura no se dibujaba.** En la app la
burbuja quedaba en la hora sola (`miniaturaDe` no devolvía nada). En la web
salía como enlace de archivo. Pasa cuando lila no puede sacar la miniatura
(el uploader de QA nunca la saca). Ahora es un cuadro negro con el play
(`isThumblessVideo`, 1 test) que abre el visor.

**Deuda vista:** borrar un mensaje conserva su campo `system`, así que una
línea de llamada borrada se sigue dibujando. Solo afecta la limpieza de QA,
porque una persona no puede borrar líneas de llamada.


## 100. Web: el chat abierto por URL quedaba vacío al recargar (22/10/2026, web)

Visto en el E2E de §98: recargar sobre `/c/<chat>` (o vincular y entrar por
el enlace) mostraba «Todavía no hay mensajes» y no cargaba nunca. Con clic
sí cargaba.

**Causa.** El JWT de la web vive en memoria: al recargar, el Shell monta con
el token vacío mientras `POST /api/auth/session` lo renueva. El efecto que
abre el chat (última página + acuse) dependía solo de `selectedId`: corría
una vez sin token, `traerPagina` no preguntaba nada (sin token no se pide) y
no volvía a correr. Un chat que este navegador no tenía guardado quedaba
vacío. Medido: tras recargar, ningún `GET /api/chats/<id>/messages`.

**Arreglo.** `useOpenChatWhenReady` (web, 3 tests) abre el chat cuando cambia
y también cuando llega el token. Una vez por selección: un token renovado
no lo vuelve a abrir.

**E2E** (servidor de QA, QA Ana recién vinculada): recargó sobre QA Hilos y
llegó `GET …/messages` medio segundo después de la sesión, con 18 filas. Por
clics (QA Beto → QA Hilos → atrás) hubo un pedido por cada chat, sin
repetir. Perfil restaurado y dispositivo desvinculado.

## 99. GIF en el chat y la pestaña GIPHY (22/10/2026, 0.1.138)

Backlog 37 (José, 21/10: «debo poder subir un gif, es momento de agregar la
sección de GIPHY»; diseño `g-01-panel-gif-giphy`).

**Subir un GIF** ya conservaba la animación: ni la app ni la web lo
recomprimen (`planDeCompresion`) y el server pasa los bytes tal cual. Lo que
faltaba era verlo moverse.
- La burbuja mostraba la miniatura (un cuadro quieto). Ahora un `image/gif`
  usa el archivo: `isAnimatedImage` en `shared/src/gifs.ts`;
  `miniaturaDe` en la app; `GifInBubble` en la web.
- Se mueve 8 s y se detiene, como los stickers animados (`useAnimatedStop`
  en la app; en la web, el cuadro se copia a un canvas). Lleva la marca
  «GIF»; detenido, «▶ GIF».
- Tocarlo detenido lo repite; moviéndose, abre el visor.

**GIPHY por el server** (`server/src/gifRoutes.ts`, 4 tests).
- La llave `GIPHY_API_KEY` la carga José en Torre. Nunca va a la app ni a
  la web.
- Sin llave, `GET /api/gifs` dice `{available:false}` y la pestaña no
  aparece.
- `GET /api/gifs/search?q=&offset=`: tendencias sin palabras, búsqueda con
  palabras. Filtro `pg-13`, en español, de a 24. Las tendencias quedan 5
  min en memoria.
- `POST /api/gifs/send {chatId, gifId, clientKey}`: pide el GIF por su id,
  baja el de 200 px (solo de hosts de GIPHY por https, hasta 4 MB), lo
  guarda en los medios de Lilachat y lo publica como imagen `image/gif`.
  Idempotente por `clientKey`.
- Motor `shared/src/gifs.ts` (3 tests): mapeo de resultados, host
  permitido, tamaño.

**Pestaña «GIF»** en el panel de emojis (app y web).
- Buscador, chips «Tendencias · Gracias · Listo · Jajaja · Buen trabajo ·
  En camino», grilla de 2 columnas y «Powered by GIPHY».
- Se carga más al llegar al final. Tocar uno lo manda.
- Nunca en un chat secreto.

**Defecto previo corregido en la app.** Mantener presionada una foto o un
GIF no hacía nada: la imagen se quedaba con el toque y la pulsación larga
de la fila nunca llegaba. Ahora selecciona el mensaje, como el texto.

**E2E** (servidor de QA con GIPHY simulado solo en su HTTP; la subida y el
mensaje son reales).
- Web (QA Ana): pestaña con 4 resultados y «Powered by GIPHY», chip,
  envío. El GIF se movió, a los 9 s quedó «▶ GIF» y el clic lo repitió.
- App (emulador): el GIF de QA Beto se detuvo con «▶ GIF» y al tocarlo
  volvió a moverse (dos capturas distintas). La pestaña con chips y grilla
  quedó igual al diseño; mandé uno y llegó.
- Las vistas previas del emulador quedan grises: el GIPHY simulado usa URLs
  de GIPHY y el emulador no tiene DNS de internet. Con la llave real cargan.
- Limpieza: el GIF de José, borrado desde la app («Eliminar para todos»);
  el de Beto, por el socket; el de la web, del chat QA. Perfiles
  restaurados.

**Pendiente.**
- Sticker animado propio (`g-02-sticker-animado`): convertir GIF o video a
  WebP animado de 512 px pide un codificador en el server (`sharp` para GIF,
  `ffmpeg` para video). Es una dependencia nativa nueva para el deploy de
  Torre: va con el OK de José.
- La lista dice «Foto» para un GIF: el último mensaje de la lista no trae el
  tipo de archivo.

## 98. La nota de voz sigue sonando fuera del chat, con una barra arriba (22/10/2026, 0.1.137)

Backlog 34 (José, 21/10: «el audio sigue sonando al salir del chat con una
barra arriba»; diseño `a-02-audio-en-curso`).

**Causa.** El reproductor vivía en la burbuja (`useAudioPlayer` en la app,
un `<audio>` por burbuja en la web). Salir del chat la desmontaba y el audio
se cortaba.

**Ahora hay UN reproductor de sesión**, fuera de React.
- App `chat/voicePlayer.ts`: `createAudioPlayer` de `expo-audio`, estado en
  un store (`useSyncExternalStore`). El primer play espera a que cargue
  (`firstPlay`), con el modo de fondo y los controles de pantalla
  bloqueada para notas largas, como antes.
- Web `chat/voicePlayer.ts`: un solo `<audio>`; cada burbuja sigue bajando
  su nota por adelantado.
- La burbuja muestra el estado del reproductor si la nota es la suya; si no,
  su reposo. Se identifica por `chatId:seq`.
- Motor compartido `shared/src/nowPlaying.ts` (2 tests): cuándo se ve la
  barra (fuera del chat de la nota, mientras haya una nota en la sesión,
  sonando o en pausa), «Nota de voz · 0:24 de 1:12» y el avance.
- Al terminar, la nota vuelve al principio y la barra se va, como WhatsApp.

**La barra** (`NowPlayingBar`, app arriba de la lista; web en la lista).
- Muestra el avatar y el nombre de quien la grabó, el tiempo, la velocidad
  (1× · 1,5× · 2×), pausa y la X.
- Debajo, una línea de avance.
- Tocarla abre el chat de la nota; la X la detiene.
- No incluye el «Sonando» en la fila del chat que muestra el diseño:
  queda para después.

**E2E.**
- App (emulador, nota de 40 s de QA Beto en QA Hilos): sonó, salí a la lista
  y la barra mostró 0:21 → 0:25 corriendo. 1,5× y pausa desde la barra;
  tocarla volvió al chat con la burbuja en pausa en 0:04 y 1,5×. La X la
  quitó. Al terminar sola, la barra se fue.
- Web (QA Ana): sonó en QA Hilos, abrí QA Beto y la barra corrió 0:04 →
  0:07. Pausa, volver al chat (la barra se esconde ahí) y la X.
- Notas de QA borradas para todos por el socket (el camino de la app).
- Hallazgo aparte (tarea abierta): en la web, abrir un chat por URL justo
  después de vincular deja la conversación vacía; con clic carga.

**Tests:** web 5 de la nota + 1 de la barra, shared 2; app 483 en verde.

## 97. Pantalla de bloqueo por versión mínima y tarjetas en cola sobre la barra (22/10/2026, 0.1.136)

Stitch terminó la ronda R136. Este lote cierra dos de los cuatro pendientes
que esperaban diseño (backlog 32 y 36); 34 y 37 van aparte.

**32, actualización obligatoria** (diseño `u-01-actualizacion-obligatoria`).
- `UpdateLockScreen` (app): un `Modal` que tapa todo, también un chat abierto.
  Atrás no lo cierra.
- Logo, ícono, rótulo «Actualización necesaria», «Actualiza Lilachat para
  seguir», las versiones, la tarjeta de novedades de la más nueva (hasta 5
  líneas) y «Actualizar».
- «Actualizar» baja e instala dentro de la app, con el progreso. Si falla:
  «Abrir LilaStore». Debajo, «Se descarga desde LilaStore · 35 MB».
- El texto dice «ya no se puede usar», no «ya no se conecta»: el server
  todavía no rechaza versiones viejas (426 sigue pendiente).
- `updateLockContent` (puro, 3 tests).
- La mínima la pone José en LilaStore; hoy está en 0, así que no bloquea.
- E2E: con la mínima forzada en una copia local (sin commitear, revertida),
  el emulador mostró la pantalla igual al diseño, y atrás no la cerró.

**36, tarjetas en cola** (diseño `q-01-tarjetas-en-cola`).
- Derivadas de lo pendiente, no un buzón (`GET /api/agenda/queue?chatId=`,
  `server/src/queueRoutes.ts`, 3 tests):
  - mis tareas atrasadas;
  - eventos sin responder;
  - encuestas sin votar;
  - recordatorios de una vez que sonaron hoy.
- Las encuestas y eventos propios no entran. Cada ítem trae el `seq` de su
  tarjeta en el chat.
- Motor en `shared/src/chatQueue.ts` (5 tests): orden (tareas, eventos,
  encuestas, recordatorios), rótulos, «venció ayer 6:00 p. m.», «Posponer
  1 día» (mañana a la misma hora) y descartes.
- Una tarjeta adelante, las siguientes asoman detrás, «1 de N» y la X.
  - Tarea: «Marcar hecha» y, si se puede editar, «Posponer 1 día».
  - Evento: «Voy» / «No voy».
  - Encuesta: «Votar» abre su tarjeta en el chat.
  - Recordatorio: «Ver en el chat» y «Listo».
- Se refresca sola si la tarjeta del chat cambia (`suscribirTarjeta`).
- Descartar se recuerda en el equipo; la llave lleva la fecha, así que una
  tarea movida a otro día vuelve.
- App `ChatQueue` + `useChatQueue`; web `chat/queue/*` (3 tests).
- La búsqueda de la tarjeta de cada ítem (y `withCardSeq` de los
  checklists) usa el índice `{chatId, 'ref.id'}`, creado en la bóveda el
  22/10 con el OK de José.

**E2E.**
- Web (QA Ana; QA Beto sembró por la API una tarea atrasada, un evento y una
  encuesta): «Tarea atrasada · 1 de 3», «Marcar hecha» pasó al evento, «Voy»
  a la encuesta. La X la descartó y al recargar no volvió.
- App (emulador, cuenta de José; tarea y evento sembrados en la base sin
  tarjetas, para no dejar mensajes en su cuenta): igual al diseño. «Marcar
  hecha» y «No voy» llegaron a la base. La cola quedó vacía.
- Limpieza: lo sembrado por la API se borró por la API y lo de la base, por
  marcador. Chats y perfiles restaurados; el chat de José sin mensajes
  nuevos.

## 96. «Mis tareas» y «Checklists del chat» como sus diseños, y el perfil sin parpadeo (22/10/2026, 0.1.135)

Stitch terminó `k-04-mis-tareas` y `k-05-checklists-del-chat` (estaban en
cuota desde el 21/10). Se compararon con la app y la web.

**k-04, Mis tareas** (app `MyTasksView`, web `MisTareas`).
- Cada grupo: el nombre a la izquierda y «N tareas» a la derecha
  (`taskCountLabel`, test).
- Tono por grupo: atrasadas en rojo, hoy en ámbar (`warning`), el resto
  neutro. Lo toman el rótulo, el círculo para marcar y la pastilla.
- La pastilla de la fecha: mayúsculas, negrita y borde al 30 %.
- Título en una línea.
- `taskDueLabel`: atrasada de antes de ayer dice la fecha («Atrasada · 18
  oct», antes «3 días»); el día de la semana va sin punto («sáb 7:00»).

**k-05, Checklists del chat** (app y web `ChecklistsCard`).
- Rótulo «Control operativo» y título «Checklists del chat».
- A la derecha, «N activos» o «Completos» (`checklistsBadge`, test).
- El completo lleva la pastilla «Completo» junto al título, en verde.
- Ícono de casilla marcada.
- Del diseño no se copió la etiqueta «OBRA #4»: Stitch la inventó, no es
  un dato.
- Las otras tarjetas de la info (Fijados, Media) siguen sin rótulo. El
  diseño se lo pone; queda para cuando se revisen esas tarjetas.

**Perfil sin parpadeo** (defecto de 0.1.133, visto en este E2E).
- La consulta del perfil llegaba después de pintar los chats: la lista se
  veía un instante y saltaba el formulario.
- Ahora decide `profileGateNow` (`shared/profile.ts`, test):
  - Quien el equipo ya vio completo abre al instante; se revisa detrás.
  - Quien no, espera la respuesta: la web no muestra nada y la app, la
    pantalla de carga.
  - Sin red o pasados 5 s, abre como siempre.
- Se recuerda por persona (`profileCompleteKey`), en `localStorage` o
  `AsyncStorage`. Hook web con 4 tests.

**E2E web** (servidor de QA, QA Ana; semilla por la API, el camino del
cliente).
- Primer paint tras vincular: el formulario, con la lista sin montar.
- Mis tareas: «Atrasadas · 2 tareas» con «ATRASADA · 18 OCT» y «ATRASADA ·
  AYER»; «Hoy» en ámbar; «Próximas» con «SÁB 7:00 A. M.».
- Tarjeta: «1 ACTIVO»; «Llegada de maquinaria» con «COMPLETO»; «2 de 6
  listas · 2 atrasadas».
- Los dos checklists se borraron por la API. Sus tarjetas, del chat QA.
  Perfil y dispositivo restaurados.
- La app no se probó en el emulador: haría falta asignarle tareas a la
  cuenta real de José. Usa las mismas reglas, con sus tests.

## 95. Llamadas en la web: hacer y contestar (22/10/2026, 0.1.134)

José (21/10): «¿por qué no podemos hacer y responder llamadas en la web?».

**La misma señalización que la app.** `call.offer`, `call.answer`,
`call.ice`, `call.end` y `call.reject` por el socket de la sesión. El server
no cambió: ya reenviaba a todas las salas del usuario, la web solo no
escuchaba. Contestar en la web apaga el teléfono (`contestada-en-otro`) y al
revés. TURN de Cloudflare con la credencial corta de `GET /api/calls/ice`.

**Motor compartido** (`shared/src/callMedia.ts`, 9 tests). Lo puro que
estaba en la app pasó a `shared` con nombres en inglés: `mediaState`,
`waitBeforeGivingUp`, `callCaption`, `ringStart` y `callerName`. La app
delega (`estadoDeMedios.ts`, `llamadaNativa.ts`); sus 37 tests siguen
verdes. Nuevo: «Ocupado en otra llamada» como leyenda.

**Web** (`web/src/calls/*`).
- `callPeer.ts`: el `RTCPeerConnection`, los candidatos en cola hasta la
  descripción remota, y el ICE con tope de 6 s (como la app; después, STUN).
- `useWebCall.ts` (7 tests con un peer y un socket falsos): la llamada es de
  la sesión, suena sobre cualquier chat. Ocupado responde `call.reject`.
  Los candidatos que llegan antes del peer se guardan. Colgar mientras el
  navegador pide el micrófono lo suelta, no lo deja prendido.
- Sin cámara, una videollamada sigue con la voz y recibe el video del otro
  (`recvonly`), como WhatsApp Web. Sin micrófono, dice qué hacer y avisa al
  otro.
- `CallOverlay.tsx` (3 tests): avatar, nombre, leyenda con reloj; video del
  otro de fondo y el propio en miniatura; silenciar, cámara y colgar.
- `CallProvider.tsx`: tono de timbre y «tuu… tuu» con Web Audio; aviso del
  sistema si la pestaña está oculta (su clic solo trae la pestaña: `sw.js`
  ya no recarga, recargar cortaba la llamada).
- Botones de llamada y video en la cabecera, solo en un 1:1 con persona
  (no contigo, no con una app).

**Bug encontrado en el E2E.** El video del teléfono llegaba mientras sonaba
y el `<video>` se monta al contestar: con un efecto sobre `[stream]` nunca
recibía el `srcObject` y se veía negro. Ahora es un callback ref (test).

**E2E** (servidor de QA, Chrome headless con micrófono falso).
- Web↔web (QA Ana y QA Beto): voz conectada en los dos (reloj, pista de
  audio remota), silenciar, colgar y la línea «Llamada de voz · 00:03».
  Videollamada sin cámaras: conecta con la voz, sin botón de cámara.
  Rechazar: «Llamada terminada» y «Llamada sin respuesta».
- Web → app (emulador, cuenta de José): sonó a pantalla completa, se
  contestó deslizando, reloj en los dos, la web colgó.
- App → web por video: la web contestó sin cámara y vio la cámara del
  emulador (360×640). El teléfono colgó y la web cerró.
- El Chrome headless de macOS no expone cámara, ni falsa: el video
  web → web se probó solo del lado app.
- Push del servidor de QA apagado: el teléfono real de José no sonó.
- Limpieza: líneas de llamada nuevas borradas de los dos chats QA (sin
  reusar `seq`: el emulador las tiene en caché), recibos restaurados,
  perfiles de José, Ana y Beto restaurados, dispositivos web desvinculados.

**Pendiente.** Llamadas de grupo (ni la app las tiene). Compartir pantalla.

## 94. Panel de superadmin: los usuarios de Lilachat (22/10/2026, web)

José (21/10): «yo, el creador superadmin, en la versión web debería tener un
panel para ver qué usuarios hay en Lilachat, cuándo se unieron, etc. Info
básica, nada de leer mensajes».

**Quién lo ve** (`server/src/operators.ts`).
- `isSuperadmin`: el creador (902049935, constante en código) y los
  teléfonos de `LILACHAT_OPERADORES`.
- El creador es un dato del producto, no configuración: no hace falta nada
  en Torre (constroad-code-quality §3-bis).
- El respaldo a mano sigue igual: solo `LILACHAT_OPERADORES` (`isOperator`,
  movido desde `backupRoutes.ts` sin cambiar la regla).

**Server** (`server/src/adminRoutes.ts`, en `/api/admin`, 5 tests).
- Todo exige sesión; quien no es superadmin recibe 403.
- `GET /api/admin` → `{superadmin: true}`. La web lo pregunta al abrir
  Ajustes la primera vez.
- `GET /api/admin/users?q=&page=` → páginas de 50, de la más nueva a la más
  vieja. Solo personas: sin bots (`app`) ni Lila.
- Por persona: nombre, teléfono, foto, correo y si está verificado, perfil
  completo, cuándo se unió, última vez, dispositivos por plataforma,
  espacios activos y quién la invitó.
- Cifras: personas, nuevas esta semana, activas hoy, perfil completo.
- Búsqueda por nombre, correo o un trozo del teléfono, escapada.
- **Nunca** lee chats, mensajes ni agendas: solo `users`, `devices`,
  `workspacemembers` e `invitations`.
- Tres rondas a la base por página; sin índices nuevos (la colección es
  chica). ~0,9 s desde la Mac por el túnel a la bóveda.

**Web** (`web/src/admin/*`, 4 tests; motor en `shared/src/adminUsers.ts`,
6 tests).
- Ajustes › «Usuarios de Lilachat», solo para el superadmin → `/admin`.
- Kicker, título, franja de cifras, buscador con 300 ms de espera, tabla
  desde `md` y tarjetas con rótulo en el celular. Pie «Mostrando 1–4 de 4»
  con anterior y siguiente.
- La búsqueda y la página viven en la dirección (`?q=&page=`).
- Cargando = esqueleto; error ≠ vacío, con «Reintentar»; 403 lo dice.

**E2E web** (servidor de QA, QA Ana operadora solo en ese proceso).
- Ajustes mostró el botón; el panel listó 4 personas con sus cifras.
- «beto» dejó 1 fila y `?q=beto`; al recargar, la búsqueda siguió.
- A 390 px, tarjetas sin desborde horizontal. «Volver» llevó a los chats.
- Beto (no operador): `GET /api/admin` = 403.
- Perfil de Ana restaurado y dispositivo web desvinculado.

**Notas.** Producción tiene hoy 4 personas. José figura con 21 dispositivos
Android: cada reinstalación de QA registra uno nuevo. Es dato real.

## 93. «Completa tu perfil»: nombre, cumpleaños y correo verificado (22/10/2026, 0.1.133)

José (21/10): «debe ser obligatorio nombre y fecha de cumple y un email con su
número de teléfono válidos». Es la parte de alta del backlog 17.

**Qué se pide** (`shared/src/profile.ts`, 8 tests).
- Nombre, día y mes del cumpleaños, y un correo probado con código. El año
  es opcional. El teléfono ya lo prueba el alta.
- `profileMissing` dice qué falta; el server lo manda en `missing`.
- `validateBirthday`: mes 1–12, año 1900–hoy, 29/02 vale sin año.
- `birthdayFieldError` explica el error bajo las cajas («31/4» no existe).
  Antes el botón quedaba apagado sin decir por qué.
- «Que mis chats vean mi cumpleaños» viene encendido; apagado, nadie la ve.

**Server** (`server/src/profileRoutes.ts`, en `/api/me`, 6 tests).
- `GET /profile` y `PUT /profile` (nombre, cumpleaños, visible).
  `PUT /profile` también dispara `announceJoin` (§92).
- `POST /email/code`: código de constroad-auth al correo. 5 por minuto.
  409 si el correo ya está verificado en otra cuenta.
- `POST /email/verify`: con el código, el correo es tuyo. Una cuenta vieja
  que lo tenía sin verificar lo suelta. Una carrera choca con el índice
  único `email` (ya existía, `sparse`): 409, no 500.
- Campos nuevos en `users`: `birthday {day, month, year?}`,
  `birthdayVisible`, `emailVerifiedAt`. Sin índices nuevos.

**App y web.**
- `useProfileGate` lee `GET /profile` al entrar. Si `missing` no está vacío,
  la pantalla tapa todo y no se puede saltar.
- Cuenta nueva: llega después del código. Cuenta vieja: la próxima vez que
  abre.
- Al terminar, el server vuelve a decidir: si falta algo, lo dice.
- Web: el gate va antes de `/instalar-app` y del Shell. Mismos `testID`.

**E2E.**
- Web (QA Ana, servidor de QA): gate visible, «31/4» explicado, «Continuar»
  apagado hasta verificar, código malo rechazado, `000000` aceptado. Entró.
  Al recargar, sin gate.
- Emulador (cuenta de José): gate con su nombre y su correo sin verificar.
  Cumpleaños 29/8, correo de QA, código, «Continuar» → lista de chats. Al
  relanzar, sin gate.
- El servidor de QA acepta `000000` solo para `@qa.lilachat.test`, sin
  mandar correo. Los demás correos van a constroad-auth real.
- Perfiles de José y Ana restaurados a lo de antes (correo de José sin
  verificar, sin cumpleaños). Dispositivo web de QA desvinculado.

**Efecto en producción.** Todas las cuentas actuales verán el gate al
actualizar: ninguna tiene cumpleaños ni correo verificado. Es lo pedido.

**Pendiente del backlog 17:** el aviso de cumpleaños en los chats.

## 92. «Se unió a Lilachat», como Telegram (21/10/2026, 0.1.132)

José (21/10): «si alguien de mis contactos que invité descargó la app y creó
su cuenta, debería llegarme una alerta: se unió a Lilachat, salúdala, así como
lo hace Telegram».

**A quién.** A quien invitó ese número (`invitations.invitedBy`, que guarda el
botón «Invitar»). El servidor no guarda las agendas, por diseño (§contactos),
así que no puede avisar a todos los que tienen el número, como Telegram.

**Cuándo** (`server/src/joinNotice.ts`, 4 tests contra la ruta real del alta).
- Al crear la cuenta, `otp/verify` marca `joinPending` solo en el insert. Las
  cuentas viejas nunca avisan, ni al entrar en un teléfono nuevo.
- Se avisa cuando la cuenta ya tiene nombre: en el mismo alta, o al ponérselo
  después (`PUT /api/me/perfil`). «Alguien se unió» no dice nada.
- Una sola vez: quien borra la marca es quien avisa.

**Cómo.**
- Un aviso de sistema `se-unio` de la persona nueva, en el 1:1 con quien la
  invitó (se crea si no había). Va por el camino de todo mensaje: en vivo o
  por push.
- Quien invitó lee «Aracely se unió a Lilachat»; ella lee «Te uniste a
  Lilachat» (`textoDeAviso`, test). La lista lo muestra igual.
- Debajo, «Saludar 👋» manda «👋». Desaparece cuando ya escribiste algo
  después del aviso (`alreadyGreeted`, test), en la app y en la web.

**E2E en el emulador** (cuenta de José).
- No se puede crear una cuenta real nueva por OTP en QA: solo se usa el
  902049935. El insert del alta lo cubren los tests con la ruta real y un
  constroad-auth falso.
- En vivo: «QA Nueva» (900000803), marcada como recién creada e invitada por
  José, se puso el nombre por `PUT /api/me/perfil`. El chat apareció en la
  lista con «QA Nueva se unió a Lilachat» y 1 sin leer.
- «Saludar 👋» mandó «👋» y el botón desapareció.
- La primera vez no entró en vivo: el servidor de QA se había reiniciado y el
  socket de la app todavía no se reconectaba. Con el socket conectado, entró
  sin refrescar.
- QA Nueva, su chat, su invitación y el mensaje de prueba de Beto se borraron
  y quedaron en cero.

**Pendiente** (pedido de José, 21/10):
- Alta con nombre, fecha de cumpleaños y correo verificado obligatorios, y
  «Completa tu perfil» para quien ya tiene cuenta (backlog 17).
- Panel de superadmin en la web: usuarios, cuándo se unieron e información
  básica, sin mensajes.
- Llamadas en la web.

## 91. La parte visible de la API de bots (21/10/2026, 0.1.131)

Contrato en `specs/BOTS-API.spec.md`. El servidor salió en 787f4e3.

**Instalar** (`web/src/apps/InstallAppScreen.tsx`, 4 tests).
- `/instalar-app` es una página de la web. Quien no tiene sesión pasa por el
  ingreso (QR o código) y vuelve a la misma dirección.
- Muestra la app, lo que podrá hacer, lo que no («No lee los demás mensajes
  ni los chats personales») y los espacios donde la persona es dueña o admin.
- «Instalar» y «Cancelar» vuelven a la dirección registrada de la app. Un
  enlace con una dirección que la app no registró solo muestra el error y no
  manda a nadie a ninguna parte.

**La tarjeta** (`BotCardView`, web con 4 tests y app).
- Kicker, título, estado como pastilla, campos, enlace y hasta tres botones.
  El estado usa el token nuevo `warning` (ámbar, claro y oscuro).
- Un toque llega al bot como `button.click`, y el botón dice «Enviado ✓». El
  bot cierra la tarjeta con PATCH, y `msg.edited` trae la tarjeta nueva, sin
  la marca «editado». La app y la web la reemplazan en pantalla y en lo
  guardado.
- En la burbuja, la hora de una tarjeta va en su renglón; su `body` es solo
  el resumen para la lista y los avisos.

**El bot en el chat.**
- `chatDetail` marca `app: true` y oculta su teléfono interno. La pastilla
  dice «App» (`memberBadge`, test).
- En un 1:1 con un bot no hay llamadas.
- En un chat con un bot instalado no contesta el `@lila` interno: contesta la
  app.

**Integraciones** (Ajustes del espacio, web y app). Muestra las apps
instaladas, quién las instaló y cuándo, el aviso si el último evento no llegó
(`appInstalledLine`, `appDeliveryWarning`; tests) y «Desinstalar», confirmado
antes.

**E2E de punta a punta.** Se usó una app de QA temporal («Lila QA») con un
agentes falso local en :4099.
- Web, con QA Ana: entró a `/instalar-app` sin sesión, se vinculó, siguió en
  la pantalla de consentimiento e instaló.
  - El agentes falso recibió el código con su `state` y canjeó el token.
  - La tarjeta llegó al canal con la marca «App». «Confirmar» produjo un
    `button.click` firmado (valor `pending-77`, teléfono de Ana).
  - El bot la cerró y la web la mostró «Confirmado por QA Ana» sin botones,
    en vivo.
  - «@Lila QA hola» llegó como `message.created` con `mentions_bot: true`.
  - Integraciones mostró la app; al desinstalarla llegó `app.uninstalled` y el
    token pasó a 401.
- Emulador, cuenta de José: la tarjeta en el 1:1 con el bot se dibujó entera.
  «Confirmar» llegó al agentes falso con el teléfono de José y quedó «Enviado
  ✓». La cabecera no ofrece llamar.
- Todo lo de QA se borró y quedó verificado en cero: el espacio, la app, las
  instalaciones, los códigos, las entregas y el usuario bot.

## 90. Menú en bucle en los canales, ventanas que no cerraban, «últ. vez», visor sin negro, video y PDF en la web (21/10/2026, 0.1.130)

**El menú y las reacciones en bucle (web, urgente).**
- Pasaba en un canal del espacio, en el chat y en los hilos: el menú del
  mensaje y las reacciones aparecían y desaparecían arriba a la izquierda.
- Causa: en el formato de canal la barra de acciones se ocultaba con `display:
  none` cuando el mouse dejaba la fila. Los menús cuelgan de esos botones y se
  dibujan fuera de la fila. Al entrar al menú la barra desaparecía y el menú
  perdía su ancla: saltaba a (0, 0), el mouse volvía a la fila, reaparecía, y
  así en bucle. En las burbujas no pasaba porque los botones solo se vuelven
  transparentes.
- Ahora la barra se oculta con opacidad y queda visible mientras hay un menú
  abierto (`has-[[data-state=open]]`).
- E2E: el menú quedó en la misma posición tras 1,5 s con el mouse encima;
  «Responder» abrió la respuesta y la reacción se aplicó.
- No se pudo correr la prueba contra el bundle viejo: el Chrome de pruebas
  murió con SIGSEGV en el primer clic, tres veces.

**Ventanas que no se cerraban (web).** `useDismiss` (4 tests) cierra con un
clic afuera o con Escape. Ignora el botón que abre la ventana y los diálogos
que ella misma abrió, pero no el diálogo donde vive.
- Ajustes: además tiene una X.
- Panel de emojis: escribir en el campo lo deja abierto, como WhatsApp Web, y
  el botón se vuelve X.
- El ⋮ de cada miembro en Miembros y roles.
- Los diálogos (`Overlay`) y el visor ya cerraban.

**«últ. vez» en los 1:1 de la web.** `useLastSeen` pide `presence.ultimaVez`
por el socket, como la app, al abrir el chat y al reconectar. En vivo la trae
`presence`.

**El visor sin negro.**
- App: la foto arranca sobre la miniatura que la burbuja ya tiene en caché
  (`placeholder` de expo-image, sin transición). Lo que yo mandé abre desde su
  copia en el teléfono.
- Web: la miniatura debajo, y la foto entera aparece encima al cargar.
- Emulador: la foto se vio en el primer cuadro después de la animación de
  apertura.

**Video y PDF en la web.**
- El visor dibujaba los videos como una imagen rota. Ahora tienen
  reproductor, y en la burbuja el play sobre su cuadro.
- PDF: lila-app no deja incrustar sus archivos desde otro sitio
  (`frame-ancestors` y `X-Frame-Options`), y ese repo no se toca.
  - `GET /api/chats/:chatId/files/:seq` verifica que la persona sea miembro y
    entrega el PDF (test).
  - La web lo muestra desde memoria (`blob:`) en un diálogo, con «Descargar».
  - La CSP suma `frame-src 'self' blob:`.

**Sin conexión (app).** La cabecera decía «Sin conexión · se enviará cuando
vuelva» en dos líneas. Ahora dice «Conectando…» en una, como WhatsApp; lo que
no salió sigue con su reloj en la burbuja.

**Pendiente.** Las llamadas en la web (WebRTC en el navegador, con la misma
señalización y TURN que la app) son un lote propio.

## 89. La cabecera del chat y la nota de voz como WhatsApp (21/10/2026, 0.1.129)

José (21/10, con capturas de WhatsApp): el ⋮ del chat abría lo mismo que
tocar el avatar; WhatsApp tiene ahí un menú con opciones. Las llamadas van en
una cámara con su flecha, no en dos botones sueltos. Pidió copiar la nota de
voz de WhatsApp sin pasar por Stitch, y avisó que al arrastrar para avanzar o
retroceder se abría «Responder».

**El ⋮ (app).**
- Abre un menú que cae de la cabecera (`HeaderDropdown`), solo con lo que la
  app hace (`chatMenuOptions`, 6 tests):
  - Grupo o canal: Agregar miembros, Info del grupo o del canal, Medios del
    grupo o del canal, Buscar, y Silenciar o Activar notificaciones.
  - 1:1: Ver contacto, Medios, enlaces y docs, Buscar, y Silenciar o Activar.
  - Notas propias: Info, Medios y Buscar.
- «Medios» abre el detalle en «Compartido en el chat»; «Agregar miembros», en
  la hoja de agregar.
- Silenciar = avisos «nada», activar = «todo», los niveles del detalle. Se
  pregunta el nivel al abrir el menú, no al abrir cada chat.

**Las llamadas.** En un 1:1 la cabecera tiene la cámara con ▾, que abre
«Llamada de voz» y «Videollamada». Sale el botón de teléfono suelto. En un
grupo no hay llamadas (F10).

**La nota de voz** (`VoiceNoteView`).
- A la izquierda va la foto de quien la grabó con el micrófono. Mientras suena,
  o pausada a la mitad, la velocidad toma su lugar (`showsSpeed`).
- Después, el play grande, la onda con su bolita (`knobLeft`; con un borde del
  color de la burbuja para que se despegue de las barras) y la duración
  debajo.
- En el formato Slack la fila ya muestra la foto: ahí va solo el micrófono.
- **El arrastre abría «Responder».** La barra usaba el sistema de respuesta de
  React Native, y deslizar para responder es un `Gesture.Pan` nativo, que
  siempre le gana. Ahora la barra es un gesto nativo que arranca a los 3 dp,
  antes que los 12 dp de «Responder», y lo toma primero.

**E2E en el emulador** (cuenta de José, nota de voz de QA Beto subida por
`/api/media`).
- Arrastrar adelante saltó a 0:06 y empezó a sonar, con «1×» en lugar de la
  foto. Arrastrar atrás fue a 0:03. «Responder» no se abrió nunca.
- El ⋮ del grupo mostró las cinco opciones. «Medios del grupo» abrió el
  detalle en Compartido. Silenciar cambió la opción a «Activar
  notificaciones», y activar la devolvió.
- En el 1:1, la cámara ▾ abrió voz y video (se cerró sin llamar).
- La nota de QA se borró con «Eliminar para todos» de Beto.

## 88. El guiño de otro chat, el riel cortado, la versión de la web y la barra del modo empresa (21/10/2026, 0.1.128)

José (21/10): en la web, abrir «Developers Lila» mostraba el chanchito una y
otra vez, aunque ese chat no tiene guiños. Además, los íconos del riel se
veían cortados, en claro y en oscuro, y la web no decía qué versión corre. En
la app, el modo empresa seguía con la barra del modo personal.

**El guiño de otro chat (web).**
- Al cambiar de chat, la lista de mensajes del chat anterior queda un render
  más. `useFunPlayback` la medía contra el cursor del chat nuevo. El 1:1 con
  Wilson tiene su chanchito en el seq 227 y «Developers Lila» va por el 73: 227
  > 73, y sonaba. Pasaba cada vez que salía de ese chat a uno con menos
  mensajes.
- No era el arreglo de la §84, que cubría solo el guiño propio viejo.
- Ahora el hook descarta los mensajes que no son del chat abierto
  (`funPlayback.test.tsx`, rojo antes del arreglo).
- E2E con QA Ana, que abre su 1:1 con José (guiños en 41–42) y «QA Hilos»
  (seq 12). Ida y vuelta tres veces: nada suena. Con el bundle sin el arreglo,
  la misma prueba hizo sonar el guiño del 1:1 en «QA Hilos» dos veces.
- La app no tiene el problema: cada chat es una pantalla nueva.

**El riel de espacios (web).**
- El bloque del medio tenía `overflow-y-auto`, que también recorta en
  horizontal, y se encogía al ancho del ícono (48 px). El anillo de selección y
  los contadores, que sobresalen, quedaban cortados. Una barra de scroll
  clásica le comía además ancho.
- Ahora los dos bloques ocupan los 72 px del riel y el scroll no muestra barra
  (`.rail-scroll`).
- `rounded-xl` vale 24 px en los tokens: el botón de 48 px era un círculo con
  un logo cuadrado adentro, y el anillo redondo cortaba las esquinas. El botón
  usa ahora el radio del logo (12 px); el personal sigue redondo.
- El borde del anillo y de los contadores es del color del riel
  (`background`), en claro y en oscuro.
- E2E a 1000×560 con cuatro espacios: ningún ícono queda cortado a los lados,
  en claro ni en oscuro.

**La versión de la web.** Al compilar, Vite escribe `__WEB_VERSION__`: la
versión del producto (`app/app.json`), el commit corto y la hora del build.
Torre compila desde `git archive`, sin `.git`: el commit sale del nombre de la
carpeta de la release (`20261021-210455-a236fc2`). Si no hay de dónde sacar un
dato, la etiqueta sale sin él y el build no falla. Ajustes la muestra al pie: «Lilachat web 0.1.128 · 6914ede · 21/10
20:55» (`webVersionLabel`, 2 tests).

**La barra del modo empresa (app).**
- Personal: Chats · Pendientes · Encuestas · Ajustes. En un espacio, según el
  diseño `e-07`: Chats · Directorio · Menciones · Ajustes. Son cuatro y no
  cinco, como dibuja `e-19`, porque la quinta se corta.
- Directorio y Menciones abren sus pantallas sobre la lista.
- Al entrar o salir de un espacio, una pestaña que la barra nueva no tiene
  vuelve a Chats (`bottomTabs.ts`, 4 tests).
- Emulador: entrar al espacio cambia la barra; Directorio y Menciones abren;
  volver a Personal la devuelve.

## 87. Menciones y actividad, logo del espacio, cargo en la pastilla y archivados del espacio (21/10/2026, 0.1.127)

Cierra lo que quedaba del modo empresa salvo la sección APPS y Llamadas en el
riel (§85).

**Menciones y actividad** (diseño `e-19`), en la app y en la web.
- `GET /api/activity?type=mentions|threads|reactions&workspace=&counts=1`
  devuelve las tarjetas y `unread: { mentions, threads }`:
  - Menciones: mensajes de otros que me nombran, o con @todos o @aquí.
  - Hilos: los que tienen respuestas donde escribí la raíz o respondí.
  - Reacciones: mis mensajes con reacciones de otros.
  - Nuevo = `seq` mayor que lo que leí. Un hilo es nuevo si su última
    respuesta es posterior a lo leído y no es mía.
- Server: 5 tests. Shared `activity.ts` (4 tests): pestañas, si me nombra,
  reacciones de otros y secciones por día en hora de Lima (Hoy, Ayer, Esta
  semana, Anteriores).
- La lista del espacio tiene los chips «Hilos» y «Menciones» con su cuenta.
  Abren «Menciones y actividad»: pestañas, tarjeta con autor, chat o #canal,
  el texto con sus menciones y «Responder en el chat», que abre el mensaje.
- App: `ActivityScreen`. Web: `ActivityDialog`; al cerrarlo se recargan las
  cuentas.

**Logo del espacio.**
- `POST /api/workspaces/:id/logo` y `DELETE`: solo admin o dueño. Se guarda
  como foto redonda en `espacio-<id>` y se sirve con URL absoluta.
- Se ve en la cabecera, el riel, la vista previa por código y la invitación.
- App: Ajustes del espacio → elegir foto (`elegirFotoRedonda`). Web: un
  campo de archivo en Ajustes, con «Restablecer».

**El cargo en la pastilla.** En un chat de espacio, `chatDetail` trae el
`title` y el `spaceRole` de cada miembro. La pastilla muestra el cargo; sin
cargo, el rol del espacio (Dueño, Admin); `memberBadge`.

**Archivados del espacio.**
- Un chat archivado sale de las secciones y queda en «Archivados (n)», como
  en la lista personal (`splitArchived`, test).
- App: mantener presionado un grupo o un 1:1 del espacio abre la misma barra
  de la lista personal. Permite archivar, fijar, silenciar, marcar leído y
  salir. La selección salió a un hook compartido (`useChatSelection`), y
  atrás la suelta. Los canales no se seleccionan.
- Web: el menú de la fila, como en la lista personal.

**Contadores al día en la app.** Desde la 0.1.124 la lista del espacio no
bajaba la cuenta al leer un chat. Ahora escucha `receipt` de mis lecturas en
sus chats y recarga una vez; también cuando leo desde la web.

**Lo que destapó el E2E.**
- En la app, la tarjeta de actividad perdía el texto después de la mención:
  los tramos iban en un `View` y no en un `Text`. Saltaba un aviso de LogBox.
- QA: el subidor falso firma los medios con `http://10.0.2.2` (el emulador).
  La CSP de la web solo admite imágenes `https:` o del mismo origen, así que el
  E2E web reescribe esas URLs a 127.0.0.1. En producción van por https.
- El Chrome headless del E2E moría al crear un subproceso. Se arregló con
  `--disable-features=AudioServiceOutOfProcess`.

**E2E.**
- Web headless, con QA Ana y QA Beto. Beto menciona a Ana por socket en
  #planta.
  - Chip «Menciones 1» → tarjeta «@Tú … #planta» → abre el canal.
  - Pastillas «Dueño» y «Residente de obra (Tú)».
  - Archivar desde el menú → «Archivados (1)» → aparece al abrirlo.
  - El logo subido se ve en el riel.
- Emulador, cuenta de José:
  - «QA Beto te agregó» llega en vivo.
  - Chip «Menciones 1» → tarjeta → el grupo, con la pastilla «Gerente
    general».
  - La cuenta del 1:1 sube con un mensaje y baja al leerlo.
  - Mantener → barra → archivar → «Archivados (1)». Atrás suelta la
    selección.
- Datos de QA borrados y verificados en cero.

**Deuda.** Cambiar el logo o el nombre no avisa en vivo a los miembros: lo
ven al volver a la app o al recargar.

## 86. Audio y video al primer toque, y la tarea asignada la marca su responsable (21/10/2026, para la 0.1.126)

José (21/10): «al pulsar el audio, en Lilachat carga y luego reproduce; en
WhatsApp reproduce automáticamente, lo mismo con el video. Las tareas
asignadas a alguien solo esa persona puede marcarlas, y el admin (owner)
también».

**Notas de voz, como la descarga automática de WhatsApp.**
- Una nota a la vista se descarga al teléfono en segundo plano
  (`app/src/chat/voiceNoteCache.ts`): de a dos, en `cache/voz`, con un nombre
  seguro y un hash corto de su ruta (`voiceNoteName.ts`, 4 tests).
- El play usa el archivo local; el reproductor sigue naciendo al primer toque
  y nunca arranca solo. La fuente se fija al tocar: si la descarga termina
  mientras suena, no se reinicia.
- Por qué tardaba: un `m4a` grabado tiene el índice (`moov`) al final. Sin el
  archivo completo, el reproductor pide rangos y espera.
- Emulador: la nota visible quedó en `cache/voz` sola. A los 0,3 s del toque
  ya sonaba, sin indicador de carga.
- Web: la nota en pantalla se precarga (`preload = 'auto'`). La lista es
  virtual, así que solo bajan las que se ven.

**Video.** El visor arranca con medio segundo de búfer (`minBufferForPlayback:
0,5`; Android esperaba 2 s), y mientras carga se ve la portada con un
indicador en vez de una pantalla negra. Los videos ya llegaban con el índice
al principio y el servidor responde rangos (206).

**Checklist: una tarea asignada la marca su responsable o quien creó el
checklist.**
- `canToggleTask` (shared, 3 tests): el responsable la marca aunque el
  checklist diga «solo yo marco». Una tarea sin responsable sigue la regla del
  checklist.
- Server: 403 «Esta tarea tiene responsable: solo esa persona o quien creó el
  checklist la marca» (test).
- App: el círculo de una tarea ajena se ve tenue, y al tocarlo avisa «Es de QA
  Ana: solo esa persona o quien creó el checklist la marca». Web: deshabilitado,
  con el mismo texto en el título.
- Los admins del grupo que no crearon el checklist no la marcan: «el admin
  (owner)» se tomó como quien creó el checklist.

## 85. Modo empresa completo, el riel como WhatsApp Web con Medios, invitar por correo y «Responder» con teclado (21/10/2026, 0.1.125)

**Pantallas de empresa** (diseños `e1-08`…`e1-14`), en la app y en la web.
- Arriba de la lista del espacio va «Espacio de trabajo»:
  - Directorio de equipo, para todos.
  - Miembros y roles, Solicitudes (con cuántas esperan) y Ajustes del
    espacio, para quien lo administra.
- **Directorio** (`e1-08`): búsqueda por nombre, cargo, área o teléfono, chips
  por área con su cuenta, «EN LÍNEA» y un botón para escribir. Con el «+» de
  MENSAJES DIRECTOS es el selector del 1:1 dentro del espacio.
- **Perfil** (`e1-09`): rol, área y cargo, «Mensaje», teléfono para copiar,
  «Se unió» y los canales en común (salen de los chats del espacio). Llamar
  y video siguen dentro del chat.
- **Miembros y roles** (`e1-10`): Activos · Pendientes · Desactivados con su
  cuenta.
  - El ⋮ ofrece solo lo que el rol permite (`memberActions`, las mismas reglas
    del server): hacer admin, volver a miembro, cambiar a invitado,
    desactivar (con confirmación) y reactivar.
- **Solicitudes** (`e1-11`): tarjeta con cuándo entró con el código, el área
  (Obra · Planta · Flota · Admin.) y el cargo, y «Rechazar» o «Aprobar».
  Rechazar borra la solicitud (`DELETE /api/workspaces/:id/members/:memberId`,
  solo pendientes) y no la manda a Desactivados.
- **Ajustes** (`e1-12`): nombre, rubro, aprobación y «Cambiar código» (el
  anterior deja de funcionar). Subir el logo espera dónde guardarlo.
- **«Te agregaron»** (`e1-13`): una vez por espacio al que otra persona me
  agregó.
  - Lo vistos se guardan en el dispositivo (`lilachat.pref.seenSpaces` en la
    app, `lilachat.espacios-vistos` en la web).
  - La primera lista solo siembra lo visto, así que actualizar no saluda los
    espacios que ya estaban.
- **«Ya no tienes acceso»** (`e1-14`): si me desactivan en el espacio abierto,
  vuelvo a Personal con esa pantalla, sus admins y «Hablar con un admin», que
  abre un 1:1 personal.
- **Grupo nuevo dentro del espacio**: el «+» de GRUPOS, con nombre y personas
  del espacio.

**Server.**
- `GET /api/workspaces` suma lo que piden esas pantallas (`workspaceInfo.ts`):
  - `pendingRequests`, para quien aprueba.
  - `addedBy`, quién me agregó.
  - `admins`, solo si me desactivaron.
- Los miembros traen `joinedAt`, `requestedAt` y la foto absoluta.
- **Aviso en vivo `workspaces.changed`** (`workspaceNotices.ts`, emitido por el
  socket): les llega a los admins cuando hay una solicitud nueva, y a la
  persona cuando la aprueban, la agregan, la rechazan, la desactivan o le
  cambian el rol. App y web releen sus espacios. Así «Solicitudes 1», «te
  agregaron» y «sin acceso» aparecen sin recargar. La app también relee al
  volver y al tirar la lista hacia abajo.
- Shared: `workspaceMembers.ts` (13 tests) con `roleLabel`, `memberActions`,
  `changeForAction`, `directoryAreas`, `filterMembers`, `SPACE_AREAS`,
  `requestedAgo`, `joinedLabel` y `newlyAddedSpaces`, y el tipo
  `ClientWorkspaceMember`.

**Riel de la web como WhatsApp Web** (pendiente 38; `rail/AppRail.tsx`).
- Arriba: Chats, Pendientes y encuestas, y Destacados.
- Al medio: Personal y cada espacio, o «+» si todavía no hay ninguno.
- Abajo: Medios, Ajustes y mi perfil.
- Se muestra siempre que se ve la lista. El pie de la lista con mi nombre y el
  engranaje sale: el riel ya los tiene.
- Al cambiar de espacio se cierra el chat abierto. En el celular el chat del
  espacio anterior tapaba la lista.
- Las listas encogen junto al riel a 390 px (`min-w-0`).
- Llamadas entra al riel cuando haya un historial de llamadas que mostrar.

**Medios** (`GET /api/media/library?type=photos|videos|files|links&workspace=&before=`).
- Fotos, videos, documentos (una nota de voz no cuenta) y enlaces: el primer
  enlace de cada mensaje, con `primerEnlace`.
- De los chats personales o de un espacio, nunca un chat secreto ni uno
  borrado. Del más nuevo al más viejo, de a 60.
- Por mes en las pantallas (`mediaMonthSections`: «Este mes», «Septiembre»…).
  Un toque abre el chat en ese mensaje.
- Web: el botón del riel. App: Ajustes › Medios, del espacio abierto o
  personal.
- Índice `{chatId, kind, at}`, creado a mano en la bóveda el 21/10 con el OK de
  José (la bóveda no crea índices sola).

**Invitar por correo primero** (José, 21/10).
- «Enviar por correo» es el botón principal; después van WhatsApp y Copiar.
- Usa `mailto:` desde el correo de quien invita, con asunto y cuerpo de
  `spaceInviteEmail`.
- El correo enviado por el server queda para cuando constroad-auth tenga un
  texto que diga que se entra con el número e incluya el código (§84).

**«Responder» abre el teclado** (José, 21/10, como WhatsApp): en la app la
barra toma el foco 250 ms después de que se cierra el menú del mensaje. La web
ya lo hacía.

**El control segmentado** de la app no parte una etiqueta en dos renglones
(«Documentos» con la letra grande): una línea, con la letra un poco más chica
si hace falta.

**E2E.**
- Web, en Chrome sin ventana, como QA Ana con QA Beto por API, a 1280 y
  390 px:
  - el riel y Medios;
  - crear un espacio, la solicitud de Beto aprobada con área y cargo, y Beto
    hecho admin;
  - un 1:1 desde el directorio con un enlace que sale en Medios del espacio;
  - un grupo y los ajustes;
  - «te agregaron» y «sin acceso».
  Sin errores en la página ni scroll lateral.
- App en el emulador, con la cuenta de José en espacios de prueba:
  - «Responder» con el teclado arriba;
  - la solicitud que aparece en vivo, aprobada con área y cargo, y el rol de
    admin;
  - directorio, perfil y «Mensaje»; el grupo nuevo y los ajustes;
  - Medios con el enlace, que abre el chat en el mensaje;
  - «te agregaron» y «sin acceso» en vivo.
- Limpieza verificada en cero.

**Lo que queda del modo empresa.** Subir el logo, Hilos y Menciones, la
sección APPS, el cargo del espacio en la pastilla del chat y Llamadas en el
riel. La deuda de la §84 sigue: archivar dentro de un espacio no esconde el
chat de esa lista. (Resuelto en la §87, salvo APPS y Llamadas.)

## 84. Espacios de empresa y canales en la app y en la web, y los arreglos del zumbido y los stickers (21/10/2026, 0.1.124)

**Server** (`server/src/workspaces.ts`, 19 tests).
- `GET /api/workspaces` suma `members` (miembros activos) y `unreadChats`
  (chats del espacio con algo sin leer para mí), que piden el selector y el
  riel.
- `POST /api/workspaces/:id/leave` con una solicitud pendiente la retira
  («Cancelar solicitud» de `e1-03`).

**Shared** (`shared/spaceSections.ts`, 11 tests).
- `spaceSections`: Canales (por nombre, #general primero), Grupos y Mensajes
  directos (por última actividad). Las tres secciones salen siempre.
- `spaceInitials`, `spaceInviteMessage`, `filterChannels` (Todos · Públicos ·
  Privados con su cuenta), `SPACE_RUBROS`, `spaceSubtitle` («Construcción · 48
  miembros»), `membersLabel` y `railSpaces` (activos y pendientes; sin
  espacios no hay riel).
- Tipos `ClientWorkspace`, `WorkspacePreview` y `ClientChannel` en
  `shared/workspaces.ts`.

**App** (`app/src/spaces/*`; diseños `e1-02`…`e1-06`, `e2-15`, `e2-16`, `s-03`).
- El título de Chats («Lilachat ▾» o el espacio con su logo) abre «Cambiar de
  espacio». Desde ahí: unirse con código (con vista previa y solicitud
  pendiente que se puede cancelar), crear un espacio (al crearlo se abre
  «Invitar»), invitar (código, WhatsApp y agregar por número).
- Dentro de un espacio, la lista va por secciones (`SpaceChatsScreen`), cada
  una se pliega, y los canales son filas cortas con «Agregar canal». Todo chat
  del espacio abre en formato Slack.
- «Canales» explora y crea canales (públicos o privados).
- El espacio abierto se recuerda (`lilachat.pref.space`). Si la persona sale
  o le quitan el acceso, vuelve a Personal.

**Web** (`web/src/spaces/*`, 10 tests).
- **Riel de espacios** a la izquierda (`SpacesRail`, como el `e1-06` de
  escritorio): Personal con sus sin leer, cada espacio con los suyos, y «+».
  Solo aparece si la persona está en algún espacio: con la cuenta personal
  sola, la web sigue igual a WhatsApp Web.
- Sin espacios, la flecha junto a «Lilachat» abre el mismo selector.
- `SpaceChatList` reemplaza a la lista personal dentro de un espacio: cabecera
  con logo, miembros y rubro, buscador, secciones plegables, el código con
  «Copiar» al pie y los Ajustes.
- Diálogos: `SpaceSwitcher`, `JoinSpaceDialog`, `CreateSpaceDialog`,
  `InviteToSpaceDialog`, `ChannelsDialog` (con `wide` en el `Overlay`
  compartido) y `CreateChannelDialog`.
- El espacio abierto se recuerda en este navegador (`lilachat.espacio`).
- **Sin polling:** un evento del socket (`msg.new`, `receipt`,
  `chat.changed`) de un chat que no está en la lista personal recarga la
  lista del espacio (600 ms) y las cuentas del riel (2 s), una vez por ráfaga.
- La cabecera de un canal dice «#planta-web».

**La carrera que encontró el E2E** (test en `currentSpace.test.tsx`).
- La primera carga de «mis espacios» respondió DESPUÉS de la recarga de un
  espacio recién creado. La lista vieja, vacía, ganó, y la pantalla volvió a
  Personal.
- Ahora solo escribe la respuesta del último pedido, en la web y en la app.
- La lista de un espacio tampoco acepta la respuesta de otro espacio si la
  persona cambió en el camino (web: comparación con el espacio a la vista;
  app: `key` por espacio).

**Arreglos de la web y de la app** (José, 21/10, ya publicados en `main`).
- El zumbido o guiño propio viejo ya no vuelve a sonar al entrar al chat:
  `funMessageToPlay` solo cuenta los míos de los últimos 30 s
  (`FUN_LIVE_MS`).
- Mandar un sticker cierra el panel, como WhatsApp.
- El panel recuerda su última pestaña (emojis, stickers o guiños):
  `lastPanelTab` en shared, localStorage en la web y una preferencia en la
  app.
- La lista de emojis de la web sigue el tema oscuro.
- App: un sticker guardado en favoritos aparece al instante en «Favoritos»
  (la biblioteca es un store con suscripción).

**E2E.**
- App en el emulador: crear, invitar, entrar, crear canal, mensaje plano y
  volver a Personal.
- Web en Chrome sin ventana como QA Ana, a 1280 y 390 px: selector, crear,
  invitar, riel, canal, mensaje plano, Personal y vuelta, y recarga con el
  espacio recordado. Sin errores en la página y sin scroll lateral a 390.
- Limpieza verificada en cero (espacios, miembros, chats, mensajes, acuses y
  dispositivos web de QA).

**Invitar por correo primero** (José, 21/10: «es empresarial, debe ser por
email y luego por WhatsApp»).
- «Enviar por correo» es el botón principal en la app y en la web; debajo van
  WhatsApp y Copiar.
- Sale desde el correo de quien invita (`mailto:`): Gmail, Outlook o el que
  tenga, con asunto y cuerpo armados (`spaceInviteEmail`): quién invita, dónde
  bajar Lilachat (teléfono o computadora), que se entra con el número y el
  código. En la app, sin app de correo, se abre el menú de compartir.
- El mensaje de WhatsApp ahora también dice dónde bajar la app.
- **Por qué no un correo enviado por el server:** constroad-auth ya tiene
  `POST /v1/invitaciones`, pero su texto dice «entrá con este mismo correo»
  (Lilachat entra con el número), está en voseo y no lleva el código. Además,
  la llave de Lilachat tendría que declarar el origen pelado en Torre para que
  el botón lleve a `/e/<código>`. Queda como siguiente paso, con cambios en
  constroad-auth.

**Lo que falta del modo empresa.**
- Pantallas `e1-08`…`e1-14`: directorio, perfil del miembro, miembros y
  roles, solicitudes, ajustes, agregado y desactivado.
- Chips Hilos y Menciones, sección APPS, mensaje directo y grupo nuevo dentro
  del espacio, subir el logo, y el cargo del espacio en la pastilla (hoy va
  el rol del chat).
- Deuda: archivar un chat dentro de un espacio no lo esconde de esa lista. La
  web personal pide `/chats` cuando llega un evento de un chat de espacio
  (venía de antes).

## 83. Formato Slack en grupos, el audio que arranca al primer toque, avisos de tareas y la versión nueva al volver (21/10/2026, 0.1.123)

**Formato Slack** (diseños `s-01-grupo-formato-slack` y `s-02-hilo-abierto`).
- `shared/flatLayout.ts` (4 tests):
  - `usesFlatLayout`: los grupos y canales de un espacio de empresa van
    siempre como lista; un grupo personal, solo si la persona lo pide; un 1:1
    y «Tú» siempre con burbujas.
  - `memberBadge`: la pastilla junto al nombre (cargo del espacio, «Dueño»,
    «Admin», más «(Tú)»). No se muestra si repite el nombre.
- **App:**
  - `FlatMessageRow`: avatar de 40, nombre (el mío en el acento), pastilla,
    hora y check, y debajo el texto sin burbuja, con la letra del chat. Los
    mensajes seguidos (5 min) van sin encabezado.
  - Dibuja la media (`MessageMedia`, que salió de `MessageRow` para no
    duplicar), las tarjetas (`CardBody`, que salió de `TarjetaDelChat`) y los
    stickers (con su freno de 8 s).
  - Reacciones, barra y chip de hilo se alinean tras el avatar (`indent`).
    Los avisos, guiños y zumbidos siguen con su línea propia.
  - El hilo en ese formato: la raíz como fila grande con su pastilla y
    «N RESPUESTAS» con una línea; las respuestas, como filas.
  - Ajustes › Chats › «Grupos como lista» (apagado por defecto), con un store
    de preferencias sin provider (`ui/prefStore.ts`) que ahora usa también la
    letra del chat.
- **Web:** la misma fila (`FlatMessage` en `BurbujaDeMensaje`), con las
  acciones al pasar el mouse arriba a la derecha y la hora del agrupado al
  pasar el mouse. El panel del hilo la hereda por el contexto. El interruptor
  vive en el panel de Ajustes; `ChatSummary` suma `workspaceId` y `channel`.
- **Lo que falta del modo empresa:** los espacios y canales en la app y la web
  (E1 y E2 del cliente, con sus diseños e1-* y e2-*), y la lista por
  secciones (`s-03`). Hasta entonces el formato se ve con el interruptor.

**El audio** (pendiente 34).
- Causa del «segundo toque»: el primer toque crea el reproductor y le pide
  `play()` antes de que cargue, y Android lo ignora. Ahora espera `isLoaded`
  (`firstPlay`); mientras carga, el botón muestra la ruedita.
- La barra se toca o se arrastra para ir a un punto, también antes del primer
  play (arranca desde ahí). El tiempo sigue al dedo.
- `shared/voiceNote.ts` (3 tests): velocidad, arrastre y primer play, los
  mismos para app y web. La app dejó sus copias.
- **Web:** antes solo tenía play/pausa. Ahora tiene arrastre, flechas del
  teclado, 1× · 1,5× · 2×, el tiempo corriendo y una sola nota a la vez
  (3 tests).
- **Falta**: seguir escuchando al salir del chat con una barra arriba. Espera
  diseño.

**Avisos de tareas** (pendiente 35).
- `taskDoneNotices` en shared (4 tests):
  - Quien creó el checklist se entera de cada marca, y cada responsable de
    las suyas. Quien marcó, de nada.
  - Si el checklist queda completo, se avisa eso a quien lo creó y a todos los
    responsables.
- `checklistNotices.ts` espera un minuto por persona y checklist: tres marcas
  seguidas son un aviso, y marcar y desmarcar por error no avisa nada. El
  timer no retiene el proceso.
- `notifyTasksDone` manda como las reacciones: a quien está fuera de línea y
  no silenció el chat. Tocarlo abre el chat en la tarjeta (test del server).

**La versión nueva al volver** (pendiente 32).
- App: la consulta del arranque corre también al volver a la app, a lo sumo
  cada 30 min (`shouldRecheckVersion`, 4 tests).
- Web: al volver a la pestaña compara el bundle publicado en `index.html` con
  el cargado (`newVersion.ts`, 4 tests). Si cambió, muestra «Hay una versión
  nueva de Lilachat · Recargar» arriba de la lista. Sin polling.
- **Falta** la pantalla que bloquea bajo la versión mínima. Espera diseño.

**Análisis del 33:** §82.

**Índices** de `checklists` creados en producción con el OK de José:
`chatId_1_createdAt_-1` e `items.assignee_1`.

**E2E:**
- App (emulador contra el server de QA):
  - «Grupos como lista» en «QA Hilos»: filas planas, «Admin (Tú)», barra
    alineada.
  - El hilo con su raíz y «1 RESPUESTA».
  - El 1:1 sigue con burbujas.
  - Nota de voz: arranca con el primer toque (sesión de medios en PLAYING).
    Se borró para todos después.
  - El interruptor quedó como estaba.
- Web (QA Ana): burbujas por defecto; con el interruptor, autores «Tú,
  QA Beto, J zamora» con «Admin». Sin banda de versión al cargar. Sin errores.
  La web vinculada se desvinculó (verificado en 0).

## 82. Análisis: que el Portal y otros sistemas escriban en Lilachat (pendiente 33, 21/10/2026)

José (21/10): «analizar un MCP de Lilachat para que otros puedan crear
checklists y enviar mensajes, como lo que hoy hace el Portal cuando miden
líquidos, hacen consumos, firman asistencia, inician producción o entran y
salen despachos». Es análisis: no hay código todavía.

**Lo que ya está decidido (§73) y se reusa tal cual:**
- La identidad del sistema vive en Lilachat, como bot o app del espacio, con
  una llave `lc_…` (solo se guarda el hash y `last4`), scopes, límite de tasa
  e `Idempotency-Key`.
- Los avisos de una app a un canal van por **webhook entrante**
  (`POST /api/hooks/:hookId/:token`, §73.3), sin agentes en el medio. Las
  acciones que crean cosas en el Portal pasan por agentes (Lila).
- José no quiere llaves emitidas por el Portal: las emite el admin del espacio
  en Integraciones (e4-23) y José las carga en Torre para el Portal.

**Qué avisos del Portal irían a qué canal** (cada uno nace apagado, con
«Probar envío», como pide `web-app-blueprint` §5):

| Evento del Portal | Canal sugerido | Tarjeta |
| --- | --- | --- |
| Medición de líquidos (tanques) | `#planta` | nivel por tanque, alerta si baja del mínimo |
| Consumo registrado | `#planta` | material, cantidad, quién |
| Asistencia firmada (entrada, salida) | `#asistencia` | resumen del día, no una tarjeta por persona |
| Inicio de producción | `#planta-asfalto` | diseño, m³ previstos |
| Despacho entra o sale | `#despachos` | unidad, pedido, guía; se reemplaza (`PATCH`) al llegar |

**Lo que falta en Lilachat:**
1. **Checklist por API:** `POST /api/bots/checklists` con `{ channel | chatId,
   title, items: [{ text, assignee?: phone, dueAt? }], pin? }`, que crea el
   mismo checklist de §80 y §81. El responsable va por teléfono porque el
   Portal no conoce los ids de Lilachat; se resuelve contra los miembros del
   espacio y, si no está, la tarea queda sin responsable y se avisa en la
   respuesta. También va por webhook entrante (`type: 'checklist'`). Por
   ejemplo, el checklist de inicio de producción sale solo al programarla.
2. **Avisos resumidos:** la asistencia de 40 personas no puede ser 40
   mensajes. La tarjeta del día se reemplaza con cada firma (`PATCH` de
   §73.2), igual que el despacho que cambia de estado.
3. **MCP:** un servidor MCP que no tiene lógica propia, montado sobre la misma
   API con la llave del bot.
   - Herramientas: `send_message`, `create_checklist`, `list_channels`,
     `read_recent` (solo los canales donde está el bot) y `update_card`.
   - Transporte HTTP en `/mcp` del mismo server (Bearer `lc_…`), así agentes,
     Claude o cualquier cliente MCP lo usan sin otro despliegue.
   - Sirve para que un agente escriba o lea en un canal; la integración del
     Portal no lo necesita (el webhook alcanza).
4. **Depende del modo empresa del lado del cliente (E1 y E2 en la app y la
   web):** sin espacios ni canales visibles no hay dónde publicar. Los
   diseños existen (e1-*, e2-*, e4-22, e4-23).

**Fases propuestas:**

| Fase | Qué | Dónde |
| --- | --- | --- |
| B1 | Integraciones (e4-23): crear un webhook entrante por canal, token visible una vez, revocar; tarjeta de app (e4-22) | Lilachat |
| B2 | Checklist por API y por webhook; reemplazar una tarjeta | Lilachat |
| B3 | Servidor MCP sobre la API (llave del bot) | Lilachat |
| B4 | Los 5 avisos del Portal a sus canales, apagados por defecto, con «Probar envío» y el WhatsApp en paralelo hasta que José decida | Portal (su propia sesión) |

**Riesgos:**
- Un webhook es una URL con secreto: se guarda en Torre, nunca en el repo,
  y se revoca desde Integraciones.
- El volumen de asistencia y despachos: tarjetas que se reemplazan y no
  mensajes nuevos, y un límite por token.
- Los datos personales (teléfonos en la asistencia) solo van a canales
  privados.

## 81. Checklist con responsables y fecha, «Mis tareas», letra del chat y stickers animados (21/10/2026, 0.1.122)

**Checklist, segunda vuelta** (pendiente 30; diseños `k-03`, `k-04`, `k-05`).
- **Modelo:** cada tarea suma `assignee` (un miembro del chat) y `dueAt`; el
  checklist guarda `cardSeq`, el seq de su tarjeta. Índices declarados
  `{chatId, createdAt}` e `{'items.assignee'}`: en producción se crean solo
  con el OK de José (la bóveda no crea índices sola).
- **Rutas nuevas** (`checklistRoutes.ts`, 14 tests):
  - `PATCH /checklists/:id/items/:itemId`: texto, responsable (tiene que ser
    del chat) y fecha. `DELETE …/items/:itemId` deja al menos una tarea.
    Editar sigue a «los demás pueden agregar».
  - `PATCH /checklists/:id`: título y permisos; solo quien lo creó. Cambia
    también el texto de su tarjeta («Checklist: …»).
  - `DELETE /checklists/:id`: borra también su tarjeta para todos, como un
    mensaje eliminado (sale de los fijados y el hilo se descuenta).
  - `GET /checklists?chatId=`: progreso y atrasadas por checklist, para la
    info del chat. `GET /checklists/mine`: mis tareas pendientes.
  - Crear fija la tarjeta 30 días por defecto (`pin: false` para no). Con
    `hiloDe` va dentro de un hilo y no se fija.
  - Los checklists de la 0.1.121 no tenían `cardSeq`: se busca su tarjeta
    una vez, en una sola consulta, y queda guardado.
- **Reglas puras** (`shared/src/checklists.ts`, 18 tests): estado de la fecha
  (atrasada, hoy, próxima, sin fecha), «Hoy 3:00 p. m.» y «Atrasada · ayer»,
  las fechas rápidas, «Mis tareas» agrupadas, el chip activo de la hoja,
  «Ana T.», los miembros con «Tú» primero y la línea de la info.
- **Tarjeta (app y web):**
  - Debajo de cada tarea pendiente: el responsable con su avatar y la fecha
    como pastilla. Atrasada va en el tono de error, hoy en el acento y lo
    demás en gris; no hay token ocre.
  - **Dos blancos táctiles:** solo el círculo marca y el texto abre la hoja.
    José, 21/10: «está inestable el editar con el marcar». Antes la fila
    entera marcaba y el mantener presionado editaba, y competía con el
    mantener de la tarjeta.
  - Hoja «Editar tarea»: texto, responsable, «Para cuándo» (Hoy · Mañana ·
    días · Elegir fecha · Sin fecha), «Guardar cambios» y «Quitar la tarea».
    Es un borrador hasta guardar; en la web es un diálogo en portal.
  - «⋯» solo para quien lo creó: «Editar checklist» (título y permisos) y
    «Eliminar el checklist», con confirmación.
- **Info del chat:** tarjeta «Checklists» con progreso y atrasadas; tocar uno
  va a su tarjeta. En la app salió `ChatInfoCards` de `ChatScreen`, que estaba
  en 600 líneas.
- **«Mis tareas»:**
  - App: segmento en Pendientes, «Agenda · Mis tareas» con contador. La línea
    que aprobó José el 20/10 no cambió.
  - Web: tercera pestaña del panel.
  - Se marca desde ahí, y tocar abre el chat en el checklist.
- **Hilos:** el botón de checklist en la cabecera del hilo (app y web) crea
  uno dentro del hilo, y su tarjeta vive en las respuestas.

**Letra del chat** (pendiente 1; diseño `f-01`).
- `shared/chatFont.ts`: Pequeña 13/18, Mediana 15/21 (la de siempre), Grande
  17/24.
- App: `ui/chatFont.ts`, un store sin provider en AsyncStorage. Lo leen
  `TextoConHora` (chat e hilo) y la barra de escribir, un punto más grande.
  El ajuste está en Ajustes, con su vista previa.
- Web: variables `--chat-font` y `--chat-line` en `<html>`, un px menos
  (Mediana = 14, la de siempre). Burbuja y barra; el ajuste va en el panel de
  Ajustes.

**Stickers animados** (pendiente 31).
- Pack «En movimiento», `lila-mov`: 15 personajes de los guiños con sus bailes
  (`shared/animatedStickers.ts`, `danceAt`). Un baile ya empieza y termina en
  reposo, así que el bucle no salta.
- `web/scripts/render-animated-stickers.mts` dibuja cada cuadro en Chrome y
  `img2webp` los une: WebP animado de 512×512 a 12 fps, cada uno de 167 a
  358 KB (tope de WhatsApp: 500 KB), 3,6 MB el pack.
- Es un pack más del catálogo: el server lo acepta como los demás y el panel
  lo muestra.
- En el chat se reproduce 8 s y se detiene, como WhatsApp; un toque lo repite.
  App: `stopAnimating` de expo-image. Web: el cuadro se copia a un canvas
  encima. Una imagen rota no se congela.

**E2E** (emulador con la cuenta de José contra el server de QA, chat «QA
Ana»; web headless como QA Ana).
- App:
  - Desmarcar, asignarme «Hoy», ver «Tú · Hoy 6:00 p. m.».
  - «Mis tareas» con la tarea; tocarla abre el chat.
  - La info muestra «Checklists 2 de 3» y salta.
  - Checklist en un hilo de «QA Hilos»: crear, editar el título, eliminar.
    La tarjeta huérfana se limpió a cero.
  - Letra Grande en la vista previa y la barra.
  - Panda animado: se mueve, se detiene a los 8 s y se repite con un toque.
- Web:
  - Sin «⋯» para quien no lo creó.
  - El diálogo asignó «Tú · Mañana 9:00».
  - La info muestra «Checklists 1 de 3» y «Mis tareas» las agrupa en
    Próximas.
  - La burbuja pasa de 14 a 16 px.
  - El formulario del hilo no ofrece «Fijar».
- Limpieza: 2 webs de QA Ana desvinculadas (verificado en 0).

## 80. Checklist como Telegram, devolver la llamada perdida, guiños al lado de quien los mandó y la web (21/10/2026, 0.1.121)

**Checklist** (pendiente 8; diseños `k-01-checklist-en-el-chat` y
`k-02-crear-checklist`).
- **Modelo:** `ChecklistModel` (`server/src/checklistModel.ts`): título y
  tareas con `id` propio, quién la agregó, `doneBy` y `doneAt`, más
  `othersCanMark` y `othersCanAdd`. Índice `{chatId, createdAt}`.
- **Rutas** (`checklistRoutes.ts`, 5 tests), bajo `/api/agenda/checklists`:
  crear, leer, marcar o desmarcar una tarea, agregar una tarea y borrar.
  - Cualquier miembro de un chat no secreto lo crea y su tarjeta sale al chat
    («Checklist: …», `kind: 'checklist'`, `ref.tipo: 'checklist'`).
  - Quien lo creó marca, agrega y borra siempre; los demás, solo si lo
    permite.
  - Marcar toca solo esa tarea, con el estado que tenía como guardia: si dos
    marcan a la vez, el segundo recibe 409 y la tarjeta se recarga.
  - Cada cambio avisa `ref.changed` y las tarjetas se actualizan en vivo.
- **Reglas puras** (`shared/src/checklists.ts`, 9 tests): validación (hasta 30
  tareas de 200 letras, sin repetidas), permisos, marcar y progreso. La lista
  de chats muestra su ícono y el título; el aviso dice «Checklist: …».
- **App:**
  - «Checklist» en el clip (Organizar). La grilla pasó a 4 columnas: con 3,
    «Recordatorio» quedaba cortado.
  - Pantalla «Nuevo checklist» y tarjeta en el chat, con progreso, quién marcó
    cada tarea y cuándo, y «Agregar tarea». El check sale al instante y vuelve
    atrás si el server lo rechaza.
- **Web:** la misma tarjeta (`tarjetas/ChecklistEnElChat`) y «Checklist» en
  el menú «+».
- **Ya funciona sobre la tarjeta:** reaccionar, responder en hilo y deslizar
  para responder, igual que una encuesta.
- **E2E:**
  - App: creado en el chat QA Ana; marqué una tarea en el emulador y QA Ana
    otra por API. Se vio en vivo («Tú · 1:06», «QA Ana · 1:07», 2 de 3).
  - Web: QA Ana marcó la tercera (3 de 3).
- **Lo que falta** (pendiente 30).

**Devolver la llamada perdida** (pendiente 23).
- En la línea «Llamada perdida» del 1:1 van «Llamar» y «Recordarme». Recordarme
  ofrece En 15 min · En 1 hora · Esta tarde · Esta noche · Mañana
  (`callBackOptions`).
- Crea un recordatorio PERSONAL: sin `chatId`, el otro no lo ve en el chat. Lleva
  `callBack {chatId, video}`; al sonar, el aviso abre ese chat.
- El server solo lo acepta desde un 1:1 propio.
- En la web solo va «Recordarme devolverla», porque la web no llama.
- E2E con una llamada perdida real en el emulador. El recordatorio quedó con
  `chatId: null` y el `callBack` del chat; ya está borrado (0 quedaron).

**Guiños y zumbidos al lado de quien los mandó:** los míos a la derecha en
lila, los del otro a la izquierda en blanco, como los mensajes. App y web.

**La hora del sticker** va debajo, como WhatsApp. Encima tapaba el sticker; la
web ya la tenía abajo.

**Web:**
- El logo lleva al inicio.
- Botón claro/oscuro a la vista (`ThemeToggle`, `toggledTheme` con test).
  Ajustes › Apariencia sigue ofreciendo «Sistema».
- La hora salía «0:37 p. m.»: `hour12: true` deja que algunos navegadores usen
  el reloj de 0 a 11. Ahora es `hourCycle: 'h12'` en `formatClock` y en los
  otros formateadores.

**Nota de E2E:** en el build de desarrollo, una «r» doble tecleada fuera de un
campo recarga la app (el atajo «R R» de React Native). Con el teclado de
hardware del emulador pasó con «reservada». No existe en el APK publicado.

## 79. Guiños fluidos en Android, miniaturas, hilos grandes y el zumbido para quien lo manda (21/10/2026, 0.1.120)

José, 21/10, probando la 0.1.119 en su teléfono:
- «el chanchito lo veo muy lento, en la web se ve fluido»; después «la apk se siente lenta»;
- el guiño se repetía al volver a entrar al chat, y seguía sonando afuera;
- quería ver una miniatura del guiño en el chat, y los hilos «aparecen pero son muy pequeños»;
- su propio zumbido no le vibraba, y no había forma de repetirlo sin mandar otro.

**Medido en el emulador** (build de desarrollo, `dumpsys gfxinfo` durante el chancho):

| | Antes | Después |
| --- | --- | --- |
| Cuadros en ~8 s | 112 (14 por segundo) | 392 (~46 por segundo) |
| Cuadros lentos | 100 % | 3 % |
| Cuadro típico | 133 ms | 24 ms |
| Imágenes resubidas a la GPU | 112 de 112 | 0 |

**Causa.** En Android, react-native-svg dibuja cada SVG en un bitmap del tamaño
de su vista y lo tira en cada `invalidate()`. Cada parte del personaje era una
capa del tamaño de todo el actor (~20 capas): por cuadro se redibujaban ~20
bitmaps grandes. La web anima el SVG en la GPU y por eso iba fluida.

**Arreglo** (`web/scripts/render-wink-images.mts`, `app/src/chat/winkImages.ts`):
- Cada parte del personaje y cada pieza se pre-renderiza como WebP recortado a
  su propia caja (`WinkArtPart.box`, que ahora escribe el extractor). Son 163
  imágenes en 2 MB.
- La app reproduce la misma línea de tiempo moviendo imágenes (expo-image), que
  se decodifican una vez. La web sigue con el SVG vivo.
- Las miniaturas (tarjeta del guiño y panel) también son imágenes: el chat ya
  no parsea un SVG por guiño al hacer scroll.

**Otros arreglos de rendimiento:**
- **Audio:** cada sonido se libera al terminar (`winkSounds`). Antes quedaban
  vivos hasta 26 reproductores.
- **Al salir del chat**, el guiño y sus sonidos se cortan (`stopFun`).

**Comportamiento:**
- Al abrir el chat solo se reproduce lo que te mandaron. Lo tuyo suena cuando
  sale, en vivo (`funMessageToPlay({ mineToo })`): ya no se repite al volver.
- Tu propio zumbido te sacude la pantalla y vibra cuando sale.
- La línea del zumbido trae «Ver otra vez» (sacude y vibra, sin mandar nada).
- La tarjeta del guiño muestra la miniatura (64 dp), quién y cuál
  (`winkCardLines`).
- El resumen del hilo mide 48 dp, con avatares de 28 y «N respuestas» en 15 px
  en negrita. En la web, 44 px.

**Pendiente de medir:** la memoria base del build de desarrollo es alta (~440 MB
nativos en la lista) y no se puede comparar con el teléfono. Hace falta medirla
en un build de release.

## 78. El guiño que Wilson no veía, el hueco bajo el sticker y los avisos como WhatsApp (21/10/2026, 0.1.119)

José, 21/10, con la 0.1.117:
- a Wilson no le salía a pantalla completa el guiño que José le mandaba, ni con
  «Ver otra vez»;
- el sticker mandado desde el panel dejaba un hueco abajo;
- los avisos de WhatsApp tienen «Responder» y se agrupan; los de Lilachat no.

**El guiño (app y web).**
- La base estaba bien: los dos guiños de ese chat se guardaron con su `wink`,
  el server los reenvía completos (`messageView`) y el teléfono los guarda
  enteros.
- En el emulador, con el chat abierto, llega y se ve (el PARE).
- **Causa 1: «Quitar animaciones».** Lo activan el ahorro de batería de Samsung
  y el ajuste de accesibilidad.
  - `shouldPlayFun` saltaba la animación.
  - Reanimated, por su cuenta (`ReduceMotion.System`), termina al instante
    cualquier `withTiming`.
  - Reproducido en el emulador con las tres escalas de animación en 0: «Ver
    otra vez» no mostraba nada; con el arreglo, el panda sale entero.
- **Causa 2: el chat silenciado.** No se reproducía nada, ni con «Ver otra
  vez».
- **Regla nueva** (`shouldPlayFun({ place })`, 3 tests):
  - en el chat abierto, siempre se ve; silenciado, solo sin sonido;
  - «Ver otra vez» se reproduce entero, con sonido;
  - en una fila de la lista, silenciado sigue quieto y con «menos movimiento»
    no se mueve.
- **Animaciones:** las del guiño y el zumbido van con `ReduceMotion.Never`.
- **Lo leído al abrir** se toma UNA vez (`readAtOpen`). El panel ancho recibe
  el chat vivo y, si los mensajes tardaban en cargar, la marca de leído ya
  había avanzado y el guiño contaba como visto.

**El hueco bajo el sticker** (`useFinalDeLaConversacion`).
- Al abrir, el panel reserva espacio debajo de la lista (`blankSpace`). Al
  cerrarlo, la lista bajaba sola solo si no había llegado nada mientras estaba
  abierto.
- Con el sticker recién mandado quedaba arriba, con el hueco del panel.
  Reproducido en el emulador (sticker + «atrás»).
- Ahora, al cerrarse el panel estando al final, la lista baja al final después
  de la animación (`PANEL_MOVE_MS`).

**Avisos.**
- Los equipos de José y Wilson tienen `mensaje-nativo`. El push llega
  solo-datos y el aviso nativo (`AvisoDeMensaje`) ya trae «Responder» y
  «Marcar como leído».
- Lo que no tenía: con la app ADELANTE (otro chat o la lista), la app dejaba en
  la bandeja un aviso de `expo-notifications`, sin acciones ni grupo.
- Ahora, como WhatsApp, con la app adelante solo suena el tono de notificación
  del teléfono (o vibra en modo vibrador) y no queda nada en la bandeja
  (`playInAppAlert`). Un build viejo sin la función sigue con el aviso de antes.
- Los avisos nativos se agrupan (`setGroup`) bajo un resumen «N mensajes de M
  chats», con una línea por chat. No suena (`GROUP_ALERT_CHILDREN`) y se va con
  el último chat.
- **Sin verificar en el teléfono:** el push y el resumen no se pueden probar
  contra el server QA, que no manda push. Se verifica con la versión
  publicada.

## 77. Guiños con remate, no bailes: los sketches (21/10/2026, 0.1.118)

José, 21/10: «¿todos los personajes bailan? ¿Dónde está el globo que te
enviaban? El que abraza debe abrazar; se trata de que sean graciosos, no de que
todos bailen. El chanchito, gordito, moviendo y enseñando el rabo». Reemplaza
el «cómo se mueven» de §74: cada guiño es ahora un **sketch** con planteo y
remate, como los de MSN. Solo el cono baila.

**Los 16 sketches** (`shared/winkSketches.ts`, 6–7 s):

| Guiño | El chiste |
| --- | --- |
| Chancho fiestero | Entra, guiña, se da vuelta y mueve el poto con el rabito enroscado (que crece), vuelve y tira un beso (corazón a la cámara) |
| Globo de agua (nuevo) | Vuela hacia la pantalla, revienta contra el vidrio (sacudón) y el agua escurre |
| Corazón galán | Guiña dos veces de verdad (un ojo) y te tira la rosa, que vuela girando hacia la cámara |
| Panda abrazón | Camina hasta la pantalla y la abraza: cierra los brazos y la aprieta tres veces (la pantalla se encoge) |
| Maestro de obra | Se acerca al vidrio y golpea tres veces con el puño; al tercero se raja y él sale corriendo |
| Oso hincha | Aplaude, salta y explota un «¡GOL!» con confeti |
| Gato de fiesta | Sopla la corneta (la cabeza se infla, la pantalla tiembla) y sale el cañón de confeti; salta |
| Perro carcajada | Se ríe tanto que se cae y rueda pataleando |
| Café de lunes | Bosteza, se duerme (Zzz), suena el despertador, salta del susto y sale corriendo |
| Ladrillo fisicoculturista | Tres poses; en la última se infla enorme y la pantalla retumba; besa su bíceps |
| Cono cumbiero | El único que baila: pasos de cumbia y doble giro |
| Rodillo chévere | Cruza la pantalla dejando una franja de asfalto que humea |
| Volquete fanfarrón | Toca la bocina, se inclina y descarga un cerro de arena abajo |
| Excavadora rockera | Headbanging con la guitarra y la estrella contra el piso; vuelan los pedazos |
| Asfaltador acalorado | Suda, humea y se derrite en un charco; vuelve a pararse |
| Señalero estricto | Pita el silbato y la paleta de PARE llena toda la pantalla |

Los emojis quedan como estaban.

**Arte.** Hojas nuevas de Stitch: `y-a` (chancho de frente y de espaldas,
galán y café con cara articulada) y `y-b`/`y-c` (16 piezas de utilería). El
extractor (`web/scripts/extract-wink-art.mjs`) ahora:
- saca los ojos y la boca como partes con `parent: 'head'` (se mueven con la
  cabeza y además solas: guiño, bostezo);
- separa la rosa de la mano del galán (`held`, la suelta al tirarla);
- dibuja el rabo del chancho de espaldas encima del cuerpo (Stitch lo dibujó
  debajo);
- escribe solo los estilos que no son los de por defecto. Antes leía estilos de
  un clon suelto (vacíos); ahora los lee de la página.
- Resultado: `WINK_ART` (16 personajes) y `WINK_PROPS` (16 piezas), 148 KB.

**El motor (`shared/winkTimeline.ts`, puro, con tests).**
- Actores (personaje o pieza) con claves en el tiempo (0–1): posición en
  fracciones de la pantalla, `scale` en unidades de escenario, `sx`/`sy`
  (negativo = espejo; de 1 a −1 es darse vuelta), giro y opacidad.
- **Cada propiedad es su propia pista.** Si una clave que solo gira detuviera
  la caminata, los sketches no se podrían componer.
- La curva de cada clave dice cómo se LLEGA a ella («out» frena, «in» acelera).
- Unidad de escenario: el ancho, pero no más de ¾ del alto ni 560 px (en un
  celular parado manda el ancho; en un escritorio ancho, el alto).
- `fit: 'width'`: la pieza ocupa todo el ancho (la franja de asfalto).
- Efectos de pantalla compartidos (`SCREEN_EFFECTS`): golpe, choque, retumbo y
  apretón.

**Renderizadores.**
- **App** (`WinkSketch.tsx`): UN valor de progreso; cada propiedad se
  interpola en el hilo de UI con la misma curva (worklet `sample`). Una capa
  SVG por parte; la cara va dentro de la cabeza. Lo que el sketch no mueve
  queda quieto.
- **Web** (`WinkSketch.tsx` + `sketchFrames.ts`): la misma línea de tiempo
  muestreada cada 20 ms en keyframes de Web Animations.
- **Sonidos y efectos** (`winkCues`): se programan en su momento. Un guiño
  nuevo cancela lo pendiente del anterior, y la música se corta al terminar.
  En la lista de chats solo suena un «ting» (`winkRowSound`).

**Sonido.** 21 efectos nuevos sintetizados por nosotros: ting, boing, beso,
whoosh, salpicón, gota, golpe, vidrio, golpe sordo, apretón, hinchada,
corneta, risa, bostezo, ronquido, despertador, motor, chisporroteo, silbato,
guitarra rota y un riff de rock. Todos los sonidos de guiño pasaron a MP3: 26
archivos en 336 KB, menos que los 5 WAV de antes (458 KB).

**E2E.**
- **Web** (Chrome headless contra el server QA, «Vista previa»): los 16
  congelados en 9 momentos cada uno y revisados cuadro por cuadro. Se
  corrigieron el «¡GOL!» que tapaba al oso, el gato y el ladrillo flojos, el
  humo gigante del asfalto, la guitarra sobre la cara y el tamaño en
  escritorio.
- **App** (emulador, chat QA Ana): chancho y globo grabados en video. Se ven
  igual que en la web: el sacudón de pantalla y el decodificador MP3 sonando.
  Sin errores de JS.

## 76. La web: logo, modo oscuro, fondo de puntos, lista que se arrastra y avisos del sistema (21/10/2026, en la web desde el push del 21/10)

Cierra los pendientes 24–28 (José, 21/10). Diseños `n-01-web-oscuro-lista` y
`n-02-web-lista-plegada`.

**Logo** (`ui/Logo.tsx`): el mismo logotipo de la APK (`LOGO` de shared) en la
cabecera de la lista, en el riel plegado y en «Vincular». Cambia de tinta con el tema
(observa la clase `dark` del `<html>`).

**Modo oscuro** (`ui/tema.ts`, 2 tests)
- La paleta de Tailwind son variables: `rgb(var(--c-NOMBRE) / <alpha-value>)`,
  definidas en `:root` (claro) y `html.dark` (oscuro) con `addBase`.
- `darkMode: 'class'` y `safelist: ['dark']`. Sin el safelist, Tailwind purga
  `html.dark` (nadie escribe esa clase en el código) y la paleta oscura no
  llega al CSS.
- Ajustes › Apariencia: Claro · Oscuro · Sistema, guardado por equipo
  (`lilachat.tema`). «Sistema» sigue a `prefers-color-scheme` en vivo.
- Sin parpadeo blanco: `public/tema-inicial.js` pone la clase antes de pintar.
  Es un archivo y no un script en línea porque la CSP es `script-src 'self'`.

**Fondo de puntos**: clase `chat-fondo` (`index.css`), un `radial-gradient`
sobre `--c-chat-bg`, igual que `FondoDelChat` de la app.

**Lista que se arrastra y se pliega** (`layout.ts`, `useListLayout`,
`ListResizeHandle`, `ChatRail`)
- El borde se arrastra (puntero con captura, sin seleccionar texto), se mueve
  con las flechas (16 px) y vuelve a 380 px con doble clic.
- `clampListWidth`: entre 280 y 560 px, y la conversación nunca baja de
  420 px. Ancho y plegado se guardan por equipo (`lilachat.anchoLista`,
  `lilachat.listaPlegada`).
- Plegada queda un riel de 72 px con el logo, los avatares de los chats (con
  su punto de no leídos) y «Desplegar» abajo.

**Avisos del sistema** (`notify/browserNotice.ts`, `notify/notificationsOffer.ts`)
- El server solo manda push a los equipos sin socket vivo. Una pestaña oculta
  tiene socket, así que no le llegaba nada: ahora `useSincronizacion` muestra
  el aviso local (`registration.showNotification`) si la pestaña está oculta,
  el mensaje es de otro y el chat no está silenciado. El texto sale de
  `armarAviso`, el mismo de la app. Tocarlo abre `/c/<chatId>`.
- Banda «Activa las notificaciones…» arriba del chat solo con el permiso en
  `default`. «Ahora no» la esconde 14 días.

**E2E** (Chrome headless contra el server QA, QA Ana)
- Logo, puntos y modo oscuro (`rgb(15, 23, 42)` de fondo) presentes.
- Plegar → riel; desplegar → lista. Flechas: 380 → 412, guardado. Arrastre del
  mouse: 380 → 436 siguiendo al puntero.
- Pestaña oculta + zumbido de J zamora: aviso «J zamora · Te mandó un
  zumbido».
- Banda visible con el permiso en `default`.
- El dispositivo vinculado por el E2E se borró al terminar.

## 75. El recordatorio que suena se responde como un mensaje (21/10/2026, 0.1.117)

José, 21/10: en el chat con Wilson le apareció el recordatorio, pero no podía
reaccionar, responder ni mandar un sticker.

**Causa.** Cuando un recordatorio suena (o se acerca un evento), el cron
escribe en el chat un aviso del sistema (`kind: 'system'`, evento
`recordatorio-suena` / `evento-pronto`). Todos los candados trataban cualquier
aviso como «línea gris»:
- el server: `reacciones.ts`, `hilos.validarRaiz`, `mensajesFijados` y `destacadosRoutes`;
- shared: `puedeReaccionar` y `puedeAbrirHilo`;
- la app: el aviso destacado era una `View` sin gestos;
- la web: era una tarjeta sin botones.

La tarjeta del recordatorio *creado* (`ref.tipo === 'recordatorio'`) ya se
había arreglado el 20/10. Esta es la otra, la del recordatorio que *sonó*.

**Arreglo.** La regla vive en un solo lugar: `shared/actsAsMessage` (cualquier
mensaje, más los avisos destacados). El server filtra con
`ACTS_AS_MESSAGE_FILTER` y los clientes usan `puedeReaccionar` y
`canOpenThread` (antes `puedeAbrirHilo`). Así queda cada superficie:
- **App (`HighlightedNotice`):** se desliza para responder (también con
  sticker) y se mantiene presionada para elegirla (reacciones, hilo, fijar,
  destacar). La barra de reacciones, las reacciones y el chip del hilo van
  centrados.
- **Web:** la tarjeta lleva los botones de cualquier mensaje al pasar el mouse
  (reaccionar, hilo, menú).
- **Lo que no se puede:** «Info» y «Eliminar para todos». Al aviso lo escribió
  el server, no una persona.
- **Las líneas grises** («Ana cambió la foto») siguen sin acciones, como en
  WhatsApp.

**E2E (emulador + web headless, QA Hilos):**
- Mantener presionado selecciona el recordatorio y abre la barra con «Responder en hilo».
- 👍 quedó guardado: sigue ahí al reabrir el chat.
- Deslizar abre «Respondiendo · ⏰ Recordatorio: Pagar la luz», y el sticker salió citándolo.
- En la web: los tres botones, ❤️ (queda «👍 1 · ❤️ 1»), el menú sin Info y la cita al responder.

## 74. Guiños y el zumbido completo (21/10/2026, 0.1.117)

José, 21/10: «sigue con lo que falta de los pendientes de messenger, los
guiños, las animaciones y todo lo que te puse para ese feature».

**Guiños.** Un mensaje `kind: 'guino'` con `wink: <id>` del catálogo
compartido (`shared/winks.ts`). No lleva contenido, así que también va en
chats secretos. El panel los muestra en tres grupos:
- **Personajes (9)** y **Obra y pistas (6):** personajes propios de cuerpo
  entero (`kind: 'character'`). Los dibujó Stitch como hojas de assets
  (`x-a`…`x-e`), y se extraen con `web/scripts/extract-wink-art.mjs` a
  `shared/winkArt.ts`: el markup de cada parte, con colores en línea, más su
  articulación.
- **Emojis (8):** los primeros guiños, con emoji grande, rebote y meneo
  (`kind: 'emoji'`; José: «deja los emojis que tenías antes, están bien»).

**Lo que costó llegar al tono (lección, memoria `product-art-tone-matches-audience`
y skill `stitch-design` §5-bis).**
1. Emoji girando → «no son personajes, no se mueven».
2. Mascotas chibi con mejillas, moños y melodía de xilófono → «todo es muy
   infantil, esto no es una app de niños; el de Messenger era más gracioso y su
   baile duraba más».
3. Final: humor adulto estilo Flash de los 2000, con gags de oficio:
   - Chancho fiestero con gafas y cadena;
   - Maestro de obra bigotón;
   - Café de lunes;
   - Corazón galán;
   - Oso hincha;
   - Gato de fiesta;
   - Perro carcajada;
   - Panda abrazón;
   - Ladrillo fisicoculturista;
   - Cono cumbiero;
   - Rodillo chévere;
   - Volquete fanfarrón;
   - Excavadora rockera;
   - Asfaltador acalorado;
   - Señalero estricto.

**Cómo se mueven (`shared/winkDances.ts`; reemplazado por los sketches de §77, las danzas quedan como recurso).** Son marionetas: cada parte gira
sobre su articulación (hombro, cadera, cuello, cola).
- **Diez coreografías:** disco, cumbia, aplauso, salto, abrazo, risa, saludo,
  fisicoculturista, rockero y cansado.
- **Son desfases desde la pose dibujada**, que arrancan y terminan en 0: la
  pose de Stitch ES el gag, así que se baila alrededor de ella.
- **Duración:** un guiño de personaje dura 6,5 s y el bucle se repite hasta
  llenarlo.
- **App:** una capa SVG por parte (react-native-svg + Reanimated, con
  `transformOrigin` en la articulación). Quieto, en las tarjetas, es una sola
  capa.
- **Web:** un `<g>` por parte, con `transform-box: view-box` y Web Animations.

**Sonido** (en MP3 desde §77). Archivos propios, sintetizados y sin licencias, en
`app/assets/sonidos/wink-*` (copiados a `web/public/sonidos`):
- un groove de funk (bombo, caja, hi-hat, bajo y acorde; 112 BPM, 6,6 s) para
  los que bailan;
- campana, pop, aplausos y bocina para el resto.

La melodía infantil se quitó.

**A pantalla completa y cuándo se reproduce.**
- Va encima de TODO, sin tomar toques: en la app con `FunScreen` en la raíz;
  en la web con un overlay `fixed`.
- **Partículas:** con semilla del `seq` (`winkParticles`), así se ven igual en
  la app y en la web, para quien manda y para quien recibe.
- **Al llegar** con el chat abierto, y **al abrir el chat**: el último que
  llegó sin leer suena una sola vez (`funMessageToPlay`).
- **El que mando** también se reproduce en mi pantalla.
- **«Ver otra vez»** lo repite.

**Zumbido.**
- **Movimiento:** solo en el eje X, unos 2 s en pasos de 65 ms
  (`NUDGE_SHAKE`, igual en la app y la web). Antes era tan rápido que parecía
  un salto del scroll.
- **App:** con el chat abierto tiembla la pantalla entera. En la lista de
  chats tiembla la fila (también solo en X) y el celular vibra unos 2 s.
- **Web:** cualquier zumbido mueve toda la ventana, aunque haya otro chat
  abierto, y suena un buzz.

**Silencio y accesibilidad (`shouldPlayFun`).**
- Un chat silenciado no se mueve, no suena y no vibra.
- Con «reducir movimiento» no hay animación, pero sí sonido y vibración.

**Grupos.** En un 1:1 los zumbidos y guiños siempre van. En un grupo, solo si
un admin los enciende:
- `Chat.funAllowed`, que llega en la lista y en el detalle;
- `PATCH /api/chats/:id/fun` (`setGroupFun`, solo admins);
- `ensureFunAllowed` lo aplica en el socket, con un límite de uno cada 10 s
  por tipo, persona y chat;
- en la app es la tarjeta «Diversión» de la info del grupo, y en la web la
  fila «Zumbidos y guiños».

**Dónde se eligen (José, 21/10).** En el panel del botón de emoji, pestaña
«Guiños»: arriba va el Zumbido y debajo los tres grupos. Al tocar uno, sale
la vista previa y el botón «Enviar».

El clip (y el «+» de la web) ya no tiene título ni sección Divertido; quedan
Compartir, Organizar y la fila de fotos recientes con «Ver todas»
(`m-01-clip-ordenado`).

**Diseño en Stitch (pipeline de la skill):**
- `m-01`…`m-05`: el clip, el panel de guiños, el guiño a pantalla completa, las líneas del chat y la tarjeta «Diversión»;
- `x-a`…`x-e`: las hojas de personajes adultos (las `w-*` infantiles quedaron descartadas).

**Verificado (21/10):**
- **Emulador:**
  - el clip nuevo y el panel con sus grupos;
  - el Chancho fiestero bailando 6,5 s, con audio;
  - el guiño mandado y el recibido a pantalla completa;
  - el zumbido en la fila (solo X) y en el chat (toda la pantalla, solo X);
  - el que llegó sin leer suena al abrir.
- **Web headless:** el menú, el panel por grupos y el Chancho a pantalla
  completa.

## 73. E4: contrato con agentes (Lila y Dali) — BORRADOR (21/10/2026)

Acordado con la sesión «Agentes Lila y Dali» (repo `constroad/agentes`), que
informa estas decisiones de José (a confirmar con él en esta sesión):
(1) la identidad del bot vive en Lilachat, como participante del espacio con
sus permisos; agentes guarda la llave de esa instalación como un «sender» con
canal `lilachat`. (2) Lo que crea cosas en el Portal (pedidos, despachos,
gastos) pasa por agentes: Lilachat manda el comando, el botón o el formulario
como evento firmado, Lila lo ejecuta con su acceso al Portal y responde.
Lilachat no tiene credenciales del Portal. Excepción: los avisos de una app a
un canal (Portal → #flota) van directo por webhook entrante.

Piezas que se copian de agentes (puras): formato de llave, hash y `last4`
(`core/integrations/keys.ts`); validación y scopes
(`core/integrations/service.ts`); código de 60 s de un solo uso con canje
atómico (`core/connect/stores.ts`).

### 73.1 Instalación (tipo «Add to Slack»)
- Un admin del espacio toca «Conectar Lila» en Integraciones (e4-23) → lo
  lleva a agentes, que vuelve a `https://lilachat.constroad.com/integraciones/vuelta`
  (URL exacta registrada) con `code` (60 s, un uso) y `state`.
- `POST /api/integrations/exchange` (servidor a servidor) `{ code, client:
  'agentes', clientSecret }` → `{ installationId, workspaceId, botUserId,
  key, scopes, signingSecret, eventsUrl }`. La llave: `lc_<espacio>_<aleatorio>`,
  se guarda solo el hash + `last4`; hasta 3 vivas; rotar deja la anterior 24 h;
  revocar o desconectar las mata. El bot queda como miembro del espacio
  (rol `guest` del bot: solo entra a los canales donde lo agregan o lo nombran).
- Scopes: `messages:write`, `channels:read`, `commands:write`, `events:read`.

### 73.2 Publicar como el bot
`POST /api/bots/messages` · `Authorization: Bearer lc_…` · `Idempotency-Key: <uuid>`
```json
{ "chatId": "…", "channel": "flota", "text": "Unidad 2 salió de planta",
  "menciones": [{ "userId": "…", "desde": 0, "largo": 5 }],
  "card": { "kicker": "DESPACHO · PED-2026-0418", "title": "Unidad 2 salió de planta",
            "status": { "label": "EN RUTA", "tone": "pizarra" },
            "fields": [{ "label": "Placa", "value": "BBE 942" }] },
  "buttons": [{ "id": "ver-vale", "label": "Ver vale", "style": "secondary", "url": "https://…" },
              { "id": "confirmar", "label": "Confirmar recepción", "style": "primary", "value": "PED-2026-0418" }],
  "quickReplies": [{ "id": "si", "label": "Sí, llegó" }],
  "replyToSeq": 120, "hiloDe": 118, "enElChat": false }
```
→ `201 { chatId, seq }`. `chatId` o `channel` (slug del espacio de la
instalación). Errores: 401 llave, 403 scope o el bot no está en ese chat, 404
chat fuera del espacio, 409 misma `Idempotency-Key`, 429 límite.
Reemplazar una tarjeta (p. ej. «Confirmado por Ana»):
`PATCH /api/bots/messages/:chatId/:seq` con el mismo cuerpo.

### 73.3 Webhook entrante (app → canal, sin agentes)
`POST /api/hooks/:hookId/:token` `{ text, card?, buttons? }` → publica como la
app (pastilla APP) en el canal configurado. Se crea en Integraciones; el
token se muestra una vez y se puede revocar.

### 73.4 Eventos salientes firmados (Lilachat → agentes)
`POST <eventsUrl>` con cabeceras `X-Lilachat-Event-Id: <uuid>`,
`X-Lilachat-Timestamp: <unix s>`, `X-Lilachat-Signature: v1=<hex(HMAC-SHA256(signingSecret, timestamp + "." + body))>`.
El receptor rechaza más de 5 min de diferencia y repite por `Event-Id`.
Lilachat reintenta con backoff si no recibe 2xx (5 intentos) y espera la
respuesta 3 s: lo lento se responde aparte por `POST /api/bots/messages` o
por `responseUrl` (un uso, 15 min).
- `message.mention` `{ workspaceId, chatId, seq, from: { userId, name, phone }, text, menciones }`
- `message.direct` (mensaje al chat 1:1 con el bot), mismo cuerpo.
- `command` `{ workspaceId, chatId, command: "pedido", args: "Municipalidad de Lima 24 m³ jueves", from, responseUrl }`
- `button.click` `{ workspaceId, chatId, seq, buttonId, value, from, responseUrl }`
- `form.submit` `{ workspaceId, chatId, formId, values: { cliente, obra, m3, … }, from, responseUrl }`

### 73.5 Comandos y formularios (las acciones del Portal en el chat)
Agentes registra sus comandos al instalar:
`PUT /api/bots/commands` `[{ "command": "pedido", "description": "crear un pedido de mezcla",
"form": { "id": "pedido", "title": "Nuevo pedido", "fields": [ { "id": "cliente", "label": "Cliente", "type": "select", "source": "clientes" }, { "id": "m3", "label": "Cantidad", "type": "number", "unit": "m³" }, { "id": "fecha", "type": "date" }, { "id": "hora", "type": "time" } ] } }]`.
Lilachat dibuja la hoja (pantallas e4-25 a e4-29) con esos campos; las
opciones de un `select` las pide al bot con `options.request` →
`{ options: [{ id, label }] }`. Al enviar, `form.submit`; Lila crea en el
Portal (`POST /api/order`, `/api/dispatch`, `/api/expense`…) y responde con la
tarjeta (e4-22).

## 72. E1 en el server: espacios, miembros y chats del espacio (21/10/2026)

El modelo aprobado en §66 (José, 21/10: «sí»), del lado del server. La UI (app
y web) sigue con las pantallas v2 (§69).

- **Modelos** (`workspaceModels.ts`): `workspaces` (nombre, rubro, logo,
  dueño, código, política de ingreso) y `workspacemembers` (espacio, usuario,
  teléfono, rol, estado `active | pending | invited | deactivated`, cargo,
  área). Agregar por teléfono funciona sin cuenta: queda `invited`, se crea la
  invitación de Lilachat y al entrar con el código (`authRoutes` →
  `claimPhoneInvites`) queda activo.
- **Reglas** (`shared/workspaces.ts`, con test): código `CONS-7K3P` (cuatro
  letras del nombre + cuatro sin 0/O/1/I/L; se acepta escrito con espacios,
  en minúsculas o el enlace entero); solo el dueño nombra admins; nadie cambia
  ni desactiva al dueño; un admin desactiva miembros e invitados, no admins;
  con aprobación el ingreso queda pendiente.
- **Rutas** `/api/workspaces`: crear, mis espacios, vista previa por código y
  unirse (con límite de 10 intentos por minuto para que no se adivinen
  códigos), miembros (el directorio para los activos; pendientes y
  desactivados solo para admins), agregar por teléfono, cambiar rol, aprobar,
  desactivar, ajustes (nombre, rubro, política, código nuevo) y salir (el
  dueño no puede salir sin pasarlo).
- **Chats del espacio** (`workspaceChats.ts`): `chats.workspaceId`.
  `GET /api/chats` sin parámetro devuelve solo lo personal (como hasta hoy);
  `?workspace=<id>` los del espacio, solo para activos. Crear un chat en un
  espacio exige que todos sean activos; el 1:1 del espacio es distinto del
  personal. **Desactivar** mueve a la persona de `members` a
  `suspendedMembers` en cada chat del espacio, así todos los controles de
  pertenencia que ya existían la dejan afuera al instante; reactivar la
  devuelve con su rol. Salir la saca de los chats del espacio.
- **Índices** creados en la bóveda (aprobados por José): `workspaces.joinCode`
  único; `workspacemembers` `{workspaceId, phone}` único, `{userId, status}`,
  `{phone, status}`, `{workspaceId, status}`; `chats.workspaceId`. **Ojo:**
  el «dry-run» que los iba a mostrar los creó, porque `db.ts` conectaba sin
  `autoIndex: false` (las colecciones estaban vacías). Corregido: la app y
  sus scripts conectan con `{ autoIndex: false, autoCreate: false }`.
- **Canales (E2, server):** un canal es un grupo del espacio con
  `channel: { visibility }` y su nombre en minúsculas con guiones
  (`normalizeChannelName`: «Obra Surco» → `obra-surco`). Por ser grupo, ya
  tienen menciones, admins y avisos; un cliente viejo lo ve como grupo.
  `/api/workspaces/:id/channels`: crear (nombre repetido en el espacio → 409),
  explorar (los públicos más mis privados, con cantidad de miembros y si ya
  estoy) y unirse a un público (a un privado no). La lista del espacio trae
  `channel` para dibujar el «#».
- **Tests:** shared 10 (reglas, código y nombre de canal), server 17 (`workspaces.test.ts`:
  crear, vista previa, unirse, aprobar, agregar por teléfono y reclamar al
  entrar, roles, desactivar, ajustes, salir, chats del espacio, 1:1 aparte,
  desactivar y reactivar en los chats, canales).

## 71. El zumbido de Messenger (21/10/2026)

Backlog 3 (José, 21/10: «¿qué más hay? ¿lo de Messenger?»). Primero el
zumbido; los guiños necesitan animaciones propias (las de MSN son de
Microsoft).

- **Mensaje `zumbido`** sin contenido (`zumbido.ts`): solo en chats 1:1 por
  ahora (en grupos sería spam hasta que exista el permiso del admin), uno cada
  10 s por persona y chat (se controla ANTES de `sendMessage`, que gasta un
  `seq`); también en chats secretos, porque no lleva contenido. El aviso dice
  «Te mandó un zumbido» y la lista «Zumbido».
- **App:** «Zumbido» en el clip (solo 1:1). Con el chat abierto, la lista se
  sacude ±12 dp unos 600 ms y vibra; lo que ya estaba al abrir no sacude
  (`nudgeToShake`, en shared con test). En el historial, la línea «Ana te
  mandó un zumbido» / «Mandaste un zumbido».
- **Web:** «Zumbido» en el «+» (solo 1:1). El panel se sacude (keyframe CSS) y
  suena un zumbido corto con Web Audio; con «reducir movimiento» solo suena.
- **E2E** (server de QA, emulador, web y un socket de prueba): el zumbido de
  Ana llegó en vivo al emulador con la línea y la lista se movió en
  horizontal (−28 a +26 px, ~0,75 s, medido cuadro a cuadro); el segundo
  dentro de 10 s mostró «Espera unos segundos para mandar otro zumbido.»; el
  de la app sacudió el panel de la web de Ana. **Defecto encontrado:** con
  `className` de NativeWind en la vista animada, el estilo animado no se
  aplicaba; ahora va como `style`.
- **Queda:** un chat silenciado todavía sacude y vibra (la pantalla del chat
  no conoce el silenciado); el permiso del admin para grupos; los guiños.

## 70. El clip con acceso limitado, pegar la imagen copiada y el salto al abrir (21/10/2026, 0.1.116)

José (21/10, con captura): «toco el clip y no están las imágenes y videos, y
sí le di acceso»; «tomo un screenshot, voy a WhatsApp y me sugiere pegar la
imagen; aquí no pasa»; «otra vez estoy viendo el salto al abrir los chats».

- **Clip:** la captura mostraba una sola imagen. Era el **acceso limitado**
  de Android 14 («seleccionar fotos»): la app solo ve lo elegido y lo trataba
  como acceso completo, sin decir nada. Ahora (`mediaAccessFrom`, con test)
  muestra lo elegido y un aviso «Solo ves las fotos que elegiste» con «Ver
  todas», que vuelve a pedir el permiso (Android ofrece «Permitir todo»).
  E2E: con el permiso limitado se ve el aviso; tras «Permitir todo», la
  grilla se llenó (20 visibles) y el aviso se fue.
- **Pegar la imagen copiada:** el campo de React Native no recibe imágenes
  del teclado (le falta `commitContent`), por eso Gboard no la sugiere. La
  barra la ofrece sola: mientras se escribe y hay una imagen copiada, un chip
  «Pegar la imagen copiada» (con × para descartarlo hasta la próxima copia).
  Solo `hasImageAsync` corre solo (no dispara el aviso de Android); la imagen
  se lee al tocar y entra a la vista previa de fotos de siempre, con
  comentario y HD. No en chats secretos. E2E: «Copiar imagen» en Chrome del
  emulador → el chip apareció → la vista previa abrió con esa imagen.
- **El salto al abrir:** medido cuadro a cuadro (30 fps) con mensajes que
  llegan con el chat cerrado: la lista aparecía en el divisor y al cuadro
  siguiente saltaba unos 20 mensajes arriba y bajaba animada. **Causa:** se
  mostraba tras su primer layout, pero FlashList seguía midiendo las filas de
  arriba (el alto pasaba de 1761 a 2891–3157 px, en parte por el propio
  `scrollToIndex` al divisor) y la corrección se veía. Además, el tope de
  350 ms la mostraba sin ubicar si el layout tardaba (teléfono lento o chat
  con fotos), y el margen inferior (16 → 24 dp al montar) recreaba el
  componente de scroll. **Arreglo:** `RevealWhenSettled` (con test): se
  muestra cuando el alto se queda quieto 120 ms, se vuelve a ubicar con las
  medidas finales justo antes, tope 900 ms; el scroll lee el margen por un
  ref y ya no se recrea. E2E: con mensajes nuevos abre en «3 mensajes no
  leídos» y queda quieta; sin nuevos, abre al final, quieta. En la build de
  desarrollo el blanco dura lo que tarda el primer layout (~0,8 s); en la de
  release es menor.

## 69. Pantallas de Lilachat Empresa: cuáles valen (21/10/2026)

José (21/10): «¿no teníamos skills y lecciones para evitar que 15 de las 21
pantallas salieran mal? Si corriges lo que Stitch inventó, ¿para qué tienes
las skills? Crea nuevas e identifica en el spec cuáles valen, cuáles no y
para qué se usan».

**Qué pasó con la tanda v1 (`e-*`, 20/10):** se escribieron los prompts a
mano en vez de seguir la skill `stitch-design`. Sin su plantilla (DIRECCIÓN
+ SHELL + CONTENIDO + PIE), sin tablet, y sin `render.py` para sacar la
captura móvil desde el HTML a 390 px. Resultado: 15 de 21 móviles en un
lienzo de escritorio, correos y una versión «v2.4» inventados, e integraciones
sin móvil.

**La tanda v2 (`e1-` … `e4-`) sigue la skill al pie de la letra:** el
generador por JSON-RPC de Lab Vial copiado a `lilachat/.stitch-work/` (fuera
de git), `base.py` con la plantilla, los datos de ejemplo y un PIE que prohíbe
correos, versiones, usuarios con arroba y leyendas; `screens.py` con el
contenido de cada pantalla (no se borra); los **tres dispositivos**
(escritorio = web, tablet = app en tablet, móvil = app); y `render.py` (el de
Trama, con el iframe de 390 px) para las capturas `.fold.png` y completas.
Las capturas quedan en `design/stitch/v2/` (locales) y en `INVENTARIO.md`.

### 69.1 Valen (v2): qué se implementa con cada una

| Pantalla | Título | Fase | Para qué |
| --- | --- | --- | --- |
| `e1-01-bienvenida` | Cómo vas a usar Lilachat | E1 | Primera pantalla tras el código: elegir personal / unirse / crear |
| `e1-02-unirse-codigo` | Unirme a mi empresa | E1 | Código o enlace + vista previa del espacio |
| `e1-03-solicitud-enviada` | Solicitud enviada | E1 | Espera de aprobación |
| `e1-04-crear-espacio` | Crear un espacio | E1 | Alta del espacio (dueño) |
| `e1-05-invitar` | Invitar a CONSTROAD | E1 | Código, enlace y agregar por teléfono |
| `e1-06-selector-espacios` | Tus espacios | E1 | Cambiar de espacio (hoja en la app, menú en la web) |
| `e1-07-chats-del-espacio` | Chats de CONSTROAD | E1 | Lista del espacio: canales, directos, apps |
| `e1-08-directorio` | Directorio | E1 | Directorio sin depender de la agenda |
| `e1-09-perfil-miembro` | Perfil de Ana Torres | E1 | Perfil de un miembro |
| `e1-10-miembros-roles` | Miembros y roles | E1 | Admin: roles y desactivar |
| `e1-11-solicitudes` | Solicitudes para entrar | E1 | Admin: aprobar o rechazar |
| `e1-12-ajustes-espacio` | Ajustes del espacio | E1 | Admin: nombre, logo, código, zona de peligro |
| `e1-13-te-agregaron` | Te agregaron a CONSTROAD | E1 | Aviso al entrar cuando te agregan |
| `e1-14-acceso-desactivado` | Ya no tienes acceso | E1 | Lo que ve quien fue desactivado |
| `e2-15-explorar-canales` | Canales de CONSTROAD | E2 | Explorar y unirse a canales |
| `e2-16-crear-canal` | Crear canal | E2 | Crear canal (público/privado, de obra) |
| `e2-17-canal-de-obra` | Canal de obra con checklist | E2+ | Canal de obra: pestañas y checklist por etapas (backlog 21) |
| `e2-18-item-checklist` | Ítem del checklist | E2+ | Detalle de un ítem del checklist |
| `e3-20-menciones` | Menciones | E3b | Pestaña «Menciones» |
| `e4-21-comandos` | Comandos con barra | E4 | Comandos con «/» |
| `e4-22-tarjeta-constroad` | Tarjeta de Constroad con botones | E4 | Tarjeta del Portal con botones |
| `e4-23-integraciones` | Integraciones del espacio | E4 | Admin: integraciones (ahora también en celular) |
| `e4-24-acciones-constroad` | Acciones de Constroad | E4 | Hoja «¿Qué quieres hacer?» desde el «+» |
| `e4-25-crear-pedido` | Crear pedido | E4 | Crear pedido (POST /api/order; sin precio) |
| `e4-26-crear-cotizacion` | Crear cotización | E4 | Crear cotización (POST /api/quotes) |
| `e4-27-despachar` | Despachar a un pedido | E4 | Despachar a un pedido (POST /api/dispatch + salida) |
| `e4-28-subir-gasto` | Subir gasto | E4 | Subir gasto con comprobante (POST /api/expense) |
| `e4-29-combustible` | Registrar combustible | E4 | Combustible de una unidad (POST /api/fleet/fuel-logs) |
| `e4-30-consultar-unidad` | Consultar una unidad | E4 | Consultar una unidad (Lila) |
| `e4-31-informe-del-dia` | Informe del día | E4 | Informe del día (Lila) |

### 69.2 No valen (v1, `e-01` … `e-22`)

Quedan en el proyecto de Stitch porque Stitch no borra, pero **no se usan**:
las reemplaza la v2. Excepciones: `e-17-menciones-sugerencias` y
`e-18-avisos-chat` sirvieron de criterio de aceptación de E3b (§67) y lo
implementado ya las sigue; la próxima referencia de esas dos es la v2. Las
de §66.4 #17 y #18 no se regeneran (ya están hechas).

### 69.3 Lo que se aprendió del Portal para las acciones (E4)

Leído del código y de los as-is del Portal y de lila-app (21/10):
- **Pedido** (`POST /api/order`, permiso `orders:manage`): fecha de
  programación, m³, diseño de mezcla (`tipoMAC` es el id del diseño), cliente,
  obra, hora, sede. **No tiene precio**: sale de la cotización. Rechaza un
  segundo pedido del mismo cliente el mismo día (409 con el duplicado) y el
  desborde de la planta.
- **Cotización** (`POST /api/quotes`): cliente, fecha, ítems, subtotal, IGV,
  total; el número lo asigna el server.
- **Despacho** (`POST /api/dispatch`, `dispatch:manage`): unidad, cantidad,
  pedido, guía; la salida es un `PUT` aparte y es la que dispara los avisos
  y el vale.
- **Gasto** (`POST /api/expense`): monto, descripción, obra o pedido,
  pagado / por pagar (reembolsar); acepta un dispositivo interno; la foto del
  comprobante se sube aparte al Drive.
- **Combustible** (`POST /api/fleet/fuel-logs`): placa, odómetro, galones.
  Los «consumos» de la planta (conciliación de tanques) no se cargan por chat.
- **Lila hoy no consulta el Portal**: el catálogo de consultas (`unidad`,
  `chofer`, `ETA`…) está propuesto en `Portal/specs/AGENT-OPERATIONS.spec.md`
  §6.1. Para crear desde el chat hace falta un camino interno del Portal con
  la identidad y los permisos de la persona: es trabajo del repo del Portal.

## 68. El audio con la pantalla bloqueada y responder con sticker (20/10/2026, 0.1.115)

José (20/10): «un audio se corta cuando la pantalla se bloquea» y «no puedo
responder con sticker desde el principal o desde el hilo».

- **Audio:** `expo-audio` pausa todos los reproductores y grabadores al pasar
  a segundo plano, y bloquear la pantalla cuenta. Ahora el modo de audio pide
  seguir (`audioMode.ts`, con test): al reproducir, `shouldPlayInBackground`
  y `doNotMix` (pausa la música de otra app, como WhatsApp); al grabar,
  además `allowsBackgroundRecording`. Un audio de 150 s o más muestra los
  controles en la pantalla de bloqueo: sin ellos Android lo corta a los ~3
  minutos. El plugin pide `enableBackgroundRecording` (servicio
  `AudioRecordingService` y `FOREGROUND_SERVICE_MICROPHONE` en el
  manifiesto, regenerado con `expo prebuild`).
- **E2E del audio** (emulador, nota de 30 s subida como QA Ana con un tono
  sintético): se tocó reproducir, a los 2 s se bloqueó la pantalla, y siguió
  sonando hasta el final con la pantalla apagada (`dumpsys audio`:
  `started` hasta los 28 s; `AudioTrack` entregó 30,0 s). **La grabación con
  la pantalla bloqueada no se probó:** el micrófono del emulador captaría
  audio ambiente.
- **Responder con sticker:** el server ya aceptaba `replyToSeq`, pero el panel
  mandaba el sticker sin él. Ahora la barra le dice al panel a qué mensaje
  se responde (app: `ComposerHandle.replyingTo/replyDone`; web:
  `replyingTo` hasta `StickerChat.replyToSeq`), el sticker sale como
  respuesta y la franja se cierra. La burbuja del sticker muestra la cita
  arriba, como WhatsApp (app y web).
- **En el hilo** el botón de stickers está desde la 0.1.113 (§65.2); dentro de
  un hilo no hay respuesta a un mensaje puntual, como en Slack.
- **E2E:** desde la web (QA Ana) se respondió con sticker al «Buenos días
  equipo» de Beto y desde la app (deslizar + sticker) también: en la base,
  los dos stickers quedaron con `replyToSeq: 2`, la franja se cerró y la
  cita se ve arriba del sticker en las dos.
- **Contra el diseño (`e-17`, `e-18`):** `@aquí` lleva un rayo y `@todos` dice
  a cuántos avisa («Avisa a los 3 del grupo»); la hoja y el diálogo de
  avisos llevan un ícono por opción, tarjetas y la pastilla «Activo». No se
  dibujó «Silenciar por 8 horas»: el server no tiene silencio por tiempo
  (queda pendiente; no se muestra un interruptor sin backend).
- **Entorno de QA:** el server de QA arma las URLs de los archivos con
  `QA_HOST`; con `127.0.0.1` el emulador no baja ni fotos ni audios. Para el
  emulador va `QA_HOST=10.0.2.2`.

## 67. E3b: @todos, @aquí y los avisos de cada grupo (20/10/2026)

Cierra E3 (§47). Como Slack: `@todos` (= @channel) y `@aquí` (= @here) en los
grupos, y en cada grupo «Todos los mensajes / Solo menciones / Nada».

- **Menciones de grupo** (`shared/menciones.ts`): viajan como una mención con
  `userId` `todos` o `aqui` sobre el texto exacto «@todos» / «@aquí». El
  server las acepta **solo en grupos** (`validarMenciones(…, {groupMentions})`);
  en un 1:1 se descartan. `mentionedUserIds` dice a quién llegan: la persona,
  todos los miembros o los que están en línea.
- **Sugerencias:** al escribir «@» en un grupo salen primero `@todos` y
  `@aquí` con un megáfono y lo que hace cada una, después las personas (app y
  web, `mentionOptions`). En la burbuja se ven resaltadas como cualquier
  mención.
- **Niveles** (`notificationLevel`): se guardan como el `muted` de siempre
  (silenciado = solo menciones, como WhatsApp) más `avisos: 'nada'` en el
  miembro. Así una app vieja sigue leyendo el chat como silenciado, y
  reactivar desde cualquier cliente borra el «nada». `PATCH
  /chats/:id/ajustes` acepta `{avisos}`; la lista y el detalle lo devuelven.
- **Push:** suena si el nivel es «todo», o «solo menciones» y te alcanzó una
  mención (por nombre, `@todos`, o `@aquí` estando en línea). «Nada» no suena
  ni con menciones (el teléfono nativo igual recibe el push silencioso para el
  acuse de entrega). En un hilo, `@todos` hace interesados a todos. Las
  reacciones solo avisan con «todo». Las llamadas suenan siempre.
- **UI:** en un grupo, la fila «Avisos» del detalle (app) o de «Info.» (web)
  abre «Avisos de este grupo» con las tres opciones; en un 1:1 queda el
  interruptor de silenciar.
- **Arreglado de paso (web):** el cursor después de elegir una mención (o un
  emoji) se ponía en el cuadro siguiente con `requestAnimationFrame`; si se
  escribía enseguida, el texto quedaba desordenado («@todos  7 en la obraa
  las»). Ahora se pone en un `useLayoutEffect` apenas el texto nuevo está en
  pantalla.
- **Tests:** shared (menciones de grupo, alcance, niveles, opciones), server
  `chatNotifications.test.ts` (quién oye cada mensaje con los tres niveles,
  `@todos` descartado en un 1:1, el PATCH y la compatibilidad con `muted`),
  web (diálogo, acción `avisos-*`, sugerencias).
- **E2E** (server de QA, web como QA Ana, emulador como la cuenta QA): «@»
  muestra `@todos` y `@aquí` arriba de las personas en los dos; se mandó
  «@todos a las 7 en la obra» desde la web y «@aquí revisen la planta» desde
  la app, y en la base quedaron con su mención; Ana eligió «Solo menciones» y
  «Nada» en la web y la cuenta QA «Solo menciones» en la app (base: `muted` y
  `avisos` como se esperaba). El push real no se probó: el server de QA no
  tiene credencial de FCM; lo cubren los tests de `notifyOffline`.
- **Queda:** la pestaña «Menciones» (actividad) del inventario §66.4 #19.

## 66. Espacios: cuenta personal y espacios de empresa (E1, diseño, 20/10/2026)

José (20/10): «Lilachat se podrá usar como cuenta individual y como empresa.
Slack permite ello, ¿no? Como workspace o empresa te pide ingresar un código o
algo así, y la cuenta individual la vas creando tú. Verifica si faltan
pantallas y dile a Stitch que las haga».

### 66.1 Cómo lo hacen otros

- **Slack:** la identidad es el correo. Cada workspace es un espacio aparte,
  con su perfil. Se entra por invitación (correo o enlace que vence), por
  dominio de correo aprobado (`@empresa.com`), o buscando «tus workspaces» con
  el correo. **No usa código.** Una persona está en varios y cambia desde la
  barra lateral.
- **Microsoft Teams:** sí permite unirse a un equipo **con un código**.
- **WhatsApp:** no tiene espacios; WhatsApp Business es otra cuenta.

### 66.2 La propuesta para Lilachat

- **Una sola cuenta por persona**, la de hoy (teléfono + código). Lo
  personal sigue igual: chats con tu agenda.
- **Un espacio de empresa se SUMA a la cuenta, no la reemplaza.** Una persona
  puede estar en varios espacios y en lo personal a la vez.
- **Entrar a un espacio**, tres caminos:
  1. **Código o enlace** (como Teams): `CONS-7K3P` o
     `lilachat.constroad.com/e/CONS-7K3P`. El admin decide si se entra
     directo o con aprobación.
  2. **El admin agrega por teléfono:** al entrar a la app aparece «Te
     agregaron a CONSTROAD». Es el camino natural para el personal de obra,
     que no tiene correo de empresa.
  3. **Dominio de correo aprobado** (como Slack): queda para después.
- **Crear un espacio:** cualquiera con cuenta. Nombre, logo y rubro; queda
  como dueño y recibe su código para invitar.
- **Cambiar de espacio:** en la app, un selector arriba de la lista de chats
  («Personal» siempre primero, con no leídos por espacio); en la web, un riel
  de logos a la izquierda, como Slack.
- **Qué separa un espacio:** chats, grupos, canales (E2), directorio y
  avisos. Un chat es de un espacio o de lo personal. El 1:1 con alguien
  dentro de CONSTROAD es distinto del 1:1 personal con esa persona (como
  Slack).
- **Perfil por espacio:** nombre, cargo, área y foto (por defecto, la
  personal).
- **Roles:** dueño, admin, miembro e invitado (solo ve los canales a los que
  lo agregan).
- **Desactivar a alguien** corta su acceso a ese espacio en todos sus equipos
  al instante; su cuenta personal sigue. Sus mensajes quedan: la empresa es
  dueña de lo que pasa en su espacio (D1 en (a)).
- **La empresa no ve nada de lo personal**: ni chats, ni agenda, ni contactos.

### 66.3 Server (borrador; los índices nuevos van con el OK de José)

- `workspaces {name, slug, logoUrl, rubro, ownerId, joinCode, joinPolicy:
  'open' | 'approval', createdAt}`; únicos `slug` y `joinCode`.
- `workspaceMembers {workspaceId, userId, role, status: 'active' | 'pending' |
  'deactivated', displayName, title, area, avatarUrl, joinedAt}`; único
  `{workspaceId, userId}` y `{userId, status}`.
- `chats.workspaceId` opcional, con índice `{workspaceId, …}`.
- El JWT no cambia: el espacio va en cada pedido y el server verifica la
  membresía activa en cada request y al unirse a las salas del socket.

### 66.4 Pantallas: qué hay y qué falta

Ninguna pantalla de Stitch cubre espacios, canales, menciones ni bots. Las
que sirven tal cual: `otp`, `registro`, `invitar-amigos`, `permisos-admin`
(roles de un grupo) y `nuevo-grupo-*`. Faltan, con el prefijo `e-`:

| # | Pantalla | App | Web |
| --- | --- | --- | --- |
| 1 | Bienvenida: «¿Cómo vas a usar Lilachat?» (personal · unirme a mi empresa · crear un espacio) | ✓ | ✓ |
| 2 | Unirse con código o enlace, con la vista previa del espacio | ✓ | ✓ |
| 3 | Solicitud enviada, esperando aprobación | ✓ | |
| 4 | Crear un espacio (nombre, logo, rubro) | ✓ | ✓ |
| 5 | Invitar: código, enlace, compartir y agregar por teléfono | ✓ | ✓ |
| 6 | Selector de espacios (hoja en la app, riel en la web) | ✓ | ✓ |
| 7 | Lista dentro de un espacio: Canales y Mensajes directos | ✓ | ✓ |
| 8 | Directorio con búsqueda y áreas | ✓ | ✓ |
| 9 | Perfil de un miembro (cargo, área, mensaje, llamar) | ✓ | |
| 10 | Miembros y roles (cambiar rol, desactivar) | ✓ | ✓ |
| 11 | Solicitudes pendientes (aprobar o rechazar) | ✓ | |
| 12 | Ajustes del espacio (nombre, logo, código, política, salir) | ✓ | ✓ |
| 13 | «Te agregaron a CONSTROAD» al entrar | ✓ | |
| 14 | Acceso desactivado: lo que ve quien ya no está | ✓ | |
| 15 | E2 · Explorar canales y unirse | ✓ | ✓ |
| 16 | E2 · Crear canal (nombre, descripción, público o privado) | ✓ | ✓ |
| 17 | E3b · Sugerencias de @ con @todos y @aquí | ✓ | ✓ |
| 18 | E3b · Avisos del chat: todo, solo menciones o nada | ✓ | ✓ |
| 19 | E3b · Menciones y actividad (lo que te nombró) | ✓ | ✓ |
| 20 | E4 · Comandos `/` con autocompletado | ✓ | ✓ |
| 21 | E4 · Mensaje de un bot con botones y lista | ✓ | ✓ |
| 22 | E4 · Integraciones: webhooks entrantes del espacio | | ✓ |

Se piden a Stitch en el proyecto «Omni Messaging Platform» con la paleta
Vivid Pulse; los ids quedan en `design/stitch/INVENTARIO.md`.

## 65. La página blanca de la web, hilos completos y contactos en la web (20/10/2026, 0.1.113)

José (20/10): «en un hilo no puedo enviar sticker; no puedo editar mi
mensaje; con "También enviar al chat" se enviaron mensajes de más y no se ve
como Slack, que dice cuál era el mensaje original», la traza de la página
blanca (`TypeError: n is not a function`) y «sigue con los contactos en la
web».

### 65.1 La página blanca: `scrollIntoView` devuelve una promesa

- **Causa** (encontrada en el Chrome de José, recorriendo los efectos de
  React): `PanelDeHilo` tenía `useEffect(() => fin.current?.scrollIntoView(…))`.
  El Chrome reciente devuelve una **promesa** desde `scrollIntoView`, React
  la guarda como función de limpieza y al cerrar el hilo la llama:
  «destroy is not a function» y la app entera se cae. TypeScript no lo ve
  (`lib.dom` dice `void`) y el Chrome de pruebas, más viejo, no lo
  reproducía.
- **Arreglo:** llaves en el cuerpo del efecto. Test que simula la promesa.
- **Candado:** `effectsReturnCleanup.test.ts` (web y app) recorre el AST de
  todo `src` y falla si un `useEffect`/`useLayoutEffect` tiene cuerpo de
  expresión, salvo un identificador, una función o un `suscribir…`. Se
  pasaron a bloque los 11 que había.

### 65.2 Hilos: sticker, editar y la referencia en el chat

- **Sticker en un hilo** (app y web): botón de emojis en la barra del hilo.
  El sticker se manda con `hiloDe` y `enElChat`; el server avisa el resumen
  nuevo del hilo (`notifyThread`, `msg.hilo`). Test en `stickers.test.ts`.
- **Editar en un hilo:** «Editar» en el menú del mensaje propio pone el
  texto en la barra del HILO (no en la del chat), con «Editando tu mensaje»
  y el check. Mientras se edita no se guarda borrador.
- **«También enviar al chat»:** en la base, de los tres mensajes del hilo de
  José se marcaron dos (158 y 160). El código desmarca la casilla después de
  cada envío; lo más probable es que estuviera marcada en el primero. Para
  que se entienda, la respuesta que llega al chat ahora dice **«Respondió en
  un hilo»** con el mensaje original, como Slack, y tocarla abre el hilo
  (`Citado.enHilo` en la app, `ThreadQuote` en la web; dentro del hilo no se
  repite).

### 65.3 Contactos en la web: el teléfono los pasa (opción «b»)

José eligió la (b) del backlog 20: como WhatsApp Web, el teléfono le pasa los
nombres a la web mientras los dos están conectados. **El server no guarda
nada.**

- **Recorrido:** la web vinculada emite `agenda.pedir {phones}` → el server
  (`agendaRelay.ts`) lo manda SOLO a los teléfonos del mismo usuario
  (`agenda.pedido {requestId, phones}`) → el teléfono responde con su agenda
  (`agenda.respuesta`) → el server lo entrega solo al socket que pidió
  (`agenda.nombres`). La solicitud vive 30 s en memoria.
- **Candados del server:** un teléfono no puede pedir, una web no puede
  responder, y otro usuario no puede responder una solicitud ajena. Los
  números se normalizan (500 por pedido como mucho) y la respuesta solo
  trae los números pedidos, con nombres de 80 caracteres como mucho
  (`shared/agendaRelay`, con test).
- **La web** (`contacts/phoneAgenda.ts`, `useAgendaRelay.ts`) pide en cada
  conexión los números de los chats 1:1 y de los miembros del chat abierto.
  Guarda los nombres en la base local del usuario, que se borra al cerrar
  sesión. Gana la agenda, como en la app: lista, cabecera, autor en los
  grupos y la cita del hilo. Los grupos y «Tú» conservan su nombre. Con el
  teléfono apagado no llega nada y quedan los nombres guardados.
- **E2E** (server de QA, emulador con el contacto «Ana Agenda QA» para el
  900000801 y la web vinculada a la cuenta QA): la web pidió, el emulador
  respondió y la lista, la cabecera, el autor en «QA Hilos» y la cita del
  hilo dicen «Ana Agenda QA». «QA Beto», que no está en la agenda, quedó
  con su nombre. Después se borraron las vinculaciones de prueba (José
  volvió a 22 dispositivos) y el contacto del emulador.

### 65.4 Verificación

- Tests: shared 882, server 618, app 453 y web 285.

## 64. Recorte con borrador y restaurar, el panel de emojis como el teclado (20/10/2026, 0.1.112)

José (20/10, con capturas de WhatsApp y Lilachat): «nuestra versión es la más
peor; no hay un borrador para borrar lo que no quiero» y «cuando abro los
emojis hay un rebote o doble parpadeo, es muy incómodo; revisa y audita todo».

### 64.1 El recorte: máscara, piezas sueltas, borrar y restaurar

- **Por qué salía peor que WhatsApp.** ML Kit tomó la laptop como fondo: la
  camiseta quedaba cortada en línea recta donde estaba la laptop y la mano
  que estaba sobre el teclado quedaba suelta al costado. Además `compose`
  ignoraba la orientación EXIF de la foto.
- **El recorte ahora es una MÁSCARA sobre una copia de trabajo** de la foto
  (orientada y de 1280 px como mucho; `CutoutMask.kt`): la confianza de ML Kit
  da bordes suaves (0,4–0,6) y se borran las piezas sueltas menores al 12 %
  de la más grande (la mano). La web hace lo mismo sobre MediaPipe
  (`dropSmallPieces`, con test).
- **«Recortar» abre Borrar y Restaurar** (como Telegram), con tres tamaños de
  pincel y el interruptor «Fondo automático». Restaurar muestra la foto entera
  atenuada detrás, para ver qué recuperar (la laptop). Cada trazo vive en
  píxeles de la foto (`shared/stickerMask`, con test): sobrevive a que el
  recorte cambie de tamaño, y «Deshacer» los quita uno por uno junto con el
  texto y el lápiz. El recorte se rehace en nativo (`refine`) o en el canvas
  (`refineWeb`) y se recorta a lo visible.
- **Arreglado de paso:** el editor quedaba montado entre un sticker y el
  siguiente, y sus capas pasaban al próximo. Ahora nace limpio cada vez.
- **Límite:** el emulador no tiene Play Store, así que el modelo de ML Kit no
  se puede probar acá. Lo que se probó en el emulador: la foto entera con
  Borrar, Restaurar con la foto atrás y Deshacer. En la web, E2E con el
  recorte de MediaPipe: borrar deja alfa 0, restaurar muestra la foto
  atenuada (89 = 35 %) y la recupera (255), y deshacer vuelve a 0.

### 64.2 El panel de emojis toma el lugar del teclado

- **Causa del rebote** (grabación cuadro a cuadro): el panel se abría DEBAJO
  de la barra, dentro del layout. La conversación se achicaba de golpe y,
  viniendo del teclado, la barra subía primero la altura del panel y después
  bajaba con el teclado que se cerraba. Encima, la barra cambiaba su margen
  inferior al abrirlo.
- **Ahora** (`emojiPanel.ts`, `ChatBottom.tsx`): el panel está debajo de la
  barra, tan alto como el último teclado. La barra sube lo que sea mayor
  entre el teclado y el panel, y la lista nunca cambia de tamaño:
  - Teclado → emojis: el panel aparece entero detrás del teclado, que se va
    sin mover nada (el scroll del teclado en modo «persistent» con
    `blankSpace` del tamaño del panel).
  - Emojis → teclado: el teclado sube sobre el panel, que se va cuando llegó.
  - Sin teclado: el contenido sube con el panel cuadro a cuadro en el hilo de
    UI (posición al empezar + lo que subió el panel), y al cerrar baja con él.
  - El panel se arma oculto un segundo después de entrar al chat: armarlo al
    primer toque bloqueaba el hilo de JS y el contenido llegaba medio segundo
    tarde.
- **Medido en el emulador** (grabaciones a 30 cuadros): en las cuatro
  transiciones el último mensaje queda justo sobre la barra en todos los
  cuadros. Lo que se descartó en el camino:
  - `extraContentPadding` animado: el padding y el scroll en el mismo cuadro
    quedaban recortados por la lista nativa, que llegaba a +59 de 340 dp.
  - Los métodos de posición de FlashList (`getAbsoluteLastScrollOffset` y
    `computeVisibleIndices`) devolvían valores viejos sobre este scroll, y el
    contenido iba HACIA ATRÁS.
- **Teclados raros:** un «teclado» de menos de 200 dp es una barra (stylus,
  teclado físico o flotante) y no define la altura del panel. En el emulador,
  Gboard en modo stylus medía 60 dp y el panel salía diminuto.

### 64.3 Verificación y entorno

- Tests: app 449, shared 878 (con `stickerMask` y los trazos del editor) y
  web 275 (con `dropSmallPieces`, el chip con fotos y `ErrorBoundary`).
- El emulador traía el teclado físico de la Mac activado: Gboard quedaba
  flotante o en modo stylus y los toques caían en otro lado. Se probó con
  `hw.keyboard = no` en el AVD y después se volvió a dejar como estaba.
- En una prueba, un toque con la lista recién reordenada abrió «Los
  originales», un chat real de José; ahí solo se abrió y se cerró el panel.
  Desde entonces el script de QA confirma el título «QA Hilos» antes de tocar
  nada.

## 63. Stickers como WhatsApp, el clip con la galería, el scroll al entrar a un chat y volver de un hilo (20/10/2026, 0.1.111)

José (20/10): «subo una foto, se quita el fondo, le pongo letras y creo el
sticker; esto debe mantenerse en Lilachat»; después: «no respetas el diseño»
(faltaban los stickers por defecto, rotar el texto y el lápiz), «el clip debe
mostrar la galería como WhatsApp y Telegram» y «al entrar al chat con Wilson el
scroll sigue y parpadea». Diseños: `s1-app-panel-stickers`,
`s1-app-crear-sticker`, `s1-web-stickers` y la hoja `s1-pack-lila`.

### 63.1 Stickers: qué ve la persona

- Botón de emojis → pestañas **Emoji · Stickers** y la tecla de borrar (app; en
  la web, las pestañas). Filtros Recientes · Favoritos · Mis stickers; «Crear»
  primero; «Mis stickers» muestra dos filas y «Ver todos»; abajo, el **paquete
  «Lila»** (24 stickers listos para mandar). En un chat secreto no hay pestaña.
- **Crear** (app): foto → fondo quitado (sujeto del centro) → barra Recortar ·
  Aa · emoji · lápiz · deshacer. Texto y emojis se mueven, se agrandan
  (pellizco o manija de la esquina) y **rotan** (dos dedos o la manija de
  arriba), con guías al centro. El lápiz dibuja con los 6 colores. «Borde ON»,
  «Para: …», «Sticker personal», «Guardar en Mis stickers» y enviar.
- **Crear** (web): el mismo motor; S/M/L, color, manijas de rotar y agrandar en
  el lienzo, lápiz, emojis, «Quitar fondo automáticamente», «Borde blanco»,
  «Cambiar» y clic sobre la foto para recortar otra cosa.
- En el chat el sticker va sin burbuja (160 px), con hora, reacciones, hilo y el
  autor en grupos. Uno recibido se guarda o se marca favorito (app: tocándolo;
  web: menú del mensaje). Una estrella en un sticker del paquete lo deja en
  «Mis stickers» como favorito.

### 63.2 Stickers: cómo está hecho (código nuevo en inglés)

| Pieza | Dónde |
| --- | --- |
| Motor del editor (capas texto/emoji/trazo, mover, escalar, rotar, S/M/L, color, deshacer con `checkpoint` + movimientos `transient`) y geometría 512×512 | `shared/src/stickerEditor.ts` |
| Biblioteca, recientes, paquetes y secciones | `shared/src/stickers.ts` (`STICKER_PACKS`, `findPackSticker`, `stickerSections`) |
| Server | `server/src/stickersRoutes.ts`, `stickerModel.ts` (`width`, `height`, `favorite`, `createdAt`) |
| Recorte y composición en Android | `app/modules/subject-cutout` (ML Kit + `Composition.kt`: borde, texto rotado con contorno, emojis, trazos) |
| App | `app/src/chat/stickers/*` (`CreateSticker`, `StickerCanvas`, `StickerPanel`, `EmojiStickerPanel`, `StickerMessage`) |
| Web | `web/src/chat/stickers/*` (`cutoutWeb` con MediaPipe, `composeWeb`, `CreateStickerWeb`) |
| Paquete Lila | arte de la hoja de Stitch `s1-pack-lila` (SVG) → `web/scripts/extract-sticker-pack.mjs` → `web/public/stickers/lila-1/*.webp` (24, 676 KB) |

- **Endpoints**: `GET/POST /api/stickers`, `PATCH/DELETE /api/stickers/:id`,
  `POST /api/stickers/from-message`, `POST /api/stickers/from-pack`,
  `POST /api/chats/:id/stickers` (`stickerId` propio o `pack:<paquete>/<slug>`;
  `clientKey` idempotente). Un sticker del paquete se manda con la URL del
  mismo server que sirve la web (Host validado; uno falso → 400).
- El paquete y el wasm de MediaPipe se sirven con caché inmutable (versión en
  la carpeta). CSP: `'wasm-unsafe-eval'` y la carpeta de modelos de MediaPipe.
- **Índices creados** (OK de José, 20/10): `stickers {userId, createdAt}` y
  único `{userId, mediaId}`; se borró uno viejo de la colección vacía. Los de
  `destacados` ya existían.
- El primer recorte en Android espera la descarga del modelo (tope 45 s) y se
  pide al abrir la pestaña Stickers.

### 63.3 El clip, como WhatsApp

`app/src/chat/AttachSheet.tsx`: arriba Galería · Documento · Evento · Encuesta
· Recordatorio (sin Cámara: tiene su botón en la barra, pendiente 10); abajo las
últimas 60 fotos y videos del teléfono, con duración; se eligen en orden (hasta
10) y «Enviar N» abre la vista previa de siempre (pie y HD). Sin permiso, una
tarjeta «Permitir acceso» (o «Abrir ajustes» si se negó para siempre). Bug que
salió en el E2E: lo elegido así no traía tamaño y la cola lo rechazaba como
«archivo vacío»; ahora la cola mide la copia (`colaDeArchivos.knownSize`).

### 63.4 El scroll al entrar a un chat: la causa raíz

- **Causa** (análisis con evidencia, `scroll-analisis` de la sesión): al
  volver a un chat, la lista nacía de la copia en memoria
  (`chatsEnMemoria`), que no se enteraba de lo que llegó con el chat cerrado
  (iba solo al disco). El control con el server lo agregaba abajo 150–600 ms
  después y el autoscroll animado lo perseguía: «el scroll sigue». Además, el
  divisor de no leídos se calculaba sobre la copia vieja y se perdía.
- **Arreglo**: la memoria sigue a cada escritura en disco
  (`MemoriaDeChats.add/drop` desde `guardarMensajes` y
  `eliminarMensajesGuardados`); `useChat` suma del disco solo los `seq` que
  falten. La lista se muestra recién cuando quedó ubicada (`onLoad` + dos
  cuadros, tope 350 ms) y se sacó el segundo scroll de 150 ms. Abrir en el
  divisor despega la lista del final (`releaseFromEnd`): antes, una tarjeta que
  crecía abajo la arrastraba al final. La cabecera ya no dice «Sin conexión…»
  un instante en cada apertura.
- **Tarjetas de enlace**: reservan su lugar mientras llega la vista previa y
  las ya vistas quedan en el teléfono (200, `linkPreviewCache`): al reabrir
  tras reiniciar no crecen de 0 a ~200 dp.
- **Medido en el emulador** (grabación cuadro a cuadro, 3 mensajes nuevos con
  el chat cerrado): los mensajes y el divisor están en el primer cuadro; queda
  un ajuste chico cuando la tarjeta real mide distinto que la reservada. En la
  build de desarrollo el montaje de la pantalla tarda y varía; el veredicto
  final va con la build de release.

### 63.5 Verificación

- Tests: shared 870, server (stickers 11, CSP 4, disco 15), web 268, app 440+
  (motor, memoria, selección del clip, caché de tarjetas, posición en la
  lista). Gates en verde, inglés y español neutro en cero sobre el árbol.
- App en el emulador: paquete, enviar del paquete, crear (texto rotado, lápiz,
  emoji, color), composición nativa correcta, recibir y favorito, clip con
  foto y video.
- Web (Chrome con GPU, servida por Express con la CSP real): paquete, recorte
  con «Fondo eliminado», texto rotado, lápiz, enviar, favorito.
- **No probado: el recorte de Android** (el emulador no tiene Play Store).
  Va en la build de prueba para el teléfono de José antes de publicar.
- Arreglado de paso: `disco.recibir` borraba el temporal antes de que el
  archivo terminara de abrirse y podía quedar un huérfano (gate rojo bajo
  carga).

### 63.6 Decisiones de José (20/10)

- Probar el recorte en su teléfono antes de publicar; después APK y web.
- Índices aprobados.
- Código nuevo en inglés; los textos de la app, en español (neutro).
- No silenciar los avisos del teléfono mientras la web está activa.
- 0.1.110 se probó en su teléfono y no se publicó: salió 0.1.111 con §63.7.

### 63.7 Volver de un hilo mandaba el chat al principio (0.1.111)

José (20/10): «cuando un usuario responde un hilo y da para atrás, regresa al
inicio de la conversación; es un error garrafal».

- **Reproducido en el emulador** con un grupo de 44 mensajes: leyendo el
  mensaje 18, abrir su hilo, responder y volver dejaba el chat en «Este es el
  principio de la conversación». Con un log del scroll se vio el momento:
  `offset 0` en el instante en que se ABRE el modal del hilo, y otra vez al
  cerrarlo.
- **Causa raíz.** En Android, un `Modal` que aparece o se va manda un evento
  del teclado (alto 0, duración 0) sin `onStart`. El `KeyboardChatScrollView`
  de la conversación (§61), que quedó detrás, lo procesa: su `onMove` hace
  `scrollTo` a la posición que guardó al abrirse el teclado la última vez, y
  si nunca se abrió, a 0. No era solo el hilo: el clip, el detalle, el visor
  y cualquier modal sobre el chat hacían lo mismo (el clip lo disimulaba
  porque después de mandar se baja al final). La versión 1.22.8 de la
  librería tiene la misma lógica: actualizarla no lo arregla.
- **Arreglo.** `ui/Modal.tsx` reemplaza al `Modal` de React Native en toda la
  app (35 archivos, mismo uso). Mientras está visible se cuenta
  (`ui/overlays.ts`) y le pasa a lo que contiene su nivel por contexto (la
  lista del hilo vive en el nivel 1). La lista que sigue al teclado
  (`useScrollConTeclado`) se congela mientras hay un modal por ENCIMA de su
  nivel y el teclado está abajo; si estaba arriba, sigue su cierre real y se
  congela al terminar (si no, quedaría el hueco del teclado).
- **Dos carreras medidas.** Congelar en el mismo render en que aparece el
  modal llegaba tarde: Reanimated pasa el valor al hilo de UI (y a la copia
  derivada de la librería) un cuadro después y el evento ganaba. El modal se
  muestra dos cuadros después de contarse (unos 30 ms, no se nota). Al
  cerrarse, el segundo evento llega unos 40 ms después: el modal se descuenta
  400 ms más tarde.
- **Verificado en el emulador:** responder en el hilo del mensaje 18 y volver
  deja el chat en el mensaje 18, con el chip en «6 respuestas»; abrir y
  cerrar el clip no mueve el chat; escribir en el chat sigue subiendo la
  lista con el teclado y bajándola al cerrarlo; la lista del hilo sigue al
  teclado. 448 tests de la app en verde (3 nuevos de `overlays`).
- **Límite conocido:** si alguien toca la barra de escribir antes de 400 ms de
  cerrar un modal, ese teclado no levanta la lista (la barra sí sube).

## 62. La llamada no sonaba con la pantalla apagada (20/10/2026, 0.1.109)

José, 20/10: «al llamar a Wilson con la pantalla apagada no vibró ni sonó;
se dio cuenta al desbloquear. ¿Dónde quedó lo del sonido de llamadas y
mensajes?».

**Causa.** El aviso nativo estaba bien (canal de llamadas con el tono del
teléfono, vibración, pantalla completa e insistente; FL8.1). Lo que fallaba
era QUIÉN recibía el push: el server lo mandaba solo a quien figuraba
desconectado, y «conectado» se cuenta **por persona** (`presence.isOnline`:
cualquier socket vivo). Con la web abierta en una computadora, o con la app
recién dormida y su socket todavía colgado (Android congela la app sin
cerrar la conexión; el server tarda hasta ~45 s en notarlo), el teléfono no
recibía nada: la llamada viajaba por un socket que nadie atendía y aparecía
al desbloquear. Lo mismo pasaba con los mensajes («no suena»).

**Arreglo.**
- Llamadas y mensajes: el teléfono con aviso nativo recibe el push
  **siempre**, figure conectado o no. Con la app adelante no dibuja nada (la
  llamada la trae el socket; el mensaje solo se acusa); con la pantalla
  apagada o la app en el fondo, suena, vibra y se enciende la pantalla. La
  web y los teléfonos viejos lo reciben solo si están desconectados.
- El aviso local de JS (el que dispara la app al recibir por el socket) sale
  solo con la app adelante: en el fondo ya avisa el nativo y lo duplicaba.

**El sonido respeta el teléfono**, como WhatsApp: en modo silencio o vibrar,
el timbre y el aviso de mensaje siguen ese modo.

**Decisión pendiente para José:** WhatsApp silencia los avisos de mensaje del
teléfono mientras se usa la web. Hoy, con este arreglo, el teléfono avisa
aunque la web esté abierta (las llamadas suenan en todos lados).

Dónde: server `pushService.avisarLlamada` y `notifyOffline` (+ tests en
`llamadas.test.ts` y `pushService.test.ts`); app `TabsShell` (aviso local
solo con la app activa). La prueba real necesita dos teléfonos: el emulador
no reproduce el Doze de un Samsung con la pantalla apagada.

## 61. Teclado como Telegram, transiciones de 200 ms, W3c, «Pendientes» y «Destacados» (20/10/2026, 0.1.108)

José, 20/10, con 0.1.107: el teclado todavía tiene «un scroll incómodo y un
efecto de rebote» al abrir y cerrar; volver de un chat tiene «una animación muy
lenta»; «hacer lo que falta» (W3c, aprobados «Pendientes» y «Destacados») y
después terminar los E.

| Pedido | Qué se hizo | Dónde |
| --- | --- | --- |
| Teclado | Fuera el `KeyboardAvoidingView`. La lista es un `KeyboardChatScrollView` (keyboard-controller, ya instalado): NO cambia de tamaño; padding y scroll siguen al teclado cuadro a cuadro en el hilo de UI (patrón Telegram, `keyboardLiftBehavior="always"`). La barra sube en un `KeyboardStickyView` que sube su margen de navegación menos (el teclado lo tapa): el pie ya no cambia de `pie` a 8 al abrir. Igual en el hilo. Congelado hasta medirse: montado dentro del Modal del hilo, Reanimated avisaba «scrollTo with an uninitialized ref» | app `useScrollConTeclado.tsx`, `ListaDeMensajes`, `ChatScreen`, `HiloScreen` |
| Transiciones | `animation: 'ios_from_right'`: 200 ms con la pantalla de atrás en parallax. `slide_from_right` usaba `config_mediumAnimTime` (400 ms en Android). Medido en el emulador: abrir y volver ≈ 200 ms | app `NavegacionDeSesion` |
| W3c — tarjetas en la web | Encuesta (votar optimista con vuelta atrás), evento (día, cuándo, dónde, Voy / Tal vez / No voy; a quien lo creó no se le pregunta) y recordatorio (cuándo suena, descripción con links y su tarjeta, imagen, editar si puede) en vez del texto; heredan reacciones, hilo y menú. En vivo: `ref.changed` refresca la tarjeta; al reconectar, todas | web `chat/tarjetas/*`, `BurbujaDeMensaje`, `useSocket` |
| W3c — recordatorio desde la web | «Recordatorio» en el «+» (en un grupo, sus admins; nunca en un secreto) y editar desde la tarjeta: título, descripción, cuándo (fecha y hora + atajos), repetir, imagen; eliminar con confirmación. El mismo cuerpo y orden que la app (`crearRecordatorio`/`editarRecordatorio`). También personal, sin chat, desde «Pendientes» | web `agenda/CrearRecordatorio.tsx`, `formularioDeRecordatorio.ts`, `Composer`, `Shell` |
| «Pendientes» | La pestaña «Agenda» pasa a «Pendientes»: UNA línea por cuándo tocan —Vencidos (los de una vez que sonaron en las últimas 24 h), Hoy, Mañana, Esta semana, Más adelante— con los eventos y los recordatorios que me suenan, incluidos los de mis chats (antes los de un grupo no salían), con su origen («En «Obra»», «Con Wilson», «Solo para ti») y la pastilla del evento (Sin responder / Voy / Creado por ti). «Posponer» abre el vencido; al final, «Apagados» con su interruptor (lo que hacía la vieja pestaña Recordatorios). En la web, el panel «Pendientes» con dos pestañas (Pendientes, Encuestas) y crear evento, encuesta o recordatorio | server `GET /api/agenda/linea` (`pendientesRoutes.ts`); shared `pendientes.ts` (`lineaDePendientes`, `origenDelRecordatorio`, `estadoDelEvento`); app `PendientesScreen`, `FilasDePendientes`, `usePendientes`, `BottomNav`; web `LineaDePendientes`, `AgendaOverlay` |
| «Destacados» | La estrella personal de WhatsApp (el fijado es para todos; esto lo ve solo quien lo marca). App: «Destacar / Quitar destacado» en la barra de selección (también de varios: quitar si todos ya están), estrella junto a la hora, «Mensajes destacados» en la info del chat y en Ajustes (todos; tocar abre el chat en ese mensaje). Web: en el menú del mensaje, ★ en el pie, en la info y en el menú de la lista. No en chats secretos | server `destacadoModel.ts` (colección `destacados`), `destacadosRoutes.ts` (`PUT/DELETE /api/chats/:id/destacados/:seq`, `GET /api/chats/:id/destacados`, `GET /api/destacados`); shared `destacados.ts`, `accionesDeMensaje.destacar`; app `destacados/*`, `SeleccionDeMensaje`, `barraDeSeleccion`, `MetaDeMensaje`, `PantallaDeAjustes`, `ui/buscarChat.ts`; web `chat/destacados/*`, `MenuDelMensaje`, `ChatList`, `Shell` |

**Barra de selección a 360 dp:** Responder, Hilo, Destacar, Reenviar y
Eliminar a la vista; Fijar pasa al «⋮» (en un grupo es solo de admins).

**Índices pendientes del OK de José (bóveda sin autoIndex):** `destacados`
`{userId, chatId, seq}` único y `{userId, en}`. Mientras tanto la
idempotencia la da el upsert y la colección es chica.

**Riesgo encontrado y corregido en el server:** el router de Destacados va
montado en `/api`; con `router.use(requireSession)` hubiera pedido sesión a
rutas públicas montadas después (`/api/crash`, `/api/push/key`). Va sesión
por ruta (verificado: `/api/crash` sigue en 204 sin sesión).

**Deuda:** `ChatScreen` quedó en 600 líneas (el tope): lo próximo que entre
ahí exige partirlo antes.

### 61.1 E2E

- **Teclado (app, grabación cuadro a cuadro):** chat lleno y chat de un
  mensaje, abrir y cerrar: lista y barra se mueven juntas con el teclado, sin
  pasarse ni rebotar; el hilo igual, sin franja vacía.
- **Transiciones:** abrir y volver de un chat ≈ 200 ms (antes 400).
- **W3c (web como QA Ana):** encuesta y evento creados desde el «+» se
  dibujan como tarjetas; votar; «Recordatorio» no aparece para una miembro
  del grupo y sí en el 1:1; recordatorio con link y miniatura; editarlo;
  **en vivo**: José votó y respondió «Voy» desde la app y la web de Ana pasó a
  «1 votante» y «2 van» sin recargar.
- **Pendientes:** app con Hoy/Mañana y el evento de QA «Sin responder»;
  web con el evento en «Mañana · Creado por ti».
- **Destacados:** app: destacar, estrella, lista del chat (tocar vuelve al
  mensaje), lista global en Ajustes (abre el chat). Web: destacar/quitar,
  ★, lista del chat, lista global → abre el chat.
- QA en cero (también encuestas, eventos, recordatorios y destacados de QA).
  Tus dispositivos: 22, por dos tuyos de hoy (Android 11:07 y la web en
  Chrome 11:08), que no se tocaron.

## 60. Tarjetas como mensajes, «Responder en hilo» a mano y la burbuja del hilo (20/10/2026, 0.1.107)

José, 20/10, con 0.1.106 en el teléfono: a un recordatorio del chat no se le
puede deslizar para responder, reaccionar ni abrir hilo; el link de su
descripción queda como texto y sin miniatura; al tocar un mensaje solo
aparecen emojis («ahí también la manera de crear hilos»); en el hilo un link
no muestra la tarjeta, queda un espacio feo bajo «También enviar al chat» y en
modo oscuro la hora no se ve.

| Pedido | Qué se hizo | Dónde |
| --- | --- | --- |
| Tarjeta = mensaje | Recordatorio, evento y encuesta del chat: deslizar los responde («Respondiendo a tu mensaje · Recordatorio: …»), mantenerlos los elige (barra de reacciones, «Responder en hilo», fijar…) y, con mensajes elegidos, un toque los suma o saca en vez de votar o editar. Con reacciones, la hora de la tarjeta lleva aire para que la pastilla no la tape. «Editar» no aparece (el server las guarda como `reminder`/`event`/`poll`) | app `TarjetaDelChat`, `MessageRow` |
| Link en el recordatorio | La descripción tiene los links tocables y el primero trae su tarjeta (YouTube con miniatura y play) | app `RecordatorioEnElChat` |
| «Responder en hilo» bajo los emojis | La barra de reacciones suma una fila «Responder en hilo» cuando se puede (`puedeAbrirHilo`: confirmado, vivo, no aviso, no respuesta de otro hilo, no secreto); suelta la selección y abre el hilo. En la web, un botón de hilo junto al de reaccionar al pasar el mouse | shared `hilos.puedeAbrirHilo`; app `BarraDeReacciones`, `useDibujarFila`; web `BotonDeHilo` |
| Burbuja del hilo | Ahora es la del chat: sus colores (la propia era `bg-primary`, clara en modo oscuro, y la hora no se veía), la hora dentro de la última línea, links tocables con su tarjeta y @menciones. La raíz del hilo también tiene sus links tocables (app y web) | app `TextoConHora` (sale de `MessageRow`), `MetaDeMensaje` (archivo propio), `HiloScreen`; web `PanelDeHilo` |
| Espacio bajo el check | Con el teclado abierto, el pie del hilo sumaba el margen de la barra de navegación (que no se ve): franja vacía sobre el teclado. Igual que el chat, sin ese margen con teclado. Además la lista baja a la última respuesta al abrirlo | app `HiloScreen` |

**Defectos que salieron en el E2E y se corrigieron:** el texto de la tarjeta
de enlace colapsaba a alto cero al elegir el recordatorio (`flex-1` con base
0 en columna; ahora solo al costado de la miniatura); en la web, mientras
cargaba la miniatura, el play flotaba sobre el título (ahora se reserva el
lugar 1.91:1).

### 60.1 E2E

Emulador reiniciado en frío (el DNS de internet volvió) y server QA local:
recordatorio creado desde la app con un link de YouTube en la descripción →
tarjeta con link y miniatura con play; mantenerla → selección + barra con
«Responder en hilo»; 👍 → pastilla bajo la hora; hilo abierto desde la barra
→ respuesta con link: tarjeta, hora dentro, en claro y oscuro; deslizar la
tarjeta → «Respondiendo a tu mensaje»; con un mensaje elegido, tocar la
tarjeta → 2 elegidos. Web (navegador propio como QA Ana): botón de hilo al
pasar el mouse abre el panel, raíz con el link tocable.

**Queda:** la web todavía no dibuja las tarjetas de recordatorio, evento y
encuesta (las muestra como texto): es W3c, lo siguiente.

## 59. Revisión de fluidez: avisos en el chat, foto al instante, teclado, miniaturas de enlaces y sonidos (20/10/2026, 0.1.106)

José, 20/10, después de publicar 0.1.105: un recordatorio o un evento que
empieza debería verse también en el chat, no solo en la barra de
notificaciones; la foto tomada en un chat tarda segundos en aparecer; el
teclado sube y baja «torpe y lento»; WhatsApp muestra la miniatura de
Instagram y YouTube y Lilachat no (revisar también Facebook y TikTok); «no hay
sonidos». Diseño `f2-app-camara` (INVENTARIO).

| Pedido | Qué se hizo | Dónde |
| --- | --- | --- |
| Avisos en el chat | Cuando el cron hace sonar un recordatorio de chat o avisa que un evento empieza, además del push deja un aviso destacado en la conversación: tarjeta tintada con campana o calendario y la hora («Recordatorio: Pagar la luz», «Reunión de obra · empieza en 15 minutos»). Va sin push propio (el push ya salió) y cuenta como no leído. Si escribirlo falla, el push no se cae | shared `avisoDeGrupo` (`recordatorio-suena`, `evento-pronto`, `esAvisoDestacado`); server `reminderCron` → `avisarEnElChat`; app `MessageRow › AvisoDestacado`; web `BurbujaDeMensaje › LineaDeSistema` |
| Foto al instante | Cámara propia del chat en vez de la del sistema (arrancarla, confirmar y volver costaba segundos): la vista está lista al abrir, el disparo destella y «Enviar» se abre encima en ~0,2 s, dentro del mismo modal (dos modales no se apilan bien en Android). Mientras captura va negro (la vista de la cámara se vuelve transparente y dejaba ver el chat). Flash Auto/Sí/No, girar, galería y tira de recientes solo si la galería ya tiene permiso | app `camara/CamaraDelChat.tsx`, `EnviarFotos` (`embebido`), `useAdjuntosDelChat` (`camara`) |
| Teclado | `KeyboardAvoidingView` de keyboard-controller en modo `translate-with-padding`: durante la animación se traslada el bloque (lista + barra) y el padding se aplica una sola vez al final. La cabecera queda fuera, encima (`zIndex`) | app `ChatScreen` |
| Miniaturas de enlaces | YouTube (watch, Shorts, live, youtu.be) y TikTok (videos) por oEmbed; Instagram, Facebook, fb.watch y TikTok se piden con el agente de facebookexternalhit (a un agente común le devuelven la pantalla de login sin `og:`). Un video (`og:type video.*`, `og:video` u oEmbed) lleva el play encima y va siempre grande. Un logo o perfil cuadrado va chico al costado (regla compartida `esMiniaturaCompacta`, ahora también en la web). Una imagen que no carga se oculta | shared `vistaPrevia` (`video`, `esMiniaturaCompacta`); server `vistaPreviaPorSitio.ts`, `traerVistaPrevia`, `vistaPrevia.leerMetadatos`; app `VistaPreviaDeEnlace`; web `TarjetaDeEnlace` |
| Sonidos | **App:** el mensaje ya sonaba por el canal de notificaciones y el timbre de llamada entrante es nativo; los dos respetan el modo silencio del teléfono, como WhatsApp (las capturas de José muestran el ícono de silencio). Nuevo: tono de «llamando…» al llamar (425 Hz, 1 s de cada 4, generado, sin licencia). **Web:** sonido sintetizado (Web Audio) para lo que no estoy mirando: otro chat o la pestaña oculta; no lo mío, ni silenciados, ni avisos, ni respuestas que quedan en su hilo. Suena recién después del primer gesto en la página (regla del navegador) | app `calls/tonoDeLlamando.ts`, `llamadaNativa.suenaTonoDeLlamando`, `useCall`, `assets/sonidos/llamando.wav`; web `sonidos/sonidoDeMensaje.ts`, `useSincronizacion`, `main.tsx` |

**Respuestas a José**
- **¿Un hilo avisa?** Sí: al autor del mensaje raíz, a quien ya respondió en
  el hilo y a los mencionados. Con «También enviar al chat», a todos.
- **¿Qué falta para videollamadas?** Probar entre dos teléfonos reales (el
  emulador no tiene cámara de verdad). La web todavía no llama (W6).

**Facebook:** un video de Facebook sale con título y sin imagen: Facebook no
pone `og:image` para bots en esos enlaces. Es su decisión, no un fallo.

### 59.1 E2E

Server QA local (sin crons, base de producción), QA Ana y QA Beto:
- **App:** cámara → disparo → «1 foto» en ~0,2 s sin ver el chat detrás
  (grabación cuadro a cuadro); los dos avisos destacados en QA Hilos; tarjetas
  de YouTube Short, perfil de TikTok y de Instagram con título y descripción.
  El emulador no resuelve DNS de internet (sí la Mac): las miniaturas no
  cargaron ahí, y la del Short se ocultó al fallar, que es lo esperado.
- **Web (navegador propio como QA Ana):** YouTube 480×360 grande con play;
  TikTok 720×720 e Instagram 100×100 chicos al costado (antes el logo salía
  estirado y borroso: corregido en esta pasada); los dos avisos destacados.
- **Trampa del E2E web:** el Chrome for Testing copiado muere con SIGTRAP
  («Mach rendezvous failed») al crear un subproceso, intermitente. No es la
  web: con `--disable-features=AudioServiceOutOfProcess` y reintentos pasó
  cuatro veces seguidas.
- QA en cero y los dispositivos de José en 20.

**Límite conocido:** en un chat muy corto (pocos mensajes) el cierre del
teclado da un salto de ~50 ms al aplicar el padding; en un chat lleno es
suave.

## 58. F1 — reacciones, recordatorios en todo chat, «Tú», fijados de Slack, descripción larga y reenviar (20/10/2026, 0.1.105)

José, 20/10, después de publicar 0.1.104: reaccionar en chats y en hilos; los
recordatorios no solo en grupos (también 1:1, borradores y el chat contigo);
«cómo creo un chat conmigo mismo, pruébalo de punta a punta»; fijar varios
como Slack («¿conflicto con los fijados actuales o mejor un star?»);
descripciones largas de grupo; responder al hilo principal desde un hilo; la
pantalla de reenviar como WhatsApp (frecuentes, recientes). Y una regla nueva:
**lo que tiene el APK lo tiene la web**. Diseños `f1-*` (INVENTARIO).

| Pedido | Qué se hizo | Dónde |
| --- | --- | --- |
| Reacciones | Como WhatsApp: una por persona (otra la cambia, la misma la quita). App: la barra de seis y «+» (el panel de emojis) aparece sobre el mensaje al elegirlo; la pastilla «👍 2 · ❤️ 1» se monta sobre el borde de la burbuja y abre «Reacciones» con pestañas («Toca para quitar»). En el hilo, mantener presionada una respuesta. Web: botón al pasar el mouse, la misma barra, pastilla con «quién reaccionó». Optimista con vuelta atrás si el server dice que no. Push solo al autor (fuera de línea y sin silenciar). No en un chat secreto (el emoji iría en claro) | shared `reacciones.ts`; server `reacciones.ts` (update pipeline atómico), `msg.react` → `msg.reacciones`, `avisarReaccion`; app `useCambiosDeMensajes`, `reacciones/*`; web `reacciones/*`, `aplicarReacciones` |
| Recordatorios en todo chat | En un 1:1 los crea cualquiera de los dos y les suena a los dos; en un borrador o en «Tú», te suena a ti. Se publican como tarjeta, se listan en el detalle y los edita cualquier miembro (en un grupo, sus admins). La tarjeta dice «Recordatorio» | server `eventRoutes`, `recordatoriosDeGrupo` (permiso), `reminderCron`; shared `aQuienSuena`, `etiquetaDeRecordatorioEnElChat`; app `AttachSheet`, `CreateReminderScreen`, `RecordatoriosDelGrupo` |
| «Tú · Envíate un mensaje» | Como WhatsApp: primera fila de «Nuevo chat» (app y web); abre SIEMPRE el mismo chat contigo (`POST /api/chats {kind:'yo'}`: un borrador `propio`, se crea la primera vez). En la lista y la cabecera, tu foto; no se renombra; sí lleva descripción y recordatorios. Los borradores con nombre siguen como antes | server `chatRoutes`, `chatModels.propio`, `listaDeChats`; app `NewChatScreen`, `FilaDeChat`, `NavegacionDeSesion`; web `CreatePanels`, `FilaDeChat` |
| Fijados de Slack | **Sin conflicto: es el mismo fijado, ampliado.** Hasta 50 por chat (el 51 saca al más viejo), «Sin vencimiento» además de 24 h / 7 d / 30 d, la franja con barrita partida y «1 de N», la lista «Mensajes fijados» (quién lo fijó y cuánto le queda) y la tarjeta en la info. En un grupo fijan los admins | shared `mensajesFijados.ts`; app `FranjaDeFijados`, `fijados/*`; web `FranjaDeFijados`, `fijados/ListaDeFijados` |
| Descripción del grupo | Hasta 2048 caracteres (WhatsApp), con párrafos y enlaces tocables; «Leer más» tras 6 líneas; aviso «X cambió la descripción del grupo» (sin el texto). Grupos y borradores; un 1:1 no tiene | shared `normalizarDescripcion`, aviso `descripcion`; server `PATCH /api/chats/:id {descripcion}`, `detail`; app `descripcion/*`; web `info/DescripcionDelChat` |
| Responder al hilo principal | Ya estaba en 0.1.104: «También enviar al chat» en el hilo (app y web) | §57 |
| Reenviar | Buscador, «Chats frecuentes» (a donde más mando: se anota en cada envío y lo viejo pesa la mitad por semana; vive en el equipo), «Chats recientes», casillas hasta 5, abajo los elegidos con «Añadir un mensaje…» y enviar. «Tú» aparece aunque todavía no exista (se crea al mandar). Sin chats secretos | shared `reenvio.ts`; app `reenviar/*` (anota en `queueMessage`); web `reenviar/*` (anota en `enviarTexto`) |

**Archivos partidos por el tope de 600 líneas:** `useChat` → `useCambiosDeMensajes`
y `useEscribiendoDelChat`; `ChatScreen` → `propsDelChat.ts`.

### 58.1 Análisis: ¿Agenda como pestaña aparte? ¿fijar o destacar?

Investigación con fuentes (WhatsApp, Slack, Teams, Telegram, Google Chat,
Discord, Signal; 2024–2026):
- **Ninguna app de consumo tiene una pestaña de agenda**: el evento vive en el
  chat y en la info del grupo (WhatsApp prueba en beta un listado de eventos,
  pero dentro de Ajustes). **Las de trabajo sí tienen una vista global**
  (Teams: Calendario; Slack: «To-dos» desde oct-2026 y «Today» en beta).
- Slack mezcló guardados y recordatorios en «Later» (2023), hubo quejas y en
  2026 los separó.
- **Recomendación:** que «Agenda» pase a ser **«Pendientes»** (solo lo que
  tiene fecha: eventos de todos mis chats y recordatorios; Vencidos · Hoy ·
  Próximos) y que lo guardado sin fecha sea **«Destacados»** (estrella
  personal, lista por chat y global, como WhatsApp/Slack). «Destacar» es
  personal y el fijado es para todos: son cosas distintas, por eso el fijado
  se amplió en vez de reemplazarse. Pendiente de decisión de José.

### 58.2 E2E

Server QA local (sin crons, base de producción) con QA Ana y QA Beto:
- **App (emulador):** barra de reacciones, reacción propia y la de Beto en vivo,
  pastilla, «Reacciones» y quitar la mía, «+» con el panel; reacción a una
  respuesta del hilo; fijar «Sin vencimiento» y 7 días → franja «1 de 2» y
  lista («vence en 7 días» / «sin vencimiento»); descripción larga con «Leer
  más», enlace y aviso; recordatorio en el 1:1 («Con «QA Ana»: les suena a los
  dos»); «Tú» desde Nuevo chat, mensaje y recordatorio («te suena a ti»);
  reenviar a dos chats con mensaje agregado (verificado en la base).
- **Web (navegador propio vinculado como QA Ana):** reaccionar al pasar el
  mouse, «quién reaccionó» y quitar; la reacción de Beto en vivo; reaccionar en
  el panel del hilo; lista de fijados; info con descripción, «Leer más», enlace
  y tarjeta de fijados; fijar «sin vencimiento» en el 1:1; editar la
  descripción; reenviar a «Tú» (se creó) con mensaje; «Tú» en Nuevo chat.
- Defectos que encontró el E2E: la tarjeta decía «Recordatorio del grupo» en un
  1:1; «vence en 6 días» recién fijado por 7 (ahora redondea); la barra no
  entraba en 360 dp; la lista de la web no mostraba el «Tú» recién creado; un
  punto de presencia en «Tú». Corregidos.
- QA en cero (usuarios, chats, mensajes, acuses, recordatorios, el «Tú» de
  prueba) y los dispositivos de José en 20.

**Queda:** la web no crea eventos/encuestas/recordatorios desde el chat ni dibuja
sus tarjetas (W3c, §54.15) — con la regla «APK = web» pasa a ser lo siguiente;
la sección «Contactos en Lilachat» del diseño de reenviar (hoy solo chats);
reacciones en chats secretos; «Destacados» y «Pendientes» si José los aprueba.

## 57. E3a — hilos en la app y en la web (20/10/2026, 0.1.104)

José, 19/10: «quiero ya probar los threads o hilos». Diseños `e3-app-chip-hilo`,
`e3-app-hilo` y `e3-web-hilo` (INVENTARIO). Primer pedazo de E3 (§47); las
menciones de grupo y la preferencia de avisos van en E3b.

**Modelo.** Una respuesta es un mensaje más del chat con `hiloDe` (el `seq` de
la raíz), en el mismo espacio de `seq`: reutiliza sync, cola, editar, borrar,
acuses y push sin caminos nuevos. `enElChat: true` («También enviar al chat»)
la muestra además en el chat. La raíz guarda el resumen
`hilo {respuestas, ultimaEn, ultimaSeq, autores}` (los 3 últimos), que se
actualiza con un update pipeline atómico (`server/src/hilos.ts`,
`updatePipeline: true`); al borrar una respuesta se descuenta.

**Reglas del server** (`validarRaiz`, antes de reservar el `seq`): no hay hilos
dentro de hilos; no admiten respuestas las líneas de sistema, lo borrado ni lo
cifrado → 400 con «Ese mensaje no admite respuestas en hilo.». Evento
`msg.hilo {chatId, raiz, hilo}` a los miembros cuando cambia el resumen.
`GET /api/chats/:id/hilos` (resúmenes, al abrir/reconectar) y
`GET /api/chats/:id/hilos/:raiz` (raíz + respuestas, tope 500). Push de una
respuesta solo a quien escribió la raíz, a los que respondieron y a los
mencionados («En un hilo: …»); con `enElChat`, a todos.

**Cliente** (reglas puras en `shared/src/hilos.ts`: `visibleEnElChat`,
`textoDelChipDeHilo`, `hayRespuestasNuevas`, `respuestasDelHilo`,
`aplicarResumenDeHilo`):
- Debajo de la raíz, el chip «1 respuesta · 6:53» / «N respuestas · última
  HH:MM» con los últimos que respondieron y un punto si hay nuevas de otros.
  Lo visto vive en el equipo (app: AsyncStorage `lilachat-hilos-vistos`; web:
  localStorage), por raíz.
- «Responder en hilo» en la barra de selección (app) y en el menú del mensaje
  (web); no aparece en respuestas, sistema, borrado ni cifrado.
- App: `HiloScreen` (modal; atrás lo cierra y lo escrito queda como borrador).
  Web: `PanelDeHilo` como tercera columna desde 1024 px (cierra «Info.») y
  pantalla completa debajo, con las mismas burbujas del chat (menú, checks,
  reintentar).
- La respuesta pendiente sale al instante en el hilo (y en el chat solo con la
  casilla). La casilla se desmarca tras cada envío, como en Slack.
- La lista muestra «En un hilo: …» si lo último fue una respuesta.

**Decisiones del MVP:** las respuestas cuentan como no leídas del chat (como
Slack sin «solo menciones»; se afina con la preferencia de E3b). Sin índice
`{chatId, hiloDe}`: las consultas van por `chatId` + `seq`, que ya está
indexado; si el volumen lo pide se crea con el OK de José (base de
producción).

**Archivos que se partieron por el tope de 600 líneas:** `chatService` →
`acusesDelChat.ts` y `erroresDelChat.ts` (re-exportados); `socket.ts` →
`reparto.ts`; `useChat` → `useResumenesDeHilos.ts`.

**E2E** (server de QA local sin crons, grupo «QA Hilos» con QA Ana y QA Beto):
- App (emulador, José): respuesta de Beto por socket → chip con punto, la
  respuesta no sale en el chat; el hilo coincide con el diseño; responder solo
  al hilo y con «También enviar al chat» (sale en los dos); el chip pasa a
  «3 respuestas · última …» sin punto; la fila dice «En un hilo: Confirmado
  para las 7»; la casilla se desmarca al enviar.
- Web (navegador propio vinculado como QA Ana): fila «En un hilo: …», chip
  con punto, panel con raíz y respuestas de José; responder solo al hilo y
  con la casilla; la respuesta de Beto entra en vivo; el chat muestra solo lo
  enviado también al chat; la pendiente sale al instante en el panel (había
  un defecto: la cola perdía `hiloDe` al dibujarse; test + arreglo en
  `local/enPantalla.ts`); a 390 px el panel ocupa la pantalla.
- QA en cero (usuarios, chats, mensajes, acuses) y los dispositivos de José
  en 20. El re-ingreso por OTP del emulador mandó un código por WhatsApp al
  teléfono de José; el correo de la invitación quedó restaurado.

**Queda (E3b):** `@todos` / `@aquí` en grupos y la preferencia por chat
«todo / solo menciones» (push y contador). Después, E4.

## 56. Auditoría de chats 1:1 y grupos (19/10/2026, 0.1.102)

José, 19/10: «mando un mensaje, aparecen 2 checks; salgo y en la lista aparece
un check y encima el círculo de no leído, siendo mío. Vuelvo a entrar y aparece
un check». Y: «al subir una imagen se marca el porcentaje y se siente lento; en
WhatsApp se muestra la foto y se sube por detrás». Auditoría de solo lectura
(server ↔ app ↔ web) con evidencia; el informe completo quedó en el scratchpad
de la sesión. Lo corregido:

| Defecto | Causa | Arreglo |
| --- | --- | --- |
| 2 checks en el chat, 1 en la lista y 1 al volver | Solo el chat abierto escuchaba `receipt`; la lista guardaba el acuse del server y el chat partía de esa foto (parámetros de la ruta) | La lista aplica los acuses en vivo (`aplicarAcuseALista`, misma regla que `useAcuses`) y el chat toma su base de la lista viva (`useAcuseVivo` sobre `chatsGuardados`) |
| Círculo de no leído en un mensaje propio | Al volver de la galería la lista se recarga ANTES de que llegue mi acuse; y el server marcaba lo propio después de repartir el mensaje | La recarga deja leído el chat abierto; MI acuse baja mis no leídos en la fila; el server marca lo propio ANTES de repartir (`leerLoPropio`) y avisa el acuse si responder leyó lo ajeno |
| Mi línea de sistema («Fijaste un mensaje») me contaba como sin leer | `avisarEnElChat` y la línea de llamada no marcaban lo propio | `publicarAviso`: leída para quien actuó si estaba al día (sin push) |
| Programados y auto-respuestas daban por leído lo ajeno (azul falso) | `marcarPropioLeido` sin condición | `soloSiAlDia`: solo avanza si ya estaba al día |
| Sumar a alguien bajaba a 1 check todo el grupo | El nuevo no tenía acuse (cuenta 0 y manda el menor) | Al sumarlo, su acuse arranca en el último `seq` |
| Con «Conexión permanente», leído con la pantalla apagada | `useAlAbrirElChat` acusaba sin mirar `AppState` | `hastaDondeLeer`: en segundo plano no se acusa; al volver, sí |
| La vista previa no se enteraba de ediciones ni borrados; una foto borrada seguía «Foto» | Sin oyentes en la lista; `lastMessage` sin `deletedAt` | Oyentes `msg.edited`/`msg.deleted` en la app (la web relee); `deletedAt` en la lista; `resolveChatPreview({eliminado})` → «Se eliminó este mensaje» en cursiva y sin checks |
| «Escribiendo…» se apagaba escribiendo un párrafo | `on:true` una vez por ráfaga; el que mira apaga a los 4–6 s | Se renueva cada 3 s (`debeAvisarEscribiendo`, shared); la web reinicia el apagado con cada `on` |
| Web: mi línea de sistema quedaba sin leer con el chat abierto; volver a la pestaña no acusaba | Solo acusaba hasta el último ajeno, sin `visibilitychange` | `seqParaAcusar` (último confirmado) + acusa al volver |
| Foto: burbuja tarde, de a una, «Enviando… %» dos veces, parpadeo al confirmar, y desaparecía con el socket caído | La burbuja esperaba la copia; cola secuencial; % en la foto y en una línea; la copia se borraba; se quitaba la pendiente antes del `msg.new` | Burbuja YA con la uri original (`preparando`), todas a la vez, foto nítida con anillo (`AnilloDeSubida`), copia local conservada en la sesión, y el mensaje confirmado de la respuesta (`mensajeSubido`) entra al chat antes de quitar la pendiente |
| Reintento de una foto volvía a subirla a lila | El duplicado se detectaba después de subir | `mensajePropioPorClave` antes de subir; la respuesta trae el mensaje en forma de cliente |

**E2E en el emulador** (server de QA local, usuarios QA y «Ana» por socket):
checks gris → azul en vivo en la fila y al reentrar; foto sin red con anillo,
sube sola al volver la red sin desaparecer y queda con ✓✓; «✓✓ Foto» sin
círculo; borrado en vivo en la fila; «Fijaste un mensaje» sin círculo. QA en
cero (usuarios, chats, mensajes, acuses) y los dispositivos de José en 20. La
web quedó con tests, sin E2E en el navegador.

**Compresión (José, 19/10: «sí, comprime»):** como WhatsApp, el lado largo a
1600 px y JPEG al 70 % (`compresionDeFoto.ts`, puro con tests; `comprimirFoto.ts`
con `expo-image-manipulator`, dependencia nueva, gratuita, del SDK de Expo). Se
hace en la etapa «preparando» de la cola, con la burbuja ya visible; si falla,
va la original. «HD» en la previsualización manda la original; un documento
(«Archivo») va intacto aunque sea imagen; videos y GIF no se tocan. E2E: una
foto de 4000×3000 (23,6 MB) llegó en 1600×1200 y 102 KB; con «HD», la original.

**Segunda tanda (19/10, sin publicar):**

| Defecto | Arreglo |
| --- | --- |
| Lo recibido sin conexión quedaba en un check hasta abrir el chat | Al conectar, el server lo da por entregado (`entregarAlConectar`, solo chats atrasados) y avisa al remitente |
| El divisor de no leídos quedaba más arriba (el contador incluye lo propio y los avisos) | La lista trae mi `readSeq`; el divisor va arriba del primer ajeno después de lo leído y dice cuántos son (`divisorDesdeLeido`) |
| Un texto escrito después de una foto pendiente salía antes | `pendientesEnOrden`: texto y archivos por hora de envío |
| Abrir un chat marcado «no leído» sin nada nuevo no avisaba a mis otros equipos | `marcarLeidoDetallado` → `chat.changed` a mis sockets |
| La respuesta de `@lila` salía por un camino propio | Por `publicarMensaje`, como todo mensaje |
| Las fotos y archivos no se reenviaban | `POST /api/chats/:id/reenviar` copia la referencia y el pie (miembro del origen, nada borrado ni cifrado, idempotente); `planDeReenvio` en shared; app y web lo usan |
| Web: sin burbuja hasta subir, sin progreso, sin compresión, reintento duplicado, un fallo cortaba el lote | `colaDeArchivos` de la web: burbuja ya con la vista local, anillo de progreso (XHR), compresión con la regla compartida (`planDeCompresion` pasó a shared) y «HD», una clave por archivo, «No se envió» con reintentar |
| Web: la fila no tenía checks | `ChecksDeLaFila` con la regla de la burbuja |
| Web: cada mensaje y cada acuse pedían la lista entera (agregación sobre todos los mensajes) | La fila cambia en la base local con las reglas de la app (`listaEnVivo` pasó a shared, genérica); la lista entera solo ante un chat nuevo, al reconectar o con `chat.changed` |

E2E: en el emulador, el divisor («3 mensajes no leídos» arriba del primer
ajeno después de lo leído) y reenviar una foto a un grupo (mismo archivo y
pie); en el navegador, la web vinculada como usuario QA: fila que cambia sin
pedir la lista (0 pedidos por mensaje y por acuse), contador a 0 al abrir,
foto con anillo comprimida a 102 KB y con «HD» la original, checks azules en
la fila y el borrado en vivo. Sin E2E: el orden de lo pendiente sin red (el
corte de la Mac interrumpió la prueba; tiene test) y reenviar desde la web.
QA en cero y los dispositivos de José en 20.

**Queda:** las líneas de sistema AJENAS cuentan como no leídas (decisión de
producto).

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

**Prueba inestable del server, dos veces el 19/10, en tests distintos:**
«un admin le cambia título, descripción y hora» (recordatorios) y «encendido:
un invitado suma a un contacto suyo» (eventos: el invitar dio 404). Las dos,
justo después de crear el documento, y solo en la suite completa (`npm test`
de la raíz); aisladas y en 14 corridas más del server pasaron. Sospecha: algo
que sigue escribiendo después de responder en el test anterior. Si vuelve en
CI, el deploy no sale (`needs: verificar`).

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

### 54.10 W4 — PWA: abre sin internet y avisa la versión nueva (19/10/2026, sin publicar)

| Pieza | Qué | Dónde |
| --- | --- | --- |
| Service worker | A mano, 97 líneas con sus reglas en la cabecera: al instalar guarda la app y los archivos que nombra el `index.html`; cache-first solo `/assets/*`; navegación con 4 s de espera y, sin red, la app guardada; la API y el socket nunca pasan por él; la versión nueva espera a «Recargar» | `web/public/sw.js` |
| Servido sin extensión | `/service-worker` (y la vieja `/sw.js`) con `no-store`, `Service-Worker-Allowed: /` y la VERSION sacada del `index.html` del build; `/assets/*` con caché de un año (`immutable`); `index.html` con `no-cache` | server `serviceWorker.ts` (+4 tests), `app.ts` |
| Registro | Solo en producción, desde la primera visita (también sin sesión); busca versión nueva al volver a la pestaña, sin polling | `web/src/pwa/serviceWorker.ts`, `App.tsx` |
| Avisos | «Sin conexión. Lo que escribas se enviará al volver» (sin red, o sin socket más de 5 s); «Hay una versión nueva · Recargar»; «Instalar Lilachat en esta computadora» en Ajustes cuando el navegador lo ofrece | `pwa/conexion.ts` (+4 tests), `pwa/instalar.ts`, `Shell.tsx` |
| Sesión que vuelve sola | Sin sesión viva, se reintenta al volver la red o la pestaña y cada 15 s (solo al frente). Sin esto, si volvía el SERVER y no la red, quedaba «Sin conexión» hasta recargar | `sesion/useSesion.ts` (+1 test) |
| Nombres sin red | Los miembros de cada chat se guardan en la base local: sin red, el autor sigue con su nombre y no «Alguien» | `useDetalleDelChat.ts` |

**E2E (19/10):** el navegador del panel **no deja registrar service workers**
(falla hasta `/sw.js`), así que la prueba fue en un Chromium aparte (Playwright
sin ventana) contra la web compilada: el service worker queda activo y guarda
la app y sus cinco archivos; **con el server apagado** una ruta interna abre la
app, con los chats, los mensajes, los nombres y el aviso «Sin conexión»; un
build nuevo aparece como «Hay una versión nueva» y «Recargar» lo activa y borra
la caché vieja; al prender el server la web vuelve sola en 16 s; lo escrito con
el server caído sale al volver (9 s). QA en cero.

### 54.11 W5 — vincular la web con el QR del teléfono (19/10/2026, sin publicar)

Diseños: `w5-web-vincular.png`, `w5-app-vinculados.png`, `w5-app-escaner.png`
(Stitch, en `design/stitch/INVENTARIO.md`).

| Pieza | Qué | Dónde |
| --- | --- | --- |
| Formato del QR | `https://<origen>/v/<token>`: 32 bytes en base64url. Lo arma la web y lo lee la app con el MISMO módulo; solo http/https y la ruta exacta | shared `vinculacion.ts` (+4 tests) |
| Vinculaciones en curso | **En memoria, no en la base**: duran 5 min y un reinicio solo obliga a pedir otro QR (una colección pediría un índice TTL, y la bóveda no crea índices). La web recibe `id` + `clave` privada; el QR lleva un token que cambia cada 20 s y vence a los 60 s; se guardan hashes; aprobar es de un solo uso y canjear exige la clave | server `vinculaciones.ts` (+9 tests) |
| Web (sin sesión) | `POST /api/auth/vincular/iniciar` (30 por minuto por IP, `cf-connecting-ip`), `/rotar`, `/esperar` (long-poll de 25 s; si la pestaña se fue, no canjea). Al canjear: dispositivo `vinculado-<uuid>` con el hash de su secreto, cookie `HttpOnly` y JWT. «Mantener la sesión iniciada» apagado = cookie sin `Max-Age`, también al renovar | `vincularRoutes.ts`, `dispositivosVinculados.ts`, `cookieDeDispositivo.ts` |
| Teléfono (con sesión) | `POST /api/vinculos/consultar` (el nombre del navegador, sacado del User-Agent) y `/aprobar`; `GET /api/vinculos`; `DELETE /api/vinculos/:deviceId`. Una web vinculada recibe 403 en todo esto. Máximo 4 (se mira al aprobar y otra vez al canjear) | `vincularRoutes.ts`, `nombreDelNavegador.ts` (+2 tests) |
| Revocar al instante | Toda ruta con sesión y el handshake del socket preguntan si la vinculada sigue (recordado 1 min; esa lectura anota el último uso). Cerrar desde el teléfono borra el dispositivo, corta su socket (sala `device:<id>`) y avisa `vinculos.changed`. La cookie de una borrada da 401 y se borra; **constroad-auth nunca se consulta** para una vinculada. «Cerrar sesión» en la web vinculada la desvincula | `requireSession.ts`, `socket.ts`, `authRoutes.ts` (`/session`, `/salir`) |
| Pantalla web | Pasos + QR que se renueva solo con su barra; «Entrar con número de teléfono»; vencido → «Generar otro código». Rotación y espera **se pausan con la pestaña oculta**; si el teléfono aprueba en ese rato, se canjea al volver. En pantalla angosta abre por el número (un celular no escanea su propia pantalla). `/v/<token>` abierto con la cámara del teléfono explica dónde se escanea | `auth/PantallaDeVincular.tsx`, `useVinculacionPorQr.ts` (+8 tests), `caminoDelQr.ts` (`qrcode-generator` 2.0.4, MIT; corrección Q), `AccessScreens.tsx` (+3 tests), `CodigoParaLaApp.tsx` |
| App | Ajustes → «Computadora» → **Dispositivos vinculados**: portada, «Vincular un dispositivo», lista con último uso y cerrar sesión (confirmado). Escáner con `expo-camera` (MIT) y hoja «¿Vincular Chrome en macOS?» con el aviso «solo una computadora tuya»; antes de aprobar pide el desbloqueo del teléfono (`expo-local-authentication`, MIT; sin bloqueo configurado, no hay qué pedir). **Exige APK nuevo** | `DispositivosVinculadosAjuste.tsx`, `EscanerDeVinculacion.tsx`, `useEscanerDeVinculacion.ts`, `desbloqueo.ts`, `vinculos.ts` (+5 tests), `api/client.ts` |

**Decisiones no evidentes:** el long-poll en vez del socket de la vinculación
(la web no tiene sesión y un long-poll en memoria no cuesta nada mientras
espera); el JWT de la vinculada sigue de 24 h porque la revocación ya no
depende de que venza.

**Riesgo conocido (QRLjacking):** quien logre que la víctima escanee un QR
ajeno se lleva la sesión. Lo frenan el nombre del navegador en la hoja, el
aviso ámbar, el desbloqueo del teléfono y la lista con «Cerrar sesión».

**E2E (19/10), de punta a punta:** web compilada en un Chromium sin ventana
contra el server QA (sin crons) y la app de desarrollo en el emulador. La
cámara del emulador se arranca con `-camera-back imagefile:<png>` y el PNG es
la captura del QR que dibujó la web (la escena virtual deja el póster fuera de
cuadro). Para que ese QR siga vigente mientras el emulador reinicia, el server
QA inyecta un reloj 30 veces más lento en `crearVinculaciones` (solo en el
script de QA, nada en el código). Verificado: el escáner lee el QR, la hoja
pregunta por el navegador, «Vincular» (sin bloqueo en el emulador) aprueba, la
web entra sola con su dispositivo `vinculado-…`, la fila aparece en el
teléfono sin reabrir («Activo ahora»), «Cerrar sesión» en el teléfono saca a
la web en menos de 5 s (perfil y base local borrados, vuelve al QR), recargar
una web revocada vuelve al QR, y un QR ya usado avisa «El código venció». QA
en cero (0 vinculadas, los 20 dispositivos de José).

| Defecto que encontró el E2E | Causa | Arreglo |
| --- | --- | --- |
| La fila nueva no aparecía en el teléfono hasta reabrir | la app releía apenas aprobaba, y el dispositivo nace después, cuando la web canjea | la lista escucha `vinculos.changed` del socket |
| La web revocada se quedaba con los chats guardados y «Sin conexión» | socket.io no reintenta un corte del SERVER, y sin un pedido HTTP nadie veía el 401 | `useSocket` renueva la sesión ante `io server disconnect` y ante `unauthorized` al reconectar (el JWT vencido de una pestaña abierta 24 h tampoco reconectaba); renovada, reconecta con el token NUEVO; rechazada, cierra (+3 tests) |
| El escáner no leía nada | CameraX analiza solo lo que muestra el visor; el póster quedaba cortado | póster calibrado (detalle del E2E, no de la app) |
| El título blanco no se leía sobre una cámara clara | sin fondo | franja `bg-black/50` en la cabecera del escáner |
| Con un QR usado delante, consultaba al server cada 2,5 s | cada lectura volvía a preguntar | se recuerda el último rechazado (salvo sin red) |

También: el test de W4 «se reintenta sola» tiraba un `TransactionInactiveError`
suelto en 2 de cada 4 corridas (falseaba `setImmediate`, que usa
fake-indexeddb); ahora solo falsea timeouts e intervalos (6 de 6 limpias).

### 54.12 W3a — la lista de chats como WhatsApp Web (19/10/2026, sin publicar)

W3 se partió en cuatro: **W3a** lista, **W3b** info del chat y del grupo
(diseño `w3-web-info-grupo.png` listo), **W3c** agenda, encuestas, eventos y
recordatorios, **W3d** Lila y ajustes completos. Diseño de W3a:
`w3-web-lista.png`.

| Pieza | Qué | Dónde |
| --- | --- | --- |
| Filtros y búsqueda | Chips Todos · No leídos · Grupos · Borradores con su cuenta (de la principal, sin la búsqueda); la búsqueda ignora tildes y mira el último mensaje. Mismos motores que la app (`filtrarChats`, `contarChats`) | `listaDeChats.ts` (`armarLista`, +3 tests), `FiltrosDeLaLista.tsx` |
| Archivados | Fuera de la principal; fila «Archivados» con su cuenta; adentro, cabecera con «volver» y sin chips; vacío → vuelve sola | `FiltrosDeLaLista.tsx`, `ChatList.tsx` |
| Menú por fila | Flecha al pasar el mouse o con el foco (Radix): archivar/desarchivar, silenciar/activar, fijar/desfijar, leído/no leído, salir (grupos) y eliminar (1:1 y borradores), del motor `accionesDeSeleccion` de la app. Un borrador no se silencia. Salir y eliminar se confirman | `menuDelChat.ts` (+6 tests), `MenuDeChat.tsx`, `FilaDeChat.tsx` |
| Marcas en la fila | Chincheta (fijado), campana tachada (silenciado), número de sin leer (gris si silenciado) o punto de «no leído» | `FilaDeChat.tsx` |
| Aplicar | Optimista en la base local y después `PATCH /chats/:id/ajustes`; si el server rechaza, vuelve atrás y lo dice. Eliminar (`borrar-para-mi`) y salir (`leave`) esperan al server. Un 401 renueva la sesión y reintenta una vez | `sync/accionesSobreChats.ts` (+8 tests), `local/chatsLocales.ts` (+3 tests) |
| Borradores | «Nuevo borrador» en el menú de la cabecera (chat `notas` con nombre); lápiz «Nuevo chat» en la cabecera | `NuevoBorrador.tsx`, `ChatList.tsx` |
| Mis otros dispositivos | Archivar, silenciar, fijar, leído y eliminar desde la web avisan `chat.changed` a MIS sockets (el teléfono lo refleja al toque), no al otro miembro | server `chatRoutes.ts` (+2 tests de socket) |
| Ancho | Lista de 340 px en tablet y 400 px desde 1024: los cuatro chips entran | `ChatList.tsx` |

**E2E (19/10)** con un Chromium propio (el del MCP se compartía y se cerraba
solo, llevándose la cookie de la web vinculada): web vinculada por QR al
teléfono del emulador; archivar → la fila se va, «Archivados 1», y en el
TELÉFONO el chat pasa a Archivados en menos de 3 s; desarchivar, silenciar,
fijar (queda primera), no leído (punto y «No leídos 1»), leído, desfijar,
activar; nuevo borrador (se abre en `/c/…`, «Borradores 2») y eliminarlo con
confirmación; salir del grupo (José deja de ser miembro); eliminar el 1:1. A
1440, 900 y 390 px sin scroll horizontal. QA en cero.

| Defecto que encontró el E2E | Causa | Arreglo |
| --- | --- | --- |
| **Un 401 al abrir cerraba la sesión** (y desvinculaba la web) | sin token todavía, `manejar401` comparaba `null` con la marca inicial `null`: «segundo 401 con el mismo token» | sin token, un 401 espera la renovación en curso y no cuenta; una sola renovación a la vez (`useSesion`, +2 tests) |
| Archivar al abrir la página daba «Tu sesión venció» | el PATCH salía antes de terminar la renovación | las acciones renuevan y reintentan una vez; `manejar401` devuelve el token nuevo |
| **Un acuse adelantado** (`readSeq: 99` en un chat de 1 mensaje): los 98 siguientes nacían leídos y con check azul para el otro | el server guardaba y re-difundía el `seq` del cliente sin mirar `lastSeq` | `markRead`/`markDelivered` recortan al último mensaje y devuelven el `seq` que quedó, que es el que se difunde (+2 tests). En producción solo había ese recibo (el del grupo QA, ya borrado). Quién mandó el 99 no se pudo identificar |
| El menú abierto se cerraba solo tras fijar | dos recargas de la lista se cruzaban: la vieja pisaba el cambio optimista, la fila bajaba y volvía a subir | «gana la última» (`ultimaGana.ts`, +2 tests) y un cambio optimista invalida las recargas en vuelo |
| Eliminar un borrador decía «a la otra persona no le cambia nada» | texto del 1:1 | texto propio del borrador (+1 test) |
| Con la flecha enfocada, la hora se le superponía | la hora se ocultaba solo con el mouse | también con el foco (`group-focus-within`) |

**Fuera de W3a (anotado):** el «Borrador: …» en rojo del diseño es el texto sin
enviar de un chat (WhatsApp); Lilachat no guarda eso todavía.

### 54.13 Fijar mensajes y la barra de selección en una línea (19/10/2026, sin publicar)

José, 19/10: «falta fijar chat y hacer pin a mensajes. El botón borrar se
pierde en la parte de arriba, ¿no deberían estar todos en la misma línea y
visibles?». Fijar **chats** ya estaba (selección de la app y menú de la web,
W3a). Diseños: `fm-app-seleccion.png`, `fm-app-duracion.png`, `fm-web-fijado.png`.

| Pieza | Qué | Dónde |
| --- | --- | --- |
| Motor | 24 h, 7 días o 30 días; hasta 3 por chat (el cuarto saca al fijado hace más tiempo; refijar renueva); en un grupo solo admins, en un 1:1 o borrador cualquiera; la acción «Fijar/Desfijar» de un mensaje (no con varios ni borrados); el texto de la franja (secreto: el que descifró el dispositivo; adjunto: «Foto», «Nota de voz»…); la línea «X fijó / Fijaste un mensaje» | shared `mensajesFijados.ts` (+13 tests), `accionesDeMensaje.ts`, `avisoDeGrupo.ts` (`fijo`) |
| Server | `chat.fijados` (sin índices nuevos); `POST /api/chats/:id/fijados {seq, duracion}` y `DELETE …/:seq` con el permiso comprobado contra la base; la línea en el chat (no en uno secreto); `chat.changed` a todos; la lista de chats trae los vigentes con su vista previa (una consulta para todos, en paralelo; sin texto si es secreto; respeta «borrar para mí»); borrar para todos desfija | `mensajesFijados.ts`, `fijadosRoutes.ts`, `listaDeChats.ts`, `chatService.ts` (+10 tests) |
| Barra de la app | En UNA línea: lo que entra por ancho a la vista (Responder, Fijar, Reenviar, **Eliminar siempre**, Copiar…) y el resto en «⋮». A 360 dp con un mensaje propio: cinco a la vista, Editar e Info en «⋮»; con uno ajeno, todo a la vista | `barraDeSeleccion.ts` (+5 tests), `SeleccionDeMensaje.tsx` |
| App | Hoja «¿Por cuánto tiempo?» (abre en 7 días); franja bajo la cabecera: tocar va al mensaje y pasa al siguiente («1/3»), mantener ofrece desfijar; se relee con `chat.changed`. «Ir a un mensaje» salió de `ChatScreen` (estaba en 600 líneas) | `HojaDeFijarMensaje.tsx`, `FranjaDeFijados.tsx`, `useFijarMensajes.tsx`, `useIrAMensaje.ts` |
| Web | «Fijar/Desfijar» en el menú del mensaje, diálogo de duración, franja con «Ir al mensaje» y «Desfijar», y la lista virtualizada que salta y resalta el mensaje. Las líneas de aviso (en la conversación y en la vista previa de la lista) se arman con el motor compartido: decían «902049935 fijó un mensaje» | `MenuDelMensaje.tsx`, `DialogoFijar.tsx`, `FranjaDeFijados.tsx`, `useFijarEnLaWeb.ts`, `ListaDeMensajes.tsx` (`salto`), `BurbujaDeMensaje.tsx` (`LineaDeSistema`), `FilaDeChat.tsx` (+12 tests) |

**E2E (19/10)**, web vinculada por QR y app en el emulador a **360 dp**
(`wm density 480`): la barra entra entera con Eliminar a la vista; fijar 7 días
y 24 h desde la app (franja «1/2», «Fijaste un mensaje»); la web ve los dos, va
al mensaje (resaltado), fija un tercero (30 días) y la APP lo muestra «1/3» en
3 s; desfijar desde la web y desde la app (mantener la franja); en un grupo
donde José no es admin, no hay «Fijar». QA en cero.

| Defecto que encontró el E2E | Arreglo |
| --- | --- |
| Tras fijar, la franja seguía en el índice anterior | un fijado nuevo vuelve al principio (+1 test) |
| La web decía «902049935 fijó un mensaje» (en el chat y en la lista) | se arma con `textoDeAviso`: «Fijaste un mensaje» / «Ana fijó…» (+4 tests) |

### 54.14 W3b — «Info.» del chat y del grupo en la web (19/10/2026, sin publicar)

Diseño: `w3-web-info-grupo.png`. Se abre tocando el nombre o la foto de la
cabecera; tercera columna de 400 px desde 1024 px, encima de la conversación en
pantallas más angostas.

| Pieza | Qué | Dónde |
| --- | --- | --- |
| Vista | Título por tipo (grupo / contacto / borrador), «Grupo · N participantes», el teléfono del contacto o «Solo tú lo ves»; yo primero, después admins y el resto por nombre. Quién edita, suma, saca o nombra admin lo preguntan las MISMAS reglas del server (`puedeEditarInfo`, `puedeAgregar`, `accionesDeMiembro`) | `info/infoDelChat.ts` (+5 tests) |
| Editar | Nombre en línea (Enter guarda), foto (archivo), sumar desde los contactos, nombrar o quitar admin, sacar (confirmado); el motivo del server se muestra | `info/useEditarChat.ts` (+4 tests), `IdentidadDelChat.tsx`, `ParticipantesDelChat.tsx` |
| Resto | Silenciar (la misma acción de la lista), archivos de la base local con miniaturas que abren el visor, «Salir del grupo» y «Eliminar chat» confirmados | `PanelDeInfo.tsx` (+5 tests), `ArchivosDelChat.tsx` |
| Detalle | Trae silenciado, foto y nombre; se relee si cambian miembros, nombre o foto de la lista, o tras editar | `useDetalleDelChat.ts` |
| Avatar | Una foto que no carga cae a la inicial | `ui/Avatar.tsx` |

**E2E (19/10):** renombrar (cabecera, lista y la APP con el nombre nuevo),
cambiar la foto (la app la muestra), silenciar, nombrar admin, sacar a un
miembro («2 participantes»), salir de un grupo sin ser admin (sin menús de
participantes), «Info. del contacto» a 390 px a pantalla completa sin scroll
lateral y eliminar el 1:1 (cierra el panel). QA en cero.

**No es un defecto:** a otro admin no se le quita el rol (solo uno mismo deja de
serlo; `puedeCambiarRol`). **Pendiente:** si OTRO cambia los roles, el panel
abierto no se entera hasta reabrirlo (la lista no trae roles).

### 54.15 W3c — agenda en la web (19/10/2026, en pausa)

Diseños listos en Stitch (`w3c-web-tarjetas`, `w3c-web-agenda`,
`w3c-web-recordatorio`). Primer paso hecho: la lógica pura de la agenda pasó de
la app a `shared` para que la web use la misma (`encuestas`, `eventos`,
`recordatorios`, `guardarRecordatorio`, `cuando`, `tarjetasVivas` y los tipos en
`tiposDeAgenda`). En pausa: José priorizó la auditoría de chats, las fotos y E3/E4.

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
| E3 | **Hilos y menciones** (@persona, @canal, @aquí); avisos configurables: todo o solo menciones | ✅ E3a hilos (§57); E3b `@todos`, `@aquí` y avisos por grupo (§67). Falta la pestaña «Menciones» |
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

## Pendientes de José (backlog, desde 20/10/2026)

Lo que José pidió dejar anotado para después. Se agrega acá, al final, y se
tacha con la versión que lo cierra.

1. ~~**Configurar la fuente del chat.**~~ **Hecho (§81, 0.1.122).** Como WhatsApp (Ajustes › Chats › Tamaño
   de la fuente: Pequeña · Mediana · Grande): un multiplicador que leen la
   burbuja, la cita, la tarjeta de enlace y la barra (app, por contexto; web,
   con una variable CSS), encima del tamaño de letra del sistema, que se sigue
   respetando. Se guarda por equipo. Tests del motor de tamaños y captura a
   360 dp con «Grande» para que nada se corte.
2. ~~**Crear stickers como WhatsApp.**~~ Hecho en §63 (sin publicar). Desde una foto: recortar el sujeto
   (Android: ML Kit Subject Segmentation, en el equipo y gratis; web:
   segmentación de MediaPipe, Apache 2.0), sumar texto o emoji, y guardar
   en «Mis stickers» como WebP 512×512 con transparencia. Se mandan como
   mensaje `sticker` (sin burbuja, con reacciones), se pueden tocar para
   guardar el de otro y tienen favoritos. Antes de elegir una librería de
   recorte se revisa la licencia (sin AGPL ni de pago sin preguntar).
3. ✅ **Guiños y zumbido, como el Messenger de antes.** Zumbido en §71; guiños en §74 y §77–§79 (0.1.117–0.1.120).

4. ✅ (commit 552c8c4) **Bug web: cerrar un hilo deja la pantalla en blanco** (José, 20/10). Crear
   un hilo y tocar la X del panel: toda la web queda en blanco hasta
   recargar. Reproducir en su Chrome con la sesión viva y mirar la consola
   (un error de React sin `ErrorBoundary` tumba todo el árbol).
   **20/10, sin publicar: mitigado, sin reproducir.** Con el código actual no
   se reprodujo (E2E contra el server QA: crear el hilo desde el botón,
   responder y cerrar; sin responder; cerrar al instante; en un 1:1; a 1280 y
   800 px: el chat queda y no hay errores). La web no tenía ningún
   `ErrorBoundary`: ahora `ui/ErrorBoundary` envuelve el panel del hilo y el
   de «Info.» («No se pudo mostrar el hilo.» + Cerrar, el chat sigue) y la app
   entera («Algo falló al mostrar Lilachat.» + Recargar, nunca en blanco). El
   error queda en la consola como `[lilachat] el hilo failed to render`: si
   vuelve a pasar, ese texto dice la causa.
5. ✅ (agenda del teléfono en la web, `useAgendaRelay`) **Bug web: la lista, el chat y su detalle muestran el número y no el
   nombre del contacto** (José, 20/10: «pésima experiencia»). La web no tiene
   la agenda del teléfono: usar los contactos que la app ya sincroniza con el
   server (`/api/contacts`) para nombrar, como hace la app con
   `nombreDeContacto`. Probar en su Chrome real, no solo en el navegador de QA.
6. ~~**Ver videos de YouTube, Instagram, Facebook y TikTok dentro de Lilachat**~~ **Hecho (§114, 0.1.152), sin el mini reproductor flotante.**
   sin salir, con **mini reproductor flotante** que siga al salir de la app o
   con la pantalla bloqueada. Viable con límites: YouTube permite su
   reproductor embebido (IFrame API; en Android, WebView), pero sus términos
   prohíben reproducir con la pantalla bloqueada o en segundo plano fuera de
   YouTube Premium, así que el flotante con pantalla bloqueada no es posible
   para YouTube; sí el PiP de Android mientras se usa otra app. Instagram,
   Facebook y TikTok permiten embeber su publicación (oEmbed / embed.js), sin
   PiP garantizado. Para videos subidos al chat (archivos propios) sí se
   puede todo: `expo-video` con PiP y audio en segundo plano.
7. ~~**Ver PDF dentro de la app**~~ **Hecho (§110, 0.1.148).** Viable. Android tiene `PdfRenderer` nativo
   (páginas como imágenes, sin dependencias) y existe `react-native-pdf`
   (MIT); la web usa el visor del navegador o pdf.js con rangos (como el visor
   de Lab Vial). Hoy un PDF se abre con otra app.
8. ~~**Checklist en los chats, como Telegram**~~ **Hecho (§80, 0.1.121); lo que sigue en el 30.**: lista con tareas que cualquiera
   del chat (o solo quien la creó, según se configure) puede marcar; cada ítem
   dice quién lo marcó; se agregan ítems después; se ve como tarjeta y se
   actualiza en vivo (`ref.changed`). App y web.
9. ~~**Compartir un contacto** en el chat (como WhatsApp): tarjeta con nombre y
   teléfono, «Enviar mensaje» si está en Lilachat y «Agregar a contactos».~~ **Hecho (§108, 0.1.146).**
10. ~~**Sacar «Cámara» del menú del clip**~~ (hecho en §63.3): ya hay botón de cámara en la barra;
    en el clip sobra y además aparece primero.
11. **Compartir ubicación y ubicación en tiempo real** (**la fija, hecha en §114**; falta la de tiempo real) (15 min / 1 h / 8 h),
    que se siga actualizando con la pantalla bloqueada: servicio en primer
    plano de tipo `location` en Android con el permiso de ubicación «siempre»
    (o «mientras se usa» + servicio visible), envío por socket con pausa si no
    hay red, y en el mapa del chat (MapLibre, sin servicio pago). Ver la
    memoria de GPS en segundo plano (en una PWA no es posible; en la app sí).

12. ~~**Varias fotos o videos en carrusel, como Instagram**~~ **Hecho (§110, 0.1.148).** un envío de varias
    fotos/videos se agrupa en una sola tarjeta (álbum) que se desliza de
    lado, con el contador «2/5»; tocar abre el visor en esa foto. App y web.
13. ~~**Administrar el almacenamiento**~~ **Hecho (§114, 0.1.152), sin «reenviados muchas veces».** Como WhatsApp: por chat (cuánto pesa
    cada uno, fotos, videos, documentos y audios, con borrar en lote) y la
    lista global «chats que más pesan» para limpiar, más «archivos de más de
    5 MB» y «reenviados muchas veces». En el teléfono es la copia local; en la
    web, la caché del navegador.
14. ~~**Visor de videos y PDF en la web** (hoy solo hay visor de fotos) y **mini
    reproductor** para videos: viable con el Picture-in-Picture del navegador
    (`requestPictureInPicture` sobre el `<video>`), que sigue flotando aunque
    se cambie de pestaña.~~ **Hecho (§109, 0.1.147).**
15. ~~**Estado que maneja la persona**~~ **Hecho (§110, 0.1.148).** En línea · Ausente · Ocupado ·
    Invisible (se ve desconectado aunque esté usando la app), más quién ve mi
    «última vez». Hoy la presencia es automática (socket vivo o no).
16. **Lilachat Empresa: catálogo, bot de publicidad y redes sociales**, como
    WhatsApp Business: catálogo de productos con foto, precio y stock que se
    comparte en el chat; respuestas rápidas, mensajes de bienvenida y de
    ausencia, etiquetas de clientes; un bot (Lila) que redacta y diseña la
    publicidad de un producto y la publica en las redes.
    **Zernio (zernio.com), analizado el 20/10:** es una API REST y un
    servidor MCP para publicar, programar y medir en ~15 redes (Instagram,
    TikTok, YouTube, Facebook, LinkedIn, X, Threads, Pinterest, WhatsApp,
    Telegram, Google Business…) y para manejar campañas en 8 redes de
    anuncios. No genera el contenido ni tiene catálogo: es el «caño» de
    publicación. Cobra por cuenta conectada (2 gratis, después 6 / 3 / 1 USD
    por cuenta según volumen). Dos caminos: (a) usar Zernio como proveedor
    (rápido, pago por cuenta: se pregunta antes por ser un servicio con costo)
    o (b) integrar directo las APIs oficiales (Meta Graph para Instagram y
    Facebook, TikTok Content Posting, YouTube Data) con la aprobación de cada
    plataforma, que tarda semanas. El contenido lo genera Lila (texto e
    imagen); el catálogo es nuestro.
    **REA (github.com/morluto/rea), analizado el 20/10:** NO sirve para esto.
    Es una herramienta MIT de **ingeniería inversa** (binarios, APKs, webs,
    capturas de red) para agentes; no publica ni genera publicidad. Usarla
    para copiar Zernio u otro producto ajeno queda fuera de su uso declarado
    (software propio o autorizado) y sería un riesgo legal. Para construir
    algo como Zernio se usan las APIs oficiales.

17. ~~**Recordatorio de cumpleaños en grupos y chats (opcional)**~~ **Hecho (§110, 0.1.148), salvo «Crear tarjeta con IA» (decide José: modelo pago).** (José, 20/10).
    - ~~**Alta:**~~ **Hecho (§93, 0.1.133)**, con correo verificado. Nombre y fecha de cumpleaños pasan a ser OBLIGATORIOS al
      registrarse (hoy el nombre es opcional y la fecha no existe). Quien ya
      tiene cuenta los completa la próxima vez que abre la app (pantalla de
      «Completa tu perfil»), sin poder saltarla. El año es opcional al
      mostrarlo («cumple 29 años» solo si lo dejó ver); cada persona elige si su
      fecha la ven todos sus chats o nadie.
    - **Por chat:** «Cumpleaños» se activa en la info del grupo (sus admins) o
      del 1:1 (cualquiera de los dos); apagado por defecto.
    - **El día del cumpleaños** (hora local de quien mira, a partir de las
      8:00): al abrir ese chat sale el aviso a **pantalla completa con
      confeti** y la **tarjeta de felicitación** con el avatar del
      cumpleañero, «¡Feliz cumpleaños, Carla!», «Hoy cumple 29 años · Obra
      Miraflores», reacciones rápidas (pastel, aplausos, corazón, fiesta) y
      «Saludar en el grupo» (escribe el saludo en el campo). Una vez por día y
      por chat; al cumpleañero no se le muestra su propia tarjeta, sino los
      saludos. Además, un aviso destacado en el chat («Hoy cumple Carla») y un
      push suave a la mañana.
    - **Extra pro: «Crear tarjeta con IA»**: genera una imagen de felicitación
      (con el nombre y, si se quiere, el avatar) para mandarla al chat. Necesita
      un modelo de imágenes: es un servicio con costo, se elige con José antes.
    - **Diseño:** `c1-app-cumpleanos` (Stitch, pantalla
      `cd0ecbeba4524e54b2bd8ba2886d7b9b`). Al implementar se quita el logo
      que Stitch inventó arriba a la izquierda de la tarjeta («RKLES»).
18. ~~**Hilos: el nombre de quien escribe y los avatares**~~ (hecho el 20/10, sin publicar; José, 20/10,
    captura del hilo con Wilson). En la app, la raíz del hilo dice «Alguien»
    en vez del nombre: en un 1:1 el autor no está en el mapa de nombres del
    grupo; hay que resolverlo como la lista (contacto de la agenda → nombre
    del perfil → número). Y el chip del hilo en el chat no muestra los
    avatares de quienes participan (Slack muestra hasta 3 caras + «N
    respuestas»). Revisar y corregir lo mismo en la web.
    **Hecho:** la app pide los miembros (`/api/chats/:id/detail`, una vez por
    sesión) también en un 1:1, así la raíz del hilo, su chip y las
    reacciones nombran al otro como la lista (agenda → perfil → número) y
    muestran su foto; la membresía y las @menciones siguen siendo solo de
    grupos. En la web los nombres ya salían del detalle; faltaban las fotos
    en el chip y en la raíz del panel. Verificado: app en el emulador (raíz
    «QA Ana», chip con su inicial y la foto de José) y web E2E (chip con la
    foto de José en un 1:1).
19. **Emojis propios para reaccionar, como Slack** (estáticos o GIF
    animados). Cada uno: nombre corto (`:vamos:`), imagen de hasta 128×128 y
    256 KB (PNG, WebP o GIF), quién lo subió y cuándo. Salen en una sección
    propia del panel de reacciones y del de emojis, y se escriben con `:`.
    - **¿Por grupo o por workspace?** En Slack son del **workspace** (toda la
      empresa los comparte; los admins pueden limitar quién sube). Para
      Lilachat se propone: en **Lilachat Empresa**, por empresa (como Slack);
      en el Lilachat personal, **por grupo** (los suben los admins del
      grupo) más los que cada uno se guarde para sus chats 1:1. Una
      reacción con un emoji propio guarda su id y su URL, así se sigue
      viendo aunque después lo borren del catálogo.
    - Server: colección de emojis por dueño (grupo o empresa) con índice
      `{dueño, nombre}` único; los archivos van al almacenamiento como la
      media. App y web: el GIF se anima en el panel y en la reacción.
20. ~~**Contactos en la web, como WhatsApp Web**~~ **Hecho (§109, 0.1.147).** (José, 20/10: «¿por qué no
    los listas como WhatsApp o Telegram?»). Amplía el 5. WhatsApp Web no lee
    una agenda propia: muestra la del TELÉFONO, que la app sube a sus
    servidores. Lilachat hace lo mismo a medias: la app ya sincroniza la
    agenda con `/api/contacts`, pero la web no la pide. Falta: que la web
    baje esos contactos (nombre como lo guardaste) y los use en la lista,
    el chat, el detalle y «Nuevo chat» (la lista de contactos con Lilachat
    primero, como en WhatsApp Web), y que se actualice cuando el teléfono
    vuelva a sincronizar.
    **Corrección (20/10, leyendo el código):** la app NO sube la agenda.
    `POST /api/contacts/match` usa los números solo para la consulta y los
    descarta («No se guarda nada de lo que llega»), y `GET /api/contacts`
    devuelve con quién ya hay un 1:1 con el nombre que cada persona puso en
    Lilachat. Por eso la web muestra el número de quien no se puso nombre:
    no tiene de dónde sacar «Wilson». Para nombrar como el teléfono hay que
    decidir (José) una de dos: (a) que la app guarde en el server los nombres
    de agenda **solo de las personas con las que ya hay chat** (colección
    nueva por usuario, con su índice; el server sabría cómo tienes guardado a
    cada uno), o (b) que el teléfono se los pase a la web al vincularla y por
    el socket mientras ambos estén conectados, sin guardarlos en el server
    (la web no tendría nombres si el teléfono está apagado). WhatsApp Web
    hace lo segundo, sobre su protocolo de dispositivos vinculados.
    **Hecho con la (b) (20/10, §65.3):** relay por el socket, sin guardar
    nada en el server. Falta «Nuevo chat» con la agenda completa del
    teléfono (hoy la web nombra solo los números que ya muestra).
    **«Nuevo chat» con la agenda completa: hecho (§109, 0.1.147).**
    **Decisión de José (20/10): la (b).** Sin guardar la agenda en el server.
21. **Un canal como el expediente de una obra** (José, 20/10: «¿para qué
    sirven los canales, cuál es la diferencia con un grupo? ¿Puedo manejar una
    obra por etapas: checklist, cotización, órdenes de compra y servicio,
    ejecución, pagos, valorizaciones, informes, levantamiento de
    observaciones? ¿Y automatizaciones?»).
    - **Grupo vs canal:** un grupo es una conversación entre personas
      elegidas, en lo personal o en un espacio. Un canal es la conversación de
      un TEMA dentro de un espacio: público (cualquiera del espacio lo
      encuentra y entra) o privado, con descripción y fijados, y quien entra
      después ve todo el historial. La gente cambia; el canal queda.
    - **Canal de obra (E2+):** pestañas en el canal, como Slack (Canvas y
      Lists): «Chat · Checklist · Archivos · Pendientes». El checklist por
      etapas (cotización → orden de compra/servicio → ejecución →
      valorizaciones → pagos → informes → observaciones), con responsable,
      fecha y estado por ítem; los archivos agrupados por etapa.
    - **Lo financiero vive en el Portal**, no se duplica: la cotización, la
      orden, la valorización y el pago se ven en el canal como tarjetas con
      botones (E4: «Ver detalle», «Aprobar», «Confirmar recepción»), y lo que
      se toca vuelve al Portal.
    - **Automatizaciones (E4+, «Flujos»):** disparador (un evento del Portal,
      un botón, una fecha, una palabra) → acción (publicar en un canal, crear
      un ítem del checklist, avisar a alguien, pedir una aprobación). Ej.:
      aprobada la cotización → crear la orden y avisar en #compras; el 25 de
      cada mes → recordar la valorización; pago registrado en el Portal →
      tarjeta en el canal.
22. ✅ (§68, 0.1.115) **Un audio se corta cuando la pantalla se bloquea** (José, 20/10).
    Causa: `expo-audio` pausa todos los reproductores y grabadores cuando la
    actividad pasa a segundo plano (bloquear la pantalla cuenta), salvo que
    el modo de audio pida `shouldPlayInBackground` / `allowsBackgroundRecording`;
    la app no lo pedía. **Arreglado (§68).**
23. ~~**Recordatorio para devolver una llamada perdida**~~ **Hecho (§80, 0.1.121).** (José, 21/10).
    Desde la línea «Llamada perdida» (en el chat y en la pestaña de llamadas)
    y desde el aviso de la llamada perdida: «Recordarme devolverla» abre el
    mismo selector de recordatorio (en 15 min · 1 h · esta tarde · mañana ·
    elegir) y crea un recordatorio en ese chat con el texto «Devolver la
    llamada a X». Al sonar, la tarjeta trae «Llamar» directo. Reusa el
    modelo de recordatorios del chat (no uno nuevo).
24. ~~**La web no tiene el logo de la app**~~ **Hecho (§76, 21/10).** (José, 21/10): ni en la cabecera
    de la lista ni en la pantalla de vincular. Va el mismo logotipo de la APK.
25. ~~**La web no tiene modo oscuro**~~ **Hecho (§76, 21/10).** (José, 21/10): tokens claros y oscuros
    como la app, con el selector «Claro · Oscuro · Sistema» de Ajustes.
26. ~~**El fondo del chat en la web**~~ **Hecho (§76, 21/10).** (José, 21/10): el de la APK tiene puntos
    (`FondoDelChat`); la web va lisa. Mismo patrón, con tokens.
27. ~~**La lista de chats de la web se arrastra y se colapsa**~~ **Hecho (§76, 21/10).** (José, 21/10):
    el borde entre la lista y el chat se arrastra para dar más espacio al chat
    (ancho recordado por dispositivo) y la lista se puede esconder (colapsar)
    con un botón, como un panel de Slack.
28. ~~**Notificación del sistema en la web**~~ **Hecho (§76, 21/10).** (pregunta de José, 21/10): con la
    pestaña oculta no hay aviso de Chrome; hoy solo suena si hubo un clic
    previo en la página. Como WhatsApp Web: pedir permiso de notificaciones y
    avisar mensajes, zumbidos y guiños.
29. ✅ (§74, 0.1.117) **El clip sin título y sin «Divertido»** (José, 21/10, después de
    Messenger): el panel de acciones rápidas no lleva «¿Qué deseas enviar
    a…?» (ya se está en el chat) y la sección Divertido sale de ahí: el
    zumbido pasa al panel del botón de emoji, junto a Emoji · Stickers ·
    Guiños. Así la galería gana espacio. En la web, igual en el menú «+».
    **Hecho (§74, 21/10).**

30. ~~**Checklist, segunda vuelta**~~ **Hecho (§81, 0.1.122).** (José, 21/10: «agregar responsables y un ETA; el checklist se podría perder en los mensajes»):
    - por tarea, un responsable opcional (un miembro del chat) y «para cuándo»; vencida, «Atrasada» en rojo;
    - al crearlo, «Fijar en el chat» encendido por defecto: queda en la franja de fijados;
    - en Info del chat, una sección «Checklists» con el progreso de cada uno;
    - en Pendientes, «Mis tareas»: lo asignado a mí en todos los chats, primero lo vencido;
    - crear un checklist dentro de un hilo.
31. ~~**Stickers animados**~~ **Hecho (§81, 0.1.122).** (José, 21/10, para la siguiente ronda): stickers con movimiento (WebP animado o Lottie), en el panel y en el chat, sin pesar en la memoria del teléfono.

### Guiños y zumbido (análisis, 20/10)

**Qué era:** en MSN Messenger un *guiño* era una animación a pantalla
completa con sonido (el chanchito bailando, el globo de agua que se revienta,
el beso) y el *zumbido* sacudía la ventana del otro. Las animaciones
originales son de Microsoft: **no se pueden usar**. Hay que hacer las nuestras
(Claude Design o un ilustrador) con la misma idea.

**Cómo se haría en Lilachat:**
- **Mensaje nuevo, `guino` o `zumbido`**: solo el id del guiño (`{guino:
  'chanchito'}`). Viaja como cualquier mensaje: cola offline, acuses y
  reacciones; en el historial queda una línea «🐷 Wilson te mandó un guiño ·
  Ver otra vez». Sirve también en chats secretos (no lleva contenido).
- **Catálogo compartido** en `shared` (id, nombre, archivo, duración, sonido)
  con animaciones **Lottie** (JSON vectorial de 20–80 KB). Se bajan la primera
  vez que se usan y quedan en caché: no pesan en el APK ni en la web.
- **App:** si el chat está abierto, un overlay transparente a pantalla
  completa (sin capturar toques) reproduce la animación con
  `lottie-react-native` (MIT), su sonido y una vibración. El zumbido sacude la
  pantalla del chat (Reanimated, `translateX` de ±12 dp por 600 ms) con un
  patrón de vibración. Si el chat está cerrado: aviso «Wilson te mandó un
  zumbido» y la animación corre una sola vez al abrirlo.
- **Web:** el mismo overlay con `@lottiefiles/dotlottie-web` (MIT) sobre un
  canvas; el zumbido sacude el panel con un keyframe CSS y suena con Web
  Audio. Con `prefers-reduced-motion` no se anima: queda la línea del chat.
- **Dónde se elige:** una pestaña «Guiños» en el panel de emojis y «Zumbido»
  en el menú de adjuntar (app y web).
- **Límites:** un zumbido cada 10 s por persona y chat (el server lo
  rechaza); en grupos solo si el admin lo permite, para que no sea spam; un
  chat silenciado no anima ni suena; el sonido respeta el modo silencio.
- **Costo:** sin servicios pagos. El trabajo grande son las animaciones
  propias (6–8 para arrancar) y sus sonidos.
32. ~~**El aviso de versión nueva solo sale al abrir la app en frío**~~ **Hecho; el 426 en §106, 0.1.144.** (José, 21/10:
    «actualizo los chats pero no me aparece que hay una nueva versión; cuando
    cierro la app y vuelvo a ingresar sí aparece»). Causa: `useActualizacionesDeLaApp`
    consulta `min-version` UNA vez, en el `useEffect` del arranque; volver desde
    segundo plano no repregunta. Cómo debería ser:
    - **Hecho en la 0.1.123 (§83)**, en la app y en la web. **Pantalla de bloqueo hecha en la 0.1.136 (§97)**; falta que el server rechace con 426.
    - Repreguntar al volver a primer plano (`AppState` → `active`), con un tope
      de una consulta cada 30 min para no sumar requests en cada vistazo.
    - **Lo mismo en la web** (José, 21/10): una pestaña abierta días sigue con
      el bundle viejo; al volver a la pestaña se compara la versión publicada
      con la cargada y se ofrece recargar (y recarga sola si no hay nada
      escrito sin mandar).
    - Repreguntar al reconectar el socket, y que el server avise por socket
      `app.version` al publicar (la consulta deja de depender del azar).
    - **Actualización obligatoria** (para más adelante): el motor ya distingue
      `obligatoria` cuando la versión instalada es menor que `minima`. Falta la
      pantalla que BLOQUEA (sin chats, solo «Actualizar» y las novedades),
      que el server rechace con 426 a los clientes bajo la mínima (el bloqueo
      de la app sola se salta con una versión vieja), y que la web no quede
      afuera (recarga dura ante versión nueva, como Portal). La mínima la sube
      José al publicar; nunca automática.
33. **MCP / API de Lilachat para que otros sistemas escriban** — **análisis en §82 (21/10).** (José, 21/10):
    que Portal y las demás apps creen checklists y manden mensajes a un chat
    o grupo, como hoy Portal avisa por WhatsApp al medir líquidos, registrar
    consumos, firmar asistencia, iniciar producción o cuando un despacho entra
    o sale. Analizar: un bot por espacio con su llave (de Torre, no emitida por
    Portal), mensajes con tarjeta propia (no texto suelto), checklist por API,
    límites por llave, y un MCP encima de esa misma API. Va con el modo empresa
    (E4: bots, comandos y webhooks entrantes, backlog del §E).
34. ~~**El audio se siente torpe**~~ **Hecho en la 0.1.123 (§83)**; la barra de audio arriba al salir del chat, **hecha en la 0.1.137 (§98)**. (José, 21/10): recién arranca al segundo toque
    y no se puede adelantar ni retroceder. Como WhatsApp: un toque reproduce,
    la barra de la onda se arrastra para buscar (y se toca para saltar), la
    velocidad 1× · 1,5× · 2×, y el audio sigue sonando al salir del chat con
    una barra arriba. Revisar por qué el primer toque solo carga (precargar
    al aparecer en pantalla, sin bajar todos los audios del chat).
35. ~~**¿Avisar cuando alguien completa una tarea del checklist?**~~ **Hecho en la 0.1.123 (§83).** (José, 21/10).
    Propuesta: no a todo el chat (sería ruido en un grupo de obra). Sí a quien
    creó el checklist y a quien era responsable de esa tarea, si no es quien
    la marcó; varios ticks seguidos en un minuto van en un solo aviso
    («Beto marcó 3 tareas de Vaciado de losa»); respeta el silencio del chat;
    y un aviso aparte cuando el checklist queda completo. Más adelante: aviso
    al responsable cuando su tarea vence («Atrasada»).
36. ~~**Tarjetas en cola con acciones, como los chips de Claude**~~ **Hecho en la 0.1.136 (§97).** (José, 21/10):
    varias tarjetas apiladas encima de la barra de escribir (lo pendiente
    para mí en ese chat: una tarea vencida, una encuesta sin votar, un evento
    sin responder, un recordatorio que sonó), que se atienden de una en una
    con su acción (Marcar, Votar, Voy / No voy, Posponer) y se descartan.
    Analizar: de dónde salen (derivadas de lo pendiente, no un buzón nuevo),
    cuántas a la vez, y el mismo carril para los bots del ítem 33.
37. ~~**GIF y GIPHY, y stickers animados propios**~~ — **GIF y GIPHY hechos en la 0.1.138 (§99); el sticker animado propio en §107, 0.1.145** (José, 21/10: «debo poder
    subir un gif, es momento de agregar la sección de GIPHY, y crear yo mismo
    mis stickers animados»). Para la 0.1.123:
    - **Sticker animado propio**: subir un GIF o un video corto (≤ 6 s) y
      recortarlo a 512×512; el server lo convierte a WebP animado con
      `sharp` (`animated: true`; ojo: el 22/10 se vio que NO era dependencia
      del server) con el mismo tope de 500 KB del pack; queda en «Mis
      stickers» como cualquier otro.
    - **Desde un GIF del chat** (José, 22/10): al tocar un GIF de la
      conversación, sea de GIPHY o de la galería, la opción «Convertir en
      sticker animado» lo guarda en «Mis stickers». El server lo convierte
      desde el archivo que ya guardó para ese mensaje, nunca desde una URL
      que mande el cliente.
    - **GIF como mensaje** (no sticker): se manda tal cual, se reproduce en
      bucle corto y se detiene como los stickers (8 s, toque para repetir).
    - **Pestaña GIF con GIPHY**: búsqueda y tendencias por un proxy del server
      (la llave nunca va a la app ni a la web), con la atribución «Powered
      by GIPHY» que exige su licencia y su filtro de contenido en `pg-13`.
      Falta la **llave de GIPHY**: la saca José en developers.giphy.com y la
      carga en Torre; sin llave la pestaña no aparece.

38. ✅ (§85, 0.1.125; Llamadas en §106, 0.1.144) **Riel lateral como WhatsApp Web, y el botón de medios** (José, 21/10,
    con captura de WhatsApp Web; no necesita Stitch). WhatsApp Web tiene a la
    izquierda un riel de íconos que agrupa Chats, Llamadas, Estados, Canales y
    Comunidades, y abajo Medios, Ajustes y el perfil. Propuesta:
    - Extender el riel de espacios de la §84 para que sea EL riel de la web:
      arriba Chats, Llamadas (un historial armado con las líneas de llamada de cada chat), Pendientes y
      Encuestas (hoy dentro del menú «⋮»), y Destacados; debajo, los espacios
      y «+».
    - Abajo, **Medios**: fotos, videos, documentos y enlaces de todos los
      chats, con filtros por tipo y chat (falta en la web y en la app).
      Después, Ajustes y mi perfil.
    - El riel se muestra siempre en escritorio (ya no solo con espacios). En
      el celular, las mismas secciones van en la barra de abajo.

39. ~~**Web: los checks están muy separados y en modo oscuro no se distingue
    el azul**~~ **Hecho (§105, 0.1.143).** (José, 22/10, captura del chat con Wilson). El «✓✓» de leído y
    el de entregado se ven casi iguales en oscuro, y van lejos de la hora.
    Juntarlos a la hora como WhatsApp y darle al leído un color que contraste
    en los dos modos (token propio, no hex).
40. ~~**Panel de emojis: la lista muy separada y sin «Recientes» primero**~~ **Hecho (§105, 0.1.143).**
    (José, 22/10). WhatsApp abre en los usados últimamente. Recientes por
    equipo, arriba y como primera pestaña, y una grilla más compacta.
41. ~~**El botón de «bajar» no dice cuántos mensajes sin leer hay**~~ **Hecho (§105, 0.1.143).** (José,
    22/10). Al entrar a un chat con mensajes nuevos, el botón flotante lleva
    el número, como WhatsApp, y baja al primero sin leer.
42. ~~**Programar una llamada y generar un enlace de llamada, como WhatsApp**~~ **Hecho en chats de dos (§109, 0.1.147); en grupos espera al 56.**
    (José, 22/10). En el menú de llamada y videollamada del chat: «Programar
    llamada» (un evento con hora, aviso a los invitados y botón para unirse) y
    «Crear enlace de llamada» (un enlace que abre la llamada de ese chat o
    grupo; en la web también sin la app).
43. ~~**Enviar un GIF tarda unos segundos**~~ **Hecho (§105, 0.1.143).** (José, 22/10). El server baja el GIF
    de GIPHY y lo sube a lila antes de responder. El GIF tiene que aparecer
    al instante en el chat (con la vista previa de GIPHY, «enviando») mientras
    el server lo guarda.
44. ~~**Abrir un mensaje viejo con su contexto, como WhatsApp Web y Telegram**~~ **Hecho (§108, 0.1.146).**
    (José, 22/10: «Ese mensaje está más arriba: sube para cargarlo», al abrir
    un checklist, un recordatorio o una foto). Plan con archivo:línea en
    `scratchpad/plan-jump-to-message.md` (server `around=<seq>`, ventana
    separada de lo último, «Ir al último»): unos 5 días.
45. ~~**Listas de chats propias («Familia», «Amigos»), como las carpetas de~~ **Hecho (§109, 0.1.147).**
    Telegram y las listas de WhatsApp** (José, 22/10). Chips después de
    Todos · No leídos · Grupos · Borradores; un chat puede estar en varias;
    se sincronizan entre el teléfono y la web.

46. ~~**Cada actualización apaga «Llamadas a pantalla completa»**~~ **Hecho (§105, 0.1.143):** aviso una vez por versión. (José, 22/10,
    captura de Ajustes: «Android las tiene apagadas… Toca para
    permitirlas»). Es molesto volver a activarlo después de cada versión.
    Averiguar si es Android (el permiso `USE_FULL_SCREEN_INTENT` que se
    reinicia al reinstalar con el instalador del paquete) o la app. Si no se
    activa: con el teléfono bloqueado la llamada entra como notificación
    normal (suena, pero no se ve a pantalla completa). Pedirlo una sola vez y
    explicarlo bien.
    **Parte 2 (§108, 0.1.146):** José, 22/10: «¿no se puede evitar perder el
    permiso?». La app se actualiza con su propia sesión, que declara el
    permiso concedido. Si One UI lo apaga igual, el diagnóstico lo anota.
47. ~~**El enlace de invitación a un espacio debería abrir la app si ya está
    instalada**~~ **Hecho (§107, 0.1.145).** Como WhatsApp o YouTube (José, 22/10, captura: hoy la
    invitación por WhatsApp lleva a lilastore.constroad.com y a escribir el
    código a mano). Enlace propio (`lilachat.constroad.com/unirse/<código>`)
    con App Links de Android (`assetlinks.json` + `intent-filter` con
    `autoVerify`): con la app abre la pantalla de unirse con el código ya
    puesto; sin la app, la web (que también une) y el botón de descarga.
48. **La página de descarga de Lilachat con capturas** de lo que la app tiene:
    chats, stickers, guiños, llamadas, espacios, hilos, encuestas (José,
    22/10). Va en LilaStore (las capturas de la ficha de la app).
49. ~~**Cerrar la notificación de una nota de voz no la detiene**~~ **Hecho (§105, 0.1.143),** falta probarlo en el teléfono de José. (José, 22/10):
    se cierra la tarjeta de la notificación y el audio sigue. Cerrarla (o
    tocar pausa/X ahí) tiene que parar el audio, como cualquier reproductor.
50. **Chrome dice «Es posible que el archivo sea dañino» al bajar el APK** — **analizado en §106**: no se puede quitar desde el server; tarea para LilaStore y decisión de Google Play para José.
    (José, 22/10, captura bajando `lilachat-0.1.142-143.apk` desde
    lilastore.constroad.com: «obviamente así ni yo lo descargo»). Chrome lo
    muestra para todo APK que se baja de una web, sin importar la firma.
    Analizar cómo evitarlo: actualizar desde dentro de la app (Lilachat baja
    el APK y abre el instalador de Android, que no muestra esa alerta),
    actualizar por la app de LilaStore, y en la página de descarga explicar
    el aviso antes de que salga. Ver qué hace hoy el botón «Actualizar» de la
    app.
51. ~~**El correo no debería ser obligatorio si ya validó su número**~~ **Hecho (§106, 0.1.144).** (José,
    22/10: invitó a Lila a una cuenta individual; verificó su número y
    después la app le exigió verificar el correo). Con el número validado,
    el correo en «Completa tu perfil» es opcional. Se exige el correo
    verificado solo al activar respaldos y copias de seguridad.
52. ~~**Los stickers de emoji animados dejan de animarse al probar varios
    rápido**~~ **Hecho (§106, 0.1.144).** (José, 22/10). Medir el panel y la burbuja con varios seguidos:
    cuántas animaciones vivas hay, si se sueltan y si el hilo JS se traba.
    José pide **medir la performance en cada iteración**: lo del GIF y esto
    se escaparon por no medir.
53. ~~**Un GIF en la lista de chats dice «Foto»**~~ **Hecho (§107, 0.1.145).** (visto en el E2E del 22/10).
    La fila solo conoce `lastKind: 'image'`. Que el server mande el tipo del
    archivo del último mensaje (`lastMime`) y la lista diga «GIF», como
    WhatsApp.
54. ~~**El guiño se repite cada vez que entro al chat**~~ **Hecho (§108,
    0.1.146).** (José, 22/10, con 0.1.145: el globo y el oso de Lila). La fila
    de la lista no subía mi `readSeq` al leer.
55. **LilaStore también debe instalar con sesión** (de §108). Que declare
    `USE_FULL_SCREEN_INTENT` concedido al actualizar una app que lo pide.
    Es el repo de LilaStore; se derivó a su sesión.
56. **Llamadas grupales** (de §109: el 42 en grupos las necesita). Hoy una
    llamada es de dos (WebRTC punto a punto). Para un grupo hace falta malla
    para pocos (hasta 4) o un servidor de medios para más, la grilla de
    videos y quién entra y sale. Después: programar y enlace en grupos.
57. ~~**Ícono y miniaturas de las notificaciones**~~ **Hecho (§111, 0.1.149).** (José, 22/10, captura del
    Samsung). El ícono chico de la notificación sale celeste y no se parece al
    de Lilachat: falta un ícono monocromo con la silueta de la marca y su color
    de acento. Un sticker o un guiño llega como «Sticker», sin imagen: ni en la
    notificación (estilo con imagen grande) ni en la fila de la lista de chats
    (miniatura, como una foto).
58. ~~**@Lila en un grupo personal hizo responder al asistente**~~ **Hecho (§110, 0.1.148).** (José, 22/10,
    «Lokillos»). Lila es una PERSONA de ese grupo (la cabecera muestra «Lila»
    dos veces: ella y el asistente). Mencionarla hizo contestar al asistente, y
    su respuesta mostró «Falta ANTHROPIC_API_KEY en el servidor». Tres reglas:
    el asistente responde solo a `/lila`, nunca a una mención; solo en el modo
    empresa (espacios estilo Slack), no en chats ni grupos personales; y un
    error de configuración nunca llega al chat (va al diagnóstico; la persona
    ve «Lila no está disponible ahora»). Revisar además por qué el asistente
    figura como miembro de un grupo personal.
59. ~~**Panel de emojis como el de WhatsApp**~~ **Hecho (§111, 0.1.149).** (capturas). Pestañas solo con
    íconos (emoji, GIF, stickers, guiños), sin texto. La búsqueda de GIF abre a
    pantalla completa («← Buscar GIF» y las pestañas GIF / Stickers). Hoy, al
    tocar el campo de búsqueda, sale el teclado y se cierra todo el panel.
60. ~~**Guiño nuevo: un perrito llorando bajo la lluvia**~~ **Hecho (§111, 0.1.149),** del mismo estilo que
    los demás (tono adulto, `stitch-design` §5-bis), 6–7 s y varios pasos.
    Diseño pedido a Stitch. Con lo aprendido en §79: cada parte se
    pre-renderiza como WebP recortado a su caja (`render-wink-images.mts`); la
    app mueve imágenes y no dibuja SVG vivo en Android; el sonido se libera al
    terminar; y se miden los cuadros lentos antes de publicar.
61. ~~**Web: dos botones de recargar y ningún aviso de que actualiza.**~~ **Hecho (§111, 0.1.149).** Hay uno en
    la lista de chats y otro en la cabecera: queda uno solo. Mientras
    sincroniza no se ve nada; falta un indicador (barra fina o «Actualizando…»).
62. **Listas de chats como las secciones de Slack (acordeón)** (José, 22/10:
    quería agrupaciones como las secciones de canales de Slack, no chips).
    Propuesta: secciones plegables en la lista principal. Cada encabezado
    lleva el nombre y, plegado, los no leídos. Un chat va en una sola sección,
    «Sin sección» queda al final y las secciones se reordenan. Los chips quedan
    solo como filtros rápidos (No leídos, Grupos). Las listas del 45 pasan a ser
    secciones, con el mismo dato (`User.chatLists`). Espera el OK de José.
63. ~~**Recordatorio a pantalla completa con el teléfono bloqueado**~~ **Hecho (§112, 0.1.150),** como Google
    Calendar: al vencer, enciende la pantalla y lo muestra en grande (el mismo
    permiso de pantalla completa de las llamadas), con «Listo» y «Posponer».
64. ~~**Notificación que se despliega con varios mensajes**~~ **Ya funcionaba; verificado en §112 (falta probarlo en el Samsung de José).** Como WhatsApp: al
    deslizar hacia abajo se ven los últimos mensajes del chat (estilo de
    conversación de Android), no solo el último.
65. ~~**Eventos y recordatorios: vista previa del enlace y repeticiones.**~~ **Hecho (§112, 0.1.150).** En el
    formulario, un enlace (un video) muestra su vista previa. Repetir: los días
    de la semana elegidos (solo martes y jueves, solo lunes), el último día del
    mes (28 o 29 en febrero, 30 o 31 en el resto; es «el día anterior al 1 del
    mes siguiente») y cada N días, semanas o meses. Motor puro con tests de
    años bisiestos y meses de 30 y 31.
66. **Novedades al actualizar**, como el «What's new» de WhatsApp Web: una
    ventana con 3 o 4 novedades de la versión, una sola vez, en la web y en la
    app. *(Sale de la primera captura del 22/10; confirmar con José.)*
67. **Lo pendiente que vivía solo en el tablero de fases (§45) o en notas
    sueltas**, traído acá para que la lista esté completa (revisión del 22/10,
    a pedido de José):
    - F12.3: la media viaja en claro incluso en los chats secretos. Cifrarla en
      el cliente está bloqueado por la decisión D1.
    - El logo vectorizado (SVG) y las capas del ícono adaptativo (§2.3). El
      ícono de la notificación del 57 depende de esto.
    - Alta del disco de respaldos en la mini: producción contesta 507
      `disco_ausente` hasta que José lo monte (`docs/RESPALDOS-RUNBOOK.md`).
    - F13 (Mongo de emergencia): redefinir, porque la base ya vive en la mini
      (bóveda) desde el 17/10.
68. ~~**Avatares en los avisos, como WhatsApp**~~ **Hecho (§113, 0.1.151).** (José, 22/10, captura). El aviso
    lleva la foto del grupo (o del contacto) con el ícono de la app chiquito
    encima, y cada mensaje la foto de quien lo escribió, no la inicial.
69. ~~**El detalle del chat agrupado como WhatsApp**~~ **Hecho (§113, 0.1.151).** (captura de «Flujo caja»):
    foto grande, nombre y «Grupo · 5 miembros», la descripción, una fila de
    acciones (Llamar, Compartir, Buscar…) y debajo pestañas **Miembros ·
    Media · Ajustes**; en Miembros, «Agregar miembros» primero y cada uno con
    su etiqueta («Admin del grupo»).
70. ~~**El álbum más chico y con el gesto de responder**~~ **Hecho (§112, 0.1.150).** (José, 22/10). En
    WhatsApp el álbum ocupa 3/4 del ancho; el nuestro es más grande. Y se debe
    poder responder deslizando: hoy solo con el toque largo y la barra de
    arriba. Propuesta: deslizar a la derecha en la PRIMERA foto responde (no
    hay foto anterior); en las demás, cambia de foto.
71. ~~**Sin la casilla «Que mis chats vean mi cumpleaños» al completar el
    perfil**~~ **Hecho (§112, 0.1.150).** (José, 22/10): si alguien la desmarca, el aviso que activa el
    admin del grupo no le llega. Los cumpleaños los decide el chat.
72. ~~**Aviso a los admins un día antes del cumpleaños de un miembro**~~ **Hecho (§113, 0.1.151).** (José,
    22/10): el día anterior, a los admins del grupo (no a todos), para que
    preparen algo.
73. **Guiños de temporada** (José, 22/10; **Halloween hecho, §113; Navidad, §114**): según la época del año aparecen en
    la lista, mínimo 5 por temporada, diseñados en Stitch con el tono adulto
    de siempre. Temporadas: Halloween (octubre), Navidad (diciembre), Año
    Nuevo (fin de diciembre y enero), San Valentín (febrero), Fiestas Patrias
    (julio) y Día de la Madre (mayo). Fuera de su época no se ofrecen; los ya
    recibidos se siguen viendo. Empezar por Halloween (estamos en octubre).

> **Pausa por diseños (José, 21/10):** lo que necesita pantallas nuevas espera
> a que se reinicie la cuota de Stitch: la pantalla de bloqueo del 32, el
> reproductor del 34, las tarjetas en cola del 36 y GIF/GIPHY del 37 (y la
> revisión de k-04/k-05). Mientras tanto se avanza con lo que ya tiene diseño:
> el modo empresa estilo Slack (`s-01`…`s-04`), y lo que no necesita pantalla
> (repreguntar la versión en app y web, avisos de tareas del 35).

