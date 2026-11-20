# Auditoría cc-05-drive · Servicio › Drive (reauditoría 20/11, verificación de arreglos)

Stitch: `.stitch-work/out_cc/{desktop,tablet,mobile}/cc-05-drive.stitch.png` del checkout principal.
Captura: design/stitch/capturas/cc-05-impl-escritorio-2011d.png (escritorio 1440, oscuro, servicio Mejoramiento del Corredor Vial) · Huella: de7616d3e218
Captura: design/stitch/capturas/cc-05-impl-tablet-2011d.png (tablet 1024, oscuro) · Huella: 6c5ab778b190
Captura: design/stitch/capturas/cc-05-impl-movil-2011d.png (móvil 390, oscuro) · Huella: baf4b3868dfe
Revisor: independiente (verificación de los arreglos de aa7d7b3e sobre la reauditoría anterior 780aa8bd; medido con getComputedStyle y el HTML de Stitch)
Veredicto del revisor: pasa: 0 filas «falta».
Fecha: 2026-11-20 11:21 (web local en 4005 contra la API de producción, espacio Test, cliente Consorcio Vial del Pacífico; main cde81b92; medidas con getComputedStyle, Chrome al 90 %)

Las justificaciones son del auditor y citan su fuente; ninguna es una exención de José. «Rediseño 20/11» = rediseño 20/11 aprobado por José, ver design/stitch/INVENTARIO.md sección Rediseño 20/11. Lo que no tiene fuente queda «falta».

| Elemento | Stitch | Implementación | Estado |
| --- | --- | --- | --- |
| Pegar · cámara · Subir, zona de pegar, buscador, chips y vista | sí | igual | igual |
| Tarjeta de archivo: etiqueta, miniatura, pie | sí | igual | igual |
| Tarjeta de archivo · radio | 12 px (rounded-xl) | 12 px (aa7d7b3e: rounded-xl 24 px efectivo → rounded-card 12 px, como la de carpeta) | igual |
| Pie de tarjeta · alto | 40 px | 40 px | igual |
| Cabecera de una fila en el teléfono | estado y barra | sin ellos | diferencia justificada: rediseño 20/11 (cabecera de una fila) |
| Ancho del contenido (escritorio, 1440 px) | todo el panel | todo el panel (1176 px) | igual |
| Tarjeta de archivo · ancho (1440 px) | 200 px (5 por fila) | 227 px, 5 columnas (aa7d7b3e: `lg:grid-cols-5` fijo → `lg:grid-cols-[repeat(auto-fill,minmax(200px,1fr))]` fluido) | diferencia justificada: el grid ya no es un conteo fijo de columnas — a 1440 px (1176 px de contenido) caben 5 columnas y el `1fr` reparte el sobrante a 227 px; a 1920 px (1709 px de contenido) ya son 8 columnas de ~204 px, medido en esta misma sesión. El ancho exacto a 1440 px es un efecto esperado de `minmax(200px,1fr)` (el track se estira para llenar la fila), no una columna fija |
| Nombre de archivo · tamaño | 14 px | 14 px | igual |
| Carpetas: 4 por fila, sin chevron | sí | sí | igual |
| Tarjeta de carpeta · radio | 12 px | 12 px | igual |
| Carpetas en el móvil | carrusel | carrusel | igual |
| Cámara en la fila de pestañas (móvil) | sí | barra propia, sobre el contenido | diferencia justificada: mismo motivo que en escritorio (aa7d7b3e: Pegar/cámara/Subir ya no viven en la barra compartida con las pestañas, que no hace wrap); consistencia de layout en los dos anchos |
| Menú del archivo | hoja inferior | no abierto (solo lectura) | igual |
| Cabecera de una fila (escritorio) | una fila (José 20/11) | una fila (aa7d7b3e: Pegar/cámara/Subir se mueven al contenido de Drive) | igual |
| Chips Todo/Fotos/Videos/Documentos en el móvil | una fila | envuelven en dos filas, sin recorte | diferencia justificada: aa7d7b3e («Documentos» quedaba recortado contra el borde con solo scroll horizontal; ahora `flex-wrap`) |
