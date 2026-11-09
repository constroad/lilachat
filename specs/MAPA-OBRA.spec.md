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

**«Mapa» para todos, de verdad (07/11):** el ingeniero Jeremy no veía «Mapa» (ni «Drive»). La
pestaña dependía de que el atajo «Crear enlace del servicio» estuviera prendido para esa persona
(`links.can('service')`); con los atajos apagados para los miembros, no salía. Ahora la pestaña sale
para todo miembro del canal y el enlace del mapa se pide por la puerta del servidor
(`kind: 'service_link'`, `doorMapLinks`), que comprueba el canal y fija el servicio. Su captura
además era de la app sin la OTA del mapa abierto: hay que abrirla dos veces con señal.

**Editor de calles auditado (José 07/11, con captura de su teléfono):** «no quiero que copies,
audítalo y mejóralo», fácil y fluido para un ingeniero de campo. Su captura: tocó inicio y fin, y
el trazo salió en recta, sin seguir la vía; no había forma de tocar una calle y tomar su nombre; el
mapa no se parecía al del diseño.

Lo que se encontró al auditar el editor de Portal:
- Al tocar una calle, Portal la toma ENTERA (varias cuadras) y para recortarla hay que escribir
  «Hasta». En campo, eso es un paso que sobra.
- El mapa trae la misma línea dos veces: `transportation` (la vía) y `transportation_name` (el
  rótulo). Si entran las dos, la calle vuelve sobre sí misma y su largo se duplica. Portal no lo
  sufría porque arma con una sola capa; Lilachat sí, porque consulta todo lo que se ve.
- Tomaba como tocada la primera vía con nombre, que con la pantalla entera puede ser cualquiera.
- Un río o un canal bajo el dedo contaba como calle.

Cómo quedó (`@constroad/shared/obra` 0.11.0 `streetPick` y 0.12.0 `streetAtTap`; en Lilachat
`workStreetPick.ts`):
- **«Tocar la calle» (por defecto):** un toque trae la calle entera con su nombre y su largo. El
  siguiente toque sobre ella marca el inicio y otro el fin, en cualquier orden. La línea es el
  tramo del eje real entre los dos, con «Inicio 0+080 · Fin 0+320». Si no se marca nada, se guarda
  la calle entera. Un toque a más de 30 m de esa calle elige otra. «Deshacer» quita el fin, luego
  el inicio, luego la calle. Si el nombre lo escribió la persona, se respeta.
- **«A mano»:** como antes, cada toque es una curva. Sirve para un pasaje que el mapa no tiene.
- **Sin OSRM:** el trazo sigue la vía porque sale del eje de la vía en el mapa, no de una ruta.
- **Mapa claro** (openfreemap «positron», gris): los colores de la obra resaltan, como en el
  diseño. Tiene las mismas capas de vías que «liberty».
- **Web:** consulta lo que está bajo el dedo y lee los nombres de los tiles cargados. **APK:**
  consulta lo dibujado bajo el dedo y los rótulos visibles, porque el mapa nativo no deja leer los
  tiles. Si una calle no tiene rótulo en pantalla, llega sin nombre y la persona lo escribe.
- **Falta de o-02:** «Caminar con GPS» (o-13), la etapa al guardar (la etapa es del tramo, no de
  la calle) y probarlo en un teléfono real.

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

## Auditoría lado a lado contra Stitch (José 07/11)

José: «¿Lo auditaste contra los diseños de Stitch?». No se había hecho pantalla por pantalla.
Se hizo el 07/11: la web de producción en escritorio contra las capturas `desktop/o-*`, y el
APK 182 en el emulador (1080×2400) contra `mobile/o-*`. Espacio Test, servicio QA-CTLPIS.

**Lo que funciona como el diseño:** tocar una calle real la toma con su nombre y sigue la vía
(web: «Jirón Moquegua», 845 m entera y 116 m con inicio y fin; APK: 72 m). Exportar en el APK,
avance sugerido del Control de pista (o-07), descargas, calle por iniciar con su tacho.

**Defectos (paso 2, se corrigen):**
1. Web: el panel «Exportar» se sale de la pantalla (el enlace largo estira la grilla hasta
   2 433 px); el botón KMZ y «Copiar enlace» no se ven.
2. Editor: las progresivas del tramo elegido se cuentan desde el inicio de la vía en el mapa
   («Inicio 0+700 · Fin 0+816»). La calle que se guarda es ese tramo, así que empieza en 0+000.
3. Web: al tomar una calle, cada vértice sale numerado (5, 6, 7, 8…). El diseño marca solo
   inicio y fin con su progresiva.
4. APK: en el editor el nombre del servicio sale gris sobre morado y no se lee, y falta el título
   «Definir área de trabajo» que la web sí tiene.
5. APK: el mapa (o-01) y el editor (o-02) no tienen acercar, alejar ni «mi ubicación».
6. Web escritorio: el editor apila todo a lo ancho con un mapa de 300 px. El diseño pone el mapa
   a la izquierda y el formulario en un panel a la derecha.
7. Editor: faltan el rótulo «Auto» y «Medido en el mapa, se puede corregir» en el largo, y el área
   neta (largo × ancho en m²).

**Diferencias que se quedan, con su porqué:**
- Exportar usa los filtros del mapa («Sale lo que ves») en vez de repetir «Qué», «Hasta el día»
  y «Trabajos» dentro del panel. El «Plano PDF» A1/A3 no existe en Portal.
- El chip «Ing. de campo: Rosa Vega» y «GPS RTK en línea» son datos que nadie registra.

**Pantallas sin construir (paso 3):** tramos de una calle (o-03, «Ver tramos»), etapas (o-04),
trabajos (o-05), registrar avance a mano (o-06, botón principal del diseño), caminar con GPS
(o-13), la etapa al guardar una calle, y restaurar o ver lo borrado (admins). Portal ya tiene
`guardar_tramo_de_obra`, `borrar_tramo_de_obra`, `crear_etapa_de_obra`,
`crear_etiqueta_de_obra` y `registrar_avance_de_obra` (a9938ba7).

## Paso 3: una calle y sus tramos, etapas y trabajos (o-03, o-04, o-05), web y APK, para todos

- «Ver tramos ›» en cada calle del panel abre la calle (web: el panel de la derecha; APK: una hoja
  a pantalla completa). Arriba, el nombre y «320 m · 6,0 m»; después «Avance por trabajo», una barra
  por trabajo con los metros aprobados; y «Tramos definidos», cada uno con sus progresivas, su
  tamaño («160 m · 6,0 m · 960 m²»), su etapa y sus trabajos con el porcentaje.
- «Agregar tramo» empieza con la calle entera (0 a su largo). Se tocan los trabajos y la etapa. Ahí
  mismo están «Nuevo trabajo» (nombre y uno de ocho colores de los planos) y «Nueva etapa» (nombre):
  José 07/11 pidió que todo sea fácil para un ingeniero de campo, sin ir a otra pantalla.
- Antes de enviar se avisa: faltan los extremos, el fin va antes del inicio, o el tramo pasa el
  largo de la calle (Portal deja 0,5 m de holgura). El rechazo de Portal se muestra tal cual.
- Editar un tramo usa el mismo formulario sin `entradaId`. Borrar pregunta antes, nombra el tramo y
  avisa que un admin lo restaura y que un tramo con avance aprobado no se borra.
- Puerta del servidor: `server/src/bots/workMapForms.ts`, kinds `work_scope`, `work_scope_delete`,
  `work_stage`, `work_tag`. El servicio sale de la puerta; Portal recibe `etiquetaIds` y
  `partidaIds` por separado, y `etapaId: null` quita la etapa. Motores puros en shared:
  `workStreetDetail.ts` y `workScopeDraft.ts` (`editThenReload` vuelve a pedir el mapa si Portal
  guardó).
- Los datos salen de la lectura del mapa por el enlace (`toClientWorkStreets`), que ya trae el id y
  el ancho de cada tramo y el ancho de la calle (Portal 07/11). `detalle_de_servicio` no los trae.

**E2E web prod (07/11, 20:42Z a 20:53Z, Test, QA-CTLPIS, calle «QA-MAPA calle — borrar»):** «Ver
tramos» mostró 191 m · 6,0 m y el tramo 0+000 a 0+120 con Asfalto QA. Se agregó el tramo 0+120 a
0+191 con Asfalto QA: Portal lo guardó (el total pasó a 191 m). Ahí se vio que la recarga cerraba la
calle; con la recarga silenciosa (609a467) se borró el tramo de prueba y la calle siguió abierta con
su tramo 1. Queda borrado de forma lógica en Portal. No se crearon etapas ni trabajos de prueba,
porque Portal no tiene cómo borrarlos.
**Sin probar:** el APK (falta la OTA) y un miembro que no es admin.

**Pendiente, con su porqué:** nada de o-03 a o-05; o-06 tiene su sección.

## Registrar avance a mano (o-06), web y APK

- Botón principal «Registrar avance» al abrir una calle («Ver tramos»), para todo miembro del canal.
  Cuatro bloques como el diseño: 1 trabajo (chips de los trabajos de sus tramos; con uno solo viene
  elegido), 2 hasta dónde, 3 foto en campo, 4 enviar con nota opcional.
- **Punto de partida = «sigue donde quedó»:** el fin del avance aprobado de ese trabajo en esa calle
  (un retrabajo no lo mueve); sin avance, el inicio de su tramo. «Hasta dónde» se escribe o se mueve
  con −10 m / +10 m, nunca antes del inicio ni pasado el largo de la calle. Metrado «+120 m · 720 m²»
  (el área solo con el ancho de la calle).
- **Fotos:** se suben primero al Drive del servicio (`subir_al_drive`, el mismo camino de «Drive»),
  y el `mediaId` que responde Portal viaja como `fotoIds` (hasta 6). Sin `mediaId` la foto no se
  adjunta y se dice. En el APK solo cámara (foto en campo); en la web, cámara o archivo.
- **Puerta:** `work_manual_progress` → `registrar_avance_manual_de_obra` de Portal (57f06ec7) con
  `calleId`, `etiquetaId|partidaId`, `desdeM`, `hastaM`, `entradaId` (uuid del equipo, reenvío
  idempotente), `horaDelEquipo` y `fotoIds`. El servicio lo pone la puerta. Entra **pendiente**;
  Portal rechaza una hora del equipo adelantada más de 5 min y fotos que no son del Drive del servicio.
- Motor puro `shared/src/workManualProgress.ts`; puerta `server/src/bots/workManualProgressForm.ts`
  (comparte el parser del tramo con `registrar_avance_de_obra`).
- **«Mi GPS»** entre −10 y +10: una sola lectura de la ubicación (sin seguirla) se proyecta sobre el
  eje de la calle (`projectToLine` de `@constroad/shared/obra`) y pasa a ser el fin. Se niega con
  GPS débil (más de ±25 m), a más de 30 m de la calle o antes del punto de partida, y lo dice.
- La herramienta ya estaba aprobada en Agentes al probarla (07/11).

**E2E web prod (07/11, 21:59Z, Test, QA-CTLPIS, calle «QA-MAPA calle — borrar»):** «Ver tramos» →
«Registrar avance» abrió con «Asfalto QA» elegido (único trabajo) y partida 0+000. Dos «+10 m»
dieron «+20 m · 120 m²» (ancho 6,0 m). Con la nota «QA-E2E o-06 borrar» y sin fotos, Portal
respondió «Avance registrado. Queda pendiente hasta que el residente lo apruebe.». Portal guardó
el día en Lima (07/11). La sesión de Portal lo quitó con los pasos de su DELETE /api/work-progress/[id]
(busca, se niega si está aprobado, borra): quedan 0 avances con esa nota. Lilachat no guarda los
pendientes: el mapa solo lee el avance aprobado.
**Sin verificar:** subir una foto desde el mapa (la extensión no deja elegir archivos), el APK
(falta el OTA) y que el pendiente se vea como avance al aprobarlo.

## Caminar con GPS (o-13) y el inicio donde se toca primero, web y APK

- Tercer modo del editor, «Caminar GPS», entre «Tocar la calle» y «A mano». Un botón grande
  «Empezar a caminar» / «Terminar», para usarlo con el teléfono en una mano. La ubicación se pide
  al tocar «Empezar» y se sigue solo hasta «Terminar»; nada corre en segundo plano.
- Motor puro `shared/src/workStreetWalk.ts`: un punto cada 5 m como mínimo (parado no garabatea) y
  nada peor que ±25 m (se muestra «GPS débil», no se dibuja). Tope de 500 puntos, como Portal.
- La banda dice «Caminando · 85 m · GPS ±4 m» y, al terminar, «Listo: 85 m caminados». «Deshacer»
  bota la caminata para caminar de nuevo. Sin permiso, lo dice y propone dibujarla de otra forma.
- Web: `navigator.geolocation.watchPosition` con alta precisión. APK: `expo-location`
  `watchPositionAsync` con `BestForNavigation`.
- **Inicio donde se toca primero (E2E web 07/11):** al marcar inicio y fin en contra del sentido de
  la vía del mapa, el «1» salía en el extremo equivocado: el paquete ordena las progresivas. Ahora
  la línea se da vuelta (`reversed`) y 0+000 es el primer toque; «Deshacer» lo conserva.
- **Sin probar:** caminar de verdad en la calle con un teléfono. El emulador no camina; la prueba
  real la hace un ingeniero en obra.

## Borrados y Restaurar (admins), web y APK

- Agentes desplegó su comprobación del servicio para `restaurar_de_obra` y `borrados_de_obra`
  (890b02e, 21:15Z). Toda escritura del mapa responde además con `data`, el `structuredContent` de
  Portal. Lilachat lo deja pasar en la respuesta de un comando (`CommandResponse.data`, hasta 64 000
  caracteres de JSON; otra cosa se descarta, no se rechaza) y `sendMapTool` lo devuelve.
- «Borrados» sale en la barra del mapa solo para admins del espacio (los que ven plata). Lista las
  calles y los tramos borrados, el más nuevo arriba, con quién y cuándo (hora de Lima). Una calle
  vuelve con los tramos que se borraron con ella; los tramos que se borraron solos salen aparte.
  «Restaurar» vuelve a pedir la lista y el mapa. Motor puro `shared/src/workDeleted.ts`.
- Portal da estas dos herramientas solo a quien tiene `services:manage`: un admin del espacio sin
  ese permiso en Portal recibe el rechazo tal cual.

**E2E web prod (07/11, 21:30Z a 21:36Z, Test, QA-CTLPIS, calle «QA-MAPA calle — borrar»):**
«Borrados» listó el tramo QA borrado antes (0+120 a 0+191, 71 m, «borrado el 7 nov, 3:53 p. m.
por J zamora»). «Restaurar» lo devolvió: la lista quedó «No hay calles ni tramos borrados.» y
«Ver tramos» volvió a mostrar Tramo 2 con su trabajo y su ancho. Después se borró otra vez desde
«Ver tramos» con su confirmación: Test quedó como antes (un solo tramo, 0+000 a 0+120).
**Sin verificar:** el APK (falta el OTA, que José aprueba) y un miembro que no es admin (no debe
ver «Borrados»; cubierto solo por test).

## OTA del mapa (07/11, 23:01Z)

- OTA `003653ec` (git ec7929e) con todo el paso 3 (tramos, etapas, trabajos, GPS al dibujar, Borrados,
  avance a mano y «Mi GPS»). rn-smoke antes y después: 3 aperturas en frío limpias (versionCode 182),
  heap 22 MB.
- **E2E APK (emulador, Test, QA-CTLPIS):** «Ver tramos» de «QA-MAPA calle — borrar» mostró «Registrar
  avance»; el formulario abrió con «Asfalto QA» y 0+000, dos «+10 m» dieron «+20 m · 120 m²». «Mi GPS»
  con el emulador a 4,5 km dijo «Estás a 4492 m de la calle. Acércate o usa ±10 m.». Se canceló sin
  enviar. El emulador quedó en el espacio Constroad.
- **Sin verificar en el APK:** tomar la foto (cámara falsa del emulador) y «Mi GPS» parado sobre la calle.

## Avance parcial (o-08), web y APK

- Tarjeta «Avance parcial» arriba del panel «Compartir avance / Exportar», con el corte del mapa
  (etapa y «hasta el día»). Por trabajo, el último primero: «Asfalto: Av. Los Incas hasta 0+120»,
  «Base: Av. Los Incas · Jr. Los Pinos 0+040 a 0+090». Una calle completa va por su nombre; desde el
  inicio, «hasta 0+xxx»; si no, sus tramos. «2 de 6 vías» y «Metrado aprobado acumulado +440 m
  lineales». Solo avance aprobado, como lo ve el cliente. Motor puro `shared/src/workMapPartial.ts`.
- **Lo que el diseño pide y depende de Portal (preguntado a su sesión el 07/11):** que el enlace del
  cliente respete etapa y día, el interruptor «Mostrar fotos de inspección», «Incluir en el informe
  del servicio» y «Descargar PDF para cliente». No se dibujan hasta que exista su ruta.
- **Respuesta de Portal (07/11):** el enlace no lee etapa ni día por URL (la página los tiene como
  estado; leerlos del query son ~30 líneas, pero sería vista inicial, no recorte: para que el cliente
  vea solo ese corte va firmado en el enlace). No hay bandera de fotos por enlace (cada foto tiene
  `isClientVisible` y el Drive `driveVisibleToClient`). El PDF del enlace ya trae «Avance por calle»;
  no hay PDF solo del mapa. Construirlo en Portal lo decide José.
- **E2E web prod (07/11, 00:41Z, Test, QA-CTLPIS):** «Compartir avance» mostró «Avance parcial ·
  0 de 1 vía · Todavía no hay avance aprobado en este corte · +0 m lineales» (Test no tiene avance
  aprobado). Con avance, cubierto por tests.

## «Compartir avance» (o-08) y «Exportar» (o-12) como dos paneles (07/11, José: «aún no se parece el diseño»)

- La barra del mapa tiene **«Exportar»** (secundario) y **«Compartir avance»** (primario). Antes
  «Compartir avance» abría la exportación con todo junto; ya no.
- **Compartir avance (o-08):** «COMPARTIR AVANCE / Avance parcial», «Elige el corte de obra…»;
  «Etapa de obra» (cada etapa con sus calles, «Etapa 1 (Av. Los Incas, Jr. Los Pinos)»), «Hasta el
  día», «Resumen de frente · Aprobado» con las filas por trabajo, «N de M vías» y «Metrado aprobado
  acumulado», y «Enlace público seguro» con «Copiar» y «El cliente ve solo lo aprobado por la
  inspección técnica.». En el APK, la hoja con chips de etapa y día y «Copiar enlace de avance».
- **Exportar (o-12):** «SACAR LA OBRA / Exportar»; «Qué» (toda la obra o cada etapa con sus metros),
  «Hasta el día», «Trabajos» (todos o uno); «Formatos de exportación»: Google Earth (KMZ) con el
  nombre del archivo, «Enlace para el cliente» con «Copiar enlace de visor», y la «Estructura de
  capas KMZ generada» (Ejecutado por trabajo con sus metros, Pendiente).
- Etapa, día y trabajo de los dos paneles mueven el mapa de atrás (el mismo filtro).
- **Esperando a Portal** (pedido el 07/11, José aprobó): `crear_enlace_de_avance` (corte firmado y
  fotos), `pdf_de_avance_de_obra` (cliente y plano A1/A3), incluir el mapa en el informe del servicio
  e `importar_calles_de_obra`. Al llegar: «Crear enlace de avance», «Descargar PDF para cliente»,
  «Mostrar fotos», «Incluir en el informe», «Plano PDF» e «Importar KMZ o KML».

### «Crear enlace de avance» (Portal 1d397594)

- Puerta `work_progress_link` {stage_id?, until?, photos} → `crear_enlace_de_avance` {servicioId,
  etapaId?, hasta?, mostrarFotos}. Portal firma el corte: el cliente ve solo el mapa a esa etapa y día,
  y las fotos hasta ese día solo si se pidieron; no abre informes, jornadas, despachos, Drive, montos
  ni otro servicio. Devuelve `{url, dias, …}`; Lilachat acepta solo direcciones `*.constroad.com`.
- En el panel: «Mostrar fotos» (interruptor), «Crear enlace de avance», el enlace con «Copiar» y
  «Vence en N días». Cambiar la etapa, el día o las fotos borra el enlace anterior: no se comparte
  uno que no corresponde a lo que se ve.
- «Exportar» conserva «Copiar enlace de visor» con la página entera del servicio.
- **Antes de usarlo:** agentes suma la herramienta a su comprobación de servicio y José la aprueba
  en Agentes → Herramientas. Sin eso la puerta devuelve el rechazo tal cual.

### «Importar KMZ o KML» (Portal abc01353)

- «Traer un trazado» en «Exportar», web y APK. El archivo sube primero al Drive del servicio
  (`subir_al_drive`; su tipo sale del nombre, porque Android y los navegadores mandan un .kmz como
  cualquier cosa). Después la puerta `work_import` abre `importar_calles_de_obra`: sin confirmar,
  Portal dice qué líneas leyó (nombre y largo) y cuáles deja fuera con su motivo; «Crear N calles»
  confirma con un `entradaId` del equipo (un reintento no duplica). El mapa se recarga solo.
- Motor `shared/src/workImport.ts`; puerta en `server/src/bots/workMapForms.ts`.
- **Falta para usarlo:** que el boleto de `subir_al_drive` acepte KMZ/KML (pedido a Portal el 07/11;
  hoy solo foto y video, y Lilachat lo rechaza antes de subir) y que José apruebe la herramienta.

### PDFs del mapa (Portal 02cfceef) y KMZ en el Drive (Portal e0518e47)

- Puerta `work_progress_pdf` {stage_id?, until?, format client|plan, size A3|A1, work_ids?} →
  `pdf_de_avance_de_obra` {formato cliente|plano, tamano, trabajoIds}. Portal responde
  `{status:'ready', url}` en la misma llamada; solo se abre un `https://`.
- «Descargar PDF para cliente» en «Compartir avance»: A4 con el plano, el resumen y el total
  aprobado, al corte del panel. «Plano PDF» en «Exportar», con A3/A1: plano apaisado con el cuadro de
  metrados; con un trabajo elegido, solo ese. En la web el botón genera y queda «Abrir PDF» (un
  enlace real, sin ventana bloqueada); en el APK se abre en el visor del teléfono.
- El boleto de `subir_al_drive` acepta KMZ/KML desde e0518e47 (sin cambiar su esquema): el import ya
  puede subir el archivo. Falta la aprobación de José de las herramientas nuevas.

### «Incluir en el informe del servicio» (Portal 926b9723)

- Interruptor en «Compartir avance» (web y APK). Prendido manda `mapa_en_informe_de_servicio`
  {incluir: true, etapaId?, hasta?} con el corte del panel; apagado, {incluir: false}. Muestra lo que
  Portal respondió: «Se adjunta al informe: Etapa 1 · Hasta el 6 nov.» El PDF del servicio suma la
  hoja «Mapa de avance». Sin corte de día, Portal usa lo aprobado hasta el día del informe.
- **Arranca en su estado real:** `detalle_de_servicio` trae `service.mapa_en_informe = {incluido,
  etapaId?, hasta?}` junto a `has_map` (Portal c7088e7d; no va en la lectura del cliente porque es un
  ajuste interno).
- **El PDF tarda ~30 s** (Portal ed331de6): Portal espera 6 s y si no está responde
  `{status:'generating', retry_after_s}`. Lilachat espera eso (entre 2 y 30 s) y vuelve a pedir el
  mismo formulario, hasta 6 veces; Portal reusa un PDF listo 10 min. Seis pedidos cada ~10 s quedan
  lejos del tope de 20 por minuto de agentes.

### E2E web prod de los paneles nuevos (07/11 noche, Test, QA-CTLPIS)

- «Crear enlace de avance» (02:50:47Z del 08/11): enlace `service-report/<oculto>` de constroad.com,
  «Vence en 7 días».
- «Descargar PDF para cliente» (~02:51:30Z): `ready` desde lila, 200 `application/pdf`, 160 731 bytes.
- «Incluir en el informe» prendido (02:52:16Z, «Se adjunta al informe: Toda la obra · Hasta el día
  del informe.») y apagado otra vez (02:52:31Z, «El informe del servicio va sin el mapa.»). Test
  quedó como estaba.
- «Exportar» → «Generar Plano PDF» A3 (02:54:28Z): 41 s con los reintentos de «generating», 200
  `application/pdf`, 160 325 bytes.
- **Defecto hallado: «Importar» rechazaba todo KML/KMZ** con «Solo se admiten fotos y videos.»
  Portal sí los anunciaba en el boleto, pero `driveUploadOf` filtraba `mimeTypes` a `image/*` y
  `video/*`, y la comprobación local los tiraba. Ahora el boleto conserva los dos tipos de trazado
  (`KMZ_TYPE`, `KML_TYPE` viven en `driveUpload.ts`) y lo demás sigue fuera. Test en
  `driveUpload.test.ts`.
- **Tras el deploy de 90748f1 (03:09Z del 08/11) el import sigue bloqueado, ahora fuera de
  Lilachat.** El boleto que llega a la web trae solo los seis tipos de foto y video, aunque Portal
  (`driveUploadTicket.ts`, `SERVICE_DRIVE_MIME_TYPES`) suma los de trazado y los genéricos. El
  filtro está en agentes: pedido a esa sesión el 08/11. Ningún archivo QA llegó al Drive y no se
  creó ninguna calle.
- **OTA 295864d1 (git 90748f1):** rn-smoke verde antes y después. El emulador lo bajó
  (`DownloadComplete`, `NEW_UPDATE_LOADED`) y quedó en el espacio Constroad. Los paneles en el APK
  no se volvieron a recorrer con este OTA: son los mismos del 683c5a64 más el PDF y el interruptor
  del informe, que se probaron en la web.
- **Import resuelto (agentes dd1baa7, 03:14Z):** el boleto ya pasa los tipos de trazado. E2E web
  prod en Test: un KML «QA-IMPORT borrar» se revisó a las 03:15:14Z («QA-IMPORT borrar · 218 m»,
  «Crear 1 calle»), se creó a las 03:15:22Z («Se creó 1 calle.») y se borró por «Borrar calle» a
  las 03:15:33Z. Queda en «Borrados» (borrado lógico) y el `.kml` queda en el Drive del servicio
  QA-CTLPIS de Test.

### E2E APK con el OTA 295864d1 (08/11, 10:01Z a 10:08Z, emulador, Test, QA-CTLPIS)

- Página del cliente (web, enlace creado a las 10:01Z): «Mapa de la obra», portal en solo lectura,
  cifras, mapa y «Estado por vías» con «QA-MAPA calle — borrar». La calle importada y borrada no
  aparece.
- «Compartir»: el enlace salió a las 10:03:38Z con «Vence en 7 días». «Incluir en el informe» se
  prendió a las 10:04:40Z y se apagó a las 10:04:52Z. «Descargar PDF para cliente» generó el PDF y
  lo abrió en el navegador del teléfono. El Chrome del emulador quedó en su bienvenida y no se
  aceptaron sus términos.
- «Exportar» → «Importar KMZ o KML»: el selector del sistema eligió el KML de Descargas y Portal lo
  revisó («QA-IMPORT APK borrar · 218 m», 10:06:25Z). Se canceló sin crear la calle; el archivo
  quedó en el Drive del servicio de Test.
- «Registrar avance»: «Mi GPS» con la ubicación simulada (`adb emu geo fix`) puso el fin en 0+147
  en menos de 4 s («+147 m · 882 m²»). «Tomar foto» con la cámara del emulador subió la foto al
  Drive en 9 s («1 de 6 fotos»). Se canceló sin registrar.
- **Defectos hallados y corregidos:** el título se partía en «Map / a de / la / obra», apretado por
  los cinco botones (ahora va en su fila y los botones debajo). «Exportar» era más alto que la
  pantalla, sin scroll: tapaba la barra de estado y su parte de arriba no se alcanzaba. Ahora las
  dos hojas usan `PanelSheet` (`CutChips.tsx`): scroll, arrastre por la manija y tope de 92 %.
- Sin verificar: una foto de una cámara real y caminar la calle con un GPS real.
- **Defecto: la web se caía al abrir el mapa después de un deploy** («Algo falló al mostrar
  Lilachat», 08/11 10:18Z). La pestaña abierta pedía `WorkMapCanvas-<hash>.js` viejo, que el deploy
  ya había reemplazado. El mapa usaba `lazy` pelado y no `lazyChunk`, que recarga una vez (José
  30/10, mismo caso con los emojis). Ahora los dos usos del lienzo pasan por `lazyChunk`, y
  `web/src/ui/lazyChunkUsage.test.ts` falla si alguien vuelve a escribir `lazy(() => import(…))`.

### Informe visual para el cliente: diseño Stitch contra los PDF de hoy (José 08/11)

José: «ese es un informe que le voy a entregar al cliente… capas, mis avances, una leyenda… todo lo
construido». Diseños: `o-14-informe-avance-pdf` (A4, 4 hojas) y `o-15-plano-avance-pdf` (A3), ids
en `design/stitch/registro.jsonl`. Los PDF de hoy (Portal `pdf_de_avance_de_obra`, mirados en Test
el 08/11 10:20Z) tienen UNA hoja: encabezado, la línea de la calle sobre fondo blanco y «Resumen por
trabajo». Falta, en los dos:

| Diseño | PDF de hoy |
| --- | --- |
| Plano de la ciudad debajo (manzanas, calles con nombre) | Solo la línea, sin plano |
| Leyenda: color por trabajo, pendiente punteado, contorno por etapa | No hay |
| Progresivas sobre la línea, flecha de norte, escala gráfica | No hay |
| Franja de cifras: avance %, m² de asfalto, calles terminadas, jornadas | No hay |
| Avance por trabajo con barra y «X de Y m · %» | Una línea de texto |
| Tabla de metrados por calle (etapa, largo, ancho, cada trabajo, m², estado) con TOTAL | No hay; el plano trae un cuadro vacío |
| Lo hecho en el corte: jornadas con fecha, tramo, m y m², y mapa de lo hecho | No hay |
| Comparado con el informe anterior | No hay |
| Registro fotográfico con calle, progresiva, trabajo, fecha y hora, autor | No hay |
| Observaciones y firmas (residente, supervisión) | No hay |
| Plano A3: columna con leyenda, cuadro de metrados, avance por calle y cajetín (proyecto, cliente, corte, escala, lámina, elaboró, revisó) | Cuadro de metrados vacío, sin cajetín |
| Pie «Informe N.º · Hoja X de Y» y fecha de emisión | Una línea «Generado el …» |

Lo que Stitch inventó y NO va: «WGS-84 UTM 18S RTK ±2 cm», las especificaciones MAC-2, CSS-1H y
CBR, el RUC, «Firma digital certificada» y el dictamen técnico redactado. Va solo el dato real; el
texto de observaciones lo escribe el residente. El PDF lo arma Portal: pedido a esa sesión el 08/11.

## Auditoría completa contra Stitch (08/11, web prod y APK OTA 295864d1, Test QA-CTLPIS)

José 08/11: «¿Ya está terminado el mapa? ¿Ya auditaste…? ¿Qué más falta?». No estaba terminado. La
sección «Pendiente: nada de o-03 a o-05» de arriba era falsa contra el diseño. Capturas del APK en
el scratchpad de la sesión (`a01-…` a `a13-…`). Lo que falta, por gravedad:

**Impiden o traban el uso (web y APK salvo que se diga)**
1. o-01: no hay «Registrar avance» en el mapa. Se llega bajando (APK: 3 pantallas, pasando el
   Control de pista) y entrando a «Ver tramos». Tampoco hay «Editar obra».
2. o-04 «Etapas» y o-05 «Trabajos» no existen como pantallas: no se ve el avance por etapa (%, m,
   m², jornadas), no se asignan etapas ni trabajos tocando calles en el mapa (brocha), todo va
   tramo por tramo dentro de «Agregar tramo».
3. o-02: no hay campo «Etapa» al crear la calle.
4. o-02 y o-13: cambiar de modo borra sin avisar lo tocado o caminado (APK: se perdieron 734 m y
   141 m).
5. o-10: en un servicio sin calles no se llega a «Importar KMZ o KML» (la barra con «Exportar» no
   sale).
6. o-06 y o-03: no hay mapa al registrar avance ni al ver la calle; las progresivas se eligen a
   ciegas.
7. Informe PDF y plano (o-14, o-15): ver la sección anterior; lo rehace Portal.

**Confunden**
8. o-01: «Longitud total 120 m» arriba y la calle «191 m» abajo, sin explicar que 120 m es lo que
   tiene tramos.
9. o-06: «Hasta dónde» en metros («147») junto al inicio en progresiva («0+000»).
10. Ninguna pantalla rotula progresivas sobre la vía (0+000, 0+100…); solo pines numerados.
11. o-02 (APK): el toque de inicio no deja marca hasta tocar el fin.
12. o-13: sin marcador de mi posición, sin progresiva contra la meta, sin «Pausa», «Deshacer»
    borra toda la caminata, no muestra puntos descartados.
13. o-08 y o-12 (APK): la hoja tapa el mapa; no se ve el corte que se comparte o exporta.
14. o-01 (APK): el bloque de avance queda cortado y su manija no arrastra; el Control de pista
    va antes que las calles.
15. o-03: no muestra el estado de cada tramo ni la parte de la calle sin tramo.

**Menores**
16. o-01: barra de avance sin colores por trabajo ni progresivas; tarjeta de calle sin «Asfalto
    hasta 0+350»; APK sin el cliente en el encabezado y con botones solo ícono.
17. o-02: el largo no se edita; faltan leyenda, norte y botón atrás (APK).
18. o-05 (APK): el teclado tapa los colores y «Crear».
19. o-06: sin indicador de pasos; «Mi GPS» no anticipa el valor.
20. o-07: falta «Ancho útil»; «Confirmar» no queda fijo abajo (APK).
21. o-10 (APK): fondo liso sin mapa; pasos sin cifras.
22. o-09 (página del cliente, Portal): el diseño trae «Línea de tiempo de avance» por corte y
    filtro por etapa; la página de hoy no.

**Defectos de esta ronda ya corregidos:** título partido y hoja «Exportar» sin scroll (APK,
1ba32fa, falta el OTA), la web caída al abrir el mapa tras un deploy (79ce259), el import bloqueado
por el boleto (90748f1 y agentes dd1baa7).

### «Registrar avance» en el mapa (o-01, punto 1 de la auditoría del 08/11)

- Botón principal en la barra del mapa (web) y a todo el ancho bajo el título (APK), solo con las
  herramientas del mapa. `progressTargetOf` (shared) decide: con una sola calle con tramos de
  trabajo abre su formulario de avance directo; con varias pregunta «¿En qué calle?»; sin ninguna
  el botón no sale. La calle abre con «Registrar avance» ya desplegado (`startRecording`).

### Puntos 3, 4 y 5 de la auditoría del 08/11 (web y APK)

- **Etapa al crear la calle (o-02):** el editor muestra «Etapa» (web: lista; APK: chips) cuando la
  obra tiene etapas. Portal guarda la etapa en el tramo, así que `saveStreetWithStage` guarda la
  calle y, con su `calleId` y `largoM`, un tramo 0 a largo con esa etapa (`entry_id` de la calle
  + «-etapa», sin duplicar en un reintento). Si la etapa falla, la calle queda y se dice
  «Ponla desde «Ver tramos»». Sin herramienta nueva ni reaprobación.
- **Cambiar de forma ya no borra en silencio (o-02, o-13):** `modeChangeLoss` pregunta
  «Cambiar de forma borra lo que marcaste (80 m). ¿Cambiar igual?» con «Cambiar» y «Seguir aquí».
  La etapa elegida sobrevive al cambio.
- **Importar en un servicio sin calles (o-10):** la tarjeta «Todavía no hay calles» trae
  «Importar KMZ o KML» debajo de «Dibujar la primera calle».
- Web: «Pantalla completa», «Borrados» y «Abrir en Portal» quedan como ícono con su nombre
  (`title` y texto para lector de pantalla); con «Registrar avance» la barra cortaba las migas y la
  pestaña «Mapa».
- Test «wide board»: el doble de `ResizeObserver` reportaba al último observador (a veces el del
  lienzo); ahora solo al del tablero. Era el falso rojo intermitente.
- **E2E web prod (08/11, 11:28Z, Test, QA-CTLPIS):** «Nueva calle» → «A mano», dos toques (113 m) →
  «Caminar GPS» preguntó «Cambiar de forma borra lo que marcaste (113 m). ¿Cambiar igual?»;
  «Seguir aquí» dejó los 113 m. Se canceló sin guardar. El campo «Etapa» no sale en Test porque
  no tiene etapas (no se crean de prueba: Portal no puede borrarlas): sin verificar en vivo, lo
  cubre el test del editor.

## PDFs con avance aprobado (08/11) y «Etapas» / «Trabajos» con brocha (o-04, o-05)

**PDFs comparados con o-14/o-15 (Test, avance QA aprobado por Portal con OK de José).** El de
cliente salió en 4 hojas, en ~35 s. El plano A3 salió en 1 hoja, en ~10 s. Portal arregló cuatro
diferencias en b6489ccb:
- «1 días» pasa a «1 día».
- El encuadre ahora llena el plano.
- Dice «120 de 191 m».
- La etiqueta con el largo sobre el trazo.

Quedan opcionales: estado y nota por jornada en la hoja 3, y medir los 35 s. El avance y la foto
QA se borraron por la ruta de la app.

**APK OTA 207a02f2 (08/11).** rn-smoke verde antes y después. Pasaron en Test:
- «Registrar avance»: con una sola calle abre directo en 0+060.
- La hoja «Exportar» hace scroll.
- El aviso al cambiar de forma.

El contador «A mano» decía «1 puntos». Ahora usa `handPointsLabel`.

**o-04 y o-05 (auditoría, punto 2).** Motor `shared/src/workMapBrush.ts`, con 21 tests:
- `stageCardsOf`: por etapa, calles, m, m², %, y «Jornadas del … al …» sacado del avance
  aprobado. También lista las calles sin etapa.
- `workRowsOf`: trabajos numerados, con calles y metros.
- `brushRequests`: un toque alterna el pincel en todos los tramos de la calle. Una calle sin
  tramos recibe uno de toda la calle.
- `brushUndoRequests`: «Deshacer» devuelve los tramos como estaban.
- `streetAtTap`: la calle más cercana, a 30 m como máximo.
- `brushLinesOf` y `brushTitle`.

En la web, «Etapas» y «Trabajos» están en la barra del mapa. El panel `WorkLayers` muestra las
tarjetas, «Nueva etapa» o «Agregar trabajo», y «Tocar calles» o «Pintar». Con la brocha encendida,
una franja sobre el mapa muestra «Deshacer» y «Listo», y las calles pintadas se ven gruesas. Cada
toque pasa por `work_scope` de Portal, que lo valida otra vez.

**APK (sin OTA todavía).** En el APK, «Etapas» y «Trabajos» son dos botones bajo «Registrar avance»:
en la fila del título no entran. `WorkLayersSheet` muestra las tarjetas. «Tocar calles» o «Pintar»
abre `BrushMap`, el mapa a pantalla completa que sí se mueve, con la franja, «Deshacer» y «Listo».
«Listo» vuelve a la hoja. La lógica del toque y de «Deshacer» (`paintAt`, `undoStroke`) está en el
motor compartido, así que la web y el APK no la duplican.

**E2E web de la brocha (08/11, prod f5734b4, Test).** «Trabajos» → «Pintar Asfalto QA» abrió la
franja «Pintando Asfalto QA · Toca las calles que la llevan». Un toque sobre la calle QA quiso
quitarle su único trabajo, y Portal contestó «El tramo necesita al menos una partida o una
etiqueta.». No cambió ningún dato. **Defecto, corregido en el motor:**
- `brushProblem` avisa antes de enviar: «Es el único trabajo de esta calle…».
- Una calle sin trabajos no se suma a una etapa: «Píntale uno en «Trabajos»…».
- «Deshacer» de un tramo que creó la brocha lo borra; Portal lo guarda en «Borrados».

**El mismo rechazo rompía la etapa al crear una calle** (`saveStreetWithStage`). Portal lo resolvió
en 65825629: un tramo vale con un trabajo O con su etapa. Uno con solo la etapa no pinta y cuenta
0 m. El descriptor no cambió, así que no hizo falta reaprobación. `brushProblem` ahora solo rechaza
lo que dejaría un tramo vacío: el último trabajo de un tramo sin etapa, o la etapa de un tramo sin
trabajos.

**Progresivas sobre la vía (auditoría, punto 10).** `shared/src/workMapStations.ts`, con 4 tests,
marca 0+000, una cada 100 m y el final. Una marca a menos de 30 m del final le cede el lugar. Se
dibujan como puntos con texto, con la misma pintura en la web y en el APK (tablero, mapa completo).
Solo salen en las calles que muestra la vista.

**«Hasta dónde» con su progresiva (auditoría, punto 9).** El campo dice «Hasta dónde (m)» y abajo
muestra «Progresiva 0+240». Así se lee igual que «Punto de partida 0+120» (web y APK).

**Calle sin tramo (auditoría, punto 15, en parte).** La captura de prod mostró «0+191» flotando: la
parte de la calle sin tramo (0+120 a 0+191) no se dibujaba. `bareLinesOf`, con 2 tests, la pinta
como línea fina gris clara en la web y en el APK. Es una calle que no cuenta como pendiente. Una
calle sin ningún tramo se sigue dibujando entera como pendiente, igual que antes. Queda sin hacer
el estado de cada tramo en «Ver tramos».

**E2E 08/11 tarde, con OK de José (OTA 3edca7f2 y «Etapa QA» en Test).**
- **Web prod:** José dio el OK para crear «Etapa QA» (6af08eb85fea71709b898976). Queda en Test
  porque una etapa no se borra. Con la brocha, la calle QA pasó a «Etapa QA · 1 calle · 120 m ·
  720 m²» y se pintó violeta. «Deshacer» la devolvió a «Sin etapa».
- **APK:** rn-smoke en verde antes y después. Pasaron los botones Etapas y Trabajos, las
  progresivas 0+000 y 0+100, y la línea sin tramo hasta 0+191. «Tocar calles» abre `BrushMap`; el
  toque pintó la calle, «Deshacer» la devolvió y «Listo» volvió a la hoja. También pasaron
  Trabajos (fila numerada y nota) y «Progresiva 0+000» bajo «Hasta dónde». Al final se dejó el APK
  y la web en Constroad.
- **Visto y menor:** la franja de `BrushMap` queda pegada a la barra de estado.

**Mapa en «Registrar avance» y en «Ver calle» (auditoría, punto 6).** `progressPreviewOf`, con 2
tests, deja en el mapa solo la calle: lo hecho, y el tramo nuevo de «Desde» a «Hasta dónde» en el
color del trabajo, con sus progresivas. `ProgressPreview` lo muestra arriba del formulario (o-06) y
arriba de los tramos de la calle (o-03), en la web y en el APK. Ya no se elige a ciegas: el tramo
crece al tocar «+10 m».

**Marca de inicio antes del fin (auditoría, punto 11).** Causa: con el inicio tocado y sin fin,
`pickedLine` de `@constroad/shared/obra` devuelve la calle entera, y el pin «1» caía donde empieza
la calle. Ahora `streetDraftPins` pone el «1» donde tocó el dedo hasta que llegue el fin (web y
APK). El paquete compartido no se tocó (otro repo).

**Caminar con GPS como en o-13 (auditoría, punto 12).** `workStreetWalk.ts` suma:
- «Pausa» y «Seguir»: el teléfono sigue mostrando dónde está, pero la línea no avanza.
- Las lecturas descartadas por señal débil se cuentan en la ayuda («2 lecturas descartadas»).
- «Deshacer» quita unos 20 m (`undoWalkStep`), ya no la caminata entera.
- «Mi posición» es un pin sobre el mapa mientras se camina (`walkPositionPins`).

Web y APK. Lo cubren 4 tests nuevos del motor y 2 del editor web. No se hizo la progresiva
contra la meta: una calle nueva no tiene largo conocido. La ayuda muestra los metros caminados.

**E2E de la vista previa (web prod, Test).** «Registrar avance» mostró la calle con sus
progresivas, y con «+10 m» ×6 el tramo nuevo creció en azul hasta 0+060. Se canceló sin enviar.

**APK, punto 14 y la franja de la brocha.** El Control de pista ahora va después de las calles en
el panel del APK. La franja de `BrushMap` deja 20 dp bajo la barra de estado.

**E2E APK OTA e92cc197 (08/11, Test, con OK de José).** La primera publicación falló con un 502 del
server en un HEAD de asset. El reintento publicó. rn-smoke en verde antes y después. Pasó:
- Vista previa de «Registrar avance»: tramo azul hasta 0+060, con progresivas.
- Marca de inicio: el «1» queda donde se tocó y la ayuda pasa a «Toca dónde termina la obra».
- La «Etapa» sale al crear la calle, con el chip «Etapa QA».
- Caminata con `adb emu geo fix`: en pausa la línea quedó en 477 m aunque el GPS se movió. «Seguir»
  la llevó a 537 m. «Deshacer» la devolvió a 477 m.
- Panel: la calle antes que el Control de pista.

El pin de «mi posición» no se vio en la captura porque quedó fuera del encuadre. Al final se dejó
el APK en Constroad.

**Puntos 13 y 18 (APK).** Las hojas Compartir y Exportar ya no esconden lo que sale: arriba llevan
`CutPreview`, el mapa del corte elegido (etapa y día), con sus progresivas. La hoja de
Etapas/Trabajos usa `keyboard="avoid"`, así el teclado de «Nueva etapa» o «Agregar trabajo» no
tapa los colores ni «Crear». Queda sin revisar el mismo teclado en «Agregar tramo», que vive en un
Modal y no en la hoja.

**Detalles menores (auditoría, puntos 16 a 21; José: «corrige los detalles menores»).**
- **Punto 20 (o-07), «Ancho útil».** La tarjeta del Control de pista muestra el ancho que usa
  Portal y el área que da: «4,5 m · 180 m²». `usefulWidthLabel`, con 2 tests, toma el ancho del
  tramo donde empieza el rango y, si no hay, el de la calle. Sin ancho dice «cárgalo en Portal», el
  mismo caso que Portal rechaza. Web y APK.
- **Punto 19 (o-06), indicador de pasos.** «1 Trabajo · 2 Hasta dónde · 3 Foto · 4 Enviar» arriba
  del formulario, con el paso actual marcado (`manualStepOf`, 1 test). Web y APK.
- **Punto 17 (o-02), leyenda y norte.** El editor muestra «Calle nueva» y «Calles de la obra», y
  una «N» arriba a la izquierda. Web y APK.
- **Punto 21 (o-10).** Los pasos ya iban numerados. El fondo de mapa no se hizo: el mapa del
  servicio no trae su ubicación, y centrarlo en un lugar fijo sería inventar.
- **Punto 17, largo editable: no se hizo.** `guardar_calle_de_obra` calcula el largo con el trazo
  («Portal calcula el largo»). Aceptar un largo medido en obra cambia el esquema de la herramienta
  y pide la reaprobación de José. Queda a decisión suya.
- **Punto 16.** La barra por trabajo y el estado «Asfalto hasta 0+350» ya estaban en las
  tarjetas de calle. Los botones del APK siguen siendo solo ícono, con nombre accesible.

**E2E del OTA 0d85596d (APK, versionCode 182) y de la web, 08/11, espacio Test.**
- APK, Compartir y Exportar: arriba el mapa del corte con 0+000, 0+100 y 0+191 (`compartir-mapa`,
  `exportar-mapa`).
- APK, «Nueva etapa» en la hoja de Etapas: con el teclado abierto, el campo, «Cancelar» y «Crear»
  quedan visibles. Se canceló sin crear nada.
- APK, Registrar avance: «1 Trabajo · 2 Hasta dónde · 3 Foto · 4 Enviar», con «Hasta dónde»
  marcado porque el trabajo ya estaba elegido. Se canceló sin enviar.
- APK, editor de calle: la leyenda («Calle nueva», «Calles de la obra») abajo a la izquierda y la
  «N» arriba a la izquierda.
- APK, brocha: la banda queda debajo de la barra de estado, con aire. «Listo» sin pintar.
- APK, Control de pista: la tarjeta «Ancho útil» dice «6,0 m · 540 m²» para +90 m (90 × 6,0).
- Web (lilachat.constroad.com, ya con 87a39b7): `avance-ancho-util` dice «6,0 m · 540 m²», los
  pasos y la vista previa del avance salen, y el editor muestra la leyenda y la «N».
- El APK y la web quedaron en Constroad y el emulador quedó apagado.

Visto de paso: en la brocha a pantalla completa, el botón de ubicación abajo a la derecha queda
pegado a la barra de navegación. Se puede tocar, pero queda justo.

## José 08/11: recortar la calle, fotos en el mapa y «Avance sugerido» entendible

**Recortar la calle arrastrando el extremo.** José: «selecciono toda la calle, pero no quiero los
últimos 100 m. ¿Es más fácil arrastrar el último punto?». Sí. Es lo que hacen Google My Maps y
Mapbox Draw, y lo que ya tiene el editor de Portal (`dragScopeHandle`).
- Al tocar una calle aparecen dos extremos, «0+000» y «Fin 0+500». Se arrastran sobre la calle.
- El punto soltado se proyecta al eje de la calle, así que el tramo nunca sale de la vía.
- Más de 40 m fuera del eje no mueve nada y avisa «Suelta el extremo sobre la calle.».
- Entre los extremos quedan al menos 5 m, igual que en Portal (`MIN_SCOPE_M`).
- Debajo de la banda hay «Inicio −10 m +10 m · Fin −10 m +10 m», para el ajuste fino que el dedo
  no da.
- En una calle marcada al revés, «Inicio» sigue siendo el 0+000 de la persona.
- Portal sigue midiendo el trazo recortado. La herramienta `guardar_calle_de_obra` no cambia, así
  que no hace falta reaprobarla.
- Motor: `streetDraftHandles`, `dragStreetEnd` y `nudgeStreetEnd` en `workStreetPick.ts`, con
  10 tests nuevos. Web: marcadores `draggable` de MapLibre. APK: `ViewAnnotation` con `draggable`.

**Auditoría: fotos con ubicación y avance.** Esto es lo que hay hoy:
- Lilachat manda `lat`/`lng` con TODA foto de informe, tanto del Control de pista como del Control
  de imprimación.
- Portal sella el lugar en la imagen y lo guarda en la referencia de la foto dentro del informe.
- Pero `metadata.geo` solo se guarda cuando la foto trae `tipoFoto`, es decir, solo en las fotos de
  unidad del Control de pista (`portalFieldReportStore.unitMetadataOf`).
- Por eso solo el Control de pista llega al mapa, como `discharges`. Ahí cada unidad ya se ubica en
  su calle y progresiva, y eso arma el «Avance sugerido».
- Las fotos del Control de imprimación no llegan al mapa ni al avance.
- `discharges` trae los puntos sin la URL de la foto, así que el mapa no podía mostrarla.

Se le pidió a Portal (08/11):
- guardar `metadata.geo` en toda foto con ubicación;
- enviar `mapPhotos` en el detalle del servicio: `{ id, lat, lng, at, kind, url, thumbnailUrl,
  reportType, reportId, plate… }`;
- dar su opinión sobre sugerir avance desde las fotos del CTL-IMP.

Portal propone tratar el CTL-IMP como avance PENDIENTE que confirma el ingeniero:
- La calle sale de las fotos del tramo de riego, proyectadas.
- El rango sale de «Progresiva de / al» si se leen bien y caen en esa calle. Si no, sale del mínimo
  y el máximo de las fotos.
- Se confirma con `registrar_avance_manual_de_obra`, que ya existe, con el trabajo «Imprimación».
  Así no hace falta una herramienta nueva ni reaprobar nada. Queda como siguiente paso.

**Capa «Fotos».** Hay un botón «Fotos · N» sobre el mapa.
- Cada foto cae en su calle y progresiva. Las que quedan a 15 m o menos sobre la misma calle
  comparten un marcador con su número de fotos.
- Las fotos fuera de las calles de la obra van en rojo.
- Tocar un marcador abre el visor de siempre, con las fotos y videos de ese punto. Van de la más
  nueva a la más vieja, con su origen: «Control de pista · QAA-001 · Jr. Los Pinos · 0+040».
- En el APK el mapa chico no recibe toques, así que «Fotos» abre el mapa completo con la capa
  encendida.
- Sin `mapPhotos` el botón no aparece.
- Portal ya lo envía (56752608, 08/11): las 300 más nuevas, con `at` igual a la hora de la toma y
  las URLs del host público. Desde ese commit toda foto de informe con ubicación guarda
  `metadata.geo`.
- Las fotos subidas antes de ese commit sin `tipoFoto` no tienen lugar guardado y no salen. Tampoco
  salen las de «Registrar avance» ni las subidas a mano al Drive, porque no guardan lugar.
- Motor: `workMapPhotos.ts`, con 7 tests.

**«Avance sugerido» → «Avance que marcan las unidades».** José: «no estoy entendiendo esta
pantalla».
- Debajo del título dice «Cada unidad toma fotos al descargar. Los números del mapa son esas
  fotos.».
- La pastilla dice «3 de 4 unidades ubicadas»; antes decía «3 de 4 listas».
- Cada tramo lleva una frase: «Las fotos de 3 unidades caen entre 0+010 y 0+100 de QA-MAPA calle.
  Revisa el tramo y confírmalo: recién ahí se suma al avance.».
- Cuando alguna unidad no suma, dice por qué: «No suman: 1 fuera de las calles de la obra · 1 sin
  ubicación en sus fotos.».

**E2E en vivo de 259b55f (web, Test, 08/11).**
- La tarjeta dice «Las fotos de 3 unidades caen entre 0+010 y 0+100 de QA-MAPA calle — borrar…» y
  «No suman: 1 fuera de las calles de la obra.». La pastilla dice «3 de 4 unidades ubicadas».
- Editor: al tocar Jirón Moquegua vino la calle entera, de 845 m, con sus dos extremos.
- Arrastré el extremo «0+845» con el mouse: quedó en 713 m.
- Los botones ±10 m dieron 723, 703 y 693 m.
- Con dos toques y «Fin +10 m» ×4 quedó un tramo de 103 m, que guardé como «QA-MAPA calle 2 —
  borrar» (6af0add1792b9464e8775e69, ancho 6 m, sin etapa) para el o-09. José dio el OK 08/11.
- **Defecto encontrado:** la brocha sobre una calle SIN tramos mandaba `entry_id: brocha-<ms>`, y
  el server solo acepta un UUID. Respondió «Falta qué parte del informe abrir.».
- Antes solo se había probado sobre calles con tramos, que no llevan `entry_id`.
- Arreglo: `paintAt` recibe el generador del id (`crypto.randomUUID` en la web, `expo-crypto` en
  el APK), con un test que nació rojo.

**Buscar un lugar o pegar el enlace (José 08/11, igual que Portal).**
- Arriba del editor de calle: «Busca un lugar o pega el enlace de Google Maps».
- Coordenadas: `!3d!4d`, `?q=`, `ll=/sll=/daddr=`, `/@` y «lat,lng» se leen en el teléfono, sin ir
  al server.
- Enlace corto (maps.app.goo.gl, goo.gl/maps, g.co/kgs):
  - el server lee SOLO su `Location`, hasta 3 saltos entre esos dominios, con 3,5 s y caché de
    24 h;
  - no es un proxy;
  - si el enlace largo trae un nombre y no coordenadas, se busca ese nombre.
- Nombre de lugar: Nominatim desde el server, con User-Agent propio, caché de 10 min, 20 búsquedas
  por minuto por persona, `viewbox` de ±0,25° alrededor de lo que se mira (`bounded=0`) y 6
  resultados.
- Al elegir un resultado, el mapa vuela ahí a zoom 17.
- Ruta: `POST /api/places`, con sesión. Motor: `shared/src/placeSearch.ts`, con 8 tests; server
  `placeSearch.ts`, con 6 tests.
- **Ubicación del servicio** (`service.ubicacion` de Portal da5382a5): si el mapa no tiene calles,
  el editor abre ahí y no en el GPS del teléfono. También es el centro del sesgo de búsqueda. Con
  esto queda resuelto el «o-10 sin fondo».

**E2E en vivo de e68f4df (web, Test, 08/11, después del deploy).**
- Brocha «Asfalto QA» sobre la calle 2, que no tenía tramos: se creó el tramo y quedó «2 calles ·
  223 m». El arreglo del `entry_id` funciona.
- Registrar avance en la calle 2: elegí el trabajo y toqué «+10 m» ×5. Quedó «Progresiva 0+050»,
  «+50 m · 300 m²» y el paso actual en «3 Foto». Se envió sin foto: «Avance registrado. Queda
  pendiente hasta que el residente lo apruebe.». Es el día 1 del o-09; el día 2 va mañana.
- Buscador: «Parque de la Reserva, Lima» pasó por `POST /api/places` y Nominatim. Volvió un solo
  resultado y el mapa voló ahí. Cancelé sin guardar.
- **Capa «Fotos» bloqueada fuera de Lilachat.** Portal devuelve 8 `mapPhotos` para QA-CTLPIS (lo
  confirmó con una lectura). El detalle que llega a Lilachat por `client.service.requested` trae
  `discharges`, pero no `mapPhotos`: lo vi en las props del tablero.
  - El server de Lilachat no lo filtra (`serviceDetailOf` lo lee y `withoutMoney` lo conserva).
  - Queda en agentes, que arma la respuesta del evento. Se le pidió el 08/11.
  - Lo mismo vale para `service.ubicacion`.
- La web quedó en Constroad.
- **Capa «Fotos», en vivo (08/11, después de agentes c55bdb5).**
  - QA-CTLPIS muestra «Fotos · 8», en 5 marcadores: 0+010 (1), 0+040 (2), 0+070 (2), 0+100 (1) y
    2 fuera de las calles.
  - Al tocar el de 0+040 se abre el visor con sus 2 fotos.
  - La imagen sale rota porque es la URL de la semilla QA y su archivo no existe en lila.
  - Defecto: una foto de unidad sin `reportType` decía «Avance registrado». Ahora dice «Unidad
    QAA-001».

**OTA 738451a4 (git 5bba71a), APK en Test, 08/11. José dio el OK: «si a ambos».**
- rn-smoke en verde antes y después, con 3 aperturas en frío.
- Mapa del servicio: «Fotos · 8». Al tocarlo se abre el mapa completo con los marcadores (1, 2, 2,
  1 y 2 en rojo fuera de las calles).
- Tocar el marcador de 0+070 abre el visor con «Unidad QAC-003 · QA-MAPA calle — borrar · 0+070»,
  1 de 2. La imagen sale negra porque es la URL de la semilla.
- La calle 2 se ve con el avance aprobado del día 1 (Portal aprobó 6af0b26a02e17b9996f881d1).
- Editor: al tocar Jirón Moquegua vinieron sus extremos y los ±10 m (335 m).
- Arrastre por `ViewAnnotation` con pulsación larga: el extremo «0+000» se movió y la calle quedó
  en 86 m. Cancelé sin guardar.
- **Defectos encontrados, ya arreglados (van en la próxima OTA):**
  - «Jr. Lampa Lima» daba «No encontramos ese lugar», porque OpenStreetMap escribe «Jirón». Ahora
    se expanden Jr., Av., Psje., Ca./Cl. y Urb. antes de buscar (2 tests).
  - Con el buscador, el aviso, los ±10 m y los botones, el mapa del editor quedaba como una tira
    en el teléfono. El buscador se esconde cuando ya hay una calle marcada.
  - En el APK, el primer toque en «Buscar» con el teclado abierto solo cerró el teclado. Con
    «Enter» busca. Queda anotado.
- El APK volvió a Constroad y el emulador quedó apagado.

**José 08/11, viendo el tutorial 1: «percibo errores de UI, la calle aparece abajo de un chip».**
- En el teléfono, la leyenda («Carpeta asfáltica · Pendiente de ejecución») flotaba arriba a la
  izquierda del mapa y tapaba las calles y los marcadores de esa esquina. El aviso «Calle
  guardada» quedaba debajo de ella.
- Ahora, en pantalla angosta, la leyenda es una fila arriba del mapa, bajo los filtros, en web y
  APK. El aviso va en esa misma zona, fuera del mapa. En pantalla ancha la leyenda sigue abajo a
  la izquierda.
- Verificado con la sonda del grabador a 390 px: las 2 calles, los marcadores 1, 2, 3 y 4 y las
  progresivas se ven completos.
- La OTA 7b0e66fb (git e835bdf, OK de José: «sí publica») lleva la búsqueda con «Jr.», el
  buscador que se esconde, el encuadre de la calle entera y «Calle guardada». rn-smoke en verde
  antes y después. La leyenda en fila va en la OTA siguiente.

**Antes y después en el visor del Drive (José 08/11, Portal 2ef27173; cualquier miembro del canal).**
- Debajo de cada foto del Drive del servicio van «Antes · Después · Sin marcar», el tramo (texto
  libre de hasta 80 caracteres, por ejemplo «Jr. Conchucos cdra 1») y «Guardar marca». Está en
  web y APK.
- Pedido: `kind: photo_phase` con `photo_id`, `phase` (`antes`, `despues` o `null`) y
  `stretch`. Va a `marcar_foto_antes_despues` con `{servicioId, fotoId, fase, tramo?}`. Sin
  tramo, la foto conserva el que tenía.
- Datos:
  - el `id` de cada archivo del Drive (Portal cffb259b, agentes c56584e) es el `fotoId`;
  - `photoMarks` del detalle trae las marcas hechas a mano.
  - Una foto sin `id` no muestra la barra.
- El visor guarda la función con la que se abrió. Por eso el Drive la arma antes que el visor y
  lee las marcas del render actual (test en `ServiceDriveWeb.test.tsx`).
- **E2E en Test (web, sonda del grabador, 20:54–20:56Z):**
  1. Marcar una foto del Drive como «Antes · QA cuadra 1». Portal respondió «La foto queda como
     «antes» de QA cuadra 1».
  2. Volver a abrir la app: la marca llegó desde Portal en `photoMarks`.
  3. «Sin marcar» y guardar. La foto volvió a como estaba.
- El APK lleva lo mismo; sale en la próxima OTA.

## Pendientes del mapa cerrados antes del tutorial 2 (José 08/11: «¿ya terminaste todos tus pendientes del mapa?»)

**Avance sugerido desde el Control de imprimación (#253).** Motor `shared/src/workPrimeCoat.ts`, con 6 tests.
- Lee las `mapPhotos` con `reportType: 'CTL-IMP'`. Cada foto cae en su calle, con la misma
  proyección de la capa «Fotos» (`placeOnStreets`).
- Un informe sobre una calle es un tramo: va de la primera a la última foto. Dos días de riego son
  dos tramos.
- Las fotos fuera de las calles no suman y se dicen: «No suman: 1 foto fuera de las calles de la obra».
- Cuando el trabajo de imprimación (nombre con «imprim») ya tiene aprobado ese rango, deja de sugerirse.
- La tarjeta «Avance que marcan las fotos del riego» dice «Las 3 fotos del riego caen entre 0+010 y
  0+090 de Jr. Los Pinos. Revisa el tramo y regístralo: recién ahí se suma al avance.».
- «Revisar y registrar» abre el «Registrar avance» de esa calle ya lleno, con el trabajo Imprimación,
  «Desde» y «Hasta dónde». Es la propuesta de Portal: la herramienta manual que ya existe, sin una
  nueva ni reaprobación. Sin un trabajo de imprimación en la calle, la persona lo elige.
- Sale para quien puede editar el mapa, en la web (`PrimeCoat.tsx`) y en el APK.
- **Sin verificar en vivo:** en Test no hay un Control de imprimación con fotos ubicadas sobre una
  calle. Las de «Mejoramiento del Corredor Vial Pachacútec» son del 4 al 6/11, de antes de que
  Portal guardara `metadata.geo`, y ese servicio no tiene calles. El tutorial 6 crea uno en
  QA-CTLPIS y ahí se recorre.

**Estado de cada tramo en «Ver tramos» (auditoría, punto 15, lo que faltaba).** Como la pastilla de
o-03: «Pendiente», «En proceso» o «Terminado» (`StretchState` en `workStreetDetail.ts`). «Terminado»
cuando todos sus trabajos tienen aprobado todo el tramo, medido en metros y no en el % redondeado.
Un tramo sin trabajos no lleva pastilla. Web y APK.

**APK: el teclado tapaba los formularios del mapa.** Visto en el emulador (OTA 5656fea2, Test):
- en el editor de calle, el teclado tapaba el propio campo «Nombre»;
- en «Agregar tramo», tapaba los trabajos, la etapa y «Guardar tramo», y no se podía bajar.
- Causa: `KeyboardAvoidingView` solo actuaba en iOS. Ahora usa `padding` en los dos, como `Sheet`.
- Visto de paso, fuera del mapa: `CreateUserScreen` y `CompleteProfileScreen` tienen el mismo
  `undefined` en Android.

**APK: el primer toque en «Buscar» solo cerraba el teclado.** Reproducido en el emulador: el primer
toque cerró el teclado sin buscar; el segundo buscó. Causa: los toques del editor (un `Modal`)
pasan por sus ancestros de React, y el `ScrollView` del detalle del servicio no tenía
`keyboardShouldPersistTaps`, así que capturaba el toque para cerrar el teclado. Ahora es `handled`
en las dos vistas del detalle.

**APK: «Mi ubicación» pegado a la barra del sistema** en la brocha y en el mapa completo. Los
controles suben lo que mide la barra (`controlsInset`).

Los tres arreglos del APK van en la próxima OTA, que aprueba José.

**Renombrar y borrar etapas y trabajos (Portal c1c35c58, pedido el 08/11 al escribir el tutorial 2).**
Antes, quien escribía mal «Etapa 2» o creaba un trabajo de más se quedaba con él.
- Cada tarjeta de «Etapas» y cada fila de «Trabajos» tiene «Renombrar» (lápiz) y «Borrar»
  (papelera), en web (`LayerActions.tsx`) y APK (`useLayerActions`).
- Un trabajo que es partida del contrato no se renombra ni se borra desde el mapa: no muestra las
  acciones (`WorkRow.editable`).
- Antes de enviar: nombre vacío, más de 60 letras o el nombre que ya tiene otra (sin mayúsculas ni
  espacios, la misma regla de Portal).
- Al borrar se pregunta qué pasa con sus tramos: «Sus tramos quedan sin etapa» o «quedan sin él».
- Los rechazos de Portal se muestran debajo: un trabajo con avance registrado no se borra; una
  etapa que usa el corte del mapa en el informe del servicio, tampoco.
- Pedidos `work_stage_edit`, `work_tag_edit`, `work_stage_delete` y `work_tag_delete` →
  `editar_etapa_de_obra`, `editar_etiqueta_de_obra`, `borrar_etapa_de_obra` y
  `borrar_etiqueta_de_obra`. Motor `shared/src/workLayerEdit.ts`, con 6 tests; server con 4 tests nuevos.
- «Borrados» también lista las etapas y los trabajos («Etapa «X»», «Trabajo «X»»). «Restaurar»
  manda `stage_id` o `tag_id` y el server lo pasa como `etapaId` o `etiquetaId` (uno solo de los
  cuatro). Vacío dice «No hay nada borrado en el mapa.».
- **E2E en vivo (José aprobó las herramientas a las 00:17Z del 09/11; Test, QA-CTLPIS):**
  - Con el grabador en ensayo: se creó «QA etapa — borrar», se renombró a «QA etapa 2 — borrar»
    y se borró. También se creó «QA trabajo — borrar» y se borró.
  - En el Chrome de José, contra producción (00:24–00:27Z):
    - «Borrados» listó la etapa y el trabajo en 3 s, con quién y cuándo.
    - «Restaurar» devolvió los dos al mapa (3 s cada uno).
    - Renombrar a «etapa  qa» avisó «Ya hay otra con ese nombre.» sin enviar.
    - Los dos se volvieron a borrar (3,8 s y 3,3 s) y quedaron borrados.
    - Borrar «Asfalto QA», que tiene avance aprobado, mostró el rechazo de Portal y no borró nada.
  - Test quedó como estaba: «Etapa QA» y «Asfalto QA».
  - Con el grabador, el server local quedaba sin responder el envío del formulario
    («Borrando…» y «Borrados» cargando). En producción no pasa. Sospecha: el server local es
    HTTP/1.1, con un tope de 6 conexiones por host. Sin confirmar.
  - Portal escribe «ya tiene 1 avances registrados»: se le avisó.
