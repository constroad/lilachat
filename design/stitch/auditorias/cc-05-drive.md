# Auditoría cc-05-drive · Servicio › Drive (reauditoría 20/11)

Stitch: `.stitch-work/out_cc/{desktop,tablet,mobile}/cc-05-drive.stitch.png` del checkout principal.
Captura: design/stitch/capturas/cc-05-impl-escritorio-2011c.png (escritorio 1440, oscuro, servicio Mejoramiento del Corredor Vial) · Huella: 4e0ca56262f3
Captura: design/stitch/capturas/cc-05-impl-tablet-2011c.png (tablet 1024, oscuro) · Huella: c0ea1f92aa89
Captura: design/stitch/capturas/cc-05-impl-movil-2011c.png (móvil 390, oscuro) · Huella: e461044e33e2
Revisor: subagente independiente (reauditoría 20/11 tras e1808eb8…b35ea61c; midió con getComputedStyle y el HTML de Stitch)
Veredicto del revisor: no pasa: quedan 4 filas «falta».
Fecha: 2026-11-20 10:40 (web local en 4005 contra la API de producción, espacio Test, cliente Consorcio Vial del Pacífico; main b35ea61c; medidas con getComputedStyle, Chrome al 90 %)

Las justificaciones son del auditor y citan su fuente; ninguna es una exención de José. «Rediseño 20/11» = rediseño 20/11 aprobado por José, ver design/stitch/INVENTARIO.md sección Rediseño 20/11. Lo que no tiene fuente queda «falta».

| Elemento | Stitch | Implementación | Estado |
| --- | --- | --- | --- |
| Pegar · cámara · Subir, zona de pegar, buscador, chips y vista | sí | igual | igual |
| Tarjeta de archivo: etiqueta, miniatura, pie | sí | igual | igual |
| Tarjeta de archivo · radio | 12 px (rounded-xl) | 24 px | falta |
| Pie de tarjeta · alto | 40 px | 40 px | igual |
| Cabecera de una fila en el teléfono | estado y barra | sin ellos | diferencia justificada: rediseño 20/11 (cabecera de una fila) |
| Ancho del contenido (escritorio) | todo el panel | todo el panel (1552 px) | igual |
| Tarjeta de archivo · ancho | 200 px (5 por fila) | 226 px (6 por fila) | falta |
| Nombre de archivo · tamaño | 14 px | 14 px | igual |
| Carpetas: 4 por fila, sin chevron | sí | sí | igual |
| Tarjeta de carpeta · radio | 12 px | 12 px | igual |
| Carpetas en el móvil | carrusel | carrusel | igual |
| Cámara en la fila de pestañas (móvil) | sí | fila aparte | falta |
| Menú del archivo | hoja inferior | no abierto (solo lectura) | igual |
| Cabecera de una fila (escritorio) | una fila (José 20/11) | dos filas: «Pegar», cámara y «Subir» bajan bajo las pestañas | falta |
