# As-is · Mapa de obra (pestaña «Mapa» de un servicio)

> Fecha de corte: **17/11/2026** (rediseño `mapa-v2` sumado el 20/11). Fuentes: código de `main`, `git log` desde el 06/10,
> `specs/MAPA-OBRA.spec.md` (spec vivo, 1 383 líneas) y `design/stitch/INVENTARIO.md`.
> Lo marcado «no verificado» no se confirmó en el código ni en un E2E.


- **Sin señal (26/11):** el mapa se guarda en el teléfono y se ve sin red; «Registrar avance» con sus fotos sale por la cola de campo. Ver `plataforma-sin-senal.md`.
## 1. Qué es

El mapa literal de la obra dentro del canal del cliente: calles con su eje, tramos
con progresivas, etapas, trabajos (capas), avance y fotos ubicadas. Lo usa el
ingeniero de campo desde el celular y lo mira el cliente desde una computadora.

- **Los datos viven en Portal.** Lilachat lee y escribe por una puerta con identidad
  (decisión de José, 06/11). Nunca guarda calles ni avance propios.
- Regla de fondo: la calle se dibuja una vez. Todo lo demás son eventos con
  progresivas. Nunca un «% por calle».
- El motor de geometría, colores y sumas es el de Portal: paquete
  `@constroad/shared/obra` (v0.16.0 en el último cambio). Lilachat solo adapta formas.

## 2. Qué hace hoy

### Todos los miembros del canal

- Ven la pestaña «Mapa» del servicio, con calles o sin ellas (`serviceTabs` en
  `shared/src/serviceDetail.ts`).
- Ven avance por trabajo, etapa y calle, con fecha de corte («Hasta el 5 nov»).
- Dibujan calles, tramos, etapas y trabajos, y registran avance (José 07/11:
  «para todos»). El avance entra **pendiente de aprobación** en Portal.
- Buscan un lugar o pegan un enlace de Google Maps (`/api/places`, solo Perú).

### Solo admins del espacio

- Confirman el avance sugerido por el Control de pista (o-07).
- Aprueban o rechazan el avance «Pendiente de aprobar».
- Ven «Borrados» y restauran calles, tramos, etapas y trabajos.

### Funciones, una por una

| Función | Diseño | Qué hace |
| --- | --- | --- |
| Leer el mapa | o-01 | Calles pintadas por trabajo, leyenda plegable, norte, zoom, panel de avance |
| Fecha de corte | o-01 | Solo ofrece días con avance; compara `YYYY-MM-DD` como texto |
| Día de colocación | — | Chips por día con color (`useMapDays`, `MapDayChips`); filtra fotos y unidades |
| Capa «Fotos» | — | Marcadores con ícono y placa; el visor recorre todas las fotos del punto |
| Nueva calle | o-02 | Tocar la calle real (sigue la vía), «A mano», o «Caminar GPS»; extremos arrastrables; ±10 m flotando sobre el mapa; ancho y etapa; formulario plegable en el teléfono y panel lateral girado/tablet (27/11) |
| Caminar con GPS | o-13 | Empezar, Pausa, Seguir, Deshacer por partes, Terminar; marcador de posición |
| Ver tramos | o-03 | Calle con su mapa, avance por trabajo y tramos con estado (Pendiente / En proceso / Terminado) |
| Etapas con brocha | o-04 | Crear, renombrar, borrar; «Tocar calles» pinta la etapa sobre cada calle |
| Trabajos con brocha | o-05 | Igual que etapas, con color; una partida del contrato no se renombra ni se borra |
| Registrar avance a mano | o-06 | Calle → trabajo → «Hasta dónde» (±10 m o «Mi GPS») → foto con sello |
| Avance sugerido por unidades | o-07 | Ubica las descargas del Control de pista sobre la calle (`suggestDischarges`) |
| Avance sugerido de imprimación | — | Desde el Control de imprimación (`PrimeCoat.tsx`); usa la herramienta manual |
| Pendiente de aprobar | — | Barra arriba del mapa con Aprobar y Rechazar (admins) |
| Compartir avance | o-08 | Avance parcial por trabajo y calle; enlace firmado con el corte |
| Incluir en el informe | o-08 | Interruptor «Incluir en el informe del servicio» |
| Exportar | o-12 | KMZ para Google Earth, PDF para el cliente, Plano PDF A3/A1, copiar enlace |
| Importar | o-12 | KMZ o KML desde el Drive del servicio; revisa y luego crea calles |
| Borrar calle | — | Para todos, con su pregunta (motor compartido `workStreetDelete.ts`) |
| Borrados y Restaurar | — | Solo admins |
| Servicio sin calles | o-10 | Abre igual sobre fotos y unidades (`EMPTY_WORK_MAP`); si no hay nada, invita a dibujar |
| Encuadre inicial | — | Todas las calles del servicio JUNTO con los dibujos y las observaciones de Portal (José 19/11, OBRA GRAU: el tramo quedaba fuera hasta alejar el zoom). Con una etapa o un trabajo elegidos, solo sus calles. Nunca menos de `WORK_MAP_MIN_FRAME_DEG` (~110 m): un punto solo no abre al zoom máximo (`shared/src/workMap.ts` › `frameOf`) |

### Capas y leyenda (José 19/11, diseño cc-04)

- El panel abre con «Capas y leyenda» y el avance debajo. Partidas (trabajos del mapa) en su color con
  su % y un interruptor; etapas como chips «Todas · Etapa 1…» (el mismo filtro de etapa); dibujos por
  tipo con su número; observaciones «Pendientes» y «Levantadas»; «Fotos». Un interruptor solo oculta
  lo dibujado: las cifras siguen el filtro (`shared/src/workMapLayers.ts`: `viewWithLayers`,
  `visibleMarks`, `visibleObservations`, `layerRowsOf`). «Capas» en la barra pliega o abre la sección.
- (19/11; la leyenda volvió el 20/11 como ⓘ, ver «Rediseño 20/11».) La leyenda plegable y el selector de etapa sobre el mapa se quitaron (los reemplaza el
  panel). Sobre el mapa quedan el corte «Hasta hoy» y el selector de trabajo, que sí cambia las cifras
  y la exportación («Sale lo que ves»). La capa Fotos pasó del botón sobre el mapa al panel.
- **«Fotos» por tipo de informe** (José 19/11, la regla de Portal f080f7c6a): bajo el interruptor de «Fotos»,
  una sub-capa por tipo de informe (Control de pista, Control de imprimación, Área adicional, Fresado,
  Registro y Levantamiento de observaciones…) con su interruptor y su cuenta; la de más fotos primero y
  «Otras fotos de campo» (fotos sin informe) al final. Con «Fotos» apagado no se ve ninguna. Una sub-capa
  apagada sale antes de armar los pines (`shared/src/reportPhotoLayers.ts`: `reportPhotoLayersOf`,
  `photosOfShownReports`, `reportPhotoLayerRows`; nombres de `reportTypeLabel`). Web y APK: `MapPhotos.tsx`
  (`usePhotoLayer`) y `MapLayersPanel.tsx`. Las descargas de unidades no cambian.
- **«Editar croquis» visible en todos los dispositivos:** sobre el mapa (ver «Rediseño 20/11»).

### Rediseño 20/11 (diseños `mapa-v2-movil` y `mapa-v2-escritorio`, aprobados por José)

José 20/11: espacio perdido arriba, el cliente repetido, los días debían flotar sobre el mapa,
«Compartir avance» dentro de «Más» y los botones desordenados en la web.

- **Cabecera de una fila en la pestaña Mapa.** En el teléfono (APK y web angosta) es la de todas las
  pestañas desde el 20/11 (ped-v2): ←, nombre y debajo «CLIENTE · 40 %» (`serviceSlimLine`), enlace y ⋮;
  pestañas más bajas. Web ancha y tablet: «‹ Servicios», nombre, estado, línea y pestañas en la misma
  fila; el cliente no se repite (ya lo nombra el canal). Web: `ServiceShellWeb` con `flush`;
  APK: `ServiceShell` con `slim`.
- **El mapa ocupa el resto y se mueve** (también en el APK: ya no va dentro del scroll del detalle).
- **Flotando sobre el mapa:** chips de día «Todos · Vie 20/11 · 18 …» con su cuenta de fotos y
  unidades (`MapDayOption.count`), y «Hasta hoy ▾» con el selector de trabajo al lado.
- **Teléfono:** columna de botones redondos a la derecha: Capas, Leyenda (ⓘ, si hay trabajos) y ⋮ Más.
  Abajo a la izquierda «Editar croquis» chico y «Registrar»; zoom y GPS abajo a la derecha. La
  leyenda (`mapLegendEntries`) aparece al pie con ⓘ.
- **Web ancha:** un solo grupo segmentado «Capas | Editar croquis | Más» junto a los días;
  «Registrar avance» al lado. Panel a la derecha como tarjeta; leyenda flotando abajo.
- **«Más»** (`mapMoreItems`, `share` y `screen`): «Compartir avance» y «Pantalla completa» (o «Salir
  de pantalla completa») primero; después lo de antes (Nueva calle, Etapas, Trabajos, Exportar, Abrir
  en Portal, Borrados). Los test ids se conservan (`mapa-compartir`, `mapa-pantalla-completa`).
- **El panel en el teléfono es una hoja sobre el mapa** que abre «Capas» y cierra su ✕
  (`mapa-hoja-cerrar`): capas y leyenda, avance, por aprobar, descargas, listas. Se oculta, no se
  desmonta: lo pendiente de aprobar se sigue pidiendo y dibujando. Exportar, compartir, calle y
  borrados abren la hoja solos (web) o su propia hoja (APK).
- El selector de etapa del APK salió de sobre el mapa: está en los chips de «Capas y leyenda».
- GPS («Mi ubicación») en todo mapa web, no solo al dibujar; el navegador pregunta al tocarlo.
- Archivos nuevos: `web/.../workMap/MapFloating.tsx` y `app/.../workMap/MapFloating.tsx`.

### Web/PWA

- Carpeta: `web/src/spaces/clients/workMap/` (41 archivos, `MapLayersPanel.tsx` nuevo). Entrada:
  `web/src/spaces/clients/ServiceMapWeb.tsx`.
- `MapWorkspace.tsx`: la sección va bajo la cabecera y la barra del servicio, de borde a borde;
  desde el 20/11 sus acciones flotan sobre el mapa (ya no van a la barra del servicio).
- Ancho o angosto lo decide el tablero con `ResizeObserver`, no la ventana. Con
  880 px o más el panel va a la derecha (380–400 px). Menos: hoja sobre el mapa que abre «Capas».
- Pantalla completa del navegador; si se niega, una capa sobre la página. Escape sale.
- MapLibre con `maplibre-gl-csp` (worker de nuestro origen). Mapa base OpenFreeMap con
  estilo propio en español. En modo oscuro el mapa base es oscuro
  (auditoría 20/11, mapa-v2): `workMapStyleFor(dark)`, mismas teselas y mismos ids de capa;
  la web repinta al cambiar el tema (`useDarkClass`), el APK cambia `mapStyle` (`useTema().oscuro`).
  Desde el 27/11 (José: «tonos de Waze») `DARK_MAP_PALETTE` usa los colores nocturnos de Portal
  (9abf42a49, `DARK_WORK_MAP_COLORS`): tierra azul marino, calles pizarra más claras y avenidas más
  brillantes, parques verdes, agua oscura y nombres claros con halo. Cubre todas las vistas de mapa
  (`WorkMapSurface`/`WorkMapCanvas`); el «Editar croquis» embebido es de Portal.
- «Levantar» en la lista de observaciones del mapa (APK y web, José 27/11): cada observación pendiente lleva el botón
  (`WorkMapItems › ObservationList`, `onLift` por `WorkMapBoard` → `ServiceMapPanel` → `ServiceDetailView`), que
  abre «Levantamiento de observaciones» (LEV-OBS) directo en ella: `observationToLift` (shared) la busca por id
  o por su texto entre las pendientes del informe; si no está, se ve la lista. En la web (`ServiceMapWeb`/`MapWorkspace` → `ServiceDetailWeb` → `ObservationsWeb` con `lift`) abre la fila de esa observación con su formulario de levantar.
  El trozo del mapa pesa ~256 KB comprimidos y baja al abrir.
- Archivos propios de la web: `WorkMapCanvas.tsx`, `WorkMapOverlays.tsx`, `CutFields.tsx`,
  `useWorkMap.ts`, `maplibre-csp.d.ts`.
- **«Editar croquis» en el editor 2.0 de Portal** (16/11): Portal pide el mapa
  (`edit-croquis`); la web dibuja el mapa del servicio encima del editor. «Volver al
  informe» o Escape avisa a Portal (`croquis-changed`). Archivos:
  `web/src/spaces/clients/reports/PortalEmbedWeb.tsx`, `ServiceDetailWeb.tsx`.

### APK

- **19/11 (cc-04 móvil):** «Capas y leyenda» abre la hoja del mapa (`workMap/MapLayersPanel.tsx`, mismos
  interruptores y chips de etapa que la web); el botón «Capas» va sobre el mapa, bajo «Ver mapa completo».
  **«Editar croquis» va sobre el mapa** como pastilla con su texto (José no lo vio bajo «Registrar
  avance»). La capa Fotos pasó del botón sobre el mapa al interruptor del panel. Los interruptores
  ocultan también en el mapa completo.
- Carpeta: `app/src/spaces/clients/workMap/` (32 archivos). Entrada:
  `app/src/spaces/clients/ServiceMapPanel.tsx`.
- Mapa nativo con `@maplibre/maplibre-react-native`. Es código nativo: llegó con el
  APK 0.1.181 (182). Un OTA no puede sumar módulos nativos.
- Desde el 20/11 el mapa del detalle ocupa el resto de la pantalla y se mueve: va fuera del
  scroll (`ServiceDetailView` lo saca del `ScrollView`). «Más › Pantalla completa» lo abre sin la
  cabecera (`FullMap`). Antes no se movía y «Ver mapa completo» era un botón propio.
- Archivos propios del APK: `WorkMapSurface.tsx`, `MapControls.tsx` (+, −, GPS),
  `CutChips.tsx` (corte en pastillas), `WorkMapFilters.tsx` («Hasta hoy ▾», trabajo y leyenda),
  `MapFloating.tsx` (botones redondos).
- Los marcadores de fotos son capa del mapa, para que el toque funcione (09/11).
- Buscar cierra el teclado (`Keyboard.dismiss`) al buscar y al elegir (12/11).

### Server (`server/src`)

- `POST /api/service-work-map` `{ link, serviceId }` → `{ map }` (`workMapRoutes.ts`).
  Lee `GET /api/public/client-portal/services/[id]?token=` de Portal. El token viaja
  en el cuerpo, nunca en el log. Solo acepta enlaces de `constroad.com`
  (`workMapRequest`). Espera a Portal 7 s (`PORTAL_WAIT_MS`); si no, 502.
- Tope del detalle: 600 KB (`REPLY_MAX_BYTES`). Un servicio real pesó 360 KiB (09/11).
- Escrituras: `POST /api/workspaces/:id/clients/:clientId/services/:serviceId/reports/forms`
  con un `kind`. El server abre un formulario de confirmación hacia la herramienta de
  Portal (vía Agentes, `form.submitted`). Kinds y herramientas:

| Kind (server) | Herramienta de Portal |
| --- | --- |
| `work_street`, `work_street_delete` | `guardar_calle_de_obra`, `borrar_calle_de_obra` |
| `work_scope`, `work_scope_delete` | `guardar_tramo_de_obra`, `borrar_tramo_de_obra` |
| `work_stage`, `work_stage_edit`, `work_stage_delete` | `crear_etapa_de_obra`, `editar_etapa_de_obra`, `borrar_etapa_de_obra` |
| `work_tag`, `work_tag_edit`, `work_tag_delete` | `crear_etiqueta_de_obra`, `editar_etiqueta_de_obra`, `borrar_etiqueta_de_obra` |
| `work_deleted`, `work_restore` | `borrados_de_obra`, `restaurar_de_obra` |
| `work_progress` | `registrar_avance_de_obra` (sugerido por unidades) |
| `work_manual_progress` | `registrar_avance_manual_de_obra` |
| avance pendiente | `avances_pendientes_de_obra`, `resolver_avance_de_obra` |
| `work_progress_link` | `crear_enlace_de_avance` |
| `work_progress_pdf` | `pdf_de_avance_de_obra` |
| `work_map_in_report` | `mapa_en_informe_de_servicio` |
| `work_import` | `importar_calles_de_obra` |

- Formularios: `server/src/bots/workMapForms.ts`, `workStreetForm.ts`,
  `workManualProgressForm.ts`, `workProgressForm.ts`. Despacho: `bots/clientReports.ts`.
- Sin señal: `entradaId` UUID del equipo. Portal tiene índice único
  `{ companyId, entradaId }` y responde `ya_marcada` («Ya estaba registrado»).
- `server/src/placeSearch.ts`: Nominatim con `countrycodes=pe`.

### Shared (`shared/src`)

Motores puros, con test, usados por web y APK:
`workMap.ts` (lectura por lista blanca), `workMapProgress.ts`, `workMapDischarges.ts`,
`workMapDays.ts`, `workMapPhotos.ts`, `workMapStations.ts` (progresivas sobre la vía),
`workMapStyle.ts`, `workMapPanel.ts`, `workMapMenu.ts`, `workMapBrush.ts`,
`workMapExport.ts`, `workMapPartial.ts`, `workMapInReport.ts`, `workStreetPick.ts`
(`pickedStreetFrame`), `workStreetWalk.ts`, `workStreetDraft.ts`, `workStreetDelete.ts`,
`workStreetDetail.ts` (`StretchState`), `workScope.ts`, `workLayerEdit.ts`,
`workManualProgress.ts`, `workPending.ts`, `workPrimeCoat.ts`, `workProgressLink.ts`,
`workProgressPdf.ts`, `workProgressSend.ts`, `workImport.ts`, `workDeleted.ts`,
`workFiles.ts`, `serviceMap.ts`.

### Lo que depende de otros sistemas

- **Portal:** guarda todo, valida de nuevo, arma los PDF (`pdf_de_avance_de_obra`), el
  KMZ en el Drive y la página del cliente (o-09, o-11). Saca la fecha del avance
  sugerido de las fotos de las unidades (`dispatchIds`), no de la confirmación.
- **Agentes:** enruta cada `form.submitted` a la herramienta. Cada herramienta nueva la
  aprueba José.
- **Servicios públicos:** OpenFreeMap (teselas), Nominatim (búsqueda), OSRM (pegado a
  la vía, en Portal).

## 3. Diferencias APK vs web

| Tema | Web/PWA | APK |
| --- | --- | --- |
| Motor del mapa | MapLibre GL JS (CSP) | MapLibre React Native (nativo) |
| Pantalla completa | Del navegador o capa propia («Más») | Pantalla aparte («Más») |
| Cabecera en Mapa (20/11) | Una fila; en ancho con las pestañas | Una fila; pestañas debajo |
| Panel de avance | A la derecha (≥ 880 px) o hoja | Hoja que sube sobre el mapa |
| Fecha de corte | Selector | Pastillas (`CutChips`) |
| Zoom y mi GPS | Control de MapLibre | `MapControls` propios |
| «Editar croquis» del editor 2.0 | Sí (sobre el embed de Portal) | No: el APK no tiene el editor 2.0 |
| Actualización | Deploy de la web | OTA para JS; APK nuevo si cambia lo nativo |

## 4. Historia reciente (06/11 – 17/11)

- **06/11** Inventario de Stitch o-01…o-13. La web dibuja el mapa con pantalla completa.
  APK 0.1.181 (182) con mapa nativo. Motor que ubica descargas del Control de pista.
  Fecha de corte.
- **07/11** Composición o-01 en web y APK. El motor pasa a `@constroad/shared/obra`
  (paridad probada con `workMapPortalParity.test.ts`). Avance sugerido (o-07), solo
  admins. Dibujar calle (o-02), tocar la calle real, borrar calle para todos. Tramos,
  etapas y trabajos (o-03/o-04/o-05). Caminar con GPS (o-13). Avance a mano (o-06).
  Borrados y Restaurar. Avance parcial, Compartir (o-08) y Exportar (o-12): enlace
  firmado, importar KMZ/KML, PDF cliente y plano A3/A1, mapa en el informe.
  Auditoría lado a lado contra Stitch.
- **08/11** Auditoría completa (22 puntos). «Registrar avance» en la barra
  (`progressTargetOf`). Etapas y Trabajos con brocha. Avisos antes de borrar el trazo.
  Progresivas escritas sobre la vía. GPS con pausa y deshacer por partes. Extremos
  arrastrables, capa «Fotos». Buscar lugar o pegar enlace. Renombrar y borrar etapas y
  trabajos. Avance sugerido de imprimación. «Pendiente de aprobar» con Aprobar/Rechazar.
  Mapa base propio en español; el primer toque ya no se pierde.
- **09/11** Barra con «Más», trabajo en selector, leyenda plegable. Marcadores con
  ícono y placa. Placas solo bajo la carpeta asfáltica (reconoce «asfalt», deja fuera
  imprimación y riego). Servicio sin calles: nada sale «fuera de la obra». Día de
  colocación con color.
- **12/11** Buscar trae solo Perú, cierra el teclado; los botones del mapa no tapan la
  cabecera (`overflow-hidden`). La foto del avance usa la cámara nueva con sello.
- **16/11** «Editar croquis» del editor 2.0 abre el mapa sobre el editor (web).
- **19/11** El encuadre inicial suma dibujos y observaciones de Portal a las calles y tiene un tamaño mínimo
  (web y APK, mismo motor `workMapView`). Antes, con calles, los dibujos fuera de ellas no entraban.
- **19/11** «Fotos» se separa en sub-capas por tipo de informe, como Portal (`reportPhotoLayers.ts`).
- **27/11** «Definir área de trabajo» (o-02) en el APK, pedido de José: el mapa era ~30 % de la pantalla.
  Banda violeta de una fila (título + Deshacer y Cancelar como íconos), modos más bajos, ±10 m
  flotando sobre el mapa, y formulario compacto (nombre y ancho en una fila, largo en una línea,
  etapas en una fila que se desliza) que se pliega a «resumen + Guardar calle». Girado o en tablet
  (`useDisposicion().amplia`): mapa a la izquierda y panel lateral de 380 dp. Partes en
  `WorkStreetEditorParts.tsx`. Mismos testIDs; nuevos `editor-calle-plegar`, `editor-calle-resumen`,
  `editor-calle-panel`.
- **27/11** Modo oscuro del editor de calle (APK): la banda era `bg-primary`, que en oscuro es lila
  claro y se veía rosada. Ahora en oscuro es `bg-surface` con texto `on-surface`; en claro sigue
  violeta (`editorBandTone`, `useBandTone` en `WorkStreetEditorParts.tsx`).
- **27/11** «Mi ubicación» (APK, todo `WorkMapSurface`) movía el mapa sin marcar dónde está el
  teléfono. Ahora dibuja el punto azul con halo (capa `work-map-me`, `myLocationDot.ts`) al ubicarse.
- **27/11** Decimales en el APK: «Ancho» del editor de calle, «Desde/Hasta» del tramo y «Hasta dónde»
  del avance manual guardaban «3.10» como «310» (el campo se reescribía desde el número y «3.» volvía
  a «3»). Ahora usan `DecimalInput` (`app/src/ui/DecimalInput.tsx`, motor `decimalText.ts`): guarda el
  texto tecleado, acepta coma o punto. El largo de la calle sigue medido en el mapa (Portal lo calcula).
- **27/11** «A mano» (web y APK, `tapStreetDraft` → `handTap`): el primer toque sobre una vía con
  nombre llena el nombre de la calle si está vacío; lo que la persona escribió se respeta.
- **27/11** Largo escrito (web y APK): junto al largo medido, un campo «Otro» (APK) / «Otro largo (m)»
  (web) con decimales. Si se llena, va como `length_m` → el server lo pasa a Portal como `largoM`
  (`guardar_calle_de_obra`, Portal fe1863f70: guarda `measuredLengthM`, que manda sobre el trazo para el
  área y los tramos). Vacío = el largo del trazo. Rango 0,1 m–20 km (`DRAFT_BAD_LENGTH`). El área del
  formulario usa `streetDraftWorkLengthM`.
- **27/11** Trabajos: la paleta pasa de 8 a 16 colores (los 8 primeros en su orden) y cada color lleva
  borde, porque el casi negro no se veía en modo oscuro. «Capas y leyenda» muestra siempre la sección
  «Partidas (trabajos)»; sin trabajos, explica que se crean en ⋮ › Trabajos (`NO_WORKS_YET`).
- **27/11** Selector de color libre para un trabajo: APK `ColorPicker` (`app/src/ui/ColorPicker.tsx`,
  cuadro de saturación/brillo + barra de matiz en SVG, motor `shared/src/colorPick.ts`) tras el botón
  «Otro color» (pipeta); web, el `<input type="color">` nativo en el mismo botón.
- **27/11** «Capas»: lista TODOS los trabajos (`layerRowsOf(…, map.works)`), también los que aún no
  tienen calles; esos dicen «Sin calles asignadas» (`WORK_NOT_ASSIGNED`). Antes solo salían los que
  tenían tramos.
- **27/11** «A mano» con aros (web y APK): con 2 puntos o más, el primero y el último son aros
  arrastrables (`streetDraftHandles` → `handHandles`; `dragStreetEnd` → `movedHandEnd`). El aro queda
  donde lo suelta el dedo; las curvas del medio conservan su número. Sin «−10 m / +10 m» en este modo.
  Ayuda: «Toca donde empieza y donde termina el trabajo.» y, con 2 puntos, «Arrastra los aros…».
  Editar una calle YA guardada no se hace en Lilachat: es el croquis de Portal.
- **27/11** Arreglo: la línea violeta no unía los dos aros. Causa: en el APK el aro arrastrado se
  queda donde lo soltó el dedo si su punto no cambia (el aro del inicio tenía la clave fija
  `start-0+000`); pasaba al soltarlo más allá del fin de la calle del mapa (se recorta al extremo) o
  fuera de ella. Ahora cada soltada cambia la clave (`streetDraftHandles(draft, drop)` → `key`), en
  web y APK, y soltar pasado el fin dice «Ahí termina la calle del mapa…» (`HANDLE_PAST_END`).
  También: tras el primer toque de inicio, la línea y «Largo» ya van del aro de inicio al fin (antes
  seguían la calle entera).
- **27/11** «Modo Avance» (diseño `av-01-modo-avance-movil`, web y APK): botón «Avance»
  (`mapa-modo-avance`) al pie del mapa (APK y web en teléfono) y junto a «Registrar avance» (web en
  computadora); solo con permiso de editar el mapa (`editMap`). Arriba, una tira horizontal de
  trabajos (chips de 56 dp con punto de color, nombre y %, el elegido con ✓; % de `layerRowsOf`) y
  la pista «Toca una calle para marcar su avance de <Trabajo>». Tocar una calle (`streetAtTap`)
  abre el panel: «TRABAJO · CALLE», largo, barra «N m de L m», botones 0/25/50/75/100 %, «Hasta una
  progresiva exacta» (metros escritos) y «Guardar avance». Guardar usa las puertas de siempre: si la
  calle no lleva el trabajo, primero `work_scope` (calle entera, o el trabajo sumado a sus tramos,
  como la brocha), luego `work_manual_progress` desde `manualStartOf`; queda PENDIENTE hasta que un
  admin lo apruebe (`MANUAL_SENT`). Un % igual o menor a lo aprobado no se envía («Esta calle ya va
  en N m de …»). Ids de entrada estables por guardado (reenvío sin duplicar). Motor puro
  `shared/src/workAvanceMode.ts`; UI `AvanceMode.tsx` + `AvancePanel.tsx` (web y APK). APK: modal a
  pantalla completa; web: tira y pista sobre el mapa, panel en la hoja/lateral. Sin trabajos, ofrece
  «Agregar trabajo» (`NewLabel`). Diferencia con el diseño: sin la barra blanca «Mapa Operativo
  Vial» (Stitch la inventó) ni los botones de zoom propios (se usan los del mapa).
- **28/11** Lo que espera aprobación, en el mapa (web y APK; Portal ya publicó las herramientas).
  Con el mapa se pide `work_by_approve` → `avances_por_aprobar_de_obra({ servicioId })` (lectura de
  miembro, por la puerta de sesión; nunca por el enlace del cliente): TODO lo pendiente del servicio
  (de cualquiera) y lo rechazado de 14 días. Motor puro `shared/src/workByApprove.ts` (`byApproveOf`
  tolera campos faltantes; estado desconocido se salta). Si falla o la herramienta no existe, el mapa
  queda como antes (sin aviso). Lo pendiente se dibuja en el color del trabajo, delgado y punteado
  (`WORK_MAP_PENDING_PAINT`, capa `work-map-pending` sobre lo aprobado); lo rechazado no se dibuja.
  Leyenda «Por aprobar (N)» con trazo punteado. Sin doble registro: `withPendingOf` mete lo pendiente
  en `map.pending` y `manualStartOf` arranca después de eso; en «Registrar avance» y en «Modo
  Avance» un fin que no pasa lo pendiente dice «Ya hay un avance por aprobar hasta 0+060 en esta
  calle.» y no se envía (`pendingProblem`, `AvanceTarget.pendingM`). «Deshacer» en el panel de Modo
  Avance y en «Pendiente de aprobar», solo en el avance PROPIO más reciente pendiente de esa calle y
  trabajo (`undoableOf`/`undoableIds`): pide confirmación («¿Deshacer el avance hasta 0+060? Se
  borra antes de que lo aprueben.») y llama `work_undo` → `deshacer_avance_de_obra({ servicioId,
  avanceId })`; al deshacer recarga mapa y lista; si Portal se niega, muestra su motivo. La lista
  «Pendiente de aprobar» lleva la píldora «POR APROBAR» y suma lo rechazado con «RECHAZADO» en rojo
  y la nota del rechazo. `work_by_approve` es lectura (`READS_ONLY`): no recarga el mapa.
- **28/11** «Registrar avance» rehecho como ma04 y lista «Avances» como ma05 (web y APK; prototipo
  aprobado de Portal `claude.ai/artifact/L8iULepUHhNJukC7MJkpF9`). **ma04** (`ManualProgress.tsx` =
  pantalla completa + `RecordProgress.tsx`; motor puro `shared/src/workProgressRecord.ts`): al abrir
  se lee el GPS una vez y `gpsStreetOf` proyecta el teléfono sobre las calles CON trabajo; ±25 m o
  menos y a ≤30 m del eje elige la calle («Estás en Jr. Progreso · ±4 m»); GPS débil, lejos o sin
  permiso abre «¿En qué calle?» (lista de `progressTargetOf`). «Cambiar» vuelve a la lista. Un aro
  grande arrastrable (el `StreetHandle` del editor) arranca en el frente (`manualStartOf`, ya salta
  lo pendiente), muestra su progresiva y al soltarlo se pega al eje (`recordDropAt`: nunca antes del
  inicio ni pasado la calle). «Hasta mi ubicación» (`manualEndFromGps`) y «Toda la calle» (fin del
  tramo del trabajo o de la calle). Resumen grande «+46 m», «0+120 → 0+166», barra hecho/nuevo y
  «Metrado 276 m² · 46 m × 6 m» (m² solo con ancho de calle). «Tomar foto y registrar»: valida ANTES
  de abrir la cámara (`recordProblem`: lo por aprobar, sin trabajo, sin largo, pasado la calle);
  APK `takeFieldPhoto` → cola de campo del servicio o subida al Drive; web `DrivePhotoInput` →
  subida → `work_manual_progress` (pendiente, `MANUAL_SENT`/`MANUAL_QUEUED`). «Registrar sin foto»
  sigue (el flujo de hoy no exigía foto); sin subidor el botón es «Registrar avance». La nota
  opcional sigue (`MANUAL_NOTE_MAX`, multilínea para dictar) plegada tras «Agregar nota» bajo el
  resumen y va como `nota`. Se quitaron los 4 pasos y «±10 m» del formulario o-06; los textos de GPS ahora dicen «arrastra el
  círculo». Girado/tablet: mapa y panel lado a lado (APK `useDisposicion`, web `md:`). «Registrar»
  del mapa abre esta pantalla (sin calle, decide el GPS); la del detalle de calle y la sugerencia de
  imprimación la abren en su calle. **ma05** (`ProgressFeed.tsx`; motor `shared/src/workProgressFeed.ts`):
  en el panel del mapa, donde estaba «Pendiente de aprobar», cuando Portal responde
  `avances_por_aprobar_de_obra` (si no, queda la tarjeta vieja). Une pendientes y rechazados de esa
  lista con lo aprobado de `progress[]` (sin autor: no se muestra), más nuevo primero; «Hoy / Semana /
  Todo» por día de Lima (semana = 7 días) con conteos, resumen «m lineales · m² totales» sin los
  rechazados, tarjetas con color del trabajo, «Trabajo · Calle», «0+120 → 0+166 · 46 m · 276 m²»,
  «Hoy/Ayer/20 nov · autor», píldora POR APROBAR / APROBADO / RECHAZADO y «Nota: …» del rechazo.
  «Deshacer» en el propio pendiente más reciente; admins «Aprobar»/«Rechazar» (`work_resolve`) y
  recarga lista y mapa. Diferencias con el diseño: sin selector «Campo / Oficina» (lo decide el rol),
  sin escala ni «Configuración de trazado»; la miniatura es un ícono de cámara (ninguna de las dos
  listas trae la URL de la foto); la hora no sale (las fechas llegan sin hora); la progresiva del aro
  se actualiza al soltarlo, no durante el arrastre.
- **28/11** «Nueva capa» como ma03 (web y APK; prototipo aprobado de Portal
  `claude.ai/artifact/L8iULepUHhNJukC7MJkpF9`). La abren «Agregar trabajo» de «Trabajos» y el chip
  «+ Trabajo» de «Modo Avance» (también su estado sin trabajos); reemplaza el campo de nombre. Motor
  puro `shared/src/workLayerCatalog.ts`: catálogo `LAYER_CATALOG` con color fijo por capa
  (Imprimación, Riego de liga, Carpeta asfáltica 2"/3", Base granular, Sello asfáltico); las que el
  servicio ya tiene salen deshabilitadas con «Ya está» (`foldLayerName`: sin mayúsculas, tildes,
  espacios ni estilo de comillas). «Otra…» es lo único que se escribe: nombre + paleta de 16 y «Otro
  color» (`LabelColors`, extraído de `NewLabel`). Interruptor «Todas las calles de la obra»
  encendido por defecto, con el metrado «N calles · L m · A m²» (largo × ancho de cada calle; m² solo
  con ancho; «sin ancho en K calles») y una fila por calle. «Crear capa <nombre>»: `work_tag`, y
  encendido, un `work_scope` por calle en orden y de a uno con el camino de la brocha
  (`brushRequests`: la capa se suma a cada tramo existente; calle sin tramos, tramo de calle entera);
  el primer rechazo corta y se muestra. El id del trabajo nuevo sale de la respuesta si la trae
  (`tagIdOfAnswer`) o del mapa recargado por nombre (`createMapWaiter`, hasta 15 s). Apagado: solo
  crea la capa y abre la brocha «Pintar» para esa capa. Al terminar vuelve al mapa con la capa
  filtrada (o elegida en «Modo Avance» si se abrió desde ahí; en el APK la brocha vuelve a «Modo
  Avance»). APK `NewLayer.tsx` (hoja), web `NewLayer.tsx` (panel del mapa). Diferencias con el
  diseño: sin «Campo / Oficina», escala ni «Configuración de trazado»; las calles no se destildan
  una a una (todas o la brocha); en el APK «Crear capa» va al final de la hoja, no fijo; una calle
  con tramos parciales recibe la capa en sus tramos, no en los huecos.
- **28/11** «Marcar calles del área» como ma02 (web y APK; prototipo aprobado de Portal
  `claude.ai/artifact/L8iULepUHhNJukC7MJkpF9`). En «Más» del mapa, «Marcar calles» (primero) y «Una
  sola calle» (el editor o-02 de siempre, antes «Nueva calle»). Cada toque en una vía del mapa base la
  trae entera con su nombre, numerada 1, 2, 3… en el mapa (número a la mitad de la línea) y en la
  lista: nombre editable, largo, ancho opcional y «Quitar»; arriba «Área de trabajo · N calles · L m».
  Tocar otra vez una numerada la quita; si tiene cambios (otro nombre, ancho o trazada a mano)
  pregunta en la banda. Regla contra repetidas (`sameStreetLine`): misma calle si los puntos al 25,
  50 y 75 % de una línea quedan a ≤15 m de la otra (un cruce toca uno solo); una calle ya guardada en
  la obra, aunque sea un tramo de esa vía, no entra («… ya está en la obra»). «Trazar a mano (si la
  calle no sale en el mapa)» abre el editor de una calle en modo «A mano» (aros arrastrables) con
  «Agregar a la lista» y vuelve a la lista. «Listo · N calles» guarda de a una por
  `guardar_calle_de_obra` (el mismo `StreetSend`, con etapa si se eligió a mano), cada calle con su
  `entry_id` estable (reenvío seguro), «Guardando 2 de 5…» en el botón; el primer rechazo corta, las
  no guardadas quedan con el mensaje de Portal y el mapa se recarga en silencio; al terminar, aviso y
  recarga. Motores puros `shared/src/workStreetBatch.ts` y `workStreetBatchScreen.ts` (transiciones y
  manejadores para los dos hooks). APK `WorkStreetBatch.tsx` + `WorkStreetBatchParts.tsx` (teléfono:
  banda, mapa y lista abajo hasta 30 % de alto; girado o tablet: panel lateral de 380 dp), web
  `WorkStreetBatch.tsx` (lista al lado del mapa en pantalla ancha). Diferencias con el diseño: sin
  «Campo / Oficina», escala, «Configuración de trazado» ni «Paso 1 de 2» (no hay paso 2); el ancho va
  en cada fila (no está en el prototipo); la etiqueta con el largo sobre cada línea no se dibuja
  (solo el número).
- **28/11** «Registrar avance de <capa>» (ma04) con el mapa en blanco en el teléfono de José
  («No carga el mapa y encima los botones son inmensos»). **Causa, con evidencia** (emulador, build
  publicado 0.1.193, espacio Test, «Jr. Cárcamo» de 183 m): el volcado de `uiautomator` daba la fila
  de chips (`ScrollView horizontal`) en [0,288][1080,1397] (1109 px) y el pie en [0,1397][1080,2337];
  el `mapa-lienzo` de la pantalla no existía (alto 0). React Native da `flexGrow: 1` a todo
  ScrollView: la fila crecía y se comía la mitad del alto libre, y el pie (alto por contenido) el
  resto. No era la cámara: `progressPreviewOf` encuadra una calle de 7 m con el mínimo de ~110 m
  (`withMinimumSpan`) y `recordMapOf` da el aro aunque la capa no esté en la calle (test nuevo).
  **Arreglo** (APK y web): los chips van envueltos (`flex-wrap`, sin ScrollView), 44 dp, texto
  15 px, «Cambiar» siempre entero; la pista pasa a la barra de arriba en `on-surface-variant` (sin
  franja clara en oscuro); botones de contorno 44 dp; «Tomar foto y registrar» 52 dp en
  `bg-primary` / `on-primary`; «Registrar sin foto» y la nota más chicos; el pie llega a 40 % del
  alto en el teléfono y el resto es mapa; el punto de la capa lleva borde (un color casi negro como
  #111827 se ve en oscuro). Candado `app/src/test/scrollLeavesRoomForMap.test.ts`: todo ScrollView
  horizontal junto a un hermano `flex-1`, o raíz de un componente, declara `flexGrow: 0` (se añadió
  a `LayerChips`, `MapDays`, `ObservationParts` y `ReportItemsView`). Verificado en el emulador: la
  causa (build publicado). El arreglo: solo por tests y tsc (el build de desarrollo no tenía sesión).
- **28/11** Ronda 3 de ma01 (capturas del OTA 4b483fe): nombres de chip hasta 14 caracteres con «…»
  (`chipNameOf`) y desvanecido al borde derecho de la fila; muestras de la leyenda con aro claro (capa
  casi negra legible); en Modo Avance el botón de % en que ya está la calle sale marcado «actual»
  (`avanceCurrentPercent`); el zoom y «Mi ubicación» solo suben sobre una hoja corta (`isShortSheet`).
  Verificado: tests y tsc.
- **28/11** Ronda 2 de ma01 tras las capturas DESPUÉS del OTA 77c08e56: la fila de chips termina
  antes de «Más» y recorta ahí; la vista previa de la capa es más chica (nombre, cifra, barra y la
  acción), el asa la agranda y la X la pliega a «Registrar avance de <capa>» sola (estado `min`,
  `collapseSheet`; sin acción, la X la cierra); el zoom y «Mi ubicación» suben sobre la hoja (APK
  `controlsInset` por `onLayout`, web `useHeight`); Modo Avance dibuja por capa igual que el tablero;
  una capa casi negra lleva aro claro en sus puntos y borde claro en sus líneas (`lineHaloOf`,
  `lineCasingPaint`). Verificado: tests y tsc; en el dispositivo, las capturas de la ronda 1.
- **28/11** Sin punteado y del ancho de la calle (José 28/11: «xq siguen viéndose líneas punteadas… no
  ocupan el ancho de la calle. El nombre de la calle siempre por encima»; web y APK). Reemplaza el
  punteado de las entradas de abajo: TODAS las líneas del visor son sólidas — calles de la obra en
  banda neutra tenue (opacidad 0,35), lo planificado de la capa en su color translúcido (0,4), lo
  hecho opaco, lo por aprobar en su color a media opacidad (0,65; antes punteado), el tramo que se
  registra o se pinta a 0,6. Ancho: `shared/src/workLineWidth.ts` › `streetWidthExpression(minPx)`,
  una parada por zoom 12…22 con interpolación exponencial base 2, cada una `max(minPx, ancho_m /
  metros_por_px)` (tiles de 512 px, latitud de Lima −12°), leyendo `widthM` de cada línea
  (`WorkMapLine.widthM`: tramo, si no la calle; sin ancho, 6 m `DEFAULT_STREET_WIDTH_M`). Los nombres
  del mapa base van encima: nuestras líneas y rellenos se insertan bajo `street-name`
  (`WORK_MAP_LABELS_LAYER`; APK `beforeId`, web `addLayer(…, beforeId)`); los «NN %», progresivas y
  pines siguen arriba. Leyendas («Planificado», «Pendiente de ejecución», «Por aprobar») con
  muestra sólida translúcida. «Editar croquis» usa las mismas líneas (también sólidas).
  Brocha («Pintando <capa> · Toca las calles que la llevan»): causa del «El tramo excede el largo de
  la calle (44.28 m)» — Portal recalcula `lengthM` al redibujar una calle (`PUT /api/work-streets/:id`)
  y NO recorta sus tramos; la brocha reenviaba `toM` del tramo viejo tal cual y Portal lo rechaza si
  pasa `lengthM + 0,5`. Ahora `clampToStreet` recorta cada tramo al largo de la calle (una sola fuente:
  `street.lengthM` del mapa, el mismo que Portal valida), un tramo que queda vacío no se envía, y la
  calle nueva va a `lengthM` exacto (antes `Math.round`). Las líneas de la brocha llevan su ancho.
  «Registrar avance de <capa>» (ma04): fila compacta con deslizador 0–100 % y % escrito
  (`RecordPercent.tsx` con `DecimalInput` en el APK, `input type=range` + texto en la web;
  `decimalText` pasó a shared); los tres (deslizador, % y aro) van juntos: `recordAtPercent`,
  `chainageAtPercent` (al centímetro, sin pasar la calle ni quedar antes del frente) y
  `streetPercentOf` en `workProgressRecord.ts`. Verificado: tests y tsc; falta E2E en el dispositivo.
- **28/11** Auditoría stitch-fidelity de ma01 tras las quejas de José (botones grandes, botones
  sobre las capas, «Capas y leyenda» abierta y enorme, líneas punteadas fuera de «Editar croquis»).
  Auditoría: `design/stitch/auditorias/ma01-mapa-capas.md` (16 diferencias del revisor independiente
  + 2 de Modo Avance). Ahora (web y APK): arriba UNA fila de chips compactos de 40 dp (`LayerChips`,
  también en Modo Avance) con «Más» (⋮) al lado y, debajo a la derecha, el botón flotante «Capas»;
  «Hasta hoy», el selector de trabajo, los días y las convenciones viven en «Capas y leyenda»
  (sección «Ver»), que está CERRADA hasta tocar «Capas» (`shared/src/workMapSheet.ts`:
  `initialMapSheet`, `toggleLayersSheet`, `sheetForLayerPick`, `expandLayerSheet`). La hoja de la
  capa abre como vista previa (cifra, barra y UNA acción «Registrar avance de <capa>», 52 dp,
  `bg-primary`) y «Ver N calles» la amplía a las filas, la leyenda «— Hecho · - - Planificado» y
  «Último» (sin reloj); el panel de siempre (tarjetas de calle, «Avances», unidades, listas, corte)
  sigue montado debajo y se ve ampliada (APK: `BoardSheet.tsx`). Nada flota al pie: «Editar croquis»
  y «Modo avance» pasan a «Más» (`mapMoreItems` con `fieldTools`; «Registrar avance» también, solo
  si no hay capas). El mapa se dibuja por capa (`shared/src/workLayerLines.ts` › `layerMapLinesOf`):
  todas las calles en línea fina neutra sólida, lo planificado de la capa elegida punteado y grueso
  EN SU COLOR con su «NN %» a mitad de la calle, lo hecho sólido; sin la capa no hay punteado gris.
  Las progresivas «0+000» solo desde zoom 17 (`STATION_MIN_ZOOM`). Modo Avance: pista de 13 px en
  una línea; el toque elige la calle de la obra más cercana con un alcance de 30 px según el zoom
  (`tapReachM`, `avanceStreetAtTap`) y la resalta gruesa en el color de la capa; «Marcar a mano»
  pone «desde» y «hasta» con dos toques sobre el eje (fuera de la calle se pega al extremo), aros
  arrastrables con su progresiva y «+4 m · 0+002 → 0+006»; «Guardar avance» lo manda por la misma
  puerta (`runAvanceSave` con `range`); antes del frente solo si ese tramo está libre
  (`avanceRangeProblem`: nada aprobado ni por aprobar ahí, y dentro del tramo de la capa).
  Verificado en el emulador: solo la captura ANTES (APK publicado); lo nuevo por tests (web
  `ServiceMapWeb.test.tsx`, `AvanceMode.test.tsx`; shared `workLayerLines`, `workAvanceManual`,
  `workMapMenu`) y tsc. Falta la captura DESPUÉS en el APK tras publicar el OTA y revisar ma04.
- **28/11** «Mapa por capas» como ma01 (web y APK; prototipo aprobado de Portal
  `claude.ai/artifact/L8iULepUHhNJukC7MJkpF9`). Sobre el mapa, primera fila flotante: un chip por capa
  (trabajo) con su punto de color, nombre COMPLETO y % (`LayerChips.tsx`, extraído de la tira de «Modo
  Avance», que ahora usa el mismo componente; la fila se desliza, los chips miden su texto). Tocar un
  chip la hace la capa activa y abre la hoja; sin elegir, la activa es la primera. La hoja abre sola
  con el mapa cuando hay capas (antes solo con «Capas») y su cabeza «Avance de la obra» la reemplaza
  la de la capa (`LayerSheet.tsx`; las tarjetas de calle con «Ver tramos» y borrar siguen debajo):
  «IMPRIMACIÓN», «3 590 de 6 325 m²» y «57 %», barra, una fila por calle de esa capa con «hecho de
  total» y %, «Último: hoy 10:42 · Jr. Progreso +46 m» con «por aprobar» aparte, y «Registrar avance
  de <capa>», que abre ma04 con esa capa elegida (si la calle la lleva) y el GPS y «¿En qué calle?»
  solo entre sus calles (`layerRecordMap`, `layerDraftFor`); «Registrar» del pie también usa la capa
  activa. Motor puro `shared/src/workLayerSummary.ts` (`activeLayerOf`, `layerSummaryOf`,
  `layerChipsOf`, `layerLatestOf`): área aprobada / área planificada por tramo (ancho del tramo o de la
  calle); los tramos que se pisan cuentan una vez, al ancho mayor; avance fuera del tramo y
  repavimentos no cuentan. Si algún tramo de la capa no tiene ancho, toda la capa va en metros y lo
  dice («En metros: 2 calles sin ancho»). Lo por aprobar (`avances_por_aprobar_de_obra`, menos lo
  ya aprobado) va rayado en la barra, después de lo aprobado, y no suma al %. «Último» toma lo
  aprobado y lo pendiente de esa capa (lo rechazado no); la hora sale solo si la fecha la trae (en
  hora de Lima), si no «hoy» / «ayer» / «28 nov». **Un solo % por capa** (José 28/11: nunca dos %
  distintos): `shared/src/workLayerPercent.ts` › `layerPercentOf` (m² si toda la capa tiene ancho,
  metros si no; lo por aprobar nunca suma; con el filtro del mapa en vigor: etapa y corte «Hasta el…»,
  vía `layerScopeOf`, como «Capas» hacía antes) es la única fuente del %
  de una capa y lo leen los chips y la hoja de ma01, los chips de «Modo Avance» (`avanceChipsOf`) y
  las filas de trabajos de «Capas y leyenda» (`layerRowsOf`, que ahora recibe el mapa); un test
  comprueba que los tres coinciden. El trabajo elegido en el selector del mapa es también la capa
  activa (y tocar un chip con un trabajo filtrado cambia el filtro). Tablet y
  teléfono girado (APK, `useDisposicion().amplia`): el panel pasa a columna de 400 dp junto al mapa;
  la web ancha ya lo tenía a la derecha, ahora con la capa arriba. Diferencias con el diseño: sin
  «Campo / Oficina», escala ni «Configuración de trazado»; sin leyenda «Hecho / Planificado» en la
  hoja; las filas de calle van en m² (el diseño las mostraba en m); la barra inferior «Mapa / Capas /
  Avances» no existe (siguen «Capas» y la lista ma05 del panel).
- **20/11** Rediseño aprobado `mapa-v2` (web y APK): cabecera de una fila en Mapa, mapa a pantalla,
  días y corte flotando, «Compartir avance» y «Pantalla completa» dentro de «Más», panel como hoja
  en el teléfono. Auditorías: `design/stitch/auditorias/mapa-v2-movil.md` y `mapa-v2-escritorio.md`.

## 5. Diseños de Stitch relacionados

| Diseño | Estado | Evidencia |
| --- | --- | --- |
| o-01 mapa de la obra | Implementado web y APK | `MapWorkspace.tsx`, `WorkMapBoard.tsx`, `WorkMapPanel.tsx` |
| o-02 definir área | Implementado; el APK se aparta del diseño a propósito para agrandar el mapa (27/11, ver INVENTARIO) | `WorkStreetEditor.tsx` (web y APK), `WorkStreetEditorParts.tsx` (APK) |
| o-03 calle y tramos | Implementado | `StreetScopes.tsx`, `ScopeForm.tsx` |
| o-04 etapas | Implementado (brocha) | `WorkLayers.tsx`, `LayerActions.tsx` |
| o-05 trabajos | Implementado (brocha) | `WorkLayers.tsx`, `LayerActions.tsx` |
| o-06 registrar avance | Implementado | `ManualProgress.tsx` |
| av-01 modo avance | Implementado web y APK (27/11) | `AvanceMode.tsx`, `AvancePanel.tsx`, `shared/src/workAvanceMode.ts` |
| ma01 mapa por capas | Implementado web y APK (28/11); auditado 28/11 (`design/stitch/auditorias/ma01-mapa-capas.md`) | `LayerChips.tsx`, `LayerSheet.tsx`, `WorkMapBoard.tsx`, `BoardSheet.tsx` (APK), `shared/src/workLayerSummary.ts`, `shared/src/workLayerLines.ts`, `shared/src/workMapSheet.ts` |
| ma02 marcar calles del área | Implementado web y APK (28/11) | `WorkStreetBatch.tsx` (web y APK), `WorkStreetBatchParts.tsx` (APK), `shared/src/workStreetBatch.ts`, `shared/src/workStreetBatchScreen.ts` |
| o-07 avance por unidades | Implementado; falta «Ancho útil» y botón fijo en APK (auditoría 08/11, no verificado si se cerró) | `WorkMapDischarges.tsx` |
| o-08 avance parcial y enlace | Implementado | `ShareProgress.tsx`, `PdfAction.tsx` |
| o-09 vista del cliente | **No es de Lilachat**: página pública de Portal; le falta «Línea de tiempo» y filtro por etapa (según spec) | sin referencia en código |
| o-10 servicio sin mapa | Implementado | `WorkMapFirst.tsx`, `EMPTY_WORK_MAP` |
| o-11 reporte del cliente con mapa | **No es de Lilachat** (Portal) | sin referencia en código |
| o-12 exportar e importar | Implementado | `WorkMapExport.tsx`, `ImportTrace.tsx` |
| o-13 caminar con GPS | Implementado | `useGpsWalk.ts` (web y APK) |
| o-14 informe PDF A4 | Lo arma Portal; rehecho el 08/11 (4 hojas). Opcional: estado y nota por jornada | spec §PDFs con avance aprobado |
| o-15 plano A3 | Lo arma Portal; rehecho el 08/11 | idem |

Diferencias que se quedan a propósito (según spec): sin chip «Ing. de campo», sin
«GPS RTK en línea» ni «Sincronizado con Caseta», sin descripción por calle. Exportar
usa los filtros del mapa («Sale lo que ves»).

## 6. Pendientes y deuda conocida

- **ma01 (28/11):** captura DESPUÉS en el APK cuando se publique el OTA; revisión independiente de ma04.
- **Mapa base de Google:** pendiente de José. Necesita una llave de Google Maps
  Platform con facturación. No hay llave en Lilachat ni en Portal (según spec, 12/11).
- **OSRM en producción:** no está verificado qué valor tiene `OSRM_BASE_URL` (según spec §8).
- **Decisiones abiertas** (según spec §8): qué tipo de foto marca el tramo de una
  unidad (propuesta: de `ingreso` a `vacia`); si el avance del ingeniero entra
  `pending` o `approved`.
- **Servicio sin calles** con el caso real de Globofast: solo tests del motor, sin
  verificar en el teléfono (según spec, 09/11).
- **Avance sugerido de imprimación:** sin verificar en vivo; en Test no hay un
  CTL-IMP con fotos ubicadas sobre una calle (según spec).
- **o-09** (Portal): falta la línea de tiempo por corte y el filtro por etapa.
- Tutoriales: el crédito de OpenFreeMap tapa un cuarto del mapa chico (visto en el
  tutorial 3, según `TUTORIALES-CANAL-CLIENTE.spec.md`).
- Trampa conocida: el CSS de MapLibre pone `position: relative` en su contenedor; un
  `div` con `absolute` mide 0 de alto y el mapa no se ve.

## 7. Pruebas

- **Unit (shared):** 46 archivos `shared/src/work*.test.ts`, entre ellos
  `workMapPortalParity.test.ts` (mismo % y colores que el motor de Portal).
- **Unit (web):** 10 tests en `web/src/spaces/clients/workMap/*.test.tsx`, más
  `ServiceMapWeb.test.tsx`.
- **Server:** `workMapRoutes.test.ts`, `bots/workMapForms.test.ts`,
  `bots/workManualProgressForm.test.ts`, `placeSearch.test.ts`.
- **APK:** sin tests de componentes del mapa (verificado: no hay `*.test.*` en
  `app/src/spaces/clients/workMap/`).
- **Maestro:** no hay flujo del mapa en `app/.maestro/` (verificado).
- **E2E manuales documentados** en el spec: web prod y APK por OTA en el espacio Test,
  servicio QA-CTLPIS, con limpieza por el camino de la app.
- **Tutoriales grabados** como E2E del mapa: `scripts/tutorials/guiones/dibujar-calle.ts`,
  `etapas-trabajos.ts`, `tramos.ts` (modo `--ensayo`).
