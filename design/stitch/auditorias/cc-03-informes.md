# Auditoría cc-03-informes · Servicio › Informes (reauditoría 20/11, verificación de arreglos)

Stitch: `.stitch-work/out_cc/{desktop,tablet}/cc-03-informes.stitch.png` y `mobile/cc-03-informes-v2.stitch.png` del checkout principal.
Captura: design/stitch/capturas/cc-03-impl-escritorio-2011d.png (escritorio 1440, oscuro, servicio Mejoramiento del Corredor Vial) · Huella: 4f9f9e484b5b
Captura: design/stitch/capturas/cc-03-impl-tablet-2011d.png (tablet 1024, oscuro) · Huella: 29c2a0514615
Captura: design/stitch/capturas/cc-03-impl-movil-2011d.png (móvil 390, oscuro) · Huella: 91b8ca2b05a2
Revisor: independiente (verificación de los arreglos de e20d85c3 sobre la reauditoría anterior 780aa8bd; medido con getComputedStyle y el HTML de Stitch)
Veredicto del revisor: pasa: 0 filas «falta».
Fecha: 2026-11-20 11:21 (web local en 4005 contra la API de producción, espacio Test, cliente Consorcio Vial del Pacífico; main cde81b92; medidas con getComputedStyle, Chrome al 90 %)

Las justificaciones son del auditor y citan su fuente; ninguna es una exención de José. «Rediseño 20/11» = rediseño 20/11 aprobado por José, ver design/stitch/INVENTARIO.md sección Rediseño 20/11. Lo que no tiene fuente queda «falta».

| Elemento | Stitch | Implementación | Estado |
| --- | --- | --- | --- |
| Cabecera de una fila en el teléfono | estado y barra «0/6» | título y «Cliente · %» | diferencia justificada: rediseño 20/11 (cabecera de una fila) |
| Tarjetas de resumen y «Total emitidos» | sí | no | diferencia justificada: inventadas por Stitch sin dato, design/stitch/INVENTARIO.md § cc (revisión 19/11) |
| Bloque «Etapas» y «Generar informe de servicio» | no | sí | diferencia justificada: memoria de José redesign-keeps-current-screen-features.md |
| Botón PDF por fila | sí | no en borradores | diferencia justificada: el PDF del borrador lo produce Portal a pedido (José 20/11, brief de la reauditoría) |
| Grupo por día | filas en una tarjeta | una tarjeta por día (1 informe por día en los datos) | igual |
| Ancho del contenido (escritorio) | todo el panel | todo el panel (1176 px) | igual |
| «Crear informe» · alto | 36 px (h-9), primario lleno | 36 px (e20d85c3: SHELL_PRIMARY h-10 → h-9) | igual |
| Fila · radio | 12 px | 12 px | igual |
| Fila · alto (escritorio) | 64 px (h-16) | 64 px (e20d85c3: quitado el `md:min-h-[76px]`) | igual |
| Ícono de fila · tamaño | 38 px | 38 px | igual |
| Título de fila · tamaño (escritorio) | 14 px (text-body-md) | 14 px (e20d85c3: quitado el `md:text-base`) | igual |
| Insignia de estado · tamaño (escritorio) | 11 px | 11 px | igual |
| «Crear informe» en el móvil | en la barra de pestañas | barra propia, sobre la lista | diferencia justificada: mismo motivo que en escritorio (e20d85c3: «Crear informe» ya no vive en la barra compartida con las pestañas, que no hace wrap); consistencia de layout en los dos anchos |
| Fila móvil · alto | 64 px | 64 px | igual |
| Cabecera de una fila (escritorio) | una fila (José 20/11) | una fila (e20d85c3: «Crear informe» se mueve al contenido, sobre la lista) | igual |
