# As-is · Asistente Lila, ausente, rutinas, cola, Pendientes, evidencia, App Links y tarjetas en vivo

## 1. Qué es

Son piezas chicas que rodean a los chats y no son la API de bots:
- **Asistente** (`/lila`): Claude responde dentro de un chat de empresa, y «Ponme al día» resume.
- **Ausente** (auto-respuesta): el server contesta un 1:1 cuando no estás.
- **Rutinas** (Automatizaciones): silenciar un chat por horario y una nota para la próxima vez.
- **Cola de tarjetas**: lo pendiente para mí en un chat, sobre la barra de escribir.
- **Pendientes**: la línea de recordatorios y eventos de todos mis chats (Agenda).
- **Evidencia de tareas**: un archivo del chat enlazado a una tarea del checklist.
- **App Links**: un enlace `lilachat.constroad.com/unirse/…` abre el APK.
- **Tarjetas en vivo** (`avisoDeTarjeta`): encuesta, evento, recordatorio y checklist se redibujan al cambiar.

No hay spec propia de este grupo. Fuentes: ARCHITECTURE §97 (cola), §110 (`/lila`), §112, §166 (Pendientes
web), §168 (Automatizaciones). **Fecha de corte: 17/11/2026.**

## 2. Qué hace hoy

### Server

**Asistente** (`server/src/assistantClient.ts`, `assistantService.ts`, `assistantRoutes.ts`, `assistantReply.ts`).
- Desde el 18/11 Lilachat no guarda claves de modelos ni elige el modelo (José). El resumen, la respuesta a `@lila`
  y el borrador de evento son tareas que le pide a agentes (`assistant.catch_up`, `assistant.mention`, `event.draft`)
  por `agentesModel.ts`, firmadas con la instalación de Lila de un espacio de un miembro del chat. Agentes elige
  el modelo y el tope de tokens (hoy Haiku 5.5). Sin modelo, o sin ese espacio, responde «Lila no tiene un modelo
  configurado todavía» (503), sin mostrar la configuración del server.
- `POST /api/assistant/catch-up`: resumen de lo nuevo. Sin nada nuevo no llama al modelo.
- `POST /api/assistant/event-draft`: arma un borrador de evento (`parseEventDraft` en shared).
- Freno por usuario: 6 llamadas por minuto, en memoria del proceso.
- La membresía del chat es el permiso: no se resume un chat ajeno.
- `/lila …` al principio del mensaje, solo en un chat con `workspaceId` (`maybeAnswerMention`, llamado
  desde `socket.ts`). Una mención «@Lila» nunca lo llama (22/10). Con apps instaladas en el chat, ellas oyen el
  mensaje y el `/lila` propio contesta igual, salvo que una de sus apps haya registrado el comando `lila`
  (`builtInLilaAnswers`, 27/11, Agentes: antes cualquier bot lo callaba y en un canal con Dali, Portal o Inframaq
  nadie contestaba). Firma la tarea con cualquier app de agentes del espacio (`lilaDoorFor`).
- Lila se suma como miembro la primera vez. La respuesta es un mensaje más del chat.
- Si falla, el chat lee «No pude responder ahora. Prueba en un rato.» y la causa va al log.
- Contexto: hasta 40 mensajes y 8000 caracteres (`CONTEXT_LIMITS` en `shared/src/assistant.ts`).

**Ausente** (`server/src/autoReply.ts`, rutas `GET/PUT /api/me/auto-reply` en `meRoutes.ts`).
- Responde solo en un 1:1, solo si no tienes socket, una vez por chat cada 2 h.
- Un auto-reply lleva `autoReply: true` y nunca dispara otro.
- El estado vive en `AutoReplyStateModel`.

**Rutinas** (`server/src/routinesRoutes.ts`).
- `GET /api/routines`: mis rutinas, con el nombre del grupo o de la persona.
- `PUT /api/chats/:chatId/routines { quietHours?, contactNote? }`. `null` borra.
- Viven en el subdocumento del miembro: `members.$.quietHours` y `members.$.contactNote`.
- Dentro del horario no suena ni una mención. Las llamadas suenan igual.
- La nota es solo para un 1:1 (400 en un grupo), hasta 200 letras.

**Cola de tarjetas** (`server/src/queueRoutes.ts`).
- `GET /api/agenda/queue?chatId=`: mis tareas atrasadas, eventos sin responder, encuestas sin votar y
  recordatorios de una vez que sonaron hoy. No guarda nada: hacer la cosa la saca.
- `GET /api/agenda/queue/keys`: las claves de todos mis chats, para los marcadores de la lista.

**Pendientes** (`server/src/pendientesRoutes.ts`).
- `GET /api/agenda/linea`: recordatorios activos, vencidos del último día y mis apagados.
- El recordatorio de una tarea vive en la tarea, no en esta lista (06/11).

**Evidencia de tareas** (`server/src/taskEvidenceRoutes.ts`).
- `POST /api/agenda/checklists/:id/items/:itemId/evidence { seq }`: enlaza un archivo del chat.
- `DELETE .../evidence/:seq`: lo quita quien lo subió o quien creó el checklist. Nunca borra el mensaje.
- Quien no lleva el plan solo agrega evidencia a sus propias tareas (06/11).

**App Links** (`server/src/appLinks.ts`): `GET /.well-known/assetlinks.json` con el paquete y el SHA-256
de la llave de release. Es público a propósito.

**Tarjetas en vivo** (`server/src/avisoDeTarjeta.ts`): cada voto, edición, imagen, cierre o borrado avisa
`ref.changed` a todos los miembros, después de responder. Nunca lanza.

### Shared

- `assistant.ts`: `detectLilaCommand`, `selectContextMessages`, `parseEventDraft`, `CONTEXT_LIMITS`.
- `routines.ts`: `quietHoursOf`, `isQuietNow`, `quietHoursLabel`, `contactNoteOf`.
- `chatQueue.ts`: orden, rótulos, `postponeOneDay`, descartes (`QUEUE_DISMISSED_LIMIT = 200`).
- `pendientes.ts`: `lineaDePendientes`, `origenDelRecordatorio`, `estadoDelEvento`.
- `appLink.ts`: enlaces de vuelta a una app (`/s/{space}/apps/{client_id}`).

### Web/PWA

- Rutinas: `web/src/routines/RoutinesRow.tsx` (Ajustes del panel de info), `ContactNoteBannerWeb.tsx`,
  `routinesApi.ts`.
- Cola: `web/src/chat/queue/useChatQueue.ts`, `pendingInChats.ts`.
- Pendientes: `web/src/agenda/LineaDePendientes.tsx` (lista + detalle del evento, §166).
- Evidencia: `web/src/chat/workPlan/evidenceWeb.ts`, `WorkListsWeb.tsx`.
- Asistente: no hay «Ponme al día» en la web. Verificado (solo `app/src/chat/CatchUpBanner.tsx` llama a
  `catch-up`). `/lila` funciona igual, porque es un mensaje.
- Ausente: no hay ajuste en la web. Verificado.

### APK

- Asistente: `app/src/chat/CatchUpBanner.tsx` («Ponme al día»).
- Ausente: `app/src/settings/AutoRespuestaAjuste.tsx`.
- Rutinas: `app/src/chat/RoutinesCard.tsx` (Ajustes del detalle), `ContactNoteBanner.tsx`, `routinesApi.ts`.
- Cola: `app/src/chat/useChatQueue.ts`, `pendingInChats.ts`.
- Pendientes: `app/src/agenda/PendientesScreen.tsx`, `FilasDePendientes.tsx`, `usePendientes.ts`,
  `usePendientesDeAgenda.ts`, `BotonesDeRsvp.tsx`.
- Evidencia: `app/src/chat/workPlan/TaskDetailSheet.tsx`, `evidenceUpload.ts`.

## 3. Diferencias APK vs web

- «Ponme al día» del asistente: solo APK.
- Ajuste de ausente: solo APK. El server responde igual, la configure quien la configure.
- Pendientes: el APK tiene su pantalla en la Agenda. La web, lista y detalle lado a lado (§166).
- Rutinas: tarjeta en Ajustes del detalle (APK) o fila en el panel de info (web). Mismo motor.
- `POST /api/assistant/event-draft` no tiene consumidor en la web ni en el APK. Verificado.

## 4. Historia reciente

Casi todo este grupo es anterior a la ventana de 6 semanas. Lo que entró en la ventana:
- **20/10** Línea de Pendientes, origen y estado de cada pendiente, y Destacar (server, web y APK).
- **21/10** Checklist en el chat con tareas en vivo. Recordatorio personal para devolver una llamada.
- **22/10** Lo pendiente para mí en un chat, derivado de tareas, eventos, encuestas y recordatorios.
  Pendientes de todos mis chats. El asistente solo con `/lila` y solo en espacios de empresa.
- **22/10** El enlace de invitación abre la app si está instalada (App Links).
- **25/10** La línea de Pendientes lleva ubicación y avisos.
- **29/10** Automatizaciones: silenciar por horario y la nota para la próxima vez.
  Pendientes web con Van · Tal vez · No van. Checklist, Archivos y Pendientes con evidencia por tarea
  en los canales de cliente.
- **02/11** Textos vacíos con «aquí» y no «acá» (español neutro).
- **06/11** Checklist solo para admins, Pendientes para todos y recordatorios por tarea.
- **11/11** Los espacios borrados se borran de verdad a los 30 días (incluye el estado del ausente).

## 5. Diseños de Stitch relacionados

| Diseño | Estado | Evidencia |
| --- | --- | --- |
| `automatizaciones` | Parcial | Horario y nota hechos (§168). El disparador por ubicación no se hizo: gasta batería (comentario en `routinesRoutes.ts`) |
| `legado` (Legado Digital) | No implementado | Espera decisiones de José (§168). No hay código |
| `w3c-web-agenda` | Implementado | `web/src/agenda/LineaDePendientes.tsx` (§166) |
| `q-01-tarjetas-en-cola` | Implementado según §97 | El slug no está en `design/stitch/INVENTARIO.md`. No verificado contra la captura |
| `r148-estado` | Fuera de este grupo | Estado de presencia (§110) |

## 6. Pendientes y deuda conocida

- **La clave de idempotencia de `/lila` no es idempotente.** El comentario dice que un reintento no
  duplica, pero la clave usa `Date.now()` (`clientKey: lila-<chat>-<Date.now()>` en `assistantReply.ts`).
  Verificado en código.
- **El freno del asistente vive en memoria.** Se pierde al reiniciar y no se comparte entre procesos.
  Decisión consciente (comentario de `assistantRoutes.ts`). Verificado en código.
- **El modelo está fijo en el código** (`claude-opus-5`). Cambiarlo es un deploy. Verificado en código.
- **`event-draft` sin consumidor.** La ruta existe y nadie la llama. Verificado en código.
- **Disparador por ubicación y Legado Digital** sin hacer (§168).
- **`app/src/chat/ChatScreen.tsx` pasa el tope: 603 líneas.** `ChatDetailScreen.tsx` va en 595.
  §168 ya lo marcaba. Verificado en código.
- **Una llave de release nueva** obliga a cambiar la huella de `appLinks.ts`, o los enlaces abren la web.
  Verificado en código (comentario del archivo).
- **El asistente no es Lila de agentes.** Es un usuario «Lila» propio de Lilachat que habla con Claude.
  La app Lila de agentes entra por la API de bots. No confundirlas.

## 7. Pruebas

- Server: `assistantReply.test.ts` (6), `assistantRoutes.test.ts` (8), `autoReply.test.ts` (6),
  `routines.test.ts` (3), `pendientes.test.ts` (3), `appLinks.test.ts` (1), `avisoDeTarjeta.test.ts` (8),
  `checklistRoutes.test.ts`, `taskReminders.test.ts`.
- Shared: `assistant.test.ts` (13), `routines.test.ts` (5), `chatQueue.test.ts` (7), `pendientes.test.ts` (6),
  `appLink.test.ts` (3).
- Web: `web/src/routines/RoutinesRow.test.tsx` (4), `web/src/agenda/LineaDePendientes.test.tsx` (4),
  `web/src/chat/queue/ChatQueue.test.tsx`.
- APK: `app/src/agenda/alarmView.test.ts`, `openPlace.test.ts` (Agenda, no Pendientes).
- Maestro y arnés: ninguno propio de este grupo. Verificado.
- E2E del 22/10 (§110): en un chat personal, «@Lila ?» y «/lila hola» quedaron sin respuesta, como se quería.

Las cifras entre paréntesis son casos `it(...)` contados el 17/11.
