# Auditoría ma01-mapa-capas · Servicio › Mapa por capas (28/11)

Stitch: `Portal/design/stitch/mapa-campo/ma01-mapa-capas-mobile.stitch.png` (y `-tablet`, `-desktop`, `.html`).
Captura ANTES (APK publicado, emulador `lilachat-qa`, espacio Test, servicio «Recapeo Av. Colonial cdra. 12–18», oscuro):
- `design/capturas/ma01/antes-mapa-apk.png` (estado al abrir).
- `design/capturas/ma01/antes-mapa-sin-hoja-apk.png` (tras cerrar la hoja).
Quejas de José (28/11, capturas de su teléfono en «Pachacamac- Resanes»): botones grandes, botones encima de las capas, «Capas y leyenda» abierta y enorme, sin botón flotante de «Capas», líneas punteadas fuera de «Editar croquis».
Revisor: subagente independiente que recibió SOLO la imagen de Stitch y las dos capturas (sin código ni conclusiones). 16 diferencias de composición.
DESPUÉS: no verificado en el dispositivo (el OTA no está publicado). Lo prueban los tests de componentes (`web/src/spaces/clients/ServiceMapWeb.test.tsx` «ma01 (José 28/11)…», `web/src/spaces/clients/workMap/AvanceMode.test.tsx`) y los puros (`shared/src/workLayerLines.test.ts`, `shared/src/workAvanceManual.test.ts`, `shared/src/workMapMenu.test.ts`). Falta la captura DESPUÉS en el APK.

Las justificaciones son del auditor y citan su fuente; ninguna es una exención de José.

| # | Diferencia (revisor o José) | Estado |
| --- | --- | --- |
| 1 | Al abrir, «Capas y leyenda» ocupa ~63 % de la pantalla; el diseño abre la hoja de la capa | corregida: la hoja abre como vista previa de la capa (`initialMapSheet`); «Capas y leyenda» solo con su botón |
| 2 | Interruptores de partidas encima del avance de la capa | corregida: los interruptores viven solo en «Capas y leyenda» |
| 3 | X de cierre y estado «EN EJECUCIÓN» en la hoja | X: diferencia justificada (la hoja se puede cerrar para ver el mapa entero; función existente, memoria redesign-keeps-current-screen-features). Estado del servicio: diferencia justificada (función existente que se conserva, misma memoria) |
| 4 | «Registrar avance de <capa>» cortado al pie | corregida: la vista previa trae cifra, barra y el botón (52 dp, `bg-primary`) a la vista |
| 5 | Tres acciones flotando al pie («Editar croquis», «Avance», «Registrar») | corregida: UNA acción primaria en la hoja; «Modo avance» y «Editar croquis» pasan a «Más» (`mapMoreItems` con `fieldTools`) |
| 6 | Sin hoja no se ve el avance ni la leyenda | corregida: la vista previa abre por defecto; la leyenda «— Hecho · - - Planificado» está en la hoja ampliada |
| 7 | Dos filas de controles arriba (chips + «Hasta hoy» / «Todos los trabajos») | corregida: una sola fila de chips; corte, trabajo, días y convenciones pasan a «Capas y leyenda» (sección «Ver») |
| 8 | Chips altos (~60 dp) que no caben | corregida: chips de 40 dp, 14 px, punto de 10, nombre recortado a 132 dp con su % aparte (también en Modo Avance, pedido de José) |
| 9 | Chip activo: pastilla morada con check vs tarjeta blanca | corregida en parte: el activo va en superficie con borde y check pequeño; el resto sin fondo de acento. Diferencia justificada en el borde de acento: marca la capa activa en oscuro, donde la «tarjeta blanca» de Stitch no existe |
| 10 | Controles flotantes que el diseño no tiene (ⓘ, ⋮, zoom, ubicación) | ⓘ: corregida (quitado; la leyenda va en «Capas y leyenda»). ⋮ «Más»: diferencia justificada (guarda las funciones existentes). Zoom y «Mi ubicación»: diferencia justificada (José 27/11, memoria ar-measure-ux-expectations: GPS). Botón flotante «Capas»: pedido expreso de José 28/11 |
| 11 | Líneas: grises y punteadas, no se distingue hecho de planificado | corregida: planificado punteado y grueso EN EL COLOR de la capa, hecho sólido en su color, calles sin la capa en línea fina neutra sólida (`layerMapLinesOf`) |
| 12 | Progresivas «0+000…0+800» en cada vértice, sin % | corregida: progresivas solo desde zoom 17 (`STATION_MIN_ZOOM`); «NN %» de la capa a mitad de cada calle |
| 13 | Mapa base oscuro detallado vs bloques esquemáticos | diferencia justificada: Stitch dibuja un esquema; el mapa real es el de la obra (José 06/11 «el mapa literal») |
| 14 | Fila de calle en tres líneas y en m² | diferencia justificada: la cifra va en la unidad de la capa (m² con ancho, m sin él), José 28/11 en `workLayerSummary`; el salto de línea es del ancho del teléfono |
| 15 | Reloj en su propia línea sobre «Último: …» | corregida: sin icono, una línea |
| 16 | Falta el punto de ubicación del usuario | diferencia justificada: aparece al tocar «Mi ubicación» (José 27/11), no se pide el GPS sin que lo toquen |
| J1 | Modo Avance: chips «grandazos» y pista en dos líneas | corregida: mismo `LayerChips` compacto; pista de 13 px en una línea donde cabe |
| J2 | Modo Avance: no deja marcar a mano desde/hasta (parches de una calle) | corregida: «Marcar a mano» con dos toques y aros arrastrables con progresiva, resumen «+N m · 0+002 → 0+006»; toque con alcance de 30 px según el zoom (`shared/src/workAvanceManual.ts`) |

## Ronda 2 (28/11, capturas DESPUÉS del OTA 77c08e56 en el emulador)

Capturas del coordinador: `scratchpad/e2e-ma01/01-mapa.png`, `02-capas.png`, `03-mas.png`, `04-avance.png`, `04b-avance-chips.png`.

| # | Diferencia | Estado |
| --- | --- | --- |
| R1 | La fila de chips pasa por debajo de «⋮»: el 3.er chip no se ve y «55 %» queda cortado | corregida: la fila ocupa solo el ancho a la izquierda de «Más» y recorta ahí (`STRIP_BESIDE_MORE`), con aire al final para que el último chip quede entero al deslizar |
| R2 | La hoja de la capa abre grande y tapa el zoom y «Mi ubicación» | corregida: la vista previa trae solo nombre, cifra, barra y la acción (~25 % de la pantalla); el asa la agranda; la X la pliega a la acción sola (`collapseSheet`, estado `min`); el zoom y «Mi ubicación» suben sobre el borde de la hoja (APK `controlsInset` medido con `onLayout`; web `useHeight` + `.maplibregl-ctrl-bottom-right`) |
| R3 | Modo Avance: lo planificado sale gris punteado | corregida: Modo Avance dibuja con `layerMapLinesOf` del trabajo elegido (punteado en su color, hecho sólido, el resto fino neutro) |
| R4 | Una capa casi negra (Carpeta asfáltica) no se ve en oscuro | corregida: puntos con aro de 1,5 px (`border-on-surface/40` / `ring-[1.5px]`) en chips, «Capas» y selector; en el mapa, borde claro bajo las líneas casi negras (`lineHaloOf`, `lineCasingPaint` con `line-gap-width`) |
| R5 | ¿«Marcar a mano» aparece al tocar una calle? | corregida/confirmada: test `AvanceMode.test.tsx` comprueba que está en el panel tras el toque |

Inventos de Stitch que no van: «Campo / Oficina», «Esc. 1:1500», «Configuración de trazado», «En línea», barra inferior «Mapa / Capas / Avances» (José 28/11: botón flotante «Capas»).

ma04 (Registrar avance): no se revisó en esta ronda (no se abrió en el emulador); queda pendiente su revisión independiente.
