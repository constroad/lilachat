# Auditoría cc-03-informes · Servicio › Informes (reauditoría 20/11)

Stitch: `.stitch-work/out_cc/{desktop,tablet}/cc-03-informes.stitch.png` y `mobile/cc-03-informes-v2.stitch.png` del checkout principal.
Captura: design/stitch/capturas/cc-03-impl-escritorio-2011c.png (escritorio 1440, oscuro, servicio Mejoramiento del Corredor Vial) · Huella: adceb5a7afd2
Captura: design/stitch/capturas/cc-03-impl-tablet-2011c.png (tablet 1024, oscuro) · Huella: 76eb3e54af13
Captura: design/stitch/capturas/cc-03-impl-movil-2011c.png (móvil 390, oscuro) · Huella: 8476d520208a
Revisor: subagente independiente (reauditoría 20/11 tras e1808eb8…b35ea61c; midió con getComputedStyle y el HTML de Stitch)
Veredicto del revisor: no pasa: quedan 5 filas «falta».
Fecha: 2026-11-20 10:40 (web local en 4005 contra la API de producción, espacio Test, cliente Consorcio Vial del Pacífico; main b35ea61c; medidas con getComputedStyle, Chrome al 90 %)

Las justificaciones son del auditor y citan su fuente; ninguna es una exención de José. «Rediseño 20/11» = rediseño 20/11 aprobado por José, ver design/stitch/INVENTARIO.md sección Rediseño 20/11. Lo que no tiene fuente queda «falta».

| Elemento | Stitch | Implementación | Estado |
| --- | --- | --- | --- |
| Cabecera de una fila en el teléfono | estado y barra «0/6» | título y «Cliente · %» | diferencia justificada: rediseño 20/11 (cabecera de una fila) |
| Tarjetas de resumen y «Total emitidos» | sí | no | diferencia justificada: inventadas por Stitch sin dato, design/stitch/INVENTARIO.md § cc (revisión 19/11) |
| Bloque «Etapas» y «Generar informe de servicio» | no | sí | diferencia justificada: memoria de José redesign-keeps-current-screen-features.md |
| Botón PDF por fila | sí | no en borradores | diferencia justificada: el PDF del borrador lo produce Portal a pedido (José 20/11, brief de la reauditoría) |
| Grupo por día | filas en una tarjeta | una tarjeta por día (1 informe por día en los datos) | igual |
| Ancho del contenido (escritorio) | todo el panel | todo el panel (1176 px) | igual |
| «Crear informe» · alto | 36 px (h-9), primario lleno | 40 px, primario lleno | falta |
| Fila · radio | 12 px | 12 px | igual |
| Fila · alto (escritorio) | 64 px (h-16) | 76 px | falta |
| Ícono de fila · tamaño | 38 px | 38 px | igual |
| Título de fila · tamaño (escritorio) | 14 px (text-body-md) | 16 px | falta |
| Insignia de estado · tamaño (escritorio) | 11 px | 11 px | igual |
| «Crear informe» en el móvil | en la barra de pestañas | fila propia bajo las pestañas | falta |
| Fila móvil · alto | 64 px | 64 px | igual |
| Cabecera de una fila (escritorio) | una fila (José 20/11) | dos filas: pestañas arriba, título y «Crear informe» debajo (93 px) | falta |
