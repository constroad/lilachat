# As-is · Chat: encuestas, eventos, recordatorios, checklists y agenda


- **Sin señal (26/11):** el checklist por etapas se guarda en el teléfono; marcar una tarea (con el estado que se quiere, `done`, idempotente en el server) y subir su evidencia van por la cola de campo. Ver `plataforma-sin-senal.md`.
## 1. Qué es

Las tarjetas vivas que se publican en un chat: encuesta, evento, recordatorio y checklist.
El mensaje lleva solo la referencia (`Message.ref`); votos, respuestas y tareas se leen en vivo.
La Agenda («Pendientes») junta eventos y recordatorios de todos mis chats.
La cola de tarjetas y la línea de Pendientes están en `bots-asistente-rutinas-pendientes.md`.

**Fecha de corte:** 17/11/2026.

## 2. Qué hace hoy

### APK (`app/src/agenda/`, `app/src/chat/`)

**Crear desde el chat**
- Menú «+» del chat: `CrearDesdeElChat.tsx` (el chat ya está elegido).
- Encuesta: `agenda/CreatePollScreen.tsx` con «Varias respuestas» y «Resultados anónimos».
- Evento: `agenda/CreateEventScreen.tsx`.
  - Día, hora de inicio y de fin, lugar, repetición.
  - Invitar a contactos (con un chat en común), no a conversaciones.
  - Editar y cancelar («desaparece de la agenda de todos los invitados»).
- Recordatorio: `agenda/CreateReminderScreen.tsx` (también edita, con `editando`).
  - Para quién (`aQuienSuena`), día y hora exactos, repetición (`RepeatPicker.tsx`).
  - Avisos previos (`AdvanceField.tsx`): hasta 5, de 1 minuto a 7 días; por defecto 15 min.
  - Nota, ubicación e imagen (`ImagenDeRecordatorio.tsx`).
- Checklist: `agenda/CreateChecklistScreen.tsx` (título, tareas y ajustes; diseño `k-02`).

**Tarjetas en el chat**
- Encuesta: `EncuestaEnElChat.tsx`, `agenda/TarjetaDeEncuesta.tsx`; votar, cerrar y borrar con `agenda/useAccionesDeEncuesta.ts`.
- Evento: `EventoEnElChat.tsx` con `agenda/BotonesDeRsvp.tsx` (Voy · Tal vez · No voy); detalle `agenda/DetalleDeEvento.tsx`.
- Recordatorio: `RecordatorioEnElChat.tsx`; abre su detalle `agenda/ReminderDetailScreen.tsx` y sus enlaces se tocan.
- Checklist: `ChecklistEnElChat.tsx` (diseño `k-01`): progreso, quién marcó, «Agregar tarea».
  - Opciones (editar, eliminar): `ChecklistOptionsSheet.tsx`.
  - Tarea con responsable y fecha: `TaskSheet.tsx`, `TaskMeta.tsx` (diseño `k-03`).
  - La tarea ajena se ve tenue y avisa de quién es (21/10).
- Tarjetas que se actualizan solas: `useTarjetaViva.ts`, `TarjetaDelChat.tsx`, `accionesDeTarjeta.tsx`.
- Una tarjeta se desliza para responder, se elige y abre hilo (20/10).

**En la info del chat**
- Recordatorios del grupo: `RecordatoriosDelGrupo.tsx` (los ve todo el grupo; un admin los edita y borra).
- Checklists del chat: `ChecklistsCard.tsx` (diseño `k-05`: «N activos» o «Completos»).

**Agenda y alarma**
- «Pendientes» con el botón de crear: `agenda/AgendaScreen.tsx`, `PendientesScreen.tsx`, `FilasDePendientes.tsx`, `usePendientes.ts`.
- Lista de encuestas: `agenda/PollsScreen.tsx`.
- Mis tareas: `agenda/MyTasksView.tsx` (diseño `k-04`).
- Recordatorio a pantalla completa con el teléfono bloqueado: `agenda/AlarmScreen.tsx`, `ReminderAlarmHost.tsx`, `alarmView.ts`.
  - Diseños `a-01-recordatorio-sonando` y `a-02-evento-por-empezar` (fuera del INVENTARIO; en `design/stitch/`).
  - Posponer N minutos nativo desde el APK 0.1.175.
- El recordatorio que suena deja un aviso destacado en el chat (`HighlightedNotice.tsx`) que acepta reacciones e hilos.
- Abrir el lugar del evento o recordatorio: `agenda/openPlace.ts`.

### Web/PWA (`web/src/agenda/`, `web/src/chat/tarjetas/`)

- Crear encuesta: `agenda/CreatePanels.tsx › CreatePollOverlay` (pregunta, opciones, «Varias respuestas»).
- Crear evento: `agenda/CreatePanels.tsx › CreateEventOverlay` (título, lugar, fecha).
- Crear y editar recordatorio: `agenda/CrearRecordatorio.tsx`, `formularioDeRecordatorio.ts`, `RepeatPickerWeb.tsx`, `AdvanceFieldWeb.tsx` (diseño `w3c-web-recordatorio`).
- Crear checklist: `agenda/CreateChecklistOverlay.tsx`.
- Tarjetas en el chat: `tarjetas/TarjetaDelMensaje.tsx`, `EncuestaEnElChat.tsx`, `EventoEnElChat.tsx`, `RecordatorioEnElChat.tsx`, `ChecklistEnElChat.tsx`, `EstadosDeTarjeta.tsx`, `useTarjeta.ts` (diseño `w3c-web-tarjetas`).
- Checklist: opciones `tarjetas/ChecklistOptionsDialog.tsx`, tarea `tarjetas/TaskDialog.tsx`, tarjeta de la info `tarjetas/ChecklistsCard.tsx`.
- Recordatorios del chat en la info (27/11, José: el detalle del canal no los listaba en la web): `tarjetas/RemindersCard.tsx`,
  como `RecordatoriosDelGrupo` del APK. Lee `GET /reminders/del-chat/:chatId`; quien puede administrarlos los abre para editar.
  En cualquier chat no secreto (canal, grupo, 1:1). Test `RemindersCard.test.tsx` (5).
- Agenda: `agenda/AgendaOverlay.tsx`, `LineaDePendientes.tsx`, detalle `EventDetailPane.tsx` con Van · Tal vez · No van al lado (29/10; diseño `w3c-web-agenda`).
- Mis tareas: `agenda/MisTareas.tsx`. Lugares: `agenda/PlaceLinksWeb.tsx`.
- El recordatorio que suena llega como línea del chat con acciones de mensaje (`LineaDeSistema.test.tsx`).

### Server (`server/src/`, montado en `/api/agenda`)

- Modelos: `eventModels.ts` (`EventModel`, `ReminderModel`, `PollModel`), `checklistModel.ts`.
- Eventos (`eventRoutes.ts`): `GET/POST /events`, `GET/PATCH/DELETE /events/:eventId`, `POST /events/:eventId/rsvp`, `POST /events/:eventId/invitar` (`invitarAlEvento.ts`: solo contactos con un chat en común).
- Recordatorios (`eventRoutes.ts`): `GET/POST /reminders`, `PATCH/DELETE /reminders/:id`, `POST /reminders/:id/toggle`.
- Recordatorios del grupo (`recordatoriosDeGrupo.ts`): `GET /reminders/del-chat/:chatId`, `POST/DELETE /reminders/:id/imagen`, `POST /reminders/:id/publicar`.
- Encuestas (`eventRoutes.ts`): `GET/POST /polls`, `GET/DELETE /polls/:pollId`, `POST /polls/:pollId/vote` (`votoDeEncuesta.ts`), `POST /polls/:pollId/close`.
- Vistas por persona: `vistaDeEncuesta.ts`, `vistaDeEvento.ts`.
- Checklists (`checklistRoutes.ts`, `checklistService.ts`):
  - `POST /checklists`, `GET /checklists`, `GET /checklists/mine`, `GET/PATCH/DELETE /checklists/:id`.
  - `POST /checklists/:id/items`, `PATCH/DELETE /checklists/:id/items/:itemId`, `POST …/items/:itemId/toggle`.
  - Borrar el checklist borra su tarjeta para todos.
- Avisos agrupados al marcar tareas (un minuto de espera): `checklistNotices.ts`.
- Recordatorios por tarea con fecha (06/11): `taskReminders.ts`.
- Cron de eventos y recordatorios (`setInterval` de un minuto, dentro del server): `reminderCron.ts`.
- Tarjeta viva: `avisoDeTarjeta.ts` emite `ref.changed` a los miembros.
- Pendientes: `GET /api/agenda/pendientes` (`eventRoutes.ts`) y `GET /api/agenda/linea` (`pendientesRoutes.ts`). Cola: `GET /api/agenda/queue` (`queueRoutes.ts`).

### Shared (`shared/src/`)

- Encuestas: `polls.ts` (`tallyPoll`, `applyVote`, `validatePoll`; `allowMultiple`, `anonymous`), `encuestas.ts`.
- Eventos: `events.ts` (`Recurrence` once/daily/weekly/monthly, `summarizeRsvp`), `eventos.ts` (`cuandoDelEvento`, `resumenDeRsvp`).
- Recordatorios: `recordatorios.ts`, `repeatRule.ts` (cada N, días de la semana, día del mes), `reminderAdvance.ts`, `guardarRecordatorio.ts`, `cuando.ts`.
- Checklists: `checklists.ts` (`CHECKLIST_LIMITS`: título 120, tarea 200, 30 tareas, 300 por etapa; `canToggleTask`, `checklistPermissions`).
- Tarjetas vivas: `tarjetasVivas.ts`. Agenda: `agenda.ts`, `agendaEdicion.ts`, `agendaLocal.ts`, `tiposDeAgenda.ts`.
- Tareas y avisos: `taskReminders.ts`, `pendientes.ts`, `chatQueue.ts`, `clientTasks.ts` (canal de cliente).

## 3. Diferencias APK vs web

| Función | APK | Web |
| --- | --- | --- |
| «Resultados anónimos» al crear encuesta | Sí | No: el cuerpo solo manda `allowMultiple` |
| Cerrar o borrar una encuesta | Sí (`useAccionesDeEncuesta.ts`) | No hay llamada a `/close` ni `DELETE /polls` |
| Lista de encuestas | `PollsScreen.tsx` | Dentro de `AgendaOverlay.tsx` |
| Hora de fin del evento | Sí | No: `CreateEventOverlay` no envía `endsAt` |
| Editar o cancelar un evento | Sí | No hay `PATCH`/`DELETE /events` |
| Invitar contactos a un evento | Sí (`DetalleDeEvento.tsx`) | No hay `POST /invitar` |
| Recordatorio a pantalla completa | Sí (`AlarmScreen.tsx`) | No; línea en el chat |
| Editar recordatorio | Sí | Sí |
| Checklist, tareas, «Mis tareas» | Sí | Sí |

## 4. Historia reciente

- **20/11:** `useChannelWork`/`ChannelWorkTabs.tsx` (app) también devuelve
  `openService`/`focusServiceId`/`clearServiceFocus`, threaded a
  `ClientServices` desde `ChannelPanels` — la mitad de carpintería del `open`
  card-action (agentes), separada del refactor de complejidad que la motivó
  (`useServiceFocus`, `useChannelTabBack`, `channelBadges` extraídos). Contrato
  completo en `obra-canal-cliente-y-tutoriales.md`.
- **17/10:** editar y borrar avisos y eventos, con día y hora exactos (José: «no hay como editar avisos»).
- **18/10 (FL10, 0.1.89):** encuestas completas, evento con hora de fin e invitar, invitados de afuera.
- **18/10 (0.1.94):** encuestas y eventos dentro del chat. Arreglo del recordatorio doble.
- **19/10 (0.1.98–0.1.99):** recordatorios del grupo con su tarjeta publicada. Tarjetas que se actualizan solas.
- **20/10:** recordatorios en todo chat (también 1:1). Web: tarjetas en vivo, recordatorios y Pendientes. Avisos destacados al sonar.
- **21/10 (§80, 0.1.121):** checklist como Telegram, en vivo. Luego responsable y fecha por tarea, editar o borrar, «Mis tareas», checklist en hilos.
- **21/10:** la tarea asignada solo la marca su responsable o quien creó el checklist. Avisos agrupados al marcar.
- **21/10:** «Recordarme» en la llamada perdida. El recordatorio que suena se responde como mensaje (§75).
- **22/10 (0.1.135, 0.1.150):** Mis tareas y Checklists del chat como `k-04`/`k-05`. Recordatorio a pantalla completa y repeticiones.
- **23/10:** el aviso y la tarjeta del recordatorio lo abren con sus enlaces.
- **25/10:** avisos previos y ubicación en recordatorios.
- **28/10:** checklist por etapas en canales de cliente (pendiente 21).
- **29/10:** alarma con el diseño guinda y negro (`a-01`/`a-02`), luego lila oscuro. Detalle web del evento con Van, Tal vez y No van.
- **29/10:** Checklist, Archivos y Pendientes solo en canales de cliente, con evidencia por tarea.
- **30/10:** una raíz de hilo que es tarjeta se ve como su tarjeta; cada recordatorio que suena deja una línea de registro.
- **06/11:** solo admins en Checklist, Pendientes para todos y recordatorios por tarea. Una app suma tareas a la etapa Ejecución.
- **19/11:** cada fila de Pendientes del canal de cliente lleva casilla y cámara (diseño cc-06), con los permisos
  de `taskActionsFor`; la foto va por la puerta de evidencia de siempre (`evidenceWeb.ts`, `evidenceUpload.ts`
  con `source: 'camera'`). `toggleTaskWeb` / `toggleTask` son la única llamada a `/toggle` (fila y detalle).
- **19/11:** en el celular (< 768 px) «Checklist» lleva el segmentado «Pendientes · Plan» y Pendientes deja de ser pestaña para quien tiene Checklist (diseño cc-06; web `chat/workPlan/ChecklistSegmentsWeb.tsx`, APK `chat/workPlan/ChannelWorkTabs.tsx`; regla en `shared/src/serviceShell.ts`).

## 5. Diseños de Stitch relacionados

| Diseño | Estado | Evidencia |
| --- | --- | --- |
| `crear-encuesta` | Implementado | `web/src/agenda/CreatePanels.tsx`; APK `CreatePollScreen.tsx` |
| `crear-evento` | Implementado | `web/src/agenda/CreatePanels.tsx`; APK `CreateEventScreen.tsx` |
| `recordatorios` | Implementado | Tarjeta tintada con ícono (§48.2); `RecordatoriosDelGrupo.tsx` |
| `fl6-editar-recordatorio` | Implementado | `CreateReminderScreen.tsx` con `editando`; web `CrearRecordatorio.tsx` |
| `w3c-web-tarjetas` | Implementado | `web/src/chat/tarjetas/TarjetaDelMensaje.tsx`, `EncuestaEnElChat.tsx`, `EventoEnElChat.tsx` |
| `w3c-web-agenda` | Implementado | `web/src/agenda/EventDetailPane.tsx`, `LineaDePendientes.tsx` |
| `w3c-web-recordatorio` | Implementado | `web/src/agenda/CrearRecordatorio.tsx` |
| `k-01-checklist-en-el-chat` | Implementado, sin notas por tarea (inventadas) | `ChecklistEnElChat.tsx` (app y web) |
| `k-02-crear-checklist` | Implementado, sin «Reordenar» | `CreateChecklistScreen.tsx`, `CreateChecklistOverlay.tsx` |
| `k-04`, `k-05` (fuera del INVENTARIO) | Implementado | `MyTasksView.tsx`, `MisTareas.tsx`, `ChecklistsCard.tsx` (§ del spec) |

## 6. Pendientes y deuda conocida

- **Web: encuesta sin «Resultados anónimos», sin cerrar y sin borrar.** Verificado en código (`CreatePanels.tsx`, sin `/close`).
- **Web: evento sin hora de fin, sin editar, sin cancelar y sin invitar.** Verificado en código.
- **Web: sin alarma a pantalla completa.** Verificado en código (no hay pantalla equivalente a `AlarmScreen`).
- **Tarjetas de la info sin rótulo** (Fijados, Media), como pide `k-05`. «Queda para cuando se revisen». Según spec.
- **Índices de checklist** `{chatId, createdAt}` e `{'items.assignee'}`: se crean en producción solo con OK de José. No verificado si ya se crearon.

## 7. Pruebas

- **Shared:** `polls`, `encuestas`, `events`, `eventos`, `recordatorios`, `repeatRule`, `reminderAdvance`,
  `guardarRecordatorio`, `cuando`, `checklists`, `tarjetasVivas`, `agenda`, `agendaEdicion`, `agendaLocal`,
  `taskReminders`, `pendientes`, `chatQueue`, `clientTasks`, `birthdayReminder` (`shared/src/*.test.ts`).
- **Server:** `eventRoutes`, `votoDeEncuesta`, `recordatoriosDeGrupo`, `checklistRoutes`, `taskReminders`,
  `avisoDeTarjeta`, `pendientes`, `highlightedNotice` (`server/src/*.test.ts`); `bots/botClientTasks.test.ts`.
- **APK:** `agenda/alarmView.test.ts`, `agenda/openPlace.test.ts`.
- **Web:** `agenda/CreatePanels`, `agenda/CrearRecordatorio`, `agenda/RepeatPickerWeb`, `agenda/LineaDePendientes`,
  `chat/tarjetas/TaskDialog`, `chat/tarjetas/TarjetaDelMensaje`, `chat/LineaDeSistema`.
- **Maestro:** ninguno.

**25/11:** `useServiceFocus` (`app/src/chat/workPlan/ChannelWorkTabs.tsx`) guarda también el `reportId` de una tarjeta «INFORME» y lo pasa a «Servicios» (ver `obra-canal-cliente-y-tutoriales.md`).
