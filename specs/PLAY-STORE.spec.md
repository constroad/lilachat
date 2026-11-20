# Google Play — preparación

Fecha: 19/11/2026. APK 0.1.189 (versionCode 190). **Aún no se publica.** José deja un solo APK
y conserva el actualizador de LilaStore (`REQUEST_INSTALL_PACKAGES`) por ahora.

Otros cambios agregan aquí las secciones «Borrar la cuenta» y «Denunciar y bloquear».

## 1. Checklist

| Punto | Estado | Evidencia |
| --- | --- | --- |
| Target API 36 | **Listo** | `app/node_modules/react-native/gradle/libs.versions.toml`: `targetSdk = "36"`, `compileSdk = "36"`, `minSdk = "24"`. `app/android/app/build.gradle` lee `rootProject.ext.targetSdkVersion`; ni `android/build.gradle`, ni `gradle.properties`, ni `expo-build-properties` lo pisan. Confirmar en la consola el mínimo vigente al publicar. |
| Política de privacidad | **Listo** | `https://lilachat.constroad.com/privacidad` (`web/src/legal/privacyPolicy.ts`). Pie en el ingreso web y APK. |
| Normas CSAE | **Listo** | `https://lilachat.constroad.com/seguridad-infantil` (`web/src/legal/childSafety.ts`). |
| Borrar la cuenta (en la app y por web) | **Listo en código**, falta E2E (§6) | `/borrar-cuenta`, Ajustes de APK y web, `shared/src/accountDeletion.ts`, `server/src/accountPurge.ts`. La política ya enlaza esa página. |
| Denunciar y bloquear | **Listo en código**, falta E2E (§5) | `shared/src/reports.ts`, `POST /api/reports`, cola en `/admin?vista=denuncias`. Bloquear reusa `blockedContacts.ts`. |
| Formulario «Seguridad de los datos» | Borrador listo (§2) | Falta cargarlo en la consola. |
| Permisos | **Con riesgos** (§3) | Riesgos altos: `REQUEST_INSTALL_PACKAGES`, `READ_MEDIA_IMAGES/VIDEO`, FGS `dataSync`, contactos sin aviso previo. |
| Textos de permisos (`app.json`) | **Corregido** | Contactos ya no dice «no se envían a ningún lado». Cámara, micrófono, ubicación y Face ID dicen todos sus usos. Mismo arreglo en `ContactPicker.tsx` e `InviteScreen.tsx`. |
| Ficha de la tienda | Pendiente (§4) | — |

### Datos del responsable (completados 19/11/2026)

José 19/11: «datos legales complétalos con los de Constroad». Salen de Portal
`src/common/consts.ts` (`CONSTROAD`), los mismos que imprimen sus documentos:
RJZ CONSTRUCTORES S.A.C., RUC 20612003905, Av. Mariano Melgar lote 9E dpto. 301,
Ate, Lima. Privacidad y seguridad infantil van a `administracion@constroad.com`.
Base en MongoDB Atlas; archivos en la mini de ConstRoad en Lima. IA de Lila:
Anthropic (Claude), lo único que Agentes tiene configurado hoy.

## 2. Borrador del formulario «Seguridad de los datos»

Respuestas generales:

- ¿Recoge o comparte datos? **Sí.**
- ¿Todo viaja cifrado en tránsito? **Sí** (HTTPS, WSS y WebRTC con DTLS-SRTP).
- ¿La persona puede pedir el borrado? **Sí**: en la app y en `https://lilachat.constroad.com/borrar-cuenta`.
- «Compartir» en Play excluye a los proveedores que procesan por cuenta nuestra. Portal y Agentes son de
  ConstRoad. FCM, Cloudflare TURN, OpenFreeMap, Nominatim, GIPHY y el proveedor de IA de Agentes son
  proveedores. Por eso se declara **no compartido** en todo. Si José prefiere lo conservador, marcar
  «compartido» en ubicación (Nominatim) y mensajes (IA de Lila).

| Categoría › tipo | Recogido | Compartido | Opcional | Propósito | Borrable | De dónde sale |
| --- | --- | --- | --- | --- | --- | --- |
| Ubicación › Precisa | Sí | No | Sí | Funciones de la app | Sí | Compartir ubicación (`locationShareRoutes.ts`), sello GPS, informes, visitas, mapa |
| Ubicación › Aproximada | Sí | No | Sí | Funciones de la app | Sí | El mismo permiso (`ACCESS_COARSE_LOCATION`) |
| Info. personal › Nombre | Sí | No | No | Funciones, gestión de la cuenta | Sí | `PUT /api/me/profile` |
| Info. personal › Correo | Sí | No | Sí (o el teléfono) | Gestión de la cuenta, funciones | Sí | Ingreso por correo, respaldo |
| Info. personal › Teléfono | Sí | No | Sí (o el correo) | Gestión de la cuenta, funciones | Sí | Ingreso por teléfono |
| Info. personal › IDs de usuario | Sí | No | No | Gestión de la cuenta | Sí | `userId` |
| Info. personal › Otra (cumpleaños) | Sí | No | No | Funciones (aviso de cumpleaños) | Sí | `birthday` |
| Info. financiera › Otra | Sí | No | Sí | Funciones (gastos de obra) | Sí | Gastos del servicio (`obra-gastos`). Decidir con José si cuenta. |
| Mensajes › Otros mensajes en la app | Sí | No | No | Funciones | Sí (mensajes propios: borrar para todos) | Chats, canales, bots |
| Fotos y videos › Fotos | Sí | No | Sí | Funciones | Sí | Chat, avatar, informes, visitas |
| Fotos y videos › Videos | Sí | No | Sí | Funciones | Sí | Chat |
| Audio › Grabaciones de voz | Sí | No | Sí | Funciones | Sí | Notas de voz. Las llamadas no se graban. |
| Archivos y documentos | Sí | No | Sí | Funciones | Sí | Archivos del chat, Drive del servicio |
| Calendario › Eventos | Sí | No | Sí | Funciones | Sí | Eventos de la agenda de Lilachat (no lee el calendario del teléfono) |
| Contactos | Sí | No | Sí | Funciones | Sí | `POST /api/contacts/match` manda los números y no los guarda (procesado efímero). `POST /invite` guarda el número invitado. |
| Actividad › Interacciones en la app | Sí | No | No | Funciones | Sí | «últ. vez», acuses de lectura, historial de llamadas |
| Actividad › Otro contenido generado | Sí | No | Sí | Funciones | Sí | Encuestas, checklists, reacciones, stickers, informes |
| Info. y rendimiento › Registros de fallos | Sí | No | No | Analíticas (estabilidad) | No ligado a la cuenta | `/api/crash` → log y aviso interno por Telegram |
| Info. y rendimiento › Diagnóstico | Sí | No | No | Analíticas (rendimiento) | No ligado a la cuenta | `app/src/diagnostico/diagnostico.ts` → LilaStore, con `installId` al azar |
| IDs del dispositivo u otros | Sí | No | No | Funciones (avisos, sesiones) | Sí | `deviceId`, token FCM, `installId` |

No se recoge: salud, navegación web, SMS, registro de llamadas del teléfono, apps instaladas,
búsquedas guardadas, raza, religión, orientación ni datos de pago. No hay publicidad.

## 3. Permisos

Fuente: `app/android/app/src/main/AndroidManifest.xml` (generado por `expo prebuild`, `android/` está en
`.gitignore`), `app.json` y los manifiestos de `app/modules/*`. **Antes de subir, sacar la lista real del
APK firmado con `aapt2 dump permissions`**: los manifiestos de las librerías se suman al compilar.

### Riesgo alto en Play

| Permiso | Quién lo agrega | Uso real | Propuesta |
| --- | --- | --- | --- |
| `REQUEST_INSTALL_PACKAGES` | `app.json` + `plugins/withConsultaDeLilaStore.js` | Actualizador de LilaStore | **Decisión de José: queda por ahora.** Play prohíbe que una app de la tienda se actualice por fuera. Se resuelve al publicar (sabor Play sin el actualizador). |
| `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO` | `expo-media-library` (plugin legado que `prebuild` aplica solo) | Galería propia del clip (`AttachSheet.tsx`) y tira de recientes de la cámara (`Camera.tsx`) | La política de fotos y videos solo acepta acceso amplio si es la función central. Un chat no lo es: Play pide el selector del sistema. Propuesta: el selector (`expo-image-picker`, ya instalado) en el sabor Play, y quitar los dos permisos. Se pierde la cuadrícula tipo WhatsApp. |
| `READ_MEDIA_AUDIO` | `expo-media-library` (`granularPermissions` por defecto) | Ninguno | Quitar: `["expo-media-library", { "granularPermissions": ["photo", "video"] }]` en `app.json`. |
| `FOREGROUND_SERVICE_DATA_SYNC` | `app.json` + `modules/servicio-socket` | Sostener el socket con la app atrás (26/08, antes de FCM) | `dataSync` es para subir o bajar datos, no para una conexión abierta. Android 15 lo corta a las 6 h. Hoy hay FCM: medir si hace falta; si no, retirarlo. Si queda, declararlo con video y el riesgo de rechazo es alto. |
| `READ_CONTACTS` | `expo-contacts` | Emparejar la agenda (`/match` sube los números) | Play pide un aviso propio ANTES del diálogo del sistema cuando la agenda sale del teléfono. Hoy se pide al entrar (`agendaEnMemoria.ts`, `precargarAgenda`) sin ese aviso. Falta la pantalla de aviso. |

### A quitar (no se usan)

Quitar con un plugin propio que escriba `<uses-permission android:name="…" tools:node="remove"/>`
en el manifiesto. **No se quitaron en este cambio.**

| Permiso | Quién lo agrega | Por qué sobra |
| --- | --- | --- |
| `SYSTEM_ALERT_WINDOW` | `@config-plugins/react-native-webrtc` (`withWebRTC.js`); también `react-native/ReactAndroid/src/debug` (solo debug) | Ningún `canDrawOverlays` en el código. El PiP de la llamada usa `supportsPictureInPicture` y la llamada entrante usa `USE_FULL_SCREEN_INTENT`. |
| `WRITE_CONTACTS` | `expo-contacts` (`withContacts.js`) | Solo se usa `Contacts.presentFormAsync` (`ContactCard.tsx`), que abre el formulario del sistema. Probar en el teléfono que sigue abriendo sin el permiso. |
| `BLUETOOTH` | `@config-plugins/react-native-webrtc` | Permiso viejo, sin efecto desde Android 12. No es riesgo; limpia la ficha. |
| `USE_FINGERPRINT` | `expo-local-authentication` | Viejo; `USE_BIOMETRIC` lo reemplaza. No es riesgo. |

### Servicios en primer plano (cada tipo se declara en la consola, con video)

| Tipo | Servicio | Uso | Declaración |
| --- | --- | --- | --- |
| `dataSync` | `servicio-socket` | Socket con la app atrás | Ver riesgo alto. |
| `location` | `expo-location` (`isAndroidForegroundServiceEnabled`), tarea `lilachat-live-location` | Ubicación en tiempo real con la app atrás, con aviso visible | Video: compartir en tiempo real, salir de la app, aviso «Compartiendo tu ubicación en tiempo real». |
| `mediaPlayback` | `expo-audio` (`AudioControlsService`), `expo-video` (`ExpoVideoPlaybackService`) | Audio y video siguen con la pantalla apagada | Video: nota de voz o video sonando con la app atrás. |
| `microphone` | `expo-audio` (`AudioRecordingService`, `enableBackgroundRecording`), `llamada-entrante` (`ServicioDeLlamada`) | Llamada en curso; nota de voz que sigue grabando atrás | Video de una llamada. Si la nota de voz atrás no es necesaria, apagar `enableBackgroundRecording`. |
| `camera` | `llamada-entrante` (`ServicioDeLlamada`, `microphone\|camera`) | Videollamada en la ventana chica | Video de una videollamada en PiP. |
| `mediaProjection` | `react-native-webrtc` (`MediaProjectionService`) | Compartir pantalla en una llamada (`calls/useScreenShare.ts`) | Video: compartir pantalla. |

### Riesgo medio o normal

| Permiso | Uso | Nota |
| --- | --- | --- |
| `USE_FULL_SCREEN_INTENT` | Llamada entrante a pantalla completa (`modules/llamada-entrante`) | Play lo limita a apps de llamadas y alarmas: declarar «llamadas». |
| `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION` | Compartir ubicación, sello, informes, visitas, mapa | Solo en uso; no hay `ACCESS_BACKGROUND_LOCATION` (`isAndroidBackgroundLocationEnabled: false`). |
| `CAMERA` | Fotos y videos del chat, informes, visitas, videollamadas, QR | Texto de `app.json` corregido. |
| `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS` | Notas de voz, video con sonido, llamadas | `expo-camera` con `recordAudioAndroid: false`; lo agregan `expo-audio` y WebRTC. |
| `POST_NOTIFICATIONS` | Mensajes y llamadas | — |
| `USE_BIOMETRIC` | Bloqueo de la app con huella, vincular computadora | — |
| `READ_MEDIA_VISUAL_USER_SELECTED` | Acceso parcial a fotos (Android 14) | Sobra si se pasa al selector del sistema. |
| `READ/WRITE_EXTERNAL_STORAGE` (`maxSdkVersion` 32) | Galería en Android 12 o menos | — |
| `INTERNET`, `ACCESS_NETWORK_STATE`, `WAKE_LOCK`, `VIBRATE`, `FOREGROUND_SERVICE` | Normales | — |

## 4. Lo que falta de la ficha

- **Cuenta de desarrollador** de organización (pide D-U-N-S de ConstRoad) y verificación de identidad.
- **Firma:** subir a Play App Signing la MISMA clave de `plugins/withReleaseSigning.js`. Con otra clave,
  quien tiene el APK de LilaStore no puede actualizar (`INSTALL_FAILED_UPDATE_INCOMPATIBLE`).
- **OTA:** Play acepta código JS bajado si corre en su intérprete y no cambia el propósito de la app.
  Revisar que ninguna OTA agregue permisos ni funciones nuevas sin pasar por la tienda.
- **Clasificación de contenido** (IARC): la persona interactúa con otras, comparte ubicación y contenido.
  Sin compras ni apuestas.
- **Público objetivo: 18+.** No apta para niños; sin el programa de familias.
- **Acceso para la revisión:** el ingreso es con código por WhatsApp o correo y el revisor no lo recibe.
  Hace falta una cuenta de revisión en el espacio Test (`qa-lilachat`) con un camino que José decida
  (por ejemplo un código fijo solo para ese número, con límite de intentos). Es una puerta: la decide José.
- **Declaraciones:** CSAE (enlace a `/seguridad-infantil` y punto de contacto), servicios en primer plano
  (§3), pantalla completa, borrado de cuenta (`/borrar-cuenta`), sin anuncios, sin funciones de salud ni
  de dinero, app no de noticias ni del gobierno.
- **Ficha:** nombre, descripción corta y larga, ícono 512 × 512, gráfico de 1024 × 500, capturas de
  teléfono y de tablet (la app gira y tiene versión tablet), categoría (Comunicación o Empresa), correo
  público de contacto, URL de privacidad.

## 5. Denunciar y bloquear

Requisito de Play para apps con contenido entre personas: denunciar personas y contenido, y bloquear,
dentro de la app. Decisión de José (19/11): la denuncia llega al superadmin (cola en `/admin`) y, como
aviso, a los admins del espacio donde pasó. El mensaje denunciado se guarda como evidencia aunque luego
se borre.

| Punto | Dónde |
| --- | --- |
| Denunciar un mensaje ajeno | APK: barra de selección (`SeleccionDeMensaje.tsx`, en «⋮»). Web: menú del mensaje (`MenuDelMensaje.tsx`). |
| Denunciar y bloquear a una persona | Tarjeta de la persona en APK y web (`usePersonSafety.tsx`), desde un 1:1 y desde un miembro de grupo o canal. En el 1:1 sigue también la fila de su info. |
| Motivos | Spam, Acoso o intimidación, Contenido sexual, Abuso infantil, Violencia o amenazas, Suplantación de identidad, Otro (con texto). `shared/src/reports.ts`. |
| Prioridad | Abuso infantil = alta: primero en la cola y aviso «Denuncia urgente». |
| Bloquear en el mismo paso | Casilla «Bloquear también a …» (`alsoBlock`): el server llama a `blockUser`. |
| Confirmación | «Recibimos tu denuncia». |
| Evidencia | Copia del texto, ids de adjuntos, autor, chat y fecha en la denuncia (`reportModel.ts`). Un chat secreto no deja texto. |
| Anti-abuso | Misma denuncia abierta no se repite; máximo 10 por persona en 24 h (429). |
| Aviso | Push al superadmin y a dueños y admins del espacio; nunca al denunciado. Sin espacio, solo el superadmin. El texto no repite el contenido. |
| Cola del superadmin | `/admin?vista=denuncias` (web): abiertas y cerradas, resolver o descartar con nota. `GET /api/admin/reports`, `POST /api/admin/reports/:id/close`. |

Pendiente: E2E en APK y web; la declaración CSAE puede citar esta cola como el mecanismo de denuncia.
Los admins del espacio no tienen cola propia (solo el aviso); el APK no abre la cola.

## 6. Borrar la cuenta

Requisito de Play: borrar la cuenta desde la app y desde una web sin tener la app. Decisiones de José
(19/11): los mensajes en grupos, canales y canales de cliente quedan, firmados «Cuenta eliminada»; lo
demás se borra; 30 días de gracia.

| Punto | Dónde |
| --- | --- |
| En la app | APK: Ajustes › Cuenta › «Borrar mi cuenta» (`DeleteAccountSetting.tsx`). Web: última fila del panel de Ajustes (`DeleteAccountChoice.tsx`). |
| Por web, sin la app | `https://lilachat.constroad.com/borrar-cuenta` (`web/src/account/DeleteAccountPage.tsx`): explica, pide el código por correo, teléfono o el QR del teléfono, y confirma. Es la URL que se carga en la consola. |
| Confirmación | Escribir BORRAR (como «Eliminar espacio» pide el nombre). La sesión ya prueba quién es. |
| Qué pasa al pedirlo | La cuenta se cierra al instante: sesiones, dispositivos y tokens de push fuera, sockets cortados, todo pedido con su JWT da 401. |
| Plazo | 30 días (`ACCOUNT_DELETION_GRACE_DAYS`). Entrar con el código antes lo cancela y se le dice («Se canceló el borrado»). |
| Qué se borra | Nombre, teléfono, correo, cumpleaños, foto, sesiones, dispositivos, tokens, bloqueados, respuesta automática, chats 1:1 y notas (para los dos), stickers, destacados, recordatorios, respaldos, mensajes programados, invitaciones. |
| Qué queda | Sus mensajes en grupos y canales, con autor «Cuenta eliminada» (el registro queda anonimizado: `phone: deleted:<id>`). |
| Espacios | Dueño de un espacio con otros miembros, o su único admin: se rechaza con «Pasa el espacio a otra persona o elimínalo antes de borrar tu cuenta». Solo en su espacio: se elimina con la cuenta. |
| Purga | Cron diario dentro del server (`accountPurge.ts`), 5 cuentas por pasada, idempotente. |
| Endpoints | `GET`, `POST` (`confirm: 'BORRAR'`) y `DELETE /api/me/account-deletion`. |

Pendiente: E2E en APK y web (pedir, ver 401, volver a entrar y ver la cancelación). Archivos que
quedan en disco tras la purga: la foto de perfil y los archivos de respaldo (sus filas sí se borran).
**No existe transferir el dueño de un espacio**: hoy la salida es «Eliminar espacio». Si Play lo pide,
el formulario «Seguridad de los datos» ya responde «Sí» al borrado (§2).
