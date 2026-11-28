# As-is · Canal del cliente (servicios, cuenta, cobranza, valorización) y tutoriales

> Fecha de corte: **20/11/2026**. Fuentes: código de `main`, `git log` desde el 21/10,
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

**Una sola gramática (José 19/11, diseños cc-01…cc-06, `shared/src/serviceShell.ts`).** Desde 768 px
(`SHELL_WIDE_MIN_PX`, tablet y computadora) las pestañas del canal se quedan al abrir un servicio. En
el celular el servicio ocupa la pantalla con su flecha atrás (`serviceTakesScreen`). En el celular,
quien tiene Checklist y Pendientes ve una sola pestaña «Checklist» con el segmentado «Pendientes ·
Plan» (`channelTabsFor`, `checklistHoldsPending`); quien no tiene Checklist conserva su pestaña
«Pendientes». Quién ve cada pestaña no cambia (`channelTabs`).

### Servicios (cc-01)

- Sin cabecera (la pestaña ya dice «Servicios»; José 28/11). Un solo botón ⋮ de 44 dp en la fila de
  «Buscar servicio» (`menu-canal-cliente`; solo, a la derecha, si no hay buscador) abre una hoja chica
  (APK) o un menú (web) con «Enlace del cliente», «Accesos del canal» con «Todos ven el canal; los
  montos, solo los admins» o «N con acceso restringido» (APK; solo admins del espacio) y «Drive del
  cliente» (`clientChannelMenuOf`, `channelAccessLine` en `shared/src/clientAccess.ts`). Sin nada que
  ofrecer, no hay botón. En la web «Accesos del canal» sigue en la info del canal, «Miembros».
- Buscador y segmentado «Abiertos · Completados · Todos» con su número; «Rechazados» solo si hay uno
  (`serviceSegmentsOf`).
- Una tarjeta por servicio con borde de color por estado, estado, avance, inicio y «Enlace del servicio».
  Desde 768 px es una fila con columnas: nombre e «Inicio 12 nov · 6 etapas», estado y avance, PEDIDOS,
  INFORMES y ÚLTIMO MOVIMIENTO («Hoy 09:40 · Observación Parche 12»). En el celular, la tarjeta suma la fila
  «2 pedidos · 3 informes · Hoy 09:40» y la barra «Último movimiento: … ›» (web `ServiceCardWeb.tsx`, APK
  `ServiceCard.tsx`; motor `shared/src/serviceFacts.ts` › `serviceCardFacts`).
- Sin bloque «Pendientes» arriba (José 27/11: «no tiene sentido si tenemos un tab de checklist»): se quitó
  el bloque del diseño cc-01 móvil, `PendingBlock` y `pendingPreview`. Las tareas viven en Checklist (o en
  Pendientes para quien no tiene Checklist).
- Las cifras llegan en `SpaceClientService` (José 19/11): `ordersCount`, `reportsCount`, `stagesTotal` y
  `lastActivity` (ver `bots-api-y-tarjetas.md`). Un servicio sin datos llega 0/0/0 y muestra 0. Si un Portal
  viejo no las manda, la columna dice «—» y el celular oculta la fila: nunca se inventa una cifra.

### Un servicio

- **Cabecera única** en las 4 secciones (cc-02): en tablet y computadora «‹ Servicios», el
  kicker «SERVICIO · CLIENTE», el nombre con su estado, la línea «Avance N % · Etapa: … · 6 etapas · Inicio
  12 nov» (`serviceHeadLine`; las etapas del mapa, `stagesTotal`) y su barra; a la derecha «Enlace del servicio» y «⋯» (Abrir en el
  Portal). En el celular, en TODAS las pestañas, una sola fila (auditoría 20/11, ped-v2): flecha atrás,
  nombre y debajo «CLIENTE · 40 %» (`serviceSlimLine`), enlace y «⋯»; sin chip de estado ni barra. Sin migas (se quitó
  `ServiceCrumbs`). BACK de Android vuelve a Servicios.
- **Una sola barra subrayada** (`serviceTabs`): Pedidos N · Informes N · Mapa · Drive; el número
  va aparte (`ServiceTabItem.count`). La barra en sí nunca lleva botones de una sección (auditoría
  20/11: «Crear informe» y Pegar/cámara/Subir la empujaban a una segunda fila en computadora):
  «Crear informe» es UN botón ancho al tope de la lista de Informes (José 28/11: «se siente duplicado»;
  ni píldora en la barra ni «Generar informe de servicio» aparte), Pegar/cámara/Subir en la de Drive (ambas en
  el contenido, bajo la barra de pestañas); Capas, Editar croquis, Más, Compartir y Registrar
  flotan sobre el lienzo del Mapa. Web: `ServiceShellWeb.tsx` sigue exportando `SectionActions`
  (sin uso hoy) para una acción futura que de verdad quepa en esa fila.
- Pedidos como tarjetas (ped-v2, José 20/11, `shared/src/serviceOrderCards.ts`). Cabecera:
  producto (o «Pedido» si Portal no lo manda) · cantidad · día, la obra debajo y el estado
  (`OrderCard.heading`, `site`). Sin código de pedido: Portal no lo manda en el detalle.
- Resumen del pedido (`OrderCard.summary`): «N despachos · X / Y m³ · N medios» y una barra.
  La barra suma los m³ de los despachos en la unidad del pedido o sin unidad (`orderProgressOf`);
  sale solo si el pedido trae cantidad, con tope en 100 %. Sin despachos: «Sin despachos todavía».
- Despachos en filas finas ordenadas por hora; sin hora van al final (`byHour`). Celular: hora
  sobre m³ | camión y placa | miniaturas. Desde 640 px, tabla Hora · Unidad · Volumen · Fotos y
  videos; sin medios dice «Sin fotos». Tocar la fila abre la ficha del despacho con la grilla de
  fotos y videos (`RecordSheet`); tocar una miniatura abre el visor, no la ficha. «Cubicaje» abre
  la ficha del pedido.
- Sin acción «Foto» en el despacho: Lilachat no tiene camino para subir fotos a un despacho.
- El bloque «Etapas · N de 5» sigue arriba (solo admins): siempre trae las líneas de cada etapa.
- **Miniaturas del despacho** (José 20/11). Caben 3 en el celular (< 768 px) y 5 en tablet y
  computadora (`DISPATCH_THUMB_SLOTS`, `dispatchThumbSlotsFor`). Con más, el último lugar es «+K»
  (`dispatchThumbs`). Un video muestra su cuadro con el botón de play, o el ícono de video sin cuadro
  (`FileThumb`, el mismo de la ficha). Tocar cualquier miniatura o «+K» abre el visor con TODAS las
  fotos y videos del despacho (`OrderCardDispatch.media` = `dispatchMediaOf`, sin tope; el parser
  guarda hasta 20). En el APK las filas ya muestran las miniaturas (antes, `Image` de RN sin
  `mimeOf`: no salía ninguna).
- Informes por día en tarjetas con ícono, «Creado por», estado y «PDF».
- Informes agrupados por día de Lima, del más nuevo al más viejo; «Creado por …».
- «Crear informe» en el APK y la web angosta ofrece los tipos de la página pública de Portal y todos se llenan aquí (18/11, `fieldPickerReportTypes`). La aprobación de adicional (APR-ADI) sale solo a quien ve la plata. Detalle por tipo en `obra-informes.md`.
- En el control de pista, una línea sobre las unidades dice que la foto de unidad vacía cierra la unidad y le da su número de colocación (`UNITS_CLOSE_HINT`, 18/11). La tarjeta de una unidad cerrada dice «Colocación N° X» bajo la placa (`placementOf`).
- **«Terminar unidad»** (19/11). Las fotos de una unidad salen al grupo del cliente solo con este botón, que ve cualquier miembro del canal, en borrador o publicado (José 19/11 noche: «que sea para todos»).
  - Antes de enviar, una revisión (web `UnitAlbumDialog`, APK `UnitAlbumSheet`) muestra todas las fotos marcadas. La persona desmarca las que no van, y una miniatura rota queda fuera sola.
  - Las fotos van a la herramienta de Portal `enviar_fotos_de_unidad`.
  - El botón dice «Enviar fotos al grupo» en una unidad cerrada y «Reenviar fotos» una vez enviadas.
  - Detalle en spec INFORMES-DESDE-LILACHAT §24.
- **Cola de descarga** del control de pista (20/11, diseños pv2-01…pv2-04, spec §25).
  - Arriba va la unidad que descarga, en su tarjeta: 4 fotos con su dato, «Tomar …» y «Terminar unidad» de 40 px.
  - Debajo va la cola que ordena la persona: «Siguiente ↑» en web y APK; en la web también se arrastra.
  - Estados: Enviada, Terminada, Descargando, En cola y En camino (con «Llegó»).
  - Desde 1024 px (web) o 900 dp (APK), la cola va a la izquierda y la unidad a la derecha.
  - El orden lo guarda el server de Lilachat y todos los teléfonos ven el mismo.
  - Si la unidad anterior no tiene la foto de unidad vacía, la revisión se bloquea con «Ir a PLACA».
  - Temperatura y escantillón se escriben bajo la vista previa de su foto.
  - «Ver PDF» tiene ancho fijo.
- Una sección repetida sin filas dice «Sin zonas todavía» y «Toca «Agregar zona» para empezar.» (`emptyItemsHint`): nombra el botón, no la fila, porque la palabra puede ser femenina.
- Inicio del servicio como día (`started_at`, «Inicio 6 oct»), sin zona horaria.
- **Enlace del servicio** («Crear enlace», kind `service_link` → `crear_enlace_de_servicio`):
  se abre sin cuenta de Portal (07/11). Desde el 20/11 el botón de la cabecera abre su hoja sobre el
  servicio, sin ir al chat (José: «solo me lleva al chat y no hace nada»): vigencia 7, 30 o 60 días
  o «No expira», «Crear enlace», y el enlace con «Copiar» y «Compartir». Va por la puerta del mapa
  (`serviceLinkSender` → `createServiceLink`, `shared/src/serviceShareLink.ts`), con el formulario ya
  respondido (`dias`, `noExpira`). Web `ServiceLinkSheetWeb.tsx`, APK `ServiceLinkSheet.tsx`. El
  botón sigue saliendo solo con `links.can('service')`. La tarjeta del servicio en la lista todavía
  abre el atajo del chat (`links.open`).
- **Botones de PDF de un informe** (20/11): mientras Portal lo hace dicen «Preparando…» con spinner,
  en una línea que se recorta antes de salirse (antes «Pidiendo el PDF…» y «Generando el PDF…» se
  salían). Web `PdfLabel` (`RecordSheetWeb.tsx`), APK `PdfLabel` (`RecordSheet.tsx`); en la ficha,
  el informe publicado y la vista previa del borrador.
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
  Los dibujos se ven como en el croquis de Portal (`MAP_MARK_TYPES`, mismos colores en hex):
  un elemento es una ficha blanca de 32 px con aro de 2,5 px del color de su tipo y un punto de
  ese color al centro; su etiqueta (tinta oscura, halo blanco) va debajo desde el zoom 16. Las
  áreas y flechas, en el color de su tipo. Diferencias con Portal: el punto reemplaza al ícono
  del tipo (MapLibre no tiene esos íconos) y la etiqueta no lleva borde de color. Los dibujos de
  Portal no tienen fotos (`work_map_marks`: forma, tipo, nota, autor, origen); en Portal las
  fotos (antes/después) se suben a las OBSERVACIONES. Por eso la tarjeta de un dibujo suma las
  observaciones en su mismo punto (`observationsAtMark`: a ≤ `SAME_POINT_RADIUS_M` = 3 m de su
  centro, la más cercana primero): una línea «texto · estado» por cada una y sus fotos, hasta
  `MARK_CARD_PHOTOS_MAX` = 6 miniaturas que abren el visor. Sin fotos, la línea va igual y no hay
  fila de fotos. Un pin de observación justo sobre un dibujo no lo tapa: pasar el mouse o tocar
  ahí abre la tarjeta del dibujo (`mapPickOnMap`); desde la lista «Observaciones» la observación
  abre su propia tarjeta. Portal manda todas las observaciones del servicio, internas incluidas
  (José 19/11: las fotos que sube al mapa de obra en Portal se ven aquí), menos las de otro cliente.
- **Web** (`web/src/spaces/clients/workMap/MapCardPopup.tsx`, `MapCardView.tsx`,
  `WorkMapItems.tsx`): las observaciones son pines (rojo pendiente, verde levantada).
  Cada observación pendiente de la lista lleva «Levantar» (APK y web, José 27/11): abre «Levantamiento de
  observaciones» directo en ella (`ServiceDetailView` → `ObservationsScreen` con `lift`; ver `obra-mapa.md`).
  «Definir área de trabajo» (editor de calle, José 27/11): en el teléfono el mapa ocupa casi toda la pantalla
  (franja compacta, ±10 m sobre el mapa, formulario plegable; panel lateral girado o en tablet) y los extremos
  vuelven sobre la línea en cada arrastre. Detalle en `obra-mapa.md`.
  Pasar el mouse por un dibujo u observación abre su tarjeta (Popup de MapLibre); un clic la
  deja abierta con «Cerrar»; un clic en el mapa vacío la cierra. Las miniaturas abren la foto
  en el visor de Portal. El panel suma «Dibujos» (por tipo, con conteo) y «Observaciones»
  (pendientes primero, con su estado y fotos); tocar una vuela el mapa ahí y abre la tarjeta.
  Sin calles, «Avance de la obra» dice solo «Todavía no hay calles con tramos.».
- **APK** (`app/src/spaces/clients/workMap/MapCardView.tsx`, `WorkMapItems.tsx`): el mapa
  chico no toma toques; en el mapa completo tocar un dibujo u observación abre su tarjeta
  sobre el mapa (ancho máx. 440, sirve apaisado y en tablet), con «Cerrar» y miniaturas que
  abren el visor de archivos. Bajo el panel van «Dibujos» y «Observaciones»; tocar una abre
  el mapa completo centrado en ella con su tarjeta. Una observación sin lugar muestra la
  tarjeta en el panel.
- **«Editar croquis»** (19/11, web y APK, todo miembro con el mapa): abre el editor de croquis
  del servicio de Portal (`/embed/service-croquis/<id>#t=…`, lista blanca en
  `shared/src/portalEmbed.ts`) en el mismo marco que el croquis de una visita (iframe en web,
  WebView en el APK). El enlace lo da `abrir_croquis_de_servicio` de agentes por la puerta del
  mapa (`kind: 'service_croquis'`, `server/src/bots/workMapForms.ts`; `shared/src/serviceCroquis.ts`),
  12 h, nunca se guarda ni va a un mensaje. Al cerrarse el editor se vuelve a leer el mapa.
  Si agentes responde sin enlace (herramienta aún no aprobada) dice «El editor de croquis
  todavía no está habilitado.»; sin red, «No se pudo abrir el editor de croquis. Prueba de nuevo.».
  También sale en «Todavía no hay calles», bajo «Importar».

### Cuenta, cobranza y valorización (solo quien ve montos)

- «Cuenta» es el único lugar con plata (José 05/11). «Cobranza por servicio» lista
  primero lo que se debe, por urgencia (`collectionByService`). Cada servicio abre su
  Cobranza con «Registrar pago».
- Cuenta del cliente (f-08): todas las cotizaciones y pedidos a crédito, vencido primero.
- **Valorización = informe de servicio** (José 31/10). Se quitó la pestaña
  «Valorizaciones». «Informe de servicio», primer tipo de «Crear informe» para quien ve montos y si el
  espacio ofrece la acción (`withServiceReport`, `SERVICE_REPORT_PICK`; corre `informe_de_servicio` desde el
  espacio, `useSpaceActionRun`), crea la liquidación **LIQ-SRV**
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
- **Fila de Pendientes (José 19/11, cc-06):** casilla para marcar y botón de cámara para subir evidencia sin abrir
  el detalle, solo donde `taskActionsFor` deja marcar. La foto va por la misma puerta que el detalle: web
  `attachEvidenceWeb` (achicada al estándar de Portal; en el celular el selector abre la cámara), APK
  `attachEvidence` con `source: 'camera'` (la cámara de la app con su sello; el server la achica una vez al
  quemar el sello). Web `chat/workPlan/WorkListsWeb.tsx` › `PendingRowWeb`, APK `WorkListsPanels.tsx` › `PendingRow`.
- Recordatorios por tarea (`ChecklistItem.advance`) y el interruptor del espacio
  «Avisar a los responsables de tareas» (`Workspace.taskNotices`, apagado por defecto).

### Accesos y archivados

- Accesos por miembro (`ClientAccess`): `services` y lectura de marcas viejas. Las apps
  instaladas no salen en Accesos ni como responsables.
- Archivados: regla por antigüedad del último pedido, buscador por nombre o RUC (f-02, f-03).

### Web/PWA

`web/src/spaces/clients/`: `ClientsSection.tsx`, `ServiceShellWeb.tsx` (cabecera, barra, `SectionActions`,
`useCompactShell`), `ServiceListsWeb.tsx` (tarjetas de pedidos e informes), `ServiceDetailWeb.tsx`,
`ClientAccountWeb.tsx`, `ServiceCollectionWeb.tsx`, `ServiceBillingWeb.tsx`,
`ServiceStagesWeb.tsx`, `ClientAccessWeb.tsx`, `ClientPickerWeb.tsx`, `ArchivedClients.tsx`,
`RecordSheetWeb.tsx`, `SpaceActionButtonWeb.tsx`, `ClientChannelParts.tsx`,
`useSpaceClients.ts`, `useServiceAsk.ts`, `useSpaceAction.ts`, `useReportPdf.ts`, `ServiceLinkSheetWeb.tsx`.

### APK

`app/src/spaces/clients/`: `ClientsSection.tsx`, `ServiceShell.tsx` (cabecera y barra), `ServiceLists.tsx`
(tarjetas de pedidos e informes), `ServiceDetailView.tsx`,
`ClientAccountPanel.tsx`, `ServiceCollectionView.tsx`, `ServiceBilling.tsx`,
`ServiceStages.tsx`, `ClientAccess.tsx`, `ClientPicker.tsx`, `ArchivedClientsScreen.tsx`,
`RecordSheet.tsx`, `SpaceActionButton.tsx`, `ClientChannelParts.tsx`, `useSpaceClients.ts`,
`useServiceAsk.ts`, `useSpaceAction.ts`, `useReportPdf.ts`, `ServiceLinkSheet.tsx`.

APK y la gramática de 19/11: el teléfono (ancho < 768 dp o alto < 500 dp, `serviceTakesScreen`, así un
teléfono apaisado sigue igual) abre el servicio a pantalla completa con flecha; la tablet deja la cabecera
del chat y las pestañas del canal arriba (`ChannelWorkTabs.tsx`, `useWindowDimensions`). «Crear informe» va al
tope de la lista de Informes, como en la web (28/11). **Diferencia con la web:** RN no tiene portales, así que Pegar, cámara y Subir siguen
en la cabecera del Drive y las acciones del mapa en su barra, justo bajo la barra de pestañas. Checklist con
«Pendientes · Plan» en el teléfono: `chat/workPlan/ChecklistSegments.tsx`.

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

- Quitar una foto del informe desde el visor (27/11) pregunta con el diálogo propio de la app (`useConfirm`,
  sobre el visor), no con `window.confirm`. `ViewerRemoval.remove` es asíncrono: el visor se cierra al confirmar.

## 3. Diferencias APK vs web

| Tema | Web/PWA | APK |
| --- | --- | --- |
| Servicio a pantalla completa | Solo bajo 768 px; arriba, pestañas del canal visibles | Solo en teléfono (< 768 dp) |
| Volver | «‹ Servicios» o flecha | «‹ Servicios» o flecha, y BACK de Android |
| Acciones de sección | En la barra (portal) | Ver § APK |
| Informes en la web ancha | Editor 2.0 de Portal | Formulario propio |

## 4. Historia reciente

- **26/11** · **Sin señal** (José, obra en Aucallama): el detalle y el Drive de un servicio quedan en el teléfono y se abren sin red con «Sin señal · datos guardados el …» y «Reintentar»; abrir «Servicios» con señal precarga los servicios abiertos (hasta 8, copias de más de 6 h). Reemplaza «el Detalle no se guarda» del 30/10. El error sin copia trae «Reintentar». La pestaña «Servicios» de un chat abierto sin pasar por la lista del espacio lee las listas guardadas de todos los espacios. Detalle en `plataforma-sin-senal.md`.
- **25/11** · La tarjeta «INFORME» del canal (agentes `service.record`, sin enlace) trae «Abrir informe»: abre el servicio en «Informes» con ese informe encima, como un toque en su fila (en la web ancha, el lienzo 2.0; si no, su hoja o el borrador). Al cerrarlo se queda en «Informes». La tarjeta no cambió: Lilachat lee `clientRef` (`serviceId`, `recordId`) del mensaje con `reportCardTargetOf` (`shared/src/spaceClients.ts`), así que vale también para las tarjetas viejas. `OpenServiceContext` (web) y `openService` (APK) aceptan `reportId`; `ServiceDetailWeb`/`ServiceDetailView` reciben `startReportId`. Una tarjeta de plata (liquidación, valorización: `isMoneyRecord` por el título) no trae el botón para quien no ve montos (José 25/11: «solo administradores»): `reportCardTargetOf(card, ref, seesMoney)`, con `SeesMoneyContext` (web) y `seesMoney` de `AccionesDeTarjeta` (APK) desde `access.money`.
- **25/11** · Verificado contra producción, por el camino real (Lilachat → agentes → Portal) con un miembro común del canal CONSORCIO EL ALMIRANTE y sus 2 liquidaciones del 24/11: no están en su lista y Portal niega su PDF, su vista previa y su editor (`reportAccessRefusal`, `moneyRefusalOf`); los admins sí las abren. Lilachat muestra ese rechazo con el texto genérico «Este informe ya no está en el Portal.». La tarjeta sí la ven todos: no se oculta por persona.
- **25/11** · E2E de «Abrir informe» en el APK: la hoja de la liquidación en borrador decía «No se pudo traer el PDF del informe». Pedía el PDF final, que un borrador no tiene. Ahora la hoja de un borrador pide la vista previa de Portal (`pdfPreview`, `isDraftStatus` en `shared/src/serviceDetail.ts`), en web y APK, igual que «Ver PDF» del documento.
  En el APK la vista previa llegaba pero no se mostraba: `ServiceLists` no pintaba `reportPdf.viewer`. Ahora la abre `ReportPreviewScreen` encima de la hoja.

- **20/11:** José, de nuevo, nombre de obra cortado a una línea en la cabecera
  del Mapa de obra («cabecera-servicio-mapa», `ServiceShell.tsx` y
  `ServiceShellWeb.tsx`, las tres variantes compacta/ancha): ahora 2 líneas.
  La fila sigue siendo UNA sola fila por diseño (mapa-v2); lo que cambia es que
  el nombre ya no se corta cuando es largo.
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
- **19/11** · Observaciones de Portal (`workObservations`) en el mapa, y la tarjeta de cada dibujo con su tamaño y las distancias a los más cercanos, calculadas de las coordenadas (`shared/src/workMapCards.ts`). Web: tarjeta al pasar el mouse o al hacer clic, y listas «Dibujos» y «Observaciones» en el panel. APK: tarjeta al tocar en el mapa completo y las mismas listas bajo el panel. Botón «Editar croquis» (editor de croquis del servicio de Portal) en web y APK.
- **19/11** · «Terminar unidad» en el control de pista. Las fotos de la unidad salen al grupo solo después de revisarlas; cualquier miembro las envía (web y APK, `shared/src/unitAlbum.ts`, tool `enviar_fotos_de_unidad`; spec §24).
- **19/11** · La tarjeta de un dibujo muestra las fotos de la observación en su mismo punto (≤ 3 m), con su línea «texto · estado»; un pin sobre un dibujo abre la tarjeta del dibujo (web y APK, `shared/src/workMapCards.ts` › `observationsAtMark`, `mapPickOnMap`). José, El Almirante · parches Jr. Conchucos: 30 observaciones «Bache o falla · Parche N» en los mismos puntos que los dibujos.
- **19/11** · **Una sola gramática del canal y del servicio** (diseños cc-01…cc-06): pestañas del canal fijas
  en tablet y computadora, cabecera única y una barra Pedidos · Informes · Mapa · Drive con las acciones a la
  derecha; pedidos como tarjetas con sus despachos; Servicios con segmentado y, en el celular, el bloque de
  pendientes; Checklist con «Pendientes · Plan» en el celular (`serviceShell.ts`, `serviceOrderCards.ts`).
- **19/11** · Tarjeta de servicio como cc-01 con pedidos, informes, etapas y último movimiento que manda Portal
  (`serviceFacts.ts`); Pendientes con casilla y cámara por fila (cc-06); Drive y «Medios» con la hoja inferior de
  cc-05 en el celular y «Enlace copiado» flotante.
- **20/11** · Despachos con todas sus fotos y videos en el visor, «+K» y miniaturas en el APK;
  «Preparando…» en los botones de PDF; «Enlace del servicio» crea el enlace en su hoja, sin ir al chat.
- **20/11** · Pedidos como ped-v2 (aprobado por José): resumen con barra de m³, despachos por hora en
  filas finas (tabla en escritorio) y la fila abre la ficha del despacho con sus medios.
- **20/11** · cc-01 contra Stitch: título de 28 px, segmento activo blanco con acento en escritorio,
  buscador y segmentado como dos controles en el móvil, tarjeta con sombra (escritorio) o borde de 1,5 px.
- **20/11** · cc-02: «Ver pedido ›» en cada pedido, «Pedidos asociados al servicio (N) · Total» en el móvil
  (`ordersTotalOf`, suma por unidad), tarjeta con sombra en escritorio y fila de despacho de 44 px.
- **20/11** · «Ver en Lilachat» (José, `BOTS-API.spec.md` §c-duotricies): una acción de tarjeta con
  `open: { route: 'service' }` abre el servicio en «Servicios» sin salir de la app ni avisar al bot —
  `OpenServiceContext` (web) y `openService` de `accionesDeTarjeta`/`useChannelWork` (APK), análogo a
  `OrderCardContext`/`openOrderCard` pero por `serviceId` directo (sin esperar los `records`). Pensado
  para que la tarjeta «Servicio nuevo» del canal de cliente lleve un botón interno además del externo a
  Portal; agentes (`serviceCard`) todavía no lo envía.
- **20/11** · José («sigo viendo duplicado el nombre del cliente»): la cabecera de una fila del mapa en TODAS
  las pestañas del servicio, en web ancha y tablet del APK: «‹ Servicios», nombre en una línea, estado, «Avance N %…»,
  pestañas, enlace y «⋯»; sin repetir el cliente. Reemplaza las filas de cabecera de cc-01…cc-05.
- **20/11** · cc-03/cc-05: las secciones del servicio usan todo el ancho del panel (antes, columna de 1024 px).
  Fila de informe de 76 px en escritorio, ícono de 38 px, título de 16 px, estado de 11 px, tarjeta del día de 12 px;
  sin archivo, el estado queda junto al título en el móvil.
- **20/11** · cc-04: «Avance de la obra» cierra el panel del mapa, bajo las listas (mapa-v2-escritorio);
  filas del panel de 10 px; zoom y «mi ubicación» de 44 px en el teléfono (web).
- **19/11** · Los dibujos del mapa toman los colores del croquis de Portal (antes, todos puntos naranjas): ficha blanca con aro y punto del color de su tipo, etiqueta desde el zoom 16 (`shared/src/workMapMarks.ts` › `markColor`, `MARK_CHIP_PAINT`, `MARK_GLYPH_PAINT`), en web y APK.

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
| cc-01 servicios | Implementado: fila con columnas (tablet/computadora) y tarjeta con cifras (celular) | `ServiceCardWeb.tsx`, `ServiceCard.tsx` |
| cc-02 pedidos | Reemplazado por ped-v2 (20/11) | `ServiceShellWeb.tsx`, `ServiceListsWeb.tsx`, `ServiceDetailView.tsx` |
| ped-v2-movil / ped-v2-escritorio-lista | Implementado sin código de pedido (Portal no lo manda) ni «Foto» (sin camino de subida) | `ServiceListsWeb.tsx`, `ServiceLists.tsx`, `serviceOrderCards.ts` |
| ped-v2-escritorio (visor) | Reusa el visor de 755c4767 | `PortalFileViewer.tsx` |
| cc-03 informes | Implementado sin la franja de cifras de abajo (inventada) | `ServiceListsWeb.tsx` |
| cc-04 mapa | Implementado; capas en `workMap/MapLayersPanel.tsx` | ver `obra-mapa.md` |
| cc-05 drive | Implementado sin «Mover a carpeta» (Portal no tiene la herramienta) | ver `obra-drive.md` |
| cc-06 checklist con pendientes | Implementado en el celular | `ChecklistSegmentsWeb.tsx` |

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
- **Shared (20/11):** `serviceOrderCards.test.ts` (miniaturas y «+K»), `serviceShareLink.test.ts`.
- **Web:** `ServiceListsWeb.test.tsx` (miniaturas, «+K», visor con todo), `ServiceDetailWeb.test.tsx`
  (hoja del enlace del servicio), `reports/ReportDocumentWeb.test.tsx` («Preparando…»), `ClientAccountWeb.test.tsx`,
  `ServiceCollectionWeb.test.tsx`, `ClientAccessWeb.test.tsx`, `ClientPickerWeb.test.tsx`,
  `useSpaceClients.test.tsx`, `clients.test.tsx`.
- **APK:** sin tests de render del canal del cliente.
- **Maestro:** sin flujo del canal del cliente.
- **E2E:** el grabador en modo `--ensayo` y los E2E manuales en Test documentados en los specs.
- **27/11** Editor de calle del APK: banda neutra en modo oscuro y punto de «Mi ubicación» (detalle en `obra-mapa.md`).
- **27/11** Campos de metros del APK aceptan decimales (`DecimalInput`; detalle en `obra-mapa.md`).
- **27/11** «A mano» sugiere el nombre de la vía tocada (detalle en `obra-mapa.md`).
- **27/11** Largo escrito en el editor de calle, paleta de 16 colores y sección de trabajos siempre visible en «Capas» (detalle en `obra-mapa.md`).
- **27/11** Selector de color libre de trabajos y «Capas» con todos los trabajos (detalle en `obra-mapa.md`).
- **27/11** «A mano»: aros arrastrables en el inicio y el fin (detalle en `obra-mapa.md`).
- **27/11** «Modo Avance» en el mapa: elegir trabajo, tocar calle, % y «Guardar avance» (detalle en `obra-mapa.md`).
- **28/11** Mapa: lo por aprobar se dibuja punteado, no se registra dos veces, «Deshacer» lo propio y lo rechazado se ve (detalle en `obra-mapa.md`).
- **28/11** Mapa: «Registrar avance» por GPS con aro arrastrable y foto (ma04) y lista «Avances» Hoy/Semana/Todo (ma05) (detalle en `obra-mapa.md`).
- **28/11** Mapa: «Nueva capa» con catálogo de capas y color fijo, «Todas las calles de la obra» y metrado (ma03) (detalle en `obra-mapa.md`).
- **28/11** Mapa por capas (ma01): chips de capa con %, hoja de la capa con m², calles, «Último» y «Registrar avance de <capa>» (detalle en `obra-mapa.md`).
- **28/11** Mapa: una fila de chips compactos, «Capas y leyenda» cerrada hasta su botón flotante, una sola acción «Registrar avance de <capa>», mapa por capa sin punteado gris, y «Marcar a mano» desde/hasta en Modo Avance (detalle en `obra-mapa.md`).
- **28/11** Mapa, rondas 2 y 3: la vista previa de la capa se pliega a su acción, zoom sobre la hoja corta, chips con nombre recortado y desvanecido, capas casi negras con aro claro, y Modo Avance marca el % actual de la calle (detalle en `obra-mapa.md`).
- **28/11** Mapa: «Marcar calles» (ma02) toca varias calles del mapa base, las numera en una lista y «Listo · N calles» las guarda de a una; «Una sola calle» sigue (detalle en `obra-mapa.md`).
- **28/11** «Registrar avance de <capa>» mostraba el mapa vacío (la fila de chips crecía y dejaba el mapa en 0 de alto); arreglado y compactado en APK y web (detalle en `obra-mapa.md`).
- **28/11** Mapa ronda 2: chips antes de «Más», vista previa chica de la capa, controles sobre la hoja, Modo Avance por color de capa y capas oscuras con borde (detalle en `obra-mapa.md`).
- **28/11** Mapa: líneas sólidas del ancho real de la calle, bajo los nombres de las calles; brocha que nunca se pasa del largo de la calle; «Registrar avance» con % por deslizador o escrito (detalle en `obra-mapa.md`).
- **28/11** Informes: un solo «Crear informe» al tope de la lista; «Informe de servicio» es el primer tipo del selector (quien ve montos). Servicios: sin cabecera, un ⋮ junto a «Buscar servicio» con «Enlace del cliente», «Accesos del canal» y «Drive del cliente».
- **28/11** QA del OTA 6744343: en «Registrar avance» el teclado ya no tapa el % (`KeyboardAvoidingView` de keyboard-controller, el mapa cede) y el pie suma el margen del sistema (`useMargenes().pie`; web `env(safe-area-inset-bottom)`), así «Queda pendiente hasta que un admin lo apruebe.» no queda bajo la barra de Android. «Etapas · N de M» sin margen ni borde arriba (quedaba una banda vacía al tope de Informes y Pedidos).
- **28/11** Mapa sin aprobación del avance de campo (cuenta al registrarlo; un admin lo deshace en «Avances»), «capa» pasa a «Trabajo» y «Capas» a «Ver», calles definidas en naranja, brocha sin esperas y las partidas del servicio como trabajos sin paso manual (detalle y cambio pendiente de Portal en `obra-mapa.md`).
- **28/11** QA del OTA d0fbdca7: lo definido y aún no ejecutado (calle o sección) se pinta naranja chillón, opaco y del ancho de la calle, con «Pendiente de ejecución» naranja en la leyenda; el nombre del trabajo usa el ancho de la fila y los miles no se parten; el % de «Registrar avance» se selecciona al enfocarlo. «Agregar foto» a un avance ya registrado, en «Avances» y tras «Registrar sin foto», vía `agregar_foto_a_avance_de_obra` (pendiente de aprobación de José en Agentes; detalle en `obra-mapa.md`).
