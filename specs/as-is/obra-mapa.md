# As-is · Mapa de obra (pestaña «Mapa» de un servicio)

> Fecha de corte: **17/11/2026**. Fuentes: código de `main`, `git log` desde el 06/10,
> `specs/MAPA-OBRA.spec.md` (spec vivo, 1 383 líneas) y `design/stitch/INVENTARIO.md`.
> Lo marcado «no verificado» no se confirmó en el código ni en un E2E.

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
| Nueva calle | o-02 | Tocar la calle real (sigue la vía), «A mano», o «Caminar GPS»; extremos arrastrables; ±10 m; ancho y etapa |
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

### Web/PWA

- Carpeta: `web/src/spaces/clients/workMap/` (40 archivos). Entrada:
  `web/src/spaces/clients/ServiceMapWeb.tsx`.
- `MapWorkspace.tsx`: la pestaña ocupa toda la conversación. El canal quita su
  relleno y su scroll (`onMapOpen`).
- Ancho o angosto lo decide el tablero con `ResizeObserver`, no la ventana. Con
  880 px o más el panel va a la derecha (380–400 px). Menos: hoja que sube sobre el mapa.
- Pantalla completa del navegador; si se niega, una capa sobre la página. Escape sale.
- MapLibre con `maplibre-gl-csp` (worker de nuestro origen). Mapa base OpenFreeMap con
  estilo propio en español. El trozo del mapa pesa ~256 KB comprimidos y baja al abrir.
- Archivos propios de la web: `WorkMapCanvas.tsx`, `WorkMapOverlays.tsx`, `CutFields.tsx`,
  `useWorkMap.ts`, `maplibre-csp.d.ts`.
- **«Editar croquis» en el editor 2.0 de Portal** (16/11): Portal pide el mapa
  (`edit-croquis`); la web dibuja el mapa del servicio encima del editor. «Volver al
  informe» o Escape avisa a Portal (`croquis-changed`). Archivos:
  `web/src/spaces/clients/reports/PortalEmbedWeb.tsx`, `ServiceDetailWeb.tsx`.

### APK

- Carpeta: `app/src/spaces/clients/workMap/` (31 archivos). Entrada:
  `app/src/spaces/clients/ServiceMapPanel.tsx`.
- Mapa nativo con `@maplibre/maplibre-react-native`. Es código nativo: llegó con el
  APK 0.1.181 (182). Un OTA no puede sumar módulos nativos.
- Dentro del detalle el mapa no se mueve (no pelea con el scroll). «Ver mapa
  completo» lo abre a pantalla completa (`WorkMapFirst.tsx`, `WorkMapSurface.tsx`).
- Archivos propios del APK: `WorkMapSurface.tsx`, `MapControls.tsx` (+, −, GPS),
  `CutChips.tsx` (corte en pastillas), `WorkMapFilters.tsx` (etapa y día en chips).
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
| Pantalla completa | Del navegador o capa propia | Pantalla aparte («Ver mapa completo») |
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

## 5. Diseños de Stitch relacionados

| Diseño | Estado | Evidencia |
| --- | --- | --- |
| o-01 mapa de la obra | Implementado web y APK | `MapWorkspace.tsx`, `WorkMapBoard.tsx`, `WorkMapPanel.tsx` |
| o-02 definir área | Implementado | `WorkStreetEditor.tsx` (web y APK) |
| o-03 calle y tramos | Implementado | `StreetScopes.tsx`, `ScopeForm.tsx` |
| o-04 etapas | Implementado (brocha) | `WorkLayers.tsx`, `LayerActions.tsx` |
| o-05 trabajos | Implementado (brocha) | `WorkLayers.tsx`, `LayerActions.tsx` |
| o-06 registrar avance | Implementado | `ManualProgress.tsx` |
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
