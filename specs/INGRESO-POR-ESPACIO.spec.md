# Ingreso por espacio de trabajo (04/11/2026)

> Pedido de José por Agentes: al instalar la app pide el teléfono, y debería
> pedir entrar a un espacio de trabajo y crear el usuario desde ahí. Decisión
> del mismo día: seguir el patrón de Slack, dejar teléfono y código como opción,
> y mantener un enlace discreto para usar la app sin espacio.
>
> **Estado:** I1 a I5 hechas y probadas de punta a punta el 04/11. Publicada en la
> 0.1.180 (181) el mismo día: web y server en vivo, APK en LilaStore `stable`.

## 1. Cómo lo hace Slack

Se entra con correo y código. Después aparecen los espacios, y una invitación se
acepta con «Join» junto al nombre del espacio. Quien entra por primera vez escribe
su nombre completo. Crear un espacio es una opción después de confirmar el correo.

Fuentes: [Sign in to Slack](https://slack.com/help/articles/212681477-Sign-in-to-Slack),
[Join a Slack workspace](https://slack.com/help/articles/212675257-Join-a-Slack-workspace),
[Create a Slack workspace](https://slack.com/help/articles/206845317-Create-a-Slack-workspace).
La ayuda de Slack no detalla la lista de invitaciones en el teléfono: esa parte
sale de su versión de escritorio.

## 2. El flujo en Lilachat

1. **Entra a tu espacio de trabajo** (`i-01`): correo y «Continuar». Debajo,
   «Entrar con mi número de teléfono» y, al pie, «Usar sin espacio de trabajo».
2. **Código** (`i-02`): 6 dígitos, reenvío y «Cambiar de correo». Con teléfono es
   la pantalla de hoy.
3. **Tus espacios de trabajo** (`i-03`): los espacios de la persona con «Abrir»,
   las invitaciones con «Unirme», «Unirme con un código» y «Crear un espacio».
4. **Crea tu usuario** (`i-04`): solo la primera vez. Nombre completo y foto
   opcional, sin contraseña.

«Usar sin espacio de trabajo» lleva al ingreso por teléfono de hoy y a los chats
personales. Quien ya tiene sesión no ve nada de esto.

| Pantalla | Diseño Stitch | Estado |
| --- | --- | --- |
| Entra a tu espacio | `screens/751093dabbfa4affba9ef41a27a5dfe1` | Nueva |
| Código por correo | `screens/2a6227a5eaa94603a3cfe8af1a6b4916` | Nueva |
| Tus espacios | `screens/562f0b08fcfe4edb887ca7bdf4603f0d` | Nueva |
| Crea tu usuario | `screens/ac8b685553074d4bae1be561bf507116` | Nueva |
| Unirse con código | `e-02` | Ya existe |
| Solicitud enviada | `e-03` | Ya existe |
| Crear un espacio | `e-04` | Ya existe |

## 3. Lo que hay hoy

- `constroad-auth` acepta correo o teléfono en `destino`: no hay que cambiarlo.
- El registro está abierto (`REGISTRO_ABIERTO` en `authRoutes.ts`).
- `/otp/request` y `/otp/verify` solo reciben `phone`. El correo es un respaldo de
  una cuenta que ya tiene teléfono.
- Las invitaciones por teléfono se reclaman al entrar (`claimPhoneInvites`), y
  existen las de correo (`workspaceEmailInvites.ts`).

## 4. El riesgo: el teléfono es la identidad

`users.phone` es obligatorio y único. La palabra aparece en 69 archivos del server
(272 líneas) y en 281 de los clientes (624 líneas). Volverlo opcional toca chats
1:1, agenda, avisos, invitaciones y el panel de admin, con usuarios reales encima.

**Propuesta:** no volverlo opcional. Una cuenta creada por correo guarda en `phone`
una clave interna, como ya hacen los bots («its `phone` is an internal key»). Una
función de `shared` dice si es un teléfono real, y la interfaz no lo muestra ni lo
cruza con la agenda. Esas cuentas tienen el correo verificado por el código.

### Lo que quedó decidido al construirlo

- **Rutas aparte para el correo.** Las de teléfono no cambian: una app vieja sigue
  entrando igual. Las dos terminan en la misma función, `openSession`.
- **La clave interna** es `mail:<uuid>` (`internalPhoneKey`). `isRealPhone` dice si
  un `phone` es de verdad, y `formatPhoneDisplay` devuelve vacío para una clave.
- **El correo es único entre cuentas.** Quien prueba el código se queda con él,
  y la cuenta que lo tenía sin verificar lo suelta, como en `profileRoutes.ts`.
- **La invitación por correo espera a «Unirme»**, como el Join de Slack. Entrar por
  correo no une a nadie. Verificar el correo en el perfil sigue uniendo solo.
- **El cumpleaños no se le pide a una cuenta de correo.** `i-04` pide solo el nombre,
  así que `missing` no incluye `birthday` si el `phone` es una clave interna.
- **El nombre se pide antes de aceptar.** `welcomeToGeneral` no avisa sin nombre, así
  que «Unirme» pasa primero por `i-04` y recién acepta. Lo mismo con «Abrir» y «Crear
  un espacio». Quien se une con un código pasa por `i-04` al entrar, sin el aviso.
- **`i-03` solo aparece después del código.** Quien abre la app con sesión va directo
  a sus chats, y una cuenta sin nombre que cierra la app ve `i-04` al volver.
- **Una clave nunca se normaliza a un número**, aunque sus dígitos formen uno: lo
  corta `normalizePeruPhone`, así que tampoco llega a los bots ni al directorio.
- **Sin teléfono no hay fila de teléfono** en la ficha del miembro.
- **En la web el escritorio sigue abriendo por el QR**, como WhatsApp Web. Su enlace
  ahora lleva al correo, y un enlace de invitación o de llamada salta `i-03`.
- **Si el registro se cierra**, `/email/verify` también tiene que cerrarse: hoy crea
  la cuenta sin mirar `REGISTRO_ABIERTO`.

## 5. Fases

| Fase | Qué | Sale por |
| --- | --- | --- |
| I1 | Server: `/api/auth/email/request` y `/api/auth/email/verify`; entra la cuenta que verificó ese correo | Server. **Hecho** |
| I2 | Server: cuenta nueva por correo con clave interna; `GET /api/workspaces/invitations` y `POST /api/workspaces/invitations/:id/accept` | Server. **Hecho** |
| I3 | App: las cuatro pantallas y el orden nuevo (`SignInFlow`) | APK. Sin OTA: la versión entra al runtime, y quien ya tiene sesión no ve estas pantallas |
| I4 | Web: las mismas pantallas (`EmailSignIn`, `YourSpacesPage`, `CreateUserPage`) | Server |
| I5 | Revisión de la clave interna en perfil, directorio, agenda, avisos y admin | Server y APK |

## 6. Cómo se prueba

- OTP de QA solo con el 902049935, y los códigos por correo no llegan al emulador.
- Una cuenta de prueba no se crea en producción, y el `.env` del repo apunta a
  producción. El E2E del alta corre con server local y base propia en
  `10.0.2.2`, con `constroad-auth` falso, como en los tests del server.
- La ruta real por correo necesita una cuenta que José elija o una prueba suya en
  su teléfono.

### Resultado del E2E (04/11)

Server local con base propia y `constroad-auth` falso, nada en producción.

| Dónde | Recorrido | Resultado |
| --- | --- | --- |
| Web, 375 px | Cuenta nueva: correo, código, invitación, nombre y adentro del espacio | Pasó |
| Web, 375 px | Recarga: la sesión sigue y no vuelve a pedir nada | Pasó |
| Web, 375 px | QR, correo, código y «Abrir» con la cuenta que ya existe | Pasó |
| Emulador | Cuenta nueva: `i-01`, `i-02`, `i-03`, `i-04` y adentro de CONSTROAD | Pasó |

El E2E web encontró cuatro cosas, ya arregladas: el reenvío decía «0:60», las casillas
salían muy redondas, las iniciales salían de la clave interna hasta recargar, y a una
cuenta recién creada le salía «Novedades».

**Cómo se prueba en Android sin tocar la sesión de QA:** un build de debug con
`applicationIdSuffix ".e2e"` y `package_name` igual en `google-services.json`, instalado
junto a la app real. Metro en el 8082 con `EXPO_PUBLIC_API_URL=http://10.0.2.2:4003`.
Los dos archivos de `android/` se restauran después, y el build deja ~1 GB en
`node_modules/*/android/build`.

**Correo real (04/11):** con `jose.test@yopmail.com` el código llegó en unos 18 s, y un
código equivocado da 401 en la ruta real. El botón del correo apuntaba a
`chat.constroad.com/login/callback`, que muestra la web de Constroad. Ahora va a
`lilachat.constroad.com/login/callback`, que muestra el código y un «Entrar aquí»: el código
se gasta con ese toque y no al abrir, porque los antivirus del correo abren los enlaces, y quien
lo pidió en la app lo escribe allá (la app no abre ese enlace). Hasta que ese host esté en los
`enlaces` de la llave en Torre, el correo sale sin botón y solo con el código. Falta escribir
el código real: crea una cuenta en producción y lo hace José.

**Sin probar:** la foto opcional de `i-04`, y «Unirme con un código» y «Crear un espacio»
desde `i-03` en el emulador.

**Pendiente de decidir:** al entrar, la app pide el permiso de contactos también a una
cuenta de correo, que no cruza nada con la agenda.

## 7. Decisiones de José (04/11)

1. Las cuatro pantallas: aprobadas.
2. La clave interna de §4: aprobada, sin agregar complejidad innecesaria.

## 8. La invitación por correo, de punta a punta (José 12/11, Globofast)

Revisión antes de invitar a la gente de Globofast:

- **Nadie recibe un correo automático.** «Invitar por correo» guarda la invitación y abre
  el correo del admin con el mensaje listo (`spaceInviteMailto`); el admin lo envía.
  constroad-auth tiene `POST /v1/invitaciones` para mandarlo solo, pero su texto va en voseo
  («Entrá», «ignorá») y el enlace tiene que estar en los `enlaces` de la llave: queda
  propuesto, sin usar.
- **El mensaje decía lo de antes** (entrar con el número y verificar el correo en el
  perfil). Ahora dice lo que hace la app: abrir Lilachat según el equipo, entrar con ESE
  correo, tocar «Unirme» y poner el nombre la primera vez.
- **Por equipo:** Android descarga el APK de LilaStore; iPhone abre la web en Safari y toca
  Compartir › «Agregar a inicio» (no hay app de iPhone); la computadora usa la web. El
  mensaje por WhatsApp (`spaceInviteMessage`) distingue Android e iPhone igual.
- **El enlace del correo** es `https://lilachat.constroad.com/?d=<correo>`: la web abre
  «Entrar con mi correo» con el correo escrito, también en pantalla ancha (sin el QR), y
  saca `d` de la dirección (`emailHintOf`).
- **El recorrido:** correo → código → «Tus espacios» con «Unirme» → nombre → adentro. El
  E2E del 04/11 lo pasó contra un server local; el correo real lo prueba José, porque crea
  una cuenta en producción.
