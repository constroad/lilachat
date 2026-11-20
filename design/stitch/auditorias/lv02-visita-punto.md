# Auditoría lv02 · Marcar un punto (reauditoría 20/11)

Stitch: `screens/d9220bf6a443460d9fb162a5e3335bca` (design/stitch/lv02-visita-punto.png).
Captura: design/stitch/capturas/lv02-impl-movil-2011c.png (móvil 390, banco local web/.harness/visit.html?s=lv02 con siteVisit.fixture) · Huella: 8a331b3c1736
Revisor: subagente independiente (reauditoría 20/11 tras e1808eb8…b35ea61c; midió con getComputedStyle y el HTML de Stitch)
Veredicto del revisor: pasa.
Fecha: 2026-11-20 10:40 (web local en 4005 contra la API de producción, espacio Test, cliente Consorcio Vial del Pacífico; main b35ea61c; medidas con getComputedStyle, Chrome al 90 %)

Las justificaciones son del auditor y citan su fuente; ninguna es una exención de José. «Rediseño 20/11» = rediseño 20/11 aprobado por José, ver design/stitch/INVENTARIO.md sección Rediseño 20/11. Lo que no tiene fuente queda «falta».

| Elemento | Stitch | Implementación | Estado |
| --- | --- | --- | --- |
| Cerrar, kicker, título, «GPS ACTIVO» | sí | igual | igual |
| Título · tamaño | 17 px | 17 px | igual |
| Foto y «Repetir» | foto y «Repetir» | vacío y «Tomar foto» | diferencia justificada: web/.harness/visit.tsx no toma fotos; con foto sale «Repetir» (MarkPointWeb.tsx) |
| Hora en el chip de GPS | «09:58 · GPS ±4 m» | «10:35 · GPS ±169 m» | igual |
| Calle sobre la foto y línea «a 38 m · Mover» | sí | no | diferencia justificada: el punto no tiene dato de calle ni de distancia (shared/src/siteVisit.ts no los trae) |
| Mapa | croquis | OpenStreetMap | igual |
| Croquis · radio | 10 px | 12 px | igual |
| «1 elegido» | sí | no (nada elegido en el banco) | igual |
| Chips de tipo · radio | 12 px | 12 px | igual |
| Chip de tipo · alto | 52 px | 50 px | igual |
| Fila «Medida» con unidades | no | sí | diferencia justificada: función existente que se conserva, shared/src/siteVisit.ts desde 5aa22aa5 (14/11) |
| Guardar punto N · alto | 62 px | 64 px | igual |
| Guardar punto N · radio | 12 px | 14 px | igual |
