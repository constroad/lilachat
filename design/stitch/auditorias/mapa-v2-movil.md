# Auditoría mapa-v2-movil · Servicio › Mapa en el teléfono (APK y web angosta)

Stitch: `.stitch-work/out_v2/mobile/mapa-v2-movil.stitch.png` (+ `.html`) del checkout principal.
Captura: design/stitch/capturas/mapa-v2-movil.png (móvil 390, oscuro) · Huella: px)
Revisor: subagente independiente
Fecha: 2026-11-20 09:51

Rediseño aprobado por José el 20/11 («Rediseño 20/11» en INVENTARIO). Sus quejas con capturas:
espacio perdido arriba, el cliente repetido, los días debían flotar sobre el mapa, «Compartir avance»
dentro de «Más». Las justificaciones de abajo son mías y dicen el motivo real; ninguna es una exención
de José.

| Elemento | Stitch | Implementación | Estado |
| --- | --- | --- | --- |
| Cabecera de una fila: ←, nombre, «CLIENTE · 40 %», enlace, ⋮ | sí | igual, solo en la pestaña Mapa (`ServiceShell` `slim`, `ServiceShellWeb` `flush` + `serviceSlimLine`) | igual |
| Pestañas Pedidos · Informes · Mapa · Drive compactas | sí | igual (más bajas en Mapa) | igual |
| Conteo en «Drive 58» | sí | «Drive» sin número | diferencia justificada: Portal no manda el conteo del Drive con el servicio (igual que cc-05) |
| El mapa ocupa el resto de la pantalla | sí | igual; en el APK el mapa sale del scroll y se mueve | igual |
| Chips de día flotando: «Todos», «Vie 20/11 · 18», «Jue 19/11 · 23»… | sí | igual (`MapDayChips`, cuenta de fotos y unidades del día) | diferencia justificada: no verificable en la captura; el servicio QA no tiene avance por día y no salen chips. El revisor trabaja en solo lectura sobre la cuenta real (instrucción de la revisión 20/11) |
| «Hasta hoy ▾» flotando bajo los días | sí | igual; con un solo día con avance no despliega | igual |
| Selector de trabajo junto a «Hasta hoy» | no | sí, cuando el servicio tiene trabajos | diferencia justificada: ya existía y cambia las cifras y la exportación; quitarlo rompe funciones |
| Columna derecha de botones redondos: Capas, Leyenda (ⓘ), ⋮ Más | sí | igual (`MapFloating.tsx`); ⓘ solo si hay trabajos que leer | igual |
| ⋮ Más: «Compartir avance», «Pantalla completa» | sí | igual, primero; debajo siguen Nueva calle, Etapas, Trabajos, Exportar, Abrir en Portal, Borrados | igual |
| «Descargar KML» en «Más» | sí | no | diferencia justificada: no existe en Lilachat; Stitch lo inventó (Exportar ya baja KMZ) |
| «Editar croquis» chico abajo a la izquierda | sí | igual (pastilla) | igual |
| «Registrar» junto a «Editar croquis» | no | sí, para quien edita y con calles | diferencia justificada: función existente del ingeniero de campo (o-06) |
| Leyenda al pie («8 pend. · 4 lev. · 12 parches») | sí | leyenda por trabajo, «Pendiente de ejecución» y «Por aprobar (N)» al tocar ⓘ | diferencia justificada: las cuentas de observaciones y dibujos viven en «Capas y leyenda»; la leyenda muestra lo que pinta el mapa |
| Zoom + / − y GPS abajo a la derecha | sí | igual (`MapControls` en el APK; MapLibre en la web, GPS ahora en todo mapa) | igual |
| Panel de capas y avance | no visible | hoja sobre el mapa que abre «Capas» y cierra ✕ | igual (el diseño no la muestra abierta) |
| Bloques «MZA.», nombres de calles, progresivas pintadas sobre la vía | sí | mapa base real de OpenFreeMap | diferencia justificada: invención de Stitch; el mapa es el real |
| Parches P1…P12 con insignia de estado y placas de unidades | sí | dibujos, observaciones y unidades reales de Portal | igual (vienen de los datos) |
| Estado «EN EJECUCIÓN» y barra de avance en la cabecera | no | no en Mapa (siguen en Pedidos, Informes y Drive y en el panel) | igual |
| Mapa base en tema oscuro | oscuro | mapa base oscuro (commit 4fc080d8) | igual |
| Atribución «© OpenMapTiles» bajo «Editar croquis» | — | visible, a la derecha de la pastilla | igual |
