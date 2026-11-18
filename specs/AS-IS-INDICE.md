# AS-IS de Lilachat — índice

Fecha de corte: 17/11/2026. APK 0.1.189, OTA `29649a8`, web y server `42cdea7`.
Salió de revisar ~1375 commits de las últimas 5 semanas y el código. Cada módulo tiene su archivo en
`specs/as-is/`, con lo que hace hoy en **APK**, **Web/PWA**, **Server** y **Shared**, sus diferencias,
la historia reciente, sus diseños de Stitch, lo pendiente y sus pruebas.

## Qué es Lilachat

Chat de trabajo de ConstRoad: espacios por empresa, canales, chats directos y canales de cliente.
Sobre el chat viven las apps de agentes (Lila, Dali), los informes de campo, el mapa de obra, la visita
técnica, el IAA con AR, el Drive de cada servicio, los gastos y las llamadas.

| Parte | Carpeta | Qué es |
| --- | --- | --- |
| APK | `app/` | React Native / Expo. Android. OTA propia. Gira y tiene versión tablet. |
| Web/PWA | `web/` | Vite + React. Escritorio con riel; en el celular, como el APK. |
| Server | `server/` | Express + Mongoose + Socket.IO. Corre en la mini. Disco de medios propio. |
| Shared | `shared/` | TypeScript puro: contratos, motores y reglas que usan los otros tres. |

## Módulos

### Chat
- [Mensajes y compositor](as-is/chat-mensajes.md): menciones, `:hug`, responder, editar, borrar, reenviar, fijados, destacados, búsqueda, enlaces.
- [Hilos](as-is/chat-hilos.md): chip, pantalla o panel del hilo, lectura por hilo, banda «respondió en un hilo».
- [Medios y archivos](as-is/chat-medios-y-archivos.md): cámara con sello, fotos, video, voz, archivos, PDF con su primera página y zoom.
- [Agenda, encuestas y checklists](as-is/chat-agenda-encuestas-checklists.md): eventos, recordatorios, Mis tareas.
- [Stickers, emojis y guiños](as-is/chat-stickers-emojis-guinos.md): Lottie, GIF, zumbido, emojis propios.

### Plataforma
- [Ingreso y sesiones](as-is/plataforma-ingreso-y-sesiones.md): código por teléfono o correo, ingreso por espacio, QR, dispositivos.
- [Espacios y canales](as-is/plataforma-espacios-y-canales.md): roles, invitaciones, #general, canales compartidos, borrar espacio.
- [Administración](as-is/plataforma-admin.md): superadmin, operadores, `/admin`, incógnito.
- [Perfil, contactos y privacidad](as-is/plataforma-perfil-contactos-privacidad.md).
- [Avisos y push](as-is/plataforma-avisos-push.md): FCM, Web Push, aviso nativo, sonidos.
- [Versiones, OTA y respaldo](as-is/plataforma-versiones-ota-respaldo.md).
- [Ajustes, tema y disposición](as-is/plataforma-ajustes-tema-disposicion.md): riel, celular, tablet, PWA.
- [Fluidez y planes](as-is/plataforma-fluidez-y-planes.md): Diagnóstico, fases F0–F6, iPhone, PWA.
- [Deploy](as-is/plataforma-deploy.md): mini, Torre, APK en LilaStore, OTA.

### Apps y bots (agentes)
- [API de bots y tarjetas](as-is/bots-api-y-tarjetas.md): manifiesto, instalación, mensajes, tarjetas, archivos, eventos.
- [Comandos, formularios y horarios](as-is/bots-comandos-formularios-y-horarios.md): «/», ⚡, formularios, todo apagado.
- [Dali: prospectos](as-is/bots-dali-prospectos.md): fases 1, 2, 2b y 3.
- [Asistente, rutinas y pendientes](as-is/bots-asistente-rutinas-pendientes.md): `/lila`, rutinas, cola, Pendientes.
- [Integración con agentes y Portal](as-is/bots-integracion-agentes-portal.md): qué expone Lilachat y qué consume.

### Obra y canal de cliente
- [Informes de campo](as-is/obra-informes.md): CTL-PIS, CTL-IMP, FRE-PAV, RCP-CAM, hojas de bloques, editor 2.0.
- [Mapa de obra](as-is/obra-mapa.md).
- [Visita técnica e IAA](as-is/obra-visita-e-iaa.md): lv01–lv03, medición con AR y wincha, croquis.
- [Tanques, materiales y cubicaje](as-is/obra-tanques-materiales-cubicaje.md).
- [Gastos](as-is/obra-gastos.md).
- [Drive del servicio](as-is/obra-drive.md).
- [Canal de cliente y tutoriales](as-is/obra-canal-cliente-y-tutoriales.md).
- [Integración con Portal](as-is/integracion-portal.md): cómo se crean y abren los informes, llamadas a Portal, visitas y avisos.

### Llamadas
- [Llamadas](as-is/llamadas.md): 1:1, grupo, video, enlaces, historial.

### Estado general
- [Pendientes y diseños de Stitch](as-is/pendientes-y-stitch.md): cada diseño y cada tarea abierta, con evidencia.

## Resumen del estado (17/11)

- **Diseños de Stitch:** la mayoría están hechos. Faltan `legado` (F14), planta `pla-04…09`, FRE-PAV y RCP-CAM
  (`fp-*`, `rc-*`), IAA `la-08`/`la-09`/`la-10` y visita `lv04`. Hay parciales en Dali (`dl-04/05/06/07/09/10`),
  `r155-*`, `o-09`, `sc-04`/`sc-05`, `gst-01` y `pla-01…03`. Detalle en
  [pendientes-y-stitch](as-is/pendientes-y-stitch.md).
- **`design/stitch/INVENTARIO.md` tiene estados viejos**: marca sin hacer `dl-*`, `f-04…08`, `la-01…07` y
  «Corregir datos» de `gst-02`, que ya están hechos. Manda este índice.
- **Lo que más falta probar:** casi todo lo de campo está probado en el emulador o en Test, no en el teléfono
  de José (AR con wincha real, videollamada, llamadas de grupo, CTL-PIS).

## Otros specs

Los specs largos siguen como historia y detalle: [ARCHITECTURE](ARCHITECTURE.spec.md) (bitácora completa,
16 k líneas), [BOTS-API](BOTS-API.spec.md), [INFORMES-DESDE-LILACHAT](INFORMES-DESDE-LILACHAT.spec.md),
[MAPA-OBRA](MAPA-OBRA.spec.md), [TUTORIALES-CANAL-CLIENTE](TUTORIALES-CANAL-CLIENTE.spec.md),
[INGRESO-POR-ESPACIO](INGRESO-POR-ESPACIO.spec.md), [PLANES-FLUIDEZ-IOS-PWA](PLANES-FLUIDEZ-IOS-PWA.spec.md),
[DEPLOY](DEPLOY.spec.md) y el corte viejo [AS-IS-0.1.170](AS-IS-0.1.170.spec.md).

## Cómo se mantiene

`.constroad-gates.json › asIs.map` dice qué as-is acompaña a cada carpeta de código: un commit que toca
`app/src/spaces/dali/` pide cambiar `specs/as-is/bots-dali-prospectos.md`. Si el cambio no altera lo
documentado, el commit lo dice: `As-is: sin cambios (<motivo>)`.
