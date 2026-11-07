# Mapa de la obra en Lilachat

> Estado: **diseño en Stitch. Sin código del módulo.** Nace de lo que José pidió el
> 06/11/2026. La pestaña Mapa de hoy es la página de Portal dentro de un WebView.

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
- **No se dibuja todavía:** «Registrar avance», «Compartir avance», «Editar obra» y la
  fecha de corte. Sin puerta de escritura serían botones de mentira.
- **Trampa:** el CSS de MapLibre pone `position: relative` en su contenedor. Si ese
  `div` lleva `absolute`, mide 0 de alto y el mapa no se ve, aunque cargue sin error.
- **APK:** `app/src/spaces/clients/workMap/*` con `@maplibre/maplibre-react-native`.
  Dentro del detalle el mapa no se mueve, para no pelear con el scroll; «Ver mapa
  completo» lo abre a toda la pantalla. Es código nativo: un OTA de este commit no llega
  a nadie hasta instalar el APK nuevo, porque la huella del `runtimeVersion` cambia.

**Estado al 06/11:** APK 0.1.181 (182) publicado en LilaStore, runtime `6176e3ea`. La web y
el APK recorridos en Test con el servicio `6aedcc3a…`: mapa, scroll sobre él, mapa completo,
cierre y giro. Smoke limpio sobre ese APK.

**Sin verificar:** un teléfono real, una obra con tramos y avance reales, el ancho de móvil en
la web, y los mosaicos sin señal. La calle QA no tiene tramos, así que las líneas de avance y
los filtros solo están probados con datos de prueba.

## 7. Lo que falta decidir

1. **Cómo entra Lilachat a escribir:** hoy nada de `work-*` pasa por herramientas. Hace
   falta una puerta con identidad, y Agentes pide `client_id` y `service_id` comprobados.
2. **Sin señal:** la cola con `x-idempotency-key` no existe del lado de Portal.
3. **Tiles y OSRM:** la spec de agosto los da por públicos y sin garantía. Falta
   verificar `OSRM_BASE_URL` en producción.
4. **Despacho y tramo:** cómo se ata una unidad a una progresiva. Es el modelo nuevo.
