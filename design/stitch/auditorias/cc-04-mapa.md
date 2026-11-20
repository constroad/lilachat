# Auditoría cc-04-mapa · Servicio › Mapa (reauditoría 20/11)

Stitch: `.stitch-work/out_cc/{desktop,tablet,mobile}/cc-04-mapa.stitch.png` del checkout principal.
Captura: design/stitch/capturas/cc-04-impl-escritorio-2011c.png (escritorio 1440, oscuro, servicio Mejoramiento del Corredor Vial) · Huella: 4e9bd0cbff6f
Captura: design/stitch/capturas/cc-04-impl-tablet-2011c.png (tablet 1024, oscuro) · Huella: fffda1c59be9
Captura: design/stitch/capturas/cc-04-impl-movil-2011c.png (móvil 390, oscuro) · Huella: 35147054b14e
Revisor: subagente independiente (reauditoría 20/11 tras e1808eb8…b35ea61c; midió con getComputedStyle y el HTML de Stitch)
Veredicto del revisor: no pasa: queda 1 fila «falta».
Fecha: 2026-11-20 10:40 (web local en 4005 contra la API de producción, espacio Test, cliente Consorcio Vial del Pacífico; main b35ea61c; medidas con getComputedStyle, Chrome al 90 %)

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
| Zoom y ubicación (móvil) · tamaño | 44 px | 29 px (la regla de index.css no vence a la de maplibre) | falta |
| Popover del parche | sí | no abierto | igual |
