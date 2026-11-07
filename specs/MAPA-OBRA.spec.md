# Mapa de la obra en Lilachat

> Estado: **lectura, fecha de corte y exportar, en web y APK. Escritura en espera de
> Portal.** Nace de lo que José pidió el 06/11/2026. La pestaña Mapa de hoy es la página de Portal dentro de un WebView.

## 1. Qué pidió José

El usuario es un ingeniero de campo, casi siempre desde un celular. El cliente lo
mira desde una computadora. Tiene que funcionar en escritorio, tablet y móvil.

1. **Definir el área:** qué calles son, inicio, fin y progresivas.
2. **Partir la obra en etapas:** etapa 1 con calles 1, 2 y 3; etapa 2 con otras.
3. **Trabajos sobre un área:** mejoramiento de base, subrasante, imprimación,
   asfalto. Puede haber varios sobre la misma área o etapa.
4. **Marcar avance:** cuánto de cada trabajo va hecho en cada etapa.
5. **Enlace con Control de pista:** cada unidad guarda dónde descargó. Con el mapa
   definido, eso da el progreso.
6. **Avances parciales para el cliente:** estas calles en base, estas imprimadas,
   estas asfaltadas. También aparece en el informe del servicio.
7. **Enlaces:** crear enlaces para compartir ese avance.

Sobre el mapa: «mostrar el mapa literal de la obra con calles etc y mostrarlo en un
mapa como lo tiene portal en public».

## 2. Qué ya existe en Portal

Fuente: `Portal/specs/MAPA-AVANCE-CALLES.spec.md` y el análisis de la sesión Portal
del 06/11. Hay que leer ese spec antes de escribir código.

| Pedido | Estado en Portal |
| --- | --- |
| Área | Hecho: `work-street`, `work-scope` |
| Etapas | Hecho: `work-stage`, sin fechas propias |
| Trabajos | Hecho: `work-tag`, varias por tramo |
| Avance | Hecho sobre `service-partida-progress`, entra pendiente de aprobación |
| Cliente | Hecho: pintado, filtro, línea de tiempo, PDF y KMZ |
| **Enlace con Control de pista** | **Falta. Es lo que más falta** |

Regla de fondo: la calle se dibuja una vez. Todo lo demás son eventos con
progresivas. Nunca un «% por calle».

El ingeniero ya crea el mapa en `/public/{slug}/services/{id}`, con dispositivo
enrolado y sin sesión, en las pestañas Área, Calles, Capas y Plan.

## 3. Dolores que no se repiten

| Fecha | Qué pasó | Regla para Lilachat |
| --- | --- | --- |
| 28/08 | Un FAB tapaba la manija; «Caminando» grababa sin querer | Una acción, un lugar. Grabar pide confirmar |
| 03/09 | «Se pierde la selección»: el mapa quedaba mudo | Toque selecciona; mantener crea; el modo se ve con Cancelar |
| 04/09 | «¿Lo hiciste pensando que tengo un mouse?» | Nada se arrastra sobre una línea: manijas de 44 px o dos toques |
| 04/09 | «Recontra inestable»: se probó en el motor | Se prueba en el teléfono |
| 04/09 | «Muy lento»: cada marca releía tres listas | Color optimista y relectura acotada |
| 04/09 | «No mezclar más» | Una pantalla, una función |
| 06/09 | Cámara frontal; «Usar foto» esperaba al Drive | Cámara trasera y subida en segundo plano |
| 03/08 | La hoja al 85 % dejaba una franja de mapa | Mínimo 40 % de mapa |
| 01/09 | El trazo se iba a la paralela | Deshacer visible en todo el dibujo |

Datos: sin alcance una calle no se pinta, y no aplicar no es 0 %.
Permisos: el cliente recibe lista blanca, sin metrado ni pendiente.
Mapas: `hsl(var(--x))` en `paint` no agrega la capa, y `setStyle` borra capas propias.

## 4. Pantallas (Stitch)

Proyecto `15540754270713720465`, generador `.stitch-work/screens_mapa.py`. Cada una
en móvil, tablet y escritorio.

| Slug | Pantalla | Quién |
| --- | --- | --- |
| `o-01-mapa-obra` | Pestaña Mapa de un servicio | Todos |
| `o-02-mapa-definir` | Definir el área | Ingeniero |
| `o-03-mapa-calle` | Una calle y sus tramos | Ingeniero |
| `o-04-mapa-etapas` | Etapas | Ingeniero |
| `o-05-mapa-trabajos` | Trabajos con brocha | Ingeniero |
| `o-06-mapa-avance` | Registrar avance en cuatro pasos | Ingeniero |
| `o-07-mapa-pista` | Avance sugerido por las unidades | Ingeniero |
| `o-08-mapa-parcial` | Avance parcial y enlace | Ingeniero |
| `o-09-mapa-cliente` | Vista del cliente | Cliente |
| `o-10-mapa-vacio` | Servicio sin mapa | Todos |
| `o-12-mapa-exportar` | KMZ, plano PDF, enlace e importar | Ingeniero |
| `o-13-mapa-caminar` | Caminar la calle con GPS | Ingeniero |

La pantalla del cliente en el enlace de servicio vive en otro proyecto de Stitch:
`773748608093847613`, con el slug `o-11-reporte-cliente-mapa` en `registro.jsonl`.
Es una pantalla nueva en tres dispositivos, con el mapa literal, las cifras, la línea
de tiempo y el panel por calle o por capa.

La sección 5 de `1f9365f6e58f422bb3a71a759b1a2e7f` sigue siendo el esquema lineal en
el archivo guardado. `edit_screens` respondió éxito y mandó una operación de sesión,
pero `get_screen` devuelve el mismo HTML. Por eso se generó aparte.

## 4-bis. GPS, mapa base y Google Earth en Portal

- **Mapa base:** OpenFreeMap, sin token, con datos de OSM. Sin señal usa un pack raster.
- **Pegado a la vía:** OSRM `/match`. Si se aleja más de 25 m del trazo, se guarda lo
  dibujado. No está verificado qué valor tiene `OSRM_BASE_URL` en producción.
- **Calle que el mapa no conoce:** solo se traza a mano o se camina.
- **Caminar:** descarta lecturas de más de 25 m de error, menos de 5 m de movimiento y
  saltos de más de 120 m. Muestra precisión, largo y lecturas descartadas.
- **Exportar KMZ:** carpetas Ejecutado, por trabajo, y Pendiente, a una fecha. El color de
  KML es `AABBGGRR` y las coordenadas van `lng,lat`. Hay que escapar el XML.
- **Importar KMZ o KML: no existe.** `work-street.source` tiene `import`, pero no hay
  pantalla ni API. En `o-12` es una mejora nueva, no algo que ya funcione.

## 5. Decisiones de José (06/11)

1. **Datos en Portal.** Lilachat lee y, más adelante, escribe por una puerta con
   identidad. La curva S y la valorización siguen allá.
2. **Mapa en Lilachat con estos diseños.** Sí, con APK nuevo para el mapa nativo.
3. **Web con pantalla completa.** Sus palabras: «en la web deberia haber un modo
   pantalla completa para tener mayor amplitud del mapa de la obra».
4. **Primero el enlace con Control de pista.** Es lo que sigue después de leer.

## 6. Fase 1: leer el mapa (implementada en la web)

- **Motor puro:** `shared/src/workMap.ts`. Lee `detail.workStreets` por lista blanca y
  suma como `workMapOverview` de Portal: unión de días, sin reproceso, por trabajo y
  por tramo. El cliente no debe leer dos porcentajes distintos.
- **Puerta del servidor:** `POST /api/service-work-map` con `{ link, serviceId }`. La
  API pública de Portal no tiene CORS, así que el servidor pregunta con el enlace que
  la persona ya obtuvo. El token es el permiso y viaja en el cuerpo, fuera de los logs.
  `workMapRequest` solo acepta enlaces de `constroad.com` y arma la dirección de Portal.
- **Contrato con Portal:** `GET /api/public/client-portal/services/[id]?token=`, campo
  `detail.workStreets`, con `stages[]` y `scopes[].stageId`. El endpoint
  `client-report/[token]/work-streets` no sirve: exige un enlace de pedido.
- **Web:** `ServiceMapWeb` y `workMap/*`. Muestra `o-01-mapa-obra`: avance, trabajos,
  etapas, calles y leyenda sobre MapLibre con OpenFreeMap. Pantalla completa con la
  del navegador y una capa sobre la página si el navegador la niega. Escape sale.
- **CSP:** se usa el build `maplibre-gl-csp` para que el worker salga de nuestro
  origen. `connect-src` suma `tiles.openfreemap.org`; `worker-src` no cambia.
- **Peso:** el mapa es un trozo aparte de 256 KB comprimidos. Solo baja al abrir la pestaña.
- **Fecha de corte:** «Hasta el 5 nov» muestra el avance acumulado a ese día, en la web
  con un selector y en el APK con pastillas. Solo ofrece días con avance, porque otro día
  daría el mismo mapa, y no aparece con un solo día. Las fechas se comparan como texto
  `YYYY-MM-DD`, así ninguna zona horaria las mueve.
- **No se dibuja todavía:** «Editar obra» ni «Registrar avance» como botón suelto. Sin
  puerta de escritura serían botones de mentira. «Compartir avance» abre la exportación.
- **Composición web (07/11, José: «no se está pareciendo en nada al diseño»):** la pestaña
  «Mapa» ya no es una tarjeta dentro de la columna del detalle. Ocupa toda la
  conversación (`MapWorkspace`): el canal quita su relleno y su scroll (`onMapOpen`).
  Arriba va la barra de o-01: ruta y pestañas subrayadas a la izquierda; «Pantalla
  completa», «Portal» y «Compartir avance» a la derecha. Debajo, el mapa a toda la altura
  con tarjetas flotantes: trabajos con su %, etapa y día de corte arriba, «Convenciones»
  abajo a la izquierda y el zoom de MapLibre abajo a la derecha. A la derecha, el panel de
  380–400 px: «Avance de la obra» con el estado del servicio, la cifra grande, la longitud
  total, la barra por trabajo y los metros por etapa; las calles agrupadas por etapa con
  su estado («En ejecución», «Por iniciar», «Terminada», de `stageStateLabel`); y el pie
  «Corte: …». Todos ven el avance sugerido (o-07) arriba de las calles.
- **Ancho o angosto lo decide el tablero, no la ventana:** con 880 px o más el panel va a
  la derecha. Menos, como en el teléfono de o-01: pestañas en su propia fila (al lado de
  los botones quedaban tapadas a 444 px), filtros en filas debajo, leyenda arriba, mapa
  de 58 vh y el panel como hoja redondeada que sube sobre el mapa. La lista de chats al
  lado hace que la ventana mienta, por eso se mide con `ResizeObserver`.
- **Diferencias con o-01 a propósito:** sin «Editar obra», «Registrar avance», «Ing. de
  campo» ni «Sincronizado con Caseta», que no tienen dato detrás. Sin descripción por
  calle: Portal no la manda.
- **Trampa:** el CSS de MapLibre pone `position: relative` en su contenedor. Si ese
  `div` lleva `absolute`, mide 0 de alto y el mapa no se ve, aunque cargue sin error.
- **APK con la composición de o-01 móvil (07/11):** «Mapa de la obra» con «Compartir» y
  «Portal»; etapa y día como chips que abren su lista (`WorkMapFilters`); los trabajos en una
  fila; el mapa de borde a borde con la leyenda arriba a la izquierda y el botón de mapa
  completo arriba a la derecha; y el panel que sube como hoja sobre el borde del mapa
  (`WorkMapPanel`), con la cifra, la barra por trabajo y las calles por etapa. En la pestaña
  «Mapa» se oculta la tarjeta del servicio, como en la web.
- **APK:** `app/src/spaces/clients/workMap/*` con `@maplibre/maplibre-react-native`.
  Dentro del detalle el mapa no se mueve, para no pelear con el scroll; «Ver mapa
  completo» lo abre a toda la pantalla. Es código nativo: un OTA de este commit no llega
  a nadie hasta instalar el APK nuevo, porque la huella del `runtimeVersion` cambia.

**Estado al 06/11:** APK 0.1.181 (182) publicado en LilaStore, runtime `6176e3ea`. La web y
el APK recorridos en Test con el servicio `6aedcc3a…`: mapa, scroll sobre él, mapa completo,
cierre y giro. Smoke limpio sobre ese APK.

**Estado al 07/11:** la composición de o-01 está en producción en la web (c3c7776) y en el
APK 182 por el OTA `49025a2b` (git 1cb9051). Recorrido en Test con QA-CTLPIS: web a 1600 y
444 px, y APK en el emulador con el panel completo, el Control de pista y «Confirmar avance
(90 m)». El motor pasa a `@constroad/shared/obra` (Portal publicó v0.6.0); mientras tanto
`workMap.ts`, `workMapDischarges.ts` y `workMapProgress.ts` no suman lógica.

**Un solo motor con Portal (07/11):**
- La geometría sale del paquete: largo, proyección de una foto y corte entre progresivas (3069b51).
- Los colores salen del paquete: `colorForPartida` da imprimación azul, asfalto negro y base marrón,
  como los planos.
- Las uniones de intervalos y la etiqueta «Km 0+100» del estado de cada calle también salen de ahí.
- Una calle con menos de dos puntos se cuenta en los totales, como en Portal, aunque no se dibuje.
- Los metros de cada tramo se redondean al centímetro.
- `workMapPortalParity.test.ts` compara con el `workMapOverview` del paquete y exige el mismo %
  (también con fecha de corte), los mismos estados de calle y los mismos colores. Antes, una calle
  sin trazo daba 47,7 % en Lilachat y 48,1 % en Portal.
- El tramo de cada unidad del Control de pista sale de `suggestDischarges` del paquete (v0.7.0).
  `workMapDischarges.ts` solo cambia las formas: la calle a `StreetAxis` y la unidad a
  `Discharge`, y devuelve cada resultado con su unidad original. Las reglas (30 m del eje, foto
  con precisión peor que 30 m descartada, orden por llegada) son las mismas que tenía Lilachat.
- El KML de exportar sale de `buildWorkStreetsKml` del paquete (v0.8.0), con las opciones que
  Lilachat le sumó: `stageId`, `works`, `upToDate`, `pending: 'planned'` (cada tramo planificado y las
  calles sin tramo) y `labels: 'progresiva'` («0+040 a 0+150»). Sin opciones el archivo de Portal
  queda igual byte por byte (test con el KML de v0.7.0). Cambia el id de cada estilo (`p-<trabajo>`
  en vez de `trabajo-N`) y el orden de las carpetas sigue el de los tramos; Google Earth lo ve igual.

**Servicio sin calles (diseño o-10, 07/11):** José: «¿dónde se supone que voy a crear el mapa
si no hay tab ni opción?». La pestaña «Mapa» aparece para todos los que abren el servicio, tenga
calles o no. Sin calles muestra «Todavía no hay calles», los tres pasos, «Dibujar la primera calle»
y, debajo, «O dibújala en el Portal» (la pestaña Mapa del servicio en el admin, `?tab=mapa`, solo
si el enlace del servicio es esa página).

**Dibujar una calle (diseño o-02, 07/11), web y APK, para todos:**
- Motor puro `shared/src/workStreetDraft.ts`: cada toque agrega un punto (tope 500), «Deshacer»
  quita el último, el largo se lee en metros enteros mientras se dibuja, y `streetDraftProblem`
  pide primero inicio y fin, después el nombre (hasta 80) y el ancho (0,1 a 60 m, opcional).
- Se entra por «Dibujar la primera calle» (o-10) o por «Nueva calle» en la barra del mapa.
- Web: `WorkStreetEditor` dentro de la conversación, con el mismo lienzo MapLibre (`onTap`) y el
  control «ubicarme» del navegador. APK: un `Modal` con `WorkMapSurface` (`onPress`) que, sin
  calles, se centra en el teléfono con `useCurrentLocation`.
- «Guardar calle» abre `guardar_calle_de_obra` de Portal por la puerta del servidor (`kind:
  'work_street'`, `server/src/bots/workStreetForm.ts`), igual que el avance: el servicio sale de la
  puerta, el contexto lleva `nombre`, `trazo`, `anchoM` y `entradaId`, y el formulario no pide nada.
  El mismo `entradaId` en un reenvío devuelve la misma calle (`creada:false`). Al guardar, el mapa
  se vuelve a pedir. Un rechazo de Portal (`tiene_avance`, `rechazado`) se muestra tal cual en el
  editor.
- Portal publicó las seis herramientas el 07/11 (a9938ba7) y José las aprobó en Agentes.

**Borrar (José 07/11):** «que pueda borrar calles cualquiera, pero que sea un borrado lógico que el
admin pueda restaurar». Portal lo implementa (`restaurar_de_obra`, `borrados_de_obra`) y mantiene
el rechazo a borrar una calle con avance, porque el metrado y la valorización dejarían de cuadrar.

**Borrar una calle en pantalla (07/11), web y APK, para todos:**
- Cada calle del panel tiene un tacho («Borrar calle»). Antes de borrar pregunta «¿Borrar «Av.
  Grau»?» y avisa que sus tramos se van con ella, que un admin puede restaurarla y que una calle
  con avance no se borra.
- Va por la puerta del servidor (`kind: 'work_street_delete'`, solo `street_id`) a
  `borrar_calle_de_obra`, con el servicio de la puerta. Motor puro `shared/src/workStreetDelete.ts`.
- Si Portal la rechaza (calle con avance), su texto queda bajo la pregunta y la calle sigue. Si la
  borra, el mapa se vuelve a pedir (`deleteThenReload`).
- Borrar un tramo espera la lista de tramos en pantalla (o-03): hoy el panel no muestra tramos
  sueltos.

**Falta:** tramos (o-03), etapas (o-04), trabajos (o-05), restaurar y ver lo borrado (admins,
`restaurar_de_obra` y `borrados_de_obra`; la lectura necesita mostrar la respuesta de una
herramienta de solo lectura), borrar un tramo y caminar la calle con GPS (o-13).

**Ancho de móvil en la web:** medido el 06/11 con 433 px, el mínimo que da esa pestaña, no
390. Sin scroll lateral, mapa de 375 × 419 y botones dentro. Un `resize` sin recargar en una
pestaña oculta deja el diseño de escritorio; es de la prueba, porque ahí no llega el evento.

**Sin verificar:** un teléfono real, una obra con tramos y avance reales, y los mosaicos sin
señal. La calle QA no tiene tramos, así que las líneas de avance, los filtros y la fecha de
corte solo están probados con datos de prueba.

## 6-bis. Exportar la obra (diseño `o-12`, 07/11)

- **Botón «Exportar»** en el mapa, web y APK, para todos los que ven la pestaña. Sale lo
  que el mapa muestra: la etapa, el trabajo y el día elegidos. El panel lo dice en una línea,
  por ejemplo «Etapa 1 · Asfaltado · Hasta el 5 nov».
- **Google Earth (KMZ):** el mismo archivo que da Portal. Carpeta «Ejecutado» con una carpeta
  por trabajo, y «Pendiente» con los tramos por hacer. Cada tramo hecho se llama con su calle y
  sus progresivas. Color `AABBGGRR`, coordenadas `lng,lat` y XML escapado.
- **Motor puro:** `shared/src/workMapExport.ts` arma el KML desde `workMapView`, así el archivo
  y el mapa no pueden contar cosas distintas. `shared/src/zipStore.ts` escribe el zip sin
  compresión y sin dependencias; Google Earth lo abre igual. Mismo mapa, mismos bytes.
- **Nombre:** `pavimentacion-av-los-incas-2026-11-05.kmz`, con el día del corte o el de hoy en
  el calendario del teléfono, nunca en UTC.
- **Web:** descarga con `Blob`. **APK:** escribe en la caché y abre «Compartir» con el tipo
  `application/vnd.google-earth.kmz`, para que Google Earth aparezca en la lista.
- **Enlace para el cliente:** copia la página de Portal que ya abría «Portal», con
  `?section=map`. El cliente solo ve lo aprobado.
- **No se dibuja:** «Plano PDF» e «Importar KMZ». No hay quien genere el plano ni puerta para
  importar, así que serían botones de mentira.
- **Verificado:** el zip pasa `unzip -t` y el KML pasa `xmllint`. **Sin verificar:** abrirlo en
  Google Earth de un teléfono real.

## 7. Fase 2: Control de pista y avance sugerido (diseño `o-07`)

**Hallazgo.** La unión entre unidad y tramo ya existe en los datos. Cada foto de unidad
guarda en Portal `metadata.dispatchId`, `tipoFoto`, `geo` y `precisionM`. Nadie lee `geo`
todavía. Por eso no hace falta un modelo nuevo: la progresiva sale de proyectar esas fotos.

**Motor listo:** `shared/src/workMapDischarges.ts`, sin pantalla todavía.
- `projectOntoLine` lleva un punto a su progresiva, igual que `projectToLine` de Portal.
- Una unidad cae en la calle que reúne más fotos, y entre iguales en la más cercana.
- Estados: `placed`, `outside` a más de 30 m del eje, y `noPlace` sin lugar confiable. Una
  foto con precisión peor que 30 m no cuenta.
- Sugiere un tramo por calle, de la menor a la mayor progresiva, y suma los m³. Una sola
  foto no mide tramo, así que no hay nada que confirmar hasta ajustarlo.
- Cada tramo lleva `dispatchIds`, las unidades ubicadas en esa calle. Es lo que el mapa manda al
  confirmar (Agentes, 07/11).
- **Límite conocido:** un hueco entre unidades queda dentro del tramo. La persona lo corrige
  con «Ajustar tramo».

**Pantalla `o-07` (07/11), web y APK, para todos los miembros del canal del cliente** (José 07/11: «Todos verán el mapa no solo admin y todos pueden crear y actualizar»):
- Lee `discharges` del detalle del servicio (Portal `80cad301`, en vivo; Agentes todavía la deja
  afuera hasta su deploy). `dischargesOf` es lista blanca: 100 unidades y 20 puntos como máximo,
  placa vacía como «Sin placa» y foto sin tipo igual cuenta para el lugar.
- Las unidades no llevan montos: el servidor ya no las quita a quien no ve plata. Cotizaciones,
  cobranza y facturas siguen solo para admins.
- Panel «Avance sugerido»: «2 de 3 listas», un tramo por calle con su trabajo, progresivas,
  volumen y «El lugar sale de las fotos de cada unidad». Debajo, «Descargas registradas» con
  número, placa, hora de Lima, m³ y progresivas, o «Fuera de la obra», o «Sin lugar en sus fotos».
- Sobre el mapa: un pin numerado por unidad, rojo si quedó fuera, y el tramo a confirmar resaltado.
  Web con marcadores HTML; APK con una capa de círculos y números con la fuente del estilo.
- **Registrar (07/11):** «Confirmar avance» y «Ajustar tramo», para todos los miembros. No es un atajo:
  `registrar_avance_de_obra` lleva `x-no-action`. El servidor la abre como «Subir al Drive»
  (`POST …/reports/forms` con `kind: 'work_progress'`, `server/src/bots/workProgressForm.ts`):
  - La puerta es `findAskedService` con la necesidad `services`. Quien no está en el canal recibe 404.
  - El servicio sale de la puerta, nunca del teléfono.
  - Pregunta el detalle a Agentes y deja solo los `despachoIds` que trae `discharges`. Si no queda
    ninguno, responde 409 «Esas unidades no salen en el detalle del servicio».
  - El formulario solo pide `nota`, hasta 280. `calleId`, `etiquetaId` o `partidaId`, `desdeM`,
    `hastaM`, `despachoIds`, `entradaId` y `horaDelEquipo` van en el contexto, así
    `validateFormSpec` no ve listas sin opciones.
  - Un reenvío con el mismo `entradaId` vuelve como texto normal: Agentes convierte `ya_marcada`
    en «Ya estaba registrado.».
  - Flujo compartido en `shared/src/workProgressSend.ts`; web y APK solo ponen el transporte.
- **Sin verificar:** el registro de punta a punta, que espera que José apruebe la herramienta de
  Portal (`d623dcd3`). Datos QA «QA-MAPA — borrar» sembrados por Portal en el servicio `6aedcc3a…`.

**Contrato en curso con Portal y Agentes (06/11):**
- **Lectura:** campo `descargas` en la salida del detalle de servicio, solo para lectores
  de la empresa y nunca en el enlace del cliente. No cambia la huella de la herramienta,
  pero `serviceDetailOf` de Agentes es lista blanca y hay que sumarlo allá.
- **Escritura:** herramienta nueva publicada por Portal, con `x-no-action`, aprobada por
  José. Agentes comprueba `client_id`, `service_id` y `spaceRole` admin **antes** de esa
  aprobación. Portal comprueba que calle, partida y etiqueta sean de ese servicio.
- **Fecha del avance (Agentes y Portal, 07/11):** el día en que se colocó, no el de la
  confirmación. Lilachat no la manda: Portal la saca de las fotos de las unidades de `dispatchIds`.
  Si la persona confirma un día después, el tramo cae el día de la obra.
- **Sin señal:** `entradaId` UUID del equipo, índice único `{ companyId, entradaId }`, y
  `code: 'ya_marcada'` se muestra como «Ya estaba registrado». `rate_limited` no corrió
  nada: se reenvía la misma entrada tras `retry_after_s`. `command_id` no sirve aquí, porque
  vence a los 15 minutos.
- **Para todos (José 07/11):** primero fue solo para admins; José lo abrió a todos los miembros
  del canal. Lilachat quitó su candado. Agentes y Portal quitan el suyo (pedido el 07/11).

## 8. Lo que falta decidir

1. **Portal espera a José:** no empieza la puerta de escritura sin que José se lo confirme en
   su sesión (07/11).
2. **Tipo de foto:** cuál marca el tramo de la unidad. La propuesta es de `ingreso` a `vacia`.
3. **Estado de entrada:** si el avance del ingeniero entra `pending` o `approved`.
4. **Tiles y OSRM:** la spec de agosto los da por públicos y sin garantía. Falta
   verificar `OSRM_BASE_URL` en producción.
