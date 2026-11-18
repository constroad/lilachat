# As-is · Comandos «/», acciones ⚡, formularios y horarios de las apps

## 1. Qué es

Es cómo una persona le pide algo a una app instalada.
- **Comando «/»**: se escribe en el compositor («/clima lurin»).
- **Acción (atajo)**: se toca en el ⚡ del espacio, en la franja ⚡ del chat o en el «+» de un canal.
- **Formulario**: la respuesta de una app puede ser un JSON Schema que Lilachat dibuja.
- **Horario**: un comando de consulta que corre solo a una hora, como su creador.
- **Ajuste por ítem**: el admin decide dónde y para quién funciona cada comando y acción.

Contrato: `specs/BOTS-API.spec.md` §c-bis a §c-vicies, §c-octodecies (formularios vivos),
§c-duodecies-bis (filas que corren un comando). Historia: ARCHITECTURE §121, §124, §150–152.
**Fecha de corte: 17/11/2026.**

## 2. Qué hace hoy

### Server

**Comandos** (`server/src/bots/botCommands.ts`, 360 líneas; `botRoutes.ts`; `botUserRoutes.ts`).
- La app registra su lista con `PUT /api/bots/commands` (hasta 25). `GET` la lee.
- La persona: `GET /api/workspaces/:id/commands?chat=<id>` o `?place=space` (solo lo habilitado ahí).
- Invocar: `POST /api/chats/:chatId/commands` y `POST /api/workspaces/:id/commands` (el ⚡).
  Hasta 20 por minuto por persona. Resultado: `ephemeral`, `posted`, `pending` o `failed`.
- `command.invoked` espera hasta 3 s. Un 502/503/504 se reintenta una vez a ~1,2 s.
- Respuesta tardía: `POST /api/bots/commands/:id/respond` (hasta 5 en 15 min).
  La efímera llega por socket (`command.response`).
- Un formulario enviado espera hasta 8 s la respuesta por `/respond` en la misma llamada (`lateAnswers.ts`).
- «Enviar al canal» una efímera: `POST /api/chats/:chatId/commands/:commandId/share`. 409 si `shareable: false`.
- Corridas en `botcommandruns`, con `failure { at, error }` una semana.

**Acciones** (`botUserRoutes.ts`).
- `POST /api/chats/:chatId/shortcuts` y `POST /api/workspaces/:id/shortcuts` → `shortcut.invoked`.
- `channel: null` cuando viene del ⚡ del espacio.
- Desde un lugar (la tarjeta de un servicio) viaja `values`. Un campo del formulario con ese nombre
  se quita antes de mostrarlo (`shared/src/appFormKnown.ts`).

**Filas y botones que corren un comando**.
- `POST /api/chats/:chatId/card-commands { seq, line, forms }`: la línea exacta de esa tarjeta.
- `POST .../commands/:commandId/line`: la línea de una respuesta «Solo tú ves esto» (15/11).
- Corren aunque el comando esté apagado en ese canal. «Quién puede usarlo» sigue valiendo.
- `anyone: true` en una fila la abre a todo miembro (datos sin nada sensible, como `/clima`).

**Formularios** (`botForms.ts`, `botFormLive.ts`).
- Fotos: `POST .../commands/:commandId/files`. Envío: `POST .../commands/:commandId/form`.
- Lugar: `GET .../commands/:commandId/place`. Refresco: `.../refresh`. Resumen: `.../preview`.
- `form.submitted` trae `values` y, con fotos, `photos: [{ field, url, taken_at, lat?, lng? }]` (13/11).
- La app responde como a un comando, con `errors` por campo o con `nothing_to_report: true`.
- Firma (foto + ubicación): la ubicación debe tener menos de 2 min. La foto llega estampada
  (`photoStamp.ts`, `spaceStampLogo.ts`).
- Un cliente sin `forms: 2` o `forms: 3` recibe «Actualiza Lilachat para llenar este formulario».
- Subida al Drive de un servicio: la respuesta trae `upload` (validado por `driveUploadOf`). El archivo
  va del teléfono a Portal y la dirección no se guarda ni se loguea.

**Ítems v2: todo apagado** (`botItems.ts`, `shared/src/appItems.ts`).
- Cada comando y acción: `{ global, channels, direct, who }`.
- `GET/PUT /api/workspaces/:id/apps/:appId/items` (cambiar, solo admins). Avisa `workspace.apps.changed`.
- Una instalación nueva nace con `itemsV2: true` y todo apagado.
- Invocar algo apagado: `404 not_enabled_here`. Sin permiso: `403 not_allowed_here`.
- `scripts/migrate-items-all-off.ts --apply` apaga las instalaciones de antes.

**Horarios** (`botSchedules.ts`, `botScheduleDelivery.ts`, `botScheduleRoutes.ts`, `scheduleModels.ts`).
- `GET/POST /api/workspaces/:id/apps/:appId/schedules`, `PATCH/DELETE .../:scheduleId`.
- Solo comandos `schedulable`. Hasta 30 por app. El canal debe tener al creador y a la app.
- Corre en el tick de `server/src/reminderCron.ts`. Un update condicional sobre `nextRunAt` evita dobles.
- Corre COMO el creador, con `trigger: 'schedule'`. `in_channel` se publica una vez por turno.
- Más de 30 min tarde no corre y se avisa. `lastRun` alimenta «No corrió el 27/10: …».
- Cada corrida deja una línea en el log (05/11).

**Temas de aviso** (`botTopics.ts`).
- `GET/PUT /api/workspaces/:id/apps/:appId/topics` y `POST .../topics/test` («Probar envío»).
- `default: null` nace «Sin canal». `offer: 'chosen'` existe solo si la app lo ofrece.

**Tu cuenta en la app** (`botLink.ts`): `GET/DELETE /api/workspaces/:id/apps/:appId/link`.
Pregunta a la app por `link.status` y `link.revoke`. Lilachat no guarda nada.

### Shared

- `botCommands.ts`: lista «/», parseo, resultados.
- `appItems.ts`: `itemIsOn`, `mayUseItem`, `sameItemSetting` y los valores de antes.
- `appSchedules.ts`: `scheduleLine`, `lastRunProblem`, `validateScheduleInput`, `repeatOfDays`.
- `appForms.ts` (607 líneas) más `appFormRows`, `appFormSplit`, `appFormOptions`, `appFormLive`,
  `appFormSections`, `appFormSteps`, `appFormSubmits`, `appFormKnown`, `appFormLists`, `appFormPicks`.
- `ephemeralStack.ts`: la pila de «Solo tú ves esto» como chips (c-01).
- `photoSizing.ts`: la regla única de compresión de fotos (la de Portal).

### Web/PWA (`web/src/chat/commands/`, `web/src/spaces/apps/`)

- Compositor «/» y panel: `useChatCommands.ts`, `CommandPanel.tsx`, `commandsApi.ts`.
- Respuestas: `EphemeralAnswers.tsx`, `useAppAnswers.ts`, `useAnsweredSince.ts`.
- ⚡ del chat: `ChatQuickActions.tsx`. «+» del canal: `AppActionList.tsx`. ⚡ del espacio:
  `web/src/spaces/apps/SpaceQuickActions.tsx`.
- Formulario: `AppFormDialog.tsx` con `AppFormFields.tsx`, `ListField.tsx`, `PhotoListField.tsx`,
  `RichChoiceFields.tsx` (incluye las tarjetas con dibujo), `SearchableChoice.tsx`, `SignerPicker.tsx`,
  `LiveSelfie.tsx`, `PlaceButton.tsx`, `FormSummary.tsx`, `FoldedSection.tsx`, `WorkPlaceFields.tsx`.
- Estado vivo: `useAppFormState.ts`, `useFormLive.ts`, `useLiveSigning.ts`, `useFieldAutofill.ts`.
- Fila o botón con comando: `web/src/chat/botBlocks/cardCommand.ts`.
- Detalle de la app: `AppCommandsPanel.tsx`, `AppItemEditor.tsx`, `AppItemsSection.tsx`,
  `AppSchedulesSection.tsx`, `ScheduleSheet.tsx`, `NoticeTopicsSection.tsx`, `AppAccountSection.tsx`.

### APK (`app/src/chat/commands/`, `app/src/spaces/apps/`)

- Mismos papeles: `useChatCommands.ts`, `CommandPanel.tsx`, `EphemeralAnswers.tsx`, `ChatQuickActions.tsx`,
  `QuickActionsSheet.tsx`, `AppActionRows.tsx`, `app/src/spaces/apps/SpaceQuickActions.tsx`.
- Formulario como hoja: `AppFormSheet.tsx`, con `DateField.tsx`, `ListField.tsx`, `PhotoListField.tsx`,
  `RichChoiceFields.tsx`, `SearchableChoice.tsx`, `SignerPicker.tsx`, `LiveSelfie.tsx`, `galleryPick.ts`.
- Detalle de la app: `AppCommandsPanel.tsx`, `AppItemEditor.tsx`, `AppItemsSection.tsx`,
  `AppSchedulesSection.tsx`, `ScheduleSheet.tsx`, `AppSettingsSections.tsx`.

## 3. Diferencias APK vs web

- El formulario es una hoja de abajo en el APK y un diálogo en la web. En la computadora, un
  formulario con lista o selector largo abre el diálogo ancho (`isWideForm`).
- Fechas: `DateField.tsx` usa el selector nativo en el APK. La web usa su propio campo.
- La galería en un campo de fotos usa `galleryPick.ts` en el APK.
- En el APK una respuesta «Solo tú ves esto» de un hilo queda detrás del hilo. En la web sale en la barra.
- El APK tiene `QuickActionsSheet.tsx` para el ⚡ del chat. La web lo resuelve en `ChatQuickActions.tsx`.
- Las reglas (qué se dibuja, cómo se valida, qué se envía) son las mismas: viven en `shared/`.

## 4. Historia reciente

- **23/10** Comandos «/» por app con respuesta en el cuerpo o después. «Enviar al canal».
  Formularios, ⚡ del espacio, avisos por tema y habilitar por lugar. `x-visible-if`.
- **23/10** Firma con cámara en vivo y ubicación del momento. «Conecta tu cuenta» dentro de Lilachat.
- **24/10** Listas largas con buscador, PIN oculto, varias fotos, cámara trasera, fechas con selector.
- **25/10** La respuesta tardía de un formulario viaja en la misma llamada (fin de «No se pudo confirmar»).
- **28/10** Comandos y horarios: todo apagado, «Quién puede usarlo», reportes a una hora.
  Listas de ítems, dos campos por fila, `x-avatar`, «Solo tú ves esto» como chips.
- **30/10** Formularios vivos: varias opciones, miniaturas, filas fijas, refresco y resumen.
- **01/11** Botón «/» en canales y en el chat con la app.
- **04/11** El manifiesto sugiere `audience` para cada acción.
- **05/11** Un botón corre una línea. Las filas funcionan en un hilo. `nothing_to_report`.
- **06/11** Casilla `boolean`. Lo que el lugar ya sabe no se pregunta. Subir al Drive del servicio.
- **09/11** El resumen ya no tapa el formulario. Fotos del formulario en grande.
- **12/11** Lista con casillas, refresco al toque en una elección, la cámara del informe ofrece galería.
- **13/11** Reparto inteligente de montos (gst-02 v2), «Revisar gasto» con secciones plegadas,
  `x-cards` (pla-02), dónde y cuándo se tomó cada foto.
- **15/11** La fila de una respuesta que solo vi yo corre como fila de la app.
- **17/11** Campo de correo (`x-keyboard: email`), mensaje sugerido con párrafos, y el refresco deja
  pasar los `default` nuevos donde la persona no tocó.

## 5. Diseños de Stitch relacionados

| Diseño | Estado | Evidencia |
| --- | --- | --- |
| e-20 comandos con barra | Implementado | `CommandPanel.tsx` web y APK |
| e-28 / e-32 marcar asistencia | Implementado | `SignerPicker.tsx`, `LiveSelfie.tsx`, `useLiveSigning.ts` |
| e-29 «+» con acciones | Implementado | `AppActionList.tsx` (web, cita e-29), `AppActionRows.tsx` (APK) |
| e-30 ⚡ del espacio | Implementado | `SpaceQuickActions.tsx` web y APK |
| e-31 avisos por tema | Implementado | `NoticeTopicsSection.tsx` web; `AppSettingsSections.tsx` APK |
| e-35 selector con buscador | Implementado | `SearchableChoice.tsx`; `appFormFields.searchable.test.tsx` |
| c-01 efímeras como chips | Implementado | `EphemeralAnswers.tsx`, `shared/src/ephemeralStack.ts` |
| d-01 comandos y acciones | Implementado | `AppCommandsPanel.tsx`, `AppItemEditor.tsx` |
| d-02 programar | Implementado | `ScheduleSheet.tsx` web y APK |
| d-03 horarios | Implementado | `AppSchedulesSection.tsx` web y APK |
| h-01 a h-04 consumo | Implementado | INVENTARIO: «hecho (web + OTA)»; `appFormDialog.consumption.test.tsx` |
| gst-02-completar-v2 | Implementado | `appFormDialog.expense.test.tsx`, `appFormDialog.review.test.tsx` |
| gst-02-completar (v1) | No implementado | Nunca se generó: Stitch cortó por tiempo (INVENTARIO) |
| pla-02 tarjetas con dibujo | Implementado | `RichChoiceFields.tsx`; `appFormDialog.cards.test.tsx` |

## 6. Pendientes y deuda conocida

- **`shared/src/appForms.ts` pasa el tope de 600 líneas (607).** Verificado en código.
  El próximo cambio ahí obliga a partirlo.
- **Migración «todo apagado».** El script existe y no corre solo. Según la memoria de las sesiones,
  José lo corrió en producción el 28/10, con `registrar_asistencia` encendido en Constroad e Inframaq.
  No verificable desde el repo. Un «No tienes permiso para usar /x aquí» es lo esperado.
- **Visita técnica en Constroad.** Según la misma memoria, encendida solo en el ⚡ del espacio y solo
  para admins (16/11). No verificable desde el repo.
- **Clientes viejos.** Un APK sin OTA rechaza el formulario entero si trae `type: boolean`, y una APK
  anterior a la 0.1.168 no abre `x-input: pin`. Según spec. La app debe esperar la OTA en la calle.
- **El detalle de un tanque no corre filas con comando.** Decisión de diseño (spec §c-duodecies-bis).
- **Respuestas del ⚡ del espacio sin filas que corran.** No tienen un chat donde correr. Según spec.
- **APK sin tests unitarios** en `app/src/chat/commands` ni `app/src/spaces/apps`. Verificado.
  La lógica está probada en `shared/` y en la web.
- **Qué responde cada comando** (texto, montos, permisos de la persona en Portal) es de la app.
  Depende de agentes.
- **Contrato de agentes de comandos y horarios** vive en el otro repo
  (`specs/COMANDOS-Y-HORARIOS.spec.md` de agentes). Depende de agentes.

## 7. Pruebas

- Server: `botCommands.test.ts` (16), `botForms.test.ts` (36), `botItemAccess.test.ts` (23),
  `botSchedules.test.ts` (9), `botTopics.test.ts` (9), `botLink.test.ts` (4), `formPhotoPlaces.test.ts` (7),
  `photoStamp.test.ts` (12).
- Shared: `botCommands.test.ts` (39), `appItems.test.ts` (26), `appSchedules.test.ts` (13),
  `appForms.test.ts`, `appFormRows.test.ts`, `appFormSplit.test.ts`, `appFormOptions.test.ts`,
  `appFormLive.test.ts`, `appFormSections.test.ts`, `appFormSteps.test.ts`, `appFormSubmits.test.ts`,
  `appFormKnown.test.ts`, `appFormLists.test.ts`, `appFormPicks.test.ts`, `ephemeralStack.test.ts`.
- Web: `commands.test.tsx` (15), `AppFormDialog.test.tsx` (13), `appFormDialog.review.test.tsx` (19),
  `appFormDialog.expense.test.tsx` (12), `appFormDialog.lists.test.tsx` (10),
  `appFormDialog.consumption|cards|email|workPlace.test.tsx`, `appFormFields.dates|place|searchable.test.tsx`,
  `ChatQuickActions.test.tsx` (4), `useChatCommands.test.tsx` (4), `useAppAnswers.test.tsx` (5),
  `FormSummary.test.tsx` (1), `photoListField.test.tsx` (2), `usePlaceName.test.tsx` (5),
  `spaces/apps/appCommands.test.tsx` (6), `AppCommandsPanel.test.tsx` (2), `appSettings.test.tsx` (8).
- Maestro: no hay un flujo propio de comandos ni formularios en `app/.maestro/`. Verificado.
  (`multiseleccion.yaml` es la selección de chats, no de formularios.)
- Fake: `tools/bots-fake/lilachat-bots-fake.mjs` con `POST /__fake/command` y `GET /__fake/command-responses`.

Las cifras entre paréntesis son casos `it(...)` contados el 17/11.
