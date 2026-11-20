# Auditoría cc-04-mapa · Servicio › Mapa (reauditoría 20/11)

Stitch: `.stitch-work/out_cc/{desktop,tablet,mobile}/cc-04-mapa.stitch.png` del checkout principal.
Captura: design/stitch/capturas/cc-04-impl-escritorio-2011b.png (escritorio 1440, oscuro, servicio Mejoramiento del Corredor Vial) · Huella: 30c0d9ba0871
Captura: design/stitch/capturas/cc-04-impl-tablet-2011b.png (tablet 1024, oscuro) · Huella: def06d022976
Captura: design/stitch/capturas/cc-04-impl-movil-2011b.png (móvil 390, oscuro) · Huella: 49931c0b679d
Revisor: subagente independiente (solo vio las imágenes de Stitch, su HTML y las capturas; 20/11)
Veredicto del revisor: no pasa. La tablet no la abrió el revisor.
Fecha: 2026-11-20 10:01 (web local en 4005 contra la API de producción, espacio Test, cliente Consorcio Vial del Pacífico; main 02f38ddf)

Las justificaciones son del auditor y citan su fuente; ninguna es una exención de José. «Rediseño 20/11» = rediseño 20/11 aprobado por José, ver design/stitch/INVENTARIO.md sección Rediseño 20/11. Lo que no tiene fuente queda «falta».

| Elemento | Stitch | Implementación | Estado |
| --- | --- | --- | --- |
| Cabecera de una fila y pestañas compactas | tres filas | una fila | diferencia justificada: rediseño 20/11 (mapa-v2-movil, mapa-v2-escritorio) |
| Acciones flotando sobre el mapa, «Compartir avance» en «Más» | en la barra | flotando | diferencia justificada: rediseño 20/11 (mapa-v2-escritorio) |
| «Hasta hoy» arriba a la izquierda | centro, con fecha | izquierda, sin fecha | diferencia justificada: rediseño 20/11 (mapa-v2-movil) |
| Zoom abajo a la derecha, sin barra de escala | arriba izquierda, escala | abajo derecha | diferencia justificada: escala inventada por Stitch, auditoría anterior (revisión del lote de José 20/11) |
| Panel: partidas, chips de etapa y «Dibujos» | sí | no en la captura | falta |
| Panel: tarjetas de calle | no | sí | falta |
| Panel: «Avance de la obra» | abajo, grande | arriba, pequeño | falta |
| Panel · ancho | 350 px | 360 px | igual |
| Fila del panel · radio | 10 px | 14 px | falta |
| Fila del panel · tamaño de título | 13 px | 13 px | igual |
| Hoja inferior «Capas y leyenda» (móvil) | abierta | cerrada | diferencia justificada: rediseño 20/11 (mapa-v2-movil, mapa a pantalla) |
| Botones flotantes (móvil) · tamaño | 44 px | 36 px | falta |
| Popover del parche | sí | no abierto | igual |
