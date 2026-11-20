# Auditoría lv02 · Marcar un punto (reauditoría 20/11)

Stitch: `screens/d9220bf6a443460d9fb162a5e3335bca` (design/stitch/lv02-visita-punto.png).
Captura: design/stitch/capturas/lv02-impl-movil-2011b.png (móvil 390, banco local web/.harness/visit.html?s=lv02 con siteVisit.fixture) · Huella: 4eb2bff6e20f
Revisor: subagente independiente (solo vio las imágenes de Stitch, su HTML y las capturas; 20/11)
Veredicto del revisor: no pasa.
Fecha: 2026-11-20 10:01 (web local en 4005 contra la API de producción, espacio Test, cliente Consorcio Vial del Pacífico; main 02f38ddf)

Las justificaciones son del auditor y citan su fuente; ninguna es una exención de José. «Rediseño 20/11» = rediseño 20/11 aprobado por José, ver design/stitch/INVENTARIO.md sección Rediseño 20/11. Lo que no tiene fuente queda «falta».

| Elemento | Stitch | Implementación | Estado |
| --- | --- | --- | --- |
| Cerrar, kicker, título, «GPS ACTIVO» | sí | igual | igual |
| Título · tamaño | 17 px | 17 px | igual |
| Foto y «Repetir» | foto y «Repetir» | vacío y «Tomar foto» | diferencia justificada: web/.harness/visit.tsx no toma fotos; con foto sale «Repetir» (MarkPointWeb.tsx) |
| Hora en el chip de GPS | «09:58 · GPS ±4 m» | «GPS ±169 m» | falta |
| Calle sobre la foto y línea «a 38 m · Mover» | sí | no | falta |
| Mapa | croquis | OpenStreetMap | igual |
| Croquis · radio | 10 px | 12 px | igual |
| «1 elegido» | sí | no (nada elegido en el banco) | igual |
| Chips de tipo · radio | 12 px | 12 px | igual |
| Chip de tipo · alto | 52 px | 50 px | igual |
| Fila «Medida» con unidades | no | sí | falta |
| Guardar punto N · alto | 62 px | 64 px | igual |
| Guardar punto N · radio | 12 px | 14 px | igual |
