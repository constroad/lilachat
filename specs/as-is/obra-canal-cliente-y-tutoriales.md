# As-is · Canal del cliente (servicios, cuenta, cobranza, valorización) y tutoriales

> Fecha de corte: **17/11/2026**. Fuentes: código de `main`, `git log` desde el 21/10,
> `specs/ARCHITECTURE.spec.md` (§155, §157, §160, §169–§181, «La plata… vive en Cuenta»,
> «Un servicio ocupa todo», 06/11), `specs/TUTORIALES-CANAL-CLIENTE.spec.md` y
> `design/stitch/INVENTARIO.md` (f-01…f-08).
> Informes, mapa, Drive, visita e IAA tienen su propio archivo `obra-*.md`.

## 1. Qué es

Un canal por cliente dentro del espacio de empresa. Es el expediente de la obra: chat,
servicios, plata, plan de trabajo y pendientes. Los crea y actualiza Agentes con datos
de Portal (`PUT /api/bots/clients/:clientId`).

## 2. Qué hace hoy

### Pestañas del canal

`channelTabs` (`shared/src/clientAccess.ts`): **Chat · Cuenta · Servicios · Checklist ·
Pendientes**.

| Pestaña | Quién la ve |
| --- | --- |
| Chat | Todos |
| Cuenta | Quien ve montos (`access.money`): admins del espacio y marcados |
| Servicios | Quien tiene `services` o la marca vieja `files` |
| Checklist | Solo admins (`access.admin`) |
| Pendientes | Todos, cuando el canal tiene etapas |

### Un servicio

- Al abrirlo **ocupa todo** (APK `useChannelWork.fullScreen`; web `serviceFull`), con la
  ruta `ServiceCrumbs`: Chat › Servicios › obra. BACK de Android vuelve a Servicios.
- Pestañas (`serviceTabs`): **Pedidos · Informes · Mapa · Drive**. Mapa sale siempre;
  Drive para todo miembro del canal.
- Pedidos con su obra («20 m³ · 6 oct · OBRA GRAU»), despachos dentro del pedido, fotos y
  videos primero, cubicaje plegado.
- Informes agrupados por día de Lima, del más nuevo al más viejo; «Creado por …».
- «Crear informe» en el APK y la web angosta ofrece los tipos de la página pública de Portal y todos se llenan aquí (18/11, `fieldPickerReportTypes`). La aprobación de adicional (APR-ADI) sale solo a quien ve la plata. Detalle por tipo en `obra-informes.md`.
- En el control de pista, una línea sobre las unidades dice que la foto de unidad vacía cierra la unidad, le da su número de colocación y manda juntas al grupo las fotos marcadas (`UNITS_CLOSE_HINT`, 18/11). La tarjeta de una unidad cerrada dice «Colocación N° X» bajo la placa (`placementOf`).
- Una sección repetida sin filas dice «Sin zonas todavía» y «Toca «Agregar zona» para empezar.» (`emptyItemsHint`): nombra el botón, no la fila, porque la palabra puede ser femenina.
- Inicio del servicio como día (`started_at`, «Inicio 6 oct»), sin zona horaria.
- **Enlace del servicio** («Crear enlace», kind `service_link` → `crear_enlace_de_servicio`):
  se abre sin cuenta de Portal (07/11).
- **Etapas del servicio** solo para admins del espacio (07/11, `ServiceStages`).
- «Reporte de servicio» del cliente: página de Portal; Lilachat abre la sección del mapa
  con `?section=map` (`serviceMapPage`, `shared/src/serviceMap.ts`).
- **Mapa de la obra: dibujos y observaciones** (19/11). Lee `workMapMarks` y `workObservations`
  del detalle de Portal (`shared/src/workMapMarks.ts`, `workMapObservations.ts`: lista blanca,
  solo fotos https, tope 200). Con dibujos u observaciones y sin calles igual hay mapa.
  `workMapCards.ts` arma la tarjeta de cada uno: nombre, tipo, nota, tamaño (Ø del círculo,
  lados del rectángulo, área del polígono, largo de la flecha) y los 3 dibujos más cercanos
  («a 35 m de Parche 12», «a 1,2 km de …»), sin botón de medir; y las listas del panel.
  Una observación de tramo (sin `point`) se clava a la mitad de su tramo, sobre su calle.
- **Web** (`web/src/spaces/clients/workMap/MapCardPopup.tsx`, `MapCardView.tsx`,
  `WorkMapItems.tsx`): las observaciones son pines (rojo pendiente, verde levantada).
  Pasar el mouse por un dibujo u observación abre su tarjeta (Popup de MapLibre); un clic la
  deja abierta con «Cerrar»; un clic en el mapa vacío la cierra. Las miniaturas abren la foto
  en el visor de Portal. El panel suma «Dibujos» (por tipo, con conteo) y «Observaciones»
  (pendientes primero, con su estado y fotos); tocar una vuela el mapa ahí y abre la tarjeta.
  Sin calles, «Avance de la obra» dice solo «Todavía no hay calles con tramos.».

### Cuenta, cobranza y valorización (solo quien ve montos)

- «Cuenta» es el único lugar con plata (José 05/11). «Cobranza por servicio» lista
  primero lo que se debe, por urgencia (`collectionByService`). Cada servicio abre su
  Cobranza con «Registrar pago».
- Cuenta del cliente (f-08): todas las cotizaciones y pedidos a crédito, vencido primero.
- **Valorización = informe de servicio** (José 31/10). Se quitó la pestaña
  «Valorizaciones». «Generar informe de servicio» crea la liquidación **LIQ-SRV**
  («Liquidación Final del Servicio»). VAL-SRV y LIQ-SRV entrarán al editor 2.0 después.
- Quién ve montos por cliente: `GET|PUT /api/workspaces/:id/clients/:clientId/billing-viewers`.
- Sin la marca de montos se quitan factura, precio, crédito y pagos de un pedido
  (`withoutMoney`), y los pagos y cotizaciones de las tarjetas (`isMoneyRecord`).

### Checklist por etapas y Pendientes

- El plan de la obra son checklists del canal con número de etapa (siete al iniciar).
  Las tareas de un pedido entran a «Ejecución» por `POST /api/bots/clients/:clientId/tasks`
  (Agentes, `order.created`). Hasta 300 tareas por etapa.
- Leer es de todos; tocar no. Un no admin solo marca su tarea y sube evidencia
  (`stageScopeFor`, `taskActionsFor`).
- Recordatorios por tarea (`ChecklistItem.advance`) y el interruptor del espacio
  «Avisar a los responsables de tareas» (`Workspace.taskNotices`, apagado por defecto).

### Accesos y archivados

- Accesos por miembro (`ClientAccess`): `services` y lectura de marcas viejas. Las apps
  instaladas no salen en Accesos ni como responsables.
- Archivados: regla por antigüedad del último pedido, buscador por nombre o RUC (f-02, f-03).

### Web/PWA

`web/src/spaces/clients/`: `ClientsSection.tsx`, `ServiceDetailWeb.tsx`,
`ClientAccountWeb.tsx`, `ServiceCollectionWeb.tsx`, `ServiceBillingWeb.tsx`,
`ServiceStagesWeb.tsx`, `ClientAccessWeb.tsx`, `ClientPickerWeb.tsx`, `ArchivedClients.tsx`,
`RecordSheetWeb.tsx`, `SpaceActionButtonWeb.tsx`, `ClientChannelParts.tsx`,
`useSpaceClients.ts`, `useServiceAsk.ts`, `useSpaceAction.ts`, `useReportPdf.ts`.

### APK

`app/src/spaces/clients/`: `ClientsSection.tsx`, `ServiceDetailView.tsx`,
`ClientAccountPanel.tsx`, `ServiceCollectionView.tsx`, `ServiceBilling.tsx`,
`ServiceStages.tsx`, `ClientAccess.tsx`, `ClientPicker.tsx`, `ArchivedClientsScreen.tsx`,
`RecordSheet.tsx`, `SpaceActionButton.tsx`, `ClientChannelParts.tsx`, `useSpaceClients.ts`,
`useServiceAsk.ts`, `useSpaceAction.ts`, `useReportPdf.ts`.

### Server

- Lecturas: `…/services/:serviceId/detail` (`client.service.requested`), `…/billing`
  (`need: 'money'`), `/clients/:clientId/account` (`client.account.requested`),
  `…/reports/:reportId/pdf` (`client.report.requested`). Archivos:
  `server/src/bots/clientFiles.ts`, `clientBillingViewers.ts`, rutas en `workspaceRoutes.ts`.
- Canales y servicios desde Agentes: `server/src/bots/botClients.ts`; tareas:
  `bots/botClientTasks.ts`.
- Plan: `server/src/workStageRoutes.ts` (`GET|POST /api/checklists/stages`) y
  `taskEvidenceRoutes.ts` (`POST|DELETE /api/checklists/:id/items/:itemId/evidence`).

### Shared

`clientAccess.ts`, `clientChannels.ts`, `clientAccount.ts`, `clientTasks.ts`,
`serviceAsk.ts`, `serviceBilling.ts`, `serviceDetail.ts`, `serviceDetailSheet.ts`,
`serviceStages.ts`, `spaceClients.ts`, `appFormKnown.ts`
(`withoutKnownFields`: el formulario no pregunta lo que el lugar sabe).

### Dependencias

- **Portal:** datos de servicios, pedidos, informes, cobranza, cuenta y liquidación.
  Portal deja a un miembro sin usuario de Portal ver Detalle y PDF de los 8 tipos
  públicos (`MEMBER_TOOLS`, 8de4995f). Cuenta y Drive siguen cerrados a esa persona.
- **Agentes:** crea los canales, publica tarjetas (las de pago no se publican, 6feb8c1),
  responde las preguntas y firma el rol.

## 3. Diferencias APK vs web

| Tema | Web/PWA | APK |
| --- | --- | --- |
| Servicio a pantalla completa | Quita cabecera, pestañas, banner y compositor | Oculta la cabecera con `display: none` |
| Volver | Ruta de migas | Ruta de migas y BACK de Android |
| Informes en la web ancha | Editor 2.0 de Portal | Formulario propio |

## 4. Historia reciente

- **28–29/10** Checklist por etapas (expediente). Canales por cliente con Agentes,
  Archivados, sección CLIENTES (f-01…f-03). Drive del servicio a pedido.
- **30/10** Detalle del servicio a pedido; cobranza, fichas y archivos dentro de
  Lilachat; quién ve la cobranza; accesos por miembro.
- **31/10** Informes por día, cubicaje plegado, obra del pedido, inicio como día.
  Registrar pago y generar la liquidación. Valorización = informe de servicio.
- **05/11** La plata vive en Cuenta, por servicio.
- **06/11** Un servicio ocupa todo; el Drive vive en él. Checklist solo admins;
  Pendientes para todos; recordatorios por tarea. El formulario no repite lo que el
  lugar sabe. Responsable antes del informe.
- **07/11** La plata solo la ven los admins del espacio; etapas solo admins; el enlace
  de un servicio se abre sin cuenta de Portal; el Drive es de todos.
- **11/11** Observaciones desde el canal, detrás de un interruptor.
- **12/11** Un canal recargado en el teléfono conserva sus pestañas.
- **18/11** SOL-IMP y APR-ADI se crean desde el canal (antes decían «En Portal»); APR-ADI solo con plata.
- **16/11** Hojas de bloques del editor 2.0 solo para quien ve montos.
- **19/11** · «Mapa de la obra» dibuja los dibujos de Portal (gibas, buzones, bocacalles…: `workMapMarks` del detalle, `shared/src/workMapMarks.ts`), en web y APK. Con dibujos y sin calles ya no dice «Todavía no hay calles»: muestra el mapa encuadrado en ellos (José, El Almirante · parches Jr. Conchucos: 33 dibujos en Portal). Un dibujo «Otro» con nota se llama por su nota, como en Portal (`markName`).
- **19/11** · Observaciones de Portal (`workObservations`) en el mapa, y la tarjeta de cada dibujo con su tamaño y las distancias a los más cercanos, calculadas de las coordenadas (`shared/src/workMapCards.ts`). Web: tarjeta al pasar el mouse o al hacer clic, y listas «Dibujos» y «Observaciones» en el panel.

## 5. Diseños de Stitch relacionados

| Diseño | Estado | Evidencia |
| --- | --- | --- |
| f-01 clientes del espacio | Implementado | 14 referencias en código |
| f-02 archivados | Implementado | `ArchivedClients.tsx`, `ArchivedClientsScreen.tsx` |
| f-03 canal archivado | Implementado | 17 referencias |
| f-04 servicio como expediente | Implementado con otras pestañas (Pedidos · Informes · Mapa · Drive); la plata salió a Cuenta | 5 referencias |
| f-05 cobranza del servicio | Implementado dentro de Cuenta | `ServiceCollectionView.tsx`, `ServiceCollectionWeb.tsx` |
| f-06 Drive del servicio | Implementado | ver `obra-drive.md` |
| f-07 canal que nace con la cotización | **Descartado** por José (29/10) | — |
| f-08 cuenta del cliente | Implementado | `ClientAccountPanel.tsx`, `ClientAccountWeb.tsx` |

El inventario todavía dice «falta: espera … de agentes» en f-04, f-05, f-06 y f-08:
está desactualizado.

## 6. Pendientes y deuda conocida (canal)

- Portal no comprueba que la persona esté en el canal: `findAskedService` es la única
  puerta. Si esa comprobación cambia, cambia este caso (según spec, 05/11).
- No marcar con montos a un miembro sin usuario de Portal: Cuenta le da error y Cobranza
  sale vacía (según spec).
- El server todavía manda `quotes` y `billing` a quien ve montos, por los APK sin la OTA.
- VAL-SRV y LIQ-SRV en el editor 2.0: pendiente de Portal (según spec §15).

## 7. Tutoriales del canal de cliente

### Qué hay

- **Catálogo de 11 tutoriales** (`specs/TUTORIALES-CANAL-CLIENTE.spec.md` §2): dibujar
  la calle, etapas y trabajos, tramos, CTL-PIS, confirmar avance, CTL-IMP, avance a mano,
  caminar con GPS, ver la obra, compartir y exportar, el Drive.
- **Buenas prácticas para dibujar el mapa** (§3): primero el lugar, una calle = una vía
  real, recortar, ancho siempre, etapas para el tiempo y trabajos para las capas, avance
  por capas en orden, el avance sale de la evidencia.
- **Motor** `shared/src/tutorialScript.ts` (10 tests): cartel = voz + 250 ms, 12 a 38
  palabras, voseo rechazado, tope de 5 min.
- **Grabador** `scripts/tutorials/record.ts` (+ `overlay.ts`, `steps.ts`, `media.ts`,
  `session.ts`): Playwright, voz `say` (Paulina, 195 ppm), WebM VP9 a 780 px y un `.json`
  de carteles. Levanta la app sin crons. Sesión firmada dentro del proceso, dispositivo
  `tutorial-recorder`, espacio Test. `cameraNames` cambia los nombres de QA.
  `--ensayo` corre el guion como E2E sin voz.
- **Grabados (3):** `guiones/dibujar-calle.ts` (2:18,8), `etapas-trabajos.ts` (4:27,8),
  `tramos.ts` (2:42,2). Los videos quedan en `.tutorials-out/` (ignorado por git).

### Lo que no hay (verificado en código)

- **El visor:** ni la pestaña «Ayuda» del servicio ni el botón «?» en cada pantalla, que
  José eligió el 08/11. No hay referencia en `app/src`, `web/src` ni `shared/src`.
- **El media de tutoriales** de Lilachat: los videos no están subidos a ningún lado.
- **8 guiones** de 11 (del 4 al 11).
- Falta que José vea los videos con sonido (según spec).

### Defectos de la app que encontró el ensayo

- Una calle larga dejaba sus extremos fuera de pantalla: el mapa encuadra la calle al
  tocarla (`pickedStreetFrame`).
- El editor se cerraba sin decir nada: ahora el aviso «Calle guardada» sale sobre el
  mapa (`mapa-aviso`).
- Menores, sin arreglar (según spec): la pregunta de borrar un trabajo queda medio tapada
  por el subtítulo; las pastillas del Control de pista tapan parte de la calle; el
  crédito de OpenFreeMap tapa un cuarto del mapa chico.

### Datos de Test que hacen falta

Un Control de imprimación con fotos ubicadas y dos días de avance aprobado (o-09).

## 8. Pruebas

- **Shared:** `clientAccess.test.ts`, `clientChannels.test.ts`, `clientAccount.test.ts`,
  `clientTasks.test.ts`, `serviceAsk.test.ts`, `serviceBilling.test.ts`,
  `serviceDetail.test.ts`, `serviceDetailSheet.test.ts`, `serviceStages.test.ts`,
  `spaceClients.test.ts`, `appFormKnown.test.ts`, `tutorialScript.test.ts`.
- **Server:** `bots/clientAccess.test.ts`, `bots/clientFiles.test.ts`,
  `bots/botClients.test.ts`, `bots/botClientTasks.test.ts`, `checklistRoutes.test.ts`.
- **Web:** `ServiceDetailWeb.test.tsx`, `ClientAccountWeb.test.tsx`,
  `ServiceCollectionWeb.test.tsx`, `ClientAccessWeb.test.tsx`, `ClientPickerWeb.test.tsx`,
  `useSpaceClients.test.tsx`, `clients.test.tsx`.
- **APK:** sin tests de render del canal del cliente.
- **Maestro:** sin flujo del canal del cliente.
- **E2E:** el grabador en modo `--ensayo` y los E2E manuales en Test documentados en los specs.
