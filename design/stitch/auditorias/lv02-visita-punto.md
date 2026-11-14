# Auditoría lv02 · Marcar un punto

Stitch: `screens/d9220bf6a443460d9fb162a5e3335bca` (design/stitch/lv02-visita-punto.png).
Captura: design/stitch/impl/lv02-web-movil.jpg (móvil)
Banco local con el documento real de Portal (`siteVisit.fixture.ts`): 1 punto, sin foto ni GPS.
Revisor: subagente independiente (solo vio las dos imágenes). Las faltas que marcó se arreglaron y se recapturó.
Fecha: 2026-11-14 06:06

| Elemento | Stitch | Implementación | Estado |
| --- | --- | --- | --- |
| Cerrar, kicker y título | X, kicker, «Marcar un punto» | igual, kicker con el código de la visita | igual |
| Pastilla derecha | «GPS ACTIVO» verde | «GPS activo» verde con fix; «Buscando GPS» gris sin fix | igual |
| Foto | foto real | vacía hasta tomarla | diferencia justificada: el banco no toma fotos |
| Chip de hora y GPS | mira + «09:58 · GPS ±4 m» | mira + «GPS ±N m» o «Buscando GPS…» | igual |
| Botón sobre la foto | «Repetir» | «Tomar foto», y «Repetir» con foto | igual |
| Calle sobre la foto | «Calle Los Álamos · Miraflores» | no está | diferencia justificada: Portal no manda la calle del punto |
| Mapa | puntos numerados, guardados en gris, el nuevo con halo | igual (mosaicos de OSM) | igual |
| Línea «calle · a 38 m del portón · Mover» | sí | no está | diferencia justificada: Portal no manda la calle, y Lila no puede mover un punto (solo Portal edita) |
| Clasificación de campo · ¿Qué es? | sí, con «1 elegido» | igual | igual |
| Chips | 3 por fila, radio chico, ícono propio por tipo | igual | igual |
| Guardar punto N | acento, check, 64 dp | igual, 72 px (regla de campo) | diferencia justificada: botón principal de campo a 72 px |
