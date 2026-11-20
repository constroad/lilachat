# Auditoría adm-01 · Usuarios por espacio (reauditoría 20/11)

Stitch: `screens/ae2e01e71109468a8fbc92a2b63393b3` (design/stitch/adm-01-usuarios-por-espacio-escritorio.png) y `screens/c510471dda784b1b861a3b95596f4df7` (design/stitch/adm-01-usuarios-por-espacio-movil.png).
Captura: design/stitch/capturas/adm-01-impl-escritorio-2011c.png (escritorio 1440, primer viewport) · Huella: d88327327ec2
Captura: design/stitch/capturas/adm-01-impl-movil-2011c.png (móvil 390, primer viewport) · Huella: ce4410ddc81f
Revisor: subagente independiente (reauditoría 20/11 tras e1808eb8…b35ea61c; midió con getComputedStyle y el HTML de Stitch)
Veredicto del revisor: no pasa: quedan 2 filas «falta».
Fecha: 2026-11-20 10:40 (web local en 4005 contra la API de producción, espacio Test, cliente Consorcio Vial del Pacífico; main b35ea61c; medidas con getComputedStyle, Chrome al 90 %)

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
| «Contraer» · alto (escritorio) | 32 px (h-8) | 36 px | falta |
| Segmentado en el móvil | no | sí | diferencia justificada: José 19/11, «Denuncias» por Google Play (PLAY-STORE.spec §5) |
| Título · tamaño (móvil) | 26 px | 26 px | igual |
| Buscador móvil · alto | 47 px | 44 px | igual |
| Chip de espacio · alto | 32 px | 32 px | igual |
| Cabecera de espacio · alto (escritorio) | 64 px (h-16) | 63 px | igual |
| Cabecera de espacio · alto (móvil) | 56 px | 65 px | falta |
| Detalles de la persona en el móvil | líneas corridas | líneas corridas (flex-wrap) | igual |
