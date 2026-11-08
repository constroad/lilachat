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
