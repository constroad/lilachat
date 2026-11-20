# Auditoría cc-04-mapa · Servicio › Mapa (reauditoría 20/11, verificación de arreglos)

Stitch: `.stitch-work/out_cc/{desktop,tablet,mobile}/cc-04-mapa.stitch.png` del checkout principal.
Captura: design/stitch/capturas/cc-04-impl-escritorio-2011d.png (escritorio 1440, oscuro, servicio Mejoramiento del Corredor Vial) · Huella: 15506f18633c
Captura: design/stitch/capturas/cc-04-impl-tablet-2011d.png (tablet 1024, oscuro) · Huella: c6639818a504
Captura: design/stitch/capturas/cc-04-impl-movil-2011d.png (móvil 390, oscuro) · Huella: d159fa334541
Revisor: independiente (verificación de los arreglos de c0d023ee sobre la reauditoría anterior 780aa8bd; medido con getComputedStyle y el HTML de Stitch)
Veredicto del revisor: pasa: 0 filas «falta».
Fecha: 2026-11-20 11:21 (web local en 4005 contra la API de producción, espacio Test, cliente Consorcio Vial del Pacífico; main cde81b92; medidas con getComputedStyle, Chrome al 90 %)

Las justificaciones son del auditor y citan su fuente; ninguna es una exención de José. «Rediseño 20/11» = rediseño 20/11 aprobado por José, ver design/stitch/INVENTARIO.md sección Rediseño 20/11. Lo que no tiene fuente queda «falta».

| Elemento | Stitch | Implementación | Estado |
| --- | --- | --- | --- |
| Cabecera de una fila y pestañas compactas | tres filas | una fila | diferencia justificada: rediseño 20/11 (mapa-v2-movil, mapa-v2-escritorio) |
| Acciones flotando sobre el mapa, «Compartir avance» en «Más» | en la barra | flotando | diferencia justificada: rediseño 20/11 (mapa-v2-escritorio) |
| «Hasta hoy» arriba a la izquierda | centro, con fecha | izquierda, sin fecha | diferencia justificada: rediseño 20/11 (mapa-v2-movil) |
| Zoom abajo a la derecha, sin barra de escala | arriba izquierda, escala | abajo derecha | diferencia justificada: escala inventada por Stitch, auditoría anterior (revisión del lote de José 20/11) |
| Panel: partidas, chips de etapa y «Dibujos» | sí | no | diferencia justificada: el servicio no tiene partidas, tramos ni dibujos («Sin tramos definidos» en la captura), no hay dato detrás |
| Panel: tarjetas de calle | no | sí cuando hay calles | diferencia justificada: función existente que se conserva, memoria de José redesign-keeps-current-screen-features.md |
| Panel: «Avance de la obra» | al pie, debajo de las listas | al pie, debajo de las capas | igual |
| Panel · ancho | 350 px | 360 px | igual |
| Fila del panel · radio | 10 px | 10 px (rounded-[10px] en WorkMapItems; sin filas en los datos) | igual |
| Fila del panel · tamaño de título | 13 px | 13 px | igual |
| Hoja inferior «Capas y leyenda» (móvil) | abierta | cerrada | diferencia justificada: rediseño 20/11 (mapa-v2-movil, mapa a pantalla) |
| Capas y «Más» flotantes (móvil) · tamaño | 44 px | 44 px | igual |
| Zoom y ubicación (móvil) · tamaño | 44 px | 44 px (c0d023ee: `.maplibregl-ctrl-group.maplibregl-ctrl-group button` gana el empate de especificidad con el estilo propio de MapLibre, que antes quedaba en 29 px) | igual |
| Popover del parche | sí | no abierto | igual |
