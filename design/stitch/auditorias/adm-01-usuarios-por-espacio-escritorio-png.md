# Auditoría adm-01 · Usuarios por espacio (reauditoría 20/11)

Stitch: `screens/ae2e01e71109468a8fbc92a2b63393b3` (design/stitch/adm-01-usuarios-por-espacio-escritorio.png) y `screens/c510471dda784b1b861a3b95596f4df7` (design/stitch/adm-01-usuarios-por-espacio-movil.png).
Captura: design/stitch/capturas/adm-01-impl-escritorio-2011b.png (escritorio 1440, primer viewport) · Huella: 8f570a283465
Captura: design/stitch/capturas/adm-01-impl-movil-2011b.png (móvil 390, primer viewport) · Huella: dab20be0d771
Revisor: subagente independiente (solo vio las imágenes de Stitch, su HTML y las capturas; 20/11)
Veredicto del revisor: no pasa.
Fecha: 2026-11-20 10:01 (web local en 4005 contra la API de producción, espacio Test, cliente Consorcio Vial del Pacífico; main 02f38ddf)

Las justificaciones son del auditor y citan su fuente; ninguna es una exención de José. «Rediseño 20/11» = rediseño 20/11 aprobado por José, ver design/stitch/INVENTARIO.md sección Rediseño 20/11. Lo que no tiene fuente queda «falta».

| Elemento | Stitch | Implementación | Estado |
| --- | --- | --- | --- |
| Pastilla SUPERADMIN y avatar en la cabecera | sí | no | diferencia justificada: inventados por Stitch, INVENTARIO fila adm-01 |
| Atajo ⌘K del buscador | sí | no | diferencia justificada: inventado por Stitch, INVENTARIO fila adm-01 |
| Segmentado con «Denuncias» | 2 opciones | 3 opciones | diferencia justificada: José 19/11, cola de denuncias de Google Play (PLAY-STORE.spec §5) |
| Logos de espacio en vez de iniciales | iniciales | logo | diferencia justificada: auditorías/adm-01-usuarios-por-espacio.md (reuse de SpaceLogo) |
| «También en» bajo el nombre | junto al nombre | debajo | diferencia justificada: INVENTARIO fila adm-01 («en código va debajo») |
| Título · tamaño (escritorio) | 30 px | 28 px | falta |
| Tarjeta · radio | 12 px | 16 px | falta |
| Tarjeta · borde | 1 px | 1 px | igual |
| Tarjeta · padding | 24 px | 22 px | igual |
| Fila de tabla · alto | 78 px | 80 px | igual |
| «Contraer» · alto | 36 px | 40 px | falta |
| Segmentado en el móvil | no | sí | diferencia justificada: José 19/11, «Denuncias» por Google Play (PLAY-STORE.spec §5) |
| Título · tamaño (móvil) | 26 px | 22 px | falta |
| Buscador móvil · alto | 47 px | 44 px | igual |
| Chip de espacio · alto | 32 px | 40 px | falta |
| Cabecera de espacio · alto | 55 px | 64 px | falta |
| Detalles de la persona en 2 columnas con etiqueta | líneas corridas | grilla | falta |
