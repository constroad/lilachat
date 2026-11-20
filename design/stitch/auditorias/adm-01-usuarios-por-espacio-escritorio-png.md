# Auditoría adm-01 · Usuarios por espacio (reauditoría 20/11, verificación de arreglos)

Stitch: `screens/ae2e01e71109468a8fbc92a2b63393b3` (design/stitch/adm-01-usuarios-por-espacio-escritorio.png) y `screens/c510471dda784b1b861a3b95596f4df7` (design/stitch/adm-01-usuarios-por-espacio-movil.png).
Captura: design/stitch/capturas/adm-01-impl-escritorio-2011d.png (escritorio 1440, primer viewport) · Huella: 7e6c752b434c
Captura: design/stitch/capturas/adm-01-impl-movil-2011d.png (móvil 390, primer viewport) · Huella: b3846fe729b2
Revisor: independiente (verificación de los arreglos de cde81b92 sobre la reauditoría anterior 780aa8bd; medido con getComputedStyle y el HTML de Stitch)
Veredicto del revisor: pasa: 0 filas «falta».
Fecha: 2026-11-20 11:21 (web local en 4005 contra la API de producción, espacio Test, cliente Consorcio Vial del Pacífico; main cde81b92; medidas con getComputedStyle, Chrome al 90 %)

Las justificaciones son del auditor y citan su fuente; ninguna es una exención de José. «Rediseño 20/11» = rediseño 20/11 aprobado por José, ver design/stitch/INVENTARIO.md sección Rediseño 20/11. Lo que no tiene fuente queda «falta».

| Elemento | Stitch | Implementación | Estado |
| --- | --- | --- | --- |
| Pastilla SUPERADMIN y avatar en la cabecera | sí | no | diferencia justificada: inventados por Stitch, design/stitch/INVENTARIO.md fila adm-01 |
| Atajo ⌘K del buscador | sí | no | diferencia justificada: inventado por Stitch, design/stitch/INVENTARIO.md fila adm-01 |
| Segmentado con «Denuncias» | 2 opciones | 3 opciones | diferencia justificada: José 19/11, cola de denuncias de Google Play (PLAY-STORE.spec §5) |
| Logos de espacio en vez de iniciales | iniciales | logo | diferencia justificada: auditorías/adm-01-usuarios-por-espacio.md (reuse de SpaceLogo) |
| «También en» bajo el nombre | junto al nombre | debajo | diferencia justificada: design/stitch/INVENTARIO.md fila adm-01 («en código va debajo») |
| Título · tamaño (escritorio) | 30 px | 30 px | igual |
| Tarjeta · radio | 12 px | 12 px | igual |
| Tarjeta · borde | 1 px | 1 px | igual |
| Tarjeta · padding | 24 px | 22 px | igual |
| Fila de tabla · alto | 78 px | 80 px | igual |
| «Contraer» · alto (escritorio) | 32 px (h-8) | 32 px (cde81b92: h-9 solo en el teléfono, md:h-8) | igual |
| Segmentado en el móvil | no | sí | diferencia justificada: José 19/11, «Denuncias» por Google Play (PLAY-STORE.spec §5) |
| Título · tamaño (móvil) | 26 px | 26 px | igual |
| Buscador móvil · alto | 47 px | 44 px | igual |
| Chip de espacio · alto | 32 px | 32 px | igual |
| Cabecera de espacio · alto (escritorio) | 64 px (h-16) | 63 px | igual |
| Cabecera de espacio · alto (móvil) | 56 px | 56.6 px (cde81b92: py-1 en el teléfono, md:py-2) | igual |
| Detalles de la persona en el móvil | líneas corridas | líneas corridas (flex-wrap) | igual |
